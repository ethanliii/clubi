import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../components";

export default function UserScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <PlaceholderScreen title="Profile" description={`A person's taste, rankings and recent posts. (${userId})`} back />;
}
