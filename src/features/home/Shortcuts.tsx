import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { colors, fontWeight, palette } from "../../theme";

/**
 * The ways out of Home as one row of light-grey pills that scrolls sideways: plan a night, saved
 * places, trips, my rankings. `gutter` is the screen's side padding, so the row runs to both edges.
 */
export function Shortcuts({
  gutter,
  onPlan,
  onSaved,
  onTrips,
  onRankings,
}: {
  gutter: number;
  onPlan: () => void;
  onSaved: () => void;
  onTrips: () => void;
  onRankings: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.bleed, { marginHorizontal: -gutter }]}
      contentContainerStyle={[styles.row, { paddingHorizontal: gutter }]}
    >
      <Pill label="Plan my night" icon="spark" onPress={onPlan} />
      <Pill label="Saved" icon="bookmark" onPress={onSaved} />
      <Pill label="Trips" icon="users" onPress={onTrips} />
      <Pill label="My rankings" icon="star" onPress={onRankings} />
    </ScrollView>
  );
}

function Pill({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    // The pill looks 36 tall; the pressable around it is 44.
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.hit}>
      {({ pressed }) => (
        <View style={[styles.pill, pressed && styles.pressed]}>
          <Icon name={icon} size={16} color={colors.fg} />
          <Text numberOfLines={1} style={styles.label}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bleed: { flexGrow: 0 },
  row: { gap: 8 },
  hit: { height: 44, justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: palette.field,
  },
  pressed: { backgroundColor: palette.fieldPressed },
  label: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.semibold, color: colors.fg },
});
