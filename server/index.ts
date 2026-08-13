/**
 * Application entrypoint. One Express process serves BOTH the built Lloyds web
 * app and the JSON API on a single port — the same single-service model BOI
 * uses — so there is nothing else to host.
 *
 * On startup it connects to Postgres, seeds simulated data if the database is
 * empty, then starts listening.
 */
import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "./env";
import { seedIfEmpty } from "./seed";
import { sessionRouter } from "./routes/session";
import { usersRouter } from "./routes/users";
import { accountsRouter } from "./routes/accounts";
import { transactionsRouter } from "./routes/transactions";
import { chatRouter } from "./routes/chat";
import { accessRouter } from "./routes/access";
import { adminRouter } from "./routes/admin";
import { inviteRouter } from "./routes/invite";
import { webauthnRouter } from "./routes/webauthn";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Health check for the host's readiness probe.
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// JSON API. All banking routes live under /api.
app.use("/api", sessionRouter);
app.use("/api", usersRouter);
app.use("/api", accountsRouter);
app.use("/api", transactionsRouter);
app.use("/api", chatRouter);
app.use("/api", accessRouter);
app.use("/api", inviteRouter);
app.use("/api", webauthnRouter);

// Server-rendered staff pages (their own PIN gate, outside the SPA).
app.use("/", adminRouter);

// Serve the built web client and fall back to its SPA shell for deep links.
const clientDir = resolve(process.cwd(), "dist");
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(resolve(clientDir, "index.html"));
  });
} else {
  console.warn(
    "[server] no built client at ./dist — run `pnpm build:web` first " +
      "(the API still works on its own).",
  );
}

// JSON error handler so thrown errors don't leak stack traces to clients.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    console.error("[server] unhandled error:", err);
    res.status(500).json({ message: "Something went wrong" });
  },
);

async function start() {
  await seedIfEmpty();
  app.listen(env.port, () => {
    console.log(
      `[server] listening on http://localhost:${env.port} ` +
        `(${env.isProduction ? "production" : "development"})`,
    );
  });
}

start().catch((error) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});
