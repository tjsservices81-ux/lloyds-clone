/**
 * Transaction endpoints:
 *   POST /api/transactions                       -> record a payment, move the balance
 *   GET  /api/transaction/timeline/:accountId    -> string[] of "Month YYYY"
 *   GET  /api/transaction/:accountId/:year/:month -> { summary: { incoming, outgoing } }
 *
 * "Sending money" is a real balance change: the amount (negative for an outgoing
 * payment, as the client sends it) is added to the account balance and a
 * transaction row is written, both inside one database transaction so a failure
 * can never leave the balance and the history out of step.
 */
import { Router } from "express";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { accounts, transactions } from "../../shared/schema";
import { requireAuth } from "../auth";
import { serializeTransaction } from "../serializers";
import { timelineForAccount } from "../timeline";

export const transactionsRouter = Router();

// Returns an account's transactions in the shape the account screen renders,
// with a running balance computed from the account's current balance.
transactionsRouter.get("/transactions/:accountId", requireAuth, async (req, res) => {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, String(req.params.accountId)),
        eq(accounts.customerId, req.customerId!),
      ),
    )
    .limit(1);
  if (!account) return res.status(404).json({ message: "Account not found" });

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .orderBy(asc(transactions.createdAt));

  const total = rows.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0);
  let running = Number.parseFloat(account.balance) - total; // opening balance

  const items = rows.map((r) => {
    const amount = Number.parseFloat(r.amount);
    running += amount;
    return {
      id: r.id,
      amount,
      balanceAfter: Number(running.toFixed(2)),
      date: r.createdAt.toISOString(),
      type: amount >= 0 ? "deposit" : "withdrawal",
      payee: {
        name: r.payeeName,
        reference: r.reference ?? r.businessType ?? r.type,
      },
    };
  });

  // Most recent first for display.
  items.reverse();
  return res.json(items);
});

const KNOWN_TYPES = new Set([
  "Contactless Payment",
  "Direct Debit",
  "Debit Card",
  "Bank Transfer",
  "Standing Order",
  "Online Payment",
]);

transactionsRouter.post("/transactions", requireAuth, async (req, res) => {
  const { accountId, accountName, amount, type } = req.body ?? {};

  if (typeof accountId !== "string" || typeof accountName !== "string") {
    return res.status(400).json({ message: "accountId and accountName are required" });
  }
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) {
    return res.status(400).json({ message: "A non-zero amount is required" });
  }
  const txnType = KNOWN_TYPES.has(type) ? type : "Bank Transfer";

  try {
    const created = await db.transaction(async (tx) => {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(
          and(eq(accounts.id, accountId), eq(accounts.customerId, req.customerId!)),
        )
        .limit(1);

      if (!account) {
        throw Object.assign(new Error("Account not found"), { status: 404 });
      }

      const balance = Number.parseFloat(account.balance);
      const overdraft = Number.parseFloat(account.overdraftLimit);
      // Outgoing payments (negative amount) cannot exceed balance + overdraft.
      if (value < 0 && balance + value < -overdraft) {
        throw Object.assign(new Error("Insufficient funds"), { status: 422 });
      }

      const [txn] = await tx
        .insert(transactions)
        .values({
          accountId: account.id,
          type: txnType,
          amount: value.toFixed(2),
          payeeName: accountName,
        })
        .returning();

      await tx
        .update(accounts)
        .set({ balance: (balance + value).toFixed(2), updatedAt: new Date() })
        .where(eq(accounts.id, account.id));

      return txn;
    });

    return res.json(serializeTransaction(created));
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return res.status(status).json({ message: (error as Error).message });
  }
});

transactionsRouter.get("/transaction/timeline/:accountId", requireAuth, async (req, res) => {
  const owned = await assertOwned(String(req.params.accountId), req.customerId!);
  if (!owned) return res.status(404).json({ message: "Account not found" });
  return res.json(await timelineForAccount(String(req.params.accountId)));
});

transactionsRouter.get("/transaction/:accountId/:year/:month", requireAuth, async (req, res) => {
  const owned = await assertOwned(String(req.params.accountId), req.customerId!);
  if (!owned) return res.status(404).json({ message: "Account not found" });

  const year = Number(req.params.year);
  const month = Number(req.params.month); // 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const rows = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, String(req.params.accountId)),
        gte(transactions.createdAt, start),
        lt(transactions.createdAt, end),
      ),
    );

  let incoming = 0;
  let outgoing = 0;
  for (const row of rows) {
    const value = Number.parseFloat(row.amount);
    if (value >= 0) incoming += value;
    else outgoing += value;
  }

  // The client's schema requires incoming > 0 and outgoing < 0; keep a tiny
  // non-zero floor so a quiet month still parses.
  return res.json({
    summary: {
      incoming: incoming > 0 ? Number(incoming.toFixed(2)) : 0.01,
      outgoing: outgoing < 0 ? Number(outgoing.toFixed(2)) : -0.01,
    },
  });
});

async function assertOwned(accountId: string, customerId: string) {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.customerId, customerId)))
    .limit(1);
  return Boolean(row);
}
