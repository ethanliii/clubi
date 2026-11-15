import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../../components";

export default function RateFlowScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  return <PlaceholderScreen title="Rank it" description={`The rank flow for one place or event: how was it, which was better, tags, post. (${kind} · ${id})`} back />;
}
