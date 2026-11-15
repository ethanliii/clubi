import { useLocalSearchParams } from "expo-router";
import { MatchBadge, PlaceholderScreen } from "../../components";
import { getFriend } from "../../data/mock";

export default function FriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friend = getFriend(id);
  if (!friend) return <PlaceholderScreen title="Friend not found" description={`No sample friend with id ${id}.`} back />;

  return (
    <PlaceholderScreen
      title={friend.name}
      description={friend.detail?.bio ?? "Taste-match breakdown, recent nights, and top spots go here."}
      back
      links={[{ label: `Compare rankings with ${friend.name.split(" ")[0]}`, href: "/compare" }]}
    >
      <MatchBadge match={friend.agree} size="lg" />
    </PlaceholderScreen>
  );
}
