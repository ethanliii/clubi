import { useConvexAuth } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "../../components/bryan";
import { APP_NAME, TAGLINE } from "../../constants/brand";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { colors, spacing } from "../../theme";

// Apple / Google sign-in needs OAuth providers in convex/auth.ts (backend ask E11). Buttons are in place.
const socialSoon = () =>
  Alert.alert("Coming soon", "Apple and Google sign-in are on the way. Create an account with a username for now.");

export default function Welcome() {
  const { isAuthenticated } = useConvexAuth();
  // Signed in but the quiz isn't done yet: go straight to it.
  useEffect(() => {
    if (isAuthenticated) router.replace("/quiz");
  }, [isAuthenticated]);

  return (
    <View style={styles.root}>
      <VideoBackground />
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.88)"]}
        locations={[0, 0.35, 0.6, 0.88]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.content}>
        <View style={styles.middle}>
          <Text variant="display" center style={styles.logo}>
            {APP_NAME}
          </Text>
          <Text center style={styles.tagline}>
            {TAGLINE}
          </Text>
        </View>
        <View style={styles.bottom}>
          <Text variant="caption" center style={styles.terms}>
            By tapping {"'"}Sign in{"'"} / {"'"}Create account{"'"}, you agree to our{" "}
            <Text variant="caption" style={styles.underline}>
              Terms of Service
            </Text>
            . Learn how we process your data in our{" "}
            <Text variant="caption" style={styles.underline}>
              Privacy Policy
            </Text>
            .
          </Text>
          <Button
            title="Create account"
            variant="light"
            onPress={() => router.push({ pathname: "/sign-in", params: { mode: "signup" } })}
          />
          <View style={styles.social}>
            <Button title="Continue with Apple" variant="ghost" style={styles.socialButton} onPress={socialSoon} />
            <Button title="Continue with Google" variant="ghost" style={styles.socialButton} onPress={socialSoon} />
          </View>
          <Button
            title="Sign in"
            variant="link"
            onPress={() => router.push({ pathname: "/sign-in", params: { mode: "signin" } })}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const shadow = { textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 12 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: "space-between" },
  middle: { marginTop: "22%", alignItems: "center", gap: spacing.sm },
  logo: { ...shadow },
  tagline: { fontSize: 16, fontWeight: "600", ...shadow },
  bottom: { paddingHorizontal: 22, paddingBottom: 22, gap: 14, alignItems: "center" },
  terms: { color: "#e6e0ee", lineHeight: 17 },
  underline: { color: "#e6e0ee", textDecorationLine: "underline" },
  social: { flexDirection: "row", gap: 10, width: "100%" },
  socialButton: { flex: 1, width: "auto", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)" },
});
