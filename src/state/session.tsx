/**
 * Who is using the app and which part of it they may see. The backend decides:
 * Convex Auth says whether someone is signed in, and `api.users.me` says whether they finished the quiz.
 *
 *   signedOut  → welcome and sign-in
 *   quiz       → signed in, `users.me.onboarded === false`: the quiz
 *   tasteCard  → the quiz was just saved in this session: the app is open, and the taste card is
 *                still showing until the user taps "Let's go"
 *   ready      → signed in and onboarded: the tabs and every other screen
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Me } from "../lib/api";
import { paths } from "../lib/links";

export type Gate = "signedOut" | "quiz" | "tasteCard" | "ready";

type Session = {
  /** null until the first answer from the backend: show the splash, nothing else. */
  gate: Gate | null;
  /** The signed-in user. undefined while loading, null when signed out. */
  me: Me | null | undefined;
  /**
   * Where a signed-in, onboarded user is sent from a screen that is no longer theirs (welcome,
   * sign-in, the quiz): the Feed, the tab the app opens on.
   */
  landing: Href;
  /** "Let's go" on the taste card: opens the Feed tab and closes onboarding for good. */
  finishOnboarding: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  // Asked only once signed in, so the answer can never be a stale signed-out `null`.
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const [inOnboarding, setInOnboarding] = useState(false);
  const [settled, setSettled] = useState<Gate | null>(null);

  let live: Gate | "loading";
  if (isLoading) live = "loading";
  else if (!isAuthenticated) live = "signedOut";
  else if (me === undefined) live = "loading";
  else if (me === null) live = "signedOut";
  else if (!me.onboarded) live = "quiz";
  else live = inOnboarding ? "tasteCard" : "ready";

  // Remember that this session went through the quiz, so the taste card can show after
  // `users.saveQuiz` flips `onboarded` to true. Forgotten on "Let's go" and on sign-out.
  if (live === "quiz" && !inOnboarding) setInOnboarding(true);
  if (live === "signedOut" && inOnboarding) setInOnboarding(false);
  // While something reloads (signing in, a token refresh) keep the last settled answer,
  // so the screen underneath never flashes to the wrong one.
  if (live !== "loading" && live !== settled) setSettled(live);
  const gate = live === "loading" ? settled : live;

  // Signed in but the account is gone (deleted here or on another device): drop the session.
  const orphaned = !isLoading && isAuthenticated && me === null;
  useEffect(() => {
    if (orphaned) void signOut();
  }, [orphaned, signOut]);

  // Closing onboarding also closes the taste card's route guard, and a closed guard redirects by
  // itself. That redirect and the `replace` below are queued in an order the router decides, so
  // both must name the same screen: the Feed.
  const finishOnboarding = useCallback(() => {
    setInOnboarding(false);
    router.replace(paths.feed);
  }, []);
  const landing: Href = paths.feed;

  const value = useMemo<Session>(
    () => ({ gate, me: isAuthenticated ? me : null, landing, finishOnboarding }),
    [gate, me, isAuthenticated, landing, finishOnboarding],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}

/**
 * The signed-in user from `api.users.me` (`userId`, `username`, `displayName`, `avatarUrl`, `tasteSummary`, …).
 * undefined while loading. Inside the tabs and stack screens it is otherwise always set.
 */
export function useMe(): Me | undefined {
  return useSession().me ?? undefined;
}
