import { ConvexError } from "convex/values";

const FALLBACK = "Something went wrong";

/**
 * The sentence to show a user for anything a mutation or action threw.
 *
 * Convex wraps a thrown `Error("Not signed in")` as
 * "[CONVEX M(users:saveQuiz)] [Request ID: …] Server Error\nUncaught Error: Not signed in\n    at handler (…)".
 * This returns just "Not signed in".
 */
export function errorMessage(error: unknown, fallback: string = FALLBACK): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string" && data.trim() !== "") return data;
    if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (raw.trim() === "") return fallback;

  const uncaught = raw.match(/Uncaught (?:[A-Za-z]*Error): ([^\n]+)/);
  if (uncaught) return uncaught[1].trim();

  const firstLine = raw
    .replace(/^\[CONVEX [^\]]+\]\s*/, "")
    .replace(/^\[Request ID: [^\]]+\]\s*/, "")
    .split("\n")[0]
    .trim();
  if (firstLine === "" || firstLine === "Server Error") return fallback;
  return firstLine;
}

/** What Convex Auth's sign-in, sign-up and change-password calls put in `result.userError`. */
type AuthUserError = { error: string; minimumLength?: number; maximumLength?: number; cause?: unknown };

/**
 * A sentence for a failed sign-in, sign-up or password change:
 *   if (result.status === "error") setError(authErrorMessage(result.userError));
 */
export function authErrorMessage(userError: AuthUserError): string {
  switch (userError.error) {
    case "INVALID_CREDENTIALS":
      return "Wrong username or password.";
    case "USER_NOT_FOUND":
      return "No account with that username.";
    case "USERNAME_TAKEN":
      return "That username is taken. Try another.";
    case "USERNAME_TOO_SHORT":
      return userError.minimumLength
        ? `Username must be at least ${userError.minimumLength} characters.`
        : "That username is too short.";
    case "USERNAME_TOO_LONG":
      return userError.maximumLength
        ? `Username must be at most ${userError.maximumLength} characters.`
        : "That username is too long.";
    case "USERNAME_HAS_SURROUNDING_WHITESPACE":
      return "Username can't start or end with a space.";
    case "USERNAME_HAS_INVALID_CHARACTERS":
      return "That username has characters we can't use. Stick to letters, numbers and underscores.";
    case "PASSWORD_TOO_SHORT":
      return userError.minimumLength
        ? `Password must be at least ${userError.minimumLength} characters.`
        : "That password is too short.";
    case "PASSWORD_TOO_LONG":
      return userError.maximumLength
        ? `Password must be at most ${userError.maximumLength} characters.`
        : "That password is too long.";
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
      return "Password can't start or end with a space.";
    case "RATE_LIMITED":
      return "Too many tries. Wait a minute and try again.";
    case "OTHER_ERROR":
      return errorMessage(userError.cause, "Could not reach Vioma. Check your connection and try again.");
    default:
      return FALLBACK;
  }
}
