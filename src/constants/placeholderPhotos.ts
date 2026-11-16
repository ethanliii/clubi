import type { Category } from "../../convex/lib/contract";

/**
 * Stand-in photos for places and events that have no photo yet (the backend's Google Places
 * photos fill in over time). Free photos from Unsplash (Unsplash License: free to use, no
 * attribution required). Picked per item with a stable seed so a place keeps the same picture.
 * If a picture fails to load, the glow placeholder underneath shows instead.
 */
const IDS: Record<Category, string[]> = {
  nightlife: ["FrLPeW1urbQ", "5swSzW-stAA", "ubwn8GI9-2o"],
  live: ["bo8XlhXNrE8", "mGUmPLH_c5k", "ubwn8GI9-2o"],
  food: ["727R1em0tUA", "tfoRoSoSH_k", "e5pi0nt_UpI"],
  culture: ["AgKI5STbPU4", "5yPvSf3bc6g"],
  outdoors: ["tYgVCTgJdEg"],
  popup: ["e5pi0nt_UpI", "727R1em0tUA", "tfoRoSoSH_k"],
};

/** The hue each category is drawn with (both hue tables used in the app), for hue-only callers. */
const HUE_TO_CATEGORY: Record<number, Category> = {
  320: "nightlife", 25: "food", 28: "food", 265: "culture", 140: "outdoors", 150: "outdoors", 200: "live", 45: "popup", 48: "popup",
};

const url = (id: string, w: number) => `https://unsplash.com/photos/${id}/download?w=${w}`;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function placeholderPhoto(category: Category | undefined, seed: string | number = 0, width = 800): string | null {
  const ids = category ? IDS[category] : undefined;
  if (!ids || ids.length === 0) return null;
  return url(ids[hash(String(seed)) % ids.length]!, width);
}

export function categoryForHue(hue: number): Category | undefined {
  return HUE_TO_CATEGORY[hue];
}
