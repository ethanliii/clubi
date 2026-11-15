import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  EmptyState,
  Header,
  ScoreBadge,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Text,
  goBack,
} from "../../components";
import { FriendButton } from "../../features/friends";
import { DualMeter, RankedRow } from "../../features/profile";
import { api, type CompareResult, type Id } from "../../lib/api";
import { categoryLabel } from "../../lib/format";
import { userPath, venuePath } from "../../lib/links";
import { colors, fontWeight, radius, spacing } from "../../theme";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function SharedRow({ item, theirName }: { item: CompareResult["shared"][number]; theirName: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={() => router.push(venuePath(item.kind, item.id))}
      style={({ pressed }) => [styles.sharedRow, pressed && styles.pressed]}
    >
      <View style={styles.sharedText}>
        <Text numberOfLines={1} style={styles.sharedName}>
          {item.name}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {categoryLabel(item.category)}
        </Text>
      </View>
      <View style={styles.score}>
        <Text variant="caption" muted>
          You
        </Text>
        <ScoreBadge score={item.myScore} />
      </View>
      <View style={styles.score}>
        <Text variant="caption" muted numberOfLines={1}>
          {theirName}
        </Text>
        <ScoreBadge score={item.theirScore} />
      </View>
    </Pressable>
  );
}

/** Why there is nothing to compare: the person is gone, it is me, or we are not friends yet. */
function NoCompare({ userId }: { userId: Id<"users"> }) {
  const profile = useQuery(api.profile.get, { userId });
  if (profile === undefined) return <SkeletonRows count={4} avatar={false} />;
  if (profile === null) {
    return <EmptyState icon="user" title="This person isn't on clubi anymore" actionLabel="Back" onAction={goBack} />;
  }
  if (profile.user.isMe) {
    return <EmptyState icon="user" title="That's you" body="Open a friend's profile to compare tastes." actionLabel="Back" onAction={goBack} />;
  }
  const { user } = profile;
  return (
    <>
      <EmptyState
        icon="lock"
        title={`Add ${user.displayName} as a friend to compare tastes`}
        body="Comparing shows each other's scores, so it is for friends only."
      />
      <FriendButton userId={user.userId} displayName={user.displayName} status={user.status} requestId={user.requestId} />
      <Button
        title="View profile"
        accessibilityLabel="View profile"
        variant="ghost"
        onPress={() => router.replace(userPath(user.userId))}
      />
    </>
  );
}

/** How my taste lines up with a friend's, from `api.profile.compare`. Every number here is the backend's. */
export default function CompareScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = params.userId as Id<"users">;
  const result = useQuery(api.profile.compare, { userId });

  if (result === undefined) {
    return (
      <Screen>
        <Header title="Compare tastes" />
        <Skeleton height={120} round={radius.xl} />
        <Skeleton height={190} round={radius.xl} />
        <SkeletonRows count={4} avatar={false} />
      </Screen>
    );
  }
  if (result === null) {
    return (
      <Screen>
        <Header title="Compare tastes" />
        <NoCompare userId={userId} />
      </Screen>
    );
  }

  const { me, them } = result;
  const theirName = firstName(them.displayName);

  return (
    <Screen>
      <Header title={`You and ${theirName}`} />

      <View style={styles.hero}>
        <View style={styles.faces}>
          <Avatar name={me.displayName} uri={me.avatarUrl} size={56} />
          <Avatar name={them.displayName} uri={them.avatarUrl} size={56} style={styles.overlap} />
        </View>
        <Text variant="heading" center>{`${result.tasteMatchPct}% taste match`}</Text>
        {result.agreePct !== undefined ? (
          <Text muted center>{`You agree on ${result.agreePct}% of the places you both ranked`}</Text>
        ) : null}
        <Text center>{result.summary}</Text>
      </View>

      {result.dims.length > 0 ? (
        <View style={styles.card}>
          <Text variant="label">Taste</Text>
          {result.dims.map((dim) => (
            <DualMeter key={dim.label} label={dim.label} me={dim.me} them={dim.them} theirName={theirName} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Both ranked" count={result.shared.length > 0 ? result.shared.length : undefined} />
        {result.shared.length === 0 ? (
          <Text muted>You haven&apos;t ranked any of the same places yet</Text>
        ) : (
          <View>
            {result.shared.map((item) => (
              <SharedRow key={`${item.kind}-${item.id}`} item={item} theirName={theirName} />
            ))}
          </View>
        )}
      </View>

      {result.theirTopNewToMe.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={`${theirName}'s favorites you haven't ranked`} />
          <View>
            {result.theirTopNewToMe.map((item) => (
              <RankedRow key={item.rankingId} item={item} showPosition={false} subtitle={categoryLabel(item.category)} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  faces: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
  overlap: { marginLeft: -14, borderWidth: 3, borderColor: colors.surface },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  section: { gap: spacing.xs },
  sharedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  sharedText: { flex: 1, gap: 2 },
  sharedName: { fontSize: 15, fontWeight: fontWeight.semibold },
  score: { alignItems: "center", gap: 2, maxWidth: 64 },
});
