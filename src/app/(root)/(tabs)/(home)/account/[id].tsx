import { AccountSummary } from "@/components/Transactions";

import { AnimatedHeader } from "@/components/headers";
import { useAccountQuery, useAnimatedAccountScreen } from "@/hooks";
import { useAccountTransactionsQuery } from "@/hooks/query/useAccountTransactionsQuery";
import { useLoadingScreen } from "@/store";
import { cn, formatCurrency } from "@/libs/utils";
import { Transaction } from "@/types";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View, Text } from "react-native";
import { Tabs } from "react-native-collapsible-tab-view";

const TransactionRow = ({ transaction }: { transaction: Transaction }) => {
  const isDeposit = transaction.type === "deposit";
  return (
    <View className="flex-row items-center gap-x-3 border-b-hairline border-gray-200 bg-white px-4 py-4">
      <View className="flex-1">
        <Text className="text-base font-medium">{transaction.payee.name}</Text>
        {!!transaction.payee.reference && (
          <Text className="text-xs text-gray-500">
            {transaction.payee.reference}
          </Text>
        )}
        <Text className="text-xs text-gray-400">
          {new Date(transaction.date).toDateString()}
        </Text>
      </View>
      <View className="items-end">
        <Text className={cn("text-base", isDeposit && "text-green-700")}>
          {isDeposit ? "+ " : "- "}
          {formatCurrency(Math.abs(transaction.amount))}
        </Text>
        <Text className="text-xs text-gray-400">
          {formatCurrency(transaction.balanceAfter)}
        </Text>
      </View>
    </View>
  );
};

const EmptyMonth = () => (
  <View className="items-center bg-white px-4 py-16">
    <Text className="text-gray-400">No transactions this month</Text>
  </View>
);

const Page = () => {
  const { id, name: accountName } = useLocalSearchParams<{
    id: string;
    name: string;
  }>();

  const { setLoading } = useLoadingScreen();

  const { data, isLoading } = useAccountQuery(id);
  const { byMonth } = useAccountTransactionsQuery(id);

  useEffect(() => {
    setLoading(isLoading || !data);
  }, [data, isLoading, setLoading]);

  const { threshold, scrollOffset } = useAnimatedAccountScreen();

  if (isLoading || !data) {
    return null;
  }

  const { account, timeline } = data;

  if (!account || !timeline) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: accountName,
          header: (props) => (
            <AnimatedHeader
              balance={account.balance}
              scrollOffset={scrollOffset}
              threshold={threshold}
              {...props}
            />
          ),
        }}
      />

      <Tabs.Container renderHeader={() => <AccountSummary {...account} />}>
        {timeline.map((month) => (
          <Tabs.Tab name={month} key={month} label={month}>
            <Tabs.FlashList
              estimatedItemSize={72}
              data={byMonth[month] ?? []}
              keyExtractor={(item: Transaction) => item.id}
              renderItem={({ item }: { item: Transaction }) => (
                <TransactionRow transaction={item} />
              )}
              ListEmptyComponent={EmptyMonth}
            />
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </View>
  );
};

export default Page;
