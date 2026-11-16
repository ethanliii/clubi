/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as debug from "../debug.js";
import type * as discover from "../discover.js";
import type * as follows from "../follows.js";
import type * as friends from "../friends.js";
import type * as imports_eventbrite from "../imports/eventbrite.js";
import type * as imports_google from "../imports/google.js";
import type * as imports_googleArea from "../imports/googleArea.js";
import type * as imports_luma from "../imports/luma.js";
import type * as imports_osm from "../imports/osm.js";
import type * as imports_partiful from "../imports/partiful.js";
import type * as imports_ticketmaster from "../imports/ticketmaster.js";
import type * as ingest from "../ingest.js";
import type * as insights from "../insights.js";
import type * as lib_contract from "../lib/contract.js";
import type * as lib_discovery from "../lib/discovery.js";
import type * as lib_group from "../lib/group.js";
import type * as lib_hours from "../lib/hours.js";
import type * as lib_insights from "../lib/insights.js";
import type * as lib_performers from "../lib/performers.js";
import type * as lib_recs from "../lib/recs.js";
import type * as lib_social from "../lib/social.js";
import type * as moments from "../moments.js";
import type * as notifications from "../notifications.js";
import type * as notificationsCron from "../notificationsCron.js";
import type * as onboarding from "../onboarding.js";
import type * as performers from "../performers.js";
import type * as places from "../places.js";
import type * as posts from "../posts.js";
import type * as profile from "../profile.js";
import type * as rankings from "../rankings.js";
import type * as saves from "../saves.js";
import type * as scoring from "../scoring.js";
import type * as seedPlaces from "../seedPlaces.js";
import type * as seedSocial from "../seedSocial.js";
import type * as settings from "../settings.js";
import type * as tables_catalog from "../tables/catalog.js";
import type * as tables_entities from "../tables/entities.js";
import type * as tables_insights from "../tables/insights.js";
import type * as tables_people from "../tables/people.js";
import type * as tables_social from "../tables/social.js";
import type * as tables_trips from "../tables/trips.js";
import type * as tables_ui from "../tables/ui.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  catalog: typeof catalog;
  crons: typeof crons;
  debug: typeof debug;
  discover: typeof discover;
  follows: typeof follows;
  friends: typeof friends;
  "imports/eventbrite": typeof imports_eventbrite;
  "imports/google": typeof imports_google;
  "imports/googleArea": typeof imports_googleArea;
  "imports/luma": typeof imports_luma;
  "imports/osm": typeof imports_osm;
  "imports/partiful": typeof imports_partiful;
  "imports/ticketmaster": typeof imports_ticketmaster;
  ingest: typeof ingest;
  insights: typeof insights;
  "lib/contract": typeof lib_contract;
  "lib/discovery": typeof lib_discovery;
  "lib/group": typeof lib_group;
  "lib/hours": typeof lib_hours;
  "lib/insights": typeof lib_insights;
  "lib/performers": typeof lib_performers;
  "lib/recs": typeof lib_recs;
  "lib/social": typeof lib_social;
  moments: typeof moments;
  notifications: typeof notifications;
  notificationsCron: typeof notificationsCron;
  onboarding: typeof onboarding;
  performers: typeof performers;
  places: typeof places;
  posts: typeof posts;
  profile: typeof profile;
  rankings: typeof rankings;
  saves: typeof saves;
  scoring: typeof scoring;
  seedPlaces: typeof seedPlaces;
  seedSocial: typeof seedSocial;
  settings: typeof settings;
  "tables/catalog": typeof tables_catalog;
  "tables/entities": typeof tables_entities;
  "tables/insights": typeof tables_insights;
  "tables/people": typeof tables_people;
  "tables/social": typeof tables_social;
  "tables/trips": typeof tables_trips;
  "tables/ui": typeof tables_ui;
  trips: typeof trips;
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
