import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const policy = JSON.parse(read("lib/fact-angle-policy.json"));
const expected = ["varied", "unexpected-mechanism", "unusual-decision", "failed-experiment", "overlooked-detail"];
assert.deepEqual(policy.map((entry) => entry.id), expected, "stable UI and bridge ordering");
assert.equal(new Set(policy.map((entry) => entry.id)).size, 5);
assert.deepEqual(policy.map((entry) => entry.label), ["Varied", "Unexpected mechanism", "Unusual decision", "Failed experiment", "Overlooked detail"]);
for (const entry of policy) {
  assert.ok(entry.description.length > 10, `${entry.id} has a useful control description`);
  if (entry.id !== "varied") {
    assert.ok(entry.instruction.includes("main fact"), `${entry.id} applies to the main fact`);
    assert.ok(entry.instruction.includes("omit the slot"), `${entry.id} leaves unsupported angles unfinished`);
  }
}
assert.match(policy.find((entry) => entry.id === "failed-experiment").instruction, /negative finding/);
assert.match(policy.find((entry) => entry.id === "unusual-decision").instruction, /routine decision/);
assert.match(policy.find((entry) => entry.id === "unexpected-mechanism").instruction, /ordinary explanations/);
assert.match(policy.find((entry) => entry.id === "overlooked-detail").instruction, /Do not claim the detail is unknown/);

const helperSource = read("lib/fact-angle.ts");
const helper = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const helperModule = { exports: {} };
new Function("require", "module", "exports", helper)((name) => {
  assert.equal(name, "./fact-angle-policy.json");
  return policy;
}, helperModule, helperModule.exports);
const angles = helperModule.exports;
assert.equal(angles.normalizeFactAngle(undefined), "varied");
for (const id of expected) {
  assert.equal(angles.isFactAngle(id), true);
  assert.equal(angles.normalizeFactAngle(id), id);
  assert.equal(angles.factAngleDefinition(id).id, id);
}
for (const invalid of [null, "", "3.5 Flash Lite", "Unexpected mechanism", "other", 1, {}]) {
  assert.equal(angles.isFactAngle(invalid), false);
  assert.throws(() => angles.normalizeFactAngle(invalid), RangeError);
}

const gemini = read("lib/gemini.ts");
const route = read("app/api/generate/route.ts");
const page = read("app/page.tsx");
const feed = read("components/learned-media/FeedView.tsx");
const setup = read("components/learned-media/SetupWorkspace.tsx");
const control = read("components/learned-media/FactAngleControl.tsx");
const nativeUI = readFileSync(resolve(root, "../App/Resources/frontend/app.js"), "utf8");
const namedFunctionSource = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
};
assert.match(gemini, /normalizeFactAngle\(requestedFactAngle\)/);
assert.match(namedFunctionSource(gemini, "candidatePrompt"), /context\.angle\.instruction/,
  "candidate generation must use the captured operation angle");
assert.match(namedFunctionSource(gemini, "groundingPrompt"), /rules: \[context\.angle\.instruction\]/,
  "grounding must use the captured operation angle");
assert.match(gemini, /cachedEvidenceForSlots\(context, sessionId, slots/,
  "cached-evidence generation must receive the same captured operation context");
assert.match(gemini, /fact\.status === "angle_unavailable"/);
assert.match(gemini, /Choose a surprising example within the selected fact angle and assigned topic\./);
assert.match(gemini, /"angle_unavailable"/);
assert.match(route, /body\.factAngle !== undefined && !isFactAngle\(body\.factAngle\)/);
assert.match(route, /factAngle: normalizeFactAngle\(body\.factAngle\)/);
assert.match(page, /factAngle: batchAngle/);
assert.match(page, /factAngle=\{activeFactBatch\?\.setup\.factAngle \?\? selectedFactAngle\}/);
assert.match(feed, /Retry missing facts/);
assert.match(feed, /End this batch/);
assert.match(feed, /FactAngleControl value=\{factAngle\} onChange=\{onFactAngleChange\} disabled=\{factAngleLocked\}/);
assert.match(setup, /FactAngleControl value=\{factAngle\} onChange=\{onFactAngleChange\}/);
assert.match(control, /Applies to your next batch, including retries\./);
assert.match(control, /aria-describedby/);
assert.match(page, /activeFactBatchRef\.current\?\.key === "feed" \|\| !current \|\| current\.phase === "queued"/, "Retry must finish an interrupted feed before a queued detour");
assert.match(nativeUI, /function retryFactBatch\(\)\s*\{\s*state\.generationError = "";\s*if \(activeFactBatch && activeFactBatch\.key === "feed"\)/, "Mac retry must preserve the active feed angle while a detour is queued");
assert.match(nativeUI, /onClick: function \(event\) \{ event\.preventDefault\(\); retryFactBatch\(\); \}/);
const retryStart = nativeUI.indexOf("  function retryFactBatch()");
const retryEnd = nativeUI.indexOf("  function startFeed()", retryStart);
const retryFunction = nativeUI.slice(retryStart, retryEnd);
const retryCalls = [];
runInNewContext(retryFunction + "; retryFactBatch();", {
  state: { generationError: "", pendingSlots: 2, topicDetour: { phase: "queued" } },
  activeFactBatch: { key: "feed" }, generationToken: 12,
  generateBatch: (...args) => retryCalls.push(args),
  beginTopicDetourGeneration: () => assert.fail("A queued detour must not replace the feed retry")
});
assert.deepEqual(retryCalls, [[12, 2]], "queued detour retries keep the in-flight feed batch target");

const generatedSwift = readFileSync(resolve(root, "../App/Sources/LearnedMediaCore/FactAngle.swift"), "utf8");
const generatedNativePolicy = readFileSync(resolve(root, "../App/Resources/frontend/fact-angles.js"), "utf8");
const context = readFileSync(resolve(root, "../App/Sources/LearnedMediaCore/GenerationPromptContext.swift"), "utf8");
const bridge = readFileSync(resolve(root, "../App/Sources/LearnedMediaApp/main.swift"), "utf8");
assert.match(generatedSwift, /case failedExperiment = "failed-experiment"/);
assert.match(generatedNativePolicy, /LEARNED_MEDIA_FACT_ANGLES/);
assert.match(context, /public let factAngle: FactAngle/);
assert.match(context, /public var factAngleRule/);
assert.match(nativeUI, /Fact angle/);
assert.match(nativeUI, /Applies to your next batch, including retries\./);
assert.match(nativeUI, /factAngle: setup\.factAngle/);
assert.match(nativeUI, /function endFactBatch\(/);
assert.match(bridge, /if let rawAngle = payload\["factAngle"\]/);
assert.match(bridge, /guard let value = rawAngle as\? String, let parsed = FactAngle\(rawValue: value\)/);
assert.match(bridge, /factAngle: factAngle/);
console.log("Fact-angle policy, validation, prompt propagation, retries, and platform controls passed.");
