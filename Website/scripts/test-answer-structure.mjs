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
const answer = require(path.join(root, "lib/answer-structure.ts"));
const prompts = require(path.join(root, "lib/prompts.ts"));

test("automatic keeps a supported ordered mechanism and derives plain-text history", () => {
  const result = answer.normalizeAnswerResponse({ directAnswer: "The valve opens in sequence.", resolvedStructure: "ordered-steps", steps: ["Pressure rises.", "The latch releases."], citationIndexes: [0] }, "automatic");
  assert.equal(result.structure, "ordered-steps");
  assert.deepEqual(result.presentation.steps, ["Pressure rises.", "The latch releases."]);
  assert.match(result.answer, /1\. Pressure rises\./);
  assert.match(result.answer, /2\. The latch releases\./);
});

test("short explanation overrides More Details and a model-returned table", () => {
  const result = answer.normalizeAnswerResponse({
    directAnswer: "A is faster than B.", resolvedStructure: "side-by-side-comparison", paragraphs: ["The supported test showed the difference."],
    comparisonSubjects: ["A", "B"], comparisonRows: [{ property: "Speed", values: ["Faster", "Slower"] }]
  }, "short-explanation");
  assert.equal(result.structure, "short-explanation");
  assert.equal(result.presentation.paragraphs[0], "The supported test showed the difference.");
  assert.match(result.presentation.fallbackReason, /short explanation/i);
  assert.doesNotMatch(result.answer, /Speed: A/);
});

test("comparison requires exactly two subjects and complete values, otherwise salvages prose", () => {
  const result = answer.normalizeAnswerResponse({
    directAnswer: "The sources support one difference.", resolvedStructure: "side-by-side-comparison",
    comparisonSubjects: ["First", "Second"], comparisonRows: [{ property: "Date", values: ["Earlier"] }]
  }, "side-by-side-comparison");
  assert.equal(result.structure, "short-explanation");
  assert.match(result.answer, /cannot support a balanced comparison/i);
  assert.equal(answer.normalizeSavedAnswerPresentation({ structure: "side-by-side-comparison", directAnswer: "Compare", comparisonSubjects: ["A", "B"], comparisonRows: [{ property: "Result", values: ["Supported", "Not established by the supplied sources"] }] }).comparisonRows.length, 1);
  assert.equal(answer.normalizeSavedAnswerPresentation({ structure: "side-by-side-comparison", directAnswer: "Compare", comparisonSubjects: ["A", "B"], comparisonRows: [{ property: "Result", values: ["Only one"] }] }), undefined);
  const partial = answer.normalizeAnswerResponse({ directAnswer: "The sources establish a difference.", resolvedStructure: "side-by-side-comparison", paragraphs: ["The evidence supports the first point."], comparisonSubjects: ["A", "B"], comparisonRows: [{ property: "Date", values: ["Earlier", "Later"] }, { property: "Outcome", values: ["Only one"] }] }, "side-by-side-comparison");
  assert.equal(partial.structure, "short-explanation");
  assert.equal(partial.presentation.comparisonRows, undefined);
  assert.match(partial.answer, /evidence supports the first point/i);
});

test("malformed optional fields do not discard a readable direct answer", () => {
  const result = answer.normalizeAnswerResponse({ directAnswer: "The answer is supported.", resolvedStructure: "ordered-steps", steps: ["One step"] }, "ordered-steps");
  assert.ok(result);
  assert.equal(result.structure, "short-explanation");
  assert.match(result.answer, /^The answer is supported\./);
  const withoutStructure = answer.normalizeAnswerResponse({ directAnswer: "The valve opens.", paragraphs: ["Pressure releases the latch."] }, "automatic");
  assert.equal(withoutStructure.structure, "short-explanation");
  assert.match(withoutStructure.answer, /Pressure releases/);
});

test("success resets only the exact submitted choice, not a newer selection", () => {
  assert.equal(answer.shouldResetSubmittedAnswerStructure("ordered-steps", "ordered-steps", 4, 4), true);
  assert.equal(answer.shouldResetSubmittedAnswerStructure("side-by-side-comparison", "ordered-steps", 5, 4), false);
  assert.equal(answer.shouldResetSubmittedAnswerStructure("ordered-steps", "ordered-steps", 6, 4), false);
  assert.equal(answer.shouldResetSubmittedAnswerStructure("automatic", "automatic", 0, 0), false);
});

test("structure prompts preserve the question and short mode overrides More Details", () => {
  const short = prompts.buildQuestionPrompt({ card: { body: "Card context" }, question: "How did A compare with B?", detailed: true, structure: "short-explanation", evidence: [] });
  assert.match(short, /Requested answer structure/);
  assert.match(short, /short-explanation/);
  assert.match(short, /same requested properties/);
  assert.doesNotMatch(short, /Prefer 150 to 250 words/);
  const comparison = prompts.buildQuestionPrompt({ card: { body: "Card context" }, question: "What is the difference between A and B?", structure: "side-by-side-comparison", evidence: [] });
  assert.match(comparison, /side-by-side-comparison/);
  assert.match(comparison, /Original user query/);
  const automaticDetailed = prompts.buildQuestionPrompt({ card: {}, question: "How did it work?", detailed: true, structure: "automatic", evidence: [] });
  assert.match(automaticDetailed, /150 to 250 words/);
  assert.doesNotMatch(automaticDetailed, /explicit Short explanation choice, target 2 to 4 sentences/);
  const steps = prompts.buildQuestionPrompt({ card: {}, question: "How did it work?", detailed: true, structure: "ordered-steps", evidence: [] });
  assert.match(steps, /real sequence or mechanism/);
  assert.doesNotMatch(steps, /explicit Short explanation choice, target 2 to 4 sentences/);
});

test("native response normalizer is generated from the same policy source", () => {
  const runtimePath = path.join(root, "../App/Resources/frontend/answer-structure.js");
  // Evaluate in an isolated global so the generated runtime does not pollute this test process.
  const vm = require("node:vm");
  const isolated = { Set, Map, Array, Object, String, Math, Number, Boolean, JSON, Date, RegExp };
  isolated.globalThis = isolated;
  vm.runInNewContext(readFileSync(runtimePath, "utf8"), isolated);
  const native = isolated.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerResponse({ directAnswer: "Direct.", resolvedStructure: "ordered-steps", steps: ["First.", "Second."] }, "automatic");
  assert.deepEqual(JSON.parse(JSON.stringify(native)), JSON.parse(JSON.stringify(answer.normalizeAnswerResponse({ directAnswer: "Direct.", resolvedStructure: "ordered-steps", steps: ["First.", "Second."] }, "automatic"))));
});
