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
