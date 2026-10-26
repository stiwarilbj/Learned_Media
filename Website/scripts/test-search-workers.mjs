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
const { insertBoundedRanked } = require("../lib/video-semantic.ts");
const projectVideos = (videos) => videos.map(toVideoSearchDocument);

function importFromWorker(specifier) {
  if (!specifier.startsWith("@/")) return require(specifier);
  return require(path.join(root, `${specifier.slice(2)}.ts`));
}

function loadWorker(filename, { observeMaps = false, searchOverride, indexOverride } = {}) {
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
    if (specifier === "@/lib/video-semantic") return { ...imported,
      searchPreparedSemanticVideos: searchOverride ? searchOverride(imported.searchPreparedSemanticVideos) : imported.searchPreparedSemanticVideos,
      indexVideoSearchMetadata: indexOverride ? indexOverride(imported.indexVideoSearchMetadata) : imported.indexVideoSearchMetadata };
    return imported;
  };
  new Function("require", "module", "exports", "self", "setTimeout", "Map", source + (filename === "workers/youtube-search.worker.ts" ? "\nself.inspectCatalog = () => snapshot;" : ""))(workerImport, module, module.exports, scope, workerSetTimeout, observeMaps ? ObservedMap : Map);
  return { scope, messages, workerMaps, get workerYieldCount() { return workerYieldCount; } };
}

function loadNativeYouTubeWorker({ observeMaps = false, searchOverride, indexOverride } = {}) {
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
  const context = { postMessage: (message) => messages.push(message), setTimeout, Map: observeMaps ? ObservedMap : Map };
  context.globalThis = context;
  context.importScripts = (filename) => {
    const runtime = readFileSync(path.join(root, "..", "App", "Resources", "frontend", filename), "utf8");
    vm.runInNewContext(runtime, context);
  };
  const source = readFileSync(path.join(root, "..", "App", "Resources", "frontend", "youtube-search.worker.js"), "utf8");
  vm.runInNewContext(source + "\nglobalThis.inspectCatalog = () => snapshot;", context);
  if (searchOverride) context.LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos = searchOverride(context.LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos);
  if (indexOverride) context.LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata = indexOverride(context.LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata);
  return { messages, workerMaps, context, send: (data) => context.onmessage({ data }) };
}

function loadNativeCardWorker() {
  const messages = [];
  const context = {
    self: { postMessage: (message) => messages.push(message) },
    setTimeout,
    Map
  };
  context.globalThis = context;
  const source = readFileSync(path.join(root, "..", "App", "Resources", "frontend", "card-search.worker.js"), "utf8");
  vm.runInNewContext(source, context);
  return { messages, send: (data) => context.self.onmessage({ data }) };
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

  scope.onmessage({ data: { type: "update", baseRevision: 0, revision: 1, upserts: [], removeIds: [] } });
  scope.onmessage({ data: { type: "update", baseRevision: 1, revision: 2, upserts: projectVideos([makeVideo("B")]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 1, "revision-only updates and equal replacement records retain the array");
  const unchanged = await search(2, 71);
  assert.deepEqual(unchanged.candidates.map(candidate => candidate.videoId), ["A", "B", "C"]);
  assert.equal(catalogMap.valuesCallCount, 1);

  scope.onmessage({ data: { type: "update", baseRevision: 2, revision: 3, upserts: projectVideos([makeVideo("B", { sourceIds: ["approved-upload:B"] })]), removeIds: [] } });
  assert.notEqual(scope.inspectCatalog().videos, catalogMap, "a replaced record publishes a new map");
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
  assert.equal(conceptGroupReads, 3, "one worker cache-key read and one immutable preparation, independent of chunk count");

  const firstPageIds = reply.candidates.map(candidate => candidate.videoId);
  scope.onmessage({ data: { type: "search", requestId: 46, revision: 0, query: "bending starlight", plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" } });
  const nextPage = await waitForMessage(messages, message => message.type === "results" && message.requestId === 46);
  assert.ok(nextPage.candidates.length > 0);
  assert.ok(nextPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 5, "the next page builds its own excluded-ID set but reuses the immutable prepared search");
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
  worker.send({ type: "search", requestId: 61, revision: 0, plan, topic: "Science", limit: 80, viewKey: "workspace-a" });
  const firstPage = await waitForMessage(worker.messages, message => message.requestId === 61);
  const firstPageIds = firstPage.candidates.map(candidate => candidate.videoId);
  assert.ok(firstPageIds.length > 0);
  assert.equal(conceptGroupReads, 2, "the Mac worker snapshots the plan only on the first page");
  assert.equal(catalogMap.valuesCallCount, 1, "native search scans the retained array rather than rebuilding it from map values");

  worker.send({ type: "search", requestId: 62, revision: 0, plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" });
  const secondPage = await waitForMessage(worker.messages, message => message.requestId === 62);
  assert.ok(secondPage.candidates.length > 0);
  assert.ok(secondPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 3, "the Mac worker reuses prepared terms and resolves new page exclusions independently");
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
    const indexOverride = index => video => { if (video.id === "explode") throw new Error("Index preparation failed"); return index(video); };
    const worker = platform === "website" ? loadWorker("workers/youtube-search.worker.ts", { indexOverride }) : loadNativeYouTubeWorker({ indexOverride });
    const send = data => platform === "website" ? worker.scope.onmessage({ data }) : worker.send(data);
    const inspect = () => platform === "website" ? worker.scope.inspectCatalog() : worker.context.inspectCatalog();
    const ordered = value => value.ordered || value.videos;
    const map = value => value.byId || value.videos;
    const make = id => ({ id, channelId: "channel", channelName: "Channel", title: "History documentary", description: "Historical research", tags: ["history"], topics: ["History"], publishedAt: "2024-01-01", durationSeconds: 600, approved: true });
    const original = Array.from({ length: 1800 }, (_, i) => make(`atomic-${i}`));
    send({ type: "initialize", revision: 0, videos: original });
    const initial = inspect(), oldOrdered = ordered(initial), oldMap = map(initial);
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
