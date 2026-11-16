import { StyleSheet, View } from "react-native";
import { Avatar, ScoreBadge, Text } from "../../components";
import { formatScore } from "../../lib/format";
import { colors, spacing } from "../../theme";

type MemberScore = { userId: string; displayName: string; avatarUrl?: string; score: number };

/**
 * Who loves it and who is lukewarm: each person's face with their own score for the place in its
 * rating colour, exactly as the backend sent them.
 * Draws nothing for a group of one, because that one score is already the ring beside the name.
 */
export function MemberScores({ scores, meId }: { scores: MemberScore[]; meId: string | undefined }) {
  if (scores.length < 2) return null;
  return <ScoreFaces scores={scores} meId={meId} />;
}

/** The same row for any list of people and scores (friends who ranked a place, say). */
export function ScoreFaces({ scores, meId }: { scores: MemberScore[]; meId?: string }) {
  if (scores.length === 0) return null;
  const nameOf = (member: MemberScore) => (member.userId === meId ? "You" : member.displayName.split(" ")[0]);
  const line = scores.map((member) => `${nameOf(member)} ${formatScore(member.score)}`).join(" · ");
  return (
    <View accessibilityLabel={`Scores: ${line}`} style={styles.row}>
      {scores.map((member) => (
        <View key={member.userId} style={styles.person}>
          <Avatar name={member.displayName} uri={member.avatarUrl} size={22} style={styles.avatar} />
          <Text numberOfLines={1} style={styles.name}>
            {nameOf(member)}
          </Text>
          <ScoreBadge score={member.score} size="sm" variant="plain" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md, rowGap: spacing.xs },
  person: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 24 },
  avatar: { borderWidth: 0 },
  name: { fontSize: 13, lineHeight: 17, color: colors.muted, maxWidth: 80 },
});
