import { v } from "convex/values";
import { query } from "./_generated/server";
import { ALGO, getCandidate, loadViewer, scoreCandidate, userLoader } from "./lib/discovery";
import {
  ALPHA_LOCAL_VIEWER, ALPHA_VISITOR_VIEWER, BETA_FRIEND, CROWD_HALF_WEIGHT, DISTANCE_D0_METERS, DISTANCE_DELTA,
  FEATURES, FEATURE_BASELINE, GAMMA_ELO, GLOBAL_MEAN, PSEUDO_VOTES, TIME_TAU,
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
    const { item, terms, vector } = await scoreCandidate(ctx, candidate, viewer, args.lat, args.lng, now, userLoader(ctx));
    return {
      algo: ALGO,
      name: item.name,
      score: item.score,
      why: item.why,
      formula: [
        "content = 1 + 4.5 * (1 + similarity(taste, venue))",
        "crowd = (sum(w * rating) + m * mean) / (sum(w) + m), w = similarity * (1 + alpha * local) * (1 + beta * friend)",
        "lambda = sum(w) / (sum(w) + half)",
        "predicted = clip((1 - lambda) * content + lambda * crowd + gamma * elo, 1, 10)",
        "order = score - delta * ln(1 + distance / d0) + tau * timeMatch",
      ],
      terms: {
        content: round(terms.content),
        crowd: round(terms.crowd),
        lambda: round(terms.lambda),
        elo: round(terms.elo),
        eloTerm: round(terms.eloTerm),
        predicted: round(terms.predicted),
        ownScore: terms.ownScore,
        score: round(terms.score),
        distanceMeters: Math.round(terms.distanceMeters),
        distancePenalty: round(terms.distancePenalty),
        timeMatch: terms.timeMatch,
        timeTerm: terms.timeTerm,
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
      },
    };
  },
});
