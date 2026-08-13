/**
 * Environment configuration. Loads a local `.env` in development and validates
 * the one variable the app cannot run without (DATABASE_URL), mirroring BOI's
 * "refuse to start without a database" behaviour.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env loader so there's no extra dependency. Only runs when a file
// exists; hosts like Render inject real environment variables directly.
function loadDotEnv() {
  for (const file of [".env", ".env.local"]) {
    try {
      const contents = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of contents.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // No such file — fine, real env vars are used instead.
    }
  }
}

loadDotEnv();

const isProduction = process.env.NODE_ENV === "production";

const databaseUrl =
  process.env.DATABASE_URL ??
  (!isProduction ? process.env.DEV_DATABASE_URL : undefined);

if (!databaseUrl) {
  console.error(
    "\n[fatal] DATABASE_URL is not set. The app needs a PostgreSQL connection " +
      "string to start.\n" +
      "        Example: postgres://user:pass@host:5432/dbname\n",
  );
  process.exit(1);
}

export const env = {
  isProduction,
  databaseUrl,
  port: Number(process.env.PORT ?? 5000),
  // Secret used to sign short-lived access tokens. A random dev fallback keeps
  // local runs working; production must set its own so tokens survive restarts.
  jwtSecret:
    process.env.JWT_SECRET ??
    process.env.SESSION_SECRET ??
    (isProduction ? "" : "dev-insecure-secret-change-me"),
  accessTokenTtl: "15m",
  refreshTokenTtlMs: 1000 * 60 * 60 * 24 * 30, // 30 days
  // Code that unlocks the app via /?access=… , same idea as BOI.
  appAccessCode: process.env.APP_ACCESS_CODE ?? "LLOYDS777777",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  adminPin: process.env.ADMIN_PIN ?? process.env.TEAM_ADMIN_PIN ?? "246810",
  dataDir: process.env.DATA_DIR ?? "./data",
};

if (isProduction && !env.jwtSecret) {
  console.error(
    "\n[fatal] JWT_SECRET (or SESSION_SECRET) must be set in production.\n",
  );
  process.exit(1);
}
