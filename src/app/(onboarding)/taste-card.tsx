import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Loading, Text } from "../../components";
import { pickedTags } from "../../features/onboarding/quizCards";
import { forgetQuizResult, lastQuizResult } from "../../features/onboarding/quizResult";
import { Rise } from "../../features/onboarding/Rise";
import { tasteHeadline } from "../../features/onboarding/tasteHeadline";
import { TasteMeters } from "../../features/onboarding/TasteMeters";
import { paths } from "../../lib/links";
import { useMe, useSession } from "../../state/session";
import { colors, fontWeight } from "../../theme";

/**
 * The reveal after the quiz: the four meters the backend worked out (`users.me.tasteSummary`, or the
 * same list straight from `users.saveQuiz` for the instant before `users.me` catches up), under a
 * name made from those meters. "Let's go" opens the Map tab.
 */
export default function TasteCard() {
  const me = useMe();
  const { finishOnboarding } = useSession();
  // Read once: "Let's go" forgets the result, and the card must not change while it closes.
  const [saved] = useState(lastQuizResult);

  // Opened by address before the quiz was saved: there is nothing to reveal yet.
  if (me !== undefined && !me.onboarded && saved === null) return <Redirect href={paths.quiz} />;

  const meters = me?.onboarded ? me.tasteSummary : saved?.tasteSummary;
  const headline = tasteHeadline(meters);
  const tags = pickedTags(saved?.answers);
  const lead = headline.countable ? "you're a" : "here's your taste";

  const enter = () => {
    forgetQuizResult();
    finishOnboarding();
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(255,79,154,0.22)", "rgba(255,79,154,0.06)", "rgba(20,17,25,0)"]}
        locations={[0, 0.5, 1]}
        style={styles.glow}
      />
      {meters === undefined ? (
        <Loading label="Working out your taste" />
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.name}>
            <Rise delay={80}>
              <Text style={styles.lead}>{me ? `${me.displayName}, ${lead}` : `${lead.charAt(0).toUpperCase()}${lead.slice(1)}`}</Text>
            </Rise>
            <Rise delay={220} from={22} duration={520}>
              <Text accessibilityRole="header" style={styles.title}>
                {headline.title}
              </Text>
            </Rise>
          </View>
          <View style={styles.detail}>
            <TasteMeters meters={meters} highlight={headline.top} startDelay={650} />
            {tags.length > 0 ? (
              <Rise delay={1400}>
                <Text style={styles.tags}>Into {listOf(tags)}.</Text>
              </Rise>
            ) : null}
          </View>
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Text variant="caption" muted center>
          It sharpens every time you rank a place.
        </Text>
        <Button
          title="Let's go"
          accessibilityLabel="Let's go"
          disabled={!me?.onboarded}
          style={styles.go}
          onPress={enter}
        />
      </View>
    </SafeAreaView>
  );
}

/** "House, Techno and Food", in lower case after the first word of the sentence. */
function listOf(words: readonly string[]): string {
  const lower = words.map((word) => word.toLowerCase());
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

const SIDE = 24;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, paddingHorizontal: SIDE, paddingTop: 64, paddingBottom: 20, gap: 40 },
  name: { gap: 8 },
  lead: { fontSize: 18, lineHeight: 24, color: colors.muted },
  title: { fontSize: 54, lineHeight: 55, fontWeight: "800", letterSpacing: -1.8, color: colors.fg },
  // The meters sit in the middle of whatever height is left under the name.
  detail: { flexGrow: 1, justifyContent: "center", gap: 30 },
  tags: { fontSize: 15, lineHeight: 21, color: colors.muted, fontWeight: fontWeight.medium },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14, gap: 14 },
  go: { minHeight: 56 },
});
