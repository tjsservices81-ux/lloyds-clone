/**
 * Login / session endpoints, matching the Lloyds client's auth flow:
 *   POST   /api/session          { userId, password } -> { accessToken, refreshToken }
 *   GET    /api/session/refresh   header x-refresh      -> { accessToken }
 *   DELETE /api/session/logout    header x-refresh      -> 200
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { customers } from "../../shared/schema";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateFromRefreshToken,
  signAccessToken,
  verifySecret,
} from "../auth";

export const sessionRouter = Router();

sessionRouter.post("/session", async (req, res) => {
  const { userId, password } = req.body ?? {};
  if (typeof userId !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "userId and password are required" });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1);

  // Same generic message whether the user is missing, deleted, or the password
  // is wrong, so the endpoint doesn't reveal which user IDs exist.
  if (!customer || customer.deletedAt) {
    return res.status(401).json({ message: "Invalid User ID or password" });
  }

  const ok = await verifySecret(password, customer.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid User ID or password" });
  }

  const accessToken = signAccessToken({
    sub: customer.id,
    userId: customer.userId,
  });
  const refreshToken = await issueRefreshToken(customer.id);
  return res.json({ accessToken, refreshToken });
});

sessionRouter.get("/session/refresh", async (req, res) => {
  const token = req.header("x-refresh");
  if (!token) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  const rotated = await rotateFromRefreshToken(token);
  if (!rotated) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, rotated.customerId))
    .limit(1);
  if (!customer || customer.deletedAt) {
    return res.status(401).json({ message: "Account no longer active" });
  }

  const accessToken = signAccessToken({
    sub: customer.id,
    userId: customer.userId,
  });
  return res.json({ accessToken });
});

sessionRouter.delete("/session/logout", async (req, res) => {
  const token = req.header("x-refresh");
  if (token) {
    await revokeRefreshToken(token);
  }
  return res.json({ ok: true });
});
