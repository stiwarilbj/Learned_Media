import { readFileSync, writeFileSync } from 'node:fs';
import { malformedItemOptions, truncatedSlotOptions, assertSlotRecovery } from './recovery-cases.mjs';
import { measureCardCoverage, validCitation } from './card-metrics.mjs';
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
      duplicateRate:0, candidateDuplicateRate:0, outputBytes:0, promptBytes:0, geminiCalls:0,
      expectedSentences:0, cardTotal:0, sentenceCountValid:0, sentenceTotal:0, sentenceCited:0};
    let state;
    const published=[];
    let questionInstructionPresent=true;
    const random = Math.random;
    Math.random = () => 0.5;
    try {
      if (fixture.query && !fixture.requiredInstruction) {
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
        const options = fixture.damagedSlot !== undefined ? (fixture.damageKind === 'truncated' ? truncatedSlotOptions(fixture.damagedSlot) : malformedItemOptions(fixture.damagedSlot))
          : fixture.quotedSentence ? h.instructionQuotationOptions(fixture.quotedSentence)
          : fixture.id === 'weak-evidence' ? {needsEvidenceSlot:6,needsEvidenceOnce:true}
          : fixture.id === 'duplicate-candidates' ? {transformOutput(output,prompt){
            if (prompt.includes('Generate one batch of distinct')) output.facts.push({...output.facts[0]});
            return output;
          }} : {};
        if (fixture.damagedSlot !== undefined) {
          const cache = require('../lib/wikipedia.ts').sharedWikipediaResolutionCache;
          cache.pages.clear(); cache.searches.clear();
        }
        if (fixture.sentenceLength) {
          // Boundary fixtures replace the article body; do not reuse another fixture's evidence.
          const lengths = require('../lib/fact-quality.ts').SENTENCE_LENGTH_OPTIONS;
          assert.equal(fixture.sentenceLength,fixture.id === 'shortest-card-length' ? Math.min(...lengths) : Math.max(...lengths));
          const cache = require('../lib/wikipedia.ts').sharedWikipediaResolutionCache;
          cache.pages.clear(); cache.searches.clear();
        }
        state=h.installNetworkMock({...options,learningAnswer:fixture.answer,evidencePrefix:fixture.evidencePrefix, sourceSentenceCount:Math.max(3,fixture.sentenceLength ?? 3)});
        const sessionId=await h.connectMock(state);
        if (fixture.action === 'adapt') {
          const fact=h.factBundle(h.words[0]);
          const card={id:'fixed-eval-card',hook:fact.hook,title:fact.title,body:fact.sentences.join(' '),claim:fact.sentences[0],topicPath:['Science'],difficulty:5,accent:'blue',sources:[{title:'Shared Article',url:'https://en.wikipedia.org/wiki/Shared_Article',extract:h.articleExtract()}]};
          const result=await h.generateLearningResponse({apiKey:'test-key',sessionId,action:'adapt',mode:fixture.mode,card});
          assert.equal(result.answer,fixture.answer);
          assert.equal(result.citations.length,1);
          assert.equal(result.citations[0].url,card.sources[0].url);
          row.citationTotal=result.citations.length;
          row.citationValid=result.citations.filter(c=>c.url===card.sources[0].url).length;
          const prompt=state.outputs[0].prompt;
          questionInstructionPresent=prompt.includes(fixture.requiredInstruction)&&prompt.includes(fixture.secondaryInstruction)
            &&prompt.includes('Original fact card:')&&prompt.includes('Wikipedia evidence:');
        } else if (fixture.requiredInstruction) {
          const fact=h.factBundle(h.words[0]);
          const card={id:'fixed-eval-card',hook:fact.hook,title:fact.title,body:fact.sentences.join(' '),topicPath:['Science'],difficulty:5,accent:'blue',sources:[{title:'Shared Article',url:'https://en.wikipedia.org/wiki/Shared_Article',extract:(fixture.evidencePrefix ?? "")+h.articleExtract()}]};
          const args={apiKey:'test-key',sessionId,action:'question',card,question:fixture.query,history:[]};
          const answer=await h.generateLearningResponse(args);
          assert.match(answer.answer,/diaphragm.*pressure/);
          assert.equal(answer.citations.length,1);
          if(fixture.id === "incomplete-evidence-answer") assert.equal(answer.answer,fixture.answer);
          row.citationTotal=answer.citations.length;
          row.citationValid=answer.citations.filter(c=>c.url===card.sources[0].url).length;
          const repeat=await h.generateLearningResponse({...args,question:'  '+fixture.query.toUpperCase()+'  '});
          assert.equal(repeat.answer,answer.answer);
          assert.ok(state.outputs[0].prompt.includes('Original user query: '+fixture.query));
          questionInstructionPresent=state.outputs[0].prompt.includes(fixture.requiredInstruction);
          if(fixture.expectedDateRoles){
            const field=state.outputs[0].prompt.split("\n\n").find(b=>b.startsWith("Wikipedia evidence: "));
            const evidence=field ? JSON.parse(field.slice("Wikipedia evidence: ".length)).data : [];
            questionInstructionPresent &&= JSON.stringify((evidence[0]?.dateRoles ?? []).map(({date,role})=>({date,role})))===JSON.stringify(fixture.expectedDateRoles);
          }
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
          const args = h.generationArgs(sessionId);
          const expected = fixture.sentenceLength ?? args.settings.sentenceLength;
          const result=await h.generateGeminiFacts({...args, settings:{...args.settings, sentenceLength:expected}, requestedCount:7,
            onProgress:event=>{if(event.type==='card')published.push({slot:event.slot,card:structuredClone(event.card)});}});
          Object.assign(row, measureCardCoverage(result.cards, expected));
          const fingerprints=result.cards.map(c=>c.body.toLowerCase().replace(/\s+/g,' ').trim());
          row.duplicateRate=(fingerprints.length-new Set(fingerprints).size)/fingerprints.length;
          for (const card of result.cards) {
            assert.ok(card.evidence.length);
            for (const e of card.evidence) {
              row.citationTotal++;
              if (validCitation(card,e)) row.citationValid++;
            }
          }
          assert.equal(result.completedCount,7);
          if (fixture.quotedSentence) {
            const assignments=h.candidateAssignments(state.candidatePrompts[0]);
            assert.deepEqual(assignments.map(slot=>slot.slot),[0,1,2,3,4,5,6]);
            const grounded=h.groundingSlots(state.groundingPrompts[0]);
            assert.deepEqual(grounded.map(slot=>slot.slot),[0,1,2,3,4,5,6]);
            assert.deepEqual(grounded.map(slot=>slot.topicPath),assignments.map(slot=>slot.topicPath));
            const card=result.cards.find(c=>c.topicPath.join('/')===assignments[0].topicPath.join('/'));
            assert.ok(card.body.includes(fixture.quotedSentence));
            assert.ok(card.evidence.some(e=>e.sentence===1 && e.quote.includes(fixture.quotedSentence)));
            const raw=state.outputs.find(response=>response.prompt.includes('Return one result for each slot')).output;
            assert.deepEqual(raw.facts.map(f=>f.slot).sort((a,b)=>a-b),[0,1,2,3,4,5,6]);
            for(const fact of raw.facts) {
              const allowed=new Set(grounded.find(slot=>slot.slot===fact.slot).evidenceIds);
              assert.ok(fact.claimEvidenceIds.every(id=>allowed.has(id)));
              assert.equal(new Set(fact.evidence.map(e=>e.sentence)).size,expected);
              assert.ok(fact.evidence.every(e=>e.evidenceIds.length && e.evidenceIds.every(id=>allowed.has(id))));
            }
          }
          if (fixture.damagedSlot !== undefined) assertSlotRecovery(h,{slot:fixture.damagedSlot,state,result,published});
          if (fixture.id==='weak-evidence') assert.deepEqual(h.candidateAssignments(state.candidatePrompts[1]).map(s=>s.slot),[6]);
        }
        row.geminiCalls=h.geminiCallCount(state);
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
      assert.equal(row.sentenceCountValid,row.cardTotal,'Published sentence counts must match the requested length');
      assert.equal(row.sentenceCited,row.sentenceTotal,'Every published sentence needs complete valid citations');
      assert.equal(row.citationValid,row.citationTotal);
      assert.equal(row.duplicateRate,0);
      assert.ok(row.geminiCalls<=fixture.maxCalls);
      if (fixture.expectedCalls !== undefined) assert.equal(row.geminiCalls,fixture.expectedCalls,'Generation must retain the two-call pipeline');
      assert.ok(questionInstructionPresent,'Question is missing its required prompt contract');
      row.taskSuccess=true;
    } finally {
      if (state) {
        row.geminiCalls=h.geminiCallCount(state);
        row.outputBytes=state.outputs.reduce((sum,response)=>sum+Buffer.byteLength(response.text),0);
        row.promptBytes=state.outputs.reduce((sum,response)=>sum+Buffer.byteLength(response.prompt),0);
      }
      Math.random=random;
      rows.push(row);
      writeFileSync(process.env.PROMPT_EVALUATION_REPORT,JSON.stringify(rows,null,2)+'\n');
    }
  });
}
