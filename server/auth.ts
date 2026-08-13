/**
 * Authentication helpers.
 *
 * The Lloyds client already speaks a JWT dialect: `POST /api/session` returns
 * `{ accessToken, refreshToken }`, requests carry `Authorization: Bearer <access>`,
 * and on a 401 the client calls `GET /api/session/refresh` with an `x-refresh`
 * header. So this backend issues a short-lived signed access token plus a
 * long-lived opaque refresh token that lives in the database (allowing logout
 * to actually revoke it — stateless JWTs cannot be revoked on their own).
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db";
import { refreshTokens } from "../shared/schema";
import { env } from "./env";

export type AccessClaims = { sub: string; userId: string };

export function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(claims: AccessClaims): string {
  const options: jwt.SignOptions = {
    expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(claims, env.jwtSecret, options);
}

export async function issueRefreshToken(customerId: string): Promise<string> {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlMs);
  await db.insert(refreshTokens).values({ customerId, token, expiresAt });
  return token;
}

export async function rotateFromRefreshToken(
  token: string,
): Promise<{ customerId: string } | null> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(eq(refreshTokens.token, token), gt(refreshTokens.expiresAt, new Date())),
    )
    .limit(1);
  return row ? { customerId: row.customerId } : null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}

// Augment Express's Request so route handlers can read the authenticated id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customerId?: string;
      userId?: string;
    }
  }
}

/** Rejects the request with 401 unless a valid access token is present. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ message: "Missing access token" });
    return;
  }
  try {
    const claims = jwt.verify(token, env.jwtSecret) as AccessClaims;
    req.customerId = claims.sub;
    req.userId = claims.userId;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
}
