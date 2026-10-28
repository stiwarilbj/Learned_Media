import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test, after } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);

const { YouTubeClient } = require(path.join(root, "lib/youtube.ts"));
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
globalThis.window = { location: { href: "https://learned-media.test/" }, setTimeout, clearTimeout };

function channelPayload(id, etag) {
  return {
    ...(etag ? { etag } : {}),
    items: [{ id, snippet: { title: "Fixture Channel", customUrl: "@FixtureChannel" }, contentDetails: { relatedPlaylists: { uploads: `UU${id}` } } }]
  };
}

function jsonResponse(payload, headers = {}) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

function requestRecord(input, init) {
  return { url: new URL(input.toString()), headers: new Headers(init?.headers), cache: init?.cache };
}

test("identical YouTube list requests use ETag and reuse a validated body after 304", async () => {
  const requests = [];
  let response304;
  globalThis.fetch = async (input, init) => {
    requests.push(requestRecord(input, init));
    if (requests.length === 1) return jsonResponse(channelPayload("UCetagFixture", "etag-from-json"));
    response304 = new Response(null, { status: 304 });
    return response304;
  };

  const client = new YouTubeClient("etag-cache-key-one");
  const first = await client.resolveChannel({ name: "Fixture Channel", channelId: "UCetagFixture" });
  const second = await client.resolveChannel({ name: "Fixture Channel", channelId: "UCetagFixture" });
  const third = await client.resolveChannel({ name: "Fixture Channel", channelId: "UCetagFixture" });

  assert.equal(requests.length, 3);
  assert.equal(requests[0].url.toString(), requests[1].url.toString());
  assert.equal(requests[1].url.toString(), requests[2].url.toString());
  assert.equal(requests[0].url.searchParams.get("fields")?.startsWith("etag,"), true);
  assert.equal(requests[0].headers.get("if-none-match"), null);
  assert.equal(requests[1].headers.get("if-none-match"), '"etag-from-json"');
  assert.equal(requests[2].headers.get("if-none-match"), '"etag-from-json"', "a 304 keeps its validated body and validator reusable");
  assert.equal(requests[1].cache, "no-store");
  assert.equal(response304.bodyUsed, false, "the 304 body is not read or parsed");
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});

test("ETag cache identity includes the full query and a credential-specific scope", async () => {
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const request = requestRecord(input, init);
    requests.push(request);
    return jsonResponse(channelPayload(request.url.searchParams.get("id"), `etag-${requests.length}`));
  };

  const keyA = new YouTubeClient("etag-cache-key-query-a");
  const keyB = new YouTubeClient("etag-cache-key-query-b");
  await keyA.resolveChannel({ name: "Fixture Channel", channelId: "UCqueryA" });
  await keyA.resolveChannel({ name: "Fixture Channel", channelId: "UCqueryB" });
  await keyB.resolveChannel({ name: "Fixture Channel", channelId: "UCqueryA" });
  await keyA.resolveChannel({ name: "Fixture Channel", channelId: "UCqueryA" });

  assert.equal(requests.length, 4);
  assert.deepEqual(requests.map(request => request.headers.get("if-none-match")), [null, null, null, '"etag-1"']);
});

test("responses without reusable validators and no-store responses use the ordinary path", async () => {
  const requests = [];
  let responseNumber = 0;
  globalThis.fetch = async (input, init) => {
    requests.push(requestRecord(input, init));
    responseNumber += 1;
    const headers = responseNumber <= 2 ? {} : { etag: '"no-store-etag"', "cache-control": "no-store" };
    const bodyETag = responseNumber <= 2 ? undefined : `etag-${responseNumber}`;
    return jsonResponse(channelPayload("UCnoValidator", bodyETag), headers);
  };

  const client = new YouTubeClient("etag-cache-key-no-validator");
  const seed = { name: "Fixture Channel", channelId: "UCnoValidator" };
  await client.resolveChannel(seed);
  await client.resolveChannel(seed);
  await client.resolveChannel(seed);
  await client.resolveChannel(seed);

  assert.equal(requests.length, 4);
  assert.deepEqual(requests.map(request => request.headers.get("if-none-match")), [null, null, null, null]);
});

test("malformed list responses are not cached for later 304 reuse", async () => {
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push(requestRecord(input, init));
    return requests.length === 1
      ? jsonResponse({ etag: "malformed-response", items: "not-an-array" })
      : jsonResponse(channelPayload("UCmalformedFixture", "valid-response"));
  };

  const client = new YouTubeClient("etag-cache-key-malformed");
  const seed = { name: "Fixture Channel", channelId: "UCmalformedFixture" };
  await assert.rejects(client.resolveChannel(seed));
  const result = await client.resolveChannel(seed);
  assert.equal(result.id, seed.channelId);
  assert.deepEqual(requests.map(request => request.headers.get("if-none-match")), [null, null]);
});

after(() => {
  globalThis.fetch = previousFetch;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
