/**
 * Converts database rows into the exact JSON shapes the Lloyds client's zod
 * schemas parse. Getting these shapes right is what makes the existing UI work
 * unchanged:
 *   - sort codes are returned as raw 6 digits (the client formats them XX-XX-XX)
 *   - money is returned as a number, not a numeric string
 *   - payees expose `_id` (the client maps it to `id`)
 *   - transaction `type` is one of the TransactionType labels
 */
import type { Account, Customer, Payee, Transaction } from "../shared/schema";

const money = (value: string | number): number =>
  typeof value === "number" ? value : Number.parseFloat(value);

export function serializeAccount(account: Account) {
  return {
    id: account.id,
    user: account.customerId,
    accountType: account.accountType,
    accountName: account.accountName,
    nameOnAccount: account.nameOnAccount,
    accountNumber: account.accountNumber,
    sortCode: account.sortCode,
    iban: account.iban,
    bic: account.bic,
    balance: money(account.balance),
    overdraftLimit: money(account.overdraftLimit),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function serializeTransaction(txn: Transaction) {
  return {
    id: txn.id,
    accountId: txn.accountId,
    type: txn.type,
    amount: money(txn.amount),
    payeeName: txn.payeeName,
    sortCode: txn.sortCode ?? undefined,
    accountNumber: txn.accountNumber ?? undefined,
    businessType: txn.businessType ?? undefined,
    retailerLocation: txn.retailerLocation ?? undefined,
    payeeDetails: txn.payeeDetails ?? undefined,
    reference: txn.reference ?? undefined,
    cardEnding: txn.cardEnding ?? undefined,
  };
}

export function serializePayee(payee: Payee) {
  return {
    _id: payee.id,
    name: payee.name,
    accountNumber: payee.accountNumber,
    sortCode: payee.sortCode,
    business: payee.business,
  };
}

export function serializeCurrentUser(customer: Customer, accountIds: string[]) {
  return {
    id: customer.id,
    userId: customer.userId,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    dob: customer.dob.toISOString(),
    accounts: accountIds,
    fullName: `${customer.firstName} ${customer.lastName}`,
  };
}
