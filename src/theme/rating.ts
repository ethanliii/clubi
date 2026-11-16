export const ratingColors = {
  great: "#0f9d58",
  good: "#34a853",
  okay: "#d99a00",
  poor: "#ef8a17",
  bad: "#e5484d",
} as const;

export function ratingColor(score: number): string {
  // Beli's bands: liked it is 6.7 and up (green), fine is 3.4 to 6.6 (amber), didn't like it is below (red).
  if (score >= 8.5) return ratingColors.great;
  if (score >= 6.7) return ratingColors.good;
  if (score >= 5) return ratingColors.okay;
  if (score >= 3.4) return ratingColors.poor;
  return ratingColors.bad;
}

export type MatchTier = "hi" | "mid" | "lo";

export function matchTier(match: number): MatchTier {
  if (match >= 85) return "hi";
  if (match >= 75) return "mid";
  return "lo";
}
