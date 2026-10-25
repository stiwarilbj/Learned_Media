import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { createDefaultTopics } = require("../lib/demo-data.ts");
const { flattenTopics, selectedLeafCount, selectWeightedTopicPaths, toggleTopicSelection } = require("../lib/topic-catalog.ts");
const { updateTopicTree } = require("../lib/topic-tree.ts");
const { compactTopicPreferences, restoreTopicPreferences } = require("../lib/topic-preferences.ts");
const { createTopicSuggestionIndex, suggestTopics } = require("../lib/topic-suggestions.ts");
const { selectRandomVideos, createYouTubeListMemo, partitionYouTubeVideoResults, createYouTubeProgressStore, createYouTubeTopicPools, filterYouTubeVideos } = require("../lib/youtube.ts");

function findTopic(nodes, predicate) {
  const stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop();
    if (predicate(node)) return node;
    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) stack.push(node.children[index]);
  }
  return undefined;
}

test("topic selection preserves structural sharing and cached counts", () => {
  const topics = createDefaultTopics();
  const leaf = findTopic(topics, (node) => !node.children?.length && node.label === "Earthquakes");
  assert.ok(leaf, "expected a catalog leaf to exercise selection");
  const untouchedRoot = topics.find((topic) => topic.id !== leaf.id && !topic.children?.some((child) => child.id === leaf.id));
  const next = toggleTopicSelection(topics, leaf.id);
  assert.equal(selectedLeafCount(topics), 0);
  assert.equal(selectedLeafCount(next), 1);
  assert.equal(next.filter((topic, index) => topic !== topics[index]).length, 1);
  assert.ok(untouchedRoot && next.includes(untouchedRoot), "unrelated root references should be preserved");

  const selected = findTopic(next, (node) => node.id === leaf.id);
  const weighted = updateTopicTree(next, leaf.id, (node) => ({ ...node, weight: 20 }));
  assert.equal(selectedLeafCount(weighted), 1);
  const selectedPath = flattenTopics(weighted).find((topic) => topic.id === leaf.id)?.path;
  const weightedChoice = selectWeightedTopicPaths(weighted, 1)[0];
  assert.deepEqual(weightedChoice.path, selectedPath);
  assert.equal(weightedChoice.weight, 20);
  assert.ok(selected?.selected);
});

test("category selection updates its subtree once and keeps preference snapshots compact", () => {
  const topics = createDefaultTopics();
  const category = findTopic(topics, (node) => node.label === "Science" && node.children?.length);
  assert.ok(category, "expected a catalog category");
  const selected = toggleTopicSelection(topics, category.id);
  const leafCount = flattenTopics([category]).filter((topic) => !topic.children?.length).length;
  assert.equal(selectedLeafCount(selected), leafCount);
  const expandedAndWeighted = updateTopicTree(selected, category.id, (node) => ({ ...node, expanded: true, weight: 17 }));
  const custom = { id: "custom-test-topic", label: "Custom test topic", weight: 10, selected: true, expanded: false, custom: true, children: [] };
  const withCustom = [...expandedAndWeighted, custom];
  const compact = compactTopicPreferences(withCustom);
  const restored = restoreTopicPreferences(compact, false, createDefaultTopics());
  assert.ok(restored);
  assert.equal(selectedLeafCount(restored), leafCount + 1);
  assert.equal(findTopic(restored, (node) => node.id === category.id)?.weight, 17);
  assert.equal(findTopic(restored, (node) => node.id === category.id)?.expanded, true);
  assert.equal(restored.at(-1)?.id, custom.id);
  assert.ok(compact.selected.length < 5, "a selected branch should compact to its branch ID");
});

test("restoring unchanged topic preferences preserves the catalog tree", () => {
  const topics = createDefaultTopics();
  const emptyPreferences = compactTopicPreferences(topics);
  assert.equal(restoreTopicPreferences(emptyPreferences, false, topics), topics);

  const leaf = findTopic(topics, (node) => !node.children?.length && node.label === "Earthquakes");
  assert.ok(leaf);
  const changed = restoreTopicPreferences({ ...emptyPreferences, selected: [leaf.id] }, false, topics);
  assert.ok(changed);
  assert.notEqual(changed, topics);
  assert.equal(selectedLeafCount(changed), 1);
  const untouchedRoot = topics.find((topic) => topic.id !== leaf.id && !topic.children?.some((child) => child.id === leaf.id));
  assert.ok(untouchedRoot && changed.includes(untouchedRoot), "unrelated topic branches should keep their references");
});

test("local topic suggestions retain 100 unique results in direct then related order", () => {
  const topics = createDefaultTopics();
  const index = createTopicSuggestionIndex(flattenTopics(topics));
  const common = suggestTopics(index, "earthquake");
  assert.equal(common.length, 100);
  assert.equal(new Set(common.map((item) => item.id)).size, 100);
  const firstRelated = common.findIndex((item) => item.group === "related");
  const firstExplore = common.findIndex((item) => item.group === "explore");
  assert.ok(firstRelated > 0);
  assert.ok(firstExplore < 0 || firstExplore > firstRelated);
  assert.ok(common.slice(0, Math.min(10, common.filter((item) => item.group === "keyword").length)).every((item) => item.group === "keyword"));

  const semantic = suggestTopics(index, "tremors");
  assert.equal(semantic.length, 100);
  assert.ok(semantic.some((item) => item.group === "related" && /earthquake|geology/i.test(item.path.join(" "))));
});

test("large video catalogs return a unique small sample without sorting the full library", () => {
  const videos = Array.from({ length: 30000 }, (_, index) => ({
    id: `video-${index}`,
    channelName: "Performance Channel",
    publishedAt: new Date(Date.UTC(2024 + index % 2, index % 12, index % 28 + 1)).toISOString()
  }));
  const startedAt = performance.now();
  const sample = selectRandomVideos(videos, 24, ["video-0"]);
  const elapsedMs = performance.now() - startedAt;
  assert.equal(sample.length, 24);
  assert.equal(new Set(sample.map((video) => video.id)).size, 24);
  assert.ok(!sample.some((video) => video.id === "video-0"));
  assert.ok(elapsedMs < 500, `sampling took ${elapsedMs.toFixed(1)}ms`);
});

test("topic pools match strict approved and Shorts filtering and preserve catalog order", () => {
  const videos = Array.from({ length: 30000 }, (_, index) => ({
    id: `topic-${index}`,
    approved: index % 17 !== 0,
    title: `Video ${index}`,
    description: "",
    tags: [],
    channelName: "Performance Channel",
    channelId: "channel",
    topics: index % 3 ? ["Science", "History"] : ["History"],
    publishedAt: "2025-01-01T00:00:00Z"
  }));
  videos[5] = { ...videos[5], title: "A #Shorts science clip", approved: true, topics: ["Science"] };
  const startedAt = performance.now();
  const pools = createYouTubeTopicPools(videos);
  const elapsedMs = performance.now() - startedAt;
  assert.deepEqual(pools.get("Science").map(video => video.id), filterYouTubeVideos(videos, "", "Science").map(video => video.id));
  assert.deepEqual(pools.get("All").map(video => video.id), filterYouTubeVideos(videos, "", "All").map(video => video.id));
  assert.equal(pools.get("Science").some(video => video.id === "topic-5"), false, "explicit Shorts stay excluded");
  assert.equal(pools.get("History")[0].id, "topic-1", "the original catalog order is retained");
  assert.ok(elapsedMs < 500, `building indexed topic pools took ${elapsedMs.toFixed(1)}ms`);
});

test("video result partitioning preserves order and reuses the input when there are no broader matches", () => {
  const videos = Array.from({ length: 30000 }, (_, index) => ({ id: `video-${index}`, position: index }));
  const onlyStrong = Object.fromEntries(videos.map((video) => [video.id, { relevance: "strong" }]));
  const startedAt = performance.now();
  const plain = partitionYouTubeVideoResults(videos, onlyStrong);
  const plainElapsed = performance.now() - startedAt;
  assert.equal(plain.strong, videos, "ordinary lists should keep their original array and avoid partition allocations");
  assert.deepEqual(plain.broader, []);
  assert.ok(plainElapsed < 25, `empty-reason partition took ${plainElapsed.toFixed(1)}ms`);

  const reasons = { "video-4": { relevance: "broader" }, "video-25000": { relevance: "broader" } };
  const split = partitionYouTubeVideoResults(videos, reasons);
  assert.equal(split.strong.length, 29998);
  assert.deepEqual(split.broader.map((video) => video.id), ["video-4", "video-25000"]);
  assert.equal(split.strong[4].id, "video-5");
  assert.equal(split.strong.at(-1).id, "video-29999");
});

test("video list memo keeps randomly ordered results stable until a source input changes", () => {
  const memo = createYouTubeListMemo();
  const workspaceVideos = [{ id: "a" }, { id: "b" }];
  const randomOrder = [workspaceVideos[1], workspaceVideos[0]];
  let builds = 0;
  const key = ["workspace", "channel", workspaceVideos, "random"];
  const first = memo(key, () => { builds += 1; return randomOrder; });
  const unrelatedRerender = memo(["workspace", "channel", workspaceVideos, "random"], () => { builds += 1; return [...workspaceVideos].reverse(); });
  assert.equal(unrelatedRerender, first);
  assert.equal(builds, 1);
  const changedSort = memo(["workspace", "channel", workspaceVideos, "newest"], () => { builds += 1; return workspaceVideos; });
  assert.notEqual(changedSort, first);
  assert.equal(builds, 2);

  const partitionMemo = createYouTubeListMemo();
  const initialReasons = { a: { relevance: "strong" } };
  const initialGroups = partitionMemo([workspaceVideos, initialReasons], () => partitionYouTubeVideoResults(workspaceVideos, initialReasons));
  const changedReasons = { a: { relevance: "broader" } };
  const updatedGroups = partitionMemo([workspaceVideos, changedReasons], () => partitionYouTubeVideoResults(workspaceVideos, changedReasons));
  assert.notEqual(updatedGroups, initialGroups, "changed search reasons should invalidate the cached grouping");
  assert.deepEqual(updatedGroups.broader.map((video) => video.id), ["a"]);
});

test("YouTube progress store batches same-phase updates and flushes phase changes and final progress", () => {
  const frames = new Map();
  let nextFrame = 1;
  const store = createYouTubeProgressStore({ phase: "idle", completedChannels: 0, totalChannels: 2, importedVideos: 0 }, (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return { kind: "animation", id };
  }, (frame) => frames.delete(frame.id));
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });

  store.publish({ phase: "resolving", completedChannels: 0, totalChannels: 2, importedVideos: 0 });
  assert.equal(notifications, 1, "initial phase should be visible immediately");
  store.publish({ phase: "importing", completedChannels: 0, totalChannels: 2, completedSources: 0, totalSources: 10, importedVideos: 0 });
  assert.equal(notifications, 2, "phase change should be visible immediately");

  store.publish({ phase: "importing", completedChannels: 1, totalChannels: 2, completedSources: 1, totalSources: 10, importedVideos: 12 });
  store.publish({ phase: "importing", completedChannels: 2, totalChannels: 2, completedSources: 2, totalSources: 10, importedVideos: 23 });
  assert.equal(notifications, 2, "same-frame counters should not publish repeatedly");
  const [frameId, runFrame] = frames.entries().next().value;
  frames.delete(frameId);
  runFrame();
  assert.equal(notifications, 3);
  assert.equal(store.getSnapshot().importedVideos, 23, "the latest progress snapshot should win");

  store.publish({ phase: "complete", completedChannels: 2, totalChannels: 2, completedSources: 10, totalSources: 10, importedVideos: 30 });
  assert.equal(notifications, 4, "completion should flush immediately");
  assert.equal(store.getSnapshot().phase, "complete");
});
