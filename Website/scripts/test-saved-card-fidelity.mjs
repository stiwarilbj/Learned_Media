import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, filename);
};

const { validateSnapshot } = require(path.join(root, "lib/snapshot-validation.ts"));

test("validated workspace snapshots retain optional card metadata across JSON round trips", () => {
  const source = { title: "A source", url: "https://en.wikipedia.org/wiki/A_source", canonicalUrl: "https://en.wikipedia.org/wiki/A_source", extract: "Supporting passage." };
  const card = {
    id: "saved-card", hook: "A surprising detail", title: "A specific fact", body: "The first sentence. The second sentence.",
    sentences: ["The first sentence.", "The second sentence."], sentenceCount: 2, claim: "A supported claim.",
    evidence: [{ sentence: 0, sourceIndex: 0, quote: "The first sentence.", section: "History" }],
    topicPath: ["History", "A topic"], sources: [source], difficulty: 5, obscurity: 5, accent: "blue",
    liked: true, saved: true, feedback: "heard", known: true, moreLike: true, lessLike: false, surprise: true, createdAt: "2026-10-24T12:00:00.000Z",
    explanations: { simpler: { text: "A simpler version.", sources: [source], fingerprint: "0123456789abcdef" }, deeper: { text: "A deeper version.", sources: [source], fingerprint: "0123456789abcdef" } },
    glossary: { entries: [{ term: "mantle", definition: "The layer below Earth's crust.", sourceIndexes: [0] }], sources: [source], fingerprint: "0123456789abcdef" },
    followUpQuestions: { questions: ["How was this discovered?"], fingerprint: "0123456789abcdef" },
    chronology: { events: [{ dateText: "1900", eventText: "The event happened", anchor: { field: "body", sentenceIndex: 0 } }], fingerprint: "0123456789abcdef" },
    locations: { locations: [{ name: "London", articleTitle: "London", anchor: { field: "body", sentenceIndex: 1 }, latitude: 51.5072, longitude: -0.1276 }], fingerprint: "0123456789abcdef" },
    learnMore: "An additional explanation.", learnMoreSources: [source], question: "Why did it happen?", questionDetailed: true,
    answer: "Because of this cause.", answerDetailed: true, answerSources: [source],
    questionHistory: [{ role: "user", content: "Why?" }, { role: "assistant", content: "Because." }],
    provenance: { provider: "gemini", model: "gemini-3.5-flash-lite", generatedAt: "2026-10-24T12:00:00.000Z" }
  };
  const state = { persistenceVersion: 3, topics: [], settings: { obscurity: 5, displayMode: "text", sentenceLength: 2 }, cards: [card] };
  assert.equal(validateSnapshot(state, "state", "read"), true);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored.cards[0], card);
  assert.deepEqual(restored.cards[0].chronology, card.chronology);
  assert.deepEqual(restored.cards[0].learnMoreSources, [source]);
  assert.equal(restored.cards[0].questionDetailed, true);
  assert.deepEqual(restored.cards[0].locations, card.locations);
  assert.deepEqual(restored.cards[0].followUpQuestions, card.followUpQuestions);
});
