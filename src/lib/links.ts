/**
 * Every route in the app, built in one place. Screens never write a path by hand:
 *   router.push(venuePath(item.kind, item.id));
 */
import * as Linking from "expo-linking";
import { router, type Href } from "expo-router";
import { Platform } from "react-native";
import type { Category } from "../../convex/lib/contract";

export type Kind = "place" | "event";

/** Screens with no parameters. */
export const paths = {
  home: "/" as Href,
  map: "/map" as Href,
  rate: "/rate" as Href,
  feed: "/feed" as Href,
  profile: "/profile" as Href,
  notifications: "/notifications" as Href,
  friends: "/friends" as Href,
  settings: "/settings" as Href,
  saved: "/saved" as Href,
  trips: "/trips" as Href,
  following: "/following" as Href,
  plan: "/plan" as Href,
  rankings: "/rankings" as Href,
  groupMap: "/group-map" as Href,
  welcome: "/welcome" as Href,
  quiz: "/quiz" as Href,
  tasteCard: "/taste-card" as Href,
} as const;

/** A place or event page. */
export const venuePath = (kind: Kind, id: string): Href => `/venue/${kind}/${id}` as Href;
/** The rank flow for one place or event ("Rank this place", "Rank it too"). */
export const ratePath = (kind: Kind, id: string): Href => `/rate/${kind}/${id}` as Href;
export const userPath = (userId: string): Href => `/user/${userId}` as Href;
export const comparePath = (userId: string): Href => `/compare/${userId}` as Href;
export const postPath = (postId: string): Href => `/post/${postId}` as Href;
export const tripPath = (tripId: string): Href => `/trip/${tripId}` as Href;
export const performerPath = (performerId: string): Href => `/performer/${performerId}` as Href;
/** Plan my night, or "Plan the night" for a trip. */
export const planPath = (tripId?: string): Href => (tripId ? `/plan?tripId=${tripId}` : "/plan") as Href;
/** My rankings, optionally opened on one category. */
export const rankingsPath = (category?: Category): Href =>
  (category ? `/rankings?category=${category}` : "/rankings") as Href;
/** The sign-in screen in "Sign up" or "Sign in" mode. */
export const signInPath = (mode: "signup" | "signin"): Href => `/sign-in?mode=${mode}` as Href;

const STATIC_ROUTES = new Set([
  "/",
  "/map",
  "/rate",
  "/feed",
  "/profile",
  "/notifications",
  "/friends",
  "/settings",
  "/saved",
  "/trips",
  "/following",
  "/plan",
  "/rankings",
  "/group-map",
]);

/** `/venue/<kind>/<id>` and `/rate/<kind>/<id>`: two parameters, the first is place or event. */
const KIND_ROUTES = new Set(["venue", "rate"]);
/** `/user/<id>` and friends: one parameter. */
const ID_ROUTES = new Set(["user", "compare", "post", "trip", "performer"]);

/**
 * Turn a link from the backend (`NotificationItem.link`, e.g. "/venue/place/<id>") into a route
 * that exists in this app, or null when it points nowhere we know.
 */
export function resolveLink(link: string | null | undefined): Href | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith("/")) return null;
  const queryStart = trimmed.search(/[?#]/);
  const path = (queryStart === -1 ? trimmed : trimmed.slice(0, queryStart)).replace(/\/+$/, "") || "/";
  const query = queryStart === -1 ? "" : trimmed.slice(queryStart);
  if (STATIC_ROUTES.has(path)) return `${path}${query}` as Href;

  const [root, first, second, ...rest] = path.slice(1).split("/");
  if (rest.length > 0) return null;
  if (KIND_ROUTES.has(root)) {
    if ((first === "place" || first === "event") && second) return `/${root}/${first}/${second}${query}` as Href;
    return null;
  }
  if (ID_ROUTES.has(root) && first && second === undefined) return `/${root}/${first}${query}` as Href;
  return null;
}

/**
 * Open a link the backend handed us: an app route ("/trip/<id>") or a web address.
 * Returns false when there was nothing to open, so the caller can stay put.
 */
export function openLink(link: string | null | undefined): boolean {
  if (!link) return false;
  if (/^https?:\/\//i.test(link)) {
    void openUrl(link);
    return true;
  }
  const href = resolveLink(link);
  if (href === null) return false;
  router.push(href);
  return true;
}

/** Open a web address ("Get tickets", "View on Luma") in the browser. Never throws. */
export async function openUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** A maps link for "Directions". Apple Maps on iOS, Google Maps everywhere else. */
export function directionsUrl(lat: number, lng: number, label?: string): string {
  const name = label ? encodeURIComponent(label) : "";
  if (Platform.OS === "ios") return `https://maps.apple.com/?daddr=${lat},${lng}${name ? `&q=${name}` : ""}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
