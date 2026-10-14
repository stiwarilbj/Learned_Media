import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {compareReports} from './prompt-evaluation/compare.mjs';
const baseline=JSON.parse(readFileSync(new URL('./prompt-evaluation/baseline.json',import.meta.url)));
const copy=()=>structuredClone(baseline);
test('identical replay passes without claiming improved model behavior',()=>{
 const result=compareReports(baseline,copy());assert.equal(result.accepted,true);assert.equal(result.improved,false);
});
test('changed wording requires a reliability gain',()=>{
 const candidate=copy();candidate.promptHash='a'.repeat(64);assert.equal(compareReports(baseline,candidate).accepted,false);
});
test('each reliability, call and size regression is rejected independently',()=>{
 for(const change of [{taskSuccess:false},{citationValid:0},{citationValid:0,citationTotal:0},{duplicateRate:0.1},{candidateDuplicateRate:0.2},{geminiCalls:2},{outputBytes:10000},{promptBytes:10000}]){
  const candidate=copy();Object.assign(candidate.cases[0],change);assert.equal(compareReports(baseline,candidate).accepted,false,JSON.stringify(change));
 }
});
test('an improvement cannot conceal a regression in another scenario',()=>{
 const old=copy();old.cases[0].taskSuccess=false;
 const next=copy();next.promptHash='a'.repeat(64);next.cases[1].geminiCalls=1;
 assert.equal(compareReports(old,next).accepted,false);
});
test('paired reports permit a genuine reliability improvement without extra calls',()=>{
 const old=copy();old.cases[0].taskSuccess=false;
 const next=copy();next.promptHash='a'.repeat(64);const result=compareReports(old,next);
 assert.equal(result.accepted,true);assert.equal(result.improved,true);
});
test('different fixture sets, modes, missing cases and malformed metrics cannot pass',()=>{
 for(const mutate of [r=>r.suiteHash='other',r=>r.mode='other',r=>r.cases.pop(),r=>r.cases.push(r.cases[0]),r=>r.cases[0].geminiCalls=NaN,r=>r.cases[0].citationValid=2]){
  const next=copy();mutate(next);assert.equal(compareReports(baseline,next).accepted,false);
 }
});


test('sentence counts, citation coverage, bytes and calls have independent gates at both boundaries',()=>{
 for (const id of ['shortest-card-length','longest-card-length']) {
  const row=baseline.cases.find(c=>c.id===id);
  assert.ok(row,`Missing ${id}`);
  assert.equal(row.cardTotal,7);
  assert.equal(row.expectedSentences,id==='shortest-card-length' ? 1 : 10);
  assert.equal(row.sentenceTotal,7*row.expectedSentences);
  assert.equal(row.sentenceCited,row.sentenceTotal);
  assert.equal(row.geminiCalls,2);
  for (const [change,diagnostic] of [
   [{sentenceCountValid:6},'sentence counts failed'],
   [{sentenceTotal:row.sentenceTotal-1,sentenceCited:row.sentenceTotal-1},'sentence counts failed'],
   [{sentenceCited:row.sentenceCited-1},'sentence citation coverage incomplete'],
   [{outputBytes:Math.ceil(row.outputBytes*1.1)+1},'model output grew'],
   [{geminiCalls:3},'Gemini calls increased']
  ]) {
   const candidate=copy();Object.assign(candidate.cases.find(c=>c.id===id),change);
   const result=compareReports(baseline,candidate);
   assert.equal(result.accepted,false,JSON.stringify(change));
   assert.ok(result.errors.some(error=>error.includes(id) && error.includes(diagnostic)),result.errors.join('\n'));
  }
 }
});

test('independent published-body measurements catch wrong lengths and incomplete citations',async()=>{
 const {measureCardCoverage}=await import('./prompt-evaluation/card-metrics.mjs');
 const sentence='The observatory instrument recorded a pressure change during calibration.';
 const make=count=>({body:Array(count).fill(sentence).join(' '),sentenceCount:count,
  sources:[{extract:'[Section: Calibration]\n'+sentence}],
  evidence:Array.from({length:count},(_,sentence)=>({sentence,sourceIndex:0,quote:'The observatory instrument recorded a pressure change during calibration.',section:'Calibration'}))});
 for (const length of [1,10]) {
  const card=make(length),measure=value=>measureCardCoverage([value],length);
  assert.deepEqual(measure(card),{expectedSentences:length,cardTotal:1,sentenceCountValid:1,sentenceTotal:length,sentenceCited:length});
  assert.equal(measure({...card,sentenceCount:3}).sentenceCountValid,0,'metadata alone cannot establish correct length');
  assert.equal(measure({...card,body:card.body+' '+sentence}).sentenceCountValid,0,'extra sentence is counted independently');
  assert.equal(measure({...card,body:card.body.slice(0,-1)}).sentenceCountValid,0,'unfinished sentence fails');
  for (const evidence of [card.evidence.slice(0,-1),card.evidence.map(e=>e.sentence===length-1 ? {...e,sourceIndex:99}:e),card.evidence.map(e=>e.sentence===length-1 ? {...e,quote:'Invented support.'}:e),card.evidence.map(e=>e.sentence===length-1 ? {...e,section:'Wrong section'}:e)]) {
   assert.equal(measure({...card,evidence}).sentenceCited,length-1);
  }
 }
});
