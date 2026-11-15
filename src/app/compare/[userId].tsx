import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../components";

export default function CompareScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <PlaceholderScreen title="Compare tastes" description={`How your taste lines up with theirs. (${userId})`} back />;
}
