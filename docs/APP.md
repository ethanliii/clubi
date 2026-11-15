# clubi app: the shared scaffold

For everyone building screens in `src/app/`. What each screen does is in [`UI-SPEC.md`](UI-SPEC.md); the backend's functions and types are in [`CONTRACT.md`](CONTRACT.md) and `convex/lib/contract.ts`. This file is the plumbing they share: routes, components, helpers, and the conventions that make it one app.

```bash
npx expo start            # Expo Go on iOS, or press w for web
npx tsc --noEmit          # types
npx expo lint             # lint (includes the React Compiler rules)
npm test                  # pure-logic tests, including tests/app.lib.test.mjs
```

**Shared files.** While several agents build screens at once, each edits only its own route files. Nobody edits `src/app/_layout.tsx`, `src/app/(onboarding)/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/components/*`, `src/lib/*`, `src/state/session.tsx`, `src/theme/*` or anything under `convex/`. Need something they lack? Build it inside your own screen file (or a folder under `src/features/<your-screen>/`) and say so in your report. Bryan owns the look: the theme and his components are his to change at any time.

## Who sees what

The backend decides, in `src/state/session.tsx`. The root layout shows a splash until it knows, so there is never a flash of the wrong screen.

| Gate | Means | Screens that exist |
| --- | --- | --- |
| `signedOut` | not signed in | `/welcome`, `/sign-in` |
| `quiz` | signed in, `users.me.onboarded === false` | `/quiz` (and `/taste-card`) |
| `tasteCard` | the quiz was saved in this session | everything, plus `/taste-card` until "Let's go" |
| `ready` | signed in and onboarded | the tabs and every other screen |

- **Never navigate after sign-in, sign-up or sign-out.** Call the auth function and stop; the gate moves the user (to the quiz, the tabs, or Welcome).
- The quiz saves with `api.users.saveQuiz`, then `router.push(paths.tasteCard)`. "Let's go" calls `useSession().finishOnboarding()`, which opens the Map tab.
- `useMe()` gives the signed-in user (`userId`, `username`, `displayName`, `avatarUrl`, `tasteSummary`, …), `undefined` while loading. A post is mine when `post.author.userId === me?.userId`.

## Routes

Build every path with `src/lib/links.ts`. Never write a path string in a screen.

| File in `src/app/` | Opens with | Params (`useLocalSearchParams`) |
| --- | --- | --- |
| `(onboarding)/welcome.tsx` | `paths.welcome` | |
| `sign-in.tsx` | `signInPath("signup" \| "signin")` | `mode` |
| `(onboarding)/quiz.tsx`, `taste-card.tsx` | `paths.quiz`, `paths.tasteCard` | |
| `(tabs)/index.tsx` Home | `paths.home` | |
| `(tabs)/map.tsx` | `paths.map` | |
| `(tabs)/rate.tsx` pick a spot | `paths.rate` | |
| `(tabs)/feed.tsx` | `paths.feed` | |
| `(tabs)/profile.tsx` | `paths.profile` | |
| `venue/[kind]/[id].tsx` | `venuePath(kind, id)` | `kind` (`place` \| `event`), `id` |
| `rate/[kind]/[id].tsx` rank one place | `ratePath(kind, id)` | `kind`, `id` |
| `post/[postId].tsx` | `postPath(postId)` | `postId` |
| `user/[userId].tsx` | `userPath(userId)` | `userId` |
| `compare/[userId].tsx` | `comparePath(userId)` | `userId` |
| `trip/[tripId].tsx` | `tripPath(tripId)` | `tripId` |
| `performer/[performerId].tsx` | `performerPath(performerId)` | `performerId` |
| `plan.tsx` | `planPath()` or `planPath(tripId)` | `tripId?` |
| `rankings.tsx` | `rankingsPath()` or `rankingsPath(category)` | `category?` |
| `notifications.tsx`, `friends.tsx`, `settings.tsx`, `saved.tsx`, `trips.tsx`, `following.tsx` | `paths.notifications`, … | |
| `+not-found.tsx` | any unknown address | |

UI-SPEC says "Rank this place" goes to `/rate?kind=&id=`. In this app it is `ratePath(kind, id)`; `(tabs)/rate.tsx` is only the "pick a spot" step and pushes `ratePath` when a row is tapped.

Params arrive as strings. Cast once at the top of the screen: `const { kind, id } = useLocalSearchParams<{ kind: Kind; id: string }>();` then `id as Id<"places">` where a call wants an id type.

## Components (`import { … } from "../components"`)

Bryan's foundation, unchanged: `Screen`, `Text`, `Button`, `Icon`, `ScoreBadge`, `MatchBadge`, `VenuePhoto`, `BackButton`. `Icon` gained more names in the same stroke style (`search`, `close`, `check`, `chevron`, `heart`, `heartFilled`, `comment`, `send`, `more`, `gear`, `edit`, `trash`, `camera`, `bookmark`, `star`, `thumbUp`, `thumbDown`, `users`, `calendar`, `clock`, `music`, `ticket`, `navigate`, `locate`, `external`, `lock`, `globe`, `info`, …).

| Component | One-line usage |
| --- | --- |
| `Header` | `<Header title="Friends" right={<IconButton … />} />` first child of `Screen`. Tab screens pass `back={false}`. |
| `IconButton` | `<IconButton icon="bell" accessibilityLabel="Notifications" badge={formatCount(n)} onPress={…} />` (label is required). |
| `TextField` | `<TextField label="Display name" value={v} onChangeText={setV} error={err} />` takes every `TextInput` prop. |
| `Chip`, `ChipRow` | `<ChipRow scroll><Chip label="Bars" accessibilityLabel="Filter: Bars" selected={on} onPress={…} /></ChipRow>`. No `onPress` = a plain tag; `size="sm"` for facts on cards. |
| `Avatar`, `AvatarStack` | `<Avatar name={user.displayName} uri={user.avatarUrl} size={40} />`, `<AvatarStack people={item.friends} />`. |
| `Loading` | `<Loading />` centered spinner; `<Loading compact label="Loading more" />` for a list footer. |
| `Skeleton`, `SkeletonRows`, `SkeletonCards` | `<SkeletonRows count={5} />` for lists, `<SkeletonCards />` for card rows, `<Skeleton width={120} height={20} />` for anything else. |
| `EmptyState` | `<EmptyState title="Your feed is quiet." body="Add friends to see what they rank." actionLabel="Find friends" onAction={…} />`. |
| `ListRow` | `<ListRow title={name} subtitle={reason} left={<Avatar … />} right={<Button title="Add" style={{ width: "auto" }} … />} onPress={…} />`. |
| `SectionHeader` | `<SectionHeader title="Bars" actionLabel="See all" onAction={…} />`, or `count={2}` for "Requests (2)". |
| `Sheet` | `<Sheet visible={open} onClose={() => setOpen(false)} title="Who sees it">…</Sheet>` bottom sheet on web and native. `scroll={false}` when the content is its own list. |
| `ItemCard` | `<ItemCard item={nearbyItem} />` list row; `variant="card"` for sideways rows; `showRank` on the map list. Opens the venue unless you pass `onPress`. Children go at the bottom (member scores, votes). |
| `Meter` | `<Meter label="Chill" value={70} />` (percent) or `<Meter label="Energy" value={8.4} max={10} />`. |
| `ToastProvider`, `useToast` | `const toast = useToast(); toast("Saved", "success");` kinds: `info`, `success`, `error`. |
| `ErrorBoundary` | Already around every route. Wrap a risky part of a screen in another to keep the rest alive. |
| `Splash` | Root layout only. |

`Button` is full width. Inside a row give it `style={{ width: "auto" }}` or `style={{ flex: 1 }}`.

## Helpers (`src/lib/`, `src/state/`)

| Import | One-line usage |
| --- | --- |
| `lib/api` | `import { api, type NearbyItem, type Id, type Kind, type Me } from "../lib/api";` the Convex `api` and every contract type. |
| `lib/useMutationToast` | `const { run, pending } = useMutationToast(api.saves.toggle, { success: "Saved" });` then `const result = await run({ kind, id, type: "want" });` It never throws: on failure it toasts the backend's sentence and returns `undefined`. |
| `lib/errors` | `errorMessage(error)` the readable sentence from anything thrown (strips Convex's wrapper). `authErrorMessage(result.userError)` for sign-in, sign-up and change-password results. |
| `lib/links` | `router.push(venuePath(item.kind, item.id))`; `openLink(notification.link)` (returns false when there is nowhere to go); `openUrl(ticketUrl)`; `directionsUrl(lat, lng, name)`. |
| `lib/format` | `formatDistance(m)` "350 m", `formatScore(n)` "8.7", `formatPrice(level)` "$$", `formatEventTime(ms)` "Sat Dec 5 · 9:30 PM", `formatDateRange(start, end)` "Mar 12–15", `formatRelativeTime(ms, now)` "2h", `formatCount(n)` "99+", `pluralize(n, "friend")`, `categoryLabel(category, subcategory)`, `categoryHue(category)`, `CATEGORY_TABS`, `initials(name)`. |
| `lib/useNow` | `const now = useNow();` the time, refreshed each minute. Use it instead of `Date.now()` in a component (the linter rejects that). |
| `lib/useDebounced` | `const text = useDebounced(input, 300);` for search boxes; query only when `text.trim().length >= 2`. |
| `lib/confirm` | `if (await confirm({ title: "Delete post?", confirmLabel: "Delete", destructive: true })) …` works on web too (`Alert.alert` does not). |
| `lib/photos` | `const photo = await pickPhoto(); const storageId = await uploadPhoto(await generateUploadUrl(), photo);` |
| `lib/demoLocation`, `lib/useNearby` | `const { lat, lng, ready, isDemo, setDemo } = useDemoLocation();` `const nearby = useNearby(filter);` (unchanged). |
| `state/session` | `useMe()`, `useSession()` (see "Who sees what"). |

## Conventions

**Data.** Screens render what the backend returns. Never compute a score, rank, order, match % or reason. Lists arrive sorted. Before calling a function, open its file in `convex/` and read `args`: Convex rejects unknown arguments, so leave optional ones out rather than passing `undefined` keys you are unsure of.

**Loading.** `useQuery` returns `undefined` first. Show skeletons in the shape of the real thing (`SkeletonRows`, `SkeletonCards`), never "nothing here" and never an error. Wait for location with `"skip"`: `useQuery(api.discover.tonight, ready ? { lat, lng } : "skip")`. `null` means gone: show an `EmptyState` with a "Back" button (`goBack` from components).

**Empty.** A friendly `EmptyState` with the exact sentence from UI-SPEC and, where it names one, a button. Hide a section whose list is empty.

**Errors.** Every mutation goes through `useMutationToast` (or `try`/`catch` with `toast(errorMessage(error), "error")`). Show `errorMessage(error)`, not the raw `error.message`, which carries Convex's "[CONVEX M(…)] Server Error / Uncaught Error:" wrapper. Form problems show under the fields (`TextField error=`). A switch flips right away and flips back if the call fails.

**Pending.** Disable the button while `pending` is true. Keep its label the same (tests find buttons by label).

**Labels.** Use the exact button text from UI-SPEC. Every `Pressable` gets an `accessibilityLabel`; for icon-only buttons it is the label UI-SPEC names ("Notifications", "Like", "Comments", "Vote up"). Filter chips show "Bars" and are labelled "Filter: Bars".

**Live data.** No pull-to-refresh, no refetch, no copies of server data in state.

**Web and iOS.** Everything must run in Expo Go and with `npx expo start --web`. No `window`/`document` on the native path and no native-only module on the web path; when they must differ, write `Thing.native.tsx` and `Thing.web.tsx`. Use `confirm()` instead of `Alert.alert`, `Sheet` instead of a hand-rolled modal, `openUrl()` instead of `window.open`. On a wide browser window the app is a phone-width column; lay out for a phone.

**Look.** Colors, spacing, radius and type come from `src/theme`. Tap targets are at least 40 tall. Lists of rows use `ListRow` or `ItemCard`; screens start with `Header` inside `Screen`.

**Lint.** `Date.now()`, `Math.random()` and reading or writing a ref while rendering are errors (React Compiler rules). Do them in an event handler or an effect, or use `useNow()`.
