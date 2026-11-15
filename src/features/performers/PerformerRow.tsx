import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Icon, Text } from "../../components";
import type { PerformerCard } from "../../lib/api";
import { formatEventTime, formatScore } from "../../lib/format";
import { performerPath, venuePath } from "../../lib/links";
import { colors, fontWeight, spacing } from "../../theme";
import { FollowButton } from "./FollowButton";

const AVATAR = 44;

/** "EDM · House · You rate them 9.2" from the card's genres and affinity. */
export function performerFacts(performer: PerformerCard): string {
  return [
    ...performer.genres.slice(0, 3),
    performer.affinity === undefined ? "" : `You rate them ${formatScore(performer.affinity)}`,
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * One artist in a list. The name opens their page, "Next: …" opens that event,
 * and the button follows or unfollows.
 */
export function PerformerRow({ performer, now }: { performer: PerformerCard; now: number }) {
  const facts = performerFacts(performer);
  const next = performer.nextEvent;
  const nextLine = next
    ? `Next: ${[formatEventTime(next.startsAt, now), next.venueName ?? next.title].join(" · ")}`
    : null;
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={performer.name}
          onPress={() => router.push(performerPath(performer.performerId))}
          style={({ pressed }) => [styles.who, pressed && styles.pressed]}
        >
          <Avatar name={performer.name} uri={performer.imageUrl} size={AVATAR} />
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.name}>
              {performer.name}
            </Text>
            {facts ? (
              <Text variant="caption" muted numberOfLines={1}>
                {facts}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {next && nextLine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextLine}
            hitSlop={6}
            onPress={() => router.push(venuePath("event", next.id))}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Icon name="calendar" size={14} color={colors.mid} />
            <Text variant="caption" numberOfLines={1} style={styles.nextText}>
              {nextLine}
            </Text>
          </Pressable>
        ) : (
          <Text variant="caption" muted style={styles.noDates}>
            No dates nearby yet
          </Text>
        )}
      </View>
      <FollowButton performerId={performer.performerId} following={performer.following} style={styles.follow} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  main: { flex: 1 },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: fontWeight.semibold },
  pressed: { opacity: 0.6 },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    minHeight: 32,
    marginLeft: AVATAR + spacing.md,
  },
  nextText: { flex: 1, color: colors.mid, fontWeight: fontWeight.semibold },
  noDates: { marginLeft: AVATAR + spacing.md, paddingBottom: spacing.xs },
  follow: { width: "auto", minWidth: 104, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
});
