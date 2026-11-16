import * as SecureStore from "expo-secure-store";
import { Alert, DevSettings, Platform } from "react-native";

// Light or dark, chosen with the sun/moon icon at the top right of the feed (components/ThemeToggle).
// The choice is read once, before any stylesheet is built, because every screen builds its styles
// from the colour tokens when its file loads. Changing it therefore saves the choice and reloads
// the app, which comes back in the other mode about a second later, still signed in.

export type ThemeMode = "light" | "dark";
const KEY = "clubi.theme";

function storedMode(): ThemeMode {
  try {
    const stored =
      Platform.OS === "web"
        ? typeof localStorage === "undefined" ? null : localStorage.getItem(KEY)
        : SecureStore.getItem(KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** The mode this run of the app is drawn in. */
export const themeMode: ThemeMode = storedMode();
export const isDark = themeMode === "dark";

/** Save the other mode and reload the app into it. */
export function toggleThemeMode() {
  const next: ThemeMode = isDark ? "light" : "dark";
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(KEY, next);
      window.location.reload();
      return;
    }
    SecureStore.setItem(KEY, next);
    if (__DEV__) DevSettings.reload();
    else Alert.alert(next === "dark" ? "Dark mode is on" : "Light mode is on", "Close and reopen the app to see it.");
  } catch {
    // Storage refused (a private window, say): the app simply stays as it is.
  }
}
