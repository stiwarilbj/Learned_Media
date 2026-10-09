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
  scope.onmessage({ data: { type: "update", revision: 1, upserts: [], removeIds: [] } });
  const stale = await waitForMessage(messages, (message) => message.type === "stale" && message.requestId === 35);
  assert.equal(stale.revision, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(messages.some((message) => message.type === "results" && message.requestId === 35), false);
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
  scope.onmessage({ data: { type: "search", requestId: 41, revision: 0, query: "modern physics", plan, topic: "All", limit: 80 } });
  const reply = await waitForMessage(messages, (message) => message.type === "results" && message.requestId === 41, 20_000);
  const expected = searchYouTubeCandidates(videos, plan, "All", undefined, 80).map((candidate) => candidate.video.id);
  assert.equal(worker.workerYieldCount > 1, true);
  assert.equal(reply.candidates.length, 80);
  assert.deepEqual(reply.candidates.map((candidate) => candidate.videoId), expected);
});
