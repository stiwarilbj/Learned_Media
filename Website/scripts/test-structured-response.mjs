import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
const Module = require('node:module');
const filename = new URL('../lib/structured-response.ts', import.meta.url);
const source = readFileSync(filename, 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
Module._extensions['.ts'] = (module, filename) => module._compile(compile(readFileSync(filename, 'utf8')), filename);
const { normalizeStructuredValue, parseStructuredResponse } = require('../lib/structured-response.ts');

// Frozen pre-optimization implementation: compare its exact bytes, not a new
// expected ordering that could accidentally change existing deduplication.
function originalStable(value) {
  return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(originalStable(item))]))
    : Array.isArray(value) ? value.map(item => JSON.parse(originalStable(item))) : value);
}
function load(compiled) {
  const counts = { parse: 0, stringify: 0 }, exports = {};
  vm.runInNewContext(compiled, {
    exports, require: createRequire(filename),
    JSON: {
      parse(value) { counts.parse++; return JSON.parse(value); },
      stringify(value) { counts.stringify++; return JSON.stringify(value); }
    }
  });
  return { stable: exports.stable, counts };
}
// Export the private helper only in this isolated test module.
const proposedCode = compile(source + '\nexport { stable };');
const proposed = load(proposedCode).stable;
const fixtures = [
  null, true, false, 0, -0, 1.25, 1e-7, 1e30, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity,
  '', 'A quoted "value", \\ path, \n line, \uFEFF and 😀 e\u0301', '\ud800',
  [], {}, [1, null, false, '1', [2, 1]],
  { z: [{ b: true, a: null }, [3, { z: 'last', a: 'first' }]], a: { value: -0 } },
  JSON.parse('{"10":"ten","2":"two","01":"leading","a":{"constructor":"safe","__proto__":{"z":1,"a":2}}}'),
  JSON.parse('{"É":{"é":1,"e\\u0301":2,"E":3},"😀":{"Z":0,"a":1},"é":4,"e\\u0301":5}')
];

test('comparison bytes match the original for nested objects, arrays, keys and primitives', () => {
  for (const value of fixtures) {
    assert.deepEqual(Buffer.from(proposed(value)), Buffer.from(originalStable(value)));
  }
});

test('comparison bytes match across 1,000 deterministic nested JSON values', () => {
  let seed = 421;
  const random = limit => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  function value(depth) {
    if (!depth || random(3) === 0) return fixtures[random(15)];
    if (random(3) === 0) return Array.from({ length: random(5) }, () => value(depth - 1));
    return Object.fromEntries(Array.from({ length: random(6) }, () => [['z', 'a', '10', '02', '__proto__', '😀', 'é'][random(7)], value(depth - 1)]));
  }
  for (let index = 0; index < 1000; index++) {
    const input = value(5);
    assert.deepEqual(Buffer.from(proposed(input)), Buffer.from(originalStable(input)), `case ${index}`);
  }
});

test('ordered trees leave the original objects and their insertion order untouched', () => {
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  for (const input of fixtures) {
    const before = JSON.stringify(input);
    proposed(freeze(input));
    assert.equal(JSON.stringify(input), before);
  }
});

test('a nested comparison uses one serialization and no parsing', () => {
  const before = load(`exports.stable = ${originalStable.toString()};`), after = load(proposedCode);
  const input = { z: [{ b: true, a: null }, [3, { z: 'last', a: 'first' }]], a: { value: -0 } };
  assert.equal(after.stable(input), before.stable(input));
  assert.deepEqual(after.counts, { parse: 0, stringify: 1 });
  assert.ok(before.counts.parse > 1 && before.counts.stringify > 1);
  console.log(`Nested comparison JSON calls: parse ${before.counts.parse} → 0; stringify ${before.counts.stringify} → 1.`);
});

test('set-like fields retain the last equivalent item and preserve distinct arrays and types', () => {
  const first = { z: [1, { b: false, a: null }], a: { quantity: 12, unit: 'km' } };
  const equivalent = { a: { unit: 'km', quantity: 12 }, z: [1, { a: null, b: false }] };
  const differentOrder = { ...first, z: [{ a: null, b: false }, 1] };
  const differentType = { ...first, a: { quantity: '12', unit: 'km' } };
  const items = [first, differentOrder, equivalent, differentType];
  const expected = Array.from(new Map(items.map(item => [originalStable(item), item])).values());
  for (const field of ['facts', 'evidence', 'evidenceIds', 'claimEvidenceIds', 'terms', 'include', 'alternatives', 'topics', 'related', 'equivalents', 'wikipediaSearchTitles']) {
    const result = normalizeStructuredValue(items, { type: 'ARRAY', items: {} }, field);
    assert.deepEqual(result, expected, field);
    assert.equal(result[0], equivalent, `${field} retains the last equivalent item`);
  }
  assert.deepEqual(normalizeStructuredValue(items, { type: 'ARRAY', items: {} }, 'sentences'), items, 'non-set arrays retain all items');
});

test('structured normalization still salvages valid siblings without merging conflicting slots', () => {
  const item = { type: 'OBJECT', properties: { slot: { type: 'INTEGER' }, claim: { type: 'STRING' }, detail: {} }, required: ['slot', 'claim'] };
  const schema = { type: 'OBJECT', properties: { facts: { type: 'ARRAY', items: item } } };
  const raw = '{"facts":[{"slot":0,"claim":"A","detail":{"b":[1,2],"a":null}},{"slot":2},{"detail":{"a":null,"b":[1,2]},"claim":"A","slot":0},{"slot":0,"claim":"Different"},{"slot":3,"claim":"Valid"}]}';
  const expected = [{ slot: 0, claim: 'A', detail: { a: null, b: [1, 2] } }, { slot: 0, claim: 'Different' }, { slot: 3, claim: 'Valid' }];
  assert.deepEqual(parseStructuredResponse(raw, schema).facts, expected);
  assert.deepEqual(parseStructuredResponse(raw.slice(0, -2) + ',{"slot":4,"claim":"unfinished', schema).facts, expected);
});
