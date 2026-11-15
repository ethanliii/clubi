/**
 * One import for everything a screen needs from the backend:
 *   import { api, type NearbyItem, type Id } from "../lib/api";
 */
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export { api };
export type { Doc, Id } from "../../convex/_generated/dataModel";
export type * from "../../convex/lib/contract";

/** `place` or `event`. Every venue call needs it next to the id. */
export type Kind = "place" | "event";

/** The signed-in user, as `api.users.me` returns it. */
export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;
