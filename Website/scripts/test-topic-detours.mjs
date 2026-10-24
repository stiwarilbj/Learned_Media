import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');
Module._extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
};
const { createTopicDetour, missingTopicDetourSlots, acceptTopicDetourCard, orderTopicDetourCards, markTopicDetourProgress } = require('../lib/topic-detours.ts');

const detour = createTopicDetour('workspace-a', 'source', ['Science', 'Geology', 'Earthquakes'], 'request-a');
assert.deepEqual(missingTopicDetourSlots(detour), [0, 1, 2]);
const first = acceptTopicDetourCard(detour, 0, 'first');
assert.deepEqual(missingTopicDetourSlots(first), [1, 2]);
assert.equal(acceptTopicDetourCard(first, 0, 'replacement'), first, 'a retry cannot overwrite an accepted slot');
assert.equal(acceptTopicDetourCard(first, 1, 'first'), first, 'one accepted card cannot fill two slots');
const second = acceptTopicDetourCard(first, 1, 'second');
const complete = acceptTopicDetourCard(second, 2, 'third');
assert.equal(complete.phase, 'reading');
const cards = [{ id: 'before' }, { id: 'source' }, { id: 'after' }, { id: 'first' }, { id: 'second' }];
assert.deepEqual(orderTopicDetourCards(cards, complete, { id: 'third' }).map(card => card.id), ['before', 'source', 'first', 'second', 'third', 'after']);
const readFirst = markTopicDetourProgress(complete, 'second', 'visible');
assert.equal(readFirst.detour.furthestReached, 1);
assert.equal(readFirst.completed, false);
const backward = markTopicDetourProgress(readFirst.detour, 'first', 'visible');
assert.equal(backward.detour.furthestReached, 1);
assert.equal(backward.completed, false);
assert.equal(markTopicDetourProgress(backward.detour, 'third', 'bottom').completed, true);
assert.equal(markTopicDetourProgress(backward.detour, 'third', 'passed').completed, true);
assert.equal(markTopicDetourProgress(backward.detour, 'third', 'focus').completed, false, 'focus advances progress without ending before the bottom is reached');
assert.equal(markTopicDetourProgress(complete, 'source', 'bottom').completed, false);
const replaced = createTopicDetour('workspace-b', 'other-source', ['History'], 'request-b');
assert.deepEqual(replaced.slotCardIds, [null, null, null]);
console.log('Topic detour state and ordering checks passed.');
