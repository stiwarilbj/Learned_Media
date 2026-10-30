import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const previousTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { canonicalRecord } = require("../lib/cloud-records.ts");
const { isBatchSetup } = require("../lib/batch-replay.ts");
const forbiddenFields = new Set(["key", "apiKey", "youtubeKey", "geminiKey", "access_token", "refresh_token", "provider_token", "provider_refresh_token"]);

function previousClean(value) {
  if (Array.isArray(value)) return value.map(previousClean);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !forbiddenFields.has(key))
    .map(([key, item]) => [key, previousClean(item)]));
}

function previousCanonicalRecord(record) {
  const state = record.state || {};
  const activity = state.youtubeActivity || {};
  return previousClean({
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    state: {
      persistenceVersion: 2,
      topicCatalogVersion: state.topicCatalogVersion ?? state.catalogVersion ?? 0,
      savedAt: state.savedAt,
      topics: state.topics || [],
      settings: state.settings || {},
      cards: state.cards || [],
      learningProfile: state.learningProfile || state.profile || {},
      feedStarted: state.feedStarted ?? state.started ?? false,
      theme: state.theme || "light",
      lastCompletedBatchSetup: isBatchSetup(state.lastCompletedBatchSetup) ? state.lastCompletedBatchSetup : undefined,
      youtubeActivity: {
        ...activity,
        selectedTopic: activity.selectedTopic ?? activity.topic ?? "All",
        activeTab: activity.activeTab ?? activity.tab ?? "discover",
        channelOrder: activity.channelOrder ?? activity.order ?? "newest"
      }
    }
  });
}

function assertNoForbiddenFields(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    assert.equal(forbiddenFields.has(key), false, `forbidden field ${key} survived cloud cleaning`);
    assertNoForbiddenFields(value[key]);
  }
}

test("cloud cleaning matches the prior serialized representation across nested records and arrays", () => {
  const special = { keepBefore: "first", key: "secret at object root", keepAfter: "last" };
  Object.defineProperty(special, "__proto__", {
    value: { apiKey: "nested secret", visible: "safe" }, enumerable: true, configurable: true, writable: true
  });
  const inherited = Object.create({ inheritedValue: "must not be copied", provider_token: "inherited secret" });
  inherited.keep = "own value";

  const record = {
    id: "workspace-1",
    name: "Nested fixture",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    state: {
      topicCatalogVersion: 4,
      savedAt: "2026-01-02T00:00:00.000Z",
      topics: [{ id: "science", name: "Science", key: "secret in topic" }],
      settings: { displayMode: "picture-text", geminiKey: "secret in settings", nested: { access_token: "secret", keep: true } },
      cards: [{
        id: "card-1",
        title: "Nested evidence",
        answer: {
          text: "Answer body",
          sources: [{ title: "Source", evidence: [{ text: "Exact passage", refresh_token: "secret", spans: [{ value: 7, youtubeKey: "secret" }] }] }]
        },
        arrayData: [
          "plain value",
          { keep: "array object", provider_refresh_token: "secret", deeper: [{ keep: "deep", apiKey: "secret" }] },
          [null, { key: "secret in nested array", order: 3 }]
        ],
        special,
        inherited
      }],
      learningProfile: { topics: [{ id: "science", total: 2, geminiKey: "secret in learning profile" }] },
      feedStarted: true,
      theme: "dark",
      youtubeActivity: {
        activeTab: "discover",
        search: { query: "earthquake history", provider_token: "secret in activity", filters: [{ allowed: true, access_token: "secret" }] }
      }
    }
  };

  const actual = canonicalRecord(record);
  const expected = previousCanonicalRecord(record);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), "cloud-safe serialization must stay byte-for-byte compatible");
  assertNoForbiddenFields(actual);
  const cleanedSpecial = actual.state.cards[0].special;
  assert.equal(Object.hasOwn(cleanedSpecial, "__proto__"), true, "an own __proto__ data field remains an ordinary field");
  assert.equal(Object.getPrototypeOf(cleanedSpecial), Object.prototype, "cleaning must not mutate the output object's prototype");
  assert.equal(Object.hasOwn(actual.state.cards[0].inherited, "inheritedValue"), false, "inherited properties are not copied");
  assert.deepEqual(actual.state.cards[0].arrayData[2], [null, { order: 3 }], "nested arrays retain their shape and order");
});

Module._extensions[".ts"] = previousTsLoader;
