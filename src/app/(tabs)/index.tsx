import { Link, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, MatchBadge, Screen, Text, VenuePhoto } from "../../components";
import { getFriend, TASTE_TWINS_NEARBY, venues } from "../../data/mock";
import { colors, radius, spacing } from "../../theme";

export default function Home() {
  return (
    <Screen>
      <View style={styles.between}>
        <View>
          <Text variant="label">Palo Alto · Fri</Text>
          <Text variant="heading">Tonight</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push("/notifications")}
          style={styles.iconButton}
        >
          <Icon name="bell" size={18} color={colors.fg} />
        </Pressable>
      </View>

      <Link href="/plan" asChild>
        <Pressable style={styles.banner}>
          <View style={styles.flex}>
            <Text variant="title">Plan my night</Text>
            <Text variant="caption" muted>
              Tell us the vibe, get a full plan
            </Text>
          </View>
          <View style={[styles.iconButton, { backgroundColor: colors.accent }]}>
            <Icon name="spark" size={18} color={colors.white} />
          </View>
        </Pressable>
      </Link>

      <View style={styles.between}>
        <Text variant="title">Top picks for you</Text>
        <Text variant="caption" muted>
          Based on {TASTE_TWINS_NEARBY} taste twins
        </Text>
      </View>

      {venues.slice(0, 3).map((venue) => (
        <Link key={venue.id} href={{ pathname: "/venue/[id]", params: { id: venue.id } }} asChild>
          <Pressable style={styles.card}>
            <VenuePhoto hue={venue.hue} height={170} style={styles.cardPhoto} />
            <View style={styles.cardMeta}>
              <View style={styles.between}>
                <Text variant="title">{venue.name}</Text>
                <MatchBadge match={venue.match} />
              </View>
              <View style={styles.between}>
                <Text muted>
                  {venue.type} · {venue.area} · {venue.dist}
                </Text>
                <View style={styles.avatars}>
                  {venue.friendIds.slice(0, 3).map((id, index) => {
                    const friend = getFriend(id);
                    if (!friend) return null;
                    return (
                      <View
                        key={id}
                        style={[
                          styles.avatar,
                          { backgroundColor: `hsl(${friend.hue}, 55%, 42%)`, marginLeft: index ? -9 : 0 },
                        ]}
                      >
                        <Text style={styles.avatarText}>{friend.initials}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  flex: { flex: 1, gap: 2 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.accentSoft,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden" },
  cardPhoto: { borderRadius: 0 },
  cardMeta: { paddingVertical: spacing.md, paddingHorizontal: 14, gap: 6 },
  avatars: { flexDirection: "row" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, lineHeight: 13, fontWeight: "600", color: colors.white },
});
