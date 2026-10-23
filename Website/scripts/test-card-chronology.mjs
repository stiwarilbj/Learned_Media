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
const chronology = require("../lib/card-chronology.ts");

const card = {
  id: "timeline-test", title: "An ancient observatory", hook: "Two moments changed its story",
  body: "The first stone was laid in 1901. The observatory opened in 1942. It closed on February 29, 2020.",
  sentences: ["The first stone was laid in 1901.", "The observatory opened in 1942.", "It closed on February 29, 2020."]
};

test("parses supported precise dates and omits ambiguous, approximate, ranged, and invalid dates", () => {
  assert.deepEqual(chronology.parseChronologyDate("1942"), { year: 1942, precision: "year" });
  assert.deepEqual(chronology.parseChronologyDate("79"), { year: 79, precision: "year" });
  assert.deepEqual(chronology.parseChronologyDate("May 1942"), { year: 1942, month: 5, precision: "month" });
  assert.deepEqual(chronology.parseChronologyDate("29 February 2020"), { year: 2020, month: 2, day: 29, precision: "day" });
  assert.deepEqual(chronology.parseChronologyDate("2020-02-29"), { year: 2020, month: 2, day: 29, precision: "day" });
  assert.deepEqual(chronology.parseChronologyDate("1 BCE"), { year: 0, precision: "year" });
  assert.deepEqual(chronology.parseChronologyDate("1 CE"), { year: 1, precision: "year" });
  for (const date of ["2019-02-29", "00/01/2000", "1900–1902", "about 1900", "19th century", "0", "0 BCE", "May 0", "May 0 BCE"]) assert.equal(chronology.parseChronologyDate(date), undefined, date);
});

test("legacy detection pairs explicit events and dates, sorts them, and computes year intervals", () => {
  const events = chronology.getCardChronologyEvents(card);
  assert.deepEqual(events.map(event => event.dateText), ["1901", "1942", "February 29, 2020"]);
  assert.equal(events[1].intervalBefore, "41 years later");
  assert.equal(events[2].intervalBefore, "About 78 years later");
  assert.deepEqual(events.map(event => event.description), ["The first stone was laid", "The observatory opened", "It closed"]);
});

test("full-date intervals use calendar arithmetic and BCE has no year zero", () => {
  const before = { ...card, body: "A treaty was signed on 2000-02-29. A renewal was signed on 2004-02-29.", sentences: ["A treaty was signed on 2000-02-29.", "A renewal was signed on 2004-02-29."] };
  assert.equal(chronology.getCardChronologyEvents(before)[1].intervalBefore, "4 years later");
  const transition = { ...card, body: "The first kingdom was founded in 1 BCE. The next kingdom was founded in 1 CE.", sentences: ["The first kingdom was founded in 1 BCE.", "The next kingdom was founded in 1 CE."] };
  assert.equal(chronology.getCardChronologyEvents(transition)[1].intervalBefore, "1 year later");
  const oneYear = { ...card, body: "The bridge was built in May 2000. The bridge opened in May 2001.", sentences: ["The bridge was built in May 2000.", "The bridge opened in May 2001."] };
  assert.equal(chronology.getCardChronologyEvents(oneYear)[1].intervalBefore, "About 1 year later");
});

test("same day, same year, and same-date distinct events remain legible", () => {
  const sameDay = { ...card, body: "A bridge opened on 2021-06-03. A station opened on 2021-06-03.", sentences: ["A bridge opened on 2021-06-03.", "A station opened on 2021-06-03."] };
  const sameYear = { ...card, body: "A bridge opened in 2021. A station opened in 2021.", sentences: ["A bridge opened in 2021.", "A station opened in 2021."] };
  assert.equal(chronology.getCardChronologyEvents(sameDay)[1].intervalBefore, "Same day");
  assert.equal(chronology.getCardChronologyEvents(sameYear)[1].intervalBefore, "Same year");
  assert.equal(chronology.getCardChronologyEvents(sameDay).length, 2);
});

test("legacy fallback rejects article metadata, speculation, approximate dates, and ambiguous numeric dates", () => {
  const unsafe = { ...card, body: "The article was last updated in 2019. The device may have launched around 1920. It was released on 01/02/2000.", sentences: ["The article was last updated in 2019.", "The device may have launched around 1920.", "It was released on 01/02/2000."] };
  assert.deepEqual(chronology.getCardChronologyEvents(unsafe), []);
});

test("optional metadata is anchored, deduplicated, fingerprinted, and content-bound", () => {
  const generated = chronology.createSavedCardChronology({ events: [
    { dateText: "1942", eventText: "The observatory opened in 1942", anchor: { field: "body", sentenceIndex: 1 } },
    { dateText: "1901", eventText: "The first stone was laid in 1901", anchor: { field: "body", sentenceIndex: 0 } },
    { dateText: "1942", eventText: "An invented side event in 1942", anchor: { field: "body", sentenceIndex: 1 } },
    { dateText: "1901", eventText: "The first stone was laid in 1901", anchor: { field: "body", sentenceIndex: 0 } }
  ] }, card);
  assert.equal(generated?.events.length, 2);
  assert.match(generated?.fingerprint ?? "", /^[a-f0-9]{16}$/u);
  assert.equal(chronology.normalizeSavedCardChronology({ ...card, chronology: generated })?.events.length, 2);
  assert.equal(chronology.normalizeSavedCardChronology({ ...card, body: card.body + " Changed.", chronology: generated }), undefined);
  const mismatched = chronology.createSavedCardChronology({ events: [
    { dateText: "1901", eventText: "The observatory opened in 1901", anchor: { field: "body", sentenceIndex: 0 } },
    { dateText: "1942", eventText: "The first stone was laid in 1942", anchor: { field: "body", sentenceIndex: 1 } }
  ] }, card);
  assert.equal(mismatched, undefined);
  const metadata = { ...card, body: "This article was published in 2019. The observatory opened in 1942.", sentences: ["This article was published in 2019.", "The observatory opened in 1942."] };
  const publicationMetadata = chronology.createSavedCardChronology({ events: [
    { dateText: "2019", eventText: "This article was published in 2019", anchor: { field: "body", sentenceIndex: 0 } },
    { dateText: "1942", eventText: "The observatory opened in 1942", anchor: { field: "body", sentenceIndex: 1 } }
  ] }, metadata);
  assert.equal(publicationMetadata, undefined);
  const duplicates = { ...card, body: "The observatory opened in 1942. The observatory opened in 1942.", sentences: ["The observatory opened in 1942.", "The observatory opened in 1942."] };
  assert.equal(chronology.getCardChronologyEvents(duplicates).length, 1);
});

test("gradual reveal hides later body events but keeps visible title and hook events", () => {
  const visible = chronology.getCardChronologyEvents(card, 1, false);
  assert.deepEqual(visible.map(event => event.dateText), ["1901"]);
  const all = chronology.getCardChronologyEvents(card, 1, true);
  assert.equal(all.length, 3);
});

test("transient panel state is scoped by workspace and card and notifies subscribers", () => {
  let updates = 0;
  const fingerprint = chronology.cardChronologyFingerprint(card);
  const unsubscribe = chronology.subscribeCardChronologyPanel("workspace-a", card.id, () => { updates += 1; });
  chronology.setCardChronologyPanelOpen("workspace-a", card.id, fingerprint, true);
  chronology.setCardChronologyPanelOpen("workspace-b", card.id, fingerprint, true);
  assert.equal(chronology.getCardChronologyPanelOpen("workspace-a", card.id, fingerprint), true);
  assert.equal(chronology.getCardChronologyPanelOpen("workspace-b", card.id, fingerprint), true);
  assert.equal(chronology.getCardChronologyPanelOpen("workspace-a", "other", fingerprint), false);
  chronology.setCardChronologyPanelOpen("workspace-a", card.id, fingerprint, false);
  assert.equal(updates, 2);
  unsubscribe();
});

process.on("exit", () => { Module._extensions[".ts"] = previousLoader; });
