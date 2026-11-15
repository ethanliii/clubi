import { PlaceholderScreen } from "../../components";

export default function FeedScreen() {
  return (
    <PlaceholderScreen
      title="Friends"
      description="Photo feed of what your friends rated, with reactions and settle-it callouts."
      links={[{ label: "Friends & taste matches", href: "/friends" }, { label: "Alex Chen", href: { pathname: "/friend/[id]", params: { id: "0" } } }]}
    />
  );
}
