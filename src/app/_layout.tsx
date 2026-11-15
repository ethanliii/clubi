import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { OnboardingProvider, useOnboarding } from "../state/onboarding";
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
      <OnboardingProvider>
        <RootStack />
        <StatusBar style="light" />
      </OnboardingProvider>
    </ConvexAuthProvider>
  );
}

function RootStack() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { completed, inQuiz } = useOnboarding();
  // users.me: null = signed out, onboarded = the quiz is saved on the server.
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && me === undefined)) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }
  // Signed in and done: the server says onboarded (or we finished it here), and we're not mid-quiz.
  const inApp = isAuthenticated && !!me && (completed || me.onboarded) && !inQuiz;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!inApp}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={inApp} redirectTo="/welcome">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[kind]/[id]" />
        <Stack.Screen name="rankings" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="friend/[id]" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="moments" />
      </Stack.Protected>
      <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
    </Stack>
  );
}
