import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { Button, Screen, Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { TASTE_TWINS_NEARBY } from "../../data/mock";
import { deriveTaste } from "../../features/taste";
import { useOnboarding } from "../../state/onboarding";
import { colors, radius, spacing } from "../../theme";

export default function TasteCard() {
  const { picks, complete } = useOnboarding();
  const taste = deriveTaste(picks);

  const share = () =>
    Share.share({ message: `My ${APP_NAME} taste: ${taste.title}` }).catch(() => undefined);

  const enter = () => {
    complete();
    router.replace("/");
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Text variant="label" center style={styles.kicker}>
        Your going-out taste
      </Text>
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
        <Text style={styles.title}>{taste.title.replace(" ", "\n")}</Text>
        {taste.meters.map((meter) => (
          <View key={meter.label} style={styles.meterRow}>
            <View style={styles.meterLabels}>
              <Text variant="caption" style={styles.white}>
                {meter.label}
              </Text>
              <Text variant="caption" style={styles.white}>
                {meter.value}%
              </Text>
            </View>
            <View style={styles.meter}>
              <View style={[styles.meterFill, { width: `${meter.value}%` }]} />
            </View>
          </View>
        ))}
        <Text style={styles.twins}>
          Taste twins nearby: <Text style={styles.bold}>{TASTE_TWINS_NEARBY}</Text>
        </Text>
      </LinearGradient>
      <Button title="Share to story" variant="ghost" onPress={share} />
      <Button title={`Enter ${APP_NAME}`} onPress={enter} />
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
  twins: { color: colors.white, opacity: 0.9, fontSize: 13 },
  bold: { color: colors.white, fontWeight: "700", fontSize: 13 },
  white: { color: colors.white },
});
