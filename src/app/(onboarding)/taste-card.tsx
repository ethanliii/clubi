import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Button, Loading, Screen, Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { useMe, useSession } from "../../state/session";
import { colors, radius, spacing } from "../../theme";

/** The four taste meters the backend computed from the quiz (`users.me.tasteSummary`). */
export default function TasteCard() {
  const me = useMe();
  const { finishOnboarding } = useSession();

  return (
    <Screen edges={["top", "bottom"]}>
      <Text variant="label" center style={styles.kicker}>
        Your going-out taste
      </Text>
      {me === undefined || !me.onboarded ? (
        <Loading label="Working out your taste" />
      ) : (
        <LinearGradient
          colors={["#ff4f9a", "#b8306f", "#2a1530"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Text variant="caption" style={styles.cardLabel}>
            {APP_NAME.toUpperCase()} TASTE CARD
          </Text>
          <Text style={styles.title}>{me.displayName}</Text>
          {me.tasteSummary.map((meter) => (
            <View key={meter.label} accessibilityLabel={`${meter.label} ${meter.pct}%`} style={styles.meterRow}>
              <View style={styles.meterLabels}>
                <Text variant="caption" style={styles.white}>
                  {meter.label}
                </Text>
                <Text variant="caption" style={styles.white}>
                  {meter.pct}%
                </Text>
              </View>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${meter.pct}%` }]} />
              </View>
            </View>
          ))}
        </LinearGradient>
      )}
      <Button
        title="Let's go"
        accessibilityLabel="Let's go"
        disabled={me === undefined || !me.onboarded}
        onPress={finishOnboarding}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginTop: spacing.xl },
  card: { borderRadius: radius.xxl, padding: 22, gap: spacing.md },
  cardLabel: { color: colors.white, opacity: 0.8 },
  title: { color: colors.white, fontSize: 28, lineHeight: 31, fontWeight: "700" },
  meterRow: { gap: spacing.xs },
  meterLabels: { flexDirection: "row", justifyContent: "space-between" },
  meter: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.white },
  white: { color: colors.white },
});
