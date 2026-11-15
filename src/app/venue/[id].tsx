import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { MatchBadge, PlaceholderScreen, ScoreBadge } from "../../components";
import { getVenue } from "../../data/mock";

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const venue = getVenue(id);
  if (!venue) return <PlaceholderScreen title="Venue not found" description={`No sample venue with id ${id}.`} back />;

  return (
    <PlaceholderScreen
      title={venue.name}
      description={`${venue.type} · ${venue.area} · ${venue.dist}. Photos, tonight's lineup, score breakdown, and friend reviews go here.`}
      back
    >
      <View style={styles.badges}>
        <MatchBadge match={venue.match} size="lg" />
        <ScoreBadge score={venue.avg} size="lg" />
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", gap: 10 },
});
