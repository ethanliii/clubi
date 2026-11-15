import type { StyleProp, ViewStyle } from "react-native";
import { Button } from "../../components";
import { api, type Id } from "../../lib/api";
import { useMutationToast } from "../../lib/useMutationToast";

/**
 * "Follow" / "Following". The label is whatever the backend says in `following`; a tap asks
 * `api.performers.follow` for the opposite and the live query brings the new label back.
 */
export function FollowButton({
  performerId,
  following,
  style,
}: {
  performerId: Id<"performers">;
  following: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { run, pending } = useMutationToast(api.performers.follow);
  const title = following ? "Following" : "Follow";
  return (
    <Button
      title={title}
      accessibilityLabel={title}
      accessibilityState={{ selected: following, disabled: pending }}
      variant={following ? "ghost" : "primary"}
      disabled={pending}
      onPress={() => void run({ performerId, follow: !following })}
      style={style}
    />
  );
}
