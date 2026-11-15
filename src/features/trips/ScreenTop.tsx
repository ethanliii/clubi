import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Header, Text } from "../../components";
import { colors, fontWeight } from "../../theme";

/** The top of a pushed screen: the shared `Header` (back button row, big heading under it). */
export function ScreenTop({ title, right }: { title: string; /** Buttons on the back button's row. */ right?: ReactNode }) {
  return <Header title={title} right={right} />;
}

/** A section's title: plain words in sentence case, with a quiet count or note beside it. */
export function SectionLabel({ title, count, note }: { title: string; count?: number; note?: string }) {
  const aside = note ?? (count === undefined ? undefined : String(count));
  return (
    <View style={styles.row}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {aside ? (
        <Text muted style={styles.aside}>
          {aside}
        </Text>
      ) : null}
    </View>
  );
}

/** The small word above a form control: "Vibe", "Who's coming". */
export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.field}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  aside: { fontSize: 15 },
  field: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.semibold, color: colors.muted },
});
