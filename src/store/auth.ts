import { create } from "zustand";
import {
  combine,
  createJSONStorage,
  devtools,
  persist,
} from "zustand/middleware";

import { PostLogin } from "@/api/session";
import { DeleteLogout } from "@/api/session/logout";
import { LoginForm } from "@/schema";
import useError from "./error";
import useLoadingScreen from "./loading";
import zustandStorage from "./storage";

/** A stable per-device id, generated once and then persisted. It ties the
 * account to this device (the server rejects the credentials from any other). */
function makeDeviceId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const useAuth = create(
  devtools(
    persist(
      combine(
        {
          accessToken: null as string | null,
          refreshToken: null as string | null,
          authenticated: false,
          // Persisted: this device's id and the last User ID used to sign in
          // here. On the next app open the login screen prefills the User ID
          // so the customer only types their password (bank-style).
          deviceId: "" as string,
          savedUserId: null as string | null,
        },
        (set, get) => ({
          getDeviceId: () => {
            let id = get().deviceId;
            if (!id) {
              id = makeDeviceId();
              set({ deviceId: id });
            }
            return id;
          },
          login: async ({ userId, password }: LoginForm) => {
            try {
              useLoadingScreen.getState().setLoading(true);

              let deviceId = get().deviceId;
              if (!deviceId) {
                deviceId = makeDeviceId();
                set({ deviceId });
              }

              const { accessToken, refreshToken } = await PostLogin(
                userId,
                password,
                deviceId,
              );

              set({
                authenticated: true,
                accessToken,
                refreshToken,
                // Remember the User ID for this device.
                savedUserId: userId,
              });
            } catch (error) {
              // handle error
              useError.getState().showToast(error);
            } finally {
              useLoadingScreen.getState().setLoading(false);
            }
          },
          logout: async () => {
            try {
              useLoadingScreen.getState().setLoading(true);

              // logout session in server
              const refreshToken = get().refreshToken;
              const accessToken = get().accessToken;

              if (!refreshToken || !accessToken) {
                throw new Error("Logout: No refresh token");
              }

              // logout session in server
              await DeleteLogout(refreshToken, accessToken);
            } catch (error) {
              // handle error
              useError.getState().showToast(error);
            } finally {
              // Clear the session but KEEP deviceId and savedUserId, so the
              // login screen still remembers the User ID on this device.
              set({
                authenticated: false,
                accessToken: null,
                refreshToken: null,
              });

              useLoadingScreen.getState().setLoading(false);
            }
          },
        }),
      ),
      {
        name: "auth",
        version: 1,
        // Only the device id and saved User ID survive an app restart. The
        // session itself is not persisted, so the app always reopens on the
        // login screen and the password must be re-entered.
        partialize: (state) => ({
          deviceId: state.deviceId,
          savedUserId: state.savedUserId,
        }),
        storage: createJSONStorage(() => zustandStorage),
      },
    ),
  ),
);

export default useAuth;
