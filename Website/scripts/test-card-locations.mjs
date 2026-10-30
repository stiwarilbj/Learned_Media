import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const previousLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};
const locations = require("../lib/card-locations.ts");
const card = {
  id: "map-test", title: "A city built around the river", hook: "Tokyo grew beside the Sumida",
  body: "Tokyo's neighborhoods grew along the Sumida River. Japan later built flood defenses there.",
  sentences: ["Tokyo's neighborhoods grew along the Sumida River.", "Japan later built flood defenses there."],
  sources: [{ title: "Tokyo" }, { title: "Sumida River" }]
};
function previousCountryResolution(countries, place) {
  return countries.find(country => country.iso === place.countryCode) ?? countries.find(country => country.polygons.some(polygon => {
    if (!polygon.length) return false;
    const ring = polygon[0];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > place.latitude) !== (yj > place.latitude) && place.longitude < (xj - xi) * (place.latitude - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
    }
    return inside;
  }));
}

test("optional hints must name text in their declared anchor; invalid hints do not affect other data", () => {
  const saved = locations.createSavedCardLocations([
    { name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body", sentenceIndex: 0 } },
    { name: "Japan", articleTitle: "Japan", anchor: { field: "body", sentenceIndex: 1 } },
    { name: "Atlantis", articleTitle: "Atlantis", anchor: { field: "body", sentenceIndex: 0 } },
    { name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body", sentenceIndex: 0 } }
  ], card);
  assert.deepEqual(saved?.locations.map(place => place.name), ["Tokyo"]);
  assert.equal(saved?.fingerprint, locations.cardLocationsFingerprint(card));
  assert.equal(locations.normalizeSavedCardLocations({ ...card, locations: saved })?.locations.length, 1);
  assert.equal(locations.normalizeSavedCardLocations({ ...card, body: card.body + " Changed.", locations: saved }), undefined);
  const restored = JSON.parse(JSON.stringify({ ...card, locations: saved }));
  assert.equal(locations.normalizeSavedCardLocations(restored)?.locations.length, 1);
  restored.title = "A changed title";
  assert.equal(locations.normalizeSavedCardLocations(restored), undefined, "title edits invalidate restored location metadata");
  assert.equal(locations.createSavedCardLocations([{ name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body" } }], card), undefined);
});

test("gradual reveal hides locations attached to unrevealed sentences", () => {
  const saved = locations.createSavedCardLocations([
    { name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body", sentenceIndex: 0 } },
    { name: "Japan", articleTitle: "Japan", anchor: { field: "body", sentenceIndex: 1 } }
  ], card);
  const withLocations = { ...card, locations: saved };
  assert.deepEqual(locations.getVisibleCardLocations(withLocations, 1, false).map(place => place.name), ["Tokyo"]);
  assert.deepEqual(locations.getVisibleCardLocations(withLocations, 0, false), []);
  assert.deepEqual(locations.getVisibleCardLocations(withLocations, 0, true).map(place => place.name), ["Tokyo"]);
});

test("legacy matching uses explicit cited place names and country aliases, never topic paths", () => {
  const paris = { ...card, body: "Paris follows the Seine River through France.", sentences: ["Paris follows the Seine River through France."], sources: [{ title: "Paris" }] };
  const detected = locations.getVisibleCardLocations(paris, 0, true);
  assert.deepEqual(detected.map(place => place.name), ["Paris"]);
  assert.equal(detected[0].articleTitle, "Paris");
  const countryOnly = { ...card, title: "A river in Japan", hook: "", body: "Japan has many rivers.", sentences: ["Japan has many rivers."], sources: [] };
  assert.deepEqual(locations.getVisibleCardLocations(countryOnly, 0, true).map(place => place.name), ["Japan"]);
  const unrelated = { ...countryOnly, title: "A river", body: "The river is long.", topicPath: ["Japan"] };
  assert.deepEqual(locations.getVisibleCardLocations(unrelated, 0, true), []);
});

test("a country used only for orientation does not become an extra pin", () => {
  const generated = locations.createSavedCardLocations([
    { name: "Japan", articleTitle: "Japan", anchor: { field: "body", sentenceIndex: 1 } },
    { name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body", sentenceIndex: 0 } }
  ], card);
  assert.deepEqual(generated?.locations.map(place => place.name), ["Tokyo"]);
});

test("verified coordinates attach without replacing the card's exact place name or anchor", () => {
  const saved = locations.createSavedCardLocations([{ name: "Tokyo", articleTitle: "Tokyo", anchor: { field: "body", sentenceIndex: 0 } }], card);
  assert.ok(saved);
  const withLocations = { ...card, locations: saved };
  const resolved = locations.attachVerifiedLocationCoordinates(withLocations, [{ articleTitle: "Tokyo", latitude: 35.6762, longitude: 139.6503 }]);
  assert.equal(resolved?.locations[0].name, "Tokyo");
  assert.deepEqual(resolved?.locations[0].anchor, { field: "body", sentenceIndex: 0 });
  assert.equal(resolved?.locations[0].latitude, 35.6762);
  assert.equal(resolved?.locations[0].longitude, 139.6503);
  const stable = locations.attachVerifiedLocationCoordinates({ ...card, locations: resolved }, [{ articleTitle: "Tokyo", latitude: undefined, longitude: undefined, broad: undefined }]);
  assert.equal(stable?.locations[0].latitude, 35.6762);
});

test("map fitting handles nearby, distant, antimeridian, and polar pins with readable separate labels", () => {
  const country = { name: "Testland", iso: "TST", aliases: [], polygons: [[[[170, -10], [180, -10], [180, 10], [170, 10], [170, -10]]]] };
  const nearby = locations.layoutPocketMap([country], [
    { name: "East", articleTitle: "East", anchor: { field: "title" }, latitude: 10, longitude: 10, url: "https://en.wikipedia.org/wiki/East" },
    { name: "West", articleTitle: "West", anchor: { field: "title" }, latitude: 10.2, longitude: 10.3, url: "https://en.wikipedia.org/wiki/West" }
  ]);
  assert.equal(nearby.markers.length, 2);
  assert.ok(nearby.markers.every(marker => marker.x >= 0 && marker.x <= nearby.width && marker.y >= 0 && marker.y <= nearby.height));
  assert.ok(nearby.markers.every(marker => marker.labelX !== marker.x));
  const dateline = locations.layoutPocketMap([country], [
    { name: "A", articleTitle: "A", anchor: { field: "title" }, latitude: 0, longitude: 179, url: "https://en.wikipedia.org/wiki/A" },
    { name: "B", articleTitle: "B", anchor: { field: "title" }, latitude: 1, longitude: -179, url: "https://en.wikipedia.org/wiki/B" }
  ]);
  assert.ok(Math.abs(dateline.markers[0].x - dateline.markers[1].x) < dateline.width / 3);
  assert.ok(dateline.outlines.every(outline => !outline.d.includes("NaN")));
  const polar = locations.layoutPocketMap([], [{ name: "Pole", articleTitle: "Pole", anchor: { field: "title" }, latitude: 89.9, longitude: -20, url: "https://en.wikipedia.org/wiki/Pole" }]);
  assert.ok(Number.isFinite(polar.markers[0].x) && Number.isFinite(polar.markers[0].y));
  assert.ok(polar.markers[0].x >= 0 && polar.markers[0].x <= polar.width);
});

test("country lookup preserves outline search order for islands, borders, overlaps, and the antimeridian", () => {
  const outline = (name, iso, ring) => ({ name, iso, aliases: [], polygons: [[ring]] });
  const northIsland = outline("North Island", "NTH", [[9, 9], [11, 9], [11, 11], [9, 11], [9, 9]]);
  const southernIsland = outline("Southern Island", "STH", [[9, -11], [11, -11], [11, -9], [9, -9], [9, -11]]);
  const borderLeft = outline("Left", "LFT", [[-1, -1], [0, -1], [0, 1], [-1, 1], [-1, -1]]);
  const borderRight = outline("Right", "RGT", [[0, -1], [1, -1], [1, 1], [0, 1], [0, -1]]);
  const overlapFirst = outline("First overlap", "OV1", [[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]]);
  const overlapSecond = outline("Second overlap", "OV2", [[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]]);
  const eastDateLine = outline("East of date line", "EAST", [[170, -10], [180, -10], [180, 10], [170, 10], [170, -10]]);
  const westDateLine = outline("West of date line", "WEST", [[-180, -10], [-170, -10], [-170, 10], [-180, 10], [-180, -10]]);
  const cases = [
    { name: "islands", countries: [northIsland, southernIsland], places: [[10, 10], [10, -10]] },
    { name: "border point", countries: [borderLeft, borderRight], places: [[0, 0]] },
    { name: "overlapping outlines", countries: [overlapFirst, overlapSecond], places: [[0, 0]] },
    { name: "antimeridian", countries: [eastDateLine, westDateLine], places: [[0, 179], [0, -179]] }
  ];
  assert.equal(previousCountryResolution([borderLeft, borderRight], { latitude: 0, longitude: 0 })?.name, "Right", "the shared border retains the existing point-in-polygon result");
  assert.equal(previousCountryResolution([overlapFirst, overlapSecond], { latitude: 0, longitude: 0 })?.name, "First overlap", "the first containing outline wins");
  assert.deepEqual([[0, 179], [0, -179]].map(([latitude, longitude]) => previousCountryResolution([eastDateLine, westDateLine], { latitude, longitude })?.name), ["East of date line", "West of date line"]);
  for (const scenario of cases) {
    const places = scenario.places.map(([latitude, longitude], index) => ({
      name: `${scenario.name} ${index + 1}`, articleTitle: `Place ${index + 1}`, anchor: { field: "title" },
      latitude, longitude, url: `https://en.wikipedia.org/wiki/Place_${index + 1}`
    }));
    const expected = places.map(place => previousCountryResolution(scenario.countries, place));
    const layout = locations.layoutPocketMap(scenario.countries, places);
    assert.deepEqual(layout.markers.map(marker => marker.country), expected.map(country => country?.name), `${scenario.name}: labels retain the old first matching country`);
    assert.deepEqual(layout.outlines.filter(country => country.selected).map(country => country.key), [...new Set(expected.filter(Boolean).map(country => country.iso))], `${scenario.name}: selected outlines retain the old country resolution`);
  }
  const explicitCode = locations.layoutPocketMap([northIsland, southernIsland], [{
    name: "Explicit", articleTitle: "Explicit", anchor: { field: "title" }, latitude: -10, longitude: 10,
    countryCode: "NTH", url: "https://en.wikipedia.org/wiki/Explicit"
  }]);
  assert.equal(explicitCode.markers[0].country, "North Island", "a known country code keeps precedence over polygon containment");
  const reversedOverlap = locations.layoutPocketMap([overlapSecond, overlapFirst], [{
    name: "Overlap", articleTitle: "Overlap", anchor: { field: "title" }, latitude: 0, longitude: 0,
    url: "https://en.wikipedia.org/wiki/Overlap"
  }]);
  assert.equal(reversedOverlap.markers[0].country, "Second overlap", "reordering overlapping outlines preserves first-match behavior");
});

test("country outline data stays compact and contains valid polygon coordinates", () => {
  const data = JSON.parse(readFileSync(new URL("../public/country-outlines.json", import.meta.url), "utf8"));
  assert.match(data.version, /natural-earth-5\.1\.2/u);
  assert.ok(data.countries.length > 150);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < 150_000);
  assert.ok(data.countries.some(country => country.iso === "JPN"));
  assert.ok(data.countries.every(country => country.polygons.every(polygon => polygon.every(ring => ring.every(point => point.length >= 2 && point.every(Number.isFinite))))));
});

process.on("exit", () => { Module._extensions[".ts"] = previousLoader; });
