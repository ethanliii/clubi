import { PlaceholderScreen } from "../../components";
import { paths } from "../../lib/links";

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Profile"
      description="Your taste, your counts and your ranked lists."
      links={[
        { label: "My rankings", href: paths.rankings },
        { label: "Friends", href: paths.friends },
        { label: "Saved", href: paths.saved },
        { label: "Following", href: paths.following },
        { label: "Trips", href: paths.trips },
        { label: "Notifications", href: paths.notifications },
        { label: "Settings", href: paths.settings },
      ]}
    />
  );
}
