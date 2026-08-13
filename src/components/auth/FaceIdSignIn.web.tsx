import { Button } from "@/components/ui";
import publicClient from "@/api/publicClient";
import { useAuth } from "@/store";
import useError from "@/store/error";
import { startAuthentication } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

/**
 * "Sign in with Face ID" button on the login screen. It only appears when this
 * device has a registered credential for its bound account. On success it sets
 * the session directly (no password needed).
 */
export function FaceIdSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined" || !window.PublicKeyCredential) return;
        const deviceId = useAuth.getState().getDeviceId();
        const { data } = await publicClient.post("/webauthn/auth/options", {
          deviceId,
        });
        if (!cancelled) setAvailable(!!data?.available);
      } catch {
        // No Face ID available on this device — leave the button hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async () => {
    setBusy(true);
    try {
      const deviceId = useAuth.getState().getDeviceId();
      // Fetch a fresh challenge, then prompt Face ID.
      const { data } = await publicClient.post("/webauthn/auth/options", {
        deviceId,
      });
      if (!data?.available) {
        setAvailable(false);
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: data.options });
      const { data: result } = await publicClient.post(
        "/webauthn/auth/verify",
        { deviceId, response: assertion },
      );
      useAuth.setState({
        authenticated: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        savedUserId: result.userId,
      });
      onSignedIn?.();
    } catch (error) {
      useError.getState().showToast({ code: "FACE_ID_ERROR", error });
    } finally {
      setBusy(false);
    }
  };

  if (!available) return null;

  return (
    <Button
      label="Sign in with Face ID"
      variant="outline"
      size="lg"
      onPress={signIn}
      disabled={busy}
    >
      <Ionicons
        name="scan-outline"
        size={20}
        color="black"
        className="absolute left-4"
      />
    </Button>
  );
}
