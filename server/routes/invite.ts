/**
 * One-time invite links, mirroring BOI: an admin creates a link for a customer;
 * opening it once "claims" the account onto a device and returns tokens the
 * client can log in with.
 *
 *   GET  /api/invite/status/:token  -> { valid, claimed }
 *   POST /api/invite/claim          { token, deviceId? } -> { accessToken, refreshToken }
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { customers, invites } from "../../shared/schema";
import { issueRefreshToken, signAccessToken } from "../auth";

export const inviteRouter = Router();

inviteRouter.get("/invite/status/:token", async (req, res) => {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, String(req.params.token)))
    .limit(1);

  if (!invite) return res.json({ valid: false, claimed: false });
  return res.json({ valid: true, claimed: Boolean(invite.claimedAt) });
});

inviteRouter.post("/invite/claim", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const deviceId =
    typeof req.body?.deviceId === "string" ? req.body.deviceId : null;
  if (!token) return res.status(400).json({ message: "A token is required" });

  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite) return res.status(404).json({ message: "Unknown invite" });
  if (invite.claimedAt) {
    return res.status(409).json({ message: "This link has already been used" });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, invite.customerId))
    .limit(1);
  if (!customer || customer.deletedAt) {
    return res.status(404).json({ message: "Account no longer active" });
  }

  await db
    .update(invites)
    .set({ claimedAt: new Date(), claimedByDevice: deviceId })
    .where(eq(invites.id, invite.id));

  const accessToken = signAccessToken({
    sub: customer.id,
    userId: customer.userId,
  });
  const refreshToken = await issueRefreshToken(customer.id);
  return res.json({ accessToken, refreshToken });
});
