import {
  changePassword,
  generateTransactions,
  updateProfile,
} from "@/api/users/account";
import { Button } from "@/components/ui";
import { FaceIdSection } from "@/components/customer-panel/FaceIdSection";
import {
  AccountQueryKey,
  TransactionQueryKey,
  UserQueryKey,
} from "@/libs/query-keys";
import { cn } from "@/libs/utils";
import { GetAllAccountSchema } from "@/schema";
import { useAccountsQuery, useUserQuery } from "@/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

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
  keyboardType?: "default" | "numeric";
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

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  // Password
  const [newPassword, setNewPassword] = useState("");

  // Generate transactions
  const [accountId, setAccountId] = useState<string>("");
  const [from, setFrom] = useState(monthsAgoISO(3));
  const [to, setTo] = useState(todayISO());
  const [count, setCount] = useState("15");
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const [status, setStatus] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ name, email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UserQueryKey.currentUser });
      setStatus("Profile updated");
    },
    onError: () => setStatus("Could not update profile"),
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ newPassword }),
    onSuccess: () => {
      setNewPassword("");
      setStatus("Password changed — you're still signed in");
    },
    onError: () => setStatus("Could not change password (min 6 characters)"),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateTransactions({
        accountId,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        count: Number(count) || 15,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: TransactionQueryKey.transactions(accountId),
      });
      queryClient.invalidateQueries({
        queryKey: AccountQueryKey.userAccount(accountId),
      });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setStatus(`Generated ${res.created} transactions`);
    },
    onError: () => setStatus("Could not generate transactions"),
  });

  const selectedName = useMemo(
    () => accounts.find((a) => a.id === accountId)?.accountName,
    [accounts, accountId],
  );

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

      <Card title="Generate transaction history">
        <Text className="text-xs text-gray-500">
          Create random transactions for an account between two dates.
        </Text>
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
          label={`Generate for ${selectedName ?? "account"}`}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || !accountId}
        />
      </Card>
    </ScrollView>
  );
}
