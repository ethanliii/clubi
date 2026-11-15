// Runs the real import actions against the real sites, with an in-memory database standing in for
// Convex. Nothing is deployed and nothing is written anywhere. Not part of `npm test`: it uses the
// network, at the same polite pace as the imports themselves.
//
//   node tests/fixtures/live-run.mjs osm luma partiful eventbrite ticketmaster google
//
// Keys are read from the environment, as on Convex (EVENTBRITE_TOKEN, TICKETMASTER_KEY,
// GOOGLE_MAPS_KEY); an import without its key reports that it skipped.
import { actionCtx, fakeCtx, run } from "./fakeDb.mjs";
import { load } from "./load.mjs";

const db = fakeCtx();
const batches = [];
let worstBatch = { reads: 0, writes: 0, rows: 0 };
const action = actionCtx(db, (module, name, args, _result, used) => {
  if (module !== "ingest" || name !== "upsertBatch") return;
  batches.push(structuredClone(args));
  if (used.reads > worstBatch.reads) worstBatch = { ...used, rows: args.rows.length };
});

// PARTIFUL_URL=https://partiful.com/e/<id> also reads that public event page and the similar events it names.
if (process.env.PARTIFUL_URL) {
  const { setPartifulUrls } = await load("imports/partiful");
  console.log("partiful urls:", JSON.stringify(await run(setPartifulUrls, db, { urls: [process.env.PARTIFUL_URL] })));
}

const SOURCES = {
  osm: ["imports/osm", "importOsm", { lat: 37.7716, lng: -122.4136, radiusMeters: 1500 }],
  luma: ["imports/luma", "importLuma", {}],
  partiful: ["imports/partiful", "importPartiful", {}],
  eventbrite: ["imports/eventbrite", "importEventbrite", { detailLimit: 5 }],
  ticketmaster: ["imports/ticketmaster", "importTicketmaster", {}],
  google: ["imports/google", "enrichPlaces", { limit: 3 }],
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
for (const source of wanted) {
  if (!SOURCES[source]) throw new Error(`Unknown source "${source}"`);
  const [module, name, args] = SOURCES[source];
  const started = Date.now();
  try {
    const result = await run((await load(module))[name], action, args);
    console.log(`\n== ${source} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    console.log(JSON.stringify(result, null, 1));
  } catch (error) {
    console.log(`\n== ${source} FAILED after ${((Date.now() - started) / 1000).toFixed(1)}s: ${error?.stack ?? error}`);
  }
}

// The same rows a second time must change nothing.
const { upsertBatch } = await load("ingest");
const second = { inserted: 0, updated: 0, replaced: 0, unchanged: 0, duplicate: 0, dropped: 0 };
for (const args of batches) {
  const counts = await run(upsertBatch, db, args);
  for (const key of Object.keys(second)) second[key] += counts[key];
}
console.log("\n== second pass over the same rows (inserted, updated and replaced should be 0)");
console.log(JSON.stringify(second));
console.log("\n== busiest single write: ", JSON.stringify(worstBatch), "(Convex allows about 32,000 documents read in one mutation)");

const { stats } = await load("catalog");
console.log("\n== catalog stats");
console.log(JSON.stringify(await run(stats, db, {}), null, 1));

const events = db.all("events").sort((a, b) => a.start - b.start);
console.log(`\n== events (${events.length})`);
for (const e of events) {
  console.log(
    [
      new Date(e.start).toISOString().slice(5, 16),
      e.source.padEnd(10),
      e.category.padEnd(9),
      e.title.slice(0, 46).padEnd(46),
      (e.venueName ?? "").slice(0, 22).padEnd(22),
      e.placeId ? "place✓" : "      ",
      e.price === undefined ? "    " : String(e.price).padStart(4),
      (e.performerNames ?? []).join(", "),
      e.otherUrls ? `+${e.otherUrls.length} url` : "",
    ].join(" | "),
  );
}
console.log(`\n== performers (${db.all("performers").length})`);
for (const p of db.all("performers")) console.log(`${p.name} | ${p.kind ?? ""} | ${(p.genres ?? []).join(", ")} | ${p.source}`);

// The public performer functions, as a signed-in user, on whatever the imports found.
const performers = await load("performers");
const [someone] = db.all("performers");
if (someone) {
  const userId = await db.db.insert("users", { username: "live-run", homeCity: "San Francisco" });
  const me = db.as(userId);
  const word = someone.name.split(" ")[0];
  console.log(`\n== performers.search("${word}")`);
  console.log(JSON.stringify(await run(performers.search, me, { text: word }), null, 1));
  await run(performers.follow, me, { performerId: someone._id, follow: true });
  console.log("== performers.following() after follow");
  console.log(JSON.stringify(await run(performers.following, me, {})));
  console.log("== alertRecentFans()", JSON.stringify(await run(performers.alertRecentFans, db, {})));
  console.log(JSON.stringify(db.all("notifications").map(({ type, title, body, link }) => ({ type, title, body, link })), null, 1));
}
