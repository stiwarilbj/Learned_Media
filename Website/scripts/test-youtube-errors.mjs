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
const retryWaits = [];
retry.waitForBackgroundRetry = async (milliseconds, signal) => {
  signal?.throwIfAborted();
  retryWaits.push(milliseconds);
};

const { YouTubeApiError, YouTubeClient } = require(path.join(root, "lib/youtube.ts"));
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
globalThis.window = { location: { href: "https://learned-media.test/" }, setTimeout, clearTimeout };

function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", ...headers }
  });
}

async function captureChannelError(responseForAttempt) {
  let calls = 0;
  globalThis.fetch = async () => responseForAttempt(calls++);
  const client = new YouTubeClient("test-key");
  try {
    await client.resolveChannel({ name: "Fixture Channel", channelId: "UCfixture" });
    assert.fail("Expected the YouTube request to fail.");
  } catch (error) {
    assert.ok(error instanceof YouTubeApiError || error instanceof DOMException, `Unexpected error: ${error}`);
    return { error, calls };
  }
}

test("bounded non-2xx parsing preserves permission and quota classifications", async () => {
  retryWaits.length = 0;
  const permission = await captureChannelError(() => jsonResponse(403, {
    error: { code: 403, message: "The YouTube Data API is not enabled for this project.", errors: [{ reason: "accessNotConfigured" }] }
  }));
  assert.equal(permission.calls, 1);
  assert.equal(permission.error.status, 403);
  assert.equal(permission.error.reason, "accessNotConfigured");
  assert.match(permission.error.message, /API is not enabled/);
  assert.equal(permission.error.retryable, false);

  const quota = await captureChannelError(() => jsonResponse(403, {
    error: { code: 403, message: "Daily quota exceeded.", errors: [{ reason: "quotaExceeded" }] }
  }));
  assert.equal(quota.calls, 1);
  assert.equal(quota.error.status, 403);
  assert.equal(quota.error.reason, "quotaExceeded");
  assert.match(quota.error.message, /quota is exhausted/i);
  assert.equal(quota.error.retryable, false);
});

test("usual rate-limit and transient JSON errors remain retryable with their retry deadline", async () => {
  retryWaits.length = 0;
  const rateLimit = await captureChannelError(() => jsonResponse(403, {
    error: { code: 403, message: "User rate limit exceeded.", errors: [{ reason: "userRateLimitExceeded" }] }
  }, { "retry-after": "0" }));
  assert.equal(rateLimit.calls, 3, "the existing request policy makes its same three bounded attempts");
  assert.equal(rateLimit.error.status, 403);
  assert.equal(rateLimit.error.reason, "userRateLimitExceeded");
  assert.equal(rateLimit.error.retryable, true);
  assert.equal(retryWaits.length, 2);
  assert.ok(rateLimit.error.retryDeadline !== undefined);

  retryWaits.length = 0;
  const transient = await captureChannelError(() => jsonResponse(503, {
    error: { code: 503, message: "Backend temporarily unavailable.", errors: [{ reason: "backendError" }] }
  }, { "retry-after": "0" }));
  assert.equal(transient.calls, 3);
  assert.equal(transient.error.status, 503);
  assert.equal(transient.error.reason, "backendError");
  assert.equal(transient.error.message, "Backend temporarily unavailable.");
  assert.equal(transient.error.retryable, true);
});

test("HTML proxy failures are canceled without attempting success-JSON parsing", async () => {
  retryWaits.length = 0;
  let pulls = 0;
  let cancellations = 0;
  const result = await captureChannelError(() => new Response(new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new TextEncoder().encode("<!doctype html><title>Proxy error</title>"));
      controller.close();
    },
    cancel() { cancellations += 1; }
  }, { highWaterMark: 0 }), { status: 502, headers: { "content-type": "text/html", "retry-after": "0" } }));
  assert.equal(result.calls, 3);
  assert.equal(result.error.status, 502);
  assert.equal(result.error.retryable, true);
  assert.match(result.error.message, /HTTP 502/);
  assert.equal(pulls, 0, "known HTML proxy pages are not read as JSON");
  assert.equal(cancellations, 3, "each discarded response body is canceled");
});

test("error bodies with an oversized declared or streamed length fall back to HTTP status", async () => {
  retryWaits.length = 0;
  let declaredBodyCanceled = false;
  const declared = await captureChannelError(() => new Response(new ReadableStream({ cancel() { declaredBodyCanceled = true; } }), {
    status: 403,
    headers: { "content-type": "application/json", "content-length": "1000000" }
  }));
  assert.equal(declared.calls, 1);
  assert.equal(declared.error.status, 403);
  assert.equal(declared.error.reason, undefined);
  assert.equal(declared.error.retryable, false);
  assert.equal(declaredBodyCanceled, true, "the declared oversized response is canceled before reading");

  retryWaits.length = 0;
  let streamedBodyCanceled = false;
  let bytesProduced = 0;
  const streamed = await captureChannelError(() => new Response(new ReadableStream({
    pull(controller) {
      const chunk = new Uint8Array(16 * 1024).fill(65);
      bytesProduced += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { streamedBodyCanceled = true; }
  }), { status: 403, headers: { "content-type": "application/json" } }));
  assert.equal(streamed.calls, 1);
  assert.equal(streamed.error.status, 403);
  assert.equal(streamed.error.reason, undefined);
  assert.equal(streamed.error.retryable, false);
  assert.equal(streamedBodyCanceled, true, "streamed error text is canceled at the body limit");
  assert.ok(bytesProduced <= 6 * 16 * 1024, "the streamed reader stops near the 64 KiB ceiling");
});

test("successful responses keep the existing JSON parsing and channel validation path", async () => {
  globalThis.fetch = async () => jsonResponse(200, {
    items: [{
      id: "UCfixture",
      snippet: { title: "Fixture Channel", customUrl: "@FixtureChannel", thumbnails: { default: { url: "https://img.test/channel.jpg" } } },
      contentDetails: { relatedPlaylists: { uploads: "UUfixture" } }
    }]
  });
  const channel = await new YouTubeClient("test-key").resolveChannel({ name: "Fixture Channel", channelId: "UCfixture" });
  assert.equal(channel.id, "UCfixture");
  assert.equal(channel.name, "Fixture Channel");
  assert.equal(channel.uploadsPlaylistId, "UUfixture");
  assert.equal(channel.handle, "@FixtureChannel");
});

test.after(() => {
  globalThis.fetch = previousFetch;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});
