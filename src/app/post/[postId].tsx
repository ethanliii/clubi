import { useLocalSearchParams } from "expo-router";
import { PlaceholderScreen } from "../../components";

export default function PostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <PlaceholderScreen title="Post" description={`One post with its comments. (${postId})`} back />;
}
