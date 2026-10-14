import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {test} from 'node:test';
const require=createRequire(import.meta.url), Module=require('node:module'), ts=require('typescript');
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const engine=require('../lib/video-semantic.ts');
const native={};vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/video-semantic.js',import.meta.url),'utf8'),native);
const defaults={channelId:'c1',channelName:'Approved Science',description:'',tags:[],topics:['Science'],publishedAt:'2024-05-01T12:00:00Z',durationSeconds:600,approved:true};
const video=(id,title,extra={})=>({...defaults,id,title,...extra});
const videos=[video('lens','Gravitational Lensing Explained'),video('description','Cosmic Mirrors',{description:'Massive galaxies create gravitational lensing of distant objects.'}),video('generic','Science Facts'),video('both','Black Holes and Gravitational Lensing'),video('hole','Black Holes Explained'),video('short','Gravitational Lensing #shorts'),video('unapproved','Gravitational Lensing',{approved:false}),video('channel','Gravitational Lensing',{channelId:'c2'}),video('sponsor','Science Facts',{description:'Our sponsor offers gravitational lensing shirts. Subscribe for more!'})];
const ids=(values)=>values.map(x=>x.video.id);
test('paraphrases retrieve metadata evidence without literal wording or generic topic matches',()=>{
 const plan=engine.makeLocalVideoPlan('bending starlight');
 const result=engine.searchSemanticVideos(videos,plan,'All','c1');
 assert.deepEqual(ids(result),['lens','both','description']);
 assert.ok(result.find(x=>x.video.id==='description').supportingText.some(x=>x.includes('gravitational lensing')));
});
test('every concept is required and either/or preserves alternatives',()=>{
 assert.deepEqual(ids(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan('black holes and bending starlight'),'All','c1')),['both']);
 assert.deepEqual(new Set(ids(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan('black holes or bending starlight'),'All','c1'))),new Set(['lens','description','both','hole']));
});
test('interpreted synonyms satisfy required groups without original query tokens',()=>{
 const local=engine.makeLocalVideoPlan('bending starlight');
 const plan=engine.mergeVideoSearchPlans(local,{terms:['bending starlight'],topics:['Nature'],conceptGroups:[{terms:['bending starlight','gravitational lensing'],required:true}]},[]);
 assert.equal(plan.topics,undefined);assert.deepEqual(plan.topicHints,['Nature']);
 assert.ok(engine.semanticCoverage(videos[0],plan));assert.ok(engine.searchSemanticVideos(videos,plan).length);
});
test('explicit filters remain strict and historical dates remain content',()=>{
 const channels=[{id:'c1',name:'Approved Science'},{id:'c2',name:'Other Science'}];
 const plan=engine.makeLocalVideoPlan('bending starlight from Approved Science uploaded since 2024 under 11 minutes without black holes',channels);
 assert.equal(plan.channelId,'c1');assert.equal(plan.minDate,'2024-01-01');assert.equal(plan.maxDurationSeconds,659);
 assert.deepEqual(ids(engine.searchSemanticVideos(videos,plan)),['lens','description']);
 assert.equal(engine.makeLocalVideoPlan('Europe after 1800').minDate,undefined);
 assert.equal(engine.makeLocalVideoPlan('Europe after 1800').conceptGroups.some(g=>g.terms.includes('1800')),true);
 assert.deepEqual(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan('bending starlight from Other Science',channels,'c1'),'All','c1'),[]);
 const merged=engine.mergeVideoSearchPlans(plan,{terms:['gravitational lensing'],minDurationSeconds:1,channel:'Missing'},channels);
 assert.equal(merged.maxDurationSeconds,659);assert.equal(merged.channelId,'c1');assert.equal(merged.minDurationSeconds,undefined);assert.deepEqual(ids(engine.searchSemanticVideos(videos,merged)),['lens','description']);
});
test('empty, rare, unrelated, stopword and excluded queries do not fill with random videos',()=>{
 for(const query of ['','the and of','quincunx fractal civilizations','bending starlight without gravitational lensing']) assert.deepEqual(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan(query)),[]);
 assert.ok(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan('uploaded since 2024')).length);
 assert.deepEqual(engine.searchSemanticVideos(videos,engine.makeLocalVideoPlan('uploaded after 2024')),[]);
 assert.ok(engine.searchSemanticVideos([video('long','A Short History of Gravitational Lensing')],engine.makeLocalVideoPlan('bending starlight')).length,'ordinary short-history titles are not Shorts');
});
test('pagination can access every unique matching result beyond the old 80-video cap',()=>{
 const catalog=Array.from({length:241},(_,i)=>video('item-'+i,'Gravitational Lensing '+i));
 const plan=engine.makeLocalVideoPlan('bending starlight');let seen=[];
 for(let i=0;i<4;i++){const next=engine.searchSemanticVideos(catalog,plan,'All',undefined,80,seen);seen.push(...ids(next));}
 assert.equal(seen.length,241);assert.equal(new Set(seen).size,241);
});
test('native runtime and website use identical query plans, strict filters and scores',()=>{
 for(const query of ['bending starlight','black holes and bending starlight','black holes or bending starlight','uploaded after 2024 under 11 minutes','bending starlight without black holes']){
  const plan=engine.makeLocalVideoPlan(query);
  assert.deepEqual(JSON.parse(JSON.stringify(native.LEARNED_MEDIA_VIDEO_SEARCH.makeLocalVideoPlan(query))),JSON.parse(JSON.stringify(plan)));
  assert.deepEqual(JSON.parse(JSON.stringify(native.LEARNED_MEDIA_VIDEO_SEARCH.searchSemanticVideos(videos,plan,'All','c1'))),engine.searchSemanticVideos(videos,plan,'All','c1'));
 }
});
test('yielding fallback cancels obsolete scans and preserves ordering',async()=>{
 const catalog=Array.from({length:1000},(_,i)=>video('item-'+i,'Gravitational Lensing '+i));
 const plan=engine.makeLocalVideoPlan('bending starlight'),controller=new AbortController();
 const work=engine.searchSemanticVideosYielding(catalog,plan,'All',undefined,80,[],controller.signal);controller.abort();
 await assert.rejects(work,{name:'AbortError'});
 assert.deepEqual(await engine.searchSemanticVideosYielding(catalog,plan),engine.searchSemanticVideos(catalog,plan));
});
test('sorting and pagination honor the whole catalog and exact duration boundaries',()=>{
 const catalog=Array.from({length:200},(_,i)=>video('item-'+i,'Gravitational Lensing '+i,{publishedAt:new Date(Date.UTC(2020,0,1+i)).toISOString()}));
 const plan={...engine.makeLocalVideoPlan('bending starlight'),sort:'newest'};
 const first=engine.searchSemanticVideos(catalog,plan);
 assert.equal(first[0].video.id,'item-199');
 assert.equal(engine.searchSemanticVideos(catalog,plan,'All',undefined,80,ids(first))[0].video.id,'item-119');
 assert.deepEqual(engine.searchSemanticVideos([video('boundary','Gravitational Lensing',{durationSeconds:660})],engine.makeLocalVideoPlan('bending starlight under 11 minutes')),[]);
 assert.doesNotThrow(()=>engine.makeLocalVideoPlan('bending starlight uploaded after 2024-99-01'));
});
test('legacy interpreted plans retain multiple ideas rather than treating them as alternatives',()=>{
 const plan=engine.mergeVideoSearchPlans(engine.makeLocalVideoPlan('black holes bending starlight'),{terms:['black holes','gravitational lensing'],include:[]},[]);
 assert.deepEqual(ids(engine.searchSemanticVideos(videos,plan,'All','c1')),['both']);
});
test('supporting passages include matches late in a long metadata sentence',()=>{
 const long=video('long','Cosmic Images',{description:'A lengthy introduction '.repeat(35)+'ends with gravitational lensing of distant galaxies.'});
 const found=engine.searchSemanticVideos([long],engine.makeLocalVideoPlan('bending starlight'));
 assert.ok(found[0].supportingText[0].includes('gravitational lensing'));
});

test('related plan terms rank complete matches but never satisfy missing concepts',()=>{
 const plan={conceptGroups:[{label:'light bending',terms:['gravitational lensing'],related:['black holes'],required:true}]};
 const matches=engine.searchSemanticVideos(videos,plan,'All','c1');
 assert.ok(ids(matches).includes('both'));
 assert.ok(!ids(matches).includes('hole'),'related-only matches cannot satisfy lensing');
 const base=engine.searchSemanticVideos(videos,{conceptGroups:[{terms:['gravitational lensing'],required:true}]},'All','c1');
 assert.ok(matches.find(x=>x.video.id==='both').score>base.find(x=>x.video.id==='both').score);
 const legacy=engine.mergeVideoSearchPlans(engine.makeLocalVideoPlan('gravitational lensing'),{terms:['gravitational lensing'],alternatives:['black holes']},[]);
 assert.ok(!ids(engine.searchSemanticVideos(videos,legacy)).includes('hole'));
});


test('semantic output cannot add, remove, or override locally owned filters',()=>{
 const channels=[{id:'c1',name:'Approved Science'},{id:'c2',name:'Other Science'}];
 const local={...engine.makeLocalVideoPlan('bending starlight from Approved Science uploaded since 2024 under 11 minutes without black holes',channels),topics:['Science'],sort:'oldest'};
 const injected={channelId:'c2',channel:'Other Science',dateIntent:'event',minDate:'1900-01-01',maxDate:'2099-01-01',minDurationSeconds:0,maxDurationSeconds:99999,exclude:[],topics:['Nature'],sort:'random',conceptGroups:[{terms:['gravitational lensing'],required:true}]};
 const plan=engine.mergeVideoSearchPlans(local,injected,channels);
 for(const field of ['channelId','dateIntent','minDate','maxDate','minDurationSeconds','maxDurationSeconds','exclude','topics','sort']) assert.deepEqual(plan[field],local[field],field+' must stay local');
 const catalog=[...videos,video('old','Gravitational Lensing',{publishedAt:'2020-01-01'}),video('long','Gravitational Lensing',{durationSeconds:1000}),video('wrong-topic','Gravitational Lensing',{topics:['Nature']}),video('tag-short','Gravitational Lensing',{tags:['Shorts']})];
 assert.deepEqual(ids(engine.searchSemanticVideos(catalog,plan)),['lens','description']);
 assert.equal(engine.eligibleSemanticVideo(videos[0],plan,'All',undefined,new Set(['lens'])),false);
 const noFilters=engine.mergeVideoSearchPlans(engine.makeLocalVideoPlan('bending starlight'),{...injected,exclude:['gravitational lensing']},channels);
 for(const field of ['channelId','minDate','maxDate','minDurationSeconds','maxDurationSeconds']) assert.equal(noFilters[field],undefined,'model cannot invent '+field);
 assert.deepEqual(noFilters.exclude,[]);assert.ok(engine.searchSemanticVideos(videos,noFilters).length);
 assert.deepEqual(JSON.parse(JSON.stringify(native.LEARNED_MEDIA_VIDEO_SEARCH.mergeVideoSearchPlans(local,injected,channels))),JSON.parse(JSON.stringify(plan)));
 assert.deepEqual(JSON.parse(JSON.stringify(native.LEARNED_MEDIA_VIDEO_SEARCH.searchSemanticVideos(catalog,plan))),engine.searchSemanticVideos(catalog,plan));
 const unknown=engine.makeLocalVideoPlan('bending starlight channel Unknown',channels);
 assert.deepEqual(engine.searchSemanticVideos(catalog,engine.mergeVideoSearchPlans(unknown,injected,channels)),[]);
});

test('local upload and duration boundaries reject missing metadata and remain strict',()=>{
 const day='2024-05-01';
 const catalog=[video('start','Gravitational Lensing',{publishedAt:day+'T00:00:00Z'}),video('end','Gravitational Lensing',{publishedAt:day+'T23:59:59.999Z'}),video('before','Gravitational Lensing',{publishedAt:'2024-04-30T23:59:59.999Z'}),video('after','Gravitational Lensing',{publishedAt:'2024-05-02T00:00:00Z'}),video('unknown-date','Gravitational Lensing',{publishedAt:''})];
 assert.deepEqual(new Set(ids(engine.searchSemanticVideos(catalog,engine.makeLocalVideoPlan('bending starlight uploaded in '+day)))),new Set(['start','end']));
 assert.deepEqual(ids(engine.searchSemanticVideos(catalog,engine.makeLocalVideoPlan('bending starlight uploaded before '+day))),['before']);
 assert.deepEqual(ids(engine.searchSemanticVideos(catalog,engine.makeLocalVideoPlan('bending starlight uploaded after '+day))),['after']);
 const plan=engine.makeLocalVideoPlan('bending starlight over 5 minutes over 8 minutes under 20 minutes under 11 minutes');
 assert.equal(plan.minDurationSeconds,481);assert.equal(plan.maxDurationSeconds,659);
 assert.deepEqual(engine.makeLocalVideoPlan('bending starlight without black holes without galaxies').exclude,['black holes','galaxies']);
 assert.equal(engine.makeLocalVideoPlan('bending starlight uploaded since 2099 uploaded within the last year').minDate,'2099-01-01');
 assert.deepEqual(engine.searchSemanticVideos([video('unknown','Gravitational Lensing',{durationSeconds:NaN})],plan),[]);
 const datePlan=engine.makeLocalVideoPlan('bending starlight uploaded since 2024');
 assert.deepEqual(engine.searchSemanticVideos([video('old','Gravitational Lensing',{publishedAt:'2020-01-01'})],{...datePlan,dateIntent:'event'}),[]);
});
