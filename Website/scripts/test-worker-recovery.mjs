import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
const source = readFileSync(new URL('../lib/worker-recovery.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const web = { exports: {} }; vm.runInNewContext(compiled, web);
const native = {}; vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/worker-recovery.js', import.meta.url), 'utf8'), native);
function clock() {
  let now = 0, id = 0; const jobs = new Map();
  return { now: () => now, schedule(fn, delay) { jobs.set(++id, { at: now + delay, fn }); return id; }, cancel(id) { jobs.delete(id); },
    advance(ms) { const until = now + ms; for (;;) { const next = [...jobs].filter(([, job]) => job.at <= until).sort((a,b) => a[1].at-b[1].at)[0]; if (!next) break; jobs.delete(next[0]); now = next[1].at; next[1].fn(); } now = until; }, get size() { return jobs.size; } };
}
function harness(create, options={}) {
  const time = clock(), transports = [], replies = []; let restarts = 0, failures = 0, latestRevision = 1;
  const worker = create(() => {
    const raw = { posted: [], terminated: false, postMessage(message) { if (this.throwOnPost) throw Error('clone failed'); this.posted.push(message); }, terminate() { this.terminated = true; }, emit(data) { this.onmessage({ data }); } };
    transports.push(raw); return raw;
  }, { clock: time, requestTimeoutMs: 100, initializeTimeoutMs: 300, ...options });
  worker.onmessage = event => replies.push(event.data);
  worker.onerror = () => failures++;
  worker.onrestart = () => { restarts++; worker.postMessage({ type:'initialize', revision:latestRevision }); };
  const initialize = () => { worker.postMessage({ type:'initialize', revision:latestRevision }); transports.at(-1).emit({ type:'ready', revision:latestRevision }); };
  const search = (requestId=1) => worker.postMessage({ type:'search', requestId, revision:latestRevision });
  return { time, transports, worker, replies, initialize, search, set revision(value) { latestRevision=value; }, get restarts() { return restarts; }, get failures() { return failures; } };
}
for (const [name, create] of [['website',web.exports.createRecoveringSearchWorker],['Mac',native.LEARNED_MEDIA_WORKER_RECOVERY.createRecoveringSearchWorker]]) {
  test(`${name}: healthy requests preserve replies and have no idle timers`, () => {
    const h=harness(create); h.initialize(); h.search(); const reply={type:'results',requestId:1,revision:1,ids:['b','a']}; h.transports[0].emit(reply);
    assert.equal(h.replies.at(-1),reply); assert.equal(h.time.size,0); h.time.advance(10000); assert.equal(h.restarts,0); h.worker.terminate();
  });
  for (const event of ['onerror','onmessageerror','timeout','failed','clone']) test(`${name}: ${event} restarts once with the latest catalog`, () => {
    const h=harness(create); h.initialize(); h.search(); h.revision=2; const old=h.transports[0];
    if(event==='timeout')h.time.advance(100); else if(event==='failed')old.emit({type:'failed',requestId:1,revision:1}); else if(event==='clone'){old.throwOnPost=true;h.search(2);} else old[event]({});
    assert.equal(h.restarts,1); assert.equal(old.terminated,true); assert.equal(h.transports[1].posted[0].revision,2);
    const count=h.replies.length; old.emit({type:'results',requestId:1,revision:1}); old.onerror(); assert.equal(h.replies.length,count); assert.equal(h.failures,0);
    h.transports[1].emit({type:'ready',revision:2}); h.search(3); h.time.advance(100); assert.equal(h.failures,1); assert.equal(h.transports.length,2); assert.equal(h.time.size,0);
  });
  test(`${name}: only current request progress extends its deadline`, () => {
    const h=harness(create);h.initialize();h.search();h.time.advance(80);h.transports[0].emit({type:'progress',requestId:1,revision:1});h.time.advance(80);assert.equal(h.restarts,0);
    h.transports[0].emit({type:'progress',requestId:1,revision:0});h.time.advance(20);assert.equal(h.restarts,1);h.worker.terminate();
  });
  test(`${name}: acknowledged topic updates cannot leave subsequent searches waiting forever`, () => {
    const h=harness(create,{updatesAcknowledge:true});h.initialize();h.revision=2;h.worker.postMessage({type:'update',revision:2});h.time.advance(300);assert.equal(h.restarts,1);assert.equal(h.transports[1].posted[0].revision,2);h.worker.terminate();
  });
  test(`${name}: startup deadline is bounded even with repeated initialization`, () => {
    const h=harness(create);h.worker.postMessage({type:'initialize',revision:1});h.search();h.time.advance(150);assert.equal(h.restarts,0);
    h.worker.postMessage({type:'initialize',revision:2});h.time.advance(150);assert.equal(h.restarts,1);
    h.transports[1].emit({type:'rebuild',revision:1});assert.equal(h.failures,1);assert.equal(h.time.size,0);
  });
  test(`${name}: cancellation and termination stop deadlines without canceling a newer request`, () => {
    const h=harness(create);h.initialize();h.search(2);h.worker.postMessage({type:'cancel',requestId:1});h.time.advance(100);assert.equal(h.restarts,1);
    h.transports[1].emit({type:'ready',revision:1});h.search(3);h.worker.postMessage({type:'cancel',requestId:4});assert.equal(h.time.size,0);h.time.advance(1000);assert.equal(h.failures,0);h.worker.terminate();
  });
  test(`${name}: successful searches replenish the restart budget, ready alone does not`, () => {
    const h=harness(create);h.initialize();h.search();h.transports[0].onmessageerror();h.transports[1].emit({type:'ready',revision:1});h.search(2);h.transports[1].emit({requestId:2,revision:1,candidates:[]});
    h.search(3);h.transports[1].onerror();assert.equal(h.restarts,2);assert.equal(h.failures,0);h.worker.terminate();assert.equal(h.time.size,0);
  });
  test(`${name}: malformed messages and failed restart construction settle fallback once`, () => {
    const h=harness(create);h.initialize();h.transports[0].emit(null);h.transports[1].emit(null);h.time.advance(10000);assert.equal(h.failures,1);assert.equal(h.time.size,0);
    assert.throws(()=>create(()=>{throw Error('unavailable');},{clock:clock()}),/unavailable/);
    let count=0, fallback=0;const raw={postMessage(){},terminate(){}};const w=create(()=>{if(count++)throw Error('unavailable');return raw;},{clock:clock()});w.onrestart=()=>{};w.onerror=()=>fallback++;raw.onerror();assert.equal(fallback,1);
  });
}
