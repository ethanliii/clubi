import { PlaceholderScreen } from "../../components";
import { paths } from "../../lib/links";

export default function RateScreen() {
  return (
    <PlaceholderScreen
      title="Rate a spot"
      description="Pick a spot: search or choose a nearby place, then rank it."
      links={[{ label: "My rankings", href: paths.rankings }]}
    />
  );
}
