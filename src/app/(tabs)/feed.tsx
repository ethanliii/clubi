import { PlaceholderScreen } from "../../components";
import { paths } from "../../lib/links";

export default function FeedScreen() {
  return (
    <PlaceholderScreen
      title="Feed"
      description="What your friends ranked, the moment they rank it, with likes and comments."
      links={[{ label: "Find friends", href: paths.friends }]}
    />
  );
}
