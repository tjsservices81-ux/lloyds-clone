import type { Config } from "drizzle-kit";

// Loaded lazily so `.env` is respected when running `npm run db:push`.
const databaseUrl =
  process.env.DATABASE_URL ?? process.env.DEV_DATABASE_URL ?? "";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
} satisfies Config;
