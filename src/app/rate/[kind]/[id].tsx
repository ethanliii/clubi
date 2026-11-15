import { useLocalSearchParams } from "expo-router";
import { EmptyState, Header, Screen, goBack } from "../../../components";
import { RateFlow } from "../../../features/rate/RateFlow";

/** The rank flow for one place or event: opened by "Rank this place", "Rank it too" and the "+" tab. */
export default function RateFlowScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  if ((kind !== "place" && kind !== "event") || !id) {
    return (
      <Screen>
        <Header />
        <EmptyState title="This place is no longer listed" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }
  // The key starts a fresh flow if this screen is ever shown for a different place.
  return <RateFlow key={`${kind}:${id}`} kind={kind} id={id} />;
}
