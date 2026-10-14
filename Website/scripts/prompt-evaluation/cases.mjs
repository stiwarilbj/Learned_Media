import { readFileSync, writeFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));

export function registerEvaluation(h) {
  const {test, assert, require} = h;
  const engine = require('../lib/topic-suggestions.ts');
  const {createDefaultTopics} = require('../lib/demo-data.ts');
  const {flattenTopics} = require('../lib/topic-catalog.ts');
  const index = engine.createTopicSuggestionIndex(flattenTopics(createDefaultTopics()));
  const rows = [];
  for (const fixture of fixtures) test(`prompt evaluation: ${fixture.id}`, async () => {
    const row = {id:fixture.id, taskSuccess:false, citationValid:0, citationTotal:0,
      duplicateRate:0, candidateDuplicateRate:0, outputBytes:0, promptBytes:0, geminiCalls:0};
    let state;
    let questionInstructionPresent=true;
    const random = Math.random;
    Math.random = () => 0.5;
    try {
      if (fixture.query && !['direct-question','multi-part-question','scoped-question'].includes(fixture.id)) {
        const result = engine.searchTopicIndex(index, fixture.query);
        assert.equal(result.suggestions.length,100);
        assert.equal(new Set(result.suggestions.map(s=>s.id)).size,100);
        if (fixture.expected) {
          assert.ok(result.completeCoverage);
          assert.ok(result.matchedIds.some(id=>index.byId.get(id).topic.label===fixture.expected));
          if (fixture.id === 'multiple-concepts') {
            assert.ok(!result.matchedIds.some(id=>index.byId.get(id).topic.label==='Japan'));
            assert.ok(!result.matchedIds.some(id=>index.byId.get(id).topic.label==='2023 Turkey–Syria Earthquakes'));
          }
        } else {
          assert.equal(result.completeCoverage,false);
          assert.equal(result.visibleIds.length,0);
          assert.ok(result.suggestions.every(s=>s.group==='explore'));
        }
        // Local search has no model output; outputBytes stays zero.
      } else {
        let damaged=false;
        const options = fixture.id === 'weak-evidence' ? {needsEvidenceSlot:6,needsEvidenceOnce:true}
          : fixture.id === 'malformed-output' ? {responseText(output,prompt){
            if (!damaged && prompt.includes('Return one result for each slot')) {
              damaged=true;
              return '{"facts":['+output.facts.slice(0,-1).map(f=>JSON.stringify(f)).join(',')+',{"slot":0,"title":"unfinished';
            }
          }} : fixture.id === 'duplicate-candidates' ? {transformOutput(output,prompt){
            if (prompt.includes('Generate one batch of distinct')) output.facts.push({...output.facts[0]});
            return output;
          }} : {};
        state=h.installNetworkMock({...options,learningAnswer:fixture.answer});
        const sessionId=await h.connectMock(state);
        if (['direct-question','multi-part-question','scoped-question'].includes(fixture.id)) {
          const fact=h.factBundle(h.words[0]);
          const card={id:'fixed-eval-card',hook:fact.hook,title:fact.title,body:fact.sentences.join(' '),topicPath:['Science'],difficulty:5,accent:'blue',sources:[{title:'Shared Article',url:'https://en.wikipedia.org/wiki/Shared_Article',extract:h.articleExtract()}]};
          const args={apiKey:'test-key',sessionId,action:'question',card,question:fixture.query,history:[]};
          const answer=await h.generateLearningResponse(args);
          assert.match(answer.answer,/diaphragm.*pressure/);
          assert.equal(answer.citations.length,1);
          row.citationTotal=answer.citations.length;
          row.citationValid=answer.citations.filter(c=>c.url===card.sources[0].url).length;
          const repeat=await h.generateLearningResponse({...args,question:'  '+fixture.query.toUpperCase()+'  '});
          assert.equal(repeat.answer,answer.answer);
          assert.ok(state.outputs[0].prompt.includes('Original user query: '+fixture.query));
          questionInstructionPresent=state.outputs[0].prompt.includes(fixture.requiredInstruction);
          if(fixture.expectedScope){
            const field=state.outputs[0].prompt.split('\n\n').find(b=>b.startsWith('Question scope: '));
            questionInstructionPresent &&= !!field && JSON.stringify(JSON.parse(field.slice('Question scope: '.length)).data)===JSON.stringify(fixture.expectedScope);
          }
          if(fixture.expectedChecklist){
            const field=state.outputs[0].prompt.split('\n\n').find(b=>b.startsWith('Coverage checklist: '));
            questionInstructionPresent &&= !!field && JSON.stringify(JSON.parse(field.slice('Coverage checklist: '.length)).data)===JSON.stringify(fixture.expectedChecklist);
            assert.ok(answer.answer.includes('does not explain why it was abandoned'));
          }
        } else {
          const result=await h.generateGeminiFacts({...h.generationArgs(sessionId),requestedCount:7});
          assert.equal(result.completedCount,7);
          const fingerprints=result.cards.map(c=>c.body.toLowerCase().replace(/\s+/g,' ').trim());
          row.duplicateRate=(fingerprints.length-new Set(fingerprints).size)/fingerprints.length;
          for (const card of result.cards) {
            assert.ok(card.evidence.length);
            for (const e of card.evidence) {
              row.citationTotal++;
              if (card.sources[e.sourceIndex]?.extract?.includes(e.quote) && e.section) row.citationValid++;
            }
          }
          if (fixture.id==='malformed-output') assert.deepEqual(h.groundingSlots(state.groundingPrompts[1]).map(s=>s.slot),[0]);
          if (fixture.id==='weak-evidence') assert.deepEqual(h.candidateAssignments(state.candidatePrompts[1]).map(s=>s.slot),[6]);
        }
        row.geminiCalls=h.geminiCallCount(state);
        for (const response of state.outputs) {
          row.outputBytes+=Buffer.byteLength(response.text);
          row.promptBytes+=Buffer.byteLength(response.prompt);
        }
        const candidates=state.outputs.filter(r=>r.prompt.includes('Generate one batch of distinct')).flatMap(r=>r.output.facts);
        if (candidates.length) {
          // Measure duplicates within each batch; retries may legitimately repeat a slot.
          let duplicates=0;
          for (const response of state.outputs.filter(r=>r.prompt.includes('Generate one batch of distinct'))) {
            const claims=response.output.facts.map(f=>f.claim?.toLowerCase().replace(/\s+/g,' ').trim());
            duplicates+=claims.length-new Set(claims).size;
          }
          row.candidateDuplicateRate=duplicates/candidates.length;
        }
      }
      assert.equal(row.citationValid,row.citationTotal);
      assert.equal(row.duplicateRate,0);
      assert.ok(row.geminiCalls<=fixture.maxCalls);
      assert.ok(questionInstructionPresent,'Direct question is missing its type-specific instruction');
      row.taskSuccess=true;
    } finally {
      Math.random=random;
      rows.push(row);
      writeFileSync(process.env.PROMPT_EVALUATION_REPORT,JSON.stringify(rows,null,2)+'\n');
    }
  });
}
