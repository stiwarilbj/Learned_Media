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
const fixtures = JSON.parse(readFileSync(path.join(root, "scripts/fixtures/question-instruction-overrides.json"), "utf8"));

test("shared question-instruction fixtures resolve as specified", () => {
  for (const fixture of fixtures) {
    const actual = answer.resolveQuestionInstructions(fixture.question, fixture.detailed, fixture.structure, fixture.preference);
    assert.equal(actual.conflict, fixture.expected.conflict, fixture.name);
    assert.equal(actual.conflictLabel, fixture.expected.conflictLabel, fixture.name);
    assert.equal(actual.effectiveDetailed, fixture.expected.effectiveDetailed, fixture.name);
    assert.equal(actual.effectiveStructure, fixture.expected.effectiveStructure, fixture.name);
    assert.equal(actual.questionForPrompt, fixture.expected.questionForPrompt, fixture.name);
    assert.deepEqual(actual.directive ?? null, fixture.expected.directive, fixture.name);
  }
});

test("the written length override replaces the detail range and constrains the full answer text", () => {
  const prompt = prompts.buildQuestionPrompt({ card: { body: "Card context" }, question: fixtures[0].question, detailed: true, structure: "automatic", evidence: [] });
  assert.match(prompt, /Original user query: Why does the sky appear blue\?/);
  assert.match(prompt, /Requested answer structure: short-explanation/);
  assert.match(prompt, /Write exactly 1 complete sentence in the entire answer text/);
  assert.match(prompt, /citation metadata and controls do not count/);
  assert.doesNotMatch(prompt, /Prefer 150 to 250 words/);
  assert.doesNotMatch(prompt, /Prefer 2 to 4 sentences/);
});

test("normal-settings preference removes the suppressed format from the operative prompt", () => {
  const fixture = fixtures.find(item => item.name === "normal settings suppress a conflicting length");
  assert.ok(fixture);
  const prompt = prompts.buildQuestionPrompt({ card: {}, question: fixture.question, detailed: true, structure: "automatic", instructionPreference: "settings", evidence: [] });
  assert.match(prompt, /Original user query: Explain this result\./);
  assert.match(prompt, /150 to 250 words/);
  assert.doesNotMatch(prompt, /at most 100 words|100 words/);
  assert.doesNotMatch(prompt, /Write no more than 100 words/);
});

test("instruction-only drafts and supported boundaries stay conservative", () => {
  assert.equal(answer.resolveQuestionInstructions("Answer in 1 sentence", true, "automatic").conflict, false);
  assert.equal(answer.resolveQuestionInstructions("Answer in 10 sentences: Why?", false, "automatic").directive?.length?.count, 10);
  assert.equal(answer.resolveQuestionInstructions("Answer in 11 sentences: Why?", false, "automatic").directive, undefined);
  assert.equal(answer.resolveQuestionInstructions("Answer with a maximum of 500 words: Why?", true, "automatic").directive?.length?.count, 500);
  assert.equal(answer.resolveQuestionInstructions("Answer with a maximum of 501 words: Why?", true, "automatic").directive, undefined);
});
