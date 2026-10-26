import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

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

const {
  monotonicDeadlineAfter,
  monotonicDeadlineFromWallTime,
  remainingMonotonicMs,
  transientRetryDelayMs
} = require("../lib/retry-timing.ts");
const { backgroundRetryDelay, serverRetryAt, serverRetryDeadline } = require("../lib/background-retry.ts");

test("server wall deadlines convert once to monotonic retry deadlines", () => {
  const deadline = monotonicDeadlineFromWallTime(12_000, 10_000, 450);
  assert.equal(deadline, 2_450);
  assert.equal(remainingMonotonicMs(deadline, 1_200), 1_250);
  assert.equal(remainingMonotonicMs(deadline, 2_500), 0);

  // Once converted, subsequent wall-clock adjustments are not inputs to elapsed-time checks.
  const serverDeadline = serverRetryDeadline("2", 10_000, 450);
  assert.equal(serverDeadline, 2_450);
  assert.equal(serverRetryDeadline("Thu, 01 Jan 1970 00:00:12 GMT", 10_000, 450), 2_450);
  assert.equal(serverRetryAt("2", 10_000), 12_000, "the parser retains its wall-clock representation for callers that need it");
});

test("background delay and stepped backoff preserve their existing minimums", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    assert.equal(backgroundRetryDelay(500, 5_000, 1_000), 4_000);
    assert.equal(backgroundRetryDelay(2_000, 1_000, 1_000), 2_000);
    assert.equal(transientRetryDelayMs(1), 2_000);
    assert.equal(transientRetryDelayMs(2), 4_000);
    assert.equal(transientRetryDelayMs(3), 8_000);
  } finally {
    Math.random = originalRandom;
  }
});

test("relative wait deadlines use the monotonic clock", () => {
  assert.equal(monotonicDeadlineAfter(750, 100), 850);
  assert.equal(remainingMonotonicMs(850, 700), 150);
  assert.equal(remainingMonotonicMs(850, 900), 0);
});
