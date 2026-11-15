export const colors = {
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
