import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const context={window:{},AbortController,setTimeout,clearTimeout};
vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/account-credentials.js',import.meta.url),'utf8'),context);
const {AccountCredentials}=context.window.LearnedMediaCredentials;
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
function harness(shared={remote:new Map(),local:new Map()}) {
 const h={...shared,keys:{},states:[],calls:[],offline:false};
 const io={
  async read(owner,provider){if(h.onRead)return h.onRead(owner,provider);return h.local.get(`${owner}:${provider}`);},
  async write(owner,provider,entry){if(entry) h.local.set(`${owner}:${provider}`,structuredClone(entry));else h.local.delete(`${owner}:${provider}`);},
  async load(owner,signal){h.calls.push(['load',owner]);if(h.offline)throw Error('offline');if(h.onLoad)return h.onLoad(owner,signal);return {...h.remote.get(owner)};},
  async save(owner,provider,value,signal){h.calls.push(['save',owner,provider,value]);if(h.offline)throw Error('offline');if(h.onSave)await h.onSave(owner,provider,value,signal);h.remote.set(owner,{...h.remote.get(owner),[provider]:value});},
  changed(keys){h.keys={...keys};},status(state,message){h.states.push({state,message});}
 };
 h.manager=new AccountCredentials(io);return h;
}

test('both providers restore on a new device and across sessions',async()=>{
 const first=harness();
 try {
  await first.manager.switchAccount(null);
  first.manager.edit('gemini','test-gemini');first.manager.edit('youtube','test-youtube');
  await first.manager.switchAccount('A');
  assert.deepEqual(first.remote.get('A'),{gemini:'test-gemini',youtube:'test-youtube'});
  assert.equal(first.local.has('null:gemini'),false);
  assert.equal(first.local.has('null:youtube'),false);
  for(const local of [new Map(),first.local]) {
   const next=harness({remote:first.remote,local});
   try {await next.manager.switchAccount('A');assert.deepEqual(next.keys,{gemini:'test-gemini',youtube:'test-youtube'});} finally {next.manager.dispose();}
  }
 } finally {first.manager.dispose();}
});

test('account changes and sign-out clear the previous account keys',async()=>{
 const h=harness();h.remote.set('A',{gemini:'A',youtube:'AY'});h.remote.set('B',{gemini:'B'});
 try {
  await h.manager.switchAccount('A');
  const wait=h.manager.switchAccount('B');assert.deepEqual(h.keys,{gemini:'',youtube:''});await wait;
  assert.deepEqual(h.keys,{gemini:'B',youtube:''});
  await h.manager.switchAccount(null);assert.deepEqual(h.keys,{gemini:'',youtube:''});
  assert.equal(h.calls.filter(c=>c[0]==='save').length,0);
 } finally {h.manager.dispose();}
});

test('existing remote keys win over legacy device imports',async()=>{
 const h=harness();h.remote.set('A',{gemini:'remote',youtube:''});
 h.local.set('null:gemini',{value:'legacy',pending:null});h.local.set('null:youtube',{value:'stale',pending:null});
 try {await h.manager.switchAccount(null);await h.manager.switchAccount('A');assert.deepEqual(h.keys,{gemini:'remote',youtube:''});assert.equal(h.calls.filter(c=>c[0]==='save').length,0);} finally {h.manager.dispose();}
});

test('offline edits and removals survive reload and sync only their provider',async()=>{
 const h=harness();h.remote.set('A',{gemini:'old',youtube:'other-device'});
 await h.manager.switchAccount('A');h.offline=true;
 h.manager.edit('gemini','');await h.manager.refresh();h.manager.dispose();
 assert.equal(h.local.get('A:gemini').pending,'edit');
 const next=harness(h);
 try {await next.manager.switchAccount('A');assert.equal(next.keys.gemini,'');assert.equal(next.remote.get('A').youtube,'other-device');assert.deepEqual(next.calls.filter(c=>c[0]==='save').map(c=>c.slice(2)),[['gemini','']]);} finally {next.manager.dispose();}
});

test('superseded account loads cannot publish or save into the next account',async()=>{
 const h=harness(),wait=deferred();h.onLoad=owner=>owner==='A'?wait.promise:Promise.resolve({gemini:'B'});
 try {
  const old=h.manager.switchAccount('A');await tick();
  await h.manager.switchAccount('B');wait.resolve({gemini:'A-secret'});await old;
  assert.deepEqual(h.keys,{gemini:'B',youtube:''});
  assert.equal(h.local.has('B:youtube'),false);
 } finally {h.manager.dispose();}
});

test('editing during a remote load keeps the latest local edit',async()=>{
 const h=harness(),wait=deferred();h.onLoad=()=>wait.promise;
 try {
  const loading=h.manager.switchAccount('A');await tick();h.manager.edit('gemini','new');wait.resolve({gemini:'old'});await loading;
  assert.equal(h.keys.gemini,'new');assert.equal(h.remote.get('A').gemini,'new');
 } finally {h.manager.dispose();}
});

test('editing during sign-in retires the guest copy after the account edit is durable',async()=>{
 const h=harness(),wait=deferred();h.local.set('null:gemini',{value:'legacy',pending:null});
 try {
  await h.manager.switchAccount(null);
  h.onRead=owner=>owner==='A'?wait.promise:Promise.resolve(undefined);
  const loading=h.manager.switchAccount('A');await tick();
  h.manager.edit('gemini','replacement');wait.resolve(undefined);await loading;
  assert.equal(h.remote.get('A').gemini,'replacement');assert.equal(h.local.has('null:gemini'),false);
  await h.manager.switchAccount(null);await h.manager.switchAccount('B');
  assert.deepEqual(h.keys,{gemini:'',youtube:''});assert.equal(h.remote.has('B'),false);
 } finally {h.manager.dispose();}
});

test('an old save cannot clear a newer edit or removal',async()=>{
 const h=harness(),wait=deferred();await h.manager.switchAccount('A');let first=true;
 h.onSave=async()=>{if(first){first=false;await wait.promise;}};
 try {
  h.manager.edit('gemini','one');const save=h.manager.refresh();await tick();h.manager.edit('gemini','');wait.resolve();await save;
  assert.equal(h.remote.get('A').gemini,'');assert.equal(h.local.get('A:gemini').pending,null);
  assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[3]),['one','']);
 } finally {h.manager.dispose();}
});

test('identical refreshes coalesce; fast edits save once with no secret diagnostics',async()=>{
 const h=harness(),wait=deferred();await h.manager.switchAccount('A');h.onLoad=()=>wait.promise;
 try {
  h.manager.edit('youtube','a');h.manager.edit('youtube','ab');h.manager.edit('youtube','final');
  const first=h.manager.refresh(),second=h.manager.refresh();assert.equal(first,second);wait.resolve({});await first;
  assert.deepEqual(h.calls.filter(c=>c[0]==='save').map(c=>c[3]),['final']);
  h.offline=true;await h.manager.refresh();assert.equal(h.states.at(-1).state,'error');
  assert.ok(!JSON.stringify(h.states).includes('final'));
 } finally {h.manager.dispose();}
});

test('remote updates and deletion tombstones reach an already signed-in session',async()=>{
 const h=harness();h.remote.set('A',{gemini:'one',youtube:'two'});
 try {await h.manager.switchAccount('A');h.remote.set('A',{gemini:'updated',youtube:''});await h.manager.refresh();assert.deepEqual(h.keys,{gemini:'updated',youtube:''});} finally {h.manager.dispose();}
});

test('workspace payloads and memory never contain credentials',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),ts=require('typescript'),Module=require('node:module');
 const previous=Module._extensions['.ts'];
 Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
 try {
  const {canonicalRecord,safeMemory}=require('../lib/cloud-records.ts');
  const record=canonicalRecord({id:'one',state:{settings:{apiKey:'secret',youtubeKey:'secret'},cards:[{geminiKey:'secret',access_token:'token'}]}});
  assert.ok(!JSON.stringify(record).includes('secret'));assert.ok(!JSON.stringify(safeMemory({id:'one',evidence:[{apiKey:'secret'}]})).includes('secret'));
 } finally {Module._extensions['.ts']=previous;}
});
