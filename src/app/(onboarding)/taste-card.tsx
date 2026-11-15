import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, ChipRow, Loading, Screen, Text } from "../../components";
import { APP_NAME } from "../../constants/brand";
import { personaTitle, pickedTags } from "../../features/onboarding/quizCards";
import { forgetQuizResult, lastQuizResult } from "../../features/onboarding/quizResult";
import { TasteMeters } from "../../features/onboarding/TasteMeters";
import { paths } from "../../lib/links";
import { useMe, useSession } from "../../state/session";
import { colors, radius, spacing } from "../../theme";

/**
 * The reveal after the quiz: the four meters the backend worked out (`users.me.tasteSummary`, or the
 * same list straight from `users.saveQuiz` for the instant before `users.me` catches up), under a
 * persona name made from the user's own answers. "Let's go" opens the Map tab.
 */
export default function TasteCard() {
  const me = useMe();
  const { finishOnboarding } = useSession();
  // Read once: "Let's go" forgets the result, and the card must not change while it closes.
  const [saved] = useState(lastQuizResult);

  // Opened by address before the quiz was saved: there is nothing to reveal yet.
  if (me !== undefined && !me.onboarded && saved === null) return <Redirect href={paths.quiz} />;

  const meters = me?.onboarded ? me.tasteSummary : saved?.tasteSummary;
  const title = personaTitle(saved?.answers);
  const tags = pickedTags(saved?.answers);

  const enter = () => {
    forgetQuizResult();
    finishOnboarding();
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.intro}>
        <Text variant="label" center>
          Your taste
        </Text>
        <Text variant="heading" center>
          {me ? `Here's your night, ${me.displayName}` : "Here's your night"}
        </Text>
      </View>
      {meters === undefined ? (
        <Loading label="Working out your taste" />
      ) : (
        <>
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
            <Text accessibilityRole="header" style={styles.title}>
              {title ?? "Your going-out taste"}
            </Text>
            <TasteMeters meters={meters} />
          </LinearGradient>
          {tags.length > 0 ? (
            <ChipRow style={styles.tags}>
              {tags.map((tag) => (
                <Chip key={tag} label={tag} size="sm" />
              ))}
            </ChipRow>
          ) : null}
          <Text muted center>
            Every score and match you see is tuned to this. It sharpens each time you rank a place.
          </Text>
        </>
      )}
      <Button title="Let's go" accessibilityLabel="Let's go" disabled={!me?.onboarded} onPress={enter} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.xl, gap: spacing.sm },
  card: { borderRadius: radius.xxl, padding: 22, gap: spacing.md },
  cardLabel: { color: colors.white, opacity: 0.8 },
  title: { color: colors.white, fontSize: 28, lineHeight: 31, fontWeight: "700" },
  tags: { justifyContent: "center" },
});
