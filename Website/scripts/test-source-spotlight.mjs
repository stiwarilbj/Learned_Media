import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

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

process.on("exit", () => { Module._extensions[".ts"] = oldTsLoader; });
