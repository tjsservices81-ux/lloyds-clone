/**
 * Seeds simulated data so the app is usable immediately after `db:push`.
 * Idempotent: it does nothing if the demo customer already exists.
 *
 * Demo login (matches the client's pre-filled login form):
 *   User ID:  docren155
 *   Password: password
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  accounts,
  customers,
  payees,
  transactions,
} from "../shared/schema";
import { hashSecret } from "./auth";

const DEMO_USER_ID = "docren155";

export async function seedIfEmpty(): Promise<void> {
  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, DEMO_USER_ID))
    .limit(1);
  if (existing) {
    console.log("[seed] demo customer already present, skipping");
    return;
  }

  console.log("[seed] creating demo customer and accounts");

  const passwordHash = await hashSecret("password");
  const pinHash = await hashSecret("1234");

  const [customer] = await db
    .insert(customers)
    .values({
      userId: DEMO_USER_ID,
      passwordHash,
      pinHash,
      email: "john.doe@example.com",
      firstName: "John",
      lastName: "Doe",
      dob: new Date(Date.UTC(1990, 3, 12)),
    })
    .returning();

  const [current, saver] = await db
    .insert(accounts)
    .values([
      {
        customerId: customer.id,
        accountType: "current",
        accountName: "Club Lloyds Current Account",
        nameOnAccount: "MR J DOE",
        accountNumber: "12345678",
        sortCode: "309634",
        iban: "GB33LOYD30963412345678",
        bic: "LOYDGB21085",
        balance: "2431.55",
        overdraftLimit: "500.00",
      },
      {
        customerId: customer.id,
        accountType: "current",
        accountName: "Easy Saver",
        nameOnAccount: "MR J DOE",
        accountNumber: "87654321",
        sortCode: "309634",
        iban: "GB33LOYD30963487654321",
        bic: "LOYDGB21085",
        balance: "10250.10",
        overdraftLimit: "0.00",
      },
    ])
    .returning();

  // A spread of transactions across the last few months so the timeline tabs
  // and the monthly summary have real data.
  const now = new Date();
  const monthsAgo = (n: number, day: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, day, 12));

  await db.insert(transactions).values([
    {
      accountId: current.id,
      type: "Debit Card",
      amount: "-42.50",
      payeeName: "Tesco Stores",
      businessType: "Groceries",
      retailerLocation: "London",
      createdAt: monthsAgo(0, 3),
    },
    {
      accountId: current.id,
      type: "Direct Debit",
      amount: "-88.00",
      payeeName: "British Gas",
      reference: "Energy",
      createdAt: monthsAgo(0, 6),
    },
    {
      accountId: current.id,
      type: "Bank Transfer",
      amount: "1500.00",
      payeeName: "Salary",
      reference: "ACME LTD",
      createdAt: monthsAgo(1, 28),
    },
    {
      accountId: current.id,
      type: "Contactless Payment",
      amount: "-3.75",
      payeeName: "Costa Coffee",
      createdAt: monthsAgo(1, 15),
    },
    {
      accountId: current.id,
      type: "Online Payment",
      amount: "-120.00",
      payeeName: "Amazon",
      createdAt: monthsAgo(2, 9),
    },
    {
      accountId: saver.id,
      type: "Bank Transfer",
      amount: "250.00",
      payeeName: "Monthly saving",
      createdAt: monthsAgo(0, 1),
    },
  ]);

  await db.insert(payees).values([
    {
      customerId: customer.id,
      name: "Alice Walker",
      accountNumber: "11112222",
      sortCode: "112233",
      business: false,
    },
    {
      customerId: customer.id,
      name: "British Gas",
      accountNumber: "33334444",
      sortCode: "445566",
      business: true,
    },
  ]);

  console.log("[seed] done");
}
