import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../components";

export default function TripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <PlaceholderScreen title="Trip" description={`The group, picks that suit everyone, and the shortlist. (${tripId})`} back />;
}
