import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url),ts=require('typescript');
require('node:module')._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const web=require('../lib/topic-tree.ts'),catalog=require('../lib/topic-catalog.ts'),preferences=require('../lib/topic-preferences.ts'),youtube=require('../lib/youtube.ts'),storage=require('../lib/snapshot-validation.ts');
const scope={Map,Set,WeakMap,Date,Math,performance,TextEncoder};
runInNewContext(readFileSync(new URL('../../App/Resources/frontend/shared-policy.js',import.meta.url),'utf8'),scope);
const mac=scope.LEARNED_MEDIA_SHARED,clean=x=>JSON.parse(JSON.stringify(x));
const native=readFileSync(new URL('../../App/Resources/frontend/app.js',import.meta.url),'utf8');
function extract(name,next){return native.slice(native.indexOf('  function '+name+'('),native.indexOf('  function '+next+'('));}
test('complete finalized catalog, aliases, paths, order and defaults agree',()=>{
 assert.deepEqual(clean(mac.createCatalogTopics()),clean(catalog.createCatalogTopics()));
 assert.equal(mac.flattenTopics(mac.createCatalogTopics()).length,16097);
 assert.equal(mac.TOPIC_CATALOG_VERSION,catalog.TOPIC_CATALOG_VERSION);
 assert.deepEqual(clean(mac.DEFAULT_SETTINGS),require('../lib/demo-data.ts').DEFAULT_SETTINGS);
});
test('selection, weights, compact restoration and legacy custom IDs agree',()=>{
 let tree=catalog.createCatalogTopics();const leaf=web.flattenTopics(tree).find(x=>!x.children?.length);
 tree=web.toggleTopicSelection(tree,leaf.id);tree=web.updateTopicTree(tree,leaf.id,n=>({...n,weight:27}));
 tree=tree.concat({id:'legacy-c++',label:'C++',custom:true,weight:10,selected:true});
 const compact=preferences.compactTopicPreferences(tree);
 assert.deepEqual(clean(mac.restoreTopicPreferences(clean(compact))),clean(preferences.restoreTopicPreferences(compact)));
 assert.deepEqual(clean(mac.migrateTopicTree(clean(tree))),clean(web.migrateTopicTree(tree)));
 assert.equal(mac.selectedLeafCount(mac.restoreTopicPreferences(clean(compact))),2);
});
test('every approved identity, individual video and recency default is identical',()=>{
 for(const key of ['APPROVED_YOUTUBE_CHANNELS','APPROVED_INDIVIDUAL_VIDEOS','DEFAULT_YOUTUBE_RECENCY_PREFERENCES','YOUTUBE_TOPICS','YOUTUBE_CATALOG_VERSION'])assert.deepEqual(clean(mac.youtube[key]),clean(youtube[key]));
 assert.ok(mac.youtube.APPROVED_INDIVIDUAL_VIDEOS.some(v=>(v.videoId || v.id)==='QTQVZuBV9oA'));
});
test('native discovery topic restriction uses the catalog filter',()=>{
 const context={state:{youtube:{topic:'Science',videos:[{id:'a',topics:['Science']},{id:'b',topics:['History']}]}},window:{LEARNED_MEDIA_YOUTUBE:{filter:(videos,q,topic)=>videos.filter(v=>topic==='All'||v.topics.includes(topic))}}};
 runInNewContext(extract('discoveryVideos','videoTabs')+';result=discoveryVideos();',context);
 assert.deepEqual(clean(context.result).map(v=>v.id),['a']);
});
test('native fact memory retains string quotations and comparison signatures',()=>{
 const context={factFingerprint:()=> 'fingerprint',claimMemoryFingerprint:()=> 'claim'};
 runInNewContext(native.slice(native.indexOf('  function memoryEvidence('),native.indexOf('  const app ='))+';result=normalizeMemory({id:"card",title:"Title",body:"Body",sources:[{url:"https://en.wikipedia.org/wiki/Test"}],evidence:[{sourceIndex:0,quote:"Exact quote",section:"History"}]});',context);
 assert.deepEqual(clean(context.result.evidence),['Exact quote']);assert.equal(context.result.evidenceSections[0],'History');
 assert.equal(storage.validateSnapshot([clean(context.result)],'memory','save'),true);
});
test('card search includes the same original text on both platforms',()=>{
 const card={title:'Tōhoku',hook:'An observation',body:'Complete original body.',topicPath:['Science'],sources:[{title:'Earthquake'}]};
 assert.equal(mac.cards.cardSearchText(card),require('../lib/card-search-text.ts').cardSearchText(card));
});
test('bridge status and detail preferences are independent and scoped',()=>{
 assert.match(native,/card\.questionDetailed = !card\.questionDetailed/);
 assert.match(native,/answerDetailed=detailed/);
 assert.match(native,/card\.learnMoreSources=result\.citations/);
 const swift=readFileSync(new URL('../../App/Sources/LearnedMediaApp/main.swift',import.meta.url),'utf8');
 assert.match(swift,/activityKeys = \["prioritizeRecentByChannel"/);
 assert.match(swift,/scopedPayload\["requestId"\] = id/);
});
test('generated-file checks reject stale outputs without writing them',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'learned-readonly-'));try{
 const file=path.join(dir,'output');writeFileSync(file,'old');
 const helper=new URL('./generated-output.mjs',import.meta.url).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {writeFileSync} from ${JSON.stringify(helper)};writeFileSync(${JSON.stringify(file)},'new');`,'--','--check'],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.equal(readFileSync(file,'utf8'),'old');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('website and native content manifests match',()=>assert.deepEqual(JSON.parse(readFileSync(new URL('../public/release.json',import.meta.url))),JSON.parse(readFileSync(new URL('../../App/Resources/frontend/release.json',import.meta.url)))));
test('native measured rows use the viewport and shrink after closing panels',()=>{
 const frames=[];let resized;
 const main={clientHeight:100000,parentElement:null,getBoundingClientRect:()=>({top:0,bottom:100000}),overflowY:'visible'};
 function element(){return {style:{},dataset:{},children:[],isConnected:true,parentElement:main,appendChild(child){child.parentElement=this;this.children.push(child);},remove(){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);},contains:()=>false,getBoundingClientRect:()=>({top:0,bottom:100000})};}
 const context={Map,Set,Math,globalThis:null,document:{createElement:element,addEventListener(){},activeElement:null},window:{innerHeight:800,addEventListener(){},scrollBy(){}},getComputedStyle:el=>({overflowY:el.overflowY||'visible'}),requestAnimationFrame:fn=>(frames.push(fn),frames.length),cancelAnimationFrame(){},ResizeObserver:class{constructor(fn){resized=fn;}observe(){}unobserve(){}disconnect(){}}};context.globalThis=context;
 runInNewContext(readFileSync(new URL('../../App/Resources/frontend/windowed-list.js',import.meta.url),'utf8'),context);
 const host=context.LEARNED_MEDIA_WINDOWED.create(Array.from({length:1000},(_,id)=>({id})),{key:x=>x.id,render:element,estimatedHeight:400});
 for(let i=0;i<3&&frames.length;i++)frames.shift()();
 assert.ok(host.children.length<10,'must not render the complete document-sized main');
 const before=parseFloat(host.style.height);resized([{target:host.children[0],borderBoxSize:[{blockSize:200}]}]);
 assert.ok(parseFloat(host.style.height)<before,'closed panels must reduce the measured row height');
});

test('native compact navigation retains icon wrappers and the Explore icon',()=>{
 const css=readFileSync(new URL('../../App/Resources/frontend/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.top-nav-link > \.icon\s*\{ display: inline-flex/);
 assert.match(native,/compass: '<circle/);
});
for(const order of [['learn','question'],['question','learn']])test('native learning keeps drafts, detail labels and citations independent: '+order.join(' then '),async()=>{
 const card={id:'card',body:'Original fact',questionDetailed:true,questionHistory:[]},requests=new Map(),cache=new Map();
 const state={workspaceId:'workspace',keyEditEpoch:0,key:'fixture',cards:[card],errorByCard:{}};
 const context={state,generationToken:0,Map,Boolean,cardExplanations:{cardExplanationFingerprint:c=>c.body},scopedCacheKey:(_key,x)=>JSON.stringify(x),learningResponseCache:cache,render(){},mergeGeminiModelOutcomes(){},saveState(){},bridge(action,payload){assert.equal(action,'learn');return new Promise(resolve=>requests.set(payload.action,resolve));}};
 runInNewContext(native.slice(native.indexOf('  const learningTasks=new Map();'),native.indexOf('  function toggleCard('))+';api={runCardLearning};',context);
 const jobs={learn:context.api.runCardLearning(card,'learn'),question:context.api.runCardLearning(card,'question','Why?')};
 card.questionDetailed=false;
 for(const action of order){requests.get(action)({answer:action+' response',citations:[{title:action,url:'https://en.wikipedia.org/wiki/'+action}]});await jobs[action];}
 assert.equal(card.learnMoreSources[0].title,'learn');assert.equal(card.answerSources[0].title,'question');
 assert.equal(card.answerDetailed,true);assert.equal(card.questionDetailed,false);assert.equal(card.question,'Why?');
});
test('native stale learning completion cannot clear a newer operation',async()=>{
 const card={id:'card',body:'Original',questionDetailed:false},state={workspaceId:'old',keyEditEpoch:0,key:'fixture',cards:[card],errorByCard:{}};let resolve;
 const context={state,generationToken:0,Map,Boolean,cardExplanations:{cardExplanationFingerprint:c=>c.body},scopedCacheKey:()=> 'cache',learningResponseCache:new Map(),render(){},mergeGeminiModelOutcomes(){throw Error('stale outcome');},saveState(){throw Error('stale save');},bridge:()=>new Promise(done=>resolve=done)};
 runInNewContext(native.slice(native.indexOf('  const learningTasks=new Map();'),native.indexOf('  function toggleCard('))+';api={runCardLearning};',context);
 const task=context.api.runCardLearning(card,'question','Why?');state.workspaceId='new';state.questionLoading='new-card';
 resolve({answer:'Obsolete',citations:[]});await task;
 assert.equal(card.answer,undefined);assert.equal(state.questionLoading,'new-card');
});
