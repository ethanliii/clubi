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
import { colors, fontWeight, layout, palette, radius } from "../../theme";

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
      <StatusBar style="dark" />
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
          <Rise delay={480} from={18}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.section}>Your taste</Text>
                <Text variant="caption" muted>
                  From your answers
                </Text>
              </View>
              <TasteMeters meters={meters} highlight={headline.top} startDelay={650} />
              {tags.length > 0 ? (
                <Rise delay={1400}>
                  <View style={styles.into}>
                    <Text style={styles.section}>{"You're into"}</Text>
                    <View accessible accessibilityLabel={`Into ${listOf(tags)}`} style={styles.tags}>
                      {tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Rise>
              ) : null}
            </View>
          </Rise>
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

const SIDE = layout.gutter;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SIDE, paddingTop: 40, paddingBottom: 20, gap: 26 },
  name: { gap: 8 },
  lead: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  title: { fontSize: 36, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: colors.fg },
  // No box: the meters sit straight on the page under a small uppercase label, like every other section.
  card: { gap: 20, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  section: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold, letterSpacing: 1, textTransform: "uppercase", color: colors.fg },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  into: { gap: 14, marginTop: 6, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: palette.field, justifyContent: "center" },
  tagText: { fontSize: 14, lineHeight: 18, fontWeight: fontWeight.bold, color: colors.fg },
  footer: { paddingHorizontal: SIDE, paddingTop: 8, paddingBottom: 14, gap: 12 },
  go: { minHeight: 54 },
});
