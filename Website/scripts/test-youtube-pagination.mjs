import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
const youtube = require(path.join(root, "lib/youtube.ts"));
const checkpoints = require(path.join(root, "lib/youtube-import-checkpoints.ts"));
const background = require(path.join(root, "lib/background-work.ts"));
const channel = { id: "UCfixture", name: "Fixture Channel", approved: true };
const sourceId = "playlist:fixture";

function createStore() {
  const saved = new Map();
  const stats = { fullLoads: 0, batches: [] };
  return {
    async has(id) { return (saved.get(id)?.length ?? 0) > 0; },
    async load(id) { stats.fullLoads += 1; return structuredClone(saved.get(id) ?? []); },
    async *loadBatches(id, cancellation) {
      const pages = saved.get(id) ?? [];
      for (let start = 0; start < pages.length; start += checkpoints.YOUTUBE_IMPORT_PAGE_BATCH_SIZE) {
        background.checkBackgroundCancellation(cancellation);
        const batch = structuredClone(pages.slice(start, start + checkpoints.YOUTUBE_IMPORT_PAGE_BATCH_SIZE));
        stats.batches.push(batch.length);
        yield batch;
        await background.yieldBackground(cancellation);
      }
    },
    async save(page) { const list = saved.get(page.sourceId) ?? []; list[page.index] = structuredClone(page); saved.set(page.sourceId, list); },
    async clear(id) { saved.delete(id); },
    stats,
    seed(id, pages) { saved.set(id, structuredClone(pages)); }
  };
}
function metadataItem(id) {
  return { id, snippet: { channelId: channel.id, channelTitle: channel.name, title: `Documentary ${id}`, description: "A complete documentary.", publishedAt: "2020-01-01T00:00:00Z", tags: [] },
    contentDetails: { duration: "PT20M" }, status: { privacyStatus: "public", embeddable: true } };
}
function harness(platform, store = createStore()) {
  let responses = new Map();
  const requests = [], metadataCalls = [];
  const request = async (resource, params) => {
    assert.equal(resource, "playlistItems");
    const token = params.pageToken ?? "";
    requests.push(token);
    assert.ok(requests.length < 15, "pagination must remain bounded");
    assert.ok(responses.has(token), `unexpected token ${token}`);
    const scheduled = responses.get(token);
    const response = Array.isArray(scheduled) ? scheduled.shift() : scheduled;
    if (response instanceof Error) throw response;
    return { items: [{ contentDetails: { videoId: `video-${token || "first"}` } }], ...response };
  };
  const metadata = async ids => { metadataCalls.push([...ids]); return ids.map(metadataItem); };
  let run;
  if (platform === "web") {
    const client = new youtube.YouTubeClient("fixture", request);
    run = (signal) => client.importPlaylist(channel, "fixture", sourceId, metadata, signal, undefined, store).then(refresh => refresh.videos);
  } else {
    const context = vm.createContext({ console, setTimeout, clearTimeout, performance, DOMException, crypto: globalThis.crypto,
      LEARNED_MEDIA_BACKGROUND: background,
      LEARNED_MEDIA_SHARED: { youtube: { APPROVED_YOUTUBE_CHANNELS: [], APPROVED_INDIVIDUAL_VIDEOS: [], YOUTUBE_TOPICS: [], DEFAULT_YOUTUBE_RECENCY_PREFERENCES: {},
        YOUTUBE_CATALOG_VERSION: youtube.YOUTUBE_CATALOG_VERSION, isApprovedYouTubeVideo: () => true, isYouTubeShortMetadata: () => false } },
      __learnedMediaNativeRequest: async (_action, payload) => request(payload.resource, payload.params)
    });
    vm.runInContext("window = globalThis", context);
    vm.runInContext(readFileSync(path.join(root, "../App/Resources/frontend/youtube-import-checkpoints.js"), "utf8"), context);
    const catalog = readFileSync(path.join(root, "../App/Resources/frontend/youtube-catalog.js"), "utf8")
      .replace("window.LEARNED_MEDIA_YOUTUBE = {", "window.__testImportPlaylist = importPlaylist; window.LEARNED_MEDIA_YOUTUBE = {");
    vm.runInContext(catalog, context);
    run = (signal) => context.__testImportPlaylist(channel, "fixture", sourceId, "fixture", metadata, store, undefined, () => signal?.throwIfAborted()).then(refresh => refresh.videos);
  }
  return { store, requests, metadataCalls, run, respond: entries => { responses = new Map(entries); } };
}

for (const platform of ["web", "mac"]) {
  test(`${platform}: checkpoint recovery validates ordered batches with the same continuation result as a full read`, async () => {
    const identity = checkpoints.importPageIdentity(youtube.YOUTUBE_CATALOG_VERSION, channel.id, "fixture");
    const generation = "fixture-generation";
    const batchSizes = [];
    const pages = Array.from({ length: 61 }, (_, index) => ({
      version: checkpoints.YOUTUBE_IMPORT_CHECKPOINT_VERSION, sourceId, identity, refreshGeneration: generation, index,
      requestToken: index ? `token-${index}` : "", nextPageToken: index === 60 ? null : `token-${index + 1}`,
      videos: [{ id: `video-${index}`, channelId: channel.id, channelName: channel.name, title: `Video ${index}`, description: "Fixture video.",
        publishedAt: "2025-01-01T00:00:00Z", durationLabel: "1:00", durationSeconds: 60, embedAvailable: true, approved: true,
        tags: [], topics: [], sourceIds: [sourceId] }], savedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString()
    }));
    const fullStore = { async load() { return structuredClone(pages); }, async clear() {} };
    const batchStore = {
      async load() { throw new Error("Batched recovery must not request all checkpoint pages."); },
      async clear() {},
      async *loadBatches(_source, cancellation) {
        for (let start = 0; start < pages.length; start += checkpoints.YOUTUBE_IMPORT_PAGE_BATCH_SIZE) {
          background.checkBackgroundCancellation(cancellation);
          const batch = structuredClone(pages.slice(start, start + checkpoints.YOUTUBE_IMPORT_PAGE_BATCH_SIZE));
          batchSizes.push(batch.length);
          yield batch;
          await background.yieldBackground(cancellation);
        }
      }
    };
    const full = await checkpoints.openImportCheckpoint(fullStore, sourceId, identity);
    const batched = await checkpoints.openImportCheckpoint(batchStore, sourceId, identity);
    assert.equal(batched.nextPageToken, full.nextPageToken);
    assert.deepEqual(batched.videos, full.videos);
    assert.deepEqual(batched.completedRefresh(), full.completedRefresh());
    assert.deepEqual(batchSizes, [25, 25, 11]);

    const incomplete = pages.slice(0, 60).map(page => ({ ...page }));
    const fullIncomplete = await checkpoints.openImportCheckpoint({ async load() { return incomplete; }, async clear() {} }, sourceId, identity);
    const batchIncomplete = await checkpoints.openImportCheckpoint({ ...batchStore,
      async *loadBatches() { yield incomplete.slice(0, 25); yield incomplete.slice(25, 50); yield incomplete.slice(50); }
    }, sourceId, identity);
    assert.equal(batchIncomplete.nextPageToken, fullIncomplete.nextPageToken);
    assert.deepEqual(batchIncomplete.videos, fullIncomplete.videos);
    assert.equal(batchIncomplete.nextPageToken, "token-60");
    assert.throws(() => batchIncomplete.completedRefresh(), /incomplete/);

    const corrupt = pages.map(page => ({ ...page }));
    corrupt[30] = { ...corrupt[30], requestToken: "wrong-token" };
    let batchCleared = false;
    let fullCleared = false;
    const fullCorrupt = await checkpoints.openImportCheckpoint({ async load() { return corrupt; }, async clear() { fullCleared = true; } }, sourceId, identity);
    const batchCorrupt = await checkpoints.openImportCheckpoint({ ...batchStore, async clear() { batchCleared = true; },
      async *loadBatches() { yield corrupt.slice(0, 25); yield corrupt.slice(25, 50); }
    }, sourceId, identity);
    assert.equal(batchCorrupt.nextPageToken, fullCorrupt.nextPageToken);
    assert.deepEqual(batchCorrupt.videos, fullCorrupt.videos);
    assert.equal(fullCleared, true);
    assert.equal(batchCleared, true);
    assert.equal(batchCorrupt.nextPageToken, "");
    assert.deepEqual(batchCorrupt.videos, []);
  });

  test(`${platform}: checkpoint recovery checks cancellation between page batches`, async () => {
    const identity = checkpoints.importPageIdentity(youtube.YOUTUBE_CATALOG_VERSION, channel.id, "fixture");
    const controller = new AbortController();
    let cleared = false;
    const page = { version: checkpoints.YOUTUBE_IMPORT_CHECKPOINT_VERSION, sourceId, identity, refreshGeneration: "cancel-test", index: 0,
      requestToken: "", nextPageToken: "next", videos: [], savedAt: new Date().toISOString() };
    const store = { async load() { throw new Error("Full checkpoint reads are not used."); }, async clear() { cleared = true; },
      async *loadBatches() { yield [page]; controller.abort(); }
    };
    await assert.rejects(checkpoints.openImportCheckpoint(store, sourceId, identity, undefined, controller.signal), { name: "AbortError" });
    assert.equal(cleared, false, "cancellation preserves the durable checkpoint for a later retry");
  });

  for (const [name, entries, requested] of [
    ["self loop", [["", { nextPageToken: "A" }], ["A", { nextPageToken: "A" }]], ["", "A"]],
    ["longer loop", [["", { nextPageToken: "A" }], ["A", { nextPageToken: "B" }], ["B", { nextPageToken: "A" }]], ["", "A", "B"]]
  ]) {
    test(`${platform}: ${name} stops before metadata and preserves a retryable checkpoint`, async () => {
      const h = harness(platform); h.respond(entries);
      await assert.rejects(h.run(), /repeated an import page/);
      assert.deepEqual(h.requests, requested);
      assert.equal(h.metadataCalls.length, requested.length - 1, "the cyclic response must not spend a metadata request");
      const saved = await h.store.load(sourceId);
      assert.equal(saved.length, requested.length - 1);
      const identity = checkpoints.importPageIdentity(youtube.YOUTUBE_CATALOG_VERSION, channel.id, "fixture");
      const restored = await checkpoints.openImportCheckpoint(h.store, sourceId, identity);
      assert.equal(restored.nextPageToken, requested.at(-1));
      assert.equal(restored.videos.length, saved.length);
      const retry = harness(platform, h.store); retry.respond([[requested.at(-1), {}]]);
      const videos = await retry.run();
      assert.deepEqual(retry.requests, [requested.at(-1)]);
      assert.equal(videos.length, requested.length, "a healthy retry retains previous videos and finishes");
      const completed = await checkpoints.openImportCheckpoint(h.store, sourceId, identity);
      assert.equal(completed.nextPageToken, null);
      assert.equal(completed.videos.length, requested.length);
    });
  }
  test(`${platform}: resumed imports detect a return to tokens from earlier pages`, async () => {
    const h = harness(platform); h.respond([["", { nextPageToken: "A" }], ["A", { nextPageToken: "B" }]]);
    await assert.rejects(h.run(), /unexpected token B/);
    const retry = harness(platform, h.store); retry.respond([["B", { nextPageToken: "A" }]]);
    await assert.rejects(retry.run(), /repeated an import page/);
    assert.deepEqual(retry.requests, ["B"]);
    assert.equal(retry.metadataCalls.length, 0);
    assert.equal((await h.store.load(sourceId)).length, 2);
  });
  test(`${platform}: an invalid-token restart creates a fresh token history`, async () => {
    const h = harness(platform);
    const invalid = platform === "web" ? new youtube.YouTubeApiError("Invalid page token.", 400, "invalidPageToken", false) : new Error("Invalid page token.");
    h.respond([["", { nextPageToken: "A" }], ["A", [invalid, {}]]]);
    const videos = await h.run();
    assert.deepEqual(h.requests, ["", "A", "", "A"]);
    assert.equal(videos.length, 2);
    assert.equal((await h.store.load(sourceId)).at(-1).nextPageToken, null);
  });
  test(`${platform}: normal empty and terminal pages retain existing pagination behavior`, async () => {
    const h = harness(platform); h.respond([["", { nextPageToken: "A" }], ["A", { items: [], nextPageToken: "B" }], ["B", {}]]);
    const videos = await h.run();
    assert.deepEqual(h.requests, ["", "A", "B"]);
    assert.equal(videos.length, 2);
    const again = harness(platform, h.store);
    assert.equal((await again.run()).length, 2);
    assert.equal(again.requests.length, 0, "completed checkpoints make no requests");
  });
  test(`${platform}: cancellation retains the last committed page`, async () => {
    const h = harness(platform); h.respond([["", {}]]);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(h.run(controller.signal), { name: "AbortError" });
    assert.equal(h.requests.length, 0);
    assert.equal((await h.store.load(sourceId)).length, 0);
  });
}

for (const platform of ["web", "mac"]) {
  test(`${platform}: interrupted generation retains published membership until terminal resume`, async () => {
    const sources = require(path.join(root, "lib/video-source-index.ts"));
    const h = harness(platform); h.respond([["", { nextPageToken: "A" }]]);
    await assert.rejects(h.run(), /unexpected token A/);
    const saved = await h.store.load(sourceId), identity = saved[0].identity;
    const generation = saved[0].refreshGeneration;
    assert.ok(generation);
    const partial = await checkpoints.openImportCheckpoint(h.store, sourceId, identity);
    assert.throws(() => partial.completedRefresh(), /incomplete/);
    const prior = [{ ...metadataItem("old"), id: "old", sourceIds: [sourceId], approved: true }];
    const safe = await sources.mergeVideoSourceRefreshes(prior, [{ sourceId, generation, complete: false, videos: partial.videos }], () => true);
    assert.ok(safe.some(video => video.id === "old"));
    await assert.rejects(checkpoints.verifyYouTubeRefreshes([{ sourceId, identity, generation }], h.store), /incomplete/);
    assert.equal((await h.store.load(sourceId)).length, 1);
    const resumed = harness(platform, h.store); resumed.respond([["A", {}]]); await resumed.run();
    const completed = (await checkpoints.openImportCheckpoint(h.store, sourceId, identity)).completedRefresh();
    assert.equal(completed.generation, generation);
    await checkpoints.verifyYouTubeRefreshes([completed], h.store);
    const final = await sources.mergeVideoSourceRefreshes(prior, [completed], () => true);
    assert.ok(!final.some(video => video.id === "old"));
    assert.equal(final.length, 2);
    await assert.rejects(checkpoints.verifyYouTubeRefreshes([{ ...completed, generation: "superseded" }], h.store), /changed before publication/);
  });
  test(`${platform}: legacy staged pages restart without authorizing removals`, async () => {
    const h = harness(platform); h.respond([["", { nextPageToken: "A" }]]); await assert.rejects(h.run());
    const pages = await h.store.load(sourceId);
    delete pages[0].refreshGeneration; await h.store.save(pages[0]);
    const retry = harness(platform, h.store); retry.respond([["", {}]]); await retry.run();
    assert.deepEqual(retry.requests, [""]);
    const next = await h.store.load(sourceId);
    assert.ok(next[0].refreshGeneration);
    assert.equal(next.length, 1);
  });
}
