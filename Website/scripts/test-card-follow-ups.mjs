import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/card-follow-ups.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleLike = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleLike.exports, module: moduleLike, require() { throw new Error('The follow-up helper must have no runtime dependencies.'); } });
const api = moduleLike.exports;

function makeCard(overrides = {}) {
  return {
    id: 'fact-1', title: 'Antikythera mechanism', hook: 'A shipwreck revealed a complex device',
    body: 'The Antikythera mechanism was recovered from a shipwreck near the Greek island of Antikythera in 1901.',
    sentences: ['The Antikythera mechanism was recovered from a shipwreck near the Greek island of Antikythera in 1901.'],
    claim: 'The mechanism was recovered in 1901.', topicPath: ['History', 'Ancient Greece'],
    sources: [{ title: 'Antikythera mechanism', url: 'https://en.wikipedia.org/wiki/Antikythera_mechanism', extract: 'The Antikythera mechanism was recovered from a shipwreck. Later researchers identified a complex system of bronze gears that modeled astronomical cycles. Subsequent analysis connected its design to ancient Greek mathematical traditions.' }],
    ...overrides
  };
}

const card = makeCard();
const saved = api.createSavedFollowUpQuestions([
  'How was the Antikythera mechanism recovered?', // Already answered by the full card.
  'What do its bronze gears model?',
  'What do its bronze gears model?', // Duplicate.
  'Why did its design use bronze gears?' // Distinct aspect, concise.
], card);
assert.deepEqual(Array.from(saved.questions), ['What do its bronze gears model?', 'Why did its design use bronze gears?']);
assert.equal(saved.fingerprint, api.followUpQuestionFingerprint(card));
assert.equal(api.normalizeSavedFollowUpQuestions(saved, { ...card, body: card.body + ' A changed sentence.' }), undefined);
assert.deepEqual(Array.from(api.getCardFollowUpQuestions({ ...card, followUpQuestions: saved })), Array.from(saved.questions));

const answered = makeCard({
  answer: 'Its gears model the cycles of the Sun and Moon.',
  learnMore: 'The gears model several astronomical cycles.',
  explanations: { simpler: { text: 'Its gears model the Sun and Moon cycles.', sources: [], fingerprint: 'unused' } },
  questionHistory: [{ role: 'user', content: 'What do its bronze gears model?' }, { role: 'assistant', content: 'The gears model astronomical cycles.' }]
});
const filtered = api.createSavedFollowUpQuestions(['What do its bronze gears model?', 'What do its gears model?'], answered);
assert.ok(!filtered?.questions.includes('What do its bronze gears model?'));
assert.ok(!filtered?.questions.includes('What do its gears model?'));
const answerOnly = makeCard({ answer: 'The bronze gears model the Sun and Moon cycles.' });
assert.ok(!api.createSavedFollowUpQuestions(['What do the bronze gears model?'], answerOnly)?.questions.includes('What do the bronze gears model?'));
const learnedOnly = makeCard({ learnMore: 'The bronze gears model the Sun and Moon cycles.' });
assert.ok(!api.createSavedFollowUpQuestions(['What do the bronze gears model?'], learnedOnly)?.questions.includes('What do the bronze gears model?'));
const explanationOnly = makeCard({ explanations: { deeper: { text: 'The bronze gears model the Sun and Moon cycles.', sources: [], fingerprint: 'unused' } } });
assert.ok(!api.createSavedFollowUpQuestions(['What do the bronze gears model?'], explanationOnly)?.questions.includes('What do the bronze gears model?'));

const fallbackCard = makeCard({
  body: 'The device used interlocking bronze gears to represent astronomical cycles.',
  sentences: ['The device used interlocking bronze gears to represent astronomical cycles.'],
  sources: [{ title: 'Antikythera mechanism', url: 'https://en.wikipedia.org/wiki/Antikythera_mechanism', extract: 'The Antikythera mechanism was discovered in a shipwreck. Later researchers identified a complex system of bronze gears that modeled astronomical cycles. Subsequent analysis connected its design to ancient Greek mathematical traditions.' }]
});
const fallback = api.getCardFollowUpQuestions(fallbackCard);
assert.ok(fallback.length > 0 && fallback.length <= 2);
assert.ok(fallback.every(question => question.length <= 80 && (question.match(/[\p{L}\p{N}]+/gu) ?? []).length <= 12));
assert.ok(fallback.every(question => !/discovered/i.test(question)), 'The full saved card already answers how the device was discovered.');
assert.deepEqual(Array.from(api.getCardFollowUpQuestions(makeCard({ sources: [] }))), []);
const malformed = api.createSavedFollowUpQuestions({ malformed: true }, card);
assert.ok(!malformed || malformed.questions.length <= 2, 'Malformed optional output is discarded or replaced locally.');

console.log('Card follow-up question validation passed.');
