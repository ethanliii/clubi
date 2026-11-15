import { PlaceholderScreen } from "../components";

export default function FriendsScreen() {
  return (
    <PlaceholderScreen
      title="Friends"
      description="Your friends and how closely your taste matches theirs."
      back
      links={[{ label: "Alex Chen", href: { pathname: "/friend/[id]", params: { id: "0" } } }]}
    />
  );
}
