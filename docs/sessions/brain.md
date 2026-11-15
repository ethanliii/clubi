# Session brief: Brain

**You own the thinking:** how a place gets its score, what the map shows, what a group should do, and the venue insights that come from the questions asked after every rating.

Read first: [`../SESSIONS.md`](../SESSIONS.md) (rules, file ownership), [`../CONTRACT.md`](../CONTRACT.md), [`../ALGORITHM.md`](../ALGORITHM.md) (all of it: it is your spec), `convex/lib/contract.ts`. Then read the code you inherit: `convex/lib/recs.ts`, `convex/lib/discovery.ts`, `convex/discover.ts`, `convex/places.ts`, `convex/scoring.ts`, `convex/debug.ts`, `tests/recs.test.mjs`.

**Why this matters:** the pitch is "ranked for your taste, by people like you, and every score has a reason." The venue insights are the second product: structured answers tied to a real ranking, collected minutes after the visit, are data nobody else has. They make the scores better (measured features replace keyword guesses) and they are what a venue owner would pay to see.

**Your files:** `convex/lib/recs.ts`, `lib/discovery.ts`, `lib/hours.ts`, `lib/insights.ts`, `lib/group.ts`, `convex/discover.ts`, `places.ts`, `scoring.ts`, `debug.ts`, `insights.ts`, `seedPlaces.ts`, `convex/tables/insights.ts`, `src/lib/useNearby.ts`, `src/lib/demoLocation.ts`, `tests/recs.test.mjs`, `tests/brain.*.test.mjs`, `docs/ALGORITHM.md`.

Do the tasks in order. Commit after each. `npx tsc --noEmit` and `npm test` green every time.

## B1. Venue insights, pure part (`convex/lib/insights.ts`) — must have

Everything here is plain TypeScript with tests (`tests/brain.insights.test.mjs`). Follow ALGORITHM.md §3.

1. `QUESTION_BANK`: the full bank from §3(a). Each question: `id`, `text`, `multi`, which categories it applies to, `options` (`id`, `label`), and for each option the feature targets it implies (`{feature, value}`), or none for questions that are analytics-only (who you went with, would you return).
2. `questionsForCategory(category)` and `pickQuestions(category, counts, {n = 4, seed})`: choose the 3–4 questions we know least about for this venue (§3(c)), always including at least one universal question, stable for a given seed so the same user sees the same set if the screen re-renders.
3. `addAnswers(counts, answers, weight)` / `removeAnswers(...)`: update the `{questionId: {optionId: count}}` totals. Unknown question or option ids are ignored, never thrown on: old app versions must not break a submit.
4. `observedVector(counts)` → `{vector, weight}` per feature and `blendVector(prior, observed, weight, n0)`: the shrinkage in §3(b). With no answers the blend equals the prior exactly.
5. `distributions(category, counts)` → `InsightDistribution[]`; `highlights(...)` and `bestFor(...)` with the rules in §3(d) (nothing is stated below the minimum answer count); `confidenceOf(nAnswers)`.
6. `answerChips(answers)` → short labels for a feed card ("Packed", "Mostly 20s"). The People session shows these on posts after the merge.

Tests: blend equals prior at n = 0 and approaches the observed value as n grows; locals' weight; `pickQuestions` returns valid, distinct questions for every category; removing answers restores the totals exactly; highlights stay empty below the minimum.

## B2. Venue insights, functions (`convex/insights.ts`) — must have

- `questionsFor({kind, id})` → `InsightQuestion[]`.
- `submit({kind, id, rankingId?, answers})` → `{saved, highlights}`. Signed-in only. Replaces my earlier answers for the same target (subtract the old ones from `venueStats.counts`, add the new). Writes one `visitAnswers` row per question (with `category`, `wasLocal`, `dayOfWeek`, `hour` copied from my ranking of that target when there is one), updates `venueStats`, then recomputes the blended vector and patches **only** `learnedVector` on the place or event. Bounded: at most 8 answers per submit.
- `venue({kind, id})` → `VenueInsights`. Totals only. Below 5 answers for a question, return it with `total` but no `top`, and leave highlights empty.
- `dashboard({kind, id})` → `VenueDashboard`: everything in §3(e). Read rankings by `by_place` / `by_event` (cap 500), comparisons for the win rate, and the raters' taste vectors for the audience profile. "Also loved": among the people who loved this, which other places they loved most, as lift with a minimum support of 3.
- Internal, for Ethan's dataset: `exportAnswers` (`internalQuery`, paginated) returning rows with no user id: `{targetId, targetKind, category, questionId, optionIds, wasLocal, dayOfWeek, hour, createdAt}`.

## B3. Score v4 (`lib/recs.ts`, `lib/discovery.ts`) — must have

Implement ALGORITHM.md §2 and §8, keeping every existing export and test working (add, don't rename).

1. `venueVectorOf(doc)` returns `doc.learnedVector` when present, else `venueVector`, else the category default. Now every score, the taste updates in `scoring.ts`, and `debug.explain` use measured features automatically.
2. **Performer affinity:** load the viewer's `affinities` once per query (`by_user`, cap 200) into a map; for event candidates load `eventPerformers` (`by_event`) and add the affinity term from §2. Reason line when it carries the score: "You rated Calvin Harris 9.4".
3. **Exploration bonus** for places with few ratings (§8), used in map ordering only, never in the shown score. One "new on clubi" slot inside the top tier.
4. **Flags and counts on `NearbyItem`:** `ratingCount`, `saved`, `going` (load my `saves` once, `by_user`), `performers` (from `event.performerNames`).
5. `discover.tonight.friendsGoing`: events my friends marked `going` (table `saves`, `by_target`), plus what it returns today.
6. `ALGO = "hybrid-v4"`. Extend `debug.explain` with every new term so the math can be shown live.

Tests in `tests/recs.test.mjs` / `tests/brain.score.test.mjs` for each new pure function.

## B4. Groups and trips (`lib/group.ts`, `discover.ts`) — must have

Follow ALGORITHM.md §5.

1. `lib/group.ts`: `groupScoreV2(scores, {votes?})` (average + least-misery mix, disagreement penalty, veto), `agreement(scores)` in 0–1, `fairWeights(previousStopScores)` for multi-stop fairness. Keep the old `groupScore` in `recs.ts` exported and passing its test.
2. `discover.forGroup({lat, lng, memberIds?, tripId?, filter?, limit?})` → `GroupResult`. With `tripId`: members = the trip's owner + `joined` members (the caller must be one of them), center = the trip's `lat`/`lng` when set, and the trip's votes (`tripVotes`, `by_trip`) feed the group score. Without `tripId`: the caller + `memberIds` that are accepted friends. Under-21 rule: if anyone in the group is under 21, no nightlife.
3. `discover.plan`: accept `tripId` the same way and use `fairWeights` between stops.

## B5. More discovery (`discover.ts`, `places.ts`)

- `discover.upcoming({lat, lng, days?, limit?})`: events in the window (index `by_start`, bounded), within 60 km, ordered by score including performer affinity. Each has a real `why`.
- `discover.similar({kind, id, lat, lng, limit?})`: nearest in feature space within the same broad area, excluding the item itself and things I already ranked, ordered by a mix of similarity and my score.
- `places.get`: add `insights: {highlights, bestFor}` (from `venueStats`), `ratingCount`, `saved`, `going`.

## B6. Prove it (`tests/brain.sim.test.mjs`)

The offline simulator in ALGORITHM.md §9: synthetic users with hidden true tastes, venues with true vectors and noisy featurizer priors, simulated rankings, comparisons and insight answers. Report held-out pairwise accuracy and NDCG@10 for content-only, v3 and v4, and group satisfaction (mean and minimum) for old vs new group score. Assert v4 ≥ v3 on both. Use the numbers to tune the constants, and write the final numbers into ALGORITHM.md §9. Keep the test under 5 seconds with a fixed seed.

## B7. If there is time

- Item-item "also loved" term in the score (§2), computed from at most 30 of my loved places.
- Time-of-day context from the `dayOfWeek`/`hour` saved on rankings: a place loved mostly late at night scores higher late at night.
- `insights.trending({lat, lng})`: places whose weekly average is rising, for a "Trending near you" row.

## Final report

List: every function built or changed with its final args and return type; test names and results; the simulator numbers; any optional field you added to `contract.ts`; each `INTEGRATION:` note; cron lines you need; anything skipped.
