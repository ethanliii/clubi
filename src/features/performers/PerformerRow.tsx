import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "../../components";
import type { PerformerCard } from "../../lib/api";
import { formatEventTime, formatScore } from "../../lib/format";
import { performerPath, venuePath } from "../../lib/links";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { FollowButton } from "./FollowButton";

const AVATAR = 60;

/** "EDM · House · You rate them 9.2" from the card's genres and affinity. */
export function performerFacts(performer: PerformerCard): string {
  return [
    ...performer.genres.slice(0, 2),
    performer.affinity === undefined ? "" : `You rate them ${formatScore(performer.affinity)}`,
  ]
    .filter((part) => part !== "")
    .join(" · ");
}

/**
 * One artist in a list. The name opens their page, the next show's line opens that event,
 * and the button follows or unfollows.
 */
export function PerformerRow({ performer, now }: { performer: PerformerCard; now: number }) {
  const facts = performerFacts(performer);
  const next = performer.nextEvent;
  const nextLine = next ? [formatEventTime(next.startsAt, now), next.venueName ?? next.title].join(" · ") : null;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${performer.name}'s page`}
        onPress={() => router.push(performerPath(performer.performerId))}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar name={performer.name} uri={performer.imageUrl} size={AVATAR} style={styles.avatar} />
      </Pressable>
      <View style={styles.main}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={performer.name}
          onPress={() => router.push(performerPath(performer.performerId))}
          style={({ pressed }) => [styles.who, pressed && styles.pressed]}
        >
          <Text numberOfLines={2} style={styles.name}>
            {performer.name}
          </Text>
          {facts ? (
            <Text muted numberOfLines={1} style={styles.facts}>
              {facts}
            </Text>
          ) : null}
        </Pressable>
        {next && nextLine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next: ${nextLine}`}
            hitSlop={8}
            onPress={() => router.push(venuePath("event", next.id))}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={styles.nextText}>
              {nextLine}
            </Text>
          </Pressable>
        ) : (
          <Text muted numberOfLines={1} style={styles.facts}>
            No dates nearby yet
          </Text>
        )}
      </View>
      <FollowButton performerId={performer.performerId} following={performer.following} style={styles.follow} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  avatar: { borderWidth: 0 },
  main: { flex: 1, gap: 1 },
  who: { gap: 1 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  facts: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.6 },
  next: { minHeight: 22, justifyContent: "center" },
  nextText: { fontSize: 13, lineHeight: 18, color: colors.mid, fontWeight: fontWeight.semibold },
  follow: { width: "auto", minWidth: 96, minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill },
});
