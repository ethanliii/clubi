import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Chip,
  ChipRow,
  EmptyState,
  goBack,
  Header,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRows,
  Text,
} from "../../components";
import { FollowButton } from "../../features/performers/FollowButton";
import { api, type Id } from "../../lib/api";
import { formatEventTime, formatScore } from "../../lib/format";
import { venuePath } from "../../lib/links";
import { useNow } from "../../lib/useNow";
import { colors, spacing } from "../../theme";

export default function PerformerScreen() {
  const { performerId } = useLocalSearchParams<{ performerId: string }>();
  const performer = useQuery(api.performers.get, { performerId: performerId as Id<"performers"> });
  const now = useNow();

  if (performer === undefined) {
    return (
      <Screen>
        <Header title="" />
        <View style={styles.top}>
          <Skeleton width={96} height={96} round={48} />
          <View style={styles.topText}>
            <Skeleton width="70%" height={18} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
        <Skeleton height={48} />
        <SkeletonRows count={3} avatar={false} />
      </Screen>
    );
  }
  if (performer === null) {
    return (
      <Screen>
        <Header title="Artist" />
        <EmptyState title="We couldn't find this artist." icon="music" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={performer.name} />
      <View style={styles.top}>
        <Avatar name={performer.name} uri={performer.imageUrl} size={96} />
        <View style={styles.topText}>
          {performer.genres.length > 0 ? (
            <ChipRow>
              {performer.genres.map((genre) => (
                <Chip key={genre} label={genre} size="sm" />
              ))}
            </ChipRow>
          ) : null}
          {performer.affinity !== undefined ? (
            <Text>{`You rate them ${formatScore(performer.affinity)}`}</Text>
          ) : (
            <Text muted>Rank one of their shows and your score for them shows up here.</Text>
          )}
        </View>
      </View>

      <FollowButton performerId={performer.performerId} following={performer.following} />

      <View>
        <SectionHeader title="Upcoming" />
        {performer.upcoming.length === 0 ? (
          <Text muted style={styles.none}>
            No dates nearby yet
          </Text>
        ) : (
          performer.upcoming.map((event) => (
            <ListRow
              key={event.id}
              title={[formatEventTime(event.startsAt, now), event.venueName ?? ""].filter((part) => part !== "").join(" · ")}
              subtitle={event.title}
              accessibilityLabel={`${event.title}, ${formatEventTime(event.startsAt, now)}`}
              left={<Icon name="calendar" size={20} color={colors.mid} />}
              right={<Icon name="chevron" size={16} color={colors.muted} />}
              onPress={() => router.push(venuePath("event", event.id))}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  topText: { flex: 1, gap: spacing.sm },
  none: { paddingVertical: spacing.md },
});
