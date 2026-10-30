import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const oldTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { readEventStream } = require("../lib/gemini.ts");
const encoder = new TextEncoder();

function event(text) {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], modelVersion: "gemini-test" })}\n\n`;
}

function streamResponse({ chunks, close = false, cancelError, cancelPromise, onStart } = {}) {
  let canceled = false;
  const body = new ReadableStream({
    start(value) {
      onStart?.(value);
      for (const chunk of chunks ?? []) value.enqueue(encoder.encode(chunk));
      if (close) value.close();
    },
    cancel() {
      canceled = true;
      if (cancelError) throw cancelError;
      return cancelPromise;
    }
  });
  return {
    response: new Response(body, { status: 200 }),
    body,
    wasCanceled: () => canceled
  };
}

test("malformed streamed JSON cancels unread bytes and releases the reader lock", async () => {
  const fixture = streamResponse({ chunks: ["data: {broken-json\n\n"] });
  await assert.rejects(readEventStream(fixture.response), /malformed streamed output/i);
  assert.equal(fixture.wasCanceled(), true);
  assert.equal(fixture.body.locked, false);
});

test("a throwing text callback cancels the remainder and preserves its error", async () => {
  const fixture = streamResponse({ chunks: [event("partial"), event("unread")] });
  const callbackError = new Error("consumer stopped parsing");
  await assert.rejects(readEventStream(fixture.response, () => { throw callbackError; }), error => error === callbackError);
  assert.equal(fixture.wasCanceled(), true);
  assert.equal(fixture.body.locked, false);
});

test("cleanup failure does not replace a malformed-event error", async () => {
  const fixture = streamResponse({ chunks: ["data: {broken-json\n\n"], cancelError: new Error("cancel failed") });
  await assert.rejects(readEventStream(fixture.response), /malformed streamed output/i);
  assert.equal(fixture.wasCanceled(), true);
  assert.equal(fixture.body.locked, false);
});

test("a stalled cancellation does not delay lock release or the original error", async () => {
  const fixture = streamResponse({ chunks: ["data: {broken-json\n\n"], cancelPromise: new Promise(() => {}) });
  await assert.rejects(readEventStream(fixture.response), /malformed streamed output/i);
  assert.equal(fixture.wasCanceled(), true);
  assert.equal(fixture.body.locked, false);
});

test("a canceled stream releases its lock and retains the read error", async () => {
  const abortError = new DOMException("The operation was aborted.", "AbortError");
  const fixture = streamResponse({ chunks: [event("first")], onStart: controller => {
    queueMicrotask(() => controller.error(abortError));
  } });
  await assert.rejects(readEventStream(fixture.response), error => error === abortError);
  assert.equal(fixture.body.locked, false);
});

test("normal completion keeps the streamed text and releases the lock without cancellation", async () => {
  const fixture = streamResponse({ chunks: [event("hello "), event("world")], close: true });
  const result = await readEventStream(fixture.response);
  assert.equal(result.text, "hello world");
  assert.equal(result.resolvedModel, "gemini-test");
  assert.equal(fixture.wasCanceled(), false);
  assert.equal(fixture.body.locked, false);
});

Module._extensions[".ts"] = oldTsLoader;
