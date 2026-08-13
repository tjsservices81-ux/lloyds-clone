import { Button } from "@/components/ui";
import privateClient from "@/api/privateClient";
import { useAuth } from "@/store";
import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import { Text, View } from "react-native";

/**
 * Web Face ID setup. Registers a WebAuthn credential (Face ID / Touch ID /
 * platform passkey) for this device so the customer can later sign in with it.
 */
export function FaceIdSection({
  onStatus,
}: {
  savedUserId: string | null;
  onStatus: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const supported =
    typeof window !== "undefined" && !!window.PublicKeyCredential;

  const register = async () => {
    setBusy(true);
    try {
      const deviceId = useAuth.getState().getDeviceId();
      const api = privateClient();
      const { data: options } = await api.post(
        "webauthn/register/options",
        { deviceId },
        { headers: { "x-device-id": deviceId } },
      );
      const attResp = await startRegistration({ optionsJSON: options });
      await api.post(
        "webauthn/register/verify",
        { deviceId, response: attResp },
        { headers: { "x-device-id": deviceId } },
      );
      onStatus("Face ID is set up — you can now sign in with it");
    } catch (error) {
      onStatus(
        (error as Error)?.message
          ? `Face ID setup failed: ${(error as Error).message}`
          : "Face ID setup was cancelled",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-y-3 rounded-xl bg-white p-4">
      <Text className="font-semibold">Face ID</Text>
      <Text className="text-xs text-gray-500">
        Use Face ID (or your device passkey) as a sign-in key on this device.
      </Text>
      {supported ? (
        <Button
          label="Set up Face ID"
          onPress={register}
          disabled={busy}
        />
      ) : (
        <Text className="text-xs text-gray-500">
          This device/browser doesn&apos;t support Face ID sign-in.
        </Text>
      )}
    </View>
  );
}
