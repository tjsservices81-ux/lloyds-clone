import { GetAccountTransactions } from "@/api/transaction/list";
import { TransactionQueryKey } from "@/libs/query-keys";
import { Transaction } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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

// Matches the server's timeline labels ("Month YYYY", in UTC).
const monthLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/**
 * Loads an account's real transactions and groups them by month label so the
 * account screen's month tabs can each render their own list.
 */
export function useAccountTransactionsQuery(accountId: string) {
  const query = useQuery({
    queryKey: TransactionQueryKey.transactions(accountId),
    queryFn: () => GetAccountTransactions(accountId),
    enabled: !!accountId,
  });

  const byMonth = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const txn of query.data ?? []) {
      const label = monthLabel(txn.date);
      (map[label] ??= []).push(txn);
    }
    return map;
  }, [query.data]);

  return { ...query, byMonth };
}
