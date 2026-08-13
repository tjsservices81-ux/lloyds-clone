import privateClient from "../privateClient";

/** Update the customer's display name and/or email. Login is unaffected. */
export async function updateProfile(input: { name?: string; email?: string }) {
  const response = await privateClient().patch("users/profile", input);
  return response.data;
}

/** Change the password without being logged out. */
export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}) {
  const response = await privateClient().post("users/change-password", input);
  return response.data as { ok: boolean };
}

/** Generate random transaction history for an account between two dates. */
export async function generateTransactions(input: {
  accountId: string;
  from: string; // ISO date
  to: string; // ISO date
  count?: number;
}) {
  const { accountId, ...body } = input;
  const response = await privateClient().post(
    `users/accounts/${accountId}/generate-transactions`,
    body,
  );
  return response.data as { ok: boolean; created: number };
}

/** Set an account's balance directly. */
export async function setAccountBalance(input: {
  accountId: string;
  balance: number;
}) {
  const response = await privateClient().patch(
    `users/accounts/${input.accountId}/balance`,
    { balance: input.balance },
  );
  return response.data as { ok: boolean; balance: number };
}

/** Delete a single transaction. */
export async function deleteTransaction(transactionId: string) {
  const response = await privateClient().delete(
    `users/transactions/${transactionId}`,
  );
  return response.data as { ok: boolean };
}

/** Clear all transactions for an account. */
export async function clearTransactions(accountId: string) {
  const response = await privateClient().delete(
    `users/accounts/${accountId}/transactions`,
  );
  return response.data as { ok: boolean };
}
