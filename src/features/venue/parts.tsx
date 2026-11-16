import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Icon, Text, VenuePhoto, type IconName } from "../../components";
import type { Category } from "../../lib/api";
import { categoryHue } from "../../lib/format";
import { colors, fontWeight, layout, palette, ratingColor, spacing } from "../../theme";

/** The page's side margin. Everything lines up on it; photos and card rows run past it. */
export const GUTTER = layout.gutter;

/** The page background as rgba, for scrims that fade a photo into the page. */
export const pageFade = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

/** A section's heading: bigger than a card title, smaller than the page's name. */
export function SectionTitle({ children, note }: { children: string; note?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="headline" accessibilityRole="header" style={styles.sectionTitleText}>
        {children}
      </Text>
      {note ? (
        <Text muted style={styles.sectionNote}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** The score as a solid tile in its rating colour: the page's hero fact, and the corner of a photo card. */
export function ScoreTile({ score, size = 60 }: { score: number; size?: number }) {
  return (
    <View
      accessibilityLabel={`Score ${score.toFixed(1)}`}
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.28), backgroundColor: ratingColor(score) },
      ]}
    >
      <Text style={[styles.tileText, { fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5) }]}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}

/**
 * A square-cornered picture at a fixed height: the real photo when there is one and it loads,
 * otherwise the app's category look. Rounding and clipping belong to the box around it.
 */
export function Photo({
  uri,
  category,
  height,
  label,
}: {
  uri?: string | null;
  category: Category;
  height: number;
  label: string;
}) {
  return (
    <View accessibilityLabel={uri ? label : undefined}>
      <VenuePhoto hue={categoryHue(category)} category={category} uri={uri} height={height} style={styles.square} />
    </View>
  );
}

/** A dark fade laid over the bottom of a photo so text on it stays readable. */
export function Scrim({ from, to, height, style }: { from: string; to: string; height: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  return <LinearGradient pointerEvents="none" colors={[from, to]} style={[styles.scrim, { height }, style]} />;
}

type DetailIcon = IconName | "phone" | "price";

/** The two icons the details list needs that the shared set lacks, in its 24-unit, 2-wide stroke. */
function Glyph({ name, color }: { name: DetailIcon; color: string }) {
  if (name === "phone") {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }
  if (name === "price") {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={7} cy={7} r={1.4} fill={color} />
      </Svg>
    );
  }
  return <Icon name={name} size={20} color={color} />;
}

/**
 * One line of the details list: an icon, the fact, an optional quieter second line.
 * With `onPress` the whole line is a button and shows where it leads on the right.
 */
export function DetailRow({
  icon,
  title,
  subtitle,
  action,
  accessibilityLabel,
  onPress,
  last = false,
  right,
}: {
  icon: DetailIcon;
  title: string;
  subtitle?: string;
  /** Short word on the right of a pressable row ("Directions"). */
  action?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  last?: boolean;
  right?: ReactNode;
}) {
  const body = (
    <>
      <View style={styles.detailIcon}>
        <Glyph name={icon} color={colors.fg} />
      </View>
      <View style={[styles.detailBody, !last && styles.hairline]}>
        <View style={styles.detailText}>
          <Text style={styles.detailTitle}>{title}</Text>
          {subtitle ? (
            <Text muted style={styles.detailSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
        {action ? (
          <Text style={styles.detailAction}>{action}</Text>
        ) : null}
        {onPress ? <Icon name="chevron" size={14} color={colors.low} /> : null}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.detailRow}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  sectionTitleText: { flexShrink: 1 },
  sectionNote: { fontSize: 13, lineHeight: 18 },
  tile: { alignItems: "center", justifyContent: "center" },
  tileText: { color: colors.white, fontWeight: fontWeight.bold, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  square: { borderRadius: 0 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  detailRow: { flexDirection: "row", alignItems: "stretch", minHeight: 54 },
  detailIcon: { width: 36, justifyContent: "center" },
  detailBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 15 },
  detailText: { flex: 1, gap: 2 },
  detailTitle: { fontSize: 15, lineHeight: 21, fontWeight: fontWeight.medium },
  detailSubtitle: { fontSize: 13, lineHeight: 18 },
  detailAction: { color: colors.accent, fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  hairline: { borderBottomWidth: 1, borderBottomColor: palette.hairline },
  pressed: { opacity: 0.55 },
});
