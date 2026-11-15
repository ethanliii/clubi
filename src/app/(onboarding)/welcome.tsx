import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "../../components";
import { APP_NAME, TAGLINE } from "../../constants/brand";
import { VideoBackground } from "../../features/onboarding/VideoBackground";
import { colors, spacing } from "../../theme";

export default function Welcome() {
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
          <Button title="Create account" variant="light" onPress={() => router.push("/quiz")} />
          <Button title="Sign in" variant="link" onPress={() => router.push("/sign-in")} />
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
});
