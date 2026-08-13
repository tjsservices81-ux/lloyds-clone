/**
 * Account endpoints:
 *   GET /api/account       -> all accounts for the logged-in customer
 *   GET /api/account/:id   -> { account, timeline }
 */
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "../../shared/schema";
import { requireAuth } from "../auth";
import { serializeAccount } from "../serializers";
import { timelineForAccount } from "../timeline";

export const accountsRouter = Router();

accountsRouter.get("/account", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.customerId, req.customerId!));
  return res.json(rows.map(serializeAccount));
});

accountsRouter.get("/account/:accountId", requireAuth, async (req, res) => {
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

  if (!account) {
    return res.status(404).json({ message: "Account not found" });
  }

  const timeline = await timelineForAccount(account.id);
  return res.json({ account: serializeAccount(account), timeline });
});
