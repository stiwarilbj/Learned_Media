import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
const require = createRequire(import.meta.url), Module = require("node:module"), ts = require("typescript");
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
const web = require("../lib/video-source-index.ts"), storage = require("../lib/youtube-catalog-storage.ts");
const background = require("../lib/background-work.ts");
const context = { LEARNED_MEDIA_BACKGROUND: background, LEARNED_MEDIA_VIDEO_METADATA: require("../lib/video-metadata.ts") }; context.globalThis = context;
vm.runInNewContext(readFileSync(new URL("../../App/Resources/frontend/video-source-index.js", import.meta.url), "utf8"), context);
const clean = value => JSON.parse(JSON.stringify(value));
function video(id, sourceIds = [], extra = {}) { return { id, channelId: "channel", channelName: "Channel", title: id, description: "Full description", tags: [], topics: [], publishedAt: "2024-01-01", durationSeconds: 600, durationLabel: "10:00", approved: true, sourceIds, ...extra }; }
const allowed = item => item.approved;
function baseline(previous, refreshes, active) {
  const merged = new Map(previous.map(item => [item.id, item]));
  for (const refresh of refreshes) {
    const incoming = new Set(refresh.videos.map(item => item.id));
    for (const [id, item] of merged) if (!incoming.has(id) && item.sourceIds?.includes(refresh.sourceId)) {
      const sourceIds = item.sourceIds.filter(source => source !== refresh.sourceId);
      if (sourceIds.length) merged.set(id, { ...item, sourceIds }); else merged.delete(id);
    }
    for (const item of refresh.videos) {
      const old = merged.get(item.id);
      merged.set(item.id, { ...old, ...item, sourceIds: Array.from(new Set([...(old?.sourceIds ?? []), refresh.sourceId])) });
    }
  }
  if (active) for (const [id, item] of merged) {
    const sourceIds = (item.sourceIds ?? []).filter(source => !/^(channel|playlist):/.test(source) || active.has(source));
    if (sourceIds.length === (item.sourceIds ?? []).length) continue;
    if (sourceIds.length) merged.set(id, { ...item, sourceIds }); else merged.delete(id);
  }
  return [...merged.values()].filter(allowed);
}
for (const [platform, api] of [["web", web], ["Mac", context.LEARNED_MEDIA_VIDEO_SOURCES]]) {
  test(`${platform}: playlist refresh preserves overlaps, order, provenance and unaffected records`, async () => {
    const original = [video("shared", ["playlist:A", "playlist:B"]), video("removed", ["playlist:A"]), video("untouched", ["channel:C"]), video("pinned", ["playlist:A", "individual:pinned"])];
    const frozen = clean(original);
    const changes = [{ sourceId: "playlist:A", videos: [video("shared", ["playlist:A"], { title: "Updated title" }), video("new", ["playlist:A"])] }];
    const result = await api.mergeVideoSourceRefreshes(original, changes, allowed);
    assert.deepEqual(clean(result), baseline(original, changes));
    assert.equal(result.find(item => item.id === "untouched"), original[2]);
    assert.deepEqual(original, frozen, "refresh must not mutate the original records or lookup");
    assert.deepEqual(clean(await api.catalogSourceMembership(original)), { version: 1, entries: [["playlist:A", ["shared", "removed", "pinned"]], ["playlist:B", ["shared"]], ["channel:C", ["untouched"]], ["individual:pinned", ["pinned"]]] });
    const emptied = await api.mergeVideoSourceRefreshes(result, [{ sourceId: "playlist:A", videos: [] }], allowed);
    assert.deepEqual(clean(emptied), clean(baseline(result, [{ sourceId: "playlist:A", videos: [] }])));
  });
  test(`${platform}: 30,000 records match full-scan refresh rules without rescanning unrelated provenance`, async () => {
    let reads = 0;
    const previous = Array.from({ length: 30000 }, (_, index) => {
      const item = video(String(index)); const sources = [`playlist:${index % 100}`, `channel:${index % 20}`];
      Object.defineProperty(item, "sourceIds", { enumerable: true, get() { reads++; return sources; } }); return item;
    });
    await api.catalogSourceMembership(previous); reads = 0;
    await api.catalogSourceMembership(previous);
    assert.equal(reads, 0, "an unchanged catalog reuses its source lookup");
    const refreshes = [{ sourceId: "playlist:1", videos: [video("1", ["playlist:1"]), video("fresh", ["playlist:1"])] }];
    const result = await api.mergeVideoSourceRefreshes(previous, refreshes, allowed);
    assert.ok(reads < 3000, `only affected membership should be examined, got ${reads}`);
    assert.deepEqual(clean(result), baseline(previous, refreshes));
    reads = 0; await api.catalogSourceMembership(result); assert.equal(reads, 0, "the updated lookup is already indexed");
  });
  test(`${platform}: retired sources and rejected records disappear from the reverse lookup`, async () => {
    const previous = [video("overlap", ["playlist:old", "playlist:keep"]), video("old", ["playlist:old"]), video("special", ["individual:special"]), video("invalid", ["playlist:keep"], { approved: false })];
    const active = new Set(["playlist:keep"]);
    const result = await api.mergeVideoSourceRefreshes(previous, [], allowed, active);
    assert.deepEqual(clean(result), baseline(previous, [], active));
    assert.deepEqual(clean(await api.catalogSourceMembership(result)), { version: 1, entries: [["playlist:keep", ["overlap"]], ["individual:special", ["special"]]] });
  });
  test(`${platform}: cancellation cannot alter the original lookup or poison a later retry`, async () => {
    const previous = [video("a", ["playlist:A"])];
    const saved = clean(await api.catalogSourceMembership(previous));
    let checks = 0;
    await assert.rejects(api.mergeVideoSourceRefreshes(previous, [{ sourceId: "playlist:A", videos: [] }], allowed, undefined, () => { if (++checks === 5) throw new Error("Canceled"); }), /Canceled/);
    assert.deepEqual(clean(await api.catalogSourceMembership(previous)), saved);
    assert.deepEqual(clean(await api.mergeVideoSourceRefreshes(previous, [{ sourceId: "playlist:A", videos: [] }], allowed)), []);
  });
  test(`${platform}: record reuse carries the prepared lookup through new snapshot arrays`, async () => {
    const previous = [video("a", ["playlist:A"]), video("b", ["playlist:B"])];
    const next = await api.mergeVideoSourceRefreshes(previous, [{ sourceId: "playlist:A", videos: [video("new", ["playlist:A"])] }], allowed);
    const reused = await api.reuseIndexedVideoRecords(previous, next);
    assert.notEqual(reused, next, "exercise the record-reuse helper's fresh array");
    let reads = 0;
    for (const item of reused) {
      const sources = item.sourceIds;
      Object.defineProperty(item, "sourceIds", { enumerable: true, get() { reads++; return sources; } });
    }
    await api.catalogSourceMembership(reused);
    assert.equal(reads, 0, "saving a reused snapshot must not rebuild all provenance");
    const again = await api.mergeVideoSourceRefreshes(reused, [], allowed);
    assert.equal(reads, 0, "the next refresh retains the lookup too");
    assert.deepEqual(clean(again), clean(reused));
  });
  test(`${platform}: new catalog snapshots invalidate membership and serialization cannot mutate cached sets`, async () => {
    const previous = [video("a", ["playlist:A"])]; const saved = await api.catalogSourceMembership(previous);
    saved.entries[0][1].push("fake");
    assert.deepEqual(clean(await api.catalogSourceMembership(previous)).entries[0][1], ["a"]);
    const replacement = [{ ...previous[0], sourceIds: ["playlist:B"] }];
    assert.deepEqual(clean(await api.catalogSourceMembership(replacement)), { version: 1, entries: [["playlist:B", ["a"]]] });
  });
}

test("catalog commits publish membership atomically with record references and stage only changed records", async () => {
  const original = [video("a", ["playlist:A"]), video("b", ["playlist:B"])];
  const first = await storage.planCatalogCommit({ channels: [], videos: original }, [], undefined);
  const next = await web.mergeVideoSourceRefreshes(original, [{ sourceId: "playlist:A", videos: [video("new", ["playlist:A"])] }], allowed);
  const second = await storage.planCatalogCommit({ channels: [], videos: next }, original, first.manifest);
  assert.deepEqual(second.upserts.map(record => record.video.id), ["new"]);
  assert.equal(second.manifest.entries[0][1], first.manifest.entries[1][1], "unaffected record key is retained");
  assert.deepEqual(Object.fromEntries(second.manifest.sourceMembership.entries), { "playlist:B": ["b"], "playlist:A": ["new"] });
  assert.deepEqual(first.manifest.sourceMembership.entries, [["playlist:A", ["a"]], ["playlist:B", ["b"]]]);
  const restored = await storage.restoreStoredCatalog(second.manifest, [...first.upserts, ...second.upserts]);
  assert.deepEqual(restored.videos, next);
  assert.equal("sourceMembership" in restored, false, "derived persistence data does not enter workspace/cloud formats");
});

test("missing and stale persisted lookups are rebuilt from the authoritative video records", async () => {
  const videos = [video("a", ["playlist:A", "playlist:A"]), video("b", ["playlist:B"])];
  const plan = await storage.planCatalogCommit({ channels: [], videos }, [], undefined);
  for (const sourceMembership of [undefined, {}, { version: 2, entries: [] }, { version: 1, entries: [["playlist:A", ["fake"]]] }, { version: 1, entries: [["playlist:A", ["a", "a"]]] }, { version: 1, entries: [["playlist:A", ["a"]], ["playlist:B", ["b"]], ["invented", ["a"]]] }, plan.manifest.sourceMembership]) {
    const restored = await storage.restoreStoredCatalog({ ...plan.manifest, sourceMembership }, plan.upserts);
    assert.deepEqual(restored.videos, videos);
    assert.deepEqual(await web.catalogSourceMembership(restored.videos), plan.manifest.sourceMembership);
  }
});

test("website import controller applies only successful refreshes and retains retryable failed sources", async () => {
  const youtube = require("../lib/youtube.ts");
  const channels = youtube.APPROVED_YOUTUBE_CHANNELS.map((seed, index) => ({ id: seed.channelId || `channel-${index}`, name: seed.name, approved: true }));
  const sourceIds = youtube.APPROVED_YOUTUBE_CHANNELS.flatMap((seed, index) => seed.playlistIds?.length ? seed.playlistIds.map(id => `playlist:${id}`) : [`channel:${channels[index].id}`]);
  const target = sourceIds.find(id => id.startsWith("playlist:"));
  const failed = sourceIds.find(id => id !== target && id.startsWith("playlist:"));
  assert.ok(target && failed);
  const sourceStates = Object.fromEntries([...sourceIds, ...youtube.APPROVED_INDIVIDUAL_VIDEOS.map(seed => `individual:${seed.videoId}`)].map(sourceId => [sourceId, { sourceId, status: "ready", lastSuccessfulSyncAt: new Date().toISOString() }]));
  sourceStates[target].status = sourceStates[failed].status = "error";
  const original = [video("removed", [target]), video("failed-source", [failed]), video("unrelated", [sourceIds.find(id => id.startsWith("channel:"))])];
  const client = new youtube.YouTubeClient("fixture", () => { throw new Error("Unexpected network request"); });
  const calls = [];
  client.importPlaylist = async (_channel, _playlist, sourceId) => { calls.push(sourceId); if (sourceId === failed) throw new Error("Temporary source failure"); return [video("new", [sourceId])]; };
  const result = await client.syncApprovedCatalog(channels, undefined, undefined, { existingVideos: original, sourceStates });
  assert.deepEqual(new Set(calls), new Set([target, failed]));
  assert.deepEqual(result.videos.map(item => item.id), ["failed-source", "unrelated", "new"]);
  assert.equal(result.sourceStates[failed].status, "error");
  assert.equal(result.incomplete, true);
  assert.deepEqual(result.completedCheckpointSources, [target]);
});

test("Mac import controller uses the shared lookup and preserves failed playlist members", async () => {
  const seed = { name: "Fixture Channel", channelId: "fixture", playlistIds: ["A", "B"] };
  const native = vm.createContext({ console, DOMException, performance, setTimeout, clearTimeout,
    LEARNED_MEDIA_BACKGROUND: background,
    LEARNED_MEDIA_VIDEO_SOURCES: context.LEARNED_MEDIA_VIDEO_SOURCES,
    LEARNED_MEDIA_SHARED: { youtube: { APPROVED_YOUTUBE_CHANNELS: [seed], APPROVED_INDIVIDUAL_VIDEOS: [], YOUTUBE_TOPICS: [], DEFAULT_YOUTUBE_RECENCY_PREFERENCES: {}, isApprovedYouTubeVideo: allowed, isYouTubeShortMetadata: () => false } },
    __learnedMediaNativeRequest: async action => { assert.equal(action, "hasYouTubeImportPages"); return false; }
  });
  vm.runInContext("window = globalThis", native);
  const source = readFileSync(new URL("../../App/Resources/frontend/youtube-catalog.js", import.meta.url), "utf8")
    .replace("window.LEARNED_MEDIA_YOUTUBE = {", "window.__replacePlaylist = fn => { importPlaylist = fn; }; window.LEARNED_MEDIA_YOUTUBE = {");
  vm.runInContext(source, native);
  native.__replacePlaylist(async (_channel, _playlist, sourceId) => { if (sourceId === "playlist:B") throw new Error("Temporary source failure"); return [video("new", [sourceId])]; });
  const original = [video("removed", ["playlist:A"]), video("failed-source", ["playlist:B"])];
  const result = await native.LEARNED_MEDIA_YOUTUBE.sync("fixture", { videos: original, channels: [{ id: "fixture", name: seed.name }] }, () => {}, true, () => true);
  assert.deepEqual(clean(result.videos).map(item => item.id), ["failed-source", "new"]);
  assert.equal(result.sourceStates["playlist:B"].status, "error");
  assert.equal(result.incomplete, true);
  assert.deepEqual(clean(result.completedCheckpointSources), ["playlist:A"]);
});
