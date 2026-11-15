import { router } from "expo-router";
import { EmptyState, Screen } from "../components";
import { paths } from "../lib/links";

export default function NotFoundScreen() {
  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <EmptyState
        icon="map"
        title="This page doesn't exist"
        body="The link may be old, or the thing it pointed to is gone."
        actionLabel="Go home"
        onAction={() => router.replace(paths.home)}
      />
    </Screen>
  );
}
