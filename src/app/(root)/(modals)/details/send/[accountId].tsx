import { Header } from "@/components/headers";
import { useAccountQuery } from "@/hooks";
import { Ionicons, Octicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

const Page = () => {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();

  const query = useAccountQuery(accountId);

  if (query.isPending || query.isError) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const account = query.data.account;

  return (
    <View className="flex-1 gap-y-5 bg-white py-5">
      <View className="mx-3 flex-row items-center gap-x-3 rounded-lg bg-[#f0f0f0] p-3">
        <Ionicons name="lock-closed-outline" size={20} color="black" />
        <Text className="text-sm">
          Keep your details safe. Only send to people you know.
        </Text>
      </View>

      <BankDetailsCard
        type="local"
        sortCode={account.sortCode}
        accountNumber={account.accountNumber}
        holderName={account.nameOnAccount}
      />

      <BankDetailsCard
        type="international"
        iban={account.iban}
        bic={account.bic}
        holderName={account.nameOnAccount}
      />
    </View>
  );
};

export default Page;

type BankDetailsCardProps = {
  holderName: string;
} & (
  | {
      type: "local";
      sortCode: string;
      accountNumber: string;
    }
  | {
      type: "international";
      iban: string;
      bic: string;
    }
);

const BankDetailsCard = (props: BankDetailsCardProps) => {
  const { holderName, type } = props;

  return (
    <View className="mx-3 gap-y-5 rounded-md border border-blue-600 bg-purple-100/50 p-4">
      <View className="gap-y-2">
        <View className="flex-row items-center gap-x-2">
          <Text className="text-sm">Name on the account</Text>
          <Text className="font-bold">{holderName}</Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          <Text className="text-sm">
            {type === "local" ? "Sort Code" : "IBAN"}
          </Text>
          <Text className="font-bold">
            {type === "local" ? props.sortCode : props.iban}
          </Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          <Text className="text-sm">
            {type === "local" ? "Account Number" : "BIC/SWIFT"}
          </Text>
          <Text className="font-bold">
            {type === "local" ? props.accountNumber : props.bic}
          </Text>
        </View>
      </View>
      <View className="my-1 h-px bg-gray-400" />
      <View className="flex-row items-center gap-x-3">
        <Octicons name="share" size={24} color="#000000" />
        <Text className="font-semibold">
          {type === "local"
            ? "Send UK bank details"
            : "Send international bank details"}
        </Text>
      </View>
    </View>
  );
};
