import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../components";

export default function PerformerScreen() {
  const { performerId } = useLocalSearchParams<{ performerId: string }>();
  return <PlaceholderScreen title="Artist" description={`An artist and when they play near you. (${performerId})`} back />;
}
