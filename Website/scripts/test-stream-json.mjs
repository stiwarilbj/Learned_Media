import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
Module._extensions['.ts'] = (module, filename) => module._compile(compile(readFileSync(filename, 'utf8')), filename);
const { JsonArrayItemStreamParser: Parser } = require('../lib/stream-json.ts');
const { parseStructuredResponse } = require('../lib/structured-response.ts');
const filename = fileURLToPath(new URL('../lib/stream-json.ts', import.meta.url));
const source = readFileSync(filename, 'utf8');
const withoutCompaction = source.replace('    this.compactBuffer();\n', '');
assert.notEqual(withoutCompaction, source);
// A reference with the exact same parsing loop but compaction disabled lets us
// compare both the extracted objects and their delivery on every fragment.
const reference = new Module(filename);
reference.filename = filename;
reference.paths = Module._nodeModulePaths(path.dirname(filename));
reference._compile(compile(withoutCompaction), filename);
const ReferenceParser = reference.exports.JsonArrayItemStreamParser;

function compare(fragments, property = 'facts') {
  const parser = new Parser(property), reference = new ReferenceParser(property), items = [];
  for (const fragment of fragments) {
    const actual = parser.push(fragment);
    assert.deepEqual(actual, reference.push(fragment));
    items.push(...actual);
  }
  return { parser, reference, items };
}
function* chunks(text, size) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}
const prefix = '{"ignored":"' + 'p'.repeat(4300) + '",';
const tail = String.raw`"fa\u0063ts":[{"slot":0,"title":"A } quoted \"title\" \\ 😀 e\u0301","nested":{"values":[{"name":"inner"},[1,2,null]],"flag":true}},{"slot":1,"title":"Second","text":"line\nend"}],"after":{"facts":[{"slot":99}]}}`;
const document = prefix + tail;
const expected = JSON.parse(document).facts;

test('every split around escaped keys, quotations, Unicode and nested arrays preserves emission', () => {
  for (let cut = prefix.length - 10; cut <= document.length; cut++) {
    const { items } = compare([document.slice(0, cut), '', document.slice(cut)]);
    assert.deepEqual(items, expected, `split ${cut}`);
  }
  for (const size of [1, 2, 3, 7, 31, 4095, 4096, 4097]) {
    assert.deepEqual(compare(chunks(document, size)).items, expected);
  }
});

test('compaction shifts live item and string offsets without dropping unfinished text', () => {
  const parser = new Parser('facts');
  const opening = prefix + '"facts":[{"slot":0,"title":"unfinished';
  assert.deepEqual(parser.push(opening), []);
  assert.equal(parser.buffer, '{"slot":0,"title":"unfinished');
  assert.equal(parser.itemStart, 0);
  assert.equal(parser.buffer.slice(parser.stringStart), '"unfinished');
  const rest = ' 😀 ' + 'x'.repeat(9000) + '\\"still text"}]}';
  const result = [];
  for (const fragment of chunks(rest, 13)) result.push(...parser.push(fragment));
  assert.deepEqual(result, JSON.parse(opening + rest).facts);
  assert.equal(parser.buffer, '', 'completed large items release their retained text');

  const key = new Parser('facts');
  assert.deepEqual(key.push(prefix + '"fa\\u00'), []);
  assert.equal(key.buffer, '"fa\\u00', 'an unfinished escaped property name must survive');
  assert.deepEqual(key.push('63ts":[{"slot":7}]}'), [{ slot: 7 }]);
});

test('large streams retain only a small prefix plus the unfinished item', () => {
  const facts = Array.from({ length: 1200 }, (_, slot) => ({ slot, title: 'A specific detail 😀', claim: 'Exact quotation '.repeat(12), nested: { values: [1, { value: slot }] } }));
  const raw = JSON.stringify({ facts });
  const parser = new Parser('facts'), original = new ReferenceParser('facts');
  const result = [];
  let peak = 0;
  for (const fragment of chunks(raw, 127)) {
    const actual = parser.push(fragment);
    assert.deepEqual(actual, original.push(fragment));
    result.push(...actual);
    peak = Math.max(peak, parser.buffer.length);
    assert.ok(parser.buffer.length < 8192);
  }
  assert.deepEqual(result, facts);
  assert.equal(original.buffer.length, raw.length);
  assert.ok(raw.length > 300_000 && peak < 8192);
  console.log(`Parser retained-text check: ${raw.length} source code units; ${peak} peak retained code units.`);
});

test('malformed and truncated items preserve valid siblings and final validation stays authoritative', () => {
  const raw = prefix + '"facts":[{"slot":0,"text":"valid"},null,[{"slot":88}],{"slot":1,"slot":9},{"slot":2,"text":"also valid"},{"slot":3,"text":"unfinished';
  for (const size of [1, 3, 11, 4096]) {
    assert.deepEqual(compare(chunks(raw, size)).items.map(item => item.slot), [0, 2]);
  }
  const schema = { type: 'OBJECT', properties: { facts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { slot: { type: 'INTEGER' }, title: { type: 'STRING' } }, required: ['slot', 'title'] } } }, required: ['facts'] };
  const original = document;
  compare(chunks(document, 1));
  assert.equal(document, original);
  assert.deepEqual(parseStructuredResponse(document, schema).facts.map(item => item.slot), [0, 1]);
  // Streaming can extract a complete item from invalid outer JSON; it must never
  // turn a conflicting root object into an acceptable complete response.
  const conflict = prefix + '"facts":[{"slot":0,"title":"valid"}],"marker":1,"marker":2}';
  assert.deepEqual(compare(chunks(conflict, 5)).items.map(item => item.slot), [0]);
  assert.throws(() => parseStructuredResponse(conflict, schema));
});

test('reset, different array names, empty fragments and non-target objects keep existing behavior', () => {
  const parser = new Parser('facts'), original = new ReferenceParser('facts');
  assert.deepEqual(parser.push(prefix + '"facts":[{"text":"unfinished'), []);
  original.push(prefix + '"facts":[{"text":"unfinished');
  parser.reset(); original.reset();
  for (const fragment of ['','{"facts":', '[{"slot":9}', ']}', '']) assert.deepEqual(parser.push(fragment), original.push(fragment));
  assert.deepEqual(compare(chunks(prefix + '"sentences":[{"value":"A sentence."}]}', 3), 'sentences').items, [{ value: 'A sentence.' }]);
  assert.deepEqual(compare(chunks(prefix + '"other":[{"facts":[{"slot":1}]}],"facts":[]}', 17)).items, []);
});
