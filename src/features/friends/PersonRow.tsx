import { router } from "expo-router";
import type { ReactNode } from "react";
import { Avatar, ListRow } from "../../components";
import type { UserCard } from "../../lib/api";
import { userPath } from "../../lib/links";

/** One person in a list. Tapping the row opens their profile; `right` holds the row's buttons. */
export function PersonRow({ user, subtitle, right }: { user: UserCard; subtitle?: string; right?: ReactNode }) {
  return (
    <ListRow
      title={user.displayName}
      subtitle={subtitle}
      left={<Avatar name={user.displayName} uri={user.avatarUrl} size={40} />}
      right={right}
      onPress={() => router.push(userPath(user.userId))}
    />
  );
}

/** "@albert · 3 mutual friends": the facts under a name, skipping the ones that are missing. */
export function personFacts(parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" · ");
}
