import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import vm from 'node:vm';
const require=createRequire(import.meta.url),Module=require('node:module'),ts=require('typescript');
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const engine=require('../lib/topic-suggestions.ts'),{createDefaultTopics}=require('../lib/demo-data.ts'),{flattenTopics}=require('../lib/topic-catalog.ts');
const topics=flattenTopics(createDefaultTopics()),index=engine.createTopicSuggestionIndex(topics);
const labels=r=>r.suggestions.map(s=>s.label),matched=r=>r.matchedIds.map(id=>index.byId.get(id).topic.label);
test('paraphrases match meaning in dropdown and tree without original words',()=>{const r=engine.searchTopicIndex(index,'why does the ground shake');assert.ok(r.completeCoverage);assert.ok(matched(r).includes('Earthquakes'));assert.equal(r.suggestions.length,100);assert.equal(new Set(r.suggestions.map(s=>s.id)).size,100);assert.ok(r.suggestions.every(s=>s.group!=='keyword'));assert.ok(r.visibleIds.length>r.matchedIds.length);});
test('geographic context prioritizes Japanese earthquakes and excludes other countries from tree',()=>{const r=engine.searchTopicIndex(index,'earthquakes in Japan');assert.ok(labels(r).slice(0,5).includes('2011 Tōhoku Earthquake'));assert.ok(matched(r).includes('1923 Great Kantō Earthquake'));assert.ok(!matched(r).includes('2023 Turkey–Syria Earthquakes'));assert.ok(!matched(r).includes('Japan'));});
test('AND coverage, partial recommendations and whole either/or clauses are distinct',()=>{const and=engine.searchTopicIndex(index,'earthquakes and psychology');assert.equal(and.completeCoverage,false);assert.equal(and.matchedIds.length,0);assert.ok(and.suggestions.some(s=>s.group==='broader'));const or=engine.searchTopicIndex(index,'earthquakes in Japan or volcanoes in Italy');assert.ok(matched(or).includes('2011 Tōhoku Earthquake'));assert.ok(!matched(or).includes('Japan'));assert.ok(!matched(or).includes('2023 Turkey–Syria Earthquakes'));});
test('unrelated input uses Explore more and cannot appear in tree',()=>{const r=engine.searchTopicIndex(index,'zzzyxq');assert.equal(r.suggestions.length,100);assert.ok(r.suggestions.every(s=>s.group==='explore'));assert.equal(r.visibleIds.length,0);assert.equal(r.completeCoverage,false);assert.equal(engine.shouldEnrichTopics('zzzyxq',false),false);assert.equal(engine.shouldEnrichTopics('unknown meaningful phrase',false),true);assert.equal(engine.shouldEnrichTopics('ground shaking',true),false);});
test('keywords remain first and accents/capitalization/whitespace retain ordering',()=>{const a=engine.searchTopicIndex(index,'earthquake');assert.ok(a.suggestions[0].group==='keyword');const firstRelated=a.suggestions.findIndex(s=>s.group==='related');assert.ok(firstRelated<=10);assert.deepEqual(engine.searchTopicIndex(index,'  EARTHQUAKE  ').suggestions,a.suggestions);assert.deepEqual(engine.searchTopicIndex(index,'Tohoku').suggestions,engine.searchTopicIndex(index,'Tōhoku').suggestions);assert.ok(engine.searchTopicIndex(index,'tectonic').completeCoverage);});
test('custom topics and parent paths share the same index and contain no fact slots',()=>{const custom={id:'custom',label:'Quantum Gardens',path:['Custom','Quantum Gardens'],aliases:['imaginary horticulture'],custom:true};const r=engine.searchTopicIndex(engine.createTopicSuggestionIndex([...topics,custom]),'imaginary horticulture');assert.equal(r.suggestions[0].id,'custom');assert.ok(r.matchedIds.includes('custom'));assert.equal(r.suggestions.length,100);});
test('structured interpretations preserve each required idea and bound malformed output',()=>{const plan=engine.validateTopicPlan({groups:[{label:'quakes',equivalents:['earthquakes'],related:['volcanoes']},{label:'Japan',equivalents:['Japan'],related:[]}],alternatives:false});const r=engine.searchTopicIndex(index,'unrecognized wording',plan);assert.ok(matched(r).includes('2011 Tōhoku Earthquake'));assert.ok(!matched(r).includes('Japan'));assert.deepEqual(engine.validateTopicPlan({groups:[null,{equivalents:[1,'', 'x'.repeat(121)]}]}).groups,[]);assert.equal(engine.validateTopicPlan({groups:Array(20).fill({equivalents:Array(30).fill('earthquake'),related:[]})}).groups.length,8);});
test('shared generated Mac engine has identical matching, ordering and visibility',()=>{const scope={};vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/topic-semantic.js',import.meta.url),'utf8'),scope);const native=scope.LEARNED_MEDIA_TOPIC_SEARCH,nativeIndex=native.createTopicSuggestionIndex(topics);for(const q of ['why does the ground shake','earthquakes in Japan','how people think','zzzyxq'])assert.deepEqual(JSON.parse(JSON.stringify(native.searchTopicIndex(nativeIndex,q))),engine.searchTopicIndex(index,q));});
test('yielding fallback cancels stale work and agrees with synchronous ranking',async()=>{let current=true;const pending=engine.searchTopicIndexYielding(index,'ground shaking',[],()=>current);current=false;assert.equal(await pending,null);const r=await engine.searchTopicIndexYielding(index,'ground shaking');assert.deepEqual(r,engine.searchTopicIndex(index,'ground shaking'));});


test('topic suggestions report coverage and complete matches precede partial recommendations',()=>{
 const r=engine.searchTopicIndex(index,'earthquakes in Japan');
 const complete=r.suggestions.find(s=>s.label==='2011 Tōhoku Earthquake'),partial=r.suggestions.find(s=>s.label==='Japan');
 assert.ok(complete);assert.equal(complete.coverage.complete,true);assert.equal(complete.coverage.matchedConcepts.length,2);assert.deepEqual(complete.coverage.missingConcepts,[]);
 if(partial){assert.equal(partial.coverage.complete,false);assert.equal(partial.coverage.matchedConcepts.length,1);assert.equal(partial.coverage.missingConcepts.length,1);assert.ok(r.suggestions.indexOf(complete)<r.suggestions.indexOf(partial));}
 for(const section of ['keyword','related']){let sawPartial=false;for(const s of r.suggestions.filter(s=>s.group===section)){if(!s.coverage.complete)sawPartial=true;else assert.equal(sawPartial,false);}}
 assert.equal(r.suggestions.length,100);assert.equal(new Set(r.suggestions.map(s=>s.id)).size,100);
});

test('topic enrichment cannot convert AND to OR or drop concepts within an explicit alternative',()=>{
 const enrichment={groups:[{label:'quakes',equivalents:['earthquake'],related:[]},{label:'minds',equivalents:['psychology'],related:[]}],alternatives:true};
 const and=engine.searchTopicIndex(index,'earthquakes and psychology',enrichment);
 assert.equal(and.matchedIds.length,0);assert.equal(and.completeCoverage,false);
 const query='earthquakes in Japan or volcanoes in Italy';
 const or=engine.searchTopicIndex(index,query,{groups:[{label:'quakes',equivalents:['earthquake'],related:[]},{label:'volcanoes',equivalents:['volcano'],related:[]}],alternatives:true});
 assert.ok(matched(or).includes('2011 Tōhoku Earthquake'));assert.ok(!matched(or).includes('Japan'));assert.ok(!matched(or).includes('2023 Turkey–Syria Earthquakes'));
 const scope={};vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/topic-semantic.js',import.meta.url),'utf8'),scope);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.LEARNED_MEDIA_TOPIC_SEARCH.searchTopicIndex(scope.LEARNED_MEDIA_TOPIC_SEARCH.createTopicSuggestionIndex(topics),query,enrichment))),engine.searchTopicIndex(index,query,enrichment));
});


test('a broad astronomy alias cannot replace two explicitly requested subjects',()=>{
 const catalog=[{id:'stars',label:'Stars',path:['Astronomy','Stars']},{id:'planets',label:'Planets',path:['Astronomy','Planets']},{id:'both',label:'Stars and Planets',path:['Astronomy','Stars and Planets']}];
 const result=engine.searchTopicIndex(engine.createTopicSuggestionIndex(catalog),'stars and planets');
 assert.deepEqual(result.matchedIds,['both']);
 assert.ok(result.suggestions.find(s=>s.id==='stars').coverage.missingConcepts.length);
});


test('enrichment cannot merge earthquakes and Japan into interchangeable expressions',()=>{
 const result=engine.searchTopicIndex(index,'earthquakes in Japan',{groups:[{label:'combined',equivalents:['earthquake','Japan'],related:[]}],alternatives:true});
 assert.ok(matched(result).includes('2011 Tōhoku Earthquake'));assert.ok(!matched(result).includes('Japan'));assert.ok(!matched(result).includes('2023 Turkey–Syria Earthquakes'));
});

test('topic explanations identify actual names, aliases and paths while separating broader recommendations',()=>{
 const custom=engine.createTopicSuggestionIndex([{id:'root',label:'Science',path:['Science']},{id:'alias',label:'Moving Continents',aliases:['plate tectonics'],path:['Science','Moving Continents']},{id:'other',label:'Unrelated',path:['Science','Unrelated']}]);
 const result=engine.searchTopicIndex(custom,'plate tectonics');
 const match=result.suggestions.find(s=>s.id==='alias');assert.ok(match.coverage.complete);assert.ok(match.support.includes('Alias: “plate tectonics”'));
 const partial=engine.searchTopicIndex(custom,'plate tectonics and earthquakes').suggestions.find(s=>s.id==='alias');
 assert.equal(partial.group,'broader');assert.match(partial.explanation,/only part/);
});

test('one genuine topic match skips enrichment while a hundred fallback topics do not',()=>{
 const phrase='why does the ground shake',strong=engine.searchTopicIndex(index,phrase);
 assert.equal(engine.shouldEnrichTopics(phrase,strong.completeCoverage),false);
 const weakQuery='earthquakes and psychology',weak=engine.searchTopicIndex(index,weakQuery);
 assert.equal(weak.suggestions.length,100);assert.equal(engine.shouldEnrichTopics(weakQuery,weak.completeCoverage),true);
 assert.equal(engine.shouldEnrichTopics('show me topics',false),false);
});


test('hyphenated and spaced compounds retain prefixes and short components on web and Mac',()=>{
 const scope={};vm.runInNewContext(readFileSync(new URL('../../App/Resources/frontend/topic-semantic.js',import.meta.url),'utf8'),scope);
 const custom=['X-ray','X ray','Ray','Post-war','Post war','War','Non-Euclidean','Non Euclidean','Euclidean'].map((label,i)=>({id:'compound-'+i,label,path:['Custom',label]}));
 for(const search of [engine,scope.LEARNED_MEDIA_TOPIC_SEARCH]) {
  const ix=search.createTopicSuggestionIndex([...topics,...custom]);
  for(const [queries,expected,rejected] of [[['X-ray','x ray','X‑ray'],[0,1],2],[['post-war','post war','post–war'],[3,4],5],[['non-Euclidean','non Euclidean','non‑Euclidean'],[6,7],8]]) {
   let previous;
   for(const query of queries) {
    const result=search.searchTopicIndex(ix,query);
    assert.ok(result.completeCoverage,query);
    for(const i of expected) assert.ok(result.matchedIds.includes('compound-'+i),query);
    assert.ok(!result.matchedIds.includes('compound-'+rejected),query);
    assert.equal(result.suggestions.length,100);assert.equal(new Set(result.suggestions.map(s=>s.id)).size,100);
    const ordered=result.suggestions.map(s=>s.id);if(previous)assert.deepEqual(Array.from(ordered),Array.from(previous));previous=ordered;
   }
  }
 }
 const {searchTextForms}=require('../lib/search.ts');
 assert.deepEqual(searchTextForms('Non‑Euclidean'),['non-euclidean','non euclidean']);
});
