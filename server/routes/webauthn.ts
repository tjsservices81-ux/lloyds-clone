/**
 * Face ID / passkey sign-in via WebAuthn.
 *
 * Registration (authenticated — from the customer panel):
 *   POST /api/webauthn/register/options  -> PublicKeyCredentialCreationOptions
 *   POST /api/webauthn/register/verify   -> { ok }
 *
 * Authentication (public — the "Face ID" sign-in key on the login screen):
 *   POST /api/webauthn/auth/options  { deviceId } -> options (or { available:false })
 *   POST /api/webauthn/auth/verify   { deviceId, response } -> { accessToken, refreshToken }
 *
 * Credentials are tied to the device that registered them, so Face ID sign-in is
 * inherently limited to the phone the account is bound to.
 */
import { Router, type Request } from "express";
import { and, eq, gt } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "../db";
import {
  customers,
  webauthnChallenges,
  webauthnCredentials,
} from "../../shared/schema";
import { issueRefreshToken, requireAuth, signAccessToken } from "../auth";

export const webauthnRouter = Router();

const RP_NAME = "Lloyds Clone";

// Derive the Relying Party id (the domain) and expected origin from the request.
function rp(req: Request): { rpID: string; origin: string } {
  const forwardedProto = req.header("x-forwarded-proto");
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost";
  const hostname = host.split(":")[0];
  const proto = forwardedProto || req.protocol || "http";
  return { rpID: hostname, origin: `${proto}://${host}` };
}

async function saveChallenge(
  deviceId: string,
  challenge: string,
  kind: "registration" | "authentication",
  customerId: string | null,
) {
  await db
    .delete(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.deviceId, deviceId),
        eq(webauthnChallenges.kind, kind),
      ),
    );
  await db.insert(webauthnChallenges).values({
    deviceId,
    challenge,
    kind,
    customerId,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
}

async function takeChallenge(
  deviceId: string,
  kind: "registration" | "authentication",
) {
  const [row] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.deviceId, deviceId),
        eq(webauthnChallenges.kind, kind),
        gt(webauthnChallenges.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (row) {
    await db
      .delete(webauthnChallenges)
      .where(eq(webauthnChallenges.id, row.id));
  }
  return row ?? null;
}

// ---- Registration (authenticated) ----

webauthnRouter.post("/webauthn/register/options", requireAuth, async (req, res) => {
  const deviceId =
    req.header("x-device-id") ||
    (typeof req.body?.deviceId === "string" ? req.body.deviceId : "");
  if (!deviceId) return res.status(400).json({ message: "Missing device id" });

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, req.customerId!))
    .limit(1);
  if (!customer) return res.status(404).json({ message: "User not found" });

  const existing = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.customerId, customer.id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp(req).rpID,
    userID: new TextEncoder().encode(customer.id),
    userName: customer.userId,
    userDisplayName: `${customer.firstName} ${customer.lastName}`,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await saveChallenge(deviceId, options.challenge, "registration", customer.id);
  return res.json(options);
});

webauthnRouter.post("/webauthn/register/verify", requireAuth, async (req, res) => {
  const deviceId =
    req.header("x-device-id") ||
    (typeof req.body?.deviceId === "string" ? req.body.deviceId : "");
  const response = req.body?.response;
  if (!deviceId || !response) {
    return res.status(400).json({ message: "Missing device id or response" });
  }

  const challenge = await takeChallenge(deviceId, "registration");
  if (!challenge) return res.status(400).json({ message: "Challenge expired" });

  const { rpID, origin } = rp(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ message: "Could not verify Face ID" });
  }

  const { credential } = verification.registrationInfo;
  await db.insert(webauthnCredentials).values({
    customerId: req.customerId!,
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports?.join(",") ?? null,
    deviceId,
  });

  return res.json({ ok: true });
});

// ---- Authentication (public) ----

webauthnRouter.post("/webauthn/auth/options", async (req, res) => {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : "";
  if (!deviceId) return res.json({ available: false });

  // Find the account bound to this device and its registered credentials.
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.boundDeviceId, deviceId))
    .limit(1);
  if (!customer) return res.json({ available: false });

  const creds = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.customerId, customer.id));
  if (creds.length === 0) return res.json({ available: false });

  const options = await generateAuthenticationOptions({
    rpID: rp(req).rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (c.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
    userVerification: "preferred",
  });

  await saveChallenge(deviceId, options.challenge, "authentication", customer.id);
  return res.json({ available: true, options });
});

webauthnRouter.post("/webauthn/auth/verify", async (req, res) => {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : "";
  const response = req.body?.response;
  if (!deviceId || !response) {
    return res.status(400).json({ message: "Missing device id or response" });
  }

  const challenge = await takeChallenge(deviceId, "authentication");
  if (!challenge) return res.status(400).json({ message: "Challenge expired" });

  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, response.id))
    .limit(1);
  if (!cred) return res.status(400).json({ message: "Unknown credential" });

  const { rpID, origin } = rp(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter,
      },
    });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }

  if (!verification.verified) {
    return res.status(401).json({ message: "Face ID not recognised" });
  }

  await db
    .update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, cred.id));

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, cred.customerId))
    .limit(1);
  if (!customer || customer.deletedAt) {
    return res.status(401).json({ message: "Account no longer active" });
  }

  const accessToken = signAccessToken({
    sub: customer.id,
    userId: customer.userId,
  });
  const refreshToken = await issueRefreshToken(customer.id);
  return res.json({ accessToken, refreshToken, userId: customer.userId });
});

// Imported type alias kept local to avoid a top-level import just for typing.
type AuthenticatorTransportFuture =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";
