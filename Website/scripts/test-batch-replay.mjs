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
const replay = require('../lib/batch-replay.ts');
const cloudRecords = require('../lib/cloud-records.ts');

const settings = { obscurity: 8, sentenceLength: 4, displayMode: 'picture-text', surpriseMe: true };
const source = replay.createBatchSetup({
  id: 'source',
  slots: [
    { topicPath: ['Science', 'Physics', 'Optics'], difficulty: 7 },
    { topicPath: ['History', 'France', 'French Revolution'], difficulty: 9 },
    { topicPath: ['Science', 'Physics', 'Optics'], difficulty: 8 }
  ],
  settings,
  factAngle: 'unexpected-mechanism',
  rabbitHole: 'why a blue sky scatters light'
});
assert.equal(replay.isBatchSetup(source), true);
assert.deepEqual(source.slots.map(slot => slot.id), ['source:0', 'source:1', 'source:2']);
assert.deepEqual(replay.missingBatchSetupSlots(source, ['source:0', 'source:2']).map(slot => slot.id), ['source:1']);
assert.equal(replay.batchSetupComplete(source, ['source:0', 'source:1']), false);
assert.equal(replay.batchSetupComplete(source, source.slots.map(slot => slot.id)), true);

const assignments = source.slots.map(slot => ({ slotId: slot.id, path: [...slot.topicPath], difficulty: slot.difficulty }));
assert.equal(replay.validBatchSlotAssignments(source, assignments), true);
assert.equal(replay.validBatchSlotAssignments(source, [assignments[1]]), true, 'retries may submit only missing slots');
assert.equal(replay.validBatchSlotAssignments(source, [{ ...assignments[0], difficulty: 3 }]), false);
assert.equal(replay.validBatchSlotAssignments(source, [{ ...assignments[0], path: ['Science'] }]), false);
assert.equal(replay.validBatchSlotAssignments(source, [assignments[0], assignments[0]]), false);
assert.equal(replay.validStableBatchAssignments(assignments, 3), true);
assert.equal(replay.validStableBatchAssignments(assignments.slice(0, 2), 3), false);
assert.equal(replay.validStableBatchAssignments([{ ...assignments[0], slotId: '' }, assignments[1], assignments[2]], 3), false);
assert.equal(replay.validStableBatchAssignments([{ path: ['Legacy'] }], 1), true, 'older callers without slot IDs keep their defaults');

const sourceSignature = {
  kind: 'fact-novelty', version: 1, id: 'card-1', title: 'A precise fact', claim: 'A precise fact happened.', hasClaim: true,
  fingerprint: 'f', claimFingerprint: 'c', bodyFingerprint: 'b', detailMarkers: ['1902'], negated: false,
  topicPath: ['Science', 'Physics'], evidenceKeys: ['e']
};
source.novelty = [sourceSignature];
const repeat = replay.cloneBatchSetupForRepeat(source, 'repeat-abc', '2026-10-25T12:00:00.000Z');
assert.deepEqual(repeat.slots.map(slot => slot.id), ['repeat-abc:0', 'repeat-abc:1', 'repeat-abc:2']);
assert.deepEqual(repeat.slots.map(({ topicPath, difficulty }) => ({ topicPath, difficulty })), source.slots.map(({ topicPath, difficulty }) => ({ topicPath, difficulty })));
assert.notEqual(repeat.settings, source.settings);
assert.equal(repeat.settings.sentenceLength, source.settings.sentenceLength);
assert.equal(repeat.factAngle, source.factAngle);
assert.equal(repeat.rabbitHole, source.rabbitHole);
assert.deepEqual(repeat.novelty, source.novelty);
repeat.settings.sentenceLength = 1;
assert.equal(source.settings.sentenceLength, 4, 'editing the transient repeat cannot mutate the persisted setup');

const acceptedCards = source.slots.map((slot, index) => ({ id: `card-${index + 1}`, title: `Fact ${index + 1}` }));
const acceptedBySlot = new Map(source.slots.map((slot, index) => [slot.id, acceptedCards[index]]));
assert.equal(replay.completeBatchSetup(source, acceptedBySlot, acceptedCards.slice(0, 2), [sourceSignature]), null, 'a missing feed card cannot complete a setup');
const completed = replay.completeBatchSetup(source, acceptedBySlot, acceptedCards, [sourceSignature, { ...sourceSignature, id: 'unrelated' }]);
assert.deepEqual(completed.novelty.map(signature => signature.id), ['card-1']);
assert.equal(replay.summarizeBatchSetup(source).count, 3);
assert.deepEqual(replay.summarizeBatchSetup(source).topics.find(topic => topic.path === 'Science → Physics → Optics'), {
  path: 'Science → Physics → Optics', difficulty: 7, count: 1
});
assert.equal(replay.summarizeBatchSetup(source).topics.find(topic => topic.path === 'Science → Physics → Optics' && topic.difficulty === 8).count, 1);
assert.equal(replay.summarizeBatchSetup(source).difficulty, 'Level 7, Level 8, Level 9');

const canonical = cloudRecords.canonicalRecord({
  id: 'workspace', name: 'Workspace', createdAt: '2026-10-25T12:00:00.000Z', updatedAt: '2026-10-25T12:00:00.000Z',
  state: { topics: [], settings, cards: [], learningProfile: {}, lastCompletedBatchSetup: source }
});
assert.deepEqual(canonical.state.lastCompletedBatchSetup, source, 'cloud canonicalization must retain the latest completed setup');
assert.equal(cloudRecords.canonicalRecord({ ...canonical, state: { ...canonical.state, lastCompletedBatchSetup: { ...source, version: 99 } } }).state.lastCompletedBatchSetup, undefined, 'invalid optional setup metadata is dropped safely');

assert.equal(replay.isBatchSetup({ ...source, version: 99 }), false);
assert.equal(replay.isBatchSetup({ ...source, slots: [{ ...source.slots[0], id: '' }] }), false);
assert.equal(replay.isBatchSetup({ ...source, novelty: Array(11).fill(sourceSignature) }), false);
console.log('Batch setup capture, retry, completion, repeat cloning, and validation checks passed.');
