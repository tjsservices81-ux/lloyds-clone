import {
  changePassword,
  clearTransactions,
  deleteTransaction,
  generateTransactions,
  setAccountBalance,
  updateProfile,
} from "@/api/users/account";
import { Button } from "@/components/ui";
import { FaceIdSection } from "@/components/customer-panel/FaceIdSection";
import { useAccountTransactionsQuery } from "@/hooks/query/useAccountTransactionsQuery";
import {
  AccountQueryKey,
  TransactionQueryKey,
  UserQueryKey,
} from "@/libs/query-keys";
import { cn, formatCurrency } from "@/libs/utils";
import { GetAllAccountSchema } from "@/schema";
import { useAccountsQuery, useUserQuery } from "@/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad";
}) => (
  <View className="gap-y-1">
    <Text className="text-sm text-gray-600">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize="none"
      className="rounded-lg border border-gray-400 px-3 py-3"
    />
  </View>
);

const Card = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View className="gap-y-3 rounded-xl bg-white p-4">
    <Text className="font-semibold">{title}</Text>
    {children}
  </View>
);

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthsAgoISO = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

export default function CustomerPanel() {
  const queryClient = useQueryClient();
  const { data: user } = useUserQuery();
  const { accountsQuery } = useAccountsQuery({ accounts: { enabled: true } });
  const accounts = (accountsQuery.data ?? []) as GetAllAccountSchema;

  const [status, setStatus] = useState<string | null>(null);

  // Shared account selection used by balance / history / generate tools.
  const [accountId, setAccountId] = useState<string>("");
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId],
  );

  const invalidateAccount = () => {
    queryClient.invalidateQueries({
      queryKey: TransactionQueryKey.transactions(accountId),
    });
    queryClient.invalidateQueries({
      queryKey: AccountQueryKey.userAccount(accountId),
    });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  // ---- Profile ----
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ name, email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UserQueryKey.currentUser });
      setStatus("Profile updated");
    },
    onError: () => setStatus("Could not update profile"),
  });

  // ---- Password ----
  const [newPassword, setNewPassword] = useState("");
  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ newPassword }),
    onSuccess: () => {
      setNewPassword("");
      setStatus("Password changed — you're still signed in");
    },
    onError: () => setStatus("Could not change password (min 6 characters)"),
  });

  // ---- Balance ----
  const [balanceInput, setBalanceInput] = useState("");
  useEffect(() => {
    if (selectedAccount) setBalanceInput(String(selectedAccount.balance));
  }, [selectedAccount]);

  const balanceMutation = useMutation({
    mutationFn: () =>
      setAccountBalance({ accountId, balance: Number(balanceInput) }),
    onSuccess: (res) => {
      invalidateAccount();
      setStatus(`Balance set to ${formatCurrency(res.balance)}`);
    },
    onError: () => setStatus("Could not set balance"),
  });

  // ---- Transactions (list + delete) ----
  const { data: txns } = useAccountTransactionsQuery(accountId);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      invalidateAccount();
      setStatus("Transaction deleted");
    },
    onError: () => setStatus("Could not delete transaction"),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearTransactions(accountId),
    onSuccess: () => {
      invalidateAccount();
      setStatus("All transactions cleared");
    },
    onError: () => setStatus("Could not clear transactions"),
  });

  // ---- Generate ----
  const [from, setFrom] = useState(monthsAgoISO(3));
  const [to, setTo] = useState(todayISO());
  const [count, setCount] = useState("15");
  const generateMutation = useMutation({
    mutationFn: () =>
      generateTransactions({
        accountId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        count: Number(count) || 15,
      }),
    onSuccess: (res) => {
      invalidateAccount();
      setStatus(`Generated ${res.created} transactions`);
    },
    onError: () => setStatus("Could not generate transactions"),
  });

  return (
    <ScrollView
      className="flex-1 bg-gray-100"
      contentContainerClassName="gap-y-4 p-4 pb-16"
    >
      <Stack.Screen options={{ title: "Manage account" }} />

      {status && (
        <View className="rounded-lg bg-green-100 px-3 py-2">
          <Text className="text-sm text-green-900">{status}</Text>
        </View>
      )}

      <Card title="Your details">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
        <Button
          label="Save details"
          onPress={() => profileMutation.mutate()}
          disabled={profileMutation.isPending}
        />
      </Card>

      <Card title="Change password">
        <Field
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secure
          placeholder="At least 6 characters"
        />
        <Text className="text-xs text-gray-500">
          Changing your password keeps you signed in on this device.
        </Text>
        <Button
          label="Change password"
          onPress={() => passwordMutation.mutate()}
          disabled={passwordMutation.isPending || newPassword.length < 6}
        />
      </Card>

      <FaceIdSection savedUserId={user?.userId ?? null} onStatus={setStatus} />

      {/* Account picker shared by the tools below */}
      <Card title="Account">
        <View className="flex-row flex-wrap gap-2">
          {accounts.map((a) => (
            <Text
              key={a.id}
              onPress={() => setAccountId(a.id)}
              className={cn(
                "rounded-full border border-gray-400 px-3 py-2 text-sm",
                a.id === accountId && "border-black bg-black text-white",
              )}
            >
              {a.accountName}
            </Text>
          ))}
        </View>
        {selectedAccount && (
          <Text className="text-sm text-gray-600">
            Current balance: {formatCurrency(selectedAccount.balance)}
          </Text>
        )}
      </Card>

      <Card title="Set balance">
        <Field
          label="New balance (£)"
          value={balanceInput}
          onChangeText={setBalanceInput}
          keyboardType="decimal-pad"
        />
        <Button
          label="Set balance"
          onPress={() => balanceMutation.mutate()}
          disabled={balanceMutation.isPending || !accountId}
        />
      </Card>

      <Card title="Transactions">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-gray-500">
            {txns?.length ?? 0} transaction(s)
          </Text>
          <Pressable
            onPress={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !(txns?.length)}
            className="rounded-lg bg-red-600 px-3 py-2 active:opacity-80 disabled:opacity-40"
          >
            <Text className="text-sm font-semibold text-white">Clear all</Text>
          </Pressable>
        </View>
        <View className="gap-y-2">
          {(txns ?? []).slice(0, 40).map((t) => (
            <View
              key={t.id}
              className="flex-row items-center gap-x-2 border-b-hairline border-gray-200 py-2"
            >
              <View className="flex-1">
                <Text className="text-sm font-medium">{t.payee.name}</Text>
                <Text className="text-xs text-gray-400">
                  {new Date(t.date).toDateString()}
                </Text>
              </View>
              <Text
                className={cn(
                  "text-sm",
                  t.type === "deposit" && "text-green-700",
                )}
              >
                {t.type === "deposit" ? "+ " : "- "}
                {formatCurrency(Math.abs(t.amount))}
              </Text>
              <Pressable
                onPress={() => deleteMutation.mutate(t.id)}
                className="rounded-full bg-red-100 p-2 active:opacity-70"
              >
                <Feather name="trash-2" size={16} color="#b91c1c" />
              </Pressable>
            </View>
          ))}
          {(txns?.length ?? 0) === 0 && (
            <Text className="py-4 text-center text-sm text-gray-400">
              No transactions
            </Text>
          )}
        </View>
      </Card>

      <Card title="Generate transaction history">
        <Text className="text-xs text-gray-500">
          Create random transactions between two dates for the selected account.
        </Text>
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <Field label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
          </View>
          <View className="flex-1">
            <Field label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
          </View>
        </View>
        <Field
          label="How many"
          value={count}
          onChangeText={setCount}
          keyboardType="numeric"
        />
        <Button
          label={`Generate for ${selectedAccount?.accountName ?? "account"}`}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !accountId}
        />
      </Card>
    </ScrollView>
  );
}
