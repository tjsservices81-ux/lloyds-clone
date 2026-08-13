/**
 * Access gate, mirroring BOI's `/?access=CODE` unlock. The Lloyds SPA doesn't
 * currently render a gate screen, so this is an opt-in backend the client can
 * call; the code is configurable via APP_ACCESS_CODE.
 *
 *   POST /api/check-access  { code } -> { ok }
 *   POST /api/verify-code   { code } -> { ok }
 */
import { Router } from "express";
import { env } from "../env";

export const accessRouter = Router();

function checkCode(req: { body?: { code?: unknown } }): boolean {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  return code.length > 0 && code === env.appAccessCode;
}

accessRouter.post("/check-access", (req, res) => {
  res.json({ ok: checkCode(req) });
});

accessRouter.post("/verify-code", (req, res) => {
  const ok = checkCode(req);
  res.status(ok ? 200 : 401).json({ ok });
});
