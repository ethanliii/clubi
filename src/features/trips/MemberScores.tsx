import { StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import { formatScore } from "../../lib/format";
import { colors, fontWeight, ratingColor, spacing } from "../../theme";

type MemberScore = { userId: string; displayName: string; avatarUrl?: string; score: number };

/**
 * Who loves it and who is lukewarm: each person's face with their own score for the place in its
 * rating colour, exactly as the backend sent them.
 * Draws nothing for a group of one, because that one score is already the badge on the photo.
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
          <Avatar name={member.displayName} uri={member.avatarUrl} size={24} style={styles.avatar} />
          <Text numberOfLines={1} style={styles.name}>
            {nameOf(member)}
          </Text>
          <Text style={[styles.score, { color: ratingColor(member.score) }]}>{formatScore(member.score)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md + 2, rowGap: spacing.xs + 2 },
  person: { flexDirection: "row", alignItems: "center", gap: 5 },
  avatar: { borderWidth: 0 },
  name: { fontSize: 13, lineHeight: 17, color: colors.muted, maxWidth: 80 },
  score: { fontSize: 14, lineHeight: 17, fontWeight: fontWeight.bold, fontVariant: ["tabular-nums"] },
});
