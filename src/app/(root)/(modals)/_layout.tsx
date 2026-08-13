import { Header } from "@/components/headers";
import { Stack, useGlobalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function Layout() {
  const globalParams = useGlobalSearchParams<{ title?: string }>();

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen
          name="details/[accountId]"
          options={{
            title: globalParams.title ?? "Account details",
            header: (props) => (
              <Header showClose {...props} useSafeArea={false} />
            ),
          }}
        />
        <Stack.Screen
          name="details/send/[accountId]"
          options={{
            title: globalParams.title ?? "Account details",
            header: (props) => (
              <Header showClose {...props} useSafeArea={false} />
            ),
          }}
        />
        <Stack.Screen
          name="customer-panel"
          options={{
            title: "Manage account",
            header: (props) => (
              <Header showClose {...props} useSafeArea={false} />
            ),
          }}
        />
        <Stack.Screen name="(payment)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
