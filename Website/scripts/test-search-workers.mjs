import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};
const { toVideoSearchDocument } = require("../lib/video-metadata.ts");
const { insertBoundedRanked, makeLocalVideoPlan } = require("../lib/video-semantic.ts");
const projectVideos = (videos) => videos.map(toVideoSearchDocument);

function importFromWorker(specifier) {
  if (!specifier.startsWith("@/")) return require(specifier);
  return require(path.join(root, `${specifier.slice(2)}.ts`));
}

function loadWorker(filename, { observeMaps = false, searchOverride, searchModuleOverride, indexOverride, persistenceOverride, performanceNow = () => globalThis.performance.now() } = {}) {
  const messages = [];
  let workerYieldCount = 0;
  const workerMaps = [];
  class ObservedMap extends Map {
    constructor(...args) {
      super(...args);
      this.valuesCallCount = 0;
      workerMaps.push(this);
    }

    values() {
      this.valuesCallCount += 1;
      return super.values();
    }
  }
  const scope = { onmessage: null, postMessage: (message) => messages.push(message) };
  const source = ts.transpileModule(readFileSync(path.join(root, filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const workerSetTimeout = (callback, delay) => {
    if (delay === 0) workerYieldCount += 1;
    return setTimeout(callback, delay);
  };
  const workerImport = (specifier) => {
    const imported = importFromWorker(specifier);
    if (specifier === "@/lib/youtube-search-index-storage" && persistenceOverride) return { ...imported, createVideoSearchIndexPersistence: persistenceOverride };
    if (specifier === "@/lib/search" && searchModuleOverride) return searchModuleOverride(imported);
    if (specifier === "@/lib/background-work") return { ...imported,
      runBackgroundSlice: (work, options) => {
        workerYieldCount += 1;
        return imported.runBackgroundSlice(work, options);
      } };
    if (specifier === "@/lib/video-semantic") return { ...imported,
      searchPreparedSemanticVideos: searchOverride ? searchOverride(imported.searchPreparedSemanticVideos) : imported.searchPreparedSemanticVideos,
      indexVideoSearchMetadata: indexOverride ? indexOverride(imported.indexVideoSearchMetadata) : imported.indexVideoSearchMetadata };
    return imported;
  };
  const inspection = filename === "workers/youtube-search.worker.ts"
    ? "\nself.inspectCatalog = () => snapshot; self.inspectSearchSessions = () => ({ size: searchSessionCache.size, bytes: searchSessionCache.approximateBytes, items: Array.from(searchSessionCache.entries.values(), entry => entry.value) }); self.inspectSearchCaches = () => ({ results: resultCache.size, sessions: searchSessionCache.size, prepared: preparedSearchCache.size }); self.inspectSearchState = () => ({ latestRequestId, activeRequestId });"
    : filename === "workers/card-search.worker.ts" ? "\nself.inspectCardDocuments = () => documents;" : "";
  new Function("require", "module", "exports", "self", "setTimeout", "Map", "performance", source + inspection)(workerImport, module, module.exports, scope, workerSetTimeout, observeMaps ? ObservedMap : Map, { now: performanceNow });
  return { scope, messages, workerMaps, get workerYieldCount() { return workerYieldCount; } };
}

function loadNativeYouTubeWorker({ observeMaps = false, searchOverride, indexOverride, persistenceOverride, performanceNow = () => globalThis.performance.now() } = {}) {
  const messages = [];
  const workerMaps = [];
  class ObservedMap extends Map {
    constructor(...args) {
      super(...args);
      this.valuesCallCount = 0;
      workerMaps.push(this);
    }

    values() {
      this.valuesCallCount += 1;
      return super.values();
    }
  }
  const context = { postMessage: (message) => messages.push(message), setTimeout, Map: observeMaps ? ObservedMap : Map, performance: { now: performanceNow } };
  context.globalThis = context;
  context.importScripts = (filename) => {
    const runtime = readFileSync(path.join(root, "..", "App", "Resources", "frontend", filename), "utf8");
    vm.runInNewContext(runtime, context);
    if (filename === "youtube-search-index-storage.js" && persistenceOverride) context.LEARNED_MEDIA_VIDEO_INDEX_STORAGE.createVideoSearchIndexPersistence = persistenceOverride;
  };
  const source = readFileSync(path.join(root, "..", "App", "Resources", "frontend", "youtube-search.worker.js"), "utf8");
  vm.runInNewContext(source + "\nglobalThis.inspectCatalog = () => snapshot; globalThis.inspectSearchSessions = () => ({ size: searchSessionCache.size, bytes: searchSessionCacheBytes, items: Array.from(searchSessionCache.values(), entry => entry.value) }); globalThis.inspectSearchCaches = () => ({ results: 0, sessions: searchSessionCache.size, prepared: preparedSearchCache.size }); globalThis.inspectSearchState = () => ({ latest });", context);
  if (searchOverride) context.LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos = searchOverride(context.LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos);
  if (indexOverride) context.LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata = indexOverride(context.LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata);
  return { messages, workerMaps, context, send: (data) => context.onmessage({ data }) };
}

function loadNativeCardWorker() {
  const messages = [];
  const context = {
    self: { postMessage: (message) => messages.push(message) },
    setTimeout,
    Map,
    importScripts(filename) {
      const runtime = readFileSync(path.join(root, "..", "App", "Resources", "frontend", filename), "utf8");
      vm.runInNewContext(runtime, context);
    }
  };
  context.globalThis = context;
  const source = readFileSync(path.join(root, "..", "App", "Resources", "frontend", "card-search.worker.js"), "utf8");
  vm.runInNewContext(source + "\nglobalThis.inspectCardDocuments = () => documents;", context);
  return { messages, context, documents: () => context.inspectCardDocuments(), send: (data) => context.self.onmessage({ data }) };
}

async function waitForMessage(messages, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = messages.find(predicate);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Timed out waiting for a search worker response.");
}

test("bounded ranking retains only the requested top results and preserves tie order", () => {
  const ranked = [];
  const candidates = Array.from({ length: 20_000 }, (_, index) => ({ score: (index * 7919) % 997, index }));
  const compare = (left, right) => right.score - left.score || left.index - right.index;
  for (const candidate of candidates) {
    insertBoundedRanked(ranked, candidate, 80, compare);
    assert.ok(ranked.length <= 80);
  }
  assert.deepEqual(ranked, [...candidates].sort(compare).slice(0, 80));
  const tied = [];
  for (let index = 0; index < 200; index++) insertBoundedRanked(tied, { score: 1, index }, 7, compare);
  assert.deepEqual(tied.map((item) => item.index), [0, 1, 2, 3, 4, 5, 6]);
});

test("website and Mac ranking slices adapt to measured device speed without changing results", async () => {
  const videos = Array.from({ length: 3_000 }, (_, index) => ({
    id: `adaptive-${index}`, channelId: "science", channelName: "Science Channel",
    title: `Ancient biology field study ${index}`, description: "A documented ancient biology study.",
    tags: ["ancient biology"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600,
    topics: ["Science"], approved: true
  }));
  const fixtures = [
    { name: "website", load: options => loadWorker("workers/youtube-search.worker.ts", options), send: (worker, data) => worker.scope.onmessage({ data }), messages: worker => worker.messages },
    { name: "Mac", load: options => loadNativeYouTubeWorker(options), send: (worker, data) => worker.send(data), messages: worker => worker.messages }
  ];
  const outputs = new Map();
  for (const fixture of fixtures) for (const speed of ["slow", "fast"]) {
    let time = 0;
    const chunkSizes = [];
    const worker = fixture.load({
      performanceNow: () => time,
      searchOverride: original => (batch, ...args) => {
        chunkSizes.push(batch.length);
        time += speed === "slow" ? batch.length : 1;
        return original(batch, ...args);
      }
    });
    fixture.send(worker, { type: "initialize", revision: 0, videos: projectVideos(videos) });
    fixture.send(worker, { type: "search", requestId: 1, revision: 0, query: "ancient biology", plan: { terms: ["ancient biology"] }, topic: "All", limit: 80, viewKey: `${fixture.name}-${speed}` });
    const reply = await waitForMessage(fixture.messages(worker), message => message.requestId === 1 && Array.isArray(message.candidates));
    assert.ok(chunkSizes.length > 1, `${fixture.name} yields between ranking slices`);
    assert.ok(chunkSizes.slice(0, -1).every(size => size >= 32 && size <= 640) && chunkSizes.at(-1) > 0 && chunkSizes.at(-1) <= 640, `${fixture.name} keeps target slices within bounds and processes the final remainder`);
    if (speed === "slow") {
      assert.deepEqual(chunkSizes.slice(0, 3), [64, 32, 32], `${fixture.name} reduces later slices when ranking is slow`);
    } else {
      assert.deepEqual(chunkSizes.slice(0, 5), [64, 128, 256, 512, 640], `${fixture.name} expands later slices when ranking is fast`);
    }
    outputs.set(`${fixture.name}-${speed}`, reply.candidates);
  }
  const comparable = candidates => candidates.map(({ videoId, score, matchedFields, supportingText }) => ({ videoId, score, matchedFields, supportingText }));
  const expected = comparable(JSON.parse(JSON.stringify(outputs.get("website-slow"))));
  for (const [name, result] of outputs) assert.deepEqual(comparable(JSON.parse(JSON.stringify(result))), expected, `${name} returns the same ranked items, scores, and explanations`);
});

test("YouTube workers reject malformed search messages before ranking or mutating request state", async () => {
  const fixtures = [
    { name: "website", load: searchOverride => loadWorker("workers/youtube-search.worker.ts", { searchOverride }), send: (worker, data) => worker.scope.onmessage({ data }), messages: worker => worker.messages, caches: worker => worker.scope.inspectSearchCaches(), state: worker => worker.scope.inspectSearchState(), isNative: false },
    { name: "Mac", load: searchOverride => loadNativeYouTubeWorker({ searchOverride }), send: (worker, data) => worker.send(data), messages: worker => worker.messages, caches: worker => worker.context.inspectSearchCaches(), state: worker => worker.context.inspectSearchState(), isNative: true }
  ];
  for (const fixture of fixtures) {
    let rankingCalls = 0;
    const searchOverride = original => (videos, prepared, limit, excluded) => { rankingCalls++; return original(videos, prepared, limit, excluded); };
    const worker = fixture.load(searchOverride);
    fixture.send(worker, { type: "initialize", revision: 0, videos: projectVideos([{
      id: `${fixture.name}-valid`, channelId: "channel-a", channelName: "Approved Channel", title: "History documentary",
      description: "A specific history story.", tags: ["history"], publishedAt: "2024-01-01T00:00:00.000Z",
      durationSeconds: 600, topics: ["History"], approved: true
    }]) });
    const beforeInvalid = fixture.state(worker);
    const base = { type: "search", revision: 0, query: "history", plan: { terms: ["history"] }, topic: "History", limit: 1 };
    const malformed = [
      { ...base, requestId: 1, query: 7 },
      { ...base, requestId: 2, plan: { terms: ["history", 7] } },
      { ...base, requestId: 3, plan: { conceptGroups: [{ terms: ["history"] }], anyOf: [[2]] } },
      { ...base, requestId: 4, plan: { sort: "sideways" } },
      { ...base, requestId: 5, topic: "Uncatalogued" },
      { ...base, requestId: 6, channelId: 9 },
      { ...base, requestId: 7, excludedIds: "already-seen" },
      { ...base, requestId: 8, expanded: "yes" },
      { ...base, requestId: 9, viewKey: {} },
      { ...base, requestId: 10, limit: 0 },
      { ...base, requestId: 11, limit: 1.5 },
      { ...base, requestId: 12, limit: 10_001 },
      { ...base, requestId: 13, plan: { minDurationSeconds: 120, maxDurationSeconds: 60 } }
    ];
    for (const request of malformed) {
      fixture.send(worker, request);
      const reply = await waitForMessage(fixture.messages(worker), message => message.type === "invalid" && message.requestId === request.requestId);
      assert.equal(reply.reason, "invalid-request", fixture.name);
    }
    fixture.send(worker, null);
    fixture.send(worker, { ...base, requestId: "not-a-number" });
    assert.equal(rankingCalls, 0, `${fixture.name} never invokes ranking for malformed messages`);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.caches(worker))), { results: 0, sessions: 0, prepared: 0 }, `${fixture.name} allocates no search cache entries for invalid requests`);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.state(worker))), JSON.parse(JSON.stringify(beforeInvalid)), `${fixture.name} leaves the active request state unchanged for invalid messages`);
    const before = fixture.state(worker);
    fixture.send(worker, { ...base, requestId: 100 });
    const validReply = await waitForMessage(fixture.messages(worker), message => message.requestId === 100 && Array.isArray(message.candidates));
    assert.equal(validReply.candidates.length, 1, `${fixture.name} remains usable after invalid requests`);
    assert.equal(rankingCalls, 1, `${fixture.name} ranks only the valid request`);
    const after = fixture.state(worker);
    if (fixture.isNative) assert.equal(after.latest, before.latest + 1, `${fixture.name} only advances search state for the valid request`);
    else { assert.equal(after.latestRequestId, 100, `${fixture.name} advances to the valid request ID`); assert.equal(after.activeRequestId, 0, `${fixture.name} settles the valid request`); }
  }
});

test("YouTube workers keep bounded direct and fallback pools with date and position ordering", async () => {
  const searchOverride = () => (videos, _prepared, _limit, excludedIds) => videos
    .filter((video) => !excludedIds.has(video.id))
    .map((video) => ({
      video,
      coverage: { matchedConcepts: [], missingConcepts: [], complete: true },
      score: video.durationSeconds,
      matchedFields: video.tags,
      supportingText: []
    }));
  const directScores = new Map([[901, 50], [950, 50], [1000, 1], [1100, 100]]);
  const makeVideos = () => Array.from({ length: 1_300 }, (_, index) => {
    const tags = directScores.has(index) ? ["title"] : ["semantic-fallback"];
    const year = index === 0 ? 2030 : index === 1100 ? 2020 : index === 1000 ? 2025 : index === 901 || index === 950 ? 2024 : 2022;
    return {
      id: `rank-${index}`, channelId: "channel-a", channelName: "Approved Channel", title: `Ranking test ${index}`,
      description: "Searchable description.", tags, publishedAt: `${year}-01-01T00:00:00.000Z`, durationSeconds: directScores.get(index) ?? 10_000 - index,
      topics: ["Science"], approved: true
    };
  });
  const fixtures = [
    { name: "website", load: () => loadWorker("workers/youtube-search.worker.ts", { searchOverride }), send: (worker, data) => worker.scope.onmessage({ data }), messages: (worker) => worker.messages },
    { name: "native", load: () => loadNativeYouTubeWorker({ searchOverride }), send: (worker, data) => worker.send(data), messages: (worker) => worker.messages }
  ];
  for (const fixture of fixtures) {
    const worker = fixture.load(), messages = fixture.messages(worker), videos = makeVideos();
    fixture.send(worker, { type: "initialize", revision: 0, videos: projectVideos(videos) });
    const search = async (requestId, sort, excludedIds = []) => {
      fixture.send(worker, { type: "search", requestId, revision: 0, query: "ranking test", plan: { terms: ["ranking test"], sort }, topic: "All", limit: 2, excludedIds, viewKey: `bounded-${sort}` });
      return waitForMessage(messages, (message) => message.type === "results" ? message.requestId === requestId : message.requestId === requestId);
    };
    const newest = await search(1, "newest");
    assert.deepEqual(Array.from(newest.candidates, (candidate) => candidate.videoId), ["rank-1000", "rank-901"], `${fixture.name} keeps direct results, newest date, then score and original position`);
    const laterDirect = await search(2, "newest", ["rank-1000", "rank-901"]);
    assert.deepEqual(Array.from(laterDirect.candidates, (candidate) => candidate.videoId), ["rank-950", "rank-1100"], `${fixture.name} pagination retains lower-ranked direct results before fallback results`);
    const fallbackPage = await search(3, "newest", ["rank-1000", "rank-901", "rank-950", "rank-1100"]);
    assert.deepEqual(Array.from(fallbackPage.candidates, (candidate) => candidate.videoId), ["rank-0", "rank-1"], `${fixture.name} reaches fallback results after all direct IDs are excluded`);
    const oldest = await search(4, "oldest");
    assert.deepEqual(Array.from(oldest.candidates, (candidate) => candidate.videoId), ["rank-1100", "rank-901"], `${fixture.name} preserves oldest-first ordering and original-position ties`);
  }
});

test("YouTube workers reuse bounded completed search sessions for later pages", async () => {
  const directIds = new Set([4, 500, 610, 900]);
  const makeVideos = () => Array.from({ length: 1300 }, (_, index) => {
    const direct = directIds.has(index);
    // Fallbacks intentionally sort ahead of direct results in the combined
    // ranker. The worker must still retain the best direct group independently.
    const year = index === 4 || index === 500 ? 2025 : index === 610 || index === 900 ? 2024 : 2030;
    return {
      id: `session-${index}`, channelId: "channel-session", channelName: "Session Test", title: `Session ranking ${index}`,
      description: "Pagination test description.", tags: direct ? ["title"] : ["semantic-fallback"], topics: ["Science"],
      publishedAt: `${year}-01-01T00:00:00.000Z`, durationSeconds: direct ? 100 : index % 10, approved: true
    };
  });
  const createSearchOverride = () => {
    let calls = 0;
    return {
      get calls() { return calls; },
      wrap: _original => (videos, prepared, limit, excludedIds) => {
        calls++;
        const matches = videos.filter(video => !excludedIds.has(video.id)).map(video => ({
          video,
          coverage: { matchedConcepts: [0], missingConcepts: [], complete: true },
          score: video.durationSeconds,
          matchedFields: video.tags,
          supportingText: [video.title]
        }));
        const compare = (left, right) => (prepared.sort === "newest" ? right.video.publishedAt.localeCompare(left.video.publishedAt) : prepared.sort === "oldest" ? left.video.publishedAt.localeCompare(right.video.publishedAt) : 0) || right.score - left.score;
        return matches.sort(compare).slice(0, limit);
      }
    };
  };
  const fixtures = [
    { name: "website", load: counter => loadWorker("workers/youtube-search.worker.ts", { searchOverride: original => counter.wrap(original) }), send: (worker, data) => worker.scope.onmessage({ data }), messages: worker => worker.messages },
    { name: "native", load: counter => loadNativeYouTubeWorker({ searchOverride: original => counter.wrap(original) }), send: (worker, data) => worker.send(data), messages: worker => worker.messages }
  ];
  const videos = projectVideos(makeVideos());
  const plan = { terms: ["session ranking"], sort: "newest" };
  const request = (requestId, excludedIds = [], viewKey = "account-a/workspace-a", revision = 0, requestPlan = plan, topic = "All", channelId = "channel-session") => ({
    type: "search", requestId, revision, query: "session ranking", plan: requestPlan, topic, channelId, limit: 2, excludedIds, viewKey
  });
  const plain = value => JSON.parse(JSON.stringify(value));

  for (const fixture of fixtures) {
    const counter = createSearchOverride(), worker = fixture.load(counter), messages = fixture.messages(worker);
    fixture.send(worker, { type: "initialize", revision: 0, videos });
    fixture.send(worker, request(1));
    const firstPage = await waitForMessage(messages, message => message.requestId === 1 && message.candidates);
    assert.deepEqual(Array.from(firstPage.candidates, item => item.videoId), ["session-4", "session-500"], `${fixture.name} preserves date and original-position tie ordering`);
    const initialSession = worker.scope?.inspectSearchSessions?.() ?? worker.context.inspectSearchSessions();
    assert.equal(initialSession.size, 1, `${fixture.name} keeps one completed query session`);
    assert.ok(initialSession.bytes > 0 && initialSession.bytes <= 4 * 1024 * 1024, `${fixture.name} bounds cached result metadata by bytes`);
    const cachedSession = initialSession.items[0];
    assert.equal(cachedSession.directCursor, 2, `${fixture.name} records the next direct-result cursor after the first page`);
    assert.equal(cachedSession.fallbackCursor, 0, `${fixture.name} does not advance fallback results before direct results are exhausted`);
    let safeScanCount = 0;
    const originalDirectFilter = cachedSession.direct.filter;
    cachedSession.direct.filter = function (...args) { safeScanCount++; return originalDirectFilter.apply(this, args); };
    const scansAfterFirstPage = counter.calls;

    fixture.send(worker, request(2, firstPage.candidates.map(item => item.videoId)));
    const cachedPage = await waitForMessage(messages, message => message.requestId === 2 && message.candidates);
    assert.equal(counter.calls, scansAfterFirstPage, `${fixture.name} serves a complete cached page without ranking chunks again`);
    assert.equal(safeScanCount, 0, `${fixture.name} advances the cursor without filtering the direct list from its beginning`);
    assert.equal(cachedSession.directCursor, 4, `${fixture.name} advances its direct cursor with the returned page`);
    assert.deepEqual(Array.from(cachedPage.candidates, item => item.videoId), ["session-610", "session-900"], `${fixture.name} advances within the direct-results group before fallbacks`);
    assert.equal((worker.scope?.inspectSearchSessions?.() ?? worker.context.inspectSearchSessions()).size, 1, `${fixture.name} reuses rather than duplicates the query session`);

    fixture.send(worker, request(9, ["session-4"]));
    const outOfOrderPage = await waitForMessage(messages, message => message.requestId === 9 && message.candidates);
    assert.equal(safeScanCount, 1, `${fixture.name} falls back to the safe scan when exclusions do not match pagination history`);
    assert.deepEqual(Array.from(outOfOrderPage.candidates, item => item.videoId), ["session-500", "session-610"], `${fixture.name} safe scan preserves results for unexpected exclusions`);
    assert.equal(cachedSession.directCursor, 3, `${fixture.name} rebases the cursor to the sequential prefix after a safe scan`);
    fixture.send(worker, request(10, ["session-4", "session-500", "session-610"]));
    const resumedPage = await waitForMessage(messages, message => message.requestId === 10 && message.candidates);
    assert.equal(safeScanCount, 1, `${fixture.name} resumes cursor pagination after the safe-scan page`);
    assert.deepEqual(Array.from(resumedPage.candidates, item => item.videoId), ["session-900"], `${fixture.name} resumes from the next unconsumed direct candidate`);

    const referenceCounter = createSearchOverride(), reference = fixture.load(referenceCounter), referenceMessages = fixture.messages(reference);
    fixture.send(reference, { type: "initialize", revision: 0, videos });
    fixture.send(reference, request(3, firstPage.candidates.map(item => item.videoId)));
    const freshPage = await waitForMessage(referenceMessages, message => message.requestId === 3 && message.candidates);
    assert.deepEqual(plain(cachedPage.candidates), plain(freshPage.candidates), `${fixture.name} cached page matches a fresh ranking, including scores and supporting fields`);

    const directIdsForExclusion = Array.from(directIds, id => `session-${id}`);
    fixture.send(worker, request(7, directIdsForExclusion));
    const cachedFallbackPage = await waitForMessage(messages, message => message.requestId === 7 && message.candidates);
    assert.equal(counter.calls, scansAfterFirstPage, `${fixture.name} advances to the fallback group without rescanning`);
    assert.equal(cachedSession.fallbackCursor, 2, `${fixture.name} advances the separate fallback cursor after direct results are exhausted`);
    const fallbackReference = fixture.load(createSearchOverride()), fallbackMessages = fixture.messages(fallbackReference);
    fixture.send(fallbackReference, { type: "initialize", revision: 0, videos });
    fixture.send(fallbackReference, request(8, directIdsForExclusion));
    const freshFallbackPage = await waitForMessage(fallbackMessages, message => message.requestId === 8 && message.candidates);
    assert.deepEqual(plain(cachedFallbackPage.candidates), plain(freshFallbackPage.candidates), `${fixture.name} fallback page matches fresh ranking after direct exhaustion`);

    const afterCachedPage = counter.calls;
    fixture.send(worker, request(4, firstPage.candidates.map(item => item.videoId), "account-a/workspace-a", 0, { ...plan, minDurationSeconds: 1 }));
    await waitForMessage(messages, message => message.requestId === 4 && message.candidates);
    assert.ok(counter.calls > afterCachedPage, `${fixture.name} keys sessions by the complete filter plan`);

    const afterPlanChange = counter.calls;
    fixture.send(worker, request(5, firstPage.candidates.map(item => item.videoId), "account-b/workspace-a"));
    await waitForMessage(messages, message => message.requestId === 5 && message.candidates);
    assert.ok(counter.calls > afterPlanChange, `${fixture.name} does not reuse a result session across workspace/account scopes`);

    fixture.send(worker, { type: "update", baseRevision: 0, revision: 1, upserts: [], removeIds: ["session-4"] });
    assert.equal((worker.scope?.inspectSearchSessions?.() ?? worker.context.inspectSearchSessions()).size, 0, `${fixture.name} clears old sessions when the catalog revision changes`);
    const scansBeforeNewRevision = counter.calls;
    fixture.send(worker, request(6, [], "account-a/workspace-a", 1));
    await waitForMessage(messages, message => message.requestId === 6 && message.candidates);
    assert.ok(counter.calls > scansBeforeNewRevision, `${fixture.name} ranks the updated catalog instead of using the old session`);
  }
});

test("topic worker reuses normalized searches while returning the current query and request ID", async () => {
  const { scope, messages } = loadWorker("workers/topic-search.worker.ts");
  scope.onmessage({ data: { type: "initialize", customTopics: [], catalogRevision: 4 } });
  assert.equal(messages[0].type, "ready");
  scope.onmessage({ data: { type: "search", requestId: 1, query: "history", semanticTerms: [], catalogRevision: 4 } });
  const first = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 1);
  assert.ok(first.visibleIds.length > 0);
  scope.onmessage({ data: { type: "search", requestId: 2, query: "HISTORY", semanticTerms: [], catalogRevision: 4 } });
  const cached = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 2);
  assert.equal(cached.query, "HISTORY");
  assert.deepEqual(cached.visibleIds, first.visibleIds);
  assert.deepEqual(cached.suggestions, first.suggestions);
});

test("card workers cache normalized document tokens and reuse one query token list per search", async () => {
  const { rankSearchResults, normalizeSearchText } = require("../lib/search.ts");
  const sourceDocuments = [
    { id: "repeated", text: "astronomy astronomy; galaxies galaxies" },
    { id: "punctuation", text: "Astronomy, distant galaxies — observed." },
    { id: "reversed", text: "Galaxies and astronomy" },
    { id: "unrelated", text: "Ancient biology and geology" }
  ];
  let queryTokenizations = 0;
  const scoreCalls = [];
  const searchModuleOverride = (search) => ({
    ...search,
    tokenizeSearchQuery(query) {
      queryTokenizations += 1;
      return search.tokenizeSearchQuery(query);
    },
    searchScoreNormalized(query, text, queryTokens, textTokens) {
      scoreCalls.push({ queryTokens, textTokens });
      return search.searchScoreNormalized(query, text, queryTokens, textTokens);
    }
  });
  const fixtures = [
    { name: "website", load: () => loadWorker("workers/card-search.worker.ts", { searchModuleOverride }), send: (worker, data) => worker.scope.onmessage({ data }), messages: (worker) => worker.messages, documents: (worker) => worker.scope.inspectCardDocuments() },
    { name: "Mac", load: loadNativeCardWorker, send: (worker, data) => worker.send(data), messages: (worker) => worker.messages, documents: (worker) => worker.documents() }
  ];

  for (const fixture of fixtures) {
    const worker = fixture.load();
    fixture.send(worker, { type: "initialize", revision: 0, documents: sourceDocuments });
    const indexed = fixture.documents(worker);
    const indexedSnapshot = JSON.parse(JSON.stringify(Object.fromEntries(indexed.entries())));
    for (const item of sourceDocuments) {
      assert.deepEqual(indexedSnapshot[item.id], {
        normalizedText: normalizeSearchText(item.text),
        tokens: normalizeSearchText(item.text).split(" ").filter(Boolean)
      }, `${fixture.name} stores normalized text and matching document tokens together`);
    }
    const unchangedTokens = indexed.get("repeated").tokens;
    const eligibility = ["repeated", "punctuation", "reversed", "unrelated"];
    fixture.send(worker, { type: "register-eligibility", revision: 0, eligibilityScope: `${fixture.name}/feed`, eligibilityRevision: 1, ids: eligibility });
    fixture.send(worker, { type: "search", requestId: 31, revision: 0, query: "astronomy galaxies", eligibilityScope: `${fixture.name}/feed`, eligibilityRevision: 1, viewKey: "initial" });
    const first = await waitForMessage(fixture.messages(worker), (message) => message.type === "results" && message.requestId === 31);
    assert.deepEqual(Array.from(first.ids), rankSearchResults("astronomy galaxies", sourceDocuments, (item) => item.text).map((item) => item.id), `${fixture.name} preserves punctuation, repetition, and input-order ties`);
    assert.equal(indexed.get("repeated").tokens, unchangedTokens, `${fixture.name} retains prepared tokens until a document changes`);

    if (fixture.name === "website") {
      assert.equal(queryTokenizations, 1, "the website worker tokenizes the query once for the whole search");
      assert.equal(scoreCalls.length, sourceDocuments.length, "every eligible document is scored with the prepared tokens");
      assert.ok(scoreCalls.every((call) => call.queryTokens === scoreCalls[0].queryTokens), "all document scores share one query token array");
      assert.ok(scoreCalls.every((call) => Array.isArray(call.textTokens)), "each score receives the document's indexed token array");
    }

    fixture.send(worker, { type: "update", revision: 1, upserts: [{ id: "replacement", text: "  MANTLE, geology and minerals! " }], removeIds: ["reversed"] });
    const updatedIndex = fixture.documents(worker);
    assert.equal(updatedIndex.has("reversed"), false, `${fixture.name} removes deleted documents and their tokens`);
    assert.deepEqual(JSON.parse(JSON.stringify(updatedIndex.get("replacement"))), {
      normalizedText: "mantle geology and minerals",
      tokens: ["mantle", "geology", "and", "minerals"]
    }, `${fixture.name} prepares tokens for changed documents when they are upserted`);
    assert.equal(updatedIndex.get("repeated").tokens, unchangedTokens, `${fixture.name} does not rebuild unchanged token arrays`);

    const nextEligibility = ["replacement", "repeated", "punctuation", "unrelated"];
    fixture.send(worker, { type: "register-eligibility", revision: 1, eligibilityScope: `${fixture.name}/feed`, eligibilityRevision: 2, ids: nextEligibility });
    fixture.send(worker, { type: "search", requestId: 32, revision: 1, query: "mantle geology", eligibilityScope: `${fixture.name}/feed`, eligibilityRevision: 2, viewKey: "updated" });
    const updated = await waitForMessage(fixture.messages(worker), (message) => message.type === "results" && message.requestId === 32);
    const updatedDocuments = sourceDocuments.filter((item) => item.id !== "reversed").concat({ id: "replacement", text: "  MANTLE, geology and minerals! " });
    const orderedUpdatedDocuments = nextEligibility.map((id) => updatedDocuments.find((item) => item.id === id)).filter(Boolean);
    assert.deepEqual(Array.from(updated.ids), rankSearchResults("mantle geology", orderedUpdatedDocuments, (item) => item.text).map((item) => item.id), `${fixture.name} searches updated documents with the same score and tie rules`);
  }
  assert.equal(queryTokenizations, 2, "each distinct website search prepares query tokens once");
});

test("website and native card workers keep rank order, reuse scoped eligibility revisions, and cancel obsolete searches", async () => {
  const { rankSearchResults } = require("../lib/search.ts");
  const documents = Array.from({ length: 1600 }, (_, index) => ({
    id: `card-${index}`,
    text: index % 3 === 0 ? `Ancient astronomy and history fact ${index}` : `Modern science story ${index}`
  }));
  const fixtures = [
    { name: "website", load: () => loadWorker("workers/card-search.worker.ts"), send: (worker, data) => worker.scope.onmessage({ data }), messages: (worker) => worker.messages },
    { name: "native", load: loadNativeCardWorker, send: (worker, data) => worker.send(data), messages: (worker) => worker.messages }
  ];
  for (const fixture of fixtures) {
    const worker = fixture.load(), messages = fixture.messages(worker);
    fixture.send(worker, { type: "initialize", revision: 0, documents });
    const feedIds = documents.map((item) => item.id), savedIds = documents.filter((_, index) => index % 2 === 0).map((item) => item.id);
    fixture.send(worker, { type: "register-eligibility", revision: 0, eligibilityScope: "account-a/workspace-a/feed", eligibilityRevision: 1, ids: feedIds });
    fixture.send(worker, { type: "search", requestId: 10, revision: 0, query: "ancient astronomy", eligibilityScope: "account-a/workspace-a/feed", eligibilityRevision: 1, viewKey: "feed" });
    fixture.send(worker, { type: "register-eligibility", revision: 0, eligibilityScope: "account-a/workspace-a/saved", eligibilityRevision: 2, ids: savedIds });
    fixture.send(worker, { type: "search", requestId: 11, revision: 0, query: "modern science", eligibilityScope: "account-a/workspace-a/saved", eligibilityRevision: 2, viewKey: "saved" });
    const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 11);
    assert.equal(reply.viewKey, "saved", fixture.name);
    assert.equal(reply.eligibilityScope, "account-a/workspace-a/saved", fixture.name);
    assert.equal(reply.eligibilityRevision, 2, fixture.name);
    assert.ok(reply.ids.length > 0, fixture.name);
    assert.ok(reply.ids.every((id) => Number(id.slice(5)) % 2 === 0), fixture.name);
    const eligible = documents.filter((_, index) => index % 2 === 0);
    assert.deepEqual(Array.from(reply.ids), rankSearchResults("modern science", eligible, (item) => item.text).map((item) => item.id), fixture.name);
    assert.equal(messages.some((message) => message.type === "results" && message.requestId === 10), false, `${fixture.name} abandons an obsolete eligibility scope`);

    fixture.send(worker, { type: "search", requestId: 12, revision: 0, query: "MODERN science", eligibilityScope: "account-a/workspace-a/saved", eligibilityRevision: 2, viewKey: "saved" });
    const cached = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 12);
    assert.equal(cached.query, "MODERN science", `${fixture.name} returns the current casing for a normalized cached query`);
    assert.deepEqual(Array.from(cached.ids), Array.from(reply.ids), `${fixture.name} reuses the registered list for another query`);

    const reorderedIds = [...savedIds].reverse();
    fixture.send(worker, { type: "register-eligibility", revision: 0, eligibilityScope: "account-a/workspace-a/saved", eligibilityRevision: 3, ids: reorderedIds });
    fixture.send(worker, { type: "search", requestId: 13, revision: 0, query: "modern science", eligibilityScope: "account-a/workspace-a/saved", eligibilityRevision: 3, viewKey: "saved" });
    const reordered = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 13);
    assert.deepEqual(Array.from(reordered.ids), rankSearchResults("modern science", [...eligible].reverse(), (item) => item.text).map((item) => item.id), `${fixture.name} membership order gets its own revision and remains the score tie-breaker`);

    fixture.send(worker, { type: "search", requestId: 14, revision: 0, query: "modern science", eligibilityScope: "account-b/workspace-a/saved", eligibilityRevision: 3, viewKey: "saved" });
    const stale = await waitForMessage(messages, (message) => message.type === "eligibility-stale" && message.requestId === 14);
    assert.equal(stale.eligibilityScope, "account-b/workspace-a/saved", `${fixture.name} cannot reuse another account's registered IDs`);
  }
});

test("YouTube worker preserves catalog ranking and strict filters across chunks", async () => {
  const { searchYouTubeCandidates } = require("../lib/youtube.ts");
  const { scope, messages } = loadWorker("workers/youtube-search.worker.ts");
  const videos = Array.from({ length: 1450 }, (_, index) => ({
    id: `video-${index}`,
    channelId: index % 2 ? "channel-a" : "channel-b",
    channelName: "Approved Channel",
    title: index % 5 === 0 ? `Human population history ${index}` : `Modern science study ${index}`,
    description: "A long-form approved documentary.",
    tags: [index % 5 === 0 ? "population" : "science"],
    publishedAt: `202${index % 5}-01-01T00:00:00.000Z`,
    durationSeconds: 600 + index % 100,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["History", "Science"],
    approved: true
  }));
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  const plan = { terms: ["human population"], channelId: "channel-a", minDate: "2021-01-01", minDurationSeconds: 620, exclude: ["shark"] };
  scope.onmessage({ data: { type: "search", requestId: 21, revision: 0, query: "human population", plan, topic: "History", channelId: "channel-a", limit: 80 } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 21);
  const expected = searchYouTubeCandidates(videos, plan, "History", "channel-a", 80).map((candidate) => candidate.video.id);
  assert.deepEqual(reply.candidates.map((candidate) => candidate.videoId), expected);
  assert.ok(reply.candidates.every((candidate) => videos.find((video) => video.id === candidate.videoId)?.channelId === "channel-a"));
  assert.ok(reply.candidates.every((candidate) => Number(candidate.videoId.slice(6)) % 5 === 0));
});

test("channel indexes stay position-correct through incremental changes on website and Mac", async () => {
  const { searchYouTubeCandidates } = require("../lib/youtube.ts");
  const makeVideo = (id, channelId, overrides = {}) => ({
    id, channelId, channelName: channelId, title: "Ancient star formation study",
    description: "A documented study of ancient star formation.", tags: ["astronomy"],
    topics: ["Science"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600,
    approved: true, ...overrides
  });
  const original = [
    makeVideo("A", "channel-a"),
    makeVideo("B", "channel-b"),
    makeVideo("unapproved", "channel-a", { approved: false }),
    makeVideo("shorts", "channel-a", { title: "#Shorts ancient star formation" }),
    makeVideo("other-channel", "channel-c"),
    makeVideo("F", "channel-a")
  ];
  const fixtures = [
    { name: "website", load: options => loadWorker("workers/youtube-search.worker.ts", options), send: (worker, data) => worker.scope.onmessage({ data }), inspect: worker => worker.scope.inspectCatalog(), messages: worker => worker.messages },
    { name: "Mac", load: options => loadNativeYouTubeWorker(options), send: (worker, data) => worker.send(data), inspect: worker => worker.context.inspectCatalog(), messages: worker => worker.messages }
  ];
  const plan = { terms: ["ancient star formation"] };
  for (const fixture of fixtures) {
    const rankedIds = [];
    const worker = fixture.load({ searchOverride: originalRank => (videos, ...args) => {
      rankedIds.push(...videos.map(video => video.id));
      return originalRank(videos, ...args);
    } });
    fixture.send(worker, { type: "initialize", revision: 0, videos: projectVideos(original) });
    const originalSnapshot = fixture.inspect(worker);
    const originalAEntries = originalSnapshot.channelPositions.get("channel-a");
    const originalCEntries = originalSnapshot.channelPositions.get("channel-c");

    const search = async (revision, requestId, channelId = "channel-a", excludedIds = [], searchPlan = plan) => {
      fixture.send(worker, { type: "search", requestId, revision, query: "ancient star formation", plan: searchPlan, topic: "All", channelId, excludedIds, limit: 20, viewKey: `${fixture.name}-channel-${revision}-${requestId}` });
      return waitForMessage(fixture.messages(worker), message => message.requestId === requestId && Array.isArray(message.candidates));
    };
    const expectCurrent = async (videos, revision, requestId, channelId = "channel-a", excludedIds = [], searchPlan = plan) => {
      const reply = await search(revision, requestId, channelId, excludedIds, searchPlan);
      const expected = searchYouTubeCandidates(videos, searchPlan, "All", channelId, 20, excludedIds);
      const summarize = candidate => ({
        videoId: candidate.videoId ?? candidate.video.id,
        score: candidate.score,
        matchedFields: Array.from(candidate.matchedFields),
        supportingText: Array.from(candidate.supportingText),
        ...(fixture.name === "website" && candidate.coverage ? { coverage: {
          matchedConcepts: Array.from(candidate.coverage.matchedConcepts),
          missingConcepts: Array.from(candidate.coverage.missingConcepts),
          complete: candidate.coverage.complete
        } } : {})
      });
      assert.deepEqual(Array.from(reply.candidates, summarize), expected.map(summarize), `${fixture.name} preserves scores, explanations, coverage, and channel-filtered ordering`);
      assert.ok(reply.candidates.every(candidate => videos.find(video => video.id === candidate.videoId)?.approved), `${fixture.name} keeps approval checks strict`);
      assert.ok(reply.candidates.every(candidate => !/#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(videos.find(video => video.id === candidate.videoId)?.title ?? "")), `${fixture.name} keeps Shorts exclusions strict`);
      return reply;
    };

    const initial = await expectCurrent(original, 0, 201);
    assert.deepEqual(Array.from(initial.candidates, candidate => candidate.videoId), ["A", "F"]);
    assert.deepEqual(rankedIds, original.filter(video => video.channelId === "channel-a").map(video => video.id), `${fixture.name} ranks only indexed channel candidates`);
    const nextPage = await expectCurrent(original, 0, 202, "channel-a", ["A"]);
    assert.deepEqual(Array.from(nextPage.candidates, candidate => candidate.videoId), ["F"], `${fixture.name} channel pagination preserves the next catalog-position tie`);

    const movedB = { ...original[1], channelId: "channel-a" };
    fixture.send(worker, { type: "update", baseRevision: 0, revision: 1, upserts: projectVideos([movedB]), removeIds: [] });
    const afterMove = fixture.inspect(worker);
    assert.notStrictEqual(afterMove.channelPositions, originalSnapshot.channelPositions, `${fixture.name} publishes an independent position map`);
    assert.deepEqual(originalSnapshot.channelPositions.get("channel-a"), originalAEntries, `${fixture.name} leaves the captured channel list unchanged`);
    assert.strictEqual(afterMove.channelPositions.get("channel-c"), originalCEntries, `${fixture.name} reuses unaffected channel lists`);
    let current = original.map(video => video.id === "B" ? movedB : video);
    assert.deepEqual(Array.from((await expectCurrent(current, 1, 203)).candidates, candidate => candidate.videoId), ["A", "B", "F"], `${fixture.name} preserves the moved record's original tie position`);

    fixture.send(worker, { type: "update", baseRevision: 1, revision: 2, upserts: [], removeIds: ["A"] });
    current = current.filter(video => video.id !== "A");
    assert.deepEqual(Array.from((await expectCurrent(current, 2, 204)).candidates, candidate => candidate.videoId), ["B", "F"], `${fixture.name} removes the deleted ID from channel positions`);

    fixture.send(worker, { type: "update", baseRevision: 2, revision: 3, upserts: [], removeIds: [], orderIds: ["F", "B", "shorts", "other-channel"] });
    current = ["F", "B", "shorts", "other-channel"].map(id => current.find(video => video.id === id));
    assert.deepEqual(Array.from((await expectCurrent(current, 3, 205)).candidates, candidate => candidate.videoId), ["F", "B"], `${fixture.name} rebuilds channel positions after explicit reorder`);
    assert.deepEqual(Array.from((await expectCurrent(current, 3, 206, undefined, [], { ...plan, channelId: "channel-a" })).candidates, candidate => candidate.videoId), ["F", "B"], `${fixture.name} also indexes the plan's strict channel ID`);
  }
});

test("YouTube workers precompute restricted playlist eligibility and refresh it on provenance changes", async () => {
  const { searchYouTubeCandidates } = require("../lib/youtube.ts");
  const restrictedId = "UCYO_jab_esuFRV4b17AJtAw";
  const makeVideo = (id, overrides = {}) => ({
    id, channelId: restrictedId, channelName: "3Blue1Brown", title: "Gravitational lensing",
    description: "A long-form astronomy lesson.", tags: ["astronomy"], topics: ["Science"],
    publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600, approved: true, ...overrides
  });
  const original = [
    makeVideo("allowed-one", { sourceIds: ["playlist:PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi"] }),
    makeVideo("allowed-two", { channelId: "legacy-channel-id", channelName: "3BLUE1BROWN", sourceIds: ["PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"] }),
    makeVideo("special", { special: true }),
    makeVideo("wrong-source", { sourceIds: ["playlist:unapproved"] }),
    makeVideo("wrong-name-source", { channelId: "legacy-channel-id", sourceIds: ["playlist:unapproved"] }),
    makeVideo("ordinary-channel", { channelId: "other-channel", channelName: "3Blue1Brownish", sourceIds: ["playlist:unapproved"] })
  ];
  const plan = { terms: ["gravitational lensing"] };
  const fixtures = [
    { name: "website", load: () => loadWorker("workers/youtube-search.worker.ts"), init: (worker, data) => worker.scope.onmessage({ data }), send: (worker, data) => worker.scope.onmessage({ data }), messages: worker => worker.messages },
    { name: "native", load: () => loadNativeYouTubeWorker(), init: (worker, data) => worker.send(data), send: (worker, data) => worker.send(data), messages: worker => worker.messages }
  ];
  for (const fixture of fixtures) {
    const worker = fixture.load(), messages = fixture.messages(worker), projected = projectVideos(original);
    let channelNameReads = 0, playlistScans = 0;
    const observed = projected.find(video => video.id === "allowed-one");
    Object.defineProperty(observed, "channelName", { enumerable: true, configurable: true, get() { channelNameReads++; return "3Blue1Brown"; } });
    Object.defineProperty(observed, "sourceIds", { enumerable: true, configurable: true, value: new Proxy(observed.sourceIds, { get(target, key, receiver) { if (key === "some") playlistScans++; return Reflect.get(target, key, receiver); } }) });
    fixture.init(worker, { type: "initialize", revision: 0, videos: projected });
    channelNameReads = 0;
    playlistScans = 0;
    const search = async (revision, requestId) => {
      fixture.send(worker, { type: "search", requestId, revision, query: "gravitational lensing", plan, topic: "All", limit: 20 });
      return waitForMessage(messages, message => message.requestId === requestId);
    };
    const first = await search(0, 91);
    const expectedFirst = searchYouTubeCandidates(original, plan, "All").map(candidate => candidate.video.id);
    assert.deepEqual(Array.from(first.candidates, candidate => candidate.videoId), expectedFirst, `${fixture.name} preserves exact playlist filtering`);
    assert.equal(channelNameReads, 0, `${fixture.name} repeated ranking reads no channel name for playlist eligibility`);
    assert.equal(playlistScans, 0, `${fixture.name} repeated ranking does not rescan sourceIds`);

    const unchanged = { ...projected[0], sourceIds: new Proxy([...projected[0].sourceIds], { get(target, key, receiver) { if (key === "some") playlistScans++; return Reflect.get(target, key, receiver); } }) };
    Object.defineProperty(unchanged, "channelName", { enumerable: true, configurable: true, get() { channelNameReads++; return "3Blue1Brown"; } });
    channelNameReads = 0;
    playlistScans = 0;
    fixture.send(worker, { type: "update", baseRevision: 0, revision: 1, upserts: [unchanged], removeIds: [] });
    assert.equal(playlistScans, 1, `${fixture.name} compares the stored sourceIds once without running the eligibility scan again`);
    assert.equal(channelNameReads, 2, `${fixture.name} validates and compares the unchanged channel name without normalizing it again`);
    const afterNoOp = await search(1, 92);
    assert.deepEqual(Array.from(afterNoOp.candidates, candidate => candidate.videoId), expectedFirst, `${fixture.name} retains the prepared result when an identical record is updated`);

    const revised = original.map(video => video.id === "allowed-one" ? { ...video, sourceIds: ["playlist:unapproved"] }
      : video.id === "wrong-source" ? { ...video, sourceIds: ["playlist:PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"] }
      : video.id === "wrong-name-source" ? { ...video, channelName: "Other Channel" }
      : video.id === "special" ? { ...video, special: false, sourceIds: ["playlist:unapproved"] }
      : video);
    fixture.send(worker, { type: "update", baseRevision: 1, revision: 2, upserts: projectVideos(revised.filter(video => ["allowed-one", "wrong-source", "wrong-name-source", "special"].includes(video.id))), removeIds: [] });
    const updated = await search(2, 93);
    const expectedUpdated = searchYouTubeCandidates(revised, plan, "All").map(candidate => candidate.video.id);
    assert.deepEqual(Array.from(updated.candidates, candidate => candidate.videoId), expectedUpdated, `${fixture.name} recalculates flags when source provenance or channel identity changes`);
  }
});

test("YouTube worker cancels a previous query while scanning large catalogs", async () => {
  const { scope, messages } = loadWorker("workers/youtube-search.worker.ts");
  const videos = Array.from({ length: 1800 }, (_, index) => ({
    id: `video-${index}`,
    channelId: "channel-a",
    channelName: "Approved Channel",
    title: index % 2 ? `History of science ${index}` : `Modern physics ${index}`,
    description: "A long-form approved documentary.",
    tags: [index % 2 ? "history" : "physics"],
    publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["History", "Science"],
    approved: true
  }));
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  const base = { type: "search", revision: 0, topic: "All", channelId: undefined, limit: 80 };
  scope.onmessage({ data: { ...base, requestId: 31, query: "history science", plan: { terms: ["history science"] } } });
  scope.onmessage({ data: { ...base, requestId: 32, query: "modern physics", plan: { terms: ["modern physics"] } } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 32);
  assert.ok(reply.candidates.length > 0);
  assert.ok(reply.candidates.every((candidate) => candidate.matchedFields.includes("title")));
  assert.equal(messages.some((message) => message.type === "results" && message.requestId === 31), false);
});

test("YouTube worker settles a search when the catalog changes mid-scan", async () => {
  const worker = loadWorker("workers/youtube-search.worker.ts");
  const { scope, messages } = worker;
  const videos = Array.from({ length: 1800 }, (_, index) => ({
    id: `video-${index}`,
    channelId: "channel-a",
    channelName: "Approved Channel",
    title: `History of science ${index}`,
    description: "A long-form approved documentary.",
    tags: ["history"],
    publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["History", "Science"],
    approved: true
  }));
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  scope.onmessage({ data: { type: "search", requestId: 35, revision: 0, query: "history science", plan: { terms: ["history science"] }, topic: "All", limit: 80 } });
  scope.onmessage({ data: { type: "update", baseRevision: 0, revision: 1, upserts: [], removeIds: [] } });
  const stale = await waitForMessage(messages, (message) => message.type === "stale" && message.requestId === 35);
  assert.equal(stale.revision, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(messages.some((message) => message.type === "results" && message.requestId === 35), false);
});

test("catalog replacement releases old result and plan caches without publishing an in-flight stale search", async () => {
  const makeVideos = revision => Array.from({ length: 1800 }, (_, index) => ({
    id: `cache-revision-${index}`, channelId: "channel-a", channelName: "Approved Channel",
    title: revision && index === 0 ? "Updated history of science" : `History of science ${index}`,
    description: "A long-form approved documentary.", tags: ["history", "science"],
    publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600, topics: ["History", "Science"], approved: true
  }));
  const fixtures = [
    { name: "website", load: () => loadWorker("workers/youtube-search.worker.ts"), send: (worker, data) => worker.scope.onmessage({ data }), messages: worker => worker.messages, caches: worker => worker.scope.inspectSearchCaches() },
    { name: "native", load: () => loadNativeYouTubeWorker(), send: (worker, data) => worker.send(data), messages: worker => worker.messages, caches: worker => worker.context.inspectSearchCaches() }
  ];
  for (const fixture of fixtures) {
    const worker = fixture.load(), messages = fixture.messages(worker), videos = makeVideos(0);
    fixture.send(worker, { type: "initialize", revision: 0, videos: projectVideos(videos) });
    const search = (requestId, revision, plan) => fixture.send(worker, {
      type: "search", requestId, revision, query: plan.terms[0], plan, topic: "All", limit: 80, viewKey: "same-workspace"
    });
    search(70, 0, { terms: ["history"] });
    await waitForMessage(messages, message => message.requestId === 70 && message.candidates);
    const warmed = fixture.caches(worker);
    assert.ok(warmed.sessions > 0 && warmed.prepared > 0, `${fixture.name} populated the session and prepared-plan caches`);
    if (fixture.name === "website") assert.ok(warmed.results > 0, "website populated its exact-page result cache");

    search(71, 0, { terms: ["science"] });
    fixture.send(worker, { type: "update", baseRevision: 0, revision: 1, upserts: [projectVideos([makeVideos(1)[0]])[0]], removeIds: [] });
    if (fixture.name === "website") await waitForMessage(messages, message => message.type === "stale" && message.requestId === 71);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.caches(worker))), { results: 0, sessions: 0, prepared: 0 }, `${fixture.name} releases all revision-0 derived cache entries when revision 1 becomes active`);
    assert.equal(messages.some(message => message.type === "results" && message.requestId === 71), false, `${fixture.name} does not publish the in-flight revision-0 result`);

    search(72, 1, { terms: ["history"] });
    const current = await waitForMessage(messages, message => message.requestId === 72 && message.candidates);
    assert.equal(current.revision, 1, `${fixture.name} can immediately search the new snapshot`);
    assert.ok(fixture.caches(worker).prepared > 0, `${fixture.name} prepares only the active revision after replacement`);
  }
});

test("YouTube worker settles obsolete searches and requests a rebuild on revision mismatch", async () => {
  const { scope, messages } = loadWorker("workers/youtube-search.worker.ts");
  const videos = Array.from({ length: 1800 }, (_, index) => ({
    id: `revision-video-${index}`,
    channelId: "channel-a",
    channelName: "Approved Channel",
    title: `History of science ${index}`,
    description: "A long-form approved documentary.",
    tags: ["history"],
    publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["History"],
    approved: true
  }));
  scope.onmessage({ data: { type: "initialize", revision: 4, videos: projectVideos(videos) } });
  scope.onmessage({ data: { type: "search", requestId: 51, revision: 4, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 80 } });
  scope.onmessage({ data: { type: "update", baseRevision: 2, revision: 5, upserts: [], removeIds: [] } });

  const stale = await waitForMessage(messages, message => message.type === "stale" && message.requestId === 51);
  const rebuild = await waitForMessage(messages, message => message.type === "rebuild" && message.revision === 5);
  assert.equal(stale.revision, 5);
  assert.equal(rebuild.revision, 5);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(messages.some(message => message.type === "results" && message.requestId === 51), false);
});

test("YouTube worker yields while ranking 30,000 videos and preserves the top results", async () => {
  const { searchYouTubeCandidates } = require("../lib/youtube.ts");
  const worker = loadWorker("workers/youtube-search.worker.ts", { observeMaps: true });
  const { scope, messages } = worker;
  const videos = Array.from({ length: 30_000 }, (_, index) => ({
    id: `large-video-${index}`,
    channelId: `channel-${index % 12}`,
    channelName: `Approved Channel ${index % 12}`,
    title: index % 2 ? `Modern physics documentary ${index}` : `Ancient biology documentary ${index}`,
    description: "A long-form approved documentary.",
    tags: [index % 2 ? "physics" : "biology"],
    publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["Science"],
    approved: true
  }));
  const plan = { terms: ["modern physics"] };
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  const catalogMap = scope.inspectCatalog().videos;
  assert.equal(catalogMap.valuesCallCount, 1, "initialization creates the retained ordered snapshot once");
  scope.onmessage({ data: { type: "search", requestId: 41, revision: 0, query: "modern physics", plan, topic: "All", limit: 80, viewKey: "large-catalog" } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 41, 20_000);
  const expectedCandidates = searchYouTubeCandidates(videos, plan, "All", undefined, 80).map((candidate) => ({
    coverage: candidate.coverage,
    videoId: candidate.video.id,
    score: candidate.score,
    matchedFields: candidate.matchedFields,
    supportingText: candidate.supportingText
  }));
  const expected = expectedCandidates.map((candidate) => candidate.videoId);
  assert.equal(worker.workerYieldCount > 1, true);
  assert.equal(reply.candidates.length, 80);
  assert.deepEqual(reply.candidates, expectedCandidates, "scores, coverage, matching fields, and support text remain identical");
  assert.equal(catalogMap.valuesCallCount, 1, "an uncached search reuses the initialized snapshot");

  scope.onmessage({ data: { type: "search", requestId: 42, revision: 0, query: "modern physics", plan, topic: "All", limit: 80, excludedIds: expected, viewKey: "large-catalog" } });
  const nextPage = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 42, 20_000);
  const expectedNextCandidates = searchYouTubeCandidates(videos, plan, "All", undefined, 80, expected).map((candidate) => ({
    coverage: candidate.coverage,
    videoId: candidate.video.id,
    score: candidate.score,
    matchedFields: candidate.matchedFields,
    supportingText: candidate.supportingText
  }));
  const expectedNextPage = expectedNextCandidates.map((candidate) => candidate.videoId);
  assert.equal(nextPage.candidates.length, 80);
  assert.deepEqual(nextPage.candidates, expectedNextCandidates);
  assert.ok(nextPage.candidates.every((candidate) => !expected.includes(candidate.videoId)));
  assert.equal(catalogMap.valuesCallCount, 1, "pagination does not copy the catalog from the map");

  scope.onmessage({ data: { type: "search", requestId: 43, revision: 0, query: "ancient biology", plan: { terms: ["ancient biology"] }, topic: "All", limit: 80, viewKey: "large-catalog" } });
  const otherSearch = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 43, 20_000);
  assert.equal(otherSearch.candidates.length, 80);
  assert.equal(catalogMap.valuesCallCount, 1, "a distinct uncached search also reuses the same snapshot");
});

test("YouTube worker refreshes its ordered snapshot only when records or order change", async () => {
  const worker = loadWorker("workers/youtube-search.worker.ts", { observeMaps: true });
  const { scope, messages } = worker;
  const makeVideo = (id, overrides = {}) => ({
    id, channelId: "channel-a", channelName: "Approved Channel", title: "Shared history documentary",
    description: "A long-form approved documentary.", tags: ["history"], publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600, durationLabel: "10:00", embedAvailable: true, thumbnailUrl: `https://example.test/${id}.jpg`,
    topics: ["History"], approved: true, ...overrides
  });
  const videos = [makeVideo("A", { title: "Older duplicate" }), makeVideo("B"), makeVideo("C"), makeVideo("A")];
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  const catalogMap = scope.inspectCatalog().videos;
  assert.equal(catalogMap.size, 3);
  assert.equal(catalogMap.valuesCallCount, 1);

  const search = async (revision, requestId) => {
    scope.onmessage({ data: { type: "search", requestId, revision, query: "history documentary", plan: { terms: ["history documentary"] }, topic: "All", limit: 10 } });
    return waitForMessage(messages, message => message.type === "results" && message.requestId === requestId);
  };
  const initial = await search(0, 70);
  assert.deepEqual(initial.candidates.map(candidate => candidate.videoId), ["A", "B", "C"], "duplicate IDs retain Map insertion position and last value");
  assert.equal(catalogMap.valuesCallCount, 1);
  const originalA = scope.inspectCatalog().videos.get("A"), originalB = scope.inspectCatalog().videos.get("B");
  assert.ok(originalA.searchFields.every(field => field.text && field.words instanceof Set), "worker records hold prepared normalized search fields");
  assert.equal(originalA.normalizedChannelName, "approved channel");

  scope.onmessage({ data: { type: "update", baseRevision: 0, revision: 1, upserts: [], removeIds: [] } });
  scope.onmessage({ data: { type: "update", baseRevision: 1, revision: 2, upserts: projectVideos([makeVideo("B")]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 1, "revision-only updates and equal replacement records retain the array");
  assert.strictEqual(scope.inspectCatalog().videos.get("A"), originalA, "unchanged records and their prepared fields are reused");
  assert.strictEqual(scope.inspectCatalog().videos.get("B"), originalB, "equal upserts retain the existing prepared record");
  const unchanged = await search(2, 71);
  assert.deepEqual(unchanged.candidates.map(candidate => candidate.videoId), ["A", "B", "C"]);
  assert.equal(catalogMap.valuesCallCount, 1);

  scope.onmessage({ data: { type: "update", baseRevision: 2, revision: 3, upserts: projectVideos([makeVideo("B", { sourceIds: ["approved-upload:B"] })]), removeIds: [] } });
  const provenanceUpdate = scope.inspectCatalog();
  assert.notEqual(provenanceUpdate.videos, catalogMap, "a replaced record publishes a new map");
  assert.notStrictEqual(provenanceUpdate.videos.get("B"), originalB, "a changed record gets a new immutable index object");
  assert.strictEqual(provenanceUpdate.videos.get("B").searchFields, originalB.searchFields, "provenance-only updates reuse all normalized searchable fields");
  assert.strictEqual(provenanceUpdate.videos.get("A"), originalA, "unrelated records retain their prepared fields");
  const replaced = await search(3, 72);
  assert.deepEqual(replaced.candidates.map(candidate => candidate.videoId), ["A", "B", "C"], "replacement preserves its original tie position");

  scope.onmessage({ data: { type: "update", baseRevision: 3, revision: 4, upserts: projectVideos([makeVideo("D")]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 1, "the captured original map remains untouched");
  assert.deepEqual((await search(4, 73)).candidates.map(candidate => candidate.videoId), ["A", "B", "C", "D"], "new records append");

  scope.onmessage({ data: { type: "update", baseRevision: 4, revision: 5, upserts: [], removeIds: ["B"] } });
  assert.equal(catalogMap.valuesCallCount, 1, "the captured original map remains untouched");
  assert.deepEqual((await search(5, 74)).candidates.map(candidate => candidate.videoId), ["A", "C", "D"]);

  scope.onmessage({ data: { type: "update", baseRevision: 5, revision: 6, upserts: [], removeIds: [], orderIds: ["D", "A", "D", "C"] } });
  assert.equal(catalogMap.valuesCallCount, 1, "explicit ordering does not mutate the captured map");
  assert.deepEqual((await search(6, 75)).candidates.map(candidate => candidate.videoId), ["D", "A", "C"], "explicit order follows Map deduplication and insertion semantics");

  scope.onmessage({ data: { type: "update", baseRevision: 6, revision: 7, upserts: [], removeIds: [], orderIds: ["D", "A", "C"] } });
  assert.equal(catalogMap.valuesCallCount, 1, "an unchanged explicit order leaves old snapshots untouched");
  assert.deepEqual((await search(7, 76)).candidates.map(candidate => candidate.videoId), ["D", "A", "C"]);

  scope.onmessage({ data: { type: "update", baseRevision: 7, revision: 8, upserts: [], removeIds: [], orderIds: ["C", "D"] } });
  assert.equal(catalogMap.valuesCallCount, 1, "the captured original map remains untouched");
  assert.deepEqual((await search(8, 77)).candidates.map(candidate => candidate.videoId), ["C", "D"], "explicit order drops records omitted by the caller");
});

test("YouTube worker preserves catalog order for tied matches spanning chunk boundaries", async () => {
  const worker = loadWorker("workers/youtube-search.worker.ts");
  const videos = Array.from({ length: 1_205 }, (_, index) => ({
    id: `tied-${index}`, channelId: "channel-a", channelName: "Approved Channel", title: "Shared history documentary",
    description: "A long-form approved documentary.", tags: ["history"], publishedAt: "2024-01-01T00:00:00.000Z",
    durationSeconds: 600, durationLabel: "10:00", embedAvailable: true, topics: ["History"], approved: true
  }));
  worker.scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  worker.scope.onmessage({ data: { type: "search", requestId: 78, revision: 0, query: "history documentary", plan: { terms: ["history documentary"] }, topic: "All", limit: videos.length } });
  const reply = await waitForMessage(worker.messages, message => message.type === "results" && message.requestId === 78);
  assert.deepEqual(reply.candidates.map(candidate => candidate.videoId), videos.map(video => video.id));
});

test("YouTube worker handles an empty catalog and refreshes it when the first records arrive", async () => {
  const worker = loadWorker("workers/youtube-search.worker.ts", { observeMaps: true });
  worker.scope.onmessage({ data: { type: "initialize", revision: 0, videos: [] } });
  const catalogMap = worker.scope.inspectCatalog().videos;
  assert.equal(catalogMap.valuesCallCount, 0);
  worker.scope.onmessage({ data: { type: "search", requestId: 79, revision: 0, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 10 } });
  const empty = await waitForMessage(worker.messages, message => message.type === "results" && message.requestId === 79);
  assert.deepEqual(empty.candidates, []);
  assert.equal(catalogMap.valuesCallCount, 0, "searching an empty catalog does not create another snapshot");

  const first = { id: "first", channelId: "channel-a", channelName: "Approved Channel", title: "History documentary", description: "Long-form", tags: ["history"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600, durationLabel: "10:00", embedAvailable: true, topics: ["History"], approved: true };
  const second = { ...first, id: "second" };
  worker.scope.onmessage({ data: { type: "update", baseRevision: 0, revision: 1, upserts: projectVideos([first, second]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 0);
  worker.scope.onmessage({ data: { type: "search", requestId: 80, revision: 1, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 10 } });
  const populated = await waitForMessage(worker.messages, message => message.type === "results" && message.requestId === 80);
  assert.deepEqual(populated.candidates.map(candidate => candidate.videoId), ["first", "second"]);
  assert.equal(catalogMap.valuesCallCount, 0);
});

test("YouTube worker prepares one immutable plan for every chunk in a request", async () => {
  const { scope, messages } = loadWorker("workers/youtube-search.worker.ts");
  const videos = Array.from({ length: 1_450 }, (_, index) => ({
    id: `prepared-worker-${index}`, channelId: "channel-a", channelName: "Approved Channel",
    title: `Gravitational lensing documentary ${index}`, description: "A long-form approved documentary.",
    tags: ["gravitational lensing"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600,
    durationLabel: "10:00", embedAvailable: true, topics: ["Science"], approved: true
  }));
  let conceptGroupReads = 0;
  const plan = { terms: ["bending starlight"] };
  Object.defineProperty(plan, "conceptGroups", { enumerable: true, get() { conceptGroupReads += 1; return undefined; } });
  scope.onmessage({ data: { type: "initialize", revision: 0, videos: projectVideos(videos) } });
  scope.onmessage({ data: { type: "search", requestId: 45, revision: 0, query: "bending starlight", plan, topic: "Science", limit: 80, viewKey: "workspace-a" } });
  const reply = await waitForMessage(messages, message => message.type === "results" && message.requestId === 45);
  assert.ok(reply.candidates.length > 0);
  assert.equal(conceptGroupReads, 4, "validation, cache identity, and prepared search run once, independent of chunk count");

  const firstPageIds = reply.candidates.map(candidate => candidate.videoId);
  scope.onmessage({ data: { type: "search", requestId: 46, revision: 0, query: "bending starlight", plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" } });
  const nextPage = await waitForMessage(messages, message => message.type === "results" && message.requestId === 46);
  assert.ok(nextPage.candidates.length > 0);
  assert.ok(nextPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 6, "a cached continuation validates and reads its key but avoids rebuilding the prepared search");
});

test("native YouTube worker reuses a prepared search across paginated requests", async () => {
  const worker = loadNativeYouTubeWorker({ observeMaps: true });
  const videos = Array.from({ length: 1_450 }, (_, index) => ({
    id: `native-prepared-${index}`, channelId: "channel-a", channelName: "Approved Channel",
    title: `Gravitational lensing documentary ${index}`, description: "A long-form approved documentary.",
    tags: ["gravitational lensing"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600,
    topics: ["Science"], approved: true
  }));
  let conceptGroupReads = 0;
  const plan = { terms: ["bending starlight"] };
  Object.defineProperty(plan, "conceptGroups", { enumerable: true, get() { conceptGroupReads += 1; return undefined; } });
  worker.send({ type: "initialize", revision: 0, videos: projectVideos(videos) });
  const catalogMap = worker.workerMaps.find(map => map.size === videos.length && map.has(videos[0].id));
  assert.ok(catalogMap, "the native worker maintains an ID map beside its retained ordered array");
  assert.equal(catalogMap.valuesCallCount, 1);
  worker.send({ type: "search", requestId: 61, revision: 0, query: "bending starlight", plan, topic: "Science", limit: 80, viewKey: "workspace-a" });
  const firstPage = await waitForMessage(worker.messages, message => message.requestId === 61);
  const firstPageIds = firstPage.candidates.map(candidate => candidate.videoId);
  assert.ok(firstPageIds.length > 0);
  assert.equal(conceptGroupReads, 4, "the Mac worker validates, serializes and prepares the plan once");
  assert.equal(catalogMap.valuesCallCount, 1, "native search scans the retained array rather than rebuilding it from map values");

  worker.send({ type: "search", requestId: 62, revision: 0, query: "bending starlight", plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" });
  const secondPage = await waitForMessage(worker.messages, message => message.requestId === 62);
  assert.ok(secondPage.candidates.length > 0);
  assert.ok(secondPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 6, "a cached Mac continuation validates and reads its key but avoids re-preparing the search");
  assert.equal(catalogMap.valuesCallCount, 1, "native pagination also keeps using the retained catalog array");
});

test("topic semantic worker returns meaning matches and ancestor paths, rejecting obsolete queries", async () => {
  const {scope,messages}=loadWorker("workers/topic-search.worker.ts");
  scope.onmessage({data:{type:"initialize",customTopics:[],catalogRevision:8}});
  scope.onmessage({data:{type:"search",requestId:1,query:"why does the ground shake",semanticTerms:[],catalogRevision:8}});
  scope.onmessage({data:{type:"search",requestId:2,query:"earthquakes in Japan",semanticTerms:[],catalogRevision:8}});
  const r=await waitForMessage(messages,m=>m.requestId===2);
  assert.equal(r.completeCoverage,true);assert.equal(r.suggestions.length,100);assert.ok(r.suggestions.slice(0,5).some(s=>s.label==="2011 Tōhoku Earthquake"));
  assert.ok(r.visibleIds.length>r.matchedIds.length);assert.ok(!messages.some(m=>m.requestId===1));
});
test("topic semantic worker invalidates catalog caches when custom topics change", async () => {
  const {scope,messages}=loadWorker("workers/topic-search.worker.ts");
  scope.onmessage({data:{type:"initialize",customTopics:[],catalogRevision:9}});
  scope.onmessage({data:{type:"search",requestId:1,query:"quantum gardens",semanticTerms:[],catalogRevision:9}});
  const before=await waitForMessage(messages,m=>m.requestId===1);assert.equal(before.completeCoverage,false);
  scope.onmessage({data:{type:"initialize",customTopics:[{id:"custom-garden",label:"Quantum Gardens",custom:true,selected:false,expanded:false,weight:10}],catalogRevision:10}});
  scope.onmessage({data:{type:"search",requestId:2,query:"quantum gardens",semanticTerms:[],catalogRevision:10}});
  const after=await waitForMessage(messages,m=>m.requestId===2);assert.equal(after.completeCoverage,true);assert.ok(after.matchedIds.includes("custom-garden"));
});

for (const platform of ["website", "native"]) {
  test(`${platform} publishes complete catalog snapshots and rolls back validation/indexing failures`, async () => {
    const indexOverride = index => (video, previous) => { if (video.id === "explode") throw new Error("Index preparation failed"); return index(video, previous); };
    const worker = platform === "website" ? loadWorker("workers/youtube-search.worker.ts", { indexOverride }) : loadNativeYouTubeWorker({ indexOverride });
    const send = data => platform === "website" ? worker.scope.onmessage({ data }) : worker.send(data);
    const inspect = () => platform === "website" ? worker.scope.inspectCatalog() : worker.context.inspectCatalog();
    const ordered = value => value.ordered || value.videos;
    const map = value => value.byId || value.videos;
    const make = id => ({ id, channelId: "channel", channelName: "Channel", title: "History documentary", description: "Historical research", tags: ["history"], topics: ["History"], publishedAt: "2024-01-01", durationSeconds: 600, approved: true });
    const original = Array.from({ length: 1800 }, (_, i) => make(`atomic-${i}`));
    send({ type: "initialize", revision: 0, videos: original });
    const initial = inspect(), oldOrdered = ordered(initial), oldMap = map(initial);
    const originalPrepared = oldMap.get(original[1].id);
    send({ type: "search", revision: 0, requestId: 800, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 80 });
    send({ type: "update", baseRevision: 0, revision: 1, removeIds: [original[0].id], upserts: [make("new"), { ...make("invalid"), sourceIds: [null] }] });
    assert.equal(inspect(), initial, "invalid trailing metadata cannot publish earlier removals or upserts");
    assert.ok(worker.messages.some(message => message.type === "rebuild" && message.revision === 1));
    const oldResults = await waitForMessage(worker.messages, message => message.requestId === 800 && message.candidates);
    assert.equal(oldResults.revision, 0);
    assert.equal(oldResults.candidates[0].videoId, original[0].id, "running search keeps its captured valid catalog after failed staging");

    send({ type: "update", baseRevision: 0, revision: 1, removeIds: [original[0].id], upserts: [make("new"), make("explode")] });
    assert.equal(inspect(), initial, "a failure during indexing discards the partially built map");
    assert.equal(oldMap.size, original.length);
    assert.equal(oldMap.has("new"), false);
    send({ type: "initialize", revision: 9, videos: [make("new"), make("explode")] });
    assert.equal(inspect(), initial, "failed full initialization also retains the previous snapshot");

    const updated = { ...make(original[1].id), title: "Updated history documentary", sourceIds: ["playlist:approved"] };
    send({ type: "update", baseRevision: 0, revision: 1, removeIds: [original[0].id], upserts: [updated, make("new")], orderIds: ["new", original[1].id, original[2].id] });
    const next = inspect();
    assert.equal(next.revision, 1);
    assert.notEqual(map(next), oldMap);
    assert.notEqual(ordered(next), oldOrdered);
    assert.deepEqual(Array.from(ordered(next), video => video.id), ["new", original[1].id, original[2].id]);
    for (const video of ordered(next)) assert.equal(map(next).get(video.id), video, "ordered and search-index records share the staged map entries");
    const updatedPrepared = map(next).get(original[1].id);
    assert.notStrictEqual(updatedPrepared.searchFields, originalPrepared.searchFields, `${platform} rebuilds fields when searchable title text changes`);
    assert.strictEqual(updatedPrepared.searchFields[1], originalPrepared.searchFields[1], `${platform} reuses unchanged tag text during a title update`);
    assert.strictEqual(updatedPrepared.searchFields[2], originalPrepared.searchFields[2], `${platform} reuses unchanged description text during a title update`);
    assert.strictEqual(map(next).get(original[2].id).searchFields, oldMap.get(original[2].id).searchFields, `${platform} retains derived fields for untouched records`);
    assert.equal(oldMap.get(original[1].id).title, original[1].title, "published old records remain unchanged");
    assert.equal(oldOrdered.length, original.length);
    send({ type: "update", baseRevision: 1, revision: 2, upserts: [updated], removeIds: [], orderIds: ["new", original[1].id, original[2].id] });
    assert.equal(ordered(inspect()), ordered(next), "unchanged records/order reuse the retained array");
    assert.equal(map(inspect()), map(next), "unchanged update also reuses the map");
    send({ type: "search", revision: 2, requestId: 801, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 80 });
    const current = await waitForMessage(worker.messages, message => message.requestId === 801 && message.candidates);
    assert.equal(current.revision, 2);
    assert.deepEqual(new Set(Array.from(current.candidates, candidate => candidate.videoId)), new Set(["new", original[1].id, original[2].id]));
  });
}

const metadata = require("../lib/video-metadata.ts");
const nativeMetadataContext = { LEARNED_MEDIA_BACKGROUND: require("../lib/background-work.ts"), setTimeout, clearTimeout };
vm.runInNewContext(readFileSync(path.join(root, "..", "App/Resources/frontend/video-metadata.js"), "utf8"), nativeMetadataContext);
for (const [platform, api] of [["website", metadata], ["native", nativeMetadataContext.LEARNED_MEDIA_VIDEO_METADATA]]) {
  test(`${platform} coalesces pending video patches by ID and preserves the final revision/order`, () => {
    const sent = [], scheduled = [], canceled = [];
    const queue = api.createVideoSearchPatchQueue(patch => sent.push(patch), flush => { scheduled.push(flush); return () => canceled.push(flush); });
    const make = (id, title) => ({ id, title });
    queue.enqueue({ baseRevision: 1, revision: 2, upserts: [make("A", "first"), make("B", "old"), make("gone", "temporary")], removeIds: [], orderIds: ["A", "B"] });
    queue.enqueue({ baseRevision: 2, revision: 3, upserts: [make("A", "latest")], removeIds: ["B"], orderIds: ["A"] });
    const order = ["B", "A"];
    queue.enqueue({ baseRevision: 3, revision: 4, upserts: [make("B", "restored")], removeIds: ["gone"], orderIds: order });
    order.reverse();
    assert.equal(sent.length, 0, "no projection or structured clone before the batch flushes");
    assert.equal(scheduled.length, 1);
    scheduled[0]();
    assert.equal(sent.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { baseRevision: 1, revision: 4, upserts: [make("A", "latest"), make("B", "restored")], removeIds: ["gone"], orderIds: ["B", "A"] });
    queue.flush();
    assert.equal(sent.length, 1, "a search flush after a scheduled flush does not resend it");
    queue.enqueue({ baseRevision: 4, revision: 5, upserts: [make("late", "canceled")], removeIds: [] });
    queue.clear(); scheduled[1]();
    assert.equal(sent.length, 1, "a canceled callback cannot send an obsolete patch");
    queue.enqueue({ baseRevision: 9, revision: 10, upserts: [make("new-worker", "fresh")], removeIds: [] });
    scheduled[1]();
    assert.equal(sent.length, 1, "an obsolete callback cannot flush a newer batch");
    queue.flush();
    assert.equal(sent[1].baseRevision, 9, "a rebuild can start a fresh revision chain");
    assert.equal(canceled.length, 3);
  });
  test(`${platform} burst patches match sequential catalog changes across 30,000 videos`, () => {
    const initial = Array.from({length: 30000}, (_, i) => ({ id: String(i), title: "Original", tags: [], topics: [] }));
    let target = initial, previous = new Map(initial.map(video => [video.id, video]));
    const sent = [];
    const queue = api.createVideoSearchPatchQueue(patch => sent.push(patch), () => () => {});
    for (let revision = 1; revision <= 24; revision++) {
      const next = new Map(target.map(video => [video.id, video]));
      next.delete(String(revision - 1));
      next.set(String(100 + revision % 3), { ...initial[100 + revision % 3], title: `Changed ${revision}` });
      next.set(`new-${revision}`, { ...initial[0], id: `new-${revision}` });
      target = [...next.values()];
      if (revision % 3 === 0) target.reverse();
      const patch = api.diffVideoSearchMetadata(previous, target);
      queue.enqueue({baseRevision: revision - 1, revision, ...patch});
      previous = new Map(target.map(video => [video.id, video]));
    }
    queue.flush();
    assert.equal(sent.length, 1);
    const result = new Map(initial.map(video => [video.id, video]));
    for (const id of sent[0].removeIds) result.delete(id);
    for (const video of sent[0].upserts) result.set(video.id, video);
    const final = sent[0].orderIds.map(id => result.get(id));
    assert.deepEqual(final, target);
    assert.equal(sent[0].revision, 24);
    assert.equal(sent[0].upserts.length, 27, "repeated replacements retain only one record per ID");
  });
}

for (const platform of ['website','native']) {
  test(`${platform} restores a validated persisted index before servicing startup searches`, async () => {
    const engine = require('../lib/video-semantic.ts');
    const source = projectVideos(Array.from({length:600},(_,i)=>({id:String(i),channelId:'science',channelName:'Science',title:'Gravitational lensing '+i,description:'Distant starlight bends around a galaxy.',tags:['astronomy'],topics:['Science'],publishedAt:'2024-01-01',durationSeconds:600,approved:true})));
    const indexed = source.map(v=>engine.indexVideoSearchMetadata(v));
    const fingerprint = await engine.videoSearchCatalogFingerprint(source);
    const stored = await engine.serializeVideoSearchIndex(indexed,fingerprint);
    let derivations=0,saves=0;
    const options = {indexOverride: original => (...args)=>{derivations++;return original(...args)}, persistenceOverride:()=>({enabled:true,restore:async videos=>engine.restoreVideoSearchIndex(videos,structuredClone(stored),await engine.videoSearchCatalogFingerprint(videos)),save:()=>saves++})};
    const worker=platform==='website'?loadWorker('workers/youtube-search.worker.ts',options):loadNativeYouTubeWorker(options);
    const send=data=>platform==='website'?worker.scope.onmessage({data}):worker.send(data);
    const inspect=()=>platform==='website'?worker.scope.inspectCatalog():worker.context.inspectCatalog();
    send({type:'initialize',revision:1,videos:source});
    assert.equal(inspect().revision,-1,'an incomplete index is never published');
    const plan=engine.makeLocalVideoPlan('gravitational lensing');
    send({type:'search',requestId:10,revision:1,query:'gravitational lensing',plan,topic:'All',limit:80});
    const result=await waitForMessage(worker.messages,m=>m.requestId===10);
    assert.equal(derivations,0,'warm startup reuses all validated normalized fields');assert.equal(saves,0,'a cache hit is not written again');
    const expected=engine.searchSemanticVideos(indexed,plan,'All',undefined,80).map(({video,score,matchedFields,supportingText})=>({videoId:video.id,score,matchedFields,supportingText}));
    assert.deepEqual(JSON.parse(JSON.stringify(result.candidates.map(({coverage,...rest})=>rest))),expected);
    send({type:'update',baseRevision:1,revision:2,upserts:[{...source[0],title:'Changed searchable title'}],removeIds:[]});
    assert.equal(derivations,1,'only the changed record is derived during an ordinary patch');assert.equal(saves,1);
  });

  test(`${platform} orders catalog patches and cancellation behind a pending cache read`,async()=>{
    const engine = require('../lib/video-semantic.ts');
    const source=projectVideos([{id:'old',channelId:'science',channelName:'Science',title:'Gravitational lensing',description:'Light bending by galaxies.',tags:[],topics:['Science'],publishedAt:'2024-01-01',durationSeconds:600,approved:true}]);
    let release;const blocked=new Promise(resolve=>{release=resolve});
    const options={persistenceOverride:()=>({enabled:true,restore:()=>blocked,save:()=>{}})};
    const worker=platform==='website'?loadWorker('workers/youtube-search.worker.ts',options):loadNativeYouTubeWorker(options);
    const send=data=>platform==='website'?worker.scope.onmessage({data}):worker.send(data);
    const search=(requestId,revision)=>({type:'search',requestId,revision,query:'gravitational lensing',plan:engine.makeLocalVideoPlan('gravitational lensing'),topic:'All',limit:80});
    send({type:'initialize',revision:1,videos:source});
    send(search(20,1));send({type:'cancel',requestId:20});
    send({type:'update',baseRevision:1,revision:2,upserts:[{...source[0],id:'new'}],removeIds:['old']});
    send(search(21,2));release(undefined);
    const result=await waitForMessage(worker.messages,m=>m.requestId===21);
    assert.deepEqual(JSON.parse(JSON.stringify(result.candidates.map(v=>v.videoId))),['new']);
    assert.ok(!worker.messages.some(m=>m.requestId===20 && (m.type==='results'||m.candidates)),'canceled startup searches never publish');
  });
}

for (const [name, load, send] of [
  ['website', options => loadWorker('workers/youtube-search.worker.ts', options), (w, data) => w.scope.onmessage({data})],
  ['Mac', loadNativeYouTubeWorker, (w, data) => w.send(data)]
]) {
  const videos = Array.from({length:1500}, (_,index)=>({id:`recovery-${index}`,channelId:'science',channelName:'Science',title:`Ancient biology study ${index}`,description:'A documented biology study.',tags:['biology'],topics:['Science'],publishedAt:'2024-01-01',durationSeconds:600,approved:true}));
  const request = id => ({type:'search',requestId:id,revision:1,query:'biology',plan:makeLocalVideoPlan('biology'),topic:'All',limit:80});
  test(`${name} reports async ranking failures without retaining provider content`, async()=>{
    const worker=load({searchOverride:()=>()=>{throw Error('private content must not escape');}});
    send(worker,{type:'initialize',revision:1,videos});
    send(worker,request(501));
    const failed=await waitForMessage(worker.messages,message=>message.type==='failed');
    assert.deepEqual(JSON.parse(JSON.stringify(failed)),{type:'failed',requestId:501,revision:1});
    assert.equal(worker.messages.some(message=>JSON.stringify(message).includes('private content')),false);
  });
  test(`${name} settles superseded requests and reports progress for long searches`, async()=>{
    let now=0;const worker=load({performanceNow:()=>now+=1100});
    send(worker,{type:'initialize',revision:1,videos});
    await waitForMessage(worker.messages,message=>message.type==='ready');
    send(worker,request(601));send(worker,request(602));
    await waitForMessage(worker.messages,message=>message.type==='stale'&&message.requestId===601);
    await waitForMessage(worker.messages,message=>message.requestId===602&&Array.isArray(message.candidates));
    assert.ok(worker.messages.some(message=>message.type==='progress'&&message.requestId===602&&message.revision===1));
    assert.equal(worker.messages.some(message=>message.requestId===601&&Array.isArray(message.candidates)),false);
  });
}
