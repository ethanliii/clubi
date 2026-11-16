/**
 * The group map's own vocabulary: which group is on the map (a saved plan, or friends picked for
 * this look only), how that is written in the address, and the words for how much a group agrees.
 */
import type { Href } from "expo-router";
import type { Id } from "../../lib/api";

export type GroupChoice =
  | { kind: "trip"; tripId: Id<"trips"> }
  | { kind: "friends"; memberIds: Id<"users">[] };

/** The backend plans for at most eight people, the viewer included. */
export const MAX_FRIENDS = 7;

type Param = string | string[] | undefined;
const one = (value: Param): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? "")).trim();

/** `/group-map?tripId=<id>` or `/group-map?memberIds=<id>,<id>`. A plan wins when both are there. */
export function parseChoice(tripId: Param, memberIds: Param): GroupChoice | null {
  const trip = one(tripId);
  if (trip !== "") return { kind: "trip", tripId: trip as Id<"trips"> };
  const ids = (Array.isArray(memberIds) ? memberIds.join(",") : (memberIds ?? ""))
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
  if (ids.length > 0) return { kind: "friends", memberIds: [...new Set(ids)] as Id<"users">[] };
  return null;
}

/** Names the group apart from where it is looked at from: the kept query and the error boundary reset on it. */
export function choiceKey(choice: GroupChoice | null): string {
  if (choice === null) return "none";
  return choice.kind === "trip" ? `trip:${choice.tripId}` : `friends:${choice.memberIds.join(",")}`;
}

/**
 * The route to this screen. `src/lib/links.ts` is shared and was not touched, so the helper lives here:
 *   router.push(groupMapPath({ tripId }));
 *   router.push(groupMapPath({ memberIds: [friendId, otherId] }));
 *   router.push(groupMapPath());   // opens on "Change group"
 */
export function groupMapPath(group?: { tripId?: string; memberIds?: string[] }): Href {
  if (group?.tripId) return `/group-map?tripId=${group.tripId}` as Href;
  if (group?.memberIds && group.memberIds.length > 0) return `/group-map?memberIds=${group.memberIds.join(",")}` as Href;
  return "/group-map" as Href;
}

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export type Agreement = { label: string; tone: "together" | "mixed" | "split" };

/** `GroupItem.agreement` (0 to 1, 1 = everyone scores it the same) in words. Nothing to say for a group of one. */
export function agreementHint(agreement: number, people: number): Agreement | null {
  if (people < 2) return null;
  if (agreement >= 0.75) return { label: "Everyone's into it", tone: "together" };
  if (agreement < 0.45) return { label: "Split", tone: "split" };
  return { label: "Mostly agree", tone: "mixed" };
}
