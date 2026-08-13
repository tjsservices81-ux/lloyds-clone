/**
 * User + payee endpoints:
 *   GET    /api/users/me                 -> current customer
 *   GET    /api/users/payee?limit&id&name -> paginated payees { payees, totalCount, nextCursor }
 *   PATCH  /api/users/payee               -> create a payee
 *   DELETE /api/users/payee/:id           -> remove a payee
 */
import { Router } from "express";
import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { accounts, customers, payees, transactions } from "../../shared/schema";
import { hashSecret, requireAuth, verifySecret } from "../auth";
import { serializeCurrentUser, serializePayee } from "../serializers";
import { generateTransactions } from "../generate";

export const usersRouter = Router();

// Update the customer's display name and/or email. Login is unaffected — the
// current tokens keep working, so the session persists.
usersRouter.patch("/users/profile", requireAuth, async (req, res) => {
  const updates: Partial<{ firstName: string; lastName: string; email: string }> = {};

  if (typeof req.body?.name === "string" && req.body.name.trim()) {
    const parts = req.body.name.trim().split(/\s+/);
    updates.firstName = parts[0];
    updates.lastName = parts.slice(1).join(" ") || "";
  }
  if (typeof req.body?.email === "string" && req.body.email.trim()) {
    updates.email = req.body.email.trim();
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  const [customer] = await db
    .update(customers)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(customers.id, req.customerId!))
    .returning();

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.customerId, customer.id));
  return res.json(
    serializeCurrentUser(customer, accountRows.map((r) => r.id)),
  );
});

// Change the password. The session is intentionally NOT revoked, so the user
// stays logged in on their device after changing it.
usersRouter.post("/users/change-password", requireAuth, async (req, res) => {
  const currentPassword =
    typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "New password must be at least 6 characters" });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, req.customerId!))
    .limit(1);
  if (!customer) return res.status(404).json({ message: "User not found" });

  // If a current password is supplied, it must match; allow omitting it so a
  // customer who only has the auto-generated password can set their own.
  if (currentPassword) {
    const ok = await verifySecret(currentPassword, customer.passwordHash);
    if (!ok) {
      return res.status(403).json({ message: "Current password is incorrect" });
    }
  }

  await db
    .update(customers)
    .set({ passwordHash: await hashSecret(newPassword), updatedAt: new Date() })
    .where(eq(customers.id, customer.id));

  return res.json({ ok: true });
});

// Generate random transaction history for an account between two dates, and
// move the balance by the net so the history stays consistent with it.
usersRouter.post(
  "/users/accounts/:accountId/generate-transactions",
  requireAuth,
  async (req, res) => {
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

    const from = new Date(req.body?.from);
    const to = new Date(req.body?.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return res
        .status(400)
        .json({ message: "Provide a valid 'from' and 'to' date range" });
    }
    const count = Math.min(Math.max(Number(req.body?.count) || 15, 1), 100);

    const generated = generateTransactions(from, to, count);
    const net = generated.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0);

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values(
        generated.map((t) => ({
          accountId: account.id,
          type: t.type,
          amount: t.amount,
          payeeName: t.payeeName,
          reference: t.reference,
          createdAt: t.createdAt,
        })),
      );
      const newBalance = (Number.parseFloat(account.balance) + net).toFixed(2);
      await tx
        .update(accounts)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(accounts.id, account.id));
    });

    return res.json({ ok: true, created: generated.length });
  },
);

// Set an account's balance directly (simulation tool).
usersRouter.patch(
  "/users/accounts/:accountId/balance",
  requireAuth,
  async (req, res) => {
    const balance = Number(req.body?.balance);
    if (!Number.isFinite(balance)) {
      return res.status(400).json({ message: "A numeric balance is required" });
    }

    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, String(req.params.accountId)),
          eq(accounts.customerId, req.customerId!),
        ),
      )
      .limit(1);
    if (!account) return res.status(404).json({ message: "Account not found" });

    await db
      .update(accounts)
      .set({ balance: balance.toFixed(2), updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    return res.json({ ok: true, balance: Number(balance.toFixed(2)) });
  },
);

// Delete a single transaction the customer owns.
usersRouter.delete(
  "/users/transactions/:transactionId",
  requireAuth,
  async (req, res) => {
    const [txn] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.id, String(req.params.transactionId)),
          eq(accounts.customerId, req.customerId!),
        ),
      )
      .limit(1);
    if (!txn) return res.status(404).json({ message: "Transaction not found" });

    await db.delete(transactions).where(eq(transactions.id, txn.id));
    return res.json({ ok: true });
  },
);

// Clear an account's entire transaction history.
usersRouter.delete(
  "/users/accounts/:accountId/transactions",
  requireAuth,
  async (req, res) => {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, String(req.params.accountId)),
          eq(accounts.customerId, req.customerId!),
        ),
      )
      .limit(1);
    if (!account) return res.status(404).json({ message: "Account not found" });

    await db.delete(transactions).where(eq(transactions.accountId, account.id));
    return res.json({ ok: true });
  },
);

usersRouter.get("/users/me", requireAuth, async (req, res) => {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, req.customerId!))
    .limit(1);

  if (!customer || customer.deletedAt) {
    return res.status(404).json({ message: "User not found" });
  }

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.customerId, customer.id));

  return res.json(
    serializeCurrentUser(
      customer,
      accountRows.map((row) => row.id),
    ),
  );
});

usersRouter.get("/users/payee", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  // Keyset pagination on (name, id) so the client's { name, id } cursor works.
  const cursorName = typeof req.query.name === "string" ? req.query.name : null;
  const cursorId = typeof req.query.id === "string" ? req.query.id : null;

  const ownership = eq(payees.customerId, req.customerId!);
  const afterCursor =
    cursorName && cursorId
      ? or(
          gt(payees.name, cursorName),
          and(eq(payees.name, cursorName), gt(payees.id, cursorId)),
        )
      : undefined;

  const rows = await db
    .select()
    .from(payees)
    .where(afterCursor ? and(ownership, afterCursor) : ownership)
    .orderBy(asc(payees.name), asc(payees.id))
    .limit(limit + 1);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payees)
    .where(ownership);

  const hasNext = rows.length > limit;
  const page = hasNext ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return res.json({
    payees: page.map(serializePayee),
    totalCount: count,
    nextCursor: hasNext && last ? { name: last.name, id: last.id } : null,
  });
});

usersRouter.patch("/users/payee", requireAuth, async (req, res) => {
  const { name, accountNumber, sortCode, business } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "A payee name is required" });
  }
  if (!/^[0-9]{8}$/.test(String(accountNumber))) {
    return res.status(400).json({ message: "Account number must be 8 digits" });
  }
  // Accept the raw 6-digit form the client sends (hyphens already stripped).
  const rawSort = String(sortCode).replace(/-/g, "");
  if (!/^[0-9]{6}$/.test(rawSort)) {
    return res.status(400).json({ message: "Sort code must be 6 digits" });
  }

  const [created] = await db
    .insert(payees)
    .values({
      customerId: req.customerId!,
      name: name.trim(),
      accountNumber: String(accountNumber),
      sortCode: rawSort,
      business: Boolean(business),
    })
    .returning();

  return res.json(serializePayee(created));
});

usersRouter.delete("/users/payee/:id", requireAuth, async (req, res) => {
  await db
    .delete(payees)
    .where(
      and(eq(payees.id, String(req.params.id)), eq(payees.customerId, req.customerId!)),
    );
  return res.json({ ok: true });
});
