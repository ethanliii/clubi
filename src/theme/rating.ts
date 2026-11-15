export const ratingColors = {
  great: "#22c55e",
  good: "#a3e635",
  okay: "#facc15",
  poor: "#fb923c",
  bad: "#ef4444",
} as const;

export function ratingColor(score: number): string {
  if (score >= 8.5) return ratingColors.great;
  if (score >= 7.5) return ratingColors.good;
  if (score >= 6.5) return ratingColors.okay;
  if (score >= 5) return ratingColors.poor;
  return ratingColors.bad;
}

export type MatchTier = "hi" | "mid" | "lo";

export function matchTier(match: number): MatchTier {
  if (match >= 85) return "hi";
  if (match >= 75) return "mid";
  return "lo";
}
