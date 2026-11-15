import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./fixtures/load.mjs";

const {
  ALERT_MAX_PER_DAY, FOLLOW_FLOOR, affinityStep, alertText, blendVectors, cityCenter, effectiveAffinity, formatEventDay,
  genresToVector, isNearHome, nameKeys, normalizePerformerName, parsePerformers, performerBoost, performerSimilarity,
  sameName, shouldAlert, titleNamesLineup,
} = await load("lib/performers");
const { FEATURES } = await load("lib/recs");

const f = (name) => FEATURES.indexOf(name);
const DAY = 24 * 60 * 60 * 1000;

test("normalizePerformerName folds case, accents, punctuation, & and a leading The", () => {
  assert.equal(normalizePerformerName("  The Chainsmokers "), "chainsmokers");
  assert.equal(normalizePerformerName("Beyoncé"), "beyonce");
  assert.equal(normalizePerformerName("Above & Beyond"), "above and beyond");
  assert.equal(normalizePerformerName("DJ Snake"), "dj snake");
  assert.equal(normalizePerformerName("AC/DC"), "ac dc");
  assert.equal(normalizePerformerName("Guns N' Roses"), "guns n roses");
  assert.equal(normalizePerformerName("坂本龍一"), "坂本龍一");
  assert.equal(normalizePerformerName("!!!"), "!!!");
});

test("sameName: equal, DJ-insensitive, one typo for long names only", () => {
  assert.ok(sameName("Calvin Harris", "calvin harris"));
  assert.ok(sameName("DJ Shadow", "Shadow"));
  assert.ok(sameName("Calvin Haris", "Calvin Harris"));
  assert.ok(sameName("Khruangbin", "Khruangbinn"));
  assert.ok(!sameName("Muse", "Mute"));
  assert.ok(!sameName("Calvin Harris", "Kevin Harris"));
  assert.ok(!sameName("", ""));
  assert.deepEqual(nameKeys("DJ Shadow"), ["dj shadow", "shadow"]);
  assert.deepEqual(nameKeys("Shadow"), ["shadow", "dj shadow"]);
});

test("parsePerformers reads the line-up forms in the brief", () => {
  assert.deepEqual(parsePerformers("Calvin Harris at The Midway"), ["Calvin Harris"]);
  assert.deepEqual(parsePerformers("DJ X b2b DJ Y"), ["DJ X", "DJ Y"]);
  assert.deepEqual(parsePerformers("Bonobo w/ Tourist"), ["Bonobo", "Tourist"]);
  assert.deepEqual(parsePerformers("Dirtybird presents: Claude VonStroke"), ["Claude VonStroke"]);
  assert.deepEqual(parsePerformers("Fisher, Chris Lake + Dom Dolla"), ["Fisher", "Chris Lake", "Dom Dolla"]);
  assert.deepEqual(parsePerformers("Kaytranada feat. Channel Tres"), ["Kaytranada", "Channel Tres"]);
  assert.deepEqual(parsePerformers("Peggy Gou @ 1015 Folsom (21+)"), ["Peggy Gou"]);
  assert.deepEqual(parsePerformers("Four Tet x Floating Points - Great American Music Hall"), ["Four Tet", "Floating Points"]);
  assert.deepEqual(parsePerformers("Mitski: Live in San Francisco"), ["Mitski"]);
  assert.deepEqual(parsePerformers("Tycho World Tour 2026"), ["Tycho"]);
  assert.deepEqual(parsePerformers("Rüfüs Du Sol | Bill Graham Civic"), ["Rüfüs Du Sol"]);
});

test("parsePerformers is conservative", () => {
  for (const title of [
    "Sunday Farmers Market",
    "Tech Founders Mixer",
    "Intro to Pottery",
    "Khruangbin",
    "Happy Hour at Zeitgeist",
    "Trivia Night @ The Page",
    "Food, Wine + Friends",
    "Jazz Night w/ Friends",
    "Run Club & Coffee",
    "Dinner at Nopa",
    "Friday Night Live - DJ Snake",
    "",
    "   ",
    "(21+)",
  ]) {
    assert.deepEqual(parsePerformers(title), [], title);
  }
});

test("parsePerformers: solo, filler, known names, the cap of 5 and duplicates", () => {
  assert.deepEqual(parsePerformers("Khruangbin", { solo: true }), ["Khruangbin"]);
  assert.deepEqual(parsePerformers("Emo Night Brooklyn", { solo: true }), []);
  assert.deepEqual(parsePerformers("Beginner Guitar Lessons", { solo: true }), []);
  assert.deepEqual(parsePerformers("Disclosure + special guests at The Greek"), ["Disclosure"]);
  assert.deepEqual(parsePerformers("ODESZA & more"), ["ODESZA"]);
  assert.deepEqual(parsePerformers("Above & Beyond at Bill Graham"), ["Above", "Beyond"]);
  assert.deepEqual(
    parsePerformers("Above & Beyond at Bill Graham", { known: (name) => name === "above and beyond" }),
    ["Above & Beyond"],
  );
  assert.deepEqual(parsePerformers("A1, B2, C3, D4, E5, F6, G7 at X").length, 5);
  assert.deepEqual(parsePerformers("Bonobo b2b bonobo b2b Tourist"), ["Bonobo", "Tourist"]);
  assert.deepEqual(parsePerformers("DJ Koze with Roman Flügel"), ["DJ Koze", "Roman Flügel"]);
  assert.ok(titleNamesLineup("Calvin Harris at The Midway"));
  assert.ok(titleNamesLineup("Dirtybird presents: Claude VonStroke"));
  assert.ok(!titleNamesLineup("Fisher, Chris Lake + Dom Dolla"));
});

test("genresToVector returns 13 values in [0, 1] that follow the genre", () => {
  const house = genresToVector(["Dance/Electronic", "House"]);
  const rap = genresToVector(["Hip-Hop/Rap"]);
  const classical = genresToVector(["Classical", "Symphony"]);
  const team = genresToVector(["Sports", "Basketball", "NBA"]);
  for (const vector of [house, rap, classical, team, genresToVector([])]) {
    assert.equal(vector.length, FEATURES.length);
    assert.ok(vector.every((x) => x >= 0 && x <= 1));
  }
  assert.ok(house[f("electronic")] >= 0.9 && house[f("dancing")] >= 0.8);
  assert.ok(rap[f("hiphop")] >= 0.9 && rap[f("electronic")] < 0.5);
  assert.ok(classical[f("culture")] >= 0.8 && classical[f("loudness")] <= 0.25 && classical[f("dancing")] <= 0.1);
  assert.ok(team[f("liveMusic")] <= 0.1 && team[f("energy")] >= 0.8);
  assert.ok(performerSimilarity(house, genresToVector(["Techno"])) > performerSimilarity(house, classical));
  assert.deepEqual(genresToVector(["Undefined"]), genresToVector([]));
  assert.notDeepEqual(genresToVector(["Pop"]), genresToVector(["Pop-up"]).map(() => -1));
  assert.equal(genresToVector(["pop-up"])[f("pop")], genresToVector([])[f("pop")]);
});

test("blendVectors mixes performer vectors in and ignores malformed ones", () => {
  const base = FEATURES.map(() => 0.2);
  const one = FEATURES.map(() => 1);
  assert.deepEqual(blendVectors(base, []), base);
  assert.deepEqual(blendVectors(base, [[1, 2]]), base);
  assert.deepEqual(blendVectors(base, [one], 0.5), FEATURES.map(() => 0.6));
});

test("affinityStep: first ranking sets it, later ones are a moving average, support acts take half", () => {
  assert.equal(affinityStep(undefined, 9.4, 0), 9.4);
  assert.equal(affinityStep(5, 9.4, 0), 9.4);
  assert.equal(affinityStep(9, 5, 1), 7);
  assert.ok(Math.abs(affinityStep(9, 5, 10) - 7.8) < 1e-9);
  assert.ok(Math.abs(affinityStep(undefined, 9, 0, false) - 7) < 1e-9);
  assert.equal(affinityStep(9.9, 42, 0), 10);
  assert.equal(affinityStep(0.2, -3, 0), 0);
  assert.equal(affinityStep(NaN, 8, 0), 8);
  assert.equal(effectiveAffinity(3, true), FOLLOW_FLOOR);
  assert.equal(effectiveAffinity(9.5, true), 9.5);
  assert.equal(effectiveAffinity(3, false), 3);
  assert.ok(Math.abs(performerBoost(9.4) - 1.32) < 1e-9);
  assert.equal(performerBoost(0), -0.75);
  assert.equal(performerBoost(undefined), 0);
});

const now = Date.UTC(2026, 10, 15, 20);
const sfEvent = { id: "e1", start: now + 20 * DAY, city: "San Francisco", lat: 37.7609, lng: -122.3861 };
const fan = { following: false, score: 9.4, nRankings: 1, homeCity: "San Francisco", event: sfEvent, now, alertsLastDay: 0, alreadyEngaged: false };

test("shouldAlert follows every rule of ALGORITHM.md 4.2", () => {
  assert.ok(shouldAlert(fan));
  assert.ok(shouldAlert({ ...fan, score: 2, nRankings: 0, following: true }));
  assert.ok(!shouldAlert({ ...fan, score: 7.4 }));
  assert.ok(!shouldAlert({ ...fan, nRankings: 0 }), "a high score with no ranking is not a fan");
  assert.ok(!shouldAlert({ ...fan, event: { ...sfEvent, start: now - 1 } }));
  assert.ok(!shouldAlert({ ...fan, event: { ...sfEvent, start: now + 121 * DAY } }));
  assert.ok(!shouldAlert({ ...fan, lastNotifiedEventId: "e1" }));
  assert.ok(shouldAlert({ ...fan, lastNotifiedEventId: "e0" }));
  assert.ok(!shouldAlert({ ...fan, alertsLastDay: ALERT_MAX_PER_DAY }));
  assert.ok(!shouldAlert({ ...fan, alreadyEngaged: true }));
  assert.ok(!shouldAlert({ ...fan, homeCity: "New York" }));
});

test("isNearHome: same city, a nearby city, an unknown city, no home city", () => {
  assert.ok(isNearHome("san francisco ", sfEvent));
  assert.ok(isNearHome("SF", sfEvent));
  assert.ok(isNearHome("Oakland", sfEvent), "Oakland is within 60 km");
  assert.ok(isNearHome("San Francisco, CA", { ...sfEvent, city: undefined }));
  assert.ok(!isNearHome("Los Angeles", sfEvent));
  assert.ok(!isNearHome("Atlantis", sfEvent));
  assert.ok(isNearHome("Atlantis", { ...sfEvent, city: "atlantis" }));
  assert.ok(isNearHome(undefined, sfEvent));
  assert.equal(cityCenter("NYC"), cityCenter("New York"));
  assert.equal(cityCenter("Nowhere"), undefined);
});

test("alertText and formatEventDay use the event's local day", () => {
  // 8 pm Pacific on Saturday Dec 5 2026 is already Sunday in UTC.
  const start = Date.UTC(2026, 11, 6, 4);
  assert.equal(formatEventDay(start, "San Francisco"), "Sat Dec 5");
  assert.equal(formatEventDay(start, "London"), "Sun Dec 6");
  assert.deepEqual(
    alertText({ performerName: "Calvin Harris", city: "San Francisco", start, venueName: "The Midway", following: false, score: 9.4, nRankings: 2 }),
    { title: "Calvin Harris is coming to San Francisco", body: "Sat Dec 5 · The Midway · you rated them 9.4" },
  );
  assert.deepEqual(
    alertText({ performerName: "Fisher", start, following: true, score: 5, nRankings: 0 }),
    { title: "Fisher is coming to town", body: "Sat Dec 5 · you follow them" },
  );
});
