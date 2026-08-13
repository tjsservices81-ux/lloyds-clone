/**
 * Builds the month "timeline" the account screen renders as tabs, derived from
 * an account's transaction history (most recent month first). Always returns at
 * least the current month so the screen has something to show for a new account.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { transactions } from "../shared/schema";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const monthLabel = (date: Date): string =>
  `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export async function timelineForAccount(accountId: string): Promise<string[]> {
  const rows = await db
    .select({ createdAt: transactions.createdAt })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .orderBy(desc(transactions.createdAt));

  const seen: string[] = [];
  for (const row of rows) {
    const label = monthLabel(row.createdAt);
    if (!seen.includes(label)) seen.push(label);
  }

  if (seen.length === 0) seen.push(monthLabel(new Date()));
  return seen;
}
