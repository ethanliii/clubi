import { v } from "convex/values";
import { query } from "./_generated/server";
import { ALGO, getCandidate, loadViewer, scoreCandidate, userLoader } from "./lib/discovery";
import {
  AFFINITY_NEUTRAL, ALPHA_LOCAL_VIEWER, ALPHA_VISITOR_VIEWER, ALSO_IOTA, BETA_FRIEND, CROWD_HALF_WEIGHT, DISTANCE_D0_METERS,
  DISTANCE_DELTA, ELO_TERM_CAP, EXPLORE_C, FEATURES, FEATURE_BASELINE, FOLLOW_FLOOR, GAMMA_ELO, GLOBAL_MEAN, MMR_MU,
  NEW_ITEM_MAX_RATINGS, NEW_SLOT_MIN_CONTENT, PERFORMER_RHO, PERFORMER_TERM_MAX, PERFORMER_TERM_MIN, PSEUDO_VOTES, SAVE_BUMP,
  SAVE_BUMP_MAX_FRIENDS, TIME_TAU, TOP_MAX_PER_CATEGORY,
} from "./lib/recs";

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Every term behind one item's score and map position, for showing the math live. */
export const explain = query({
  args: {
    kind: v.union(v.literal("place"), v.literal("event")),
    id: v.string(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const candidate = await getCandidate(ctx, args.kind, args.id);
    if (candidate === null) return null;
    const viewer = await loadViewer(ctx, now);
    if (viewer.under21 && candidate.doc.category === "nightlife") return null;
    const { item, terms, vector, reason, tag } = await scoreCandidate(ctx, candidate, viewer, args.lat, args.lng, now, userLoader(ctx));
    return {
      algo: ALGO,
      name: item.name,
      score: item.score,
      why: item.why,
      reason,
      tag,
      vectorSource: candidate.doc.learnedVector?.length === FEATURES.length
        ? "learnedVector (measured from visitors' answers)"
        : candidate.doc.venueVector?.length === FEATURES.length ? "venueVector (featurizer)" : "category default",
      formula: [
        "content = 1 + 4.5 * (1 + similarity(taste, venue))",
        "crowd = (sum(w * rating) + m * mean) / (sum(w) + m), w = max(0, similarity) * (1 + alpha * local) * (1 + beta * friend)",
        "lambda = sum(w) / (sum(w) + half)",
        "base = (1 - lambda) * content + lambda * crowd",
        "eloTerm = clip(gamma * elo, -cap, cap)",
        "performer = clip(rho * (bestAffinity - 5) / 5, -0.75, 1.5), events only; following counts as at least 8",
        "predicted = clip(base + eloTerm + performer + also, 1, 10)",
        "explore = cE / sqrt(1 + nRatings), nRatings = rankings + comparisons",
        "social = saveBump * min(2, friends going or saved)",
        "order = score - delta * ln(1 + distance / d0) + tau * timeMatch + explore + social",
      ],
      terms: {
        content: round(terms.content),
        crowd: round(terms.crowd),
        lambda: round(terms.lambda),
        base: round(terms.base),
        elo: round(terms.elo),
        eloTerm: round(terms.eloTerm),
        performer: round(terms.performer),
        performerName: terms.performerName,
        performerAffinity: terms.performerAffinity,
        also: round(terms.also),
        predicted: round(terms.predicted),
        ownScore: terms.ownScore,
        score: round(terms.score),
        distanceMeters: Math.round(terms.distanceMeters),
        distancePenalty: round(terms.distancePenalty),
        timeMatch: terms.timeMatch,
        timeTerm: terms.timeTerm,
        nRatings: terms.nRatings,
        explore: round(terms.explore),
        friendsGoing: terms.friendsGoing,
        friendsSaved: terms.friendsSaved,
        social: round(terms.social),
        order: round(terms.order),
        raters: { ...terms.raters, weightSum: round(terms.raters.weightSum) },
      },
      features: FEATURES.map((feature, i) => ({
        feature,
        taste: round(viewer.taste[i]),
        venue: round(vector[i]),
        contribution: round((viewer.taste[i] - FEATURE_BASELINE) * (vector[i] - FEATURE_BASELINE)),
      })),
      weights: {
        gamma: GAMMA_ELO,
        delta: DISTANCE_DELTA,
        d0: DISTANCE_D0_METERS,
        tau: TIME_TAU,
        m: PSEUDO_VOTES,
        mean: GLOBAL_MEAN,
        half: CROWD_HALF_WEIGHT,
        alphaLocalViewer: ALPHA_LOCAL_VIEWER,
        alphaVisitorViewer: ALPHA_VISITOR_VIEWER,
        beta: BETA_FRIEND,
        baseline: FEATURE_BASELINE,
        eloTermCap: ELO_TERM_CAP,
        rho: PERFORMER_RHO,
        performerMin: PERFORMER_TERM_MIN,
        performerMax: PERFORMER_TERM_MAX,
        affinityNeutral: AFFINITY_NEUTRAL,
        followFloor: FOLLOW_FLOOR,
        alsoIota: ALSO_IOTA,
        exploreC: EXPLORE_C,
        saveBump: SAVE_BUMP,
        saveBumpMaxFriends: SAVE_BUMP_MAX_FRIENDS,
        newItemMaxRatings: NEW_ITEM_MAX_RATINGS,
        newSlotMinContent: NEW_SLOT_MIN_CONTENT,
        mmrMu: MMR_MU,
        topMaxPerCategory: TOP_MAX_PER_CATEGORY,
      },
    };
  },
});
