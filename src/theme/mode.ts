import * as SecureStore from "expo-secure-store";
import { DevSettings, Platform } from "react-native";

/**
 * Light / dark mode. Every StyleSheet in the app is built once when the app starts, so the
 * choice is read synchronously at startup (before any colors are used) and switching
 * saves it and reloads the app. Default is dark (Bryan's look).
 */
export type ThemeMode = "dark" | "light";
const KEY = "clubi.theme";

function read(): ThemeMode {
  try {
    const v = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export const themeMode: ThemeMode = read();
export const isLight = themeMode === "light";

export function setThemeMode(next: ThemeMode) {
  if (next === themeMode) return;
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, next);
    else SecureStore.setItem(KEY, next);
  } catch {
    return;
  }
  if (Platform.OS === "web") globalThis.location?.reload();
  else DevSettings.reload();
}

/** Names main's screens use for the same thing. */
export const isDark = !isLight;
export function toggleThemeMode() {
  setThemeMode(isLight ? "dark" : "light");
}
