import { Text } from "../../components";
import { formatScore } from "../../lib/format";

type MemberScore = { userId: string; displayName: string; score: number };

/**
 * "You 9.0 · Bryan 7.8": each person's own score for a place, exactly as the backend sent them.
 * Draws nothing for a group of one, because that one score is already the badge on the card.
 */
export function MemberScores({ scores, meId }: { scores: MemberScore[]; meId: string | undefined }) {
  if (scores.length < 2) return null;
  const line = scores
    .map((member) => {
      const name = member.userId === meId ? "You" : member.displayName.split(" ")[0];
      return `${name} ${formatScore(member.score)}`;
    })
    .join(" · ");
  return (
    <Text variant="caption" muted accessibilityLabel={`Scores: ${line}`}>
      {line}
    </Text>
  );
}
