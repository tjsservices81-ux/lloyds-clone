import { Text, View } from "react-native";

/**
 * Native stub. Face ID / passkeys here use the WebAuthn browser API, which only
 * exists on the web build, so on iOS/Android we just explain that.
 */
export function FaceIdSection(_props: {
  savedUserId: string | null;
  onStatus: (message: string) => void;
}) {
  return (
    <View className="gap-y-2 rounded-xl bg-white p-4">
      <Text className="font-semibold">Face ID</Text>
      <Text className="text-xs text-gray-500">
        Face ID sign-in is set up from the web app.
      </Text>
    </View>
  );
}
