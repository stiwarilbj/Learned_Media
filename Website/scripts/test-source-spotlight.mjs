import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const oldTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { buildSourceSpotlightModel, locatePassageContext, longestSharedPhraseRange, normalizeSpotlightSources } = require("../lib/source-spotlight.ts");
const compiledSpotlight = ts.transpileModule(readFileSync(new URL("../lib/source-spotlight.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
function isolatedSpotlight(native, supported) {
  const counts = { probes: 0, constructions: 0 };
  class CountingSegmenter {
    constructor(locale, options) {
      counts.constructions++;
      assert.equal(locale, "en");
      assert.deepEqual(plain(options), { granularity: "sentence" });
      this.segmenter = new Intl.Segmenter(locale, options);
    }
    segment(text) { return this.segmenter.segment(text); }
  }
  const context = { exports: {}, Intl: { get Segmenter() {
    counts.probes++;
    return supported ? CountingSegmenter : undefined;
  } } };
  if (native) {
    const runtime = readFileSync(new URL("../../App/Resources/frontend/source-spotlight.js", import.meta.url), "utf8");
    const boundary = "scope.LEARNED_MEDIA_SOURCE_SPOTLIGHT = exports;";
    assert.ok(runtime.includes(boundary));
    runInNewContext(runtime.replace(boundary, "exports.testSentenceRanges = sentenceRanges; " + boundary), context);
  } else {
    runInNewContext(compiledSpotlight + "\nexports.testSentenceRanges = sentenceRanges;", context);
  }
  return { api: native ? context.LEARNED_MEDIA_SOURCE_SPOTLIGHT : context.exports, counts };
}

// Keep the former fresh-instance behavior as an offset and boundary reference.
function originalSentenceRanges(text, supported) {
  if (supported) return Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(text), item => ({
    text: item.segment.trim(), start: item.index, end: item.index + item.segment.length
  })).filter(item => item.text);
  return Array.from(text.matchAll(/[^.!?]+[.!?]+[”’"')\]]*(?=\s|$)|[^.!?]+$/g), match => ({
    text: match[0].trim(), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length
  }));
}

const sentenceFixtures = [
  "", " \t\n ", "One complete sentence.", "No final punctuation",
  "  First sentence.\tSecond sentence!\n\nThird sentence?  ",
  "Dr. Smith met J. R. R. Tolkien in the U.S. They discussed a book.",
  "The gauge read 3.14 km. The next reading was 2.5 km.",
  "She said, “A signal arrived!” The team asked, ‘Was it real?’ Yes.",
  "A nested remark (it was brief.) followed. Another sentence appeared.",
  "Café and Cafe\u0301 differ in encoding. 🪐 An emoji uses two code units. 東京 was mentioned.",
  "Wait... What happened?! The final line\ncontinues here."
];
const sources = [
  { title: "First article", url: "https://en.wikipedia.org/wiki/First_article", extract: "[Section: History]\nA sentence before the saved passage. The observatory recorded a strong blue signal. A sentence after the saved passage." },
  { title: "Second article", url: "https://en.wikipedia.org/wiki/Second_article" }
];

test("preserves explicit sentence mapping and citation order while grouping sources", () => {
  const model = buildSourceSpotlightModel({
    body: "The observatory recorded a strong blue signal. Researchers compared the reading with nearby instruments.",
    sentences: ["The observatory recorded a strong blue signal.", "Researchers compared the reading with nearby instruments."],
    sentenceCount: 2,
    sources,
    evidence: [
      { sentence: 0, sourceIndex: 0, quote: "The observatory recorded a strong blue signal.", section: "History" },
      { sentence: 0, sourceIndex: 1, quote: "A second supporting quotation." },
      { sentence: 1, sourceIndex: 0, quote: "Researchers compared the reading with nearby instruments." }
    ]
  });
  assert.equal(model.mapped, true);
  assert.equal(model.groups.length, 2);
  assert.deepEqual(model.groups[0].map(group => group.sourceIndex), [0, 1]);
  assert.equal(model.groups[0][0].evidence[0].quote, "The observatory recorded a strong blue signal.");
});

test("reconstructs only legacy cards whose boundaries and sentence count agree", () => {
  const safe = buildSourceSpotlightModel({
    body: "The station logged a clear signal. The team checked the gauge.",
    sentenceCount: 2,
    sources,
    evidence: [{ sentence: 1, sourceIndex: 0, quote: "The team checked the gauge." }]
  });
  assert.equal(safe.mapped, true);
  assert.equal(safe.sentences.length, 2);
  const unsafe = buildSourceSpotlightModel({
    body: "J. R. R. Tolkien wrote the book. Readers kept discussing it.",
    sentenceCount: 4,
    sources,
    evidence: [{ sentence: 0, sourceIndex: 0, quote: "The book was published." }]
  });
  assert.equal(unsafe.mapped, false);
  assert.equal(unsafe.groups[0][0].evidence[0].sentence, -1);
});

test("falls back to the whole body rather than mapping invalid evidence", () => {
  const model = buildSourceSpotlightModel({
    body: "One supported sentence.",
    sentences: ["One supported sentence."],
    sentenceCount: 1,
    sources,
    evidence: [{ sentence: 3, sourceIndex: 0, quote: "A saved passage." }]
  });
  assert.equal(model.mapped, false);
  assert.equal(model.sentences[0], "One supported sentence.");
});

test("highlights the longest shared phrase only when it contains two meaningful words", () => {
  const quote = "The observatory recorded a strong blue signal during the night.";
  const range = longestSharedPhraseRange(quote, "A strong blue signal came from the observatory.");
  assert.equal(quote.slice(range.start, range.end), "a strong blue signal");
  assert.equal(longestSharedPhraseRange("It was on the hill.", "It was on the hill."), undefined);
  const claimRange = longestSharedPhraseRange("A signal was detected by the observatory.", "The reading was recorded.", "A signal was detected by the observatory.");
  assert.equal("A signal was detected by the observatory.".slice(claimRange.start, claimRange.end), "A signal was detected by the observatory");
});

test("remaps evidence indexes when duplicate source URLs are collapsed", () => {
  const normalized = normalizeSpotlightSources([
    { title: "First article", url: "https://en.wikipedia.org/wiki/First_article#:~:text=first", canonicalUrl: "https://en.wikipedia.org/wiki/First_article" },
    { title: "Duplicate alias", url: "https://en.wikipedia.org/wiki/First_article#History", canonicalUrl: "https://en.wikipedia.org/wiki/First_article" },
    { title: "Second article", url: "https://en.wikipedia.org/wiki/Second_article" }
  ], [
    { sourceIndex: 1, sentence: 0, quote: "duplicate-source citation" },
    { sourceIndex: 2, sentence: 1, quote: "second-source citation" }
  ]);
  assert.equal(normalized.sources.length, 2);
  assert.deepEqual(normalized.evidence.map(item => item.sourceIndex), [0, 1]);
});

test("locates exact quotations only inside their supplied section and returns neighboring sentences", () => {
  const extract = "[Section: History]\nA sentence before the saved passage. The observatory recorded a strong blue signal. A sentence after the saved passage.\n[Section: Results]\nA different section has separate context.";
  assert.deepEqual(locatePassageContext(extract, "The observatory recorded a strong blue signal.", "History"), {
    status: "found",
    before: "A sentence before the saved passage.",
    after: "A sentence after the saved passage."
  });
  assert.equal(locatePassageContext(extract, "The observatory recorded a strong blue signal.", "Results").status, "missing");
});

test("does not choose among repeated quotations", () => {
  const extract = "[Section: History]\nSame quotation appears. Same quotation appears.";
  assert.equal(locatePassageContext(extract, "Same quotation appears.", "History").status, "ambiguous");
});

test("initializes one English sentence segmenter lazily for both entry points", () => {
  for (const native of [false, true]) for (const rangesFirst of [false, true]) {
    const { api, counts } = isolatedSpotlight(native, true);
    assert.deepEqual(counts, { probes: 0, constructions: 0 });
    const readers = [api.splitSpotlightSentences, api.testSentenceRanges];
    if (rangesFirst) readers.reverse();
    for (let repetition = 0; repetition < 10; repetition++) {
      for (const text of sentenceFixtures) for (const read of readers) read(text);
    }
    assert.deepEqual(counts, { probes: 1, constructions: 1 });
  }
});

test("caches unsupported segmenters and preserves the existing fallback", () => {
  for (const native of [false, true]) for (const rangesFirst of [false, true]) {
    const { api, counts } = isolatedSpotlight(native, false);
    assert.deepEqual(counts, { probes: 0, constructions: 0 });
    if (rangesFirst) api.testSentenceRanges("");
    for (const text of sentenceFixtures) {
      const expected = originalSentenceRanges(text, false);
      assert.deepEqual(plain(api.splitSpotlightSentences(text)), expected.map(item => item.text).filter(Boolean));
      assert.deepEqual(plain(api.testSentenceRanges(text)), expected);
    }
    assert.deepEqual(counts, { probes: 1, constructions: 0 });
  }
});

test("reused browser and Mac segmenters retain fresh-instance boundaries and UTF-16 offsets", () => {
  for (const native of [false, true]) {
    const { api } = isolatedSpotlight(native, true);
    for (const text of [...sentenceFixtures, ...sentenceFixtures.toReversed()]) {
      const expected = originalSentenceRanges(text, true);
      assert.deepEqual(plain(api.splitSpotlightSentences(text)), expected.map(item => item.text));
      assert.deepEqual(plain(api.testSentenceRanges(text)), expected);
      for (const range of api.testSentenceRanges(text)) assert.equal(text.slice(range.start, range.end).trim(), range.text);
    }
  }
});

test("shared segmentation keeps legacy mapping and passage context independent across calls", () => {
  for (const native of [false, true]) for (const supported of [false, true]) {
    const { api, counts } = isolatedSpotlight(native, supported);
    const body = "🪐 The observatory recorded a strong blue signal. A second reading confirmed it.";
    const model = api.buildSourceSpotlightModel({ body, sentenceCount: 2, sources,
      evidence: [{ sentence: 1, sourceIndex: 0, quote: "A second reading confirmed it." }] });
    assert.equal(model.mapped, true);
    assert.deepEqual(plain(model.sentences), originalSentenceRanges(body, supported).map(item => item.text));
    const text = "  Before the event.\n🪐 A signal appeared.\tAfter the event.  ";
    for (let repetition = 0; repetition < 3; repetition++) {
      assert.deepEqual(plain(api.locatePassageContext(text, "🪐 A signal appeared.")), {
        status: "found", before: "Before the event.", after: "After the event."
      });
      assert.deepEqual(plain(api.locatePassageContext(text, "Before the event.")), { status: "found", after: "🪐 A signal appeared." });
      // The existing regex fallback retains a trailing whitespace-only range.
      assert.deepEqual(plain(api.locatePassageContext(text, "After the event.")), {
        status: "found", before: "🪐 A signal appeared.", ...(supported ? {} : { after: "" })
      });
    }
    assert.deepEqual(counts, { probes: 1, constructions: supported ? 1 : 0 });
  }
});

process.on("exit", () => { Module._extensions[".ts"] = oldTsLoader; });
