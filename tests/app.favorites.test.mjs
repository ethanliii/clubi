// Favorites on a profile: only what the person marked (src/lib/favorites.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FAVORITES, shownFavorites, toggleFavorite } from "../src/lib/favorites.ts";

test("marking adds a favorite at the end, marking again removes it", () => {
  assert.deepEqual(toggleFavorite([], "a"), { ids: ["a"], full: false });
  assert.deepEqual(toggleFavorite(["a", "b"], "c"), { ids: ["a", "b", "c"], full: false });
  assert.deepEqual(toggleFavorite(["a", "b", "c"], "b"), { ids: ["a", "c"], full: false });
});

test("a tenth favorite is refused, and one can still be removed at the limit", () => {
  const nine = Array.from({ length: MAX_FAVORITES }, (_, index) => `p${index}`);
  assert.equal(MAX_FAVORITES, 9);
  assert.deepEqual(toggleFavorite(nine, "extra"), { ids: nine, full: true });
  assert.deepEqual(toggleFavorite(nine, "p0").ids, nine.slice(1));
});

test("toggling never changes the list it was given", () => {
  const ids = ["a"];
  toggleFavorite(ids, "b");
  toggleFavorite(ids, "a");
  assert.deepEqual(ids, ["a"]);
});

test("nobody has favorites until they mark some", () => {
  assert.deepEqual(shownFavorites([], {}), { posts: [], loading: false });
  assert.deepEqual(shownFavorites(undefined, {}), { posts: [], loading: true });
});

test("favorites show in the order they were marked, not by score", () => {
  const byId = { low: { name: "Low", score: 4.1 }, high: { name: "High", score: 9.8 } };
  assert.deepEqual(shownFavorites(["low", "high"], byId).posts.map((post) => post.name), ["Low", "High"]);
});

test("a deleted or hidden post, or one that failed to load, is left out", () => {
  const byId = { gone: null, broken: new Error("nope"), ok: { name: "Ok" } };
  assert.deepEqual(shownFavorites(["gone", "broken", "ok"], byId), { posts: [{ name: "Ok" }], loading: false });
});

test("still loading while a marked post has not arrived", () => {
  assert.deepEqual(shownFavorites(["a", "b"], { a: { name: "A" } }), { posts: [{ name: "A" }], loading: true });
});
