import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { APP_NAME } from "../constants/brand";
import { colors, spacing } from "../theme";
import { Text } from "./Text";

const SLOW_AFTER_MS = 8000;

/** The full-screen "starting up" view the root layout shows until the backend says who is signed in. */
export function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${APP_NAME} is loading`} style={styles.wrap}>
      <Text variant="display">{APP_NAME}</Text>
      <ActivityIndicator color={colors.muted} />
      {slow ? (
        <Text muted center>
          Still connecting. Check your internet connection.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
});
