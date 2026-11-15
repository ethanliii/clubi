import { Text } from "../../components";
import { formatScore } from "../../lib/format";
import { fontWeight, ratingColor } from "../../theme";

type MemberScore = { userId: string; displayName: string; score: number };

/**
 * "You 9.0 · Bryan 7.8": each person's own score for a place, exactly as the backend sent them,
 * with the number in its colour on the rating scale.
 * Draws nothing for a group of one, because that one score is already the badge on the card.
 */
export function MemberScores({ scores, meId }: { scores: MemberScore[]; meId: string | undefined }) {
  if (scores.length < 2) return null;
  const parts = scores.map((member) => ({
    userId: member.userId,
    name: member.userId === meId ? "You" : member.displayName.split(" ")[0],
    score: member.score,
  }));
  const line = parts.map((part) => `${part.name} ${formatScore(part.score)}`).join(" · ");
  return (
    <Text variant="caption" muted accessibilityLabel={`Scores: ${line}`}>
      {parts.map((part, index) => (
        <Text key={part.userId} variant="caption" muted>
          {`${index > 0 ? " · " : ""}${part.name} `}
          <Text variant="caption" style={{ fontWeight: fontWeight.bold, color: ratingColor(part.score) }}>
            {formatScore(part.score)}
          </Text>
        </Text>
      ))}
    </Text>
  );
}
