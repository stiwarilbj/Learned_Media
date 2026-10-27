import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
Module._extensions['.ts'] = (module, filename) => module._compile(compile(readFileSync(filename, 'utf8')), filename);
const { rejectConflictingJsonFields: check } = require('../lib/json-duplicates.ts');
const { parseStructuredResponse } = require('../lib/structured-response.ts');
const { JsonArrayItemStreamParser } = require('../lib/stream-json.ts');
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/json-duplicates.json', import.meta.url), 'utf8'));

for (const { name, input, output = input } of fixtures) {
  test(name, () => assert.equal(check(input), output));
}

function instrumentedCheck() {
  const parses = [], stringifies = [], exports = {};
  vm.runInNewContext(compile(readFileSync(new URL('../lib/json-duplicates.ts', import.meta.url), 'utf8')), {
    exports,
    JSON: {
      parse(value) { parses.push(value); return JSON.parse(value); },
      stringify(value) { stringifies.push(value); return JSON.stringify(value); }
    }
  });
  return { check: exports.rejectConflictingJsonFields, parses, stringifies };
}

test('unique fields parse only property names, including nested and large values', () => {
  const { check, parses, stringifies } = instrumentedCheck();
  const facts = Array.from({ length: 100 }, (_, slot) => ({ slot, title: 'Exact quotation '.repeat(30), evidence: [{ id: `e${slot}`, section: 'A section' }], optional: null }));
  const input = JSON.stringify({ facts });
  assert.equal(check(input), input);
  const keys = new Set(['facts', 'slot', 'title', 'evidence', 'id', 'section', 'optional']);
  assert.equal(parses.length, 601);
  assert.ok(parses.every(value => keys.has(JSON.parse(value))));
  assert.deepEqual(stringifies, [], 'unique fields do not invoke canonical serialization');
});

test('a repeated field compares both values once, then reuses the prepared previous value', () => {
  const { check, parses } = instrumentedCheck();
  const value = '{"a":[1,2]}';
  const input = `{"value":${value},"other":42,"value":${value},"value":${value},"unrelated":{"b":99}}`;
  assert.equal(check(input), input);
  assert.deepEqual(parses.filter(text => !text.trim().startsWith('"')), [value, value, value]);
});

test('conflicting first, middle and last cards preserve siblings in complete and streamed recovery', () => {
  const schema = { type: 'OBJECT', properties: { facts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { slot: { type: 'INTEGER' }, claim: { type: 'STRING' } }, required: ['slot', 'claim'] } } } };
  for (const badSlot of [0, 3, 6]) {
    const items = Array.from({ length: 7 }, (_, slot) => slot === badSlot
      ? `{"slot":${slot},"claim":"Bad","claim":"Conflicting"}`
      : JSON.stringify({ slot, claim: `Exact supported fact ${slot} 😀` }));
    const raw = '{"facts":[' + items.join(',') + ']}';
    const expected = items.filter((_, slot) => slot !== badSlot).map(item => JSON.parse(item));
    assert.deepEqual(parseStructuredResponse(raw, schema).facts, expected);
    assert.deepEqual(parseStructuredResponse(raw.slice(0, -2) + ',{"slot":9,"claim":"unfinished', schema).facts, expected);
    for (const size of [1, 3, 37]) {
      const parser = new JsonArrayItemStreamParser('facts'), streamed = [];
      for (let i = 0; i < raw.length; i += size) streamed.push(...parser.push(raw.slice(i, i + size)));
      assert.deepEqual(streamed, expected);
    }
  }
});
