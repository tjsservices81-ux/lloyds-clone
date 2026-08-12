import { StateStorage } from "zustand/middleware";

/**
 * Web counterpart of `storage.ts`. `expo-secure-store` has no browser
 * implementation, so persisted state lives in `localStorage` instead.
 */
const memoryFallback = new Map<string, string>();

const canUseLocalStorage = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Access throws when cookies/storage are blocked by the browser.
    return false;
  }
};

const zustandStorage: StateStorage = {
  setItem: async (name, value) => {
    if (canUseLocalStorage()) {
      window.localStorage.setItem(name, value);
      return;
    }
    memoryFallback.set(name, value);
  },
  getItem: async (name) => {
    if (canUseLocalStorage()) {
      return window.localStorage.getItem(name);
    }
    return memoryFallback.get(name) ?? null;
  },
  removeItem: async (name) => {
    if (canUseLocalStorage()) {
      window.localStorage.removeItem(name);
      return;
    }
    memoryFallback.delete(name);
  },
};

export default zustandStorage;
