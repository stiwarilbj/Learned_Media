import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const pressure = require('../lib/storage-pressure.ts');
const { LARGE_STORAGE_WRITE_BYTES: LARGE, createStoragePressureGuard, approximateStoredBytes } = pressure;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('small saves never estimate quota or reclaim, and roomy large saves keep their cache', async () => {
 let estimates=0, cleanups=0;
 const guard=createStoragePressureGuard(async()=>{estimates++;return {quota:200*LARGE,usage:0}},async()=>{cleanups++});
 await guard({title:'A small card'});assert.equal(estimates,0);
 await guard(null,{bytes:LARGE});assert.equal(estimates,1);assert.equal(cleanups,0);
});

test('large low-space writes share cleanup without sharing or changing snapshots', async () => {
 let cleanups=0,release;const barrier=new Promise(resolve=>{release=resolve});
 const guard=createStoragePressureGuard(async()=>({quota:10*LARGE,usage:9*LARGE}),async()=>{cleanups++;await barrier});
 const one={cards:[{body:'Keep me'}]},two={savedIds:['video-a']};
 const a=guard(one,{bytes:LARGE}),b=guard(two,{bytes:LARGE});await wait(0);assert.equal(cleanups,1);
 release();await Promise.all([a,b]);assert.deepEqual(one,{cards:[{body:'Keep me'}]});assert.deepEqual(two,{savedIds:['video-a']});
 await guard(one,{bytes:LARGE});assert.equal(cleanups,2,'later saves get a fresh estimate');
});

test('backup/atomic-copy allowance affects the preflight without blocking a write',async()=>{
 let cleanups=0;
 const guard=createStoragePressureGuard(async()=>({quota:100*LARGE,usage:96*LARGE}),async()=>{cleanups++});
 await guard(null,{bytes:LARGE});assert.equal(cleanups,0,'4 MiB write plus 8 MiB reserve fits');
 await guard(null,{bytes:LARGE,copies:3});assert.equal(cleanups,1);
});

test('missing, invalid, rejected or slow quota estimates and failed cleanup are fail-open',async()=>{
 for(const result of [undefined,{}, {quota:-1,usage:0},{quota:NaN,usage:2},{quota:1,usage:-1},{quota:Infinity,usage:0}]) {
  let cleaned=false;await createStoragePressureGuard(async()=>result,async()=>{cleaned=true})(null,{bytes:LARGE});assert.equal(cleaned,false);
 }
 await createStoragePressureGuard(async()=>{throw Error('unavailable')},async()=>{assert.fail('must not clean')})(null,{bytes:LARGE});
 await createStoragePressureGuard(()=>new Promise(()=>{}),async()=>{assert.fail('must not clean')})(null,{bytes:LARGE});
 await createStoragePressureGuard(async()=>({quota:1,usage:1}),async()=>{throw Error('database unavailable')})(null,{bytes:LARGE});
});

test('large size estimates yield, honor cancellation and handle shared/cyclic objects',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(approximateStoredBytes({body:'hello'},controller.signal),{name:'AbortError'});
 const card={body:'é'.repeat(2000)},snapshot={cards:Array.from({length:10000},()=>card)};snapshot.self=snapshot;
 let ticked=false;const timer=setTimeout(()=>{ticked=true},0);
 const size=await approximateStoredBytes(snapshot);clearTimeout(timer);
 assert.ok(size>4000&&size<1000000,'shared objects are counted once, without serialization');assert.ok(ticked);
 let cleaned=false;const active=new AbortController();
 const guard=createStoragePressureGuard(async()=>{active.abort();return {quota:1,usage:1}},async()=>{cleaned=true});
 await assert.rejects(guard(null,{bytes:LARGE,cancellation:active.signal}),{name:'AbortError'});assert.equal(cleaned,false);
});

function isolatedPressure(open) {
 const source=ts.transpileModule(readFileSync(new URL('../lib/storage-pressure.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},Date,setTimeout,clearTimeout,Promise,WeakSet,Number,Math,globalThis:null,
  require:name=>name==='./indexed-db'?{createDatabaseConnection:(...args)=>open(...args)}:require('../lib/background-work.ts')};
 context.globalThis=context;vm.runInNewContext(source,context);return context.exports;
}

test('reclamation touches only the disposable index and waits for transaction commit',async()=>{
 const calls=[];let transaction;
 const local=isolatedPressure((name,version)=>{calls.push(['database',name,version]);return async()=>({transaction:(store,mode)=>{
  calls.push(['transaction',store,mode]);return transaction={objectStore:()=>({delete:key=>calls.push(['delete',key]),put:(value,key)=>calls.push(['put',key,value])})};
 }})});
 let settled=false;const pending=local.reclaimDerivedSearchIndex().then(()=>{settled=true});await wait(0);
 assert.equal(settled,false);assert.equal(calls[0][1],'learned-media-video-search-index');
 assert.deepEqual(calls[1],['transaction','index','readwrite']);assert.deepEqual(calls[2],['delete','current']);
 assert.equal(calls[3][1],'pressure-until');assert.ok(calls[3][2]>Date.now());
 transaction.oncomplete();await pending;
 // The allowlist has no path to workspaces, credentials, catalog, activity or checkpoints.
 assert.equal(calls.filter(c=>c[0]==='delete').length,1);
});

test('failed or timed-out reclamation never completes late after the save proceeds',async()=>{
 let transaction;const failing=isolatedPressure(()=>async()=>({transaction:()=>transaction={objectStore:()=>({delete(){},put(){}}),error:Error('quota')}}));
 const failed=failing.reclaimDerivedSearchIndex();await wait(0);transaction.onabort();await assert.rejects(failed,/quota/);
 let ready,transactions=0;const barrier=new Promise(resolve=>{ready=resolve});
 const stalled=isolatedPressure(()=>()=>barrier);
 await assert.rejects(stalled.reclaimDerivedSearchIndex(),/timed out/);
 ready({transaction:()=>{transactions++;throw Error('late cleanup')}});await wait(0);assert.equal(transactions,0);
});

test('the shared Mac runtime makes the same pressure decisions',async()=>{
 const context={performance,setTimeout,clearTimeout,AbortController,DOMException,crypto,TextEncoder};context.globalThis=context;
 for(const name of ['background-work','video-semantic','youtube-search-index-storage'])vm.runInNewContext(readFileSync(new URL(`../../App/Resources/frontend/${name}.js`,import.meta.url),'utf8'),context);
 let calls=0;const guard=context.LEARNED_MEDIA_STORAGE_PRESSURE.createStoragePressureGuard(async()=>({quota:0,usage:0}),async()=>{calls++});
 await guard(null,{bytes:LARGE});assert.equal(calls,1);
 assert.equal(await context.LEARNED_MEDIA_STORAGE_PRESSURE.approximateStoredBytes({title:'Tōhoku',cards:[{body:'Keep all original text.'}]}),await approximateStoredBytes({title:'Tōhoku',cards:[{body:'Keep all original text.'}]}));
});

test('every authoritative call site preflights before its write transaction',()=>{
 const workspace=readFileSync(new URL('../lib/workspaces.ts',import.meta.url),'utf8');
 for(const name of ['accountWorkspaceBackup','writeWorkspaceStore']) {
  const start=workspace.indexOf(`export async function ${name}`),body=workspace.slice(start,workspace.indexOf('\nexport ',start+1)===-1?undefined:workspace.indexOf('\nexport ',start+1));
  assert.ok(body.indexOf('prepareForStorageWrite')<body.indexOf('await openDatabase()'));
 }
 const lease=readFileSync(new URL('../lib/youtube-import-lease.ts',import.meta.url),'utf8');
 assert.ok(lease.indexOf('await prepareCatalogStorage(plan')<lease.indexOf('for (let start = 0; start < plan.upserts.length'));
 const native=readFileSync(new URL('../../App/Sources/LearnedMediaApp/main.swift',import.meta.url),'utf8');
 assert.ok(native.indexOf('StoragePressure.prepare(writeBytes: data.count')<native.indexOf('if let previous { try previous.bytes.write'));
 const frontend=readFileSync(new URL('../../App/Resources/frontend/app.js',import.meta.url),'utf8');
 assert.match(frontend,/createStoragePressureGuard\(function \(\) \{\s*return bridge\("storageEstimate", \{\}\)/);
 assert.match(native,/case "storageEstimate":[\s\S]*?workspace\.availableStorageBytes\(\)/);
});
