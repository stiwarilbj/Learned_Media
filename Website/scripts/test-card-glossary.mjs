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

const glossary = require("../lib/card-glossary.ts");
const card = {
  id: "earth-card",
  hook: "A moving layer beneath our feet",
  title: "Earth's mantle drives plate movement",
  body: "The mantle is a thick layer of hot rock between Earth's crust and core. Its slow movement helps shift tectonic plates.",
  topicPath: ["Science", "Geology"],
  sources: [{ title: "Mantle (geology)", url: "https://en.wikipedia.org/wiki/Mantle_(geology)", canonicalUrl: "https://en.wikipedia.org/wiki/Mantle_(geology)", extract: "The mantle is the layer between the crust and core." }],
  evidence: [{ sentence: 0, sourceIndex: 0, quote: "The mantle is the layer between the crust and core.", section: "Composition" }]
};
const source = { title: "Mantle (geology)", url: "https://en.wikipedia.org/wiki/Mantle_(geology)", canonicalUrl: "https://en.wikipedia.org/wiki/Mantle_(geology)" };
const fingerprint = glossary.cardGlossaryFingerprint(card);
const saved = {
  fingerprint,
  sources: [source],
  entries: [
    { term: "mantle", definition: "In geology, the mantle is the thick layer of hot rock between Earth's crust and core.", sourceIndexes: [0] },
    { term: "tectonic plates", definition: "Tectonic plates are large sections of Earth's outer shell that move slowly over the mantle.", sourceIndexes: [0] }
  ]
};

test("fingerprint follows the original card identity and evidence", () => {
  assert.match(fingerprint, /^[a-f0-9]{16}$/);
  assert.notEqual(glossary.cardGlossaryFingerprint({ ...card, body: `${card.body} A new sentence.` }), fingerprint);
  assert.notEqual(glossary.cardGlossaryFingerprint({ ...card, sources: [{ ...card.sources[0], extract: "Different source text." }] }), fingerprint);
});

test("normalization keeps supported contextual terms, remaps valid citation indexes, and caps at three", () => {
  const normalized = glossary.normalizeCardGlossary({ ...card, glossary: {
    fingerprint,
    sources: [null, source],
    entries: [
      { term: "mantle", definition: "In geology, the mantle is the thick layer of hot rock between Earth's crust and core.", sourceIndexes: [1] },
      { term: "mantle", definition: "Duplicate term should be ignored.", sourceIndexes: [1] },
      { term: "crust", definition: "The crust is Earth's outermost solid layer.", sourceIndexes: [1] },
      { term: "Earth", definition: "This definition has unsupported extra information.", sourceIndexes: [1] },
      { term: "not present", definition: "A supported sentence.", sourceIndexes: [1] },
      { term: "core", definition: "A definition with no source.", sourceIndexes: [] }
    ]
  } });
  assert.equal(normalized?.entries.length, 3);
  assert.deepEqual(normalized?.entries.map(entry => entry.term), ["mantle", "crust", "Earth"]);
  assert.deepEqual(normalized?.entries[0].sourceIndexes, [0]);
  assert.equal(glossary.normalizeCardGlossary({ ...card, body: "A changed fact.", glossary: saved }), undefined);
});

test("definitions must be one sentence of at most 35 words", () => {
  const tooLong = Array.from({ length: 36 }, (_, index) => `word${index}`).join(" ");
  const normalized = glossary.normalizeCardGlossary({ ...card, glossary: { ...saved, entries: [
    { term: "mantle", definition: "A geological layer. It lies between the crust and core.", sourceIndexes: [0] },
    { term: "mantle", definition: tooLong, sourceIndexes: [0] },
    { term: "mantle", definition: "A useful single sentence about this geological layer.", sourceIndexes: [0] }
  ] } });
  assert.deepEqual(normalized?.entries.map(entry => entry.definition), ["A useful single sentence about this geological layer."]);
});

test("empty successful results are reusable and visible entries respect gradual reveal", () => {
  const empty = glossary.normalizeCardGlossary({ ...card, glossary: { fingerprint, sources: [source], entries: [] } });
  assert.deepEqual(empty?.entries, []);
  const checked = glossary.normalizeCardGlossary({ ...card, glossary: saved });
  assert.deepEqual(glossary.getVisibleCardGlossaryEntries(checked, `${card.hook} ${card.title} The mantle is a thick layer.`).map(item => item.term), ["mantle"]);
  assert.deepEqual(glossary.getVisibleCardGlossaryEntries(checked, "A short unrelated visible sentence."), []);
});

test("transient open panels are isolated by workspace and card and notify their subscribers", () => {
  let updates = 0;
  const unsubscribe = glossary.subscribeCardGlossaryPanel("workspace-a", card.id, () => { updates += 1; });
  glossary.setCardGlossaryPanelOpen("workspace-a", card.id, fingerprint, true);
  glossary.setCardGlossaryPanelOpen("workspace-b", card.id, fingerprint, true);
  assert.equal(glossary.getCardGlossaryPanelOpen("workspace-a", card.id, fingerprint), true);
  assert.equal(glossary.getCardGlossaryPanelOpen("workspace-b", card.id, fingerprint), true);
  assert.equal(glossary.getCardGlossaryPanelOpen("workspace-a", "other-card", fingerprint), false);
  assert.equal(updates, 1);
  glossary.setCardGlossaryPanelOpen("workspace-a", card.id, fingerprint, false);
  assert.equal(glossary.getCardGlossaryPanelOpen("workspace-a", card.id, fingerprint), false);
  assert.equal(updates, 2);
  unsubscribe();
});

process.on("exit", () => { Module._extensions[".ts"] = oldTsLoader; });
