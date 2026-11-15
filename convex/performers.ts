// Owner: Data session. Performers: search, follow, "X is coming to your city" alerts (docs/CONTRACT.md).
// Placeholder bodies: the Data session replaces this file but keeps these two exported signatures,
// because the People session calls recordPerformerAffinity from rankings.rank.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Called by rankings.rank after a user ranks an event: moves their affinity for each performer toward `score` (0–10). */
export async function recordPerformerAffinity(
  _ctx: MutationCtx,
  _args: { userId: Id<"users">; eventId: Id<"events">; score: number },
): Promise<void> {}

/** Called by the ingest after a new event is stored: notifies fans of its performers once per event. */
export async function notifyPerformerFans(_ctx: MutationCtx, _eventId: Id<"events">): Promise<void> {}
