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
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { normalizeSearchText, searchScoreNormalized, tokenizeSearchDocument, tokenizeSearchQuery } = require("../lib/search.ts");

// Reference implementation retained in the test so the bounded version is
// compared against the prior full-matrix behavior, not against itself.
function referenceDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

function referenceTokenScore(queryToken, textToken) {
  if (queryToken === textToken) return 20;
  if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) return 13;
  const limit = queryToken.length >= 8 ? 2 : 1;
  return queryToken.length >= 4 && textToken.length >= 4 && referenceDistance(queryToken, textToken) <= limit ? 7 : 0;
}

function referenceSearchScore(query, text) {
  if (!query || !text) return 0;
  if (text.includes(query)) return 100 + query.length;
  const queryTokens = query.split(" ").filter(token => token.length > 1);
  const textTokens = text.split(" ").filter(Boolean);
  if (!queryTokens.length) return 0;
  let score = 0, matched = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const textToken of textTokens) best = Math.max(best, referenceTokenScore(queryToken, textToken));
    if (best > 0) { matched += 1; score += best; }
  }
  if (!matched) return 0;
  const coverage = matched / queryTokens.length;
  if (coverage < (queryTokens.length > 1 ? 0.5 : 1)) return 0;
  return score * coverage + (matched === queryTokens.length ? 12 : 0);
}

function words(alphabet, maximumLength) {
  const result = [];
  const append = prefix => {
    if (prefix) result.push(prefix);
    if (prefix.length >= maximumLength) return;
    for (const letter of alphabet) append(prefix + letter);
  };
  append("");
  return result;
}

test("bounded fuzzy scoring matches the previous full-distance scorer", () => {
  const generated = words("abc", 5);
  for (const query of generated) {
    for (const text of generated) {
      assert.equal(searchScoreNormalized(query, text), referenceSearchScore(query, text), `${query} vs ${text}`);
      assert.equal(searchScoreNormalized(query, text, tokenizeSearchQuery(query), tokenizeSearchDocument(text)), referenceSearchScore(query, text), `prepared ${query} vs ${text}`);
    }
  }

  const cases = [
    ["science", "sciance"],       // one substitution
    ["science", "sciene"],        // one deletion
    ["science", "scinece"],       // adjacent transposition is two edits
    ["earth", "earht"],           // short word transposition remains outside the one-edit bound
    ["discover", "discvoer"],     // long word transposition fits the two-edit bound
    ["discover", "discxover"],    // insertion away from the prefix
    ["discover", "disover"],      // deletion
    ["discover", "disaster"],     // unrelated word
    ["modern physics", "modren phisics"],
    ["modern physics", "modern history"]
  ];
  for (const [query, text] of cases) {
    assert.equal(searchScoreNormalized(query, text), referenceSearchScore(query, text), `${query} vs ${text}`);
    assert.equal(searchScoreNormalized(query, text, tokenizeSearchQuery(query), tokenizeSearchDocument(text)), referenceSearchScore(query, text), `prepared ${query} vs ${text}`);
  }

  for (const [rawQuery, rawText] of [
    ["astronomy galaxies", "Astronomy, distant galaxies — observed."],
    ["astronomy galaxies", "astronomy astronomy; galaxies galaxies"],
    ["history history", "history, history, literature"],
    ["earth science", "Earth-science facts"]
  ]) {
    const query = normalizeSearchText(rawQuery), text = normalizeSearchText(rawText);
    assert.equal(searchScoreNormalized(query, text), referenceSearchScore(query, text), `${rawQuery} vs ${rawText}`);
    assert.equal(searchScoreNormalized(query, text, tokenizeSearchQuery(query), tokenizeSearchDocument(text)), referenceSearchScore(query, text), `prepared ${rawQuery} vs ${rawText}`);
  }

  const longWord = "a".repeat(2048);
  assert.equal(searchScoreNormalized(longWord, "z".repeat(2048)), 0, "long unrelated words fail quickly with the same score");
  assert.equal(searchScoreNormalized(longWord, "b" + "a".repeat(2047) + "bbb"), 0, "impossible length differences are rejected before matrix setup");
  assert.equal(searchScoreNormalized("a".repeat(2048), "b".repeat(2048) + "a".repeat(2047)),
    referenceSearchScore("a".repeat(2048), "b".repeat(2048) + "a".repeat(2047)));
});
