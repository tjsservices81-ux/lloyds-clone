/**
 * Database schema — the single source of truth for the Postgres tables, shared
 * by the server (Drizzle queries) and available to any typed consumer.
 *
 * Modelled on the Bank of Ireland clone's `shared/schema.ts`: one file defines
 * every table, and `npm run db:push` (drizzle-kit) makes the database match it.
 *
 * All banking data here is simulated — no real accounts, no real money.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** People who can log in. One customer owns many accounts and payees. */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The login handle typed on the Lloyds "User ID" screen.
  userId: text("user_id").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Optional numeric PIN for the quick-unlock screen.
  pinHash: text("pin_hash"),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: timestamp("dob", { withTimezone: true }).notNull(),
  // Soft-delete so the admin tools can "move"/restore a customer like BOI.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  accountType: text("account_type").notNull().default("current"),
  accountName: text("account_name").notNull(),
  nameOnAccount: text("name_on_account").notNull(),
  accountNumber: text("account_number").notNull(),
  // Stored as raw 6 digits; the client formats it as XX-XX-XX.
  sortCode: text("sort_code").notNull(),
  iban: text("iban").notNull().default(""),
  bic: text("bic").notNull().default(""),
  balance: numeric("balance", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  overdraftLimit: numeric("overdraft_limit", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // One of the TransactionType labels the client understands,
    // e.g. "Bank Transfer", "Direct Debit", "Debit Card".
    type: text("type").notNull().default("Bank Transfer"),
    // Negative = money leaving the account, positive = money arriving.
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    payeeName: text("payee_name").notNull(),
    sortCode: text("sort_code"),
    accountNumber: text("account_number"),
    businessType: text("business_type"),
    retailerLocation: text("retailer_location"),
    payeeDetails: text("payee_details"),
    reference: text("reference"),
    cardEnding: text("card_ending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("transactions_account_created_idx").on(table.accountId, table.createdAt)],
);

export const payees = pgTable("payees", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  sortCode: text("sort_code").notNull(),
  business: boolean("business").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scheduledPayments = pgTable("scheduled_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  payeeName: text("payee_name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  // "standing_order" | "direct_debit"
  frequency: text("frequency").notNull().default("monthly"),
  nextDate: timestamp("next_date", { withTimezone: true }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const statements = pgTable("statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull(),
  closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Long-lived refresh tokens so logout can revoke a session (JWT is stateless). */
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** In-app support chat, backed by Claude when ANTHROPIC_API_KEY is set. */
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  // "user" | "assistant"
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One-time invite links that attach an account to a device on first open. */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedByDevice: text("claimed_by_device"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Key/value app settings (access code, feature flags) — the DB equivalent of
 * BOI's JSON runtime files, so nothing is lost on redeploy. */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  accounts: many(accounts),
  payees: many(payees),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [accounts.customerId],
    references: [customers.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));

export type Customer = typeof customers.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Payee = typeof payees.$inferSelect;
