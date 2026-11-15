import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton, EmptyState, ProfileView, Screen, Skeleton } from "../../components/bryan";

/** Someone else's profile. Private accounts show only the header until you're friends (Q20). */
export default function UserProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const profile = useQuery(api.profile.get, { userId: userId as Id<"users"> });
  return (
    <Screen>
      <BackButton />
      {profile === undefined ? (
        <Skeleton height={300} />
      ) : profile === null ? (
        <EmptyState text="This person isn't on Clubi anymore" />
      ) : (
        <ProfileView profile={profile} />
      )}
    </Screen>
  );
}
