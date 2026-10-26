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
const projectVideos = (videos) => videos.map(toVideoSearchDocument);

function importFromWorker(specifier) {
  if (!specifier.startsWith("@/")) return require(specifier);
  return require(path.join(root, `${specifier.slice(2)}.ts`));
}

function loadWorker(filename, { observeMaps = false } = {}) {
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
  new Function("require", "module", "exports", "self", "setTimeout", "Map", source)(importFromWorker, module, module.exports, scope, workerSetTimeout, observeMaps ? ObservedMap : Map);
  return { scope, messages, workerMaps, get workerYieldCount() { return workerYieldCount; } };
}

function loadNativeYouTubeWorker({ observeMaps = false } = {}) {
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
  vm.runInNewContext(source, context);
  return { messages, workerMaps, send: (data) => context.onmessage({ data }) };
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

test("card worker keeps rank order, honors eligibility, and abandons obsolete search batches", async () => {
  const { rankSearchResults } = require("../lib/search.ts");
  const { scope, messages } = loadWorker("workers/card-search.worker.ts");
  const documents = Array.from({ length: 1600 }, (_, index) => ({
    id: `card-${index}`,
    text: index % 3 === 0 ? `Ancient astronomy and history fact ${index}` : `Modern science story ${index}`
  }));
  scope.onmessage({ data: { type: "initialize", revision: 0, documents } });
  scope.onmessage({ data: { type: "search", requestId: 10, revision: 0, query: "ancient astronomy", eligibleIds: documents.map((item) => item.id), viewKey: "feed" } });
  scope.onmessage({ data: { type: "search", requestId: 11, revision: 0, query: "modern science", eligibleIds: documents.filter((_, index) => index % 2 === 0).map((item) => item.id), viewKey: "saved" } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 11);
  assert.equal(reply.viewKey, "saved");
  assert.ok(reply.ids.length > 0);
  assert.ok(reply.ids.every((id) => Number(id.slice(5)) % 2 === 0));
  const eligible = documents.filter((_, index) => index % 2 === 0);
  assert.deepEqual(reply.ids, rankSearchResults("modern science", eligible, (item) => item.text).map((item) => item.id));
  assert.equal(messages.some((message) => message.type === "results" && message.requestId === 10), false);
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
  const catalogMap = worker.workerMaps[0];
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
  const catalogMap = worker.workerMaps[0];
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
  assert.equal(catalogMap.valuesCallCount, 2, "a replaced record refreshes the ordered snapshot");
  const replaced = await search(3, 72);
  assert.deepEqual(replaced.candidates.map(candidate => candidate.videoId), ["A", "B", "C"], "replacement preserves its original tie position");

  scope.onmessage({ data: { type: "update", baseRevision: 3, revision: 4, upserts: projectVideos([makeVideo("D")]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 3);
  assert.deepEqual((await search(4, 73)).candidates.map(candidate => candidate.videoId), ["A", "B", "C", "D"], "new records append");

  scope.onmessage({ data: { type: "update", baseRevision: 4, revision: 5, upserts: [], removeIds: ["B"] } });
  assert.equal(catalogMap.valuesCallCount, 4);
  assert.deepEqual((await search(5, 74)).candidates.map(candidate => candidate.videoId), ["A", "C", "D"]);

  scope.onmessage({ data: { type: "update", baseRevision: 5, revision: 6, upserts: [], removeIds: [], orderIds: ["D", "A", "D", "C"] } });
  assert.equal(catalogMap.valuesCallCount, 4, "explicit ordering builds from the ordered update rather than copying map values");
  assert.deepEqual((await search(6, 75)).candidates.map(candidate => candidate.videoId), ["D", "A", "C"], "explicit order follows Map deduplication and insertion semantics");

  scope.onmessage({ data: { type: "update", baseRevision: 6, revision: 7, upserts: [], removeIds: [], orderIds: ["D", "A", "C"] } });
  assert.equal(catalogMap.valuesCallCount, 4, "an unchanged explicit order keeps the existing snapshot");
  assert.deepEqual((await search(7, 76)).candidates.map(candidate => candidate.videoId), ["D", "A", "C"]);

  scope.onmessage({ data: { type: "update", baseRevision: 7, revision: 8, upserts: [], removeIds: [], orderIds: ["C", "D"] } });
  assert.equal(catalogMap.valuesCallCount, 4);
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
  const catalogMap = worker.workerMaps[0];
  assert.equal(catalogMap.valuesCallCount, 1);
  worker.scope.onmessage({ data: { type: "search", requestId: 79, revision: 0, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 10 } });
  const empty = await waitForMessage(worker.messages, message => message.type === "results" && message.requestId === 79);
  assert.deepEqual(empty.candidates, []);
  assert.equal(catalogMap.valuesCallCount, 1, "searching an empty catalog does not create another snapshot");

  const first = { id: "first", channelId: "channel-a", channelName: "Approved Channel", title: "History documentary", description: "Long-form", tags: ["history"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600, durationLabel: "10:00", embedAvailable: true, topics: ["History"], approved: true };
  const second = { ...first, id: "second" };
  worker.scope.onmessage({ data: { type: "update", baseRevision: 0, revision: 1, upserts: projectVideos([first, second]), removeIds: [] } });
  assert.equal(catalogMap.valuesCallCount, 2);
  worker.scope.onmessage({ data: { type: "search", requestId: 80, revision: 1, query: "history", plan: { terms: ["history"] }, topic: "All", limit: 10 } });
  const populated = await waitForMessage(worker.messages, message => message.type === "results" && message.requestId === 80);
  assert.deepEqual(populated.candidates.map(candidate => candidate.videoId), ["first", "second"]);
  assert.equal(catalogMap.valuesCallCount, 2);
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
  assert.equal(catalogMap.valuesCallCount, 0);
  worker.send({ type: "search", requestId: 61, revision: 0, plan, topic: "Science", limit: 80, viewKey: "workspace-a" });
  const firstPage = await waitForMessage(worker.messages, message => message.requestId === 61);
  const firstPageIds = firstPage.candidates.map(candidate => candidate.videoId);
  assert.ok(firstPageIds.length > 0);
  assert.equal(conceptGroupReads, 2, "the Mac worker snapshots the plan only on the first page");
  assert.equal(catalogMap.valuesCallCount, 0, "native search scans the retained array rather than rebuilding it from map values");

  worker.send({ type: "search", requestId: 62, revision: 0, plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" });
  const secondPage = await waitForMessage(worker.messages, message => message.requestId === 62);
  assert.ok(secondPage.candidates.length > 0);
  assert.ok(secondPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 3, "the Mac worker reuses prepared terms and resolves new page exclusions independently");
  assert.equal(catalogMap.valuesCallCount, 0, "native pagination also keeps using the retained catalog array");
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
