import { Button } from "@/components/ui";
import { CurrentUser } from "@/schema";
import { useAuth } from "@/store";
import { MaterialIcons, Octicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

const ProfileScreen = () => {
  const { logout } = useAuth();

  const queryClient = useQueryClient();

  const user = queryClient.getQueryData<CurrentUser>(["current-user"]);

  if (!user) {
    return (
      <Button label="Log out" size="lg" onPress={logout}>
        <MaterialIcons
          name="logout"
          size={24}
          color="white"
          className="absolute right-4"
        />
      </Button>
    );
  }

  return (
    <View className="flex-1 gap-y-3 py-5">
      <ScrollView
        contentContainerClassName="flex-grow gap-y-5"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-semibold">Your details</Text>

        <Link href="/(root)/(modals)/customer-panel" asChild>
          <Pressable className="flex-row items-center rounded-xl bg-black px-3 py-4 active:opacity-80">
            <MaterialIcons name="manage-accounts" size={22} color="white" />
            <Text className="ml-3 font-semibold text-white">
              Manage account
            </Text>
            <View className="flex-1" />
            <Octicons name="chevron-right" size={20} color="white" />
          </Pressable>
        </Link>

        <View className="gap-y-1 rounded-xl bg-white px-3 py-4">
          <Text className="text-sm text-gray-600">Name and title:</Text>
          <Text className="font-semibold">{user.fullName}</Text>
        </View>

        <View className="gap-y-1 rounded-xl bg-white px-3 py-4">
          <Text className="text-sm text-gray-600">User ID:</Text>
          <Text className="font-semibold uppercase">{user.userId}</Text>
        </View>

        <View className="relative gap-y-2 rounded-xl bg-white px-3 py-4">
          <View className="gap-y-1">
            <Text className="text-sm text-gray-600">Mobile:</Text>
            <Text className="font-semibold">+44 20 1234 5678</Text>
          </View>
          <View className="gap-y-1">
            <Text className="text-sm text-gray-600">Home:</Text>
            <Text className="font-semibold">Add phone number</Text>
          </View>
          <View className="gap-y-1">
            <Text className="text-sm text-gray-600">Work:</Text>
            <Text className="font-semibold">Add phone number</Text>
          </View>
          <View className="absolute right-4 top-1/2 translate-y-1/2">
            <Octicons name="chevron-right" size={20} color="#5e5c5c" />
          </View>
        </View>

        <View className="gap-y-2 rounded-xl bg-white px-3 py-4">
          <View className="gap-y-1">
            <Text className="text-sm text-gray-600">Address:</Text>
            <Text className="font-semibold uppercase">{`1234 Street Name\nLondon`}</Text>
          </View>

          <View className="gap-y-1">
            <Text className="text-sm text-gray-600">Postcode:</Text>
            <Text className="font-semibold">KT3 4ER</Text>
          </View>

          <View className="absolute right-4 top-1/2 translate-y-1/2">
            <Octicons name="chevron-right" size={20} color="#5e5c5c" />
          </View>
        </View>

        <View className="gap-y-1 rounded-xl bg-white px-3 py-4">
          <Text className="text-sm text-gray-600">Email:</Text>
          <Text className="font-semibold uppercase">{user.email}</Text>
        </View>

        <View className="itecem flex-row justify-between gap-y-1 rounded-xl bg-white px-3 py-4">
          <Text className="font-semibold">Income and expenses</Text>

          <Octicons name="chevron-right" size={20} color="#5e5c5c" />
        </View>
      </ScrollView>

      <Button label="Log out" size="lg" onPress={logout}>
        <MaterialIcons
          name="logout"
          size={24}
          color="white"
          className="absolute right-4"
        />
      </Button>
    </View>
  );
};
export default ProfileScreen;
