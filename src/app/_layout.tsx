import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useQuery } from "convex/react";
import { router, Stack, usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { ErrorBoundary, Splash, ToastProvider } from "../components";
import { paths } from "../lib/links";
import { OVERLORD_USERNAMES, setOverlord, useOverlord } from "../lib/overlord";
import { SessionProvider, useSession } from "../state/session";
import { colors } from "../theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function RootLayout() {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={Platform.OS === "web" ? undefined : secureStorage}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      <SessionProvider>
        {/* On a wide browser window the app stays a phone-width column. */}
        <View style={styles.page}>
          <View style={styles.app}>
            <ToastProvider>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
            </ToastProvider>
          </View>
        </View>
        <StatusBar style="light" />
      </SessionProvider>
    </ConvexAuthProvider>
  );
}

/**
 * Which screens exist depends on the session gate (see src/state/session.tsx):
 * signed out → welcome + sign-in · not onboarded → the quiz · onboarded → everything else.
 * A screen whose guard is false cannot be opened, and anyone standing on it is moved to the
 * first screen that is still allowed.
 */
function RootNavigator() {
  const { gate, landing } = useSession();
  // Overlord mode (testing): every guard below opens, so any page can be visited from /overlord.
  const overlord = useOverlord();
  const me = useQuery(api.users.me);
  const pathname = usePathname();
  useEffect(() => {
    if (me?.username !== undefined && OVERLORD_USERNAMES.has(me.username)) setOverlord(true);
  }, [me?.username]);
  if (gate === null) return <Splash />;

  const inApp = overlord || gate === "ready" || gate === "tasteCard";
  // Where someone lands when the screen they are on (or asked for) is not allowed for them.
  const home = gate === "signedOut" ? paths.welcome : gate === "quiz" ? paths.quiz : landing;
  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={inApp} redirectTo={home}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[kind]/[id]" />
        <Stack.Screen name="rate/[kind]/[id]" />
        <Stack.Screen name="post/[postId]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="rankings" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="user/[userId]" />
        <Stack.Screen name="compare/[userId]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="trip/[tripId]" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="following" />
        <Stack.Screen name="performer/[performerId]" />
      </Stack.Protected>
      <Stack.Protected guard={overlord || gate !== "ready"} redirectTo={home}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={overlord || gate === "signedOut"} redirectTo={home}>
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Screen name="overlord" />
      <Stack.Screen name="+not-found" />
    </Stack>
    {overlord && pathname !== "/overlord" ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open overlord menu"
        onPress={() => router.push("/overlord")}
        style={styles.overlordButton}
      >
        <Text style={styles.overlordIcon}>⚡</Text>
      </Pressable>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", backgroundColor: colors.page },
  app: { flex: 1, width: "100%", maxWidth: 520, backgroundColor: colors.bg },
  overlordButton: {
    position: "absolute", left: 12, bottom: 96, width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.accent, opacity: 0.9,
  },
  overlordIcon: { fontSize: 18 },
});
