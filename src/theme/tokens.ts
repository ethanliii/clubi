export const colors = {
  page: "#ececef",
  bg: "#ffffff",
  surface: "#f4f4f6",
  raised: "#ebebef",
  line: "#e2e2e7",
  fg: "#111114",
  muted: "#6d6d78",
  accent: "#0c6b68",
  accentSoft: "#e2f1f0",
  mid: "#d99a00",
  low: "#8f8f9a",
  ok: "#12a150",
  white: "#ffffff",
  black: "#000000",
} as const;

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
export const palette = {
  /** A filled control resting on the page: inputs, secondary buttons, unselected chips. */
  field: "#f3f3f5",
  fieldPressed: "#e8e8ec",
  /** A hairline that is quieter than `colors.line`, for dividers between rows. */
  hairline: "rgba(17,17,20,0.08)",
  /** Second-level text: readable, but clearly below the title. */
  soft: "#3d3d46",
  danger: "#d92d20",
  dangerSoft: "#fdeae8",
  onPhoto: "#ffffff",
  onPhotoMuted: "rgba(255,255,255,0.78)",
  /** White glass behind a control that floats on a photo or the map. */
  glass: "rgba(255,255,255,0.92)",
  backdrop: "rgba(0,0,0,0.38)",
} as const;

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

/** Shadows, soft enough for a white page. Spread one into a style. */
export const elevation = {
  none: {},
  card: { shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  floating: { shadowColor: "#000000", shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
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
