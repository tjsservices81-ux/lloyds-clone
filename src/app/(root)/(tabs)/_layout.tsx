import React, { useCallback, useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { Header } from "@/components/headers";
import { AntDesign, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAccountsQuery } from "@/hooks";
import { usePaymentActions } from "@/store";
import { EventArg } from "@react-navigation/native";

function TabBarIcon({
  size = 24,
  icon: Icon,
  ...props
}: {
  icon: any;
  name: string;
  color: string;
  size?: number;
}) {
  return <Icon size={size} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();

  const [enabled, setEnable] = useState(false);

  const { accountsQuery } = useAccountsQuery({ accounts: { enabled } });
  const { setAccount } = usePaymentActions();

  const handleTabPress = useCallback(
    (e: EventArg<"tabPress", true, undefined>) => {
      e.preventDefault();

      setEnable(true);

      if (!accountsQuery.isPending && !accountsQuery.isError) {
        setAccount(accountsQuery.data[0]);
      }

      router.push("/(root)/(modals)/(payment)");
    },
    [
      accountsQuery.data,
      accountsQuery.isError,
      accountsQuery.isPending,
      router,
      setAccount,
    ],
  );

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          display:
            route.name === "(payment)" || route.name === "(search)"
              ? "none"
              : "flex",
        },

        tabBarActiveTintColor: "#000000",
        // React Navigation moves labels beside the icons on wide viewports,
        // which the phone-width web shell has no room for.
        tabBarLabelPosition: "below-icon",
      })}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={Feather} name="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(apply)"
        options={{
          title: "Apply",
          tabBarIcon: ({ color }) => (
            <TabBarIcon
              icon={FontAwesome}
              name="hand-pointer-o"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="(payment)/index"
        options={{
          title: "Payment",
          tabBarIcon: ({ color }) => (
            <TabBarIcon
              icon={MaterialCommunityIcons}
              name="bank-transfer"
              color={color}
            />
          ),
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />

      <Tabs.Screen
        name="(search)/index"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => (
            <TabBarIcon icon={AntDesign} name="search1" color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/(root)/(modals)/example");
          },
        }}
      />

      <Tabs.Screen
        name="(cards)"
        options={{
          title: "Cards",
          tabBarIcon: ({ color }) => (
            <TabBarIcon icon={FontAwesome} name="credit-card" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
