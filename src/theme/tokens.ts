import { Platform } from "react-native";
import { isLight } from "./mode";

const DARK = {
  page: "#0b0a0f",
  bg: "#141119",
  surface: "#1e1a26",
  raised: "#272231",
  line: "#2f2a3a",
  fg: "#f2eef7",
  muted: "#9a92a9",
  accent: "#ff4f9a",
  accentSoft: "#3b1a2c",
  mid: "#ffb547",
  low: "#6f687c",
  ok: "#4fd08f",
  white: "#ffffff",
  black: "#000000",
};

/** Bryan's light theme (same values as the prototype's light mode). */
const LIGHT: typeof DARK = {
  page: "#efede8",
  bg: "#faf9f6",
  surface: "#ffffff",
  raised: "#f0eee9",
  line: "#e3e0d9",
  fg: "#1b1a1f",
  muted: "#7a7680",
  accent: "#e8457f",
  accentSoft: "#fde4ee",
  mid: "#f0a32e",
  low: "#9a96a0",
  ok: "#2fae6e",
  white: "#ffffff",
  black: "#000000",
};

/** The colors for the mode picked at startup (see theme/mode.ts). */
export const colors = isLight ? LIGHT : DARK;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
  pill: 999,
} as const;

export const fontSize = {
  label: 10.5,
  caption: 12,
  body: 14,
  bodyLg: 16,
  title: 17,
  heading: 26,
  display: 40,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

// ---------------------------------------------------------------------------------------------
// Added for the design-system pass. Everything above is unchanged; everything below is additive.
// ---------------------------------------------------------------------------------------------

/** Extra colours: quiet fills, the destructive red, and text that sits on photos. */
const PALETTE_DARK = {
  /** A filled control resting on the page: inputs, secondary buttons, unselected chips. */
  field: "#1d1924",
  fieldPressed: "#28222f",
  /** A hairline that is quieter than `colors.line`, for dividers between rows. */
  hairline: "rgba(255,255,255,0.07)",
  /** Second-level text: readable, but clearly below the title. */
  soft: "#c9c2d6",
  danger: "#ff6b6b",
  dangerSoft: "#3a1a22",
  onPhoto: "#ffffff",
  onPhotoMuted: "rgba(255,255,255,0.78)",
  /** Dark glass behind a control that floats on a photo or the map. */
  glass: "rgba(12,10,16,0.62)",
  backdrop: "rgba(0,0,0,0.6)",
};

const PALETTE_LIGHT: typeof PALETTE_DARK = {
  field: "#f0eee9",
  fieldPressed: "#e6e3dc",
  hairline: "rgba(0,0,0,0.07)",
  soft: "#4a4652",
  danger: "#d64545",
  dangerSoft: "#fde4e4",
  onPhoto: "#ffffff",
  onPhotoMuted: "rgba(255,255,255,0.85)",
  glass: "rgba(250,249,246,0.86)",
  backdrop: "rgba(0,0,0,0.4)",
};

export const palette = isLight ? PALETTE_LIGHT : PALETTE_DARK;

/** The type scale. `Text` variants use these; reach for a variant before a raw size. */
export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: "800", letterSpacing: -1.2 },
  heading: { fontSize: 30, lineHeight: 35, fontWeight: "800", letterSpacing: -0.6 },
  headline: { fontSize: 21, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "700", letterSpacing: -0.2 },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: "400", letterSpacing: -0.1 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: "400", letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 17, fontWeight: "500", letterSpacing: 0 },
} as const;

/** Page gutters and the vertical rhythm between sections. */
export const layout = {
  gutter: 18,
  section: 28,
  /** The smallest thing a thumb can hit. */
  tap: 44,
  rowThumb: 64,
} as const;

/** Shadows. Spread one into a style; on a dark page they mostly matter over photos and the map. */
export const elevation = {
  none: {},
  card: { shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  floating: { shadowColor: "#000000", shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const;

/** Gradient stops for text on photos. Pass to `LinearGradient` as `colors` and `locations`. */
export const scrim = {
  /** Text along the bottom edge of a photo. */
  bottom: { colors: ["rgba(8,7,11,0)", "rgba(8,7,11,0.35)", "rgba(8,7,11,0.88)"], locations: [0.35, 0.62, 1] },
  /** A tall hero whose lower half carries a title and a line or two. */
  hero: { colors: ["rgba(8,7,11,0.25)", "rgba(8,7,11,0)", "rgba(8,7,11,0.55)", "rgba(8,7,11,0.94)"], locations: [0, 0.3, 0.68, 1] },
  /** Controls along the top edge (back, share). */
  top: { colors: ["rgba(8,7,11,0.6)", "rgba(8,7,11,0)"], locations: [0, 1] },
} as const;

/** How long things take to fade or press. */
export const motion = { fast: 120, base: 220, slow: 360 } as const;

/** The serif used for the wordmark only (main's screens). Spread into a text style. */
export const wordmark = {
  fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" }),
  fontWeight: "700",
  letterSpacing: -0.6,
} as const;

/** Post layout sizes used by main's feed pieces. */
export const feed = { avatar: 60, scoreRing: 44, iconSize: 26 } as const;
