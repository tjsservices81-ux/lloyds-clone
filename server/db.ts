/**
 * Database connection. Like BOI, it inspects the connection string and picks
 * the right driver automatically:
 *   - Neon serverless hosts  -> @neondatabase/serverless (connects over WebSocket)
 *   - everything else (Render Postgres, a container, local Postgres) -> node-postgres
 * The caller never has to choose; any valid Postgres URL just works.
 */
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";
import { env } from "./env";
import * as schema from "../shared/schema";

const isNeon = /neon\.tech|neon\.database|\.neon\./i.test(env.databaseUrl);

function createDb() {
  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: env.databaseUrl });
    console.log("[db] using Neon serverless driver");
    return drizzleNeon(pool, { schema });
  }

  const pool = new PgPool({ connectionString: env.databaseUrl });
  console.log("[db] using node-postgres driver");
  return drizzleNode(pool, { schema });
}

export const db = createDb();
export { schema };
