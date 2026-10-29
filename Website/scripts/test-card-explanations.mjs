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

const explanations = require("../lib/card-explanations.ts");
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
