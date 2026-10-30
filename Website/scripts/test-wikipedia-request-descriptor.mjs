import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

globalThis.window = {};
const boundedResponse = require("../lib/bounded-response.ts");
const providerDiagnostics = require("../lib/provider-schema-diagnostics.ts");
const originalReadLimitedResponseText = boundedResponse.readLimitedResponseText;
const originalRecordProviderSchemaFailure = providerDiagnostics.recordProviderSchemaFailure;
const originalFetch = globalThis.fetch;
const observedLimits = [];
const observedSchemas = [];
boundedResponse.readLimitedResponseText = async (response, maximumBytes, endpoint) => {
  observedLimits.push({ maximumBytes, endpoint });
  return { text: response.bodyText, bytesRead: new TextEncoder().encode(response.bodyText).byteLength };
};
providerDiagnostics.recordProviderSchemaFailure = (schema, payload, rootOverride) => {
  observedSchemas.push(schema);
  return originalRecordProviderSchemaFailure(schema, payload, rootOverride);
};
const wikipedia = require("../lib/wikipedia.ts");

function response(payload, status = 200, { retryAfter, url = "https://en.wikipedia.org/w/api.php", redirected = false } = {}) {
  const bodyText = JSON.stringify(payload);
  const headers = new Headers({ "content-type": "application/json", "content-length": String(new TextEncoder().encode(bodyText).byteLength) });
  if (retryAfter) headers.set("retry-after", retryAfter);
  return { ok: status >= 200 && status < 300, status, headers, url, redirected, bodyText };
}

function apiPage(title, extra = {}) {
  return { query: { pages: { "1": { title, fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, extract: `A verified extract for ${title}.`, ...extra } } } };
}

after(() => {
  boundedResponse.readLimitedResponseText = originalReadLimitedResponseText;
  providerDiagnostics.recordProviderSchemaFailure = originalRecordProviderSchemaFailure;
  globalThis.fetch = originalFetch;
  delete globalThis.window;
});

test("search, article, image, coordinate, and summary URLs keep their size limits and schema diagnostics", async () => {
  observedLimits.length = 0;
  observedSchemas.length = 0;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    calls.push(url);
    if (url.pathname.startsWith("/api/rest_v1/page/summary/")) return response({ unexpected: true });
    if (url.searchParams.get("list") === "search") return response({ unexpected: true });
    const title = url.searchParams.get("titles");
    const prop = url.searchParams.get("prop") ?? "";
    if (prop.includes("imageinfo")) return response({ unexpected: true });
    if (prop.includes("coordinates")) return response({ unexpected: true });
    if (title === "Article") return response({ unexpected: true });
    if (title === "Image Page") return response(apiPage(title, {
      pageimage: "Diagram.jpg",
      thumbnail: { source: "https://upload.wikimedia.org/example/diagram.jpg" }
    }));
    if (title === "Summary Page") return response(apiPage(title));
    throw new Error(`Unexpected Wikipedia request: ${url}`);
  };

  assert.deepEqual(await wikipedia.searchWikipedia("query"), []);
  assert.equal(await wikipedia.resolveWikipediaArticle("Article", undefined, wikipedia.createWikipediaResolutionCache()), undefined);
  const imageSources = await wikipedia.resolveWikipediaSources(["Image Page"], 1, undefined, {
    includeImages: true,
    cache: wikipedia.createWikipediaResolutionCache()
  });
  assert.equal(imageSources.length, 1);
  assert.equal(imageSources[0].image?.url, "https://upload.wikimedia.org/example/diagram.jpg", "an invalid image-info payload keeps the existing thumbnail fallback");
  assert.deepEqual(await wikipedia.resolveWikipediaCoordinates(["Coordinates"], undefined, wikipedia.createWikipediaResolutionCache()), []);
  const summarySources = await wikipedia.resolveWikipediaSources(["Summary Page"], 1, undefined, {
    includeImages: true,
    cache: wikipedia.createWikipediaResolutionCache()
  });
  assert.equal(summarySources.length, 1);
  assert.equal(summarySources[0].image, undefined, "an invalid summary payload remains an unavailable image fallback");

  const mib = 1024 * 1024;
  assert.deepEqual(observedLimits.map(({ maximumBytes }) => maximumBytes), [2 * mib, 32 * mib, 32 * mib, 8 * mib, 4 * mib, 32 * mib, 4 * mib]);
  assert.ok(observedLimits.every(({ endpoint }) => endpoint === "Wikipedia"));
  assert.deepEqual(observedSchemas, ["wikipedia.search", "wikipedia.pages", "wikipedia.images", "wikipedia.pages", "wikipedia.summary"]);
  assert.deepEqual(calls.map((url) => url.pathname), [
    "/w/api.php", "/w/api.php", "/w/api.php", "/w/api.php", "/w/api.php", "/w/api.php", "/api/rest_v1/page/summary/Summary_Page"
  ]);
});

test("all Wikipedia request kinds use one bounded queue with existing priority ordering", async () => {
  const starts = [];
  const releases = new Map();
  let active = 0;
  let maximumActive = 0;
  globalThis.fetch = (input) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const key = url.searchParams.get("srsearch") ?? url.searchParams.get("titles");
    starts.push({ key, url });
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    return new Promise((resolve) => {
      releases.set(key, () => {
        active -= 1;
        const payload = url.searchParams.has("list")
          ? { query: { search: [{ title: key }] } }
          : apiPage(key);
        resolve(response(payload));
      });
    });
  };

  const initial = Array.from({ length: 4 }, (_, index) => wikipedia.searchWikipedia(`active-${index}`));
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 2_000;
    while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.ok(predicate(), "timed out waiting for a queued Wikipedia fetch");
  };
  await waitFor(() => starts.length === 4);
  const lowerPriority = wikipedia.resolveWikipediaArticle("queued article", undefined, wikipedia.createWikipediaResolutionCache());
  const ordinaryPriority = wikipedia.searchWikipedia("queued search");

  releases.get("active-0")();
  releases.delete("active-0");
  await waitFor(() => starts.length === 5);
  assert.equal(starts[4].key, "queued search", "the priority-zero search remains ahead of the queued article request");
  releases.get("active-1")();
  releases.delete("active-1");
  await waitFor(() => starts.length === 6);
  assert.equal(starts[5].key, "queued article", "the article proceeds as soon as capacity is available");

  for (const key of ["active-2", "active-3", "queued search", "queued article"]) {
    releases.get(key)?.();
    releases.delete(key);
  }
  await Promise.all([...initial, lowerPriority, ordinaryPriority]);
  assert.equal(maximumActive, 4, "the existing four-request ceiling is unchanged");
  assert.equal(active, 0);
});

test("Retry-After after a redirect cools down only the response origin", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) return response({ error: { code: "ratelimited" } }, 503, {
      retryAfter: "2",
      url: "https://redirected-origin.example/w/api.php",
      redirected: true
    });
    return response({ query: { search: [{ title: "Available" }] } });
  };

  assert.deepEqual(await wikipedia.searchWikipedia("redirected request"), []);
  const controller = new AbortController();
  const next = wikipedia.searchWikipedia("original origin remains available", 3, controller.signal).then(() => true, () => false);
  const completed = await Promise.race([next, new Promise((resolve) => setTimeout(() => resolve(false), 100))]);
  if (!completed) controller.abort();
  assert.equal(completed, true, "a redirect cooldown does not delay later requests to the original API origin");
  assert.equal(requestCount, 2);
});
