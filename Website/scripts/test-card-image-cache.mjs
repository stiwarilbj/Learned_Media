import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const Module = require("node:module");
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};
const sourceApi = require("../lib/card-image-cache.ts");
const generatedContext = { console, URL, AbortController, DOMException, setTimeout, clearTimeout };
generatedContext.globalThis = generatedContext;
vm.runInNewContext(readFileSync(new URL("../../App/Resources/frontend/card-image-cache.js", import.meta.url), "utf8"), generatedContext);
const generatedApi = generatedContext.LEARNED_MEDIA_CARD_IMAGE_CACHE;

function bitmap(width = 960, height = 540) {
  return { width, height, closed: false, close() { this.closed = true; } };
}

async function testCache(api, label) {
  let calls = 0;
  let resolveLoad;
  const sharedBitmap = bitmap();
  const cache = new api.DecodedCardImageCache({
    maxEntries: 2,
    maxBytes: 24 * 1024 * 1024,
    loader: () => { calls += 1; return new Promise(resolve => { resolveLoad = resolve; }); }
  });
  cache.setActiveWorkspace("one");
  const first = cache.acquire("one", "https://upload.wikimedia.org/shared.jpg", 960);
  const second = cache.acquire("one", "https://upload.wikimedia.org/shared.jpg", 960);
  assert.equal(calls, 1, `${label}: simultaneous cards share one decode`);
  resolveLoad(sharedBitmap);
  assert.equal(await first.image, await second.image, `${label}: leases share the same decoded bitmap`);
  first.release();
  assert.equal(sharedBitmap.closed, false, `${label}: one retained card keeps the decoded entry alive`);
  second.release();
  const sameWorkspace = cache.acquire("one", "https://upload.wikimedia.org/shared.jpg#credit", 960);
  assert.equal(await sameWorkspace.image, sharedBitmap, `${label}: fragment-only URL changes reuse the effective image`);
  sameWorkspace.release();
  assert.equal(calls, 1, `${label}: completed active-workspace entries are reused`);
  const otherSize = cache.acquire("one", "https://upload.wikimedia.org/shared.jpg", 480);
  const smallerBitmap = bitmap(480, 270);
  // The injected loader resolves on the next call.
  resolveLoad(smallerBitmap);
  assert.equal(await otherSize.image, smallerBitmap, `${label}: decode size is part of the cache key`);
  otherSize.release();
  assert.equal(calls, 2);
  cache.setActiveWorkspace("two");
  assert.equal(sharedBitmap.closed, true, `${label}: inactive workspace entries are released`);
  assert.equal(smallerBitmap.closed, true, `${label}: size variants are released with their workspace`);

  let lruCalls = 0;
  const closed = new Map();
  const lru = new api.DecodedCardImageCache({ maxEntries: 2, loader: async url => {
    lruCalls += 1;
    const image = bitmap();
    closed.set(url, image);
    return image;
  } });
  lru.setActiveWorkspace("ws");
  for (const url of ["https://images.test/a", "https://images.test/b"]) {
    const lease = lru.acquire("ws", url);
    await lease.image;
    lease.release();
  }
  const touchA = lru.acquire("ws", "https://images.test/a");
  await touchA.image;
  touchA.release();
  const c = lru.acquire("ws", "https://images.test/c");
  await c.image;
  c.release();
  assert.equal(closed.get("https://images.test/b").closed, true, `${label}: least-recently-used unleased bitmap is evicted`);
  const keepA = lru.acquire("ws", "https://images.test/a");
  await keepA.image;
  keepA.release();
  assert.equal(lruCalls, 3, `${label}: an image touched before eviction remains cached`);

  const byteLimitedImages = new Map();
  const byteLimited = new api.DecodedCardImageCache({ maxEntries: 8, maxBytes: 16, loader: async url => {
    const image = bitmap(2, 2);
    byteLimitedImages.set(url, image);
    return image;
  } });
  byteLimited.setActiveWorkspace("ws");
  for (const url of ["https://images.test/byte-a", "https://images.test/byte-b"]) {
    const lease = byteLimited.acquire("ws", url, 64);
    await lease.image;
    lease.release();
  }
  assert.equal(byteLimitedImages.get("https://images.test/byte-a").closed, true, `${label}: the decoded-byte budget evicts the oldest entry`);
  assert.equal(byteLimitedImages.get("https://images.test/byte-b").closed, false, `${label}: the most recent entry stays inside the byte budget`);

  let retryCalls = 0;
  const retry = new api.DecodedCardImageCache({ loader: async () => {
    retryCalls += 1;
    if (retryCalls === 1) throw new Error("temporary image decode failure");
    return bitmap();
  } });
  const bad = retry.acquire("ws", "https://images.test/retry");
  await assert.rejects(bad.image, /temporary/);
  bad.release();
  const good = retry.acquire("ws", "https://images.test/retry");
  await good.image;
  good.release();
  assert.equal(retryCalls, 2, `${label}: failures are not cached`);

  let aborted = false;
  let cancelResolve;
  const cancel = new api.DecodedCardImageCache({ loader: (_url, _size, signal) => new Promise((resolve, reject) => {
    cancelResolve = resolve;
    signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("aborted", "AbortError")); }, { once: true });
  }) });
  const subscriberA = cancel.acquire("ws", "https://images.test/cancel");
  const subscriberB = cancel.acquire("ws", "https://images.test/cancel");
  subscriberA.image.catch(() => {});
  subscriberB.image.catch(() => {});
  subscriberA.release();
  assert.equal(aborted, false, `${label}: one subscriber cannot cancel a shared load`);
  subscriberB.release();
  assert.equal(aborted, true, `${label}: the unused pending decode is aborted after its last lease`);
  cancelResolve?.(bitmap());
}

await testCache(sourceApi, "website");
await testCache(generatedApi, "Mac runtime");
console.log("Decoded card image cache lifecycle passed for website and generated Mac runtime.");
