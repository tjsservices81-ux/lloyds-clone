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
import { accounts, customers, payees } from "../../shared/schema";
import { requireAuth } from "../auth";
import { serializeCurrentUser, serializePayee } from "../serializers";

export const usersRouter = Router();

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
