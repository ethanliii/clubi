import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
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
  const { isAuthenticated } = useConvexAuth();
  const { completed } = useOnboarding();
  const onboarded = completed || isAuthenticated;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded} redirectTo="/welcome">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[id]" />
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
