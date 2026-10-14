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

test('comparison report displays all metric transitions beside case decisions',async()=>{
 const {formatComparison}=await import('./prompt-evaluation/report.mjs');
 const old=copy(),next=copy();
 const id='shortest-card-length';
 Object.assign(old.cases.find(c=>c.id===id),{outputBytes:6700,geminiCalls:2});
 Object.assign(next.cases.find(c=>c.id===id),{outputBytes:5900,geminiCalls:3,citationValid:6,duplicateRate:0.1,candidateDuplicateRate:0.2});
 const text=formatComparison(old,next);
 assert.match(text,/Acceptance: REJECTED/);
 assert.ok(text.includes(`${id}: REJECT`));
 for (const expected of ['success: pass → pass','citations: 7/7 (100%) → 6/7 (85.71%)',
  'duplicates: 0% → 10%','candidate duplicates: 0% → 20%',
  'output: 6,700 → 5,900 bytes','calls: 2 → 3','prompt: ',
  'sentence counts: 7/7 @ 1 → 7/7 @ 1','cited sentences: 7/7 → 7/7',
  `${id}: Gemini calls increased`,`${id}: citation validity regressed`]) assert.ok(text.includes(expected),expected);
 assert.ok(text.includes(`${old.cases[0].id}: PASS`),'other cases retain their own decision');
});

test('comparison report distinguishes no citations and preserves global prompt gates',async()=>{
 const {formatComparison}=await import('./prompt-evaluation/report.mjs');
 const next=copy();next.promptHash='a'.repeat(64);
 const text=formatComparison(baseline,next);
 assert.match(text,/Acceptance: REJECTED; reliability improved: no/);
 assert.match(text,/citations: N\/A \(0\/0\) → N\/A \(0\/0\)/);
 assert.match(text,/Changed prompts need a measured reliability improvement/);
 assert.ok(baseline.cases.every(row=>text.includes(`${row.id}: PASS`)),'per-case gates do not replace the suite-wide decision');
 const old=copy();old.cases[0].taskSuccess=false;
 const accepted=formatComparison(old,next);
 assert.match(accepted,/Acceptance: ACCEPTED; reliability improved: yes/);
 assert.match(accepted,/success: fail → pass/);
});

test('comparison report exposes missing, extra, and invalid case metrics',async()=>{
 const {formatComparison}=await import('./prompt-evaluation/report.mjs');
 const next=copy(),removed=next.cases.shift();
 next.cases.push({...removed,id:'extra-case'});
 next.cases[0].geminiCalls=null;
 const text=formatComparison(baseline,next);
 assert.ok(text.includes(`${removed.id}: REJECT`));
 assert.match(text,/extra-case: REJECT/);
 assert.match(text,/citations: missing →/);
 assert.match(text,/calls: 0 → N\/A/);
 assert.match(text,/invalid metrics/);
});

test('compare CLI prints transitions and retains acceptance exit codes',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const directory=mkdtempSync(join(tmpdir(),'lm-comparison-test-'));
 try {
  const oldPath=join(directory,'baseline.json'),newPath=join(directory,'candidate.json');
  writeFileSync(oldPath,JSON.stringify(baseline));
  for (const reject of [false,true]) {
   const next=copy();if (reject) next.cases[0].geminiCalls++;
   writeFileSync(newPath,JSON.stringify(next));
   const run=spawnSync(process.execPath,[new URL('./evaluate-prompts.mjs',import.meta.url).pathname,'--compare',oldPath,newPath],{encoding:'utf8'});
   assert.equal(run.status,reject ? 1 : 0,run.stderr);
   assert.ok(run.stdout.includes(`Acceptance: ${reject ? 'REJECTED' : 'ACCEPTED'}`));
   assert.ok(run.stdout.includes(`calls: 1 → ${reject ? 2 : 1}`));
   assert.ok(run.stdout.includes(`"accepted": ${!reject}`),'retain the existing JSON decision');
  }
 } finally {rmSync(directory,{recursive:true,force:true});}
});
