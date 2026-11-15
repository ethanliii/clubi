import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import { Button, Chip, ProfileView, Screen, Skeleton, Text } from "../../components";

/** My profile. UI-SPEC §8. */
export default function ProfileScreen() {
  const profile = useQuery(api.profile.get, {});
  const { signOut } = useAuthActions();
  return (
    <Screen>
      <Text variant="heading">Profile</Text>
      {profile === undefined ? <Skeleton height={300} /> : profile === null ? <Text muted>Not signed in</Text> : <ProfileView profile={profile} />}
      <View style={styles.chips}>
        <Chip label="Friends" onPress={() => router.push("/friends")} />
        <Chip label="My rankings" onPress={() => router.push("/rankings")} />
        <Chip label="Notifications" onPress={() => router.push("/notifications")} />
      </View>
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
