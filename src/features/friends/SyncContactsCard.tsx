import { Pressable, StyleSheet, View } from "react-native";
import { Text, useToast } from "../../components";
import { colors, fontWeight, radius } from "../../theme";

/**
 * Bryan's "Sync your contacts" card. It sits where people look for friends: at the top of Friends,
 * and on the taste card right after the quiz. Matching numbers is not built yet (it needs the phone's
 * contacts permission and a backend lookup), and a tap says so.
 */
export function SyncContactsCard() {
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sync your contacts"
      onPress={() => toast("Contact sync is coming soon. For now, find friends by username.")}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>Sync your contacts</Text>
        <Text variant="caption" muted>
          See which friends are already here. Numbers are matched privately.
        </Text>
      </View>
      <Text style={styles.action}>Sync</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Bryan's card: the soft accent tint, so it reads as an invitation and not as one more row.
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.2, color: colors.fg },
  action: { fontSize: 15, lineHeight: 20, fontWeight: fontWeight.bold, color: colors.accent },
});
