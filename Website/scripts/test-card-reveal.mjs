import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const previousLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  module._compile(compiled, filename);
};

const reveal = require("../lib/card-reveal.ts");
const body = "The first sentence is a surprising detail. The second sentence adds context. The final sentence closes the loop.";
const segments = ["The first sentence is a surprising detail.", "The second sentence adds context.", "The final sentence closes the loop."];

test("uses only validated sentence boundaries and safely falls back to one complete body", () => {
  assert.deepEqual(reveal.buildCardRevealModel(body, segments).sentences, segments);
  assert.deepEqual(reveal.buildCardRevealModel(body, ["The first sentence is a surprising detail."]).sentences, [body]);
  assert.deepEqual(reveal.buildCardRevealModel(body).sentences, [body]);
});

test("card reveal progress uses the shared transient identity and resets after any text edit", () => {
  const card = { id: "fingerprinted-card", title: "Title", hook: "Hook", body };
  const model = reveal.buildCardRevealModelForCard(card, segments);
  reveal.startCardReveal("workspace-fingerprint", card.id, model);
  reveal.revealNextCardSentence("workspace-fingerprint", card.id, model);
  assert.ok(reveal.getCardRevealProgress("workspace-fingerprint", card.id, model));
  const roundTripped = JSON.parse(JSON.stringify(card));
  const restored = reveal.buildCardRevealModelForCard(roundTripped, segments);
  assert.equal(restored.fingerprint, model.fingerprint, "the same text has the same identity after serialization");
  assert.ok(reveal.getCardRevealProgress("workspace-fingerprint", card.id, restored));
  roundTripped.hook = "Edited hook";
  const edited = reveal.buildCardRevealModelForCard(roundTripped, segments);
  assert.notEqual(edited.fingerprint, model.fingerprint);
  roundTripped.body = `${body} Added sentence.`;
  assert.notEqual(reveal.buildCardRevealModelForCard(roundTripped).fingerprint, edited.fingerprint);
});

test("reveals one complete sentence at a time and completes on the final sentence", () => {
  reveal.clearCardRevealProgress();
  const model = reveal.buildCardRevealModel(body, segments);
  reveal.startCardReveal("workspace-a", "card-1", model);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).visibleCount, 0);
  reveal.revealNextCardSentence("workspace-a", "card-1", model);
  assert.deepEqual(reveal.getCardRevealProgress("workspace-a", "card-1", model), { fingerprint: model.fingerprint, visibleCount: 1, complete: false });
  reveal.revealNextCardSentence("workspace-a", "card-1", model);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).visibleCount, 2);
  reveal.revealNextCardSentence("workspace-a", "card-1", model);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).complete, true);
  reveal.revealNextCardSentence("workspace-a", "card-1", model);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).visibleCount, 3);
});

test("can show all, reveal through a cited sentence, and isolate workspace/card/body state", () => {
  reveal.clearCardRevealProgress();
  const model = reveal.buildCardRevealModel(body, segments);
  reveal.revealCardThroughSentence("workspace-a", "card-1", model, 1);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).visibleCount, 2);
  assert.equal(reveal.getCardRevealProgress("workspace-b", "card-1", model), undefined);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-2", model), undefined);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", reveal.buildCardRevealModel(body + " Updated")), undefined);
  reveal.showAllCardSentences("workspace-a", "card-1", model);
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model).complete, true);
});

test("clearing preference overrides resets transient progress and notifies subscribers", () => {
  reveal.clearCardRevealProgress();
  const model = reveal.buildCardRevealModel(body, segments);
  let notifications = 0;
  const unsubscribe = reveal.subscribeCardRevealProgress("workspace-a", "card-1", () => { notifications += 1; });
  reveal.startCardReveal("workspace-a", "card-1", model);
  reveal.clearCardRevealProgress();
  assert.equal(reveal.getCardRevealProgress("workspace-a", "card-1", model), undefined);
  assert.equal(notifications, 2);
  unsubscribe();
});

Module._extensions[".ts"] = previousLoader;
