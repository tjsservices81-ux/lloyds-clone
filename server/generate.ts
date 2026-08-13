/**
 * Generators for auto-created customer credentials and for random transaction
 * history. All of it is simulated data.
 */
import { randomBytes, randomInt } from "node:crypto";

/** A random all-numeric User ID, e.g. "4821607395". */
export function generateUserId(digits = 10): string {
  let id = String(randomInt(1, 10)); // first digit non-zero
  for (let i = 1; i < digits; i++) id += String(randomInt(0, 10));
  return id;
}

/** A readable random password (no ambiguous characters). */
export function generatePassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** A generated email derived from the User ID. */
export function generateEmail(userId: string): string {
  return `customer${userId}@lloydsdemo.app`;
}

/** An 8-digit account number. */
export function generateAccountNumber(): string {
  let n = String(randomInt(1, 10));
  for (let i = 1; i < 8; i++) n += String(randomInt(0, 10));
  return n;
}

const PAYEES: { name: string; type: string; incoming?: boolean }[] = [
  { name: "Tesco Stores", type: "Debit Card" },
  { name: "Amazon", type: "Online Payment" },
  { name: "Costa Coffee", type: "Contactless Payment" },
  { name: "British Gas", type: "Direct Debit" },
  { name: "Netflix", type: "Direct Debit" },
  { name: "Sainsbury's", type: "Debit Card" },
  { name: "Shell", type: "Debit Card" },
  { name: "Spotify", type: "Direct Debit" },
  { name: "TfL Travel", type: "Contactless Payment" },
  { name: "Salary", type: "Bank Transfer", incoming: true },
  { name: "HMRC Refund", type: "Bank Transfer", incoming: true },
  { name: "Interest", type: "Bank Transfer", incoming: true },
];

export type GeneratedTxn = {
  type: string;
  amount: string;
  payeeName: string;
  reference?: string;
  createdAt: Date;
};

/**
 * Builds `count` random transactions with dates spread between `from` and `to`,
 * ordered oldest-first. Amounts are negative for spending, positive for income.
 */
export function generateTransactions(
  from: Date,
  to: Date,
  count: number,
): GeneratedTxn[] {
  const start = from.getTime();
  const end = to.getTime();
  const span = Math.max(end - start, 1);

  const txns: GeneratedTxn[] = [];
  for (let i = 0; i < count; i++) {
    const payee = PAYEES[randomInt(0, PAYEES.length)];
    const magnitude = payee.incoming
      ? randomInt(50, 2500) + randomInt(0, 100) / 100
      : randomInt(2, 180) + randomInt(0, 100) / 100;
    const amount = (payee.incoming ? magnitude : -magnitude).toFixed(2);
    txns.push({
      type: payee.type,
      amount,
      payeeName: payee.name,
      reference: payee.incoming ? "Credit" : undefined,
      createdAt: new Date(start + randomInt(0, span)),
    });
  }

  return txns.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
