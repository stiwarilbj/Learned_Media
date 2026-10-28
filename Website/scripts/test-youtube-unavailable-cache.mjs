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

const retry = require(path.join(root, "lib/background-retry.ts"));
retry.backgroundRetryDelay = () => 0;
retry.waitForBackgroundRetry = async () => {};
const { YouTubeApiError, YouTubeClient } = require(path.join(root, "lib/youtube.ts"));

function metadataItem(id) {
  return { id, snippet: { title: `Video ${id}` } };
}

test("an omitted video ID is reused across overlapping playlist lookups in one import", async () => {
  let resolveRequest;
  let calls = 0;
  const client = new YouTubeClient("test-key", async (resource, params) => {
    assert.equal(resource, "videos");
    assert.equal(params.id, "unavailable-1,available-1");
    calls += 1;
    return new Promise(resolve => { resolveRequest = resolve; });
  });
  const load = client.createMetadataLoader();

  // Two playlist pages can mention the same ID while its shared API request is pending.
  const firstPlaylist = load(["unavailable-1", "available-1"]);
  const overlappingPlaylist = load(["unavailable-1"]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  resolveRequest({ items: [metadataItem("available-1")] });

  assert.deepEqual(await firstPlaylist, [metadataItem("available-1")]);
  assert.deepEqual(await overlappingPlaylist, []);
  assert.deepEqual(await load(["unavailable-1", "available-1"]), [metadataItem("available-1")]);
  assert.equal(calls, 1, "the confirmed unavailable ID is skipped for the rest of this import");
});

test("an unavailable-ID set is discarded when the next import creates its loader", async () => {
  let calls = 0;
  const client = new YouTubeClient("test-key", async () => {
    calls += 1;
    return calls === 1 ? { items: [] } : { items: [metadataItem("later-available")] };
  });

  assert.deepEqual(await client.createMetadataLoader()(["later-available"]), []);
  assert.deepEqual(await client.createMetadataLoader()(["later-available"]), [metadataItem("later-available")]);
  assert.equal(calls, 2, "a later import is allowed to check whether the video became available");
});

test("failed lookups are not mistaken for unavailable IDs and can be retried", async () => {
  let calls = 0;
  const client = new YouTubeClient("test-key", async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("temporary network failure");
    return { items: [metadataItem("retry-video")] };
  });
  const load = client.createMetadataLoader();

  await assert.rejects(load(["retry-video"]), /temporary network failure/);
  assert.deepEqual(await load(["retry-video"]), [metadataItem("retry-video")]);
  assert.equal(calls, 2);
});

test("malformed video records do not confirm that requested IDs are unavailable", async () => {
  let calls = 0;
  const client = new YouTubeClient("test-key", async () => {
    calls += 1;
    return calls === 1 ? { items: [{ snippet: { title: "Missing ID" } }] } : { items: [metadataItem("malformed-video")] };
  });
  const load = client.createMetadataLoader();

  await assert.rejects(load(["malformed-video"]), /invalid video metadata/i);
  assert.deepEqual(await load(["malformed-video"]), [metadataItem("malformed-video")]);
  assert.equal(calls, 2);
});

test("permission, quota, and exhausted server errors do not poison the import cache", async () => {
  for (const failure of [
    new YouTubeApiError("Permission denied", 403, "accessNotConfigured", false),
    new YouTubeApiError("Quota exhausted", 403, "quotaExceeded", false),
    new YouTubeApiError("Server unavailable", 503, "backendError", true)
  ]) {
    let calls = 0;
    const client = new YouTubeClient("test-key", async () => {
      calls += 1;
      if (calls <= (failure.status === 503 ? 3 : 1)) throw failure;
      return { items: [metadataItem("recoverable-video")] };
    });
    const load = client.createMetadataLoader();

    await assert.rejects(load(["recoverable-video"]));
    assert.deepEqual(await load(["recoverable-video"]), [metadataItem("recoverable-video")]);
    assert.equal(calls, failure.status === 503 ? 4 : 2);
  }
});
