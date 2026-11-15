import { colors } from "./tokens";

/**
 * Palette for the Hinge-style sign-up + taste quiz.
 * The app is dark-only (app.json userInterfaceStyle "dark"), so onboarding follows the dark theme too.
 * `ONBOARDING_LIGHT` is the original cream look, kept for when the app gets a light theme.
 */
export const ONBOARDING_DARK = {
  bg: colors.bg,
  card: colors.surface,
  line: colors.line,
  fg: colors.fg,
  muted: colors.muted,
  raised: colors.raised,
  onFg: colors.bg, // text/icons sitting on an fg-colored button
  off: "#4a4356", // disabled button
  starOff: "#4a4356",
} as const;

export const ONBOARDING_LIGHT = {
  bg: "#f5f3ee",
  card: "#ffffff",
  line: "#dedbd3",
  fg: "#16151a",
  muted: "#7a7680",
  raised: "#ecebe6",
  onFg: "#ffffff",
  off: "#c4c1b9",
  starOff: "#d6d2c9",
} as const;

export const onboardingColors = ONBOARDING_DARK;
