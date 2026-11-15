import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Button, Icon, ProfileView, Screen, Skeleton, Text, type IconName } from "../../components/bryan";
import { paths, rankingsPath } from "../../lib/links";
import { colors, radius } from "../../theme";

// Same links + labels as main's profile (Friends, Saved, Following, Trips), plus My rankings / Notifications.
const LINKS: { label: string; icon: IconName; href: Parameters<typeof router.push>[0] }[] = [
  { label: "Friends", icon: "users", href: paths.friends },
  { label: "Saved", icon: "bookmark", href: paths.saved },
  { label: "Following", icon: "music", href: paths.following },
  { label: "Trips", icon: "calendar", href: paths.trips },
  { label: "My rankings", icon: "check", href: rankingsPath() },
  { label: "Notifications", icon: "bell", href: paths.notifications },
];

/** My profile. UI-SPEC §8. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const { signOut } = useAuthActions();
  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="heading">Profile</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push(paths.settings)} style={styles.gear} hitSlop={8}>
          <Icon name="gear" size={20} color={colors.fg} />
        </Pressable>
      </View>
      {profile === undefined ? <Skeleton height={300} /> : profile === null ? <Text muted>Not signed in</Text> : <ProfileView profile={profile} />}
      <View style={styles.links}>
        {LINKS.map((l) => (
          <Pressable key={l.label} accessibilityRole="button" accessibilityLabel={l.label} onPress={() => router.push(l.href)} style={styles.link}>
            <Icon name={l.icon} size={18} color={colors.fg} />
            <Text style={{ fontWeight: "600" }}>{l.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  gear: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  link: { flexDirection: "row", alignItems: "center", gap: 8, width: "48.5%", paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: colors.surface },
});
