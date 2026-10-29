import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const previousLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

try {
  const cache = require("../lib/card-content-fingerprint.ts");
  const card = { title: "A title", hook: "A hook", body: "A body", answer: "Independent field" };
  const initialContent = cache.cardContentFingerprint(card);
  assert.match(initialContent, /^card-text-v1:[a-f0-9]{16}$/u);
  assert.equal(cache.cardContentFingerprint(card), initialContent);
  card.answer = "Changed independently";
  assert.equal(cache.cardContentFingerprint(card), initialContent, "unrelated card fields do not enter the content fingerprint");

  let calculations = 0;
  const calculateFor = (candidate, policy) => () => { calculations += 1; return `existing-${cache.cardContentFingerprint(candidate)}-${policy}`; };
  const initialToolFingerprint = cache.memoizedCardFingerprint(card, "test-tool", ["policy-v1"], calculateFor(card, "policy-v1"));
  assert.equal(cache.memoizedCardFingerprint(card, "test-tool", ["policy-v1"], calculateFor(card, "policy-v1")), initialToolFingerprint);
  assert.equal(calculations, 1, "an unchanged card reuses the tool fingerprint");

  const serialized = JSON.stringify(card);
  const restored = JSON.parse(serialized);
  assert.equal(cache.cardContentFingerprint(restored), initialContent, "round-trip cards have the same deterministic content identity");
  assert.equal(cache.memoizedCardFingerprint(restored, "test-tool", ["policy-v1"], calculateFor(restored, "policy-v1")), initialToolFingerprint);
  assert.equal(calculations, 2, "the transient cache is not serialized and is rebuilt after restoration");

  restored.hook = "Edited hook";
  const editedHook = cache.cardContentFingerprint(restored);
  assert.notEqual(editedHook, initialContent);
  const editedFingerprint = cache.memoizedCardFingerprint(restored, "test-tool", ["policy-v1"], calculateFor(restored, "policy-v1"));
  assert.notEqual(editedFingerprint, initialToolFingerprint, "text edits invalidate cached tool fingerprints");
  assert.equal(calculations, 3);

  const changedDependency = cache.memoizedCardFingerprint(restored, "test-tool", ["policy-v2"], calculateFor(restored, "policy-v2"));
  assert.notEqual(changedDependency, editedFingerprint, "tool-specific dependencies still invalidate their own fingerprint");
  assert.equal(calculations, 4);

  const nativeScope = {};
  vm.runInNewContext(readFileSync(new URL("../../App/Resources/frontend/card-content-fingerprint.js", import.meta.url), "utf8"), nativeScope);
  const nativeCard = { title: "A title", hook: "A hook", body: "A body" };
  assert.equal(nativeScope.LEARNED_MEDIA_CARD_CONTENT_FINGERPRINT.cardContentFingerprint(nativeCard), initialContent);
  nativeCard.body = "Edited body";
  assert.notEqual(nativeScope.LEARNED_MEDIA_CARD_CONTENT_FINGERPRINT.cardContentFingerprint(nativeCard), initialContent);
} finally {
  if (previousLoader) Module._extensions[".ts"] = previousLoader;
  else delete Module._extensions[".ts"];
}

console.log("Card content fingerprint cache checks passed.");
