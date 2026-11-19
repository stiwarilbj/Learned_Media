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

const explanations = require("../lib/card-explanations.ts");
const glossary = require("../lib/card-glossary.ts");
const { validateSnapshot } = require("../lib/snapshot-validation.ts");
const card = {
  id: "test-card",
  title: "A narrow fact",
  hook: "A narrow fact happened",
  body: "The observatory recorded an unusual signal.",
  claim: "The observatory recorded an unusual signal.",
  topicPath: ["Science", "Astronomy"],
  sources: [{ title: "Observatory", url: "https://en.wikipedia.org/wiki/Observatory", canonicalUrl: "https://en.wikipedia.org/wiki/Observatory", extract: "The observatory recorded an unusual signal." }]
};

test("fingerprints change when original card content or its source evidence changes", () => {
  const original = explanations.cardExplanationFingerprint(card);
  assert.match(original, /^[a-f0-9]{16}$/);
  assert.notEqual(explanations.cardExplanationFingerprint({ ...card, body: card.body + " Later, it faded." }), original);
  assert.notEqual(explanations.cardExplanationFingerprint({ ...card, sources: [{ ...card.sources[0], extract: "A different passage." }] }), original);
  assert.notEqual(explanations.cardExplanationFingerprint({ ...card, evidence: [{ sentence: 0, sourceIndex: 0, quote: "A changed citation." }] }), original);
});

test("saved explanations are retained only when their original content fingerprint matches", () => {
  const fingerprint = explanations.cardExplanationFingerprint(card);
  const saved = { text: "The signal was an unusual observation.", sources: card.sources, fingerprint };
  assert.deepEqual(explanations.normalizeCardExplanations({ ...card, explanations: { simpler: saved } }), { simpler: saved });
  assert.equal(explanations.normalizeCardExplanations({ ...card, body: "A changed fact.", explanations: { simpler: saved } }), undefined);
  assert.equal(explanations.normalizeCardExplanations({ ...card, explanations: { simpler: { ...saved, sources: [] } } }), undefined);
  const restored = JSON.parse(JSON.stringify({ ...card, explanations: { simpler: saved } }));
  assert.deepEqual(explanations.normalizeCardExplanations(restored), { simpler: saved });
  restored.title = "An edited title";
  assert.equal(explanations.normalizeCardExplanations(restored), undefined, "title edits invalidate restored explanation metadata");
});

test("explanations and glossaries survive reordered citation keys in both runtimes", () => {
  const runtime = {};
  for (const name of ["card-content-fingerprint", "card-explanations", "card-glossary"]) {
    runInNewContext(readFileSync(new URL(`../../App/Resources/frontend/${name}.js`, import.meta.url), "utf8"), runtime);
  }
  const evidence = [
    { sentence: 0, sourceIndex: 0, quote: card.body, section: "Observations" },
    { sentence: 1, sourceIndex: 0, quote: "A second team confirmed its readings." }
  ];
  const reordered = [
    { section: evidence[0].section, quote: card.body, sourceIndex: 0, sentence: 0 },
    { quote: evidence[1].quote, sentence: 1, sourceIndex: 0 }
  ];
  const stable = "9108ce66103d1963"; // Fingerprint on the previous release, using the web writer's key order.
  const legacy = "e44d1ae861cb326b"; // Fingerprint on the previous release, using the reordered key sequence.
  for (const [tools, definitions] of [[explanations, glossary], [runtime.LEARNED_MEDIA_CARD_EXPLANATIONS, runtime.LEARNED_MEDIA_CARD_GLOSSARY]]) {
    assert.equal(tools.cardExplanationFingerprint({ ...card, evidence }), stable);
    assert.equal(tools.cardExplanationFingerprint({ ...card, evidence: reordered }), stable);
    for (const fingerprint of [stable, legacy]) {
      const original = {
        ...card, evidence: reordered,
        explanations: { simpler: { text: "The team saw a rare signal.", sources: card.sources, fingerprint } },
        glossary: { entries: [{ term: "observatory", definition: "A place for observing the sky.", sourceIndexes: [0] }], sources: card.sources, fingerprint }
      };
      const workspace = { persistenceVersion: 3, topics: [], cards: [original], settings: { obscurity: 4, displayMode: "text", sentenceLength: 2 } };
      const restored = JSON.parse(JSON.stringify(workspace));
      assert.equal(validateSnapshot(restored, "state", "read"), true);
      const loaded = restored.cards[0];
      assert.equal(tools.normalizeCardExplanations(loaded)?.simpler?.fingerprint, stable);
      const loadedGlossary = definitions.normalizeCardGlossary(loaded);
      assert.equal(loadedGlossary?.entries[0]?.term, "observatory");
      assert.equal(loadedGlossary?.fingerprint, stable);
      for (const changed of [
        { quote: "The observatory saw a different signal." }, { sourceIndex: 1 }, { sentence: 1 }, { section: "Results" }
      ]) {
        const edited = { ...loaded, evidence: [{ ...reordered[0], ...changed }, reordered[1]] };
        assert.equal(tools.normalizeCardExplanations(edited), undefined);
        assert.equal(definitions.normalizeCardGlossary(edited), undefined);
      }
      assert.equal(tools.normalizeCardExplanations({ ...loaded, evidence: [...reordered].reverse() }), undefined);
      assert.equal(definitions.normalizeCardGlossary({ ...loaded, sources: [{ ...card.sources[0], extract: "Changed source." }] }), undefined);
    }
  }
});

test("transient explanation choice is isolated by workspace and card and notifies subscribers", () => {
  let notifications = 0;
  const unsubscribe = explanations.subscribeCardExplanationSelection("workspace-a", card.id, () => { notifications += 1; });
  explanations.setCardExplanationSelection("workspace-a", card.id, "deeper");
  explanations.setCardExplanationSelection("workspace-b", card.id, "simpler");
  assert.equal(explanations.getCardExplanationSelection("workspace-a", card.id), "deeper");
  assert.equal(explanations.getCardExplanationSelection("workspace-b", card.id), "simpler");
  assert.equal(notifications, 1);
  explanations.setCardExplanationSelection("workspace-a", card.id, undefined);
  assert.equal(explanations.getCardExplanationSelection("workspace-a", card.id), undefined);
  assert.equal(notifications, 2);
  unsubscribe();
});

process.on("exit", () => { Module._extensions[".ts"] = oldTsLoader; });
