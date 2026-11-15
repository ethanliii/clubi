import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../../components";

export default function VenueScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  return <PlaceholderScreen title="Venue" description={`Everything about one place or event, and the way into ranking it. (${kind} · ${id})`} back />;
}
