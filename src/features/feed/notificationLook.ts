import type { IconName } from "../../components";
import type { NotificationItem } from "../../lib/api";
import { colors, ratingColors } from "../../theme";

export type NotificationLook = {
  icon: IconName;
  /** The icon's color. */
  tint: string;
  /** What kind of news this is, in two or three words. The sentence itself is the backend's `title` and `body`. */
  kind: string;
};

const LOOKS: Record<NotificationItem["type"], NotificationLook> = {
  friend_posted: { icon: "star", tint: colors.mid, kind: "New ranking" },
  friend_ranked_same: { icon: "users", tint: colors.mid, kind: "You both ranked it" },
  event_tonight: { icon: "calendar", tint: colors.accent, kind: "Tonight" },
  artist_event: { icon: "music", tint: colors.accent, kind: "Artist alert" },
  friend_request: { icon: "user", tint: ratingColors.good, kind: "Friend request" },
  friend_accepted: { icon: "check", tint: colors.ok, kind: "New friend" },
  trip_invite: { icon: "navigate", tint: ratingColors.okay, kind: "Trip invite" },
  trip_update: { icon: "map", tint: ratingColors.okay, kind: "Trip update" },
  post_reaction: { icon: "heartFilled", tint: colors.accent, kind: "Like" },
  post_comment: { icon: "comment", tint: colors.fg, kind: "Comment" },
};

const FALLBACK: NotificationLook = { icon: "bell", tint: colors.muted, kind: "Update" };

/** The icon, color and short kind label for a notification type. A type this app does not know yet gets a bell. */
export function notificationLook(type: string): NotificationLook {
  return (LOOKS as Record<string, NotificationLook | undefined>)[type] ?? FALLBACK;
}
