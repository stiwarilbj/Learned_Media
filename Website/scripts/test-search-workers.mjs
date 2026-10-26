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

function importFromWorker(specifier) {
  if (!specifier.startsWith("@/")) return require(specifier);
  return require(path.join(root, `${specifier.slice(2)}.ts`));
}

function loadWorker(filename) {
  const messages = [];
  let workerYieldCount = 0;
  const scope = { onmessage: null, postMessage: (message) => messages.push(message) };
  const source = ts.transpileModule(readFileSync(path.join(root, filename), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const workerSetTimeout = (callback, delay) => {
    if (delay === 0) workerYieldCount += 1;
    return setTimeout(callback, delay);
  };
  new Function("require", "module", "exports", "self", "setTimeout", source)(importFromWorker, module, module.exports, scope, workerSetTimeout);
  return { scope, messages, get workerYieldCount() { return workerYieldCount; } };
}

function loadNativeYouTubeWorker() {
  const messages = [];
  const context = { postMessage: (message) => messages.push(message), setTimeout };
  context.globalThis = context;
  context.importScripts = (filename) => {
    const runtime = readFileSync(path.join(root, "..", "App", "Resources", "frontend", filename), "utf8");
    vm.runInNewContext(runtime, context);
  };
  const source = readFileSync(path.join(root, "..", "App", "Resources", "frontend", "youtube-search.worker.js"), "utf8");
  vm.runInNewContext(source, context);
  return { messages, send: (data) => context.onmessage({ data }) };
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
  scope.onmessage({ data: { type: "initialize", revision: 0, videos } });
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
  scope.onmessage({ data: { type: "initialize", revision: 0, videos } });
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
  scope.onmessage({ data: { type: "initialize", revision: 0, videos } });
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
  scope.onmessage({ data: { type: "initialize", revision: 4, videos } });
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
  const worker = loadWorker("workers/youtube-search.worker.ts");
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
  scope.onmessage({ data: { type: "initialize", revision: 0, videos } });
  scope.onmessage({ data: { type: "search", requestId: 41, revision: 0, query: "modern physics", plan, topic: "All", limit: 80, viewKey: "large-catalog" } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 41, 20_000);
  const expected = searchYouTubeCandidates(videos, plan, "All", undefined, 80).map((candidate) => candidate.video.id);
  assert.equal(worker.workerYieldCount > 1, true);
  assert.equal(reply.candidates.length, 80);
  assert.deepEqual(reply.candidates.map((candidate) => candidate.videoId), expected);

  scope.onmessage({ data: { type: "search", requestId: 42, revision: 0, query: "modern physics", plan, topic: "All", limit: 80, excludedIds: expected, viewKey: "large-catalog" } });
  const nextPage = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 42, 20_000);
  const expectedNextPage = searchYouTubeCandidates(videos, plan, "All", undefined, 80, expected).map((candidate) => candidate.video.id);
  assert.equal(nextPage.candidates.length, 80);
  assert.deepEqual(nextPage.candidates.map((candidate) => candidate.videoId), expectedNextPage);
  assert.ok(nextPage.candidates.every((candidate) => !expected.includes(candidate.videoId)));
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
  scope.onmessage({ data: { type: "initialize", revision: 0, videos } });
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
  const worker = loadNativeYouTubeWorker();
  const videos = Array.from({ length: 1_450 }, (_, index) => ({
    id: `native-prepared-${index}`, channelId: "channel-a", channelName: "Approved Channel",
    title: `Gravitational lensing documentary ${index}`, description: "A long-form approved documentary.",
    tags: ["gravitational lensing"], publishedAt: "2024-01-01T00:00:00.000Z", durationSeconds: 600,
    topics: ["Science"], approved: true
  }));
  let conceptGroupReads = 0;
  const plan = { terms: ["bending starlight"] };
  Object.defineProperty(plan, "conceptGroups", { enumerable: true, get() { conceptGroupReads += 1; return undefined; } });
  worker.send({ type: "initialize", revision: 0, videos });
  worker.send({ type: "search", requestId: 61, revision: 0, plan, topic: "Science", limit: 80, viewKey: "workspace-a" });
  const firstPage = await waitForMessage(worker.messages, message => message.requestId === 61);
  const firstPageIds = firstPage.candidates.map(candidate => candidate.videoId);
  assert.ok(firstPageIds.length > 0);
  assert.equal(conceptGroupReads, 2, "the Mac worker snapshots the plan only on the first page");

  worker.send({ type: "search", requestId: 62, revision: 0, plan, topic: "Science", limit: 80, excludedIds: firstPageIds, viewKey: "workspace-a" });
  const secondPage = await waitForMessage(worker.messages, message => message.requestId === 62);
  assert.ok(secondPage.candidates.length > 0);
  assert.ok(secondPage.candidates.every(candidate => !firstPageIds.includes(candidate.videoId)));
  assert.equal(conceptGroupReads, 3, "the Mac worker reuses prepared terms and resolves new page exclusions independently");
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
