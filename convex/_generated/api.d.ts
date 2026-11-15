/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as debug from "../debug.js";
import type * as discover from "../discover.js";
import type * as lib_contract from "../lib/contract.js";
import type * as lib_discovery from "../lib/discovery.js";
import type * as lib_hours from "../lib/hours.js";
import type * as lib_recs from "../lib/recs.js";
import type * as moments from "../moments.js";
import type * as notifications from "../notifications.js";
import type * as places from "../places.js";
import type * as rankings from "../rankings.js";
import type * as scoring from "../scoring.js";
import type * as seedPlaces from "../seedPlaces.js";
import type * as tables_catalog from "../tables/catalog.js";
import type * as tables_people from "../tables/people.js";
import type * as tables_social from "../tables/social.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  debug: typeof debug;
  discover: typeof discover;
  "lib/contract": typeof lib_contract;
  "lib/discovery": typeof lib_discovery;
  "lib/hours": typeof lib_hours;
  "lib/recs": typeof lib_recs;
  moments: typeof moments;
  notifications: typeof notifications;
  places: typeof places;
  rankings: typeof rankings;
  scoring: typeof scoring;
  seedPlaces: typeof seedPlaces;
  "tables/catalog": typeof tables_catalog;
  "tables/people": typeof tables_people;
  "tables/social": typeof tables_social;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
