// A wrong-type title damages one complete item in place, preserving all siblings.
export function malformedItemOptions(slot, stage = 'grounding', reversed = false) {
  let damaged = false;
  return {transformOutput(output, prompt) {
    const marker = stage === 'candidate' ? 'Generate one batch of distinct' : 'Return one result for each slot';
    if (!damaged && prompt.includes(marker)) {
      damaged = true;
      output.facts.sort((a,b) => reversed ? b.slot-a.slot : a.slot-b.slot);
      output.facts.find(fact=>fact.slot===slot).title = 123;
    }
    return output;
  }};
}

export function assertSlotRecovery(h, {slot, stage = 'grounding', state, result, published}) {
  const {assert} = h;
  const initial = [0,1,2,3,4,5,6].filter(id=>id!==slot);
  assert.equal(result.completedCount,7);
  assert.equal(result.partial,false);
  assert.equal(h.geminiCallCount(state),stage === 'candidate' ? 4 : 3);
  assert.equal(state.candidatePrompts.length,stage === 'candidate' ? 2 : 1);
  assert.equal(state.groundingPrompts.length,2);
  for (const prompt of state.candidatePrompts.slice(1)) assert.deepEqual(h.candidateAssignments(prompt).map(s=>s.slot),[slot]);
  for (const prompt of state.groundingPrompts.slice(1)) assert.deepEqual(h.groundingSlots(prompt).map(s=>s.slot),[slot]);
  assert.deepEqual(published.map(event=>event.slot),[...initial,slot], 'retain the published prefix, then append the recovered slot');
  assert.equal(new Set(published.map(event=>event.card.id)).size,7,'publish each card once');
  assert.deepEqual(result.cards,published.map(event=>event.card),'final cards must retain publication order and content');
  assert.deepEqual(result.cards.slice(0,6),published.slice(0,6).map(event=>event.card),'recovery must not replace successful siblings');
  const paths=h.candidateAssignments(state.candidatePrompts[0]);
  for (const event of published) assert.deepEqual(event.card.topicPath,paths.find(path=>path.slot===event.slot).topicPath);
}

// The incomplete item must be last in the wire text; its logical slot can be anywhere.
export function truncatedSlotOptions(slot) {
  let damaged=false;
  return {responseText(output,prompt) {
    if (!damaged && prompt.includes('Return one result for each slot')) {
      damaged=true;
      return '{"facts":['+output.facts.filter(fact=>fact.slot!==slot).map(JSON.stringify).join(',')+',{"slot":'+slot+',"title":"unfinished';
    }
  }};
}
