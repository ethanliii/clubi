import { PlaceholderScreen } from "../../components";

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="My profile"
      description="Your taste card, recap stats, rankings, photos, and badges."
      links={[{ label: "My rankings", href: "/rankings" }, { label: "Friends & taste matches", href: "/friends" }, { label: "Compare rankings", href: "/compare" }, { label: "Notifications", href: "/notifications" }, { label: "Moments (account and backend demo)", href: "/moments" }]}
    />
  );
}
