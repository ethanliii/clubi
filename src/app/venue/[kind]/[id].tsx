import { useLocalSearchParams } from "expo-router";
import { EmptyState, Header, Screen, goBack } from "../../../components";
import { VenuePage } from "../../../features/venue/VenuePage";

/** A place or event page: `/venue/place/<id>` or `/venue/event/<id>`. */
export default function VenueScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  if ((kind !== "place" && kind !== "event") || !id) {
    return (
      <Screen>
        <Header />
        <EmptyState title="This place is no longer listed" actionLabel="Back" onAction={goBack} />
      </Screen>
    );
  }
  // The key gives every venue its own fresh page, also when one venue links to another.
  return <VenuePage key={`${kind}:${id}`} kind={kind} id={id} />;
}
