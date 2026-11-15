import assert from "node:assert/strict";
import { test } from "node:test";
import { backend, fixtures, load } from "./people.harness.mjs";

const saves = await load("saves");

async function world() {
  const t = backend();
  const f = fixtures(t);
  const me = await f.user("ethan");
  const other = await f.user("bryan");
  const bar = await f.place("Zeitgeist", { imageUrl: "https://img.test/z.jpg" });
  const cafe = await f.place("Sightglass", { category: "food" });
  const show = await f.event("Late Show", { start: 1_900_000_000_000 });
  const toggle = (userId, kind, id, type) => t.run(saves.toggle, userId, { kind, id, type });
  return { t, me, other, bar, cafe, show, toggle };
}

test("toggle saves and unsaves; want and going are separate; going is for events", async () => {
  const { t, me, bar, show, toggle } = await world();
  assert.deepEqual(await toggle(me, "place", bar, "want"), { saved: true });
  assert.deepEqual(await toggle(me, "event", show, "want"), { saved: true });
  assert.deepEqual(await toggle(me, "event", show, "going"), { saved: true });
  assert.equal(t.all("saves").length, 3);
  assert.deepEqual(await toggle(me, "event", show, "want"), { saved: false });
  assert.deepEqual(t.all("saves").map((row) => [row.targetId, row.type]), [[bar, "want"], [show, "going"]]);
  await assert.rejects(toggle(me, "place", bar, "going"), /only mark events/);
  await assert.rejects(toggle(null, "place", bar, "want"), /Not signed in/);
  await t.db.delete(bar);
  // Something that no longer exists can still be unsaved, but not saved.
  assert.deepEqual(await toggle(me, "place", bar, "want"), { saved: false });
  await assert.rejects(toggle(me, "place", bar, "want"), /isn't available/);
});

test("list is mine only, newest first, filtered by type, with what a card needs", async () => {
  const { t, me, other, bar, cafe, show, toggle } = await world();
  await toggle(me, "place", bar, "want");
  await toggle(me, "event", show, "going");
  await toggle(me, "place", cafe, "want");
  await toggle(other, "place", cafe, "want");
  for (const [index, row] of t.all("saves").entries()) await t.db.patch(row._id, { createdAt: 100 + index });

  const all = await t.run(saves.list, me, {});
  assert.deepEqual(all.map((item) => [item.name, item.type]), [["Sightglass", "want"], ["Late Show", "going"], ["Zeitgeist", "want"]]);
  assert.deepEqual(all[2], { kind: "place", id: bar, name: "Zeitgeist", category: "nightlife", type: "want", createdAt: 100,
    startsAt: undefined, imageUrl: "https://img.test/z.jpg", lat: 37.76, lng: -122.39 });
  assert.equal(all[1].startsAt, 1_900_000_000_000);
  assert.deepEqual((await t.run(saves.list, me, { type: "want" })).map((item) => item.name), ["Sightglass", "Zeitgeist"]);
  assert.deepEqual((await t.run(saves.list, me, { type: "going" })).map((item) => item.name), ["Late Show"]);
  assert.equal((await t.run(saves.list, other, {})).length, 1);
  assert.deepEqual(await t.run(saves.list, null, {}), []);
  await t.db.delete(cafe);
  assert.equal((await t.run(saves.list, me, {})).length, 2);
});

test("under-21 users can't save nightlife and never get it back in the list", async () => {
  const { t, me, bar, cafe, toggle } = await world();
  await toggle(me, "place", bar, "want");
  await toggle(me, "place", cafe, "want");
  await t.db.patch(me, { birthday: `${new Date().getUTCFullYear() - 20}-01-01` });
  assert.deepEqual((await t.run(saves.list, me, {})).map((item) => item.name), ["Sightglass"]);
  await toggle(me, "place", bar, "want");
  await assert.rejects(toggle(me, "place", bar, "want"), /isn't available/);
});
