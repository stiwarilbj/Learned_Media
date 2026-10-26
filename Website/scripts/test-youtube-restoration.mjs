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
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);

const { DEFAULT_YOUTUBE_RECENCY_PREFERENCES, mergeYouTubeRecencyPreferences, mergeYouTubeActivity } = require(path.join(root, "lib/youtube.ts"));

test("YouTube recency restoration applies defaults, then legacy, then active-workspace values", () => {
  const legacy = { "Crash Course": false, "History Matters": true };
  const activeWorkspace = { "Crash Course": true, "History Matters": false, "Mental Floss": false };
  const restored = mergeYouTubeRecencyPreferences(legacy, activeWorkspace);
  assert.equal(restored["Crash Course"], true);
  assert.equal(restored["History Matters"], false);
  assert.equal(restored["Mental Floss"], false);
  assert.equal(restored["3Blue1Brown"], DEFAULT_YOUTUBE_RECENCY_PREFERENCES["3Blue1Brown"]);
  assert.equal(DEFAULT_YOUTUBE_RECENCY_PREFERENCES["Crash Course"], true);
  assert.equal(DEFAULT_YOUTUBE_RECENCY_PREFERENCES["Mental Floss"], true);
});

test("an older workspace without recency overrides does not inherit the previous workspace's choices", () => {
  const legacy = { "Crash Course": false, "History Matters": true };
  const previousWorkspace = { "Crash Course": true, "History Matters": false };
  const targetWorkspace = {};
  const restored = mergeYouTubeRecencyPreferences(legacy, targetWorkspace);
  assert.equal(restored["Crash Course"], false);
  assert.equal(restored["History Matters"], true);
  assert.notEqual(restored["Crash Course"], previousWorkspace["Crash Course"]);
  assert.equal(restored["3Blue1Brown"], DEFAULT_YOUTUBE_RECENCY_PREFERENCES["3Blue1Brown"]);
});

test("legacy and canonical YouTube activity merge without losing saved, history, preference, or position entries", () => {
  const merged = mergeYouTubeActivity(
    {
      savedIds: ["legacy", "shared"],
      history: [{ videoId: "legacy-history" }, { videoId: "shared-history", watchedAt: "old" }],
      playbackPositions: { "older-video": 7, "legacy-video": 6 },
      prioritizeRecentByChannel: { "Crash Course": true, "History Matters": true },
      topic: "History"
    },
    {
      savedIds: ["canonical", "shared"],
      history: [{ videoId: "canonical-history" }, { videoId: "shared-history", watchedAt: "new" }],
      playbackPositions: { "older-video": 8, "canonical-video": 5 },
      prioritizeRecentByChannel: { "Crash Course": false, "Mental Floss": false },
      selectedTopic: "Science"
    }
  );
  assert.deepEqual(merged.savedIds, ["canonical", "shared", "legacy"]);
  assert.deepEqual(merged.history, [{ videoId: "canonical-history" }, { videoId: "shared-history", watchedAt: "new" }, { videoId: "legacy-history" }]);
  assert.deepEqual(merged.playbackPositions, { "older-video": 8, "legacy-video": 6, "canonical-video": 5 });
  assert.deepEqual(merged.prioritizeRecentByChannel, { "Crash Course": false, "History Matters": true, "Mental Floss": false });
  assert.equal(merged.topic, "History");
  assert.equal(merged.selectedTopic, "Science");
});
