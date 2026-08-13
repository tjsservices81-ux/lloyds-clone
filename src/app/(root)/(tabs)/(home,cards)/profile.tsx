import { Header } from "@/components/headers";
import { cn } from "@/libs/utils";
import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Page() {
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <View className="flex-1 px-4 pt-5">
      <Stack.Screen
        options={{
          title: "Profile and settings",
          header: (props) => <Header showBack showSupport {...props} />,
        }}
      />
      <View className="flex-row overflow-hidden rounded-xl border border-black">
        <Pressable
          onPress={setSelectedTab.bind(null, 0)}
          className={cn(
            "flex-1 items-center py-4",
            selectedTab === 0 && "bg-black",
          )}
        >
          <Text className={cn(selectedTab === 0 && "font-semibold text-white")}>
            Profile
          </Text>
        </Pressable>
        <Pressable
          className={cn(
            "flex-1 items-center py-4",
            selectedTab === 1 && "bg-black",
          )}
          onPress={setSelectedTab.bind(null, 1)}
        >
          <Text className={cn(selectedTab === 1 && "font-semibold text-white")}>
            Settings
          </Text>
        </Pressable>
      </View>

      {selectedTab === 0 && <ProfileScreen />}
      {selectedTab === 1 && <SettingsScreen />}
    </View>
  );
}
