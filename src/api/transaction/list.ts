import privateClient from "../privateClient";
import { Transaction } from "@/types";

/**
 * Fetches an account's transactions already in the display shape the account
 * screen renders (amount, running balance, deposit/withdrawal, payee). New
 * transfers appear here because the server records every payment.
 */
export async function GetAccountTransactions(
  accountId: string,
): Promise<Transaction[]> {
  const response = await privateClient().get(`transactions/${accountId}`);
  return response.data as Transaction[];
}
