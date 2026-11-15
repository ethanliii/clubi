# clubi algorithms: hybrid-v4

The design for everything clubi computes: the score on every pin, the questions after a ranking, artist alerts, group and trip picks, friend suggestions and the feed. Each part gives the formula, the constants to start from, the function to write and where it plugs in, plus the papers behind it (full list in section 10).

**Who reads which part.** Brain: sections 1, 2, 3, 5 (scoring), 8, 9. People: 5 (member suggestions, votes), 6, 7. Data: 4. Session ownership is in `docs/SESSIONS.md`; shapes are in `convex/lib/contract.ts` and are fixed.

**Rules every part follows**

- Everything runs inside Convex queries and mutations, in plain TypeScript. No training job, no outside ML service. Learning happens inside the mutation that records the event (a ranking, an answer, a follow).
- A query touches a few hundred rows at most. Anything heavier is kept as running totals that a mutation updates.
- Queries are deterministic: no `Math.random()` in a query. A reactive list that reshuffles on every re-run looks broken.
- The UI renders what the backend returns. Every score has a non-empty `why`; every suggestion has a non-empty `reason`.
- Pure math goes in `convex/lib/*.ts` with no Convex imports, so `node --test` can run it. Every weight is a named constant at the top of its file.
- Parts marked **Later** are for after the hackathon. Don't build them today.

**Symbols used throughout**

| Symbol | Meaning | In code |
| --- | --- | --- |
| $u, v$ | users; $u$ is the viewer | `users` |
| $i, j$ | items: a place or an event | `places`, `events` |
| $\mathbf t_u$ | taste vector, 13 numbers in $[0,1]$ | `users.tasteVector` |
| $\mathbf f_i$ | venue vector, same 13 features | `venueVector`, read with `venueVectorOf()` |
| $b_i$ | place quality from head-to-head comparisons (Elo, starts at 0) | `elo`, `nComparisons` |
| $r_{vi}$ | the 1–10 score user $v$'s ranking gave item $i$ | `rankings.score` |
| $\text{sim}(\mathbf a, \mathbf b)$ | cosine after subtracting 0.15 from every entry, in $[-1, 1]$ | `similarity()` |
| $\sigma(z)$ | $1/(1+e^{-z})$ | `sigmoid` |

The 13 features, in this order everywhere (`FEATURES`): `energy, loudness, crowdAge, price, dancing, liveMusic, pop, hiphop, electronic, indie, culture, outdoors, food`. `crowdAge` = 1 means a young crowd.

---

## 1. What runs today (hybrid-v3)

This is what `convex/lib/recs.ts` and `convex/lib/discovery.ts` do on `main` now. It differs from the older sketch in `docs/ETHAN.md` section 8 in three places: similarity is measured from a baseline, the taste step uses the similarity gap, and the learning rate is higher.

| Term | Formula | Constants |
| --- | --- | --- |
| Similarity | $\text{sim}(\mathbf a,\mathbf b) = \cos(\mathbf a - 0.15,\ \mathbf b - 0.15)$; returns 0.5 if either side is all baseline | `FEATURE_BASELINE` 0.15, `UNKNOWN_SIMILARITY` 0.5 |
| Content score | $s^{c}_{ui} = 1 + 4.5\,(1 + \text{sim}(\mathbf t_u, \mathbf f_i))$, so 1 to 10 | |
| Rater weight | $w_{uv} = \max(0, \text{sim}(\mathbf t_u, \mathbf t_v))\,(1 + \alpha\,[v\text{ local}])\,(1 + \beta_f\,[v\text{ friend}])$ | $\alpha$ = 1 if the viewer is local, 2 if visiting (`ALPHA_LOCAL_VIEWER`, `ALPHA_VISITOR_VIEWER`); `BETA_FRIEND` 0.5 |
| Crowd score | $c_{ui} = \dfrac{\sum_v w_{uv} r_{vi} + m\,\bar r}{\sum_v w_{uv} + m}$ | `PSEUDO_VOTES` $m$ = 2, `GLOBAL_MEAN` $\bar r$ = 6 |
| Crowd share | $\lambda_i = \dfrac{W}{W + 3}$, $W = \sum_v w_{uv}$ | `CROWD_HALF_WEIGHT` 3 |
| Predicted score | $\hat r_{ui} = \text{clip}_{[1,10]}\big((1-\lambda_i)\,s^{c}_{ui} + \lambda_i\,c_{ui} + \gamma\,b_i\big)$. If the viewer ranked it, their own score is shown instead. | `GAMMA_ELO` 0.3 |
| Map order | $\text{order}_{ui} = \hat r_{ui} - \delta \ln(1 + d/d_0) + \tau\,\text{timeMatch}$ | `DISTANCE_DELTA` 1, `DISTANCE_D0_METERS` 400, `TIME_TAU` 0.5 |
| timeMatch | 1 for an event that is on or starts within 6 h; 1 for a place that is not known to be closed and whose category fits the hour; else 0 | `EVENT_SOON_MS`, `CATEGORY_FITS_HOUR` |
| Taste step | after "$w$ beat $\ell$": $g = 1 - \sigma\big(\kappa\,[\text{sim}(\mathbf t_u,\mathbf f_w) - \text{sim}(\mathbf t_u,\mathbf f_\ell)]\big)$, then $\mathbf t_u \leftarrow \text{clip}\big(\mathbf t_u + \eta g(\mathbf f_w - \mathbf f_\ell) - \eta\lambda_t(\mathbf t_u - \mathbf t^{(0)}_u)\big)$ | `TASTE_ETA` 0.25, `TASTE_KAPPA` 5, `TASTE_LAMBDA` 0.1 |
| Bucket nudge | loved: $\mathbf t_u \leftarrow \mathbf t_u + 0.1(\mathbf f_i - \mathbf t_u)$; didn't like: $-0.05$; fine: nothing | `LOVED_STEP`, `DIDNT_STEP` |
| Elo step | $p = \sigma(b_w - b_\ell)$, $b_w \mathrel{+}= \frac{K_0}{\sqrt{1+n_w}}(1-p)$, $b_\ell \mathrel{-}= \frac{K_0}{\sqrt{1+n_\ell}}(1-p)$ | `ELO_K0` 0.5 |
| Group score | $\tfrac12\,\text{mean} + \tfrac12\,\min$; `null` if anyone is under 4 | `GROUP_BETA` 0.5, `GROUP_VETO_SCORE` 4 |
| Top 5 | greedy: skip a candidate whose vector has sim > 0.95 with one already picked | `DIVERSITY_MAX_COSINE` |
| Why line | own ranking → "You ranked it 9.2"; else if $\lambda_i > 0.4$ and a friend or local rated it → "Albert gave it 9.1" or "Locals like you rate it 8.9"; else the two strongest features ("Loud + pop music"); then a tag ("· Open now") | `WHY_SOCIAL_LAMBDA` 0.4 |

Loading: up to 200 candidates from the `by_lat` index around the viewer, up to 50 raters per item, plus all rankings by the viewer and their friends.

**What v3 cannot do, and v4 adds:** venue vectors are keyword guesses that never improve (section 3); it knows nothing about who is performing (section 4); it ignores "people who loved X also loved Y" (section 2); new places with no ratings never get a chance (section 8); groups ignore disagreement and votes (section 5).

---

## 2. The v4 score

One utility per viewer $u$ and item $i$. The shown score stays on 1–10 and stays honest; anything that only changes the order (distance, time, exploration) is kept out of the shown number.

$$
\hat r_{ui} = \text{clip}_{[1,10]}\Big(\underbrace{(1-\lambda_i)\,s^{c}_{ui} + \lambda_i\,c_{ui}}_{\text{base, as in v3}} \;+\; \underbrace{Q_i}_{\text{quality}} \;+\; \underbrace{P_{ui}}_{\text{performers}} \;+\; \underbrace{A_{ui}}_{\text{also loved}}\Big)
$$

$$
\text{order}_{ui} = \hat r_{ui} \;-\; \delta \ln\!\Big(1 + \frac{d_{ui}}{d_0}\Big) \;+\; \tau\,\text{timeMatch}_i \;+\; E_i \;+\; S_{ui}
$$

| Term | What it is | Range |
| --- | --- | --- |
| $s^c_{ui}$ | Content score, unchanged, but $\mathbf f_i$ is now the **blended** vector from section 3b (measured answers replace keyword guesses). | 1 to 10 |
| $c_{ui}, \lambda_i$ | Crowd score and its share, unchanged. | 1 to 10 |
| $Q_i = \text{clip}(\gamma\,b_i, -1, 1)$ | Quality from comparisons, now capped so one hot streak can't add more than a point. | ±1 |
| $P_{ui}$ | Performer affinity, events only, section 4. | −0.75 to +1.5 |
| $A_{ui}$ | "Also loved", below. | ±0.6 |
| $E_i = \dfrac{c_E}{\sqrt{1 + n_i}}$ | Exploration bonus, section 8. $n_i$ = rankings + comparisons of the item. Order only. | 0 to 0.6 |
| $S_{ui} = 0.3\cdot\min(2, \text{friends going or saved})$ | Small social bump from the `saves` table. Order only. | 0 to 0.6 |

Because the three add-ons are bounded (at most +3.1 together, and usually only one fires), the base still decides the score and the final clip rarely bites.

### 2.1 "Also loved" (item-to-item, from behaviour)

Taste vectors capture what people say they like. Co-ranking captures what they actually do. A "twin" of $u$ is someone who loved the same places.

1. Once per query (in `loadViewer`): take the viewer's loved items $L_u$ (at most 20, best first). For each, read up to 30 other users who loved it. For each such user $v$, count overlaps $o_{uv} = |L_u \cap L_v|$ and remember one shared item name.
2. Twin weight: $\omega_{uv} = \dfrac{o_{uv}}{o_{uv} + 2}$ (one shared love = 0.33, four = 0.67).
3. For candidate $i$, using the raters already loaded for the crowd score:

$$
A_{ui} = \iota \cdot \frac{\sum_{v \in \text{twins}} \omega_{uv}\,z_{vi}}{1 + \sum_{v \in \text{twins}} \omega_{uv}}, \qquad z_{vi} = \begin{cases} +1 & v \text{ loved } i \\ 0 & \text{fine} \\ -1 & \text{didn't like} \end{cases}
$$

Don't also multiply the crowd weight $w_{uv}$ by $\omega$: that would count the same people twice.

```ts
// convex/lib/recs.ts
export type Twin = { weight: number; sharedName: string };            // keyed by userId in a Map
export function alsoLovedTerm(raterBuckets: { userId: string; bucket: Bucket }[], twins: Map<string, Twin>):
  { term: number; via?: string };   // via = name of the shared loved place of the heaviest twin who loved it
```

### 2.2 Constants

| Constant | Start | Meaning |
| --- | --- | --- |
| `ELO_TERM_CAP` | 1.0 | cap on $\lvert Q_i \rvert$ |
| `ALSO_IOTA` $\iota$ | 0.6 | size of the also-loved term |
| `ALSO_PRIOR` | 2 | the "+2" in $\omega$ |
| `ALSO_MAX_LOVED` / `ALSO_MAX_LOVERS` | 20 / 30 | read limits |
| `EXPLORE_C` $c_E$ | 0.6 | exploration bonus at zero ratings |
| `SAVE_BUMP` | 0.3 | per friend going or saved, max 2 |
| `PERFORMER_RHO` | 1.5 | see section 4 |

### 2.3 The why line, in priority order

The score is a sum, so the reason is the term that moved it most. First rule that matches wins. A context tag is appended after " · " as today.

| # | When | Text |
| --- | --- | --- |
| 1 | viewer ranked it | "You ranked it 9.2" |
| 2 | $P_{ui} \ge 0.5$ | "You rated Calvin Harris 9.4" or "You follow Calvin Harris" |
| 3 | $\lambda_i > 0.4$ and a friend is the heaviest rater | "Albert gave it 9.1" |
| 4 | $\lambda_i > 0.4$ and a local rated it | "Locals like you rate it 8.9" |
| 5 | $A_{ui} \ge 0.25$ | "People who loved Zeitgeist love this too" |
| 6 | the top feature is measured ($n_k \ge 5$ answers, section 3b) | "Loud + young crowd, say people who went" |
| 7 | otherwise | "Loud + pop music" (two top features, as today) |

Tags, first that applies: "On now", "Starts in 2 h", "Open now", "New on clubi" (the exploration slot, section 8), "2 friends going".

### 2.4 Where it plugs in

- `predict()` in `convex/lib/recs.ts` gains an optional 6th argument `extras?: { performer?: number; also?: number }` and returns the added terms. Old calls keep working, old tests stay green.
- `scoreCandidate()` in `convex/lib/discovery.ts` computes the extras, passes them in, uses the blended vector, and adds $E_i + S_{ui}$ to `order`.
- `debug.explain` returns every new term, so the math can be shown live.
- Set `ALGO = "hybrid-v4"`.

Papers: the pairwise core is Bradley & Terry (1952) and Elo (1978), learned online like RankNet (Burges et al., 2005) and BPR (Rendle et al., 2009). The crowd term is neighbourhood collaborative filtering with a Bayesian average. Local and friend weights follow Ference et al. (2013), Yin et al. (2013), Ma et al. (2011) and Jamali & Ester (2010). Also-loved is item-to-item filtering (Sarwar et al., 2001; Linden et al., 2003). Distance decay follows Ye et al. (2011); time fit follows Yuan et al. (2013). Reasons follow Herlocker et al. (2000) and Tintarev & Masthoff (2007).

---

## 3. Venue insights

Right after a ranking, the app asks 3–4 quick multiple-choice questions. The answers do three jobs: they replace guessed venue vectors with measured ones, they give the venue page real facts ("Packed · mostly 25–34 · $20–50"), and they are the dataset behind the venue dashboard.

### 3a. Question bank

Lives in `convex/lib/insights.ts` as `QUESTION_BANK`. Each option may carry feature targets (what that answer says about the venue, 0–1) and a short highlight phrase. Ids are stable strings: never rename one, because stored answers refer to them.

```ts
export type BankOption = { id: string; label: string; targets?: Partial<Record<Feature, number>>; highlight?: string; groupSize?: number };
export type BankQuestion = { id: string; text: string; multi: boolean; categories: Category[] | "all"; options: BankOption[] };
```

**Universal** (every category)

| id | Text | Multi | Options → feature targets |
| --- | --- | --- | --- |
| `packed` | How busy was it? | no | Empty → energy 0.15 · Comfortable → 0.4 · Busy → 0.7 · Packed → 0.95 |
| `price` | What did you spend? | no | Free → price 0.0 · Under $20 → 0.2 · $20–50 → 0.45 · $50–100 → 0.75 · $100+ → 0.95 |
| `company` | Who were you with? | no | Solo (groupSize 1) · A date (2) · A few friends (4) · A big group (7) · Family (4). No feature. |
| `return` | Would you go back? | no | Definitely · Maybe · No. No feature; dashboard only. |

**Per category**

| id | Categories | Text | Multi | Options → feature targets |
| --- | --- | --- | --- | --- |
| `loud` | nightlife, food, live, popup | How loud was it? | no | Quiet → loudness 0.1 · Buzzing → 0.4 · Loud → 0.75 · Deafening → 1.0 |
| `crowdage` | nightlife, live, popup, food | What was the crowd, mostly? | no | Under 25 → crowdAge 0.95 · 25–34 → 0.65 · 35–49 → 0.35 · 50+ → 0.1 · A real mix → 0.5 |
| `music` | nightlife, live | What was playing? | yes | Pop / Top 40 → pop 0.9 · Hip-hop → hiphop 0.9 · House / techno → electronic 0.9 · Indie / rock → indie 0.9 · Latin → pop 0.5, dancing 0.8 · Live band → liveMusic 0.95 · No real music → liveMusic 0.05, loudness 0.2 |
| `dancefloor` | nightlife, live | Was anyone dancing? | no | Nobody → dancing 0.05 · A few → 0.45 · Most of the room → 0.95 |
| `line` | nightlife, live, popup, food | How long did you wait to get in? | no | No wait · Under 10 min · 10–30 min · Over 30 min. Dashboard only. |
| `foodq` | food, popup | How was the food? | no | Skip it → food 0.2 · Fine → 0.5 · Great → 0.8 · Best in town → 1.0 |
| `artq` | culture | How was what you saw? | no | Skippable → culture 0.3 · Solid → 0.55 · Great → 0.8 · World class → 1.0 |
| `timeneeded` | culture, outdoors | How long do you need there? | no | Under 30 min · About an hour · Half a day · A full day. Dashboard only. |
| `setting` | outdoors | How was the setting? | no | Nothing special → outdoors 0.3 · Nice → 0.55 · Beautiful → 0.8 · Stunning → 1.0 |
| `effort` | outdoors | How much effort was it? | no | Easy stroll → energy 0.2 · Some walking → 0.5 · A real workout → 0.85 |
| `sound` | live | How was the sound? | no | Bad · OK · Great. Dashboard only. |
| `worth` | live, popup, culture | Worth the ticket? | no | No · Yes · A steal. Dashboard only. |
| `popuptype` | popup | What was it, mostly? | yes | Food & drink → food 0.8 · Art & design → culture 0.8 · Music → liveMusic 0.7 · Market / shopping → culture 0.5 · Meeting people → energy 0.6 |
| `bestfor` | all (options differ) | Best for… | yes | nightlife: Date night → loudness 0.3 · Big groups · Dancing → dancing 0.9 · Conversation → loudness 0.2 · Pregame · Late night → energy 0.8. food: Date night · Big groups · Quick bite · Special occasion → price 0.8 · Solo. culture: A date · Kids · Solo · A rainy day · Visitors. outdoors: Picnic · Views · Workout → energy 0.8 · Dogs · Sunset. live / popup: Dancing → dancing 0.9 · Hearing the music · Meeting people · A date. |

For a multi-select music or type question, each **selected** option sends its targets with weight 1. For `music` only, each **unselected** genre feature gets target 0.1 with weight 0.5 ("they didn't hear it").

### 3b. From answers to a measured venue vector

Each answer contributes its targets with weight $w_a$ = 1.5 if the person is a local (`wasLocal`), else 1. Locals know what a place is normally like; a visitor saw one night. For item $i$ and feature $k$, keep running totals $n_{ik} = \sum w_a$ and $\mu_{ik} = \frac{\sum w_a\,\text{target}_a}{n_{ik}}$. The vector the scorer uses is the prior shrunk toward what was measured:

$$
f_{ik} = \frac{n_0\,f^{\text{prior}}_{ik} + n_{ik}\,\mu_{ik}}{n_0 + n_{ik}}, \qquad n_0 = 5
$$

$f^{\text{prior}}$ is the featurizer's keyword guess (`venueVector` on the row, or the category preset). With no answers this is the prior exactly. After 5 answers it is half measured. After 20 it is 80% measured. This is the same Bayesian-average idea as the crowd score, applied per feature.

Storage (`venueStats`, one row per item, updated inside `insights.submit`): `counts[questionId][optionId]` (raw counts for the distributions), `observedVector` = $\mu_{i}$ (13 numbers), `observedWeight` = $n_i$ (13 numbers). The item's own `venueVector` is never overwritten, so the prior is never lost and a bad batch of answers can be undone.

When a user answers again for the same venue, subtract their old answers from the totals before adding the new ones.

```ts
// convex/lib/insights.ts
export const INSIGHT_N0 = 5, LOCAL_ANSWER_WEIGHT = 1.5;
export function blendVector(prior: number[], observed?: number[], weight?: number[], n0 = INSIGHT_N0): number[];
export function applyAnswers(stats: StatsTotals, category: Category, answers: InsightAnswer[], sign: 1 | -1, local: boolean): StatsTotals;
```

Plug-in: `scoreCandidate` loads the `venueStats` row for each candidate (one indexed read by `targetId`) and calls `blendVector(venueVectorOf(doc), stats?.observedVector, stats?.observedWeight)`. The same blended vector is used for the taste step, so answers also make live learning more accurate.

### 3c. Which questions to ask

Ask where we know least. For each bank question $q$ that applies to the category:

$$
\text{value}_q = \frac{1}{\sqrt{n_0 + n_{iq}}}\,\big(0.5 + 0.5\,H_{iq}\big)\,\phi_q
$$

- $n_{iq}$ = answers so far for $q$ at this venue.
- $H_{iq}$ = entropy of the current answer split divided by $\ln(\text{options})$, so 0 when everyone agrees and 1 when answers are split evenly. With no answers use 1. People disagreeing means we should keep asking.
- $\phi_q$ = 1 if the question feeds a feature, 0.6 if it is dashboard-only (`DASHBOARD_QUESTION_WEIGHT`).

Pick the 3 highest. Then add 1 universal question as the 4th: the universal with the fewest answers at this venue (this is the floor that keeps `price`, `company`, `return` rotating in). Break ties with a hash of `userId + questionId`, so two friends at the same bar get different questions. Return at most `QUESTIONS_PER_VISIT` = 4, feature questions first.

```ts
export function chooseQuestions(category: Category, counts: Counts, seed: string, max = 4): InsightQuestion[];
```

This is uncertainty sampling: the first term is how wide the posterior still is, the second is how much the crowd disagrees. Rashid et al. (2002) showed the same thing for sign-up questions: ask about what is both popular and divisive.

### 3d. Highlights and "best for"

Never state a fact from one or two people.

- A distribution is shown only when `total` ≥ `MIN_SHOW` = 5 respondents.
- A **highlight** is produced for a single-choice question when the top option has ≥ 50% (`HIGHLIGHT_SHARE`). Text comes from the option: `packed` → "Packed" / "Easy to get a seat"; `crowdage` → "Mostly 25–34"; `loud` → "Loud"; `price` → "$20–50 a head"; `line` → "No line" / "30+ min line"; `return` → "86% would go back" (always phrased as the share).
- **Best for**: options of `bestfor` picked by ≥ 30% of respondents (`BESTFOR_SHARE`), top 3 by share.
- At most 4 highlights, ordered by share.
- `confidence`: `low` under 5 respondents, `medium` 5–19, `high` 20+. With `low`, `highlights` and `bestFor` are empty and the UI shows "Not enough answers yet".

```ts
export function summarize(category: Category, counts: Counts, nRespondents: number):
  { distributions: InsightDistribution[]; highlights: string[]; bestFor: string[]; confidence: "low" | "medium" | "high" };
```

### 3e. Dashboard metrics (`insights.dashboard`)

| Field | How |
| --- | --- |
| `audience` | Mean taste vector of users who put it in `loved`, minus the mean taste of all raters loaded. Take the 5 features with the largest positive gap. `label` = the feature phrase ("Electronic music"), `pct` = `round(100 × mean)`. Needs ≥ 3 lovers, else empty. |
| `localsPct` | Share of rankings with `wasLocal` true. |
| `buckets` | Counts of loved / fine / didn't. |
| `visitsByHour`, `visitsByDay` | Histograms of `rankings.hour` (24) and `rankings.dayOfWeek` (7). |
| `winRate`, `beats` | From `comparisons`: wins ÷ (wins + losses) for this item, and per opponent. The table has no index by item, so today scan the newest 2,000 rows and filter. **Later:** People adds `by_winner` and `by_loser` indexes. |
| `alsoLoved` | $\text{lift}(i \to j) = \dfrac{P(\text{loved } j \mid \text{loved } i)}{P(\text{loved } j)} = \dfrac{o_{ij}/\lvert L_i\rvert}{\lvert L_j\rvert / N}$, where $o_{ij}$ = users who loved both and $N$ = users with at least one ranking. Compute $o_{ij}$ from the loved lists of up to 50 lovers of $i$; keep $j$ with $o_{ij} \ge$ `ALSO_MIN_SUPPORT` = 2 (3 once there is data); top 5 by lift. |
| `trend` | Rankings grouped by week (`visitedAt`): average score and count, last 8 weeks. |

The dashboard reads up to 500 rankings for one item. That is fine for one venue at a time; it is not called from lists.

### 3f. Why this data is worth having

- **Structured.** Fixed options, so answers add up. Free-text reviews need a model to interpret; these don't.
- **Verified.** Every answer hangs off a ranking the person just made, with the time, day, whether they are a local, and group size.
- **Fresh.** Asked seconds after the visit is recorded, not weeks later.
- **Comparable.** The same questions across every venue in a category, so "louder than 80% of bars nearby" is a real statement.
- **Tied to preference.** We know the answer *and* how much the person liked the place *and* their taste, so a venue can see who it works for, not just an average.

**Privacy rule:** answers are stored per user so they can be replaced, but only totals leave the backend. Nothing is shown below 5 respondents. No query returns who answered what.

---

## 4. Performer affinity and alerts

"You rated Calvin Harris high" → "Calvin Harris is coming to San Francisco".

### 4.1 Affinity

$a_{up} \in [0, 10]$: how much user $u$ likes performer $p$. One row per pair in `affinities`. Neutral is 5.

When $u$ ranks an event with score $r$ (0–10), for every performer $p$ on it (`recordPerformerAffinity`, called from `rankings.rank`):

$$
a_{up} \leftarrow a_{up} + \eta_n\,(r - a_{up}), \qquad \eta_n = \max\!\Big(0.3,\ \frac{1}{1 + n_{up}}\Big), \qquad n_{up} \leftarrow n_{up} + 1
$$

The first ranking sets the affinity to that score ($\eta_0 = 1$). Later ones move it 30–50% of the way: a moving average that follows changing taste. An event with several performers updates each of them; the headliner (first in the list) gets the full step and the others half (`SUPPORT_ACT_STEP` 0.5).

Following is explicit: `following = true` makes the effective affinity $\tilde a_{up} = \max(a_{up}, 8)$ (`FOLLOW_FLOOR`). Unfollowing only clears the flag.

**Genre spill-over.** For a performer $q$ the user has no row for, borrow from similar performers they do have, using performer vectors $\mathbf v_p$ (built by running the featurizer on the performer's genres):

$$
\tilde a_{uq} = 5 + \kappa_s\,\frac{\sum_{p:\ \text{sim}(\mathbf v_p, \mathbf v_q) > 0.6} \text{sim}(\mathbf v_p, \mathbf v_q)\,(\tilde a_{up} - 5)}{\sum_{p} \text{sim}(\mathbf v_p, \mathbf v_q)}, \qquad \kappa_s = 0.5
$$

Read at most the user's 30 strongest affinities. Spill-over shifts scores but **never** triggers an alert on its own.

**In the score** (events only). Let $a^{*}_{ui}$ be the highest effective affinity among the event's performers:

$$
P_{ui} = \text{clip}\Big(\rho\,\frac{a^{*}_{ui} - 5}{5},\ -0.75,\ 1.5\Big), \qquad \rho = 1.5
$$

A 9.4 for the headliner adds 1.3 points. A disliked performer drags less than a loved one lifts. No row and no spill-over → 0.

### 4.2 Alerts

Run by `notifyPerformerFans(ctx, eventId)` when the ingest stores a **new** event. For each performer, read `affinities` by `by_performer` and notify the user when all of these hold:

1. `following`, or (`score` ≥ 7.5 and `nRankings` ≥ 1). `ALERT_MIN_AFFINITY` 7.5.
2. The event is near them. We never store a live location, so "near" means: `sameCity(user.homeCity, event.city)`, or the event is within 60 km (`ALERT_RADIUS_KM`) of the centre of their home city from a small `CITY_CENTERS` table. No home city → no alert.
3. The event starts in the future and within 120 days.
4. `lastNotifiedEventId` on the affinity row is not this event (then set it).
5. The user has had fewer than 2 `artist_event` notifications in the last 24 hours (`ALERT_MAX_PER_DAY`).
6. They did not already rank or mark "going" for this event.

`notify()` itself checks `notifPrefs.artistAlerts`. Text: title "Calvin Harris is coming to San Francisco", body "Sat Dec 5 · The Midway · you rated them 9.4" (or "· you follow them"), link `/venue/event/<id>`.

A daily cron also catches people who started liking a performer **after** the event was imported: for each affinity that crossed 7.5 or was followed in the last day, look up `eventPerformers` by `by_performer` for future events and apply the same rules.

### 4.3 Names: getting from a scraped title to a performer

Prefer structured data. Ticketmaster returns `attractions` with ids and genres: use them as-is. For sources with only a title (Luma, Partiful, Eventbrite), use `convex/lib/performers.ts`:

```ts
export function normalizePerformerName(name: string): string;
export function extractPerformerNames(title: string): string[];      // headliner first
export function sameName(a: string, b: string): boolean;
```

`normalizePerformerName`: lower-case, strip accents (NFKD), turn `&` into "and", drop punctuation, collapse spaces, drop a leading "the ". "DJ" is kept ("dj snake" is a name), but matching also tries the name without it.

`extractPerformerNames(title)`:

1. Cut the venue and extras: keep the part before " at ", " @ ", " | ", " — ", " - " and before "(" or "[". Drop trailing words "live", "tour", "world tour", a year, "21+", "sold out".
2. If the text has "presents" or "presents:", keep what comes after it.
3. Try the whole remaining string against known performers first, so "Florence and the Machine" or "Above & Beyond" is not split.
4. Otherwise split the line-up on: " b2b ", " w/ ", " with ", " feat. ", " ft. ", " featuring ", " + ", " & ", " x ", " vs ", ", ".
5. Drop generic pieces: "happy hour", "open mic", "trivia", "karaoke", "party", "night", "festival", "brunch", "meetup", "friends", "special guests", and anything under 2 characters.

`sameName(a, b)` after normalising: equal; or equal ignoring a leading "dj "; or, for names of 6+ characters, edit distance ≤ 1.

Only **create** a performer from a title when the event's category is `live` or the title matched " at "/" @ "/" b2b "/"presents". Otherwise only link to performers that already exist. A wrong performer is worse than none: it sends a wrong alert.

| Constant | Start |
| --- | --- |
| `AFFINITY_NEUTRAL` | 5 |
| `AFFINITY_MIN_STEP` | 0.3 |
| `SUPPORT_ACT_STEP` | 0.5 |
| `FOLLOW_FLOOR` | 8 |
| `SPILL_KAPPA` / `SPILL_MIN_SIM` | 0.5 / 0.6 |
| `PERFORMER_RHO` | 1.5 |
| `ALERT_MIN_AFFINITY` / `ALERT_RADIUS_KM` / `ALERT_MAX_PER_DAY` / `ALERT_HORIZON_DAYS` | 7.5 / 60 / 2 / 120 |

Papers: event recommendation is a cold-start problem because every event is new, so the signal has to come from who is involved and where (Minkov et al., 2010; Macedo et al., 2015). The moving average follows Koren's (2009) point that taste drifts.

---

## 5. Groups and trips

### 5.1 Group score

Members $G$, each with their own predicted score $\hat r_{ui}$ for item $i$. Let $\bar r$ be the mean, $r_{\min}$ the lowest and $s$ the standard deviation.

$$
S_G(i) = \text{clip}_{[1,10]}\Big((1-\beta)\,\bar r + \beta\,r_{\min} \;-\; \psi\,s \;+\; \nu\,\frac{\text{up}_i - \text{down}_i}{\lvert G\rvert}\Big), \qquad \text{dropped if any } \hat r_{ui} < 4
$$

- The average alone lets a majority drag one person somewhere they hate. The minimum alone ("least misery") lets one picky person decide everything. Mixing them is the standard fix (Masthoff, 2004; O'Connor et al., 2001).
- $\psi\,s$ is the disagreement penalty from Amer-Yahia et al. (2009): of two places with the same average, prefer the one everyone feels the same about.
- The vote term uses the trip shortlist (`tripVotes`): a thumbs-up from everyone adds $\nu$.
- `agreement` in `GroupItem` = $1 - \min(1, s/3)$.

The why line for a group item: "Everyone's at 8+ here" (min ≥ 8), else "Best overlap: Ethan 9.1, Bryan 7.8" (highest and lowest member), plus the tag.

### 5.2 Fairness across stops

For `discover.plan` (three stops), don't let the same person compromise every time. Keep a weight per member, starting at 1. After choosing stop $k$ with scores $\hat r_{u}$:

$$
w_u \leftarrow w_u \cdot \exp\!\Big(\eta_f\,\frac{\bar r - \hat r_u}{10}\Big), \quad \text{then rescale so } \textstyle\sum_u w_u = \lvert G\rvert
$$

and use the weighted mean $\bar r_w = \frac{\sum w_u \hat r_u}{\sum w_u}$ in place of $\bar r$ for the next stop. Whoever was least happy at stop 1 counts more at stop 2. Masthoff (2004) found people judge a sequence by whether everyone got a turn.

### 5.3 Who to add to a trip (`trips.suggestMembers`, People)

Candidates: the viewer's accepted friends who are not already on the trip. For each candidate $v$:

$$
\text{fit}_v = 0.45\,T_v + 0.25\,L_v + 0.20\,H_v + 0.10\,M_v
$$

| Part | Definition |
| --- | --- |
| $T_v$ | $\max(0, \text{sim}(\mathbf t_v, \bar{\mathbf t}_G))$, where $\bar{\mathbf t}_G$ is the mean taste of joined members |
| $L_v$ | 1 if `sameCity(v.homeCity, trip.city)`, else 0. A local knows the city, and section 1 already trusts locals more (Ference et al., 2013). |
| $H_v$ | $\min(1, n/5)$, $n$ = places both $v$ and any joined member have ranked |
| $M_v$ | share of joined members who are friends with $v$ |

`fitPct = round(100 × fit)`. `reason`, first that applies: local → "Lives in Tokyo, knows the city"; $T_v \ge 0.7$ → "86% taste match with the group"; $n \ge 2$ → "Ranked 4 of the same places as Bryan"; $M_v > 0$ → "Friends with 3 people on this trip"; else "Your friend".

```ts
// convex/lib/group.ts (Brain)
export const GROUP_PSI = 0.5, GROUP_VOTE_NU = 1.0, FAIRNESS_ETA = 2, AGREEMENT_SD_MAX = 3;
export function groupScoreV4(scores: number[], opts?: { weights?: number[]; up?: number; down?: number }):
  { score: number; agreement: number } | null;                       // null = vetoed
export function nextWeights(weights: number[], scores: number[], eta = FAIRNESS_ETA): number[];

// convex/lib/social.ts (People)
export function tripFit(c: { taste: number[]; isLocal: boolean; sharedPlaces: number; friendShare: number }, centroid: number[]):
  { fitPct: number; reason: string };   // the caller fills the names into the reason
```

Plug-in: `discover.forGroup` scores every candidate once per member (reuse `scoreCandidate` with each member as the viewer; cap the group at 8 and candidates at 80), then `groupScoreV4`. `discover.plan` keeps its three slots and adds `nextWeights` between them. The existing `groupScore()` stays exported for old callers and tests.

---

## 6. Friend suggestions (`friends.suggestions`, People)

**Candidates.** Friends of my friends (two hops, at most 200 people). If that gives fewer than 5, add up to 100 users from my home city. Exclude: me, current friends, any pending request either way, anyone who declined me or whom I declined, and anyone with `discoverable === false`.

**Score** for candidate $v$, each part in $[0,1]$:

$$
\text{score}_v = 0.40\,\min\!\Big(1, \frac{AA_{uv}}{3}\Big) + 0.30\,T_{uv} + 0.20\,C_{uv} + 0.10\,[\text{same home city}]
$$

| Part | Definition |
| --- | --- |
| $AA_{uv} = \sum_{z \in N(u)\cap N(v)} \dfrac{1}{\ln(1 + \lvert N(z)\rvert)}$ | Adamic–Adar: each mutual friend counts, but a mutual friend who knows everyone counts less (Adamic & Adar, 2003). $N(z)$ = $z$'s friends. Liben-Nowell & Kleinberg (2007) found it among the best simple link predictors. |
| $T_{uv} = \max(0, \text{sim}(\mathbf t_u, \mathbf t_v))$ | taste match |
| $C_{uv} = \dfrac{n}{n+2}\Big(1 - \dfrac{\text{mean}\,\lvert r_{ui} - r_{vi}\rvert}{9}\Big)$ | agreement on the $n$ places both ranked, shrunk when $n$ is small |

Return fields: `mutualCount` = $\lvert N(u)\cap N(v)\rvert$, `tasteMatchPct` = `round(100 × clip((sim + 1) / 2, 0, 1))` (use this same formula for every "% taste match" in the app), `sharedPlaces` = $n$, `score`.

**Reason**, first that applies, with " · 82% taste match" appended when `tasteMatchPct` ≥ 70: "3 mutual friends" (or "Friends with Bryan" when it is one) → "You both ranked Zeitgeist and 2 more" ($n \ge 2$) → "Also in San Francisco" → "82% taste match".

```ts
// convex/lib/social.ts
export const FRIEND_W = { mutual: 0.4, taste: 0.3, coRank: 0.2, city: 0.1 }, AA_FULL = 3;
export function adamicAdar(mutualDegrees: number[]): number;          // degrees of the mutual friends
export function tasteMatchPct(a: number[], b: number[]): number;
export function coRankAgreement(pairs: { mine: number; theirs: number }[]): number;
export function friendSuggestionScore(p: { aa: number; taste: number; coRank: number; sameCity: boolean }): number;
```

Cost: with $F$ friends, reading friends-of-friends is $2F$ indexed reads plus one user read per candidate. Cap $F$ at 50 for this query.

**Later:** supervised random walks (Backstrom & Leskovec, 2011), which learn the weights from which suggestions get accepted.

---

## 7. Feed ranking (`posts.feed`, People)

**The call for the hackathon: plain newest-first.** It is a friend feed, the demo depends on a friend's post appearing at the top within a second, and a re-ordered feed makes that look broken. Do not rank the feed today.

How to page it: `ctx.db.query("posts").order("desc").paginate(paginationOpts)` walks posts by creation time with a stable cursor. Filter each page to the viewer's own posts and accepted friends' posts that the viewer may see (`visibility` is not `private`, unless it is the viewer's own). Pages can come back short; `usePaginatedQuery` handles that and the screen just calls `loadMore` again. This is fine while total posts are in the thousands.

**Optional, only if everything else is done:** re-order *inside* one returned page. Page membership still comes from the time cursor, so paging stays stable.

$$
\text{feedScore} = e^{-\text{age}/\tau_f}\,\big(1 + 0.3\,\text{closeness} + 0.2\,\text{relevance} + 0.1\,[\text{has photo}]\big)
$$

- $\tau_f$ = 6 hours. Recency stays the main factor.
- closeness = $\max(0, \text{sim}(\mathbf t_u, \mathbf t_{\text{author}}))$.
- relevance = 1 if the place is within 5 km of the viewer's home city centre or in a category the viewer has ranked, else 0.

```ts
// convex/lib/social.ts
export function feedScore(p: { ageMs: number; closeness: number; relevant: boolean; hasPhoto: boolean }): number;
```

**Later:** write a `feedItems` row per friend when a post is created (fan-out on write) so a page never comes back short, and count reactions and comments between two people as closeness.

---

## 8. Cold start and exploration

| Case | What we know | What we do |
| --- | --- | --- |
| New user | 6 quiz answers | `quizToVector` → $\mathbf t_u$ and the prior $\mathbf t_u^{(0)}$. Every comparison then moves $\mathbf t_u$; the prior pulls back gently so one odd night can't wreck it. |
| New user, no quiz | nothing | `NEUTRAL_TASTE`: scores come from the crowd, quality and distance. |
| New place | category, tags, text | The featurizer's vector is the prior; `blendVector` (3b) replaces it as answers arrive; $\lambda_i = 0$, so the score is content only. |
| New event | title, performers, venue | Same, plus $P_{ui}$ from performers (section 4) and, if the event is at a known place, that place's blended vector as the prior. |
| New performer | genres | Performer vector from genres; spill-over from similar performers. |

**Exploration bonus.** A place with no ratings can't earn a crowd score unless someone goes, and nobody goes unless it is shown. So unrated places get a small boost in the **order** (never in the shown score), which fades as ratings arrive:

$$
E_i = \frac{c_E}{\sqrt{1 + n_i}}, \qquad c_E = 0.6
$$

This is the optimism rule from UCB (Auer et al., 2002; Li et al., 2010): act as if an uncertain option is as good as it plausibly could be, and the uncertainty shrinks like $1/\sqrt{n}$. It is deterministic, which a reactive query needs.

**One "new on clubi" slot.** If none of the top 5 has $n_i < 3$ (`NEW_ITEM_MAX_RATINGS`), slot 5 goes to the best-ordered item with $n_i < 3$ and content score ≥ 7 (`NEW_SLOT_MIN_CONTENT`), with the tag "New on clubi". If there is none, the list is left alone.

**Diversity for the top 5 (MMR).** Replace the 0.95 skip rule with maximal marginal relevance (Carbonell & Goldstein, 1998). Pick the best item first; then repeatedly pick

$$
\arg\max_i\ \Big[\mu\,\text{order}_i - (1-\mu)\cdot 10\cdot\max_{j \in \text{picked}} \max\big(0, \text{sim}(\mathbf f_i, \mathbf f_j)\big)\Big], \qquad \mu = 0.75
$$

The ×10 puts similarity on the score's scale. Also allow at most 3 of the 5 from one category (`TOP_MAX_PER_CATEGORY`). Run it over the best 30 by order, not the whole list.

```ts
// convex/lib/recs.ts
export const EXPLORE_C = 0.6, MMR_MU = 0.75, NEW_ITEM_MAX_RATINGS = 3;
export const exploreBonus = (n: number) => EXPLORE_C / Math.sqrt(1 + n);
export function mmrPick<T extends { order: number; vector: number[]; category: string }>(pool: T[], k: number): T[];
```

**Later:** Thompson sampling on $b_i$ (Chapelle & Li, 2011), with a per-user, per-day seed so the list is stable within a day. Picking which comparison to ask next by $\arg\min_j \lvert P(i \succ j) - \tfrac12\rvert$ (Jamieson & Nowak, 2011) instead of plain binary insertion.

---

## 9. Checking that it works

There are no real users yet, so we test against simulated ones whose true taste we know. One file, `tests/sim.test.mjs`, pure functions only, run by `npm test`, under 5 seconds, fixed seed (write a small `mulberry32` generator; never `Math.random()`).

**The world**

- 200 users. True taste $\boldsymbol\tau_u$ = one of 5 archetypes (club kid, dive-bar regular, foodie, culture-and-outdoors, live-music fan) plus noise (sd 0.12), clipped to $[0,1]$. Home city: 60% locals.
- 300 venues across the 6 categories. True vector $\boldsymbol\phi_i$, hidden quality $q_i \sim N(0, 0.5)$. **Featurizer guess** = $\boldsymbol\phi_i$ + noise (sd 0.25), clipped: this models bad keyword vectors.
- True enjoyment: $y_{ui} = \text{contentScore}(\boldsymbol\tau_u, \boldsymbol\phi_i) + q_i + N(0, 0.5)$.
- 20 performers with genre vectors; 60 of the venues are events with 1–2 performers; a user's true enjoyment gets +1.5 for a favourite performer.

**What users do**

- The quiz gives a coarse, noisy $\boldsymbol\tau_u$ (round each entry to the nearest of 0.2 / 0.5 / 0.9).
- Each user ranks 8–15 venues: bucket from $y$ (≥ 7 loved, ≤ 4 didn't, else fine), position by binary insertion using true $y$, which also produces the comparisons.
- After 40% of rankings they answer the insight questions: each answer is the option whose target is closest to $\phi_{ik}$ + noise (sd 0.15).
- Run the real update functions in time order: `updateTaste`, `nudgeTaste`, `updateElo`, `applyAnswers`, the affinity step.

**What to measure**, on 20% of each user's venues held out before training:

| Metric | Definition |
| --- | --- |
| Pairwise accuracy | of all held-out pairs $(i, j)$ for the same user, the share where the predicted order matches the order of $y$ |
| NDCG@10 | per user, over held-out venues plus 30 never-seen ones, gain = $\max(0, y - 5)$, averaged over users (Järvelin & Kekäläinen, 2002) |
| Vector error | mean absolute error between the vector the scorer uses and $\boldsymbol\phi_i$ |
| Group satisfaction | 100 random groups of 2–5; take the top pick; report the mean of true $y$ across members and the minimum |

**Compare** four models: quiz-only cosine, v3, v4, and v4 with one term switched off at a time.

**Targets** (record v3's numbers in the test output first, then assert):

- v4 pairwise accuracy ≥ v3 + 0.03, and NDCG@10 ≥ v3 + 0.02.
- Vector error for venues with ≥ 10 answers is at most half of the featurizer's error.
- For events with a favourite performer: v4 ranks them in the user's top 10 at least twice as often as v3.
- Group: v4's minimum satisfaction ≥ the average-only strategy + 0.5, while its mean drops by ≤ 0.2.
- No term makes things worse: switching any single term off must not *raise* pairwise accuracy by more than 0.005. If it does, lower that term's weight.

**What to tune, in this order:** `INSIGHT_N0` (3–8), `ALSO_IOTA` (0.3–1.0), `CROWD_HALF_WEIGHT` (2–5), `TASTE_ETA` (0.1–0.3), `GROUP_PSI` (0.3–0.8), `EXPLORE_C` (0.3–0.8; it should cost under 0.01 NDCG). Change one, re-run, keep it only if the target metric improves. Print a small table from the test so the numbers can go on the slide.

---

## 10. Papers

| Paper | Year | What we took | Where |
| --- | --- | --- | --- |
| Bradley & Terry, "Rank analysis of incomplete block designs: the method of paired comparisons" | 1952 | $P(i \text{ beats } j) = \sigma(x_i - x_j)$: the model behind every comparison | `updateTaste`, `updateElo` |
| Elo, *The Rating of Chessplayers, Past and Present* | 1978 | online rating update after each head-to-head | `updateElo` |
| Glickman, "Parameter estimation in large dynamic paired comparison experiments" | 1999 | ratings carry uncertainty; new items should move faster | $K_0/\sqrt{1+n}$ |
| Herbrich, Minka & Graepel, "TrueSkill: a Bayesian skill rating system" | 2006 | Bayesian skill with shrinking variance | exploration bonus; Later: Thompson sampling |
| Burges et al., "Learning to rank using gradient descent" (RankNet) | 2005 | a logistic step on a pair's score gap | `updateTaste` |
| Rendle et al., "BPR: Bayesian personalized ranking from implicit feedback" | 2009 | learn from "preferred over" pairs, not absolute ratings | taste step; Later: latent factors |
| Koren, Bell & Volinsky, "Matrix factorization techniques for recommender systems" | 2009 | user × item factors plus biases: our utility is this with named features | section 2 |
| Hu, Koren & Volinsky, "Collaborative filtering for implicit feedback datasets" | 2008 | weak signals count, with a confidence | saves and "going" in the order |
| Koren, "Collaborative filtering with temporal dynamics" | 2009 | taste drifts; recent evidence counts more | affinity moving average; pull toward the prior |
| Sarwar, Karypis, Konstan & Riedl, "Item-based collaborative filtering recommendation algorithms" | 2001 | item-to-item similarity from co-ratings | `alsoLovedTerm`, `alsoLoved` |
| Linden, Smith & York, "Amazon.com recommendations: item-to-item collaborative filtering" | 2003 | "people who liked X also liked Y" at scale | why line rule 5 |
| Jamieson & Nowak, "Active ranking using pairwise comparisons" | 2011 | a ranking needs about $\log n$ well-chosen comparisons | binary insertion in the rank flow |
| Ye, Yin, Lee & Lee, "Exploiting geographical influence for collaborative point-of-interest recommendation" | 2011 | willingness to travel falls off as a power law | `mapRank` distance term |
| Yuan, Cong, Ma, Sun & Magnenat-Thalmann, "Time-aware point-of-interest recommendation" | 2013 | what people want depends on the hour | `timeMatch` |
| Yin, Sun, Cui, Hu & Chen, "LCARS: a location-content-aware recommender system" | 2013 | mix personal taste with local preference when away from home | $\alpha$ for visitors |
| Ference, Ye & Lee, "Location recommendation for out-of-town users in location-based social networks" | 2013 | out-of-town users should lean on locals | `ALPHA_VISITOR_VIEWER`, trip local bonus |
| Ma, Zhou, Liu, Lyu & King, "Recommender systems with social regularization" | 2011 | friends' tastes are informative | `BETA_FRIEND` |
| Jamali & Ester, "A matrix factorization technique with trust propagation for recommendation in social networks" (SocialMF) | 2010 | trust spreads through the friend graph | friend weight; Later: latent model |
| Herlocker, Konstan & Riedl, "Explaining collaborative filtering recommendations" | 2000 | simple social explanations persuade best | why line rules 3–4 |
| Tintarev & Masthoff, "A survey of explanations in recommender systems" | 2007 | what an explanation is for: trust, transparency, a quicker decision | "never a score without a why" |
| Zhang & Chen, "Explainable recommendation: a survey and new perspectives" | 2020 | feature-level reasons read off an additive model | `topFeatures`, section 2.3 |
| Masthoff, "Group modeling: selecting a sequence of television items to suit a group of viewers" | 2004 | average, least misery, and fairness over a sequence | `groupScoreV4`, `nextWeights` |
| Masthoff, "Group recommender systems: combining individual models" | 2011 | survey of aggregation strategies | section 5 |
| O'Connor, Cosley, Konstan & Riedl, "PolyLens: a recommender system for groups of users" | 2001 | least misery works for small groups | $\beta\,r_{\min}$, the veto |
| Amer-Yahia, Roy, Chawla, Das & Yu, "Group recommendation: semantics and efficiency" | 2009 | consensus = relevance minus disagreement | $\psi\,s$ |
| Liben-Nowell & Kleinberg, "The link-prediction problem for social networks" | 2007 | neighbourhood measures predict new friendships well | section 6 |
| Adamic & Adar, "Friends and neighbors on the Web" | 2003 | weight a mutual friend by how rare they are | `adamicAdar` |
| Backstrom & Leskovec, "Supervised random walks: predicting and recommending links in social networks" | 2011 | learn the suggestion weights from accepts | Later |
| Auer, Cesa-Bianchi & Fischer, "Finite-time analysis of the multiarmed bandit problem" | 2002 | optimism bonus that shrinks like $1/\sqrt n$ | `exploreBonus` |
| Li, Chu, Langford & Schapire, "A contextual-bandit approach to personalized news article recommendation" | 2010 | exploration inside a personalised recommender | section 8 |
| Chapelle & Li, "An empirical evaluation of Thompson sampling" | 2011 | sample from the posterior to explore | Later |
| Carbonell & Goldstein, "The use of MMR, diversity-based reranking for reordering documents and producing summaries" | 1998 | trade relevance against similarity to what is already picked | `mmrPick` |
| Schein, Popescul, Ungar & Pennock, "Methods and metrics for cold-start recommendations" | 2002 | new items need content features | featurizer prior + `blendVector` |
| Rashid et al., "Getting to know you: learning new user preferences in recommender systems" | 2002 | ask about what is popular and divisive | `chooseQuestions` |
| Minkov, Charrow, Ledlie, Teller & Jaakkola, "Collaborative future event recommendation" | 2010 | events are always new: score them from content and people | section 4 |
| Macedo, Marinho & Santos, "Context-aware event recommendation in event-based social networks" | 2015 | combine who, where, when and text for events | $P_{ui}$, alerts |
| Järvelin & Kekäläinen, "Cumulated gain-based evaluation of IR techniques" | 2002 | NDCG | section 9 |
| Christiano et al., "Deep reinforcement learning from human preferences" | 2017 | modern AI learns what people want from the same pairwise comparisons | pitch |

---

## Pitch lines

- "Every ranking is a head-to-head comparison: the same Bradley–Terry math behind chess Elo and how modern AI learns human preferences."
- "Your taste updates on every comparison, live. The map re-sorts in under a second, with no training job."
- "Visitors see a city through locals with their taste. We weight a local's opinion double when you're from out of town."
- "Three taps after each rating turn guesses into measurements: after five answers a venue's profile is half real data, after twenty it's 80%."
- "Rate one Calvin Harris set a 9 and you'll hear the day he's booked near you."
- "For groups we don't average: we find the place nobody hates, and whoever compromised at the first stop gets more say at the next."
- "Every score comes with a reason, because the model is a sum you can read."
