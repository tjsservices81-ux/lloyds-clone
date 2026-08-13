/**
 * Staff/admin tools, mirroring BOI's server-rendered oversight pages. Protected
 * by a PIN (ADMIN_PIN / TEAM_ADMIN_PIN), entirely separate from the customer
 * SPA. The HTML page keeps the PIN in sessionStorage and sends it as an
 * `x-admin-pin` header on each API call.
 *
 *   GET    /admin-oversight                     -> HTML dashboard (PIN prompt)
 *   GET    /api/admin/customers                  -> list customers
 *   POST   /api/admin/customers/create-with-link -> create customer + invite link
 *   POST   /api/admin/invite/create              -> new invite link for a customer
 *   DELETE /api/admin/customers/:id              -> soft-delete ("move") a customer
 *   POST   /api/admin/customers/:id/restore      -> restore a customer
 */
import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { accounts, customers, invites } from "../../shared/schema";
import { hashSecret } from "../auth";
import { env } from "../env";

export const adminRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.header("x-admin-pin") === env.adminPin) return next();
  res.status(401).json({ message: "Invalid admin PIN" });
}

function inviteUrl(req: Request, token: string): string {
  return `${req.protocol}://${req.get("host")}/invite/${token}`;
}

adminRouter.get("/api/admin/customers", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: customers.id,
      userId: customers.userId,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      deletedAt: customers.deletedAt,
      accountCount: sql<number>`count(${accounts.id})::int`,
    })
    .from(customers)
    .leftJoin(accounts, eq(accounts.customerId, customers.id))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt));
  res.json({ customers: rows });
});

adminRouter.post(
  "/api/admin/customers/create-with-link",
  requireAdmin,
  async (req, res) => {
    const { firstName, lastName, email, userId, password } = req.body ?? {};
    if (![firstName, lastName, email, userId, password].every((v) => typeof v === "string" && v)) {
      return res
        .status(400)
        .json({ message: "firstName, lastName, email, userId and password are required" });
    }

    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);
    if (existing) {
      return res.status(409).json({ message: "That User ID is already taken" });
    }

    const passwordHash = await hashSecret(password);
    const [customer] = await db
      .insert(customers)
      .values({
        userId,
        passwordHash,
        email,
        firstName,
        lastName,
        dob: new Date(Date.UTC(1990, 0, 1)),
      })
      .returning();

    // Give every new customer one starter current account.
    await db.insert(accounts).values({
      customerId: customer.id,
      accountType: "current",
      accountName: "Club Lloyds Current Account",
      nameOnAccount: `${firstName} ${lastName}`.toUpperCase(),
      accountNumber: String(10000000 + Math.floor(Math.random() * 89999999)),
      sortCode: "309634",
      balance: "0.00",
    });

    const token = randomBytes(24).toString("hex");
    await db.insert(invites).values({ token, customerId: customer.id });

    // Never return the password/pin hashes to the client.
    const { passwordHash: _pw, pinHash: _pin, ...safeCustomer } = customer;
    res.json({ customer: safeCustomer, inviteUrl: inviteUrl(req, token) });
  },
);

adminRouter.post("/api/admin/invite/create", requireAdmin, async (req, res) => {
  const customerId = typeof req.body?.customerId === "string" ? req.body.customerId : "";
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return res.status(404).json({ message: "Unknown customer" });

  const token = randomBytes(24).toString("hex");
  await db.insert(invites).values({ token, customerId });
  res.json({ inviteUrl: inviteUrl(req, token) });
});

adminRouter.delete("/api/admin/customers/:id", requireAdmin, async (req, res) => {
  await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(eq(customers.id, String(req.params.id)));
  res.json({ ok: true });
});

adminRouter.post(
  "/api/admin/customers/:id/restore",
  requireAdmin,
  async (req, res) => {
    await db
      .update(customers)
      .set({ deletedAt: null })
      .where(eq(customers.id, String(req.params.id)));
    res.json({ ok: true });
  },
);

adminRouter.get("/admin-oversight", (_req, res) => {
  res.type("html").send(DASHBOARD_HTML);
});

// Minimal, dependency-free dashboard. Kept as a single string so there is no
// separate view engine or build step.
const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lloyds Clone — Admin</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #0b2e13; color: #f2f2f2; }
  header { background: #12b77b; color: #04240f; padding: 16px 20px; font-weight: 700; font-size: 18px; }
  main { max-width: 900px; margin: 0 auto; padding: 20px; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #2f6b45; }
  input { background: #05230f; color: #f2f2f2; }
  button { background: #12b77b; color: #04240f; font-weight: 600; border: none; cursor: pointer; }
  .card { background: #05230f; border: 1px solid #1c5334; border-radius: 12px; padding: 16px; margin: 12px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #1c5334; font-size: 14px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .muted { color: #9fc7ac; font-size: 13px; }
  a { color: #6ee7a8; word-break: break-all; }
  .danger { background: #c0392b; color: #fff; }
</style>
</head>
<body>
<header>Lloyds Clone — Staff Oversight <span class="muted">(simulation)</span></header>
<main>
  <div id="gate" class="card">
    <div class="row">
      <input id="pin" type="password" placeholder="Admin PIN" autocomplete="off" />
      <button onclick="unlock()">Unlock</button>
    </div>
    <p class="muted" id="gateMsg"></p>
  </div>

  <div id="app" style="display:none">
    <div class="card">
      <strong>Create customer</strong>
      <div class="row" style="margin-top:8px">
        <input id="firstName" placeholder="First name" />
        <input id="lastName" placeholder="Last name" />
        <input id="email" placeholder="Email" />
        <input id="userId" placeholder="User ID" />
        <input id="password" placeholder="Password" />
        <button onclick="createCustomer()">Create + invite link</button>
      </div>
      <p id="created" class="muted"></p>
    </div>
    <div class="card">
      <strong>Customers</strong>
      <table id="table"><tbody></tbody></table>
    </div>
  </div>

<script>
  const pin = () => sessionStorage.getItem('adminPin') || '';
  const api = (path, opts = {}) => fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-admin-pin': pin(), ...(opts.headers||{}) },
  });
  async function unlock() {
    sessionStorage.setItem('adminPin', document.getElementById('pin').value);
    const r = await api('/api/admin/customers');
    if (r.ok) { document.getElementById('gate').style.display='none'; document.getElementById('app').style.display='block'; load(); }
    else { document.getElementById('gateMsg').textContent = 'Wrong PIN.'; }
  }
  async function load() {
    const { customers } = await (await api('/api/admin/customers')).json();
    const body = document.querySelector('#table tbody');
    body.innerHTML = '';
    for (const c of customers) {
      const tr = document.createElement('tr');
      tr.innerHTML = \`<td>\${c.firstName} \${c.lastName}<div class="muted">\${c.userId} · \${c.email}</div></td>
        <td>\${c.accountCount} acct(s)</td>
        <td>\${c.deletedAt ? 'moved' : 'active'}</td>
        <td class="row"><button onclick="invite('\${c.id}')">Invite link</button>
        \${c.deletedAt ? \`<button onclick="restore('\${c.id}')">Restore</button>\` : \`<button class="danger" onclick="del('\${c.id}')">Move</button>\`}</td>\`;
      body.appendChild(tr);
    }
  }
  async function createCustomer() {
    const payload = ['firstName','lastName','email','userId','password'].reduce((a,k)=>(a[k]=document.getElementById(k).value,a),{});
    const r = await api('/api/admin/customers/create-with-link', { method:'POST', body: JSON.stringify(payload) });
    const data = await r.json();
    document.getElementById('created').innerHTML = r.ok ? 'Invite link: <a href="'+data.inviteUrl+'">'+data.inviteUrl+'</a>' : (data.message||'Error');
    if (r.ok) load();
  }
  async function invite(id) {
    const { inviteUrl } = await (await api('/api/admin/invite/create', { method:'POST', body: JSON.stringify({ customerId:id }) })).json();
    prompt('One-time invite link:', inviteUrl);
  }
  async function del(id) { await api('/api/admin/customers/'+id, { method:'DELETE' }); load(); }
  async function restore(id) { await api('/api/admin/customers/'+id+'/restore', { method:'POST' }); load(); }
</script>
</main>
</body>
</html>`;
