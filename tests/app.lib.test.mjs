// Display helpers the screens share: src/lib/format.ts and src/lib/errors.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConvexError } from "convex/values";
import { authErrorMessage, errorMessage } from "../src/lib/errors.ts";
import {
  categoryLabel,
  formatClock,
  formatCount,
  formatDateRange,
  formatDay,
  formatDistance,
  formatEventTime,
  formatPrice,
  formatRelativeTime,
  formatScore,
  initials,
  pluralize,
} from "../src/lib/format.ts";

test("errorMessage pulls the sentence out of a Convex error", () => {
  const wrapped = new Error(
    "[CONVEX M(users:saveQuiz)] [Request ID: 16081d5c9c64da87] Server Error\nUncaught Error: Not signed in\n    at handler (../../convex/users.ts:145:14)\n\n  Called by client",
  );
  assert.equal(errorMessage(wrapped), "Not signed in");
  assert.equal(errorMessage(new Error("Plain sentence")), "Plain sentence");
  assert.equal(errorMessage(new ConvexError("Only friends can be invited")), "Only friends can be invited");
  assert.equal(errorMessage(new ConvexError({ message: "Trip is full" })), "Trip is full");
  assert.equal(errorMessage(undefined), "Something went wrong");
  assert.equal(errorMessage(new Error("[CONVEX M(a:b)] [Request ID: x] Server Error")), "Something went wrong");
  assert.equal(
    errorMessage(
      new Error(
        "[CONVEX M(notifications:markAllRead)] [Request ID: c6] Server Error\nArgumentValidationError: Object contains extra field `bogus` that is not in the validator.\n\nObject: {bogus: 1.0}",
      ),
      "Could not save",
    ),
    "Could not save",
  );
});

test("authErrorMessage turns sign-in codes into sentences", () => {
  assert.equal(authErrorMessage({ error: "INVALID_CREDENTIALS" }), "Wrong username or password.");
  assert.equal(authErrorMessage({ error: "USERNAME_TAKEN" }), "That username is taken. Try another.");
  assert.match(authErrorMessage({ error: "PASSWORD_TOO_SHORT", minimumLength: 8 }), /at least 8/);
  assert.equal(
    authErrorMessage({ error: "OTHER_ERROR", cause: new Error("Uncaught Error: birthday must be YYYY-MM-DD\n  at x") }),
    "birthday must be YYYY-MM-DD",
  );
});

test("distance, score, price, counts", () => {
  assert.equal(formatDistance(234), "230 m");
  assert.equal(formatDistance(3), "10 m");
  assert.equal(formatDistance(1240), "1.2 km");
  assert.equal(formatDistance(12400), "12 km");
  assert.equal(formatScore(8.66), "8.7");
  assert.equal(formatScore(9), "9.0");
  assert.equal(formatPrice(2), "$$");
  assert.equal(formatPrice(undefined), "");
  assert.equal(formatCount(3), "3");
  assert.equal(formatCount(132), "99+");
  assert.equal(pluralize(1, "friend"), "1 friend");
  assert.equal(pluralize(4, "person", "people"), "4 people");
});

test("dates and times", () => {
  const now = new Date(2026, 10, 15, 14, 0).getTime(); // Sun Nov 15 2026, 2 PM local
  assert.equal(formatClock(new Date(2026, 10, 15, 21, 0).getTime()), "9 PM");
  assert.equal(formatClock(new Date(2026, 10, 15, 0, 5).getTime()), "12:05 AM");
  assert.equal(formatDay(new Date(2026, 10, 15, 23, 0).getTime(), now), "Today");
  assert.equal(formatDay(new Date(2026, 10, 16, 1, 0).getTime(), now), "Tomorrow");
  assert.equal(formatEventTime(new Date(2026, 11, 5, 21, 30).getTime(), now), "Sat Dec 5 · 9:30 PM");
  assert.equal(formatDay(new Date(2027, 2, 12).getTime(), now), "Fri Mar 12, 2027");
  assert.equal(formatDateRange(new Date(2027, 2, 12).getTime(), new Date(2027, 2, 15).getTime()), "Mar 12–15");
  assert.equal(formatDateRange(new Date(2027, 2, 30).getTime(), new Date(2027, 3, 2).getTime()), "Mar 30 – Apr 2");
  assert.equal(formatDateRange(new Date(2027, 2, 12).getTime(), undefined), "Mar 12");
  assert.equal(formatDateRange(undefined, undefined), "");
  assert.equal(formatRelativeTime(now - 20_000, now), "now");
  assert.equal(formatRelativeTime(now - 5 * 60_000, now), "5m");
  assert.equal(formatRelativeTime(now - 2 * 3_600_000, now), "2h");
  assert.equal(formatRelativeTime(now - 3 * 86_400_000, now), "3d");
  assert.equal(formatRelativeTime(new Date(2026, 9, 1).getTime(), now), "Oct 1");
});

test("names and categories", () => {
  assert.equal(initials("Ethan Li"), "EL");
  assert.equal(initials("ethan_test"), "E");
  assert.equal(initials("  "), "?");
  assert.equal(categoryLabel("food", "cafe"), "Cafe");
  assert.equal(categoryLabel("nightlife"), "Nightlife");
  assert.equal(categoryLabel("popup", "night_market"), "Night market");
});
