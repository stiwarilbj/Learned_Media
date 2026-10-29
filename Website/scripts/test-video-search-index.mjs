import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
const require = createRequire(import.meta.url), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const engine = require('../lib/video-semantic.ts');
const storage = require('../lib/youtube-search-index-storage.ts');
const video = (id, extra = {}) => ({id, title:'Gravitational lensing and black holes', description:'A galaxy bends distant light. Subscribe to our channel!\nMassive objects bend light near black holes.', channelId:'science', channelName:'Science Channel', tags:['astronomy'], topics:['Science'], publishedAt:'2024-05-01T12:00:00Z', durationSeconds:600, approved:true, ...extra});
const docs = [video('a'), video('b', {title:'Earthquakes in Japan', tags:['Tōhoku'], topics:['Geography']}), video('short', {tags:['#shorts']}), video('unapproved', {approved:false}), video('restricted', {channelId:'UCYO_jab_esuFRV4b17AJtAw',channelName:'3Blue1Brown',sourceIds:['playlist:other']}), video('allowed', {channelId:'UCYO_jab_esuFRV4b17AJtAw',channelName:'3Blue1Brown',sourceIds:['playlist:PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi']})];
const indexed = values => values.map(item => engine.indexVideoSearchMetadata(item));
const clone = value => structuredClone(value);
const shape = values => values.map(({video, ...match}) => ({id:video.id,...match}));
const native = {performance, setTimeout, clearTimeout, AbortController, DOMException, crypto, TextEncoder}; native.globalThis = native;
for (const name of ['background-work','video-semantic','youtube-search-index-storage']) vm.runInNewContext(readFileSync(new URL(`../../App/Resources/frontend/${name}.js`,import.meta.url),'utf8'),native);
const mac = native.LEARNED_MEDIA_VIDEO_SEARCH;
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
async function saved(values = docs) { const fingerprint = await engine.videoSearchCatalogFingerprint(values); return {fingerprint, value:await engine.serializeVideoSearchIndex(indexed(values),fingerprint)}; }

test('persisted derived fields round-trip exactly and original records retain ownership', async () => {
 const {fingerprint,value} = await saved();
 assert.deepEqual(Object.keys(value.records[0]),['id','normalizedChannelName','fields']);
 assert.deepEqual(Object.keys(value.records[0].fields[0]),['name','text']);
 for (const forbidden of ['description','tags','topics','sourceIds','approved','thumbnailUrl']) assert.ok(!Object.hasOwn(value.records[0],forbidden));
 const original = clone(docs), result = await engine.restoreVideoSearchIndex(original,clone(value),fingerprint);
 assert.deepEqual([...result.values()],indexed(original));
 assert.deepEqual(docs,original);assert.match(value.digest,/^[a-f0-9]{64}$/);
});

test('web and Mac preserve complete rankings, explanations and strict filters after restore',async()=>{
 const {fingerprint,value}=await saved();
 assert.equal(await mac.videoSearchCatalogFingerprint(clone(docs)),fingerprint);
 const restored=await engine.restoreVideoSearchIndex(docs,value,fingerprint);
 const nativeRestored=await mac.restoreVideoSearchIndex(clone(docs),clone(value),fingerprint);
 for(const query of ['gravitational lensing','earthquakes in Japan','black holes or earthquakes','lensing -galaxy','uploaded after 2023 gravitational lensing','under 20 minutes lensing']) {
  const plan=engine.makeLocalVideoPlan(query);
  for(const topic of ['All','Science','Geography']) for(const channel of [undefined,'science']) {
   const expected=shape(engine.searchSemanticVideos(docs,plan,topic,channel,80));
   assert.deepEqual(shape(engine.searchSemanticVideos([...restored.values()],plan,topic,channel,80)),expected,query);
   assert.deepEqual(JSON.parse(JSON.stringify(shape(mac.searchSemanticVideos([...nativeRestored.values()],plan,topic,channel,80)))),expected,query);
  }
 }
});

test('all source fields, catalog order and policy participate in cache identity',async()=>{
 const {fingerprint,value}=await saved();
 for(const change of [{title:'Changed'},{description:docs[0].description+' Late addition'},{channelId:'other'},{channelName:'Different'},{tags:['other']},{topics:['History']},{publishedAt:'2025-01-01'},{durationSeconds:42},{approved:false},{special:true},{sourceIds:['playlist:changed']}]) {
  const changed=docs.map((v,i)=>i===0?{...v,...change}:v), key=await engine.videoSearchCatalogFingerprint(changed);
  assert.notEqual(key,fingerprint,JSON.stringify(change));assert.equal(await engine.restoreVideoSearchIndex(changed,value,key),undefined);
 }
 assert.notEqual(await engine.videoSearchCatalogFingerprint([...docs].reverse()),fingerprint);
 assert.notEqual(await engine.videoSearchCatalogFingerprint(docs.slice(1)),fingerprint);
 for(const v of [{...value,policy:value.policy+1},{...value,format:value.format+1}])assert.equal(await engine.restoreVideoSearchIndex(docs,v,fingerprint),undefined);
 assert.equal(await engine.videoSearchCatalogFingerprint(docs.map(v=>({...v,thumbnailUrl:'changed'}))),fingerprint);
});

test('corrupt, malformed, truncated and expired caches safely rebuild',async()=>{
 const {fingerprint,value}=await saved();const bad=[];
 for(const alter of [v=>v.records.pop(),v=>v.records[0].fields.pop(),v=>v.records[0].fields[0].text='corrupted',v=>v.records[0].id='different',v=>v.records[0].normalizedChannelName=null,v=>v.records[0].fields[0].text=null]){const v=clone(value);alter(v);bad.push(v);}
 bad.push(null,[],{},'broken',{...value,savedAt:Date.now()-8*24*60*60*1000},{...value,savedAt:Date.now()+120000},{...value,digest:'wrong'});
 for(const v of bad)assert.equal(await engine.restoreVideoSearchIndex(docs,v,fingerprint),undefined);
 const fallback=storage.createVideoSearchIndexLoader(storage.createVideoSearchIndexPersistence({read:async()=>bad[0],write:async()=>{}}));
 assert.deepEqual(await fallback.load(docs),indexed(docs));
});

test('reload reuses cache and incremental changes reuse unchanged normalized fields',async()=>{
 const {value}=await saved();let writes=0,reads=0;
 const persistence=storage.createVideoSearchIndexPersistence({read:async()=>{reads++;return clone(value)},write:async()=>{writes++}});
 const loader=storage.createVideoSearchIndexLoader(persistence), one=loader.load(docs);assert.strictEqual(one,loader.load(docs));
 const first=await one;assert.equal(reads,1);assert.equal(writes,0);assert.strictEqual(await loader.load(docs),first);
 const changed=[...docs.map((v,i)=>i===1?{...v,title:'A different title'}:v),video('new')];
 const next=await loader.load(changed);assert.equal(reads,1);
 assert.strictEqual(next[0].searchFields,first[0].searchFields);
 assert.notStrictEqual(next[1].searchFields[0],first[1].searchFields[0]);
 assert.strictEqual(next[1].searchFields[2],first[1].searchFields[2]);assert.equal(next.length,docs.length+1);
 await wait(1150);assert.equal(writes,1);
});

test('fallback preserves current display records, duplicate-ID order and supersession',async()=>{
 let resolve;const read=new Promise(r=>{resolve=r});
 const loader=storage.createVideoSearchIndexLoader({restore:()=>read,save:()=>{}});
 const early=loader.load([video('x'),video('x',{title:'Last occurrence'})]);
 const late=loader.load([video('y')]);resolve(undefined);
 await assert.rejects(early,{name:'AbortError'});assert.equal((await late)[0].id,'y');
 assert.equal((await loader.load([video('y',{thumbnailUrl:'new.jpg'})]))[0].thumbnailUrl,'new.jpg');
 const duplicates=await loader.load([video('x'),video('y'),video('x',{title:'Last occurrence'})]);
 assert.deepEqual(duplicates.map(v=>[v.id,v.title]),[['x','Last occurrence'],['y',video('y').title]]);
});

test('failing/unavailable storage falls back and a clean retry can reuse data',async()=>{
 const {value}=await saved();let fails=true;
 const persistence=storage.createVideoSearchIndexPersistence({read:async()=>{if(fails)throw new Error('blocked');return value},write:async()=>{throw new Error('quota')}});
 assert.equal(await persistence.restore(docs),undefined);fails=false;assert.ok(await persistence.restore(docs));
 assert.equal(storage.createVideoSearchIndexPersistence().enabled,false);
 const badStore=storage.createVideoSearchIndexStore(async()=>{throw new Error('unavailable')});
 await assert.rejects(badStore.read(),/unavailable/);await assert.rejects(badStore.write({}),/unavailable/);
});

test('IndexedDB acknowledgment waits for transaction completion and rejects aborts',async()=>{
 let transaction,committed;
 const database={transaction:()=>transaction={objectStore:()=>({get:()=>({result:{cached:true}}),put:value=>{committed=value;return {}}}),error:null}};
 const store=storage.createVideoSearchIndexStore(async()=>database);
 let settled=false;const read=store.read().then(v=>{settled=true;return v});await wait(0);assert.equal(settled,false);transaction.oncomplete();assert.deepEqual(await read,{cached:true});
 const write=store.write({derived:true});await wait(0);assert.deepEqual(committed,{derived:true});transaction.oncomplete();await write;
 const fail=store.write({bad:true});await wait(0);transaction.error=new Error('quota');transaction.onabort();await assert.rejects(fail,/quota/);
});

test('30,000-video cache retains scores, passages, ties and pagination',async()=>{
 const large=Array.from({length:30000},(_,i)=>video('video-'+i,{title:`Galaxy lensing observation ${i}`,description:'Distant starlight bends around a galaxy. '.repeat(12),tags:['gravitational lensing']}));
 const start=performance.now(),cold=indexed(large),built=performance.now();
 const fingerprint=await engine.videoSearchCatalogFingerprint(large),hashed=performance.now();
 const value=await engine.serializeVideoSearchIndex(cold,fingerprint),serialized=performance.now();
 const restored=[...(await engine.restoreVideoSearchIndex(large,value,fingerprint)).values()],end=performance.now();
 const prepared=engine.prepareSemanticVideoSearch(engine.makeLocalVideoPlan('gravitational lensing'),'All');const excluded=new Set();
 for(let page=0;page<3;page++){const expected=shape(engine.searchPreparedSemanticVideos(cold,prepared,80,excluded));assert.deepEqual(shape(engine.searchPreparedSemanticVideos(restored,prepared,80,excluded)),expected);for(const item of expected)excluded.add(item.id);}
 console.log(`30,000 videos: cold derive ${(built-start).toFixed(1)} ms; fingerprint ${(hashed-built).toFixed(1)} ms; serialize ${(serialized-hashed).toFixed(1)} ms; verified restore ${(end-serialized).toFixed(1)} ms; derived bytes ${Buffer.byteLength(JSON.stringify(value))}. No timing threshold.`);
});

test('a stalled database cannot block rebuilding or write after its deadline',async()=>{
 let opened,transactions=0;
 const open=new Promise(resolve=>{opened=resolve});
 const store=storage.createVideoSearchIndexStore(()=>open);
 await assert.rejects(store.write({derived:true}),/timed out/);
 opened({transaction:()=>{transactions++;throw new Error('late transaction')}});
 await wait(0);assert.equal(transactions,0,'a late database open never starts a timed-out write');
 let aborted=0;
 const blocked=storage.createVideoSearchIndexStore(async()=>({transaction:()=>({objectStore:()=>({get:()=>({})}),abort:()=>aborted++})}));
 await assert.rejects(blocked.read(),/timed out/);assert.equal(aborted,1);
});
