import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Button, Screen, Skeleton, Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { archetype, nightCaption } from "../../features/quiz";
import { useOnboarding } from "../../state/onboarding";
import { colors, radius, spacing } from "../../theme";

/** Meters come from the backend (`tasteSummary`); the persona name is local copy. UI-SPEC §2. */
export default function TasteCard() {
  const { answers, tasteSummary } = useOnboarding();
  const me = useQuery(api.users.me);
  const meters = tasteSummary ?? me?.tasteSummary;
  const persona = archetype(answers);

  const share = () => Share.share({ message: `My ${APP_NAME} taste: ${persona.name}` }).catch(() => undefined);

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
        <Text style={styles.title}>{persona.name}</Text>
        <Text style={styles.line}>{persona.line}</Text>
        {meters === undefined || meters === null ? (
          <Skeleton height={120} style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        ) : (
          meters.map((meter) => (
            <View key={meter.label} style={styles.meterRow}>
              <View style={styles.meterLabels}>
                <Text variant="caption" style={styles.white}>{meter.label}</Text>
                <Text variant="caption" style={styles.white}>{meter.pct}%</Text>
              </View>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${meter.pct}%` }]} />
              </View>
            </View>
          ))
        )}
        <Text style={styles.line}>{nightCaption(answers.nights)}</Text>
      </LinearGradient>
      <Button title="Share to story" variant="ghost" onPress={share} />
      <Button title="Find friends" onPress={() => router.push("/find-friends")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginTop: spacing.xl },
  card: { borderRadius: radius.xxl, padding: 22, gap: spacing.md },
  cardLabel: { color: colors.white, opacity: 0.8 },
  title: { color: colors.white, fontSize: 28, lineHeight: 31, fontWeight: "700" },
  line: { color: colors.white, opacity: 0.9, fontSize: 13 },
  meterRow: { gap: spacing.xs },
  meterLabels: { flexDirection: "row", justifyContent: "space-between" },
  meter: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.white },
  white: { color: colors.white },
});
