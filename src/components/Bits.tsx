import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { FriendScore } from "../../convex/lib/contract";
import { colors, radius, ratingColor, spacing } from "../theme";
import { Text } from "./Text";

/** Initials from a display name ("Alex Chen" → "AC"). Display only, not data. */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

function hueOf(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, url, size = 28, ring }: { name: string; url?: string; size?: number; ring?: string }) {
  const style = [
    styles.avatar,
    { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hueOf(name)}, 55%, 42%)` },
    ring ? { borderColor: ring } : null,
  ];
  if (url) return <Image source={{ uri: url }} style={style} accessibilityLabel={name} />;
  return (
    <View style={style} accessibilityLabel={name}>
      <Text style={{ color: colors.white, fontSize: size * 0.38, lineHeight: size * 0.46, fontWeight: "700" }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({ people, size = 24 }: { people: { displayName: string; avatarUrl?: string }[]; size?: number }) {
  return (
    <View style={styles.row}>
      {people.slice(0, 3).map((p, i) => (
        <View key={p.displayName + i} style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar name={p.displayName} url={p.avatarUrl} size={size} />
        </View>
      ))}
    </View>
  );
}

/** One friend's score, or several friends' scores side by side. Never averaged in the UI. */
export function FriendScores({ friends }: { friends: FriendScore[] }) {
  if (friends.length === 0) return null;
  return (
    <View style={[styles.row, { gap: 6, flexWrap: "wrap" }]}>
      {friends.slice(0, 3).map((f) => (
        <View key={String(f.userId)} style={[styles.pill, { borderColor: ratingColor(f.score) }]}>
          <Avatar name={f.displayName} url={f.avatarUrl} size={18} />
          <Text style={[styles.pillText, { color: ratingColor(f.score) }]}>{f.score.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
}

export function Chip({
  label,
  on,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Skeleton({ height = 80, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeleton, { height }, style]} />;
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text muted center>
        {text}
      </Text>
      {action}
    </View>
  );
}

/** "350 m" / "1.2 km": formatting only. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
    paddingRight: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  pillText: { fontSize: 12, lineHeight: 15, fontWeight: "700" },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.fg, borderColor: colors.fg },
  chipText: { fontSize: 13, lineHeight: 17 },
  chipTextOn: { color: colors.bg, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden" },
  skeleton: { backgroundColor: colors.surface, borderRadius: radius.xl, opacity: 0.7 },
  empty: { paddingVertical: spacing.xxl, gap: spacing.md, alignItems: "center" },
});
