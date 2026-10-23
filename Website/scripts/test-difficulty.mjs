import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url), ts = require('typescript');
require('node:module')._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,filename);
const web=require('../lib/recommendations.ts');
const { canonicalRecord, nativeRecord }=require('../lib/cloud-records.ts');
const { validateSnapshot }=require('../lib/snapshot-validation.ts');
const scope={};
runInNewContext(readFileSync(new URL('../../App/Resources/frontend/difficulty.js',import.meta.url),'utf8'),scope);
const mac=scope.LEARNED_MEDIA_DIFFICULTY, clean=value=>JSON.parse(JSON.stringify(value));
const topic=['Science','Earthquakes'], key=web.topicKey(topic);
const current=(profile,baseline=5)=>web.getTopicLearningProfile(profile,topic,baseline);
function rate(profile,id,feedback='heard',previous,baseline=5,engine=web) {
  return engine.recordTopicFeedback(profile,topic,feedback,baseline,id,previous).profile;
}
for (const [name,engine] of [['web',web],['Mac',mac]]) {
  test(name+': three distinct Heard cards in five raise once; Unknown never eases',()=>{
    let profile={};
    for (let i=0;i<40;i++) profile=rate(profile,'unknown'+i,'unknown',undefined,5,engine);
    assert.equal(current(profile).targetDifficulty,5); assert.equal(current(profile).recentFeedback.length,5);
    profile=rate(profile,'a','heard',undefined,5,engine); profile=rate(profile,'b','unknown',undefined,5,engine);
    profile=rate(profile,'c','heard',undefined,5,engine); profile=rate(profile,'d','unknown',undefined,5,engine);
    assert.equal(current(profile).targetDifficulty,5);
    profile=rate(profile,'e','heard',undefined,5,engine);
    assert.equal(current(profile).targetDifficulty,6); assert.equal(current(profile).recentFeedback.length,0);
    assert.equal(current(profile).heard,3); assert.equal(current(profile).unknown,42);
  });
  test(name+': repeat clicks and edits cannot reuse consumed or evicted cards',()=>{
    let profile=rate({},'a','heard',undefined,5,engine);
    assert.deepEqual(clean(rate(profile,'a','heard',undefined,5,engine)),clean(profile));
    profile=rate(profile,'a','unknown','heard',5,engine);
    assert.equal(current(profile).heard,0);assert.equal(current(profile).unknown,1);
    profile=rate(profile,'a','heard','unknown',5,engine);
    profile=rate(profile,'b','heard',undefined,5,engine);
    profile=rate(profile,'c','heard',undefined,5,engine);
    assert.equal(current(profile).targetDifficulty,6);
    for(let i=0;i<8;i++) {
      profile=rate(profile,'a','unknown','heard',5,engine);
      profile=rate(profile,'a','heard','unknown',5,engine);
    }
    assert.equal(current(profile).targetDifficulty,6);assert.equal(current(profile).recentFeedback.length,0);
    for(let i=0;i<6;i++)profile=rate(profile,'u'+i,'unknown',undefined,5,engine);
    profile=rate(profile,'u0','heard','unknown',5,engine);
    assert.ok(!current(profile).recentFeedback.some(item=>item.cardId==='u0'));
    assert.equal(current(profile).targetDifficulty,6);
  });
  test(name+': bounds, resets and old profiles retain totals without importing old streaks',()=>{
    for(let baseline=1;baseline<=10;baseline++) {
      let profile={};
      for(let i=0;i<30;i++)profile=rate(profile,'h'+i,'heard',undefined,baseline,engine);
      assert.equal(current(profile,baseline).targetDifficulty,Math.min(10,baseline+2));
      const reset=engine.resetTopicLearningProfiles(profile,baseline);
      assert.equal(current(reset,baseline).targetDifficulty,baseline);
      assert.equal(current(reset,baseline).heard,30);assert.equal(current(reset,baseline).recentFeedback.length,0);
    }
    const legacy={[key]:{heard:100,unknown:200,unknownStreak:20,targetDifficulty:10}};
    const restored=engine.normalizeLearningProfile(legacy,5);
    assert.equal(current(restored).targetDifficulty,7);assert.equal(current(restored).heard,100);
    assert.equal(current(restored).unknown,200);assert.equal(current(restored).recentFeedback.length,0);
    assert.equal(current({[key]:{...legacy[key],targetDifficulty:1}}).targetDifficulty,3);
    assert.equal(engine.getTopicLearningProfile({},topic,10).targetDifficulty,10);
    assert.equal(engine.getTopicLearningProfile(restored,['History','Earthquakes'],5).targetDifficulty,5);
  });
}
test('ten levels and native runtime share exact rules and canonical topic keys',()=>{
  assert.equal(web.topicKey([' SCIENCE ','Earthquakes ']),key);
  assert.equal(mac.topicKey([' SCIENCE ','Earthquakes ']),key);
  const all=[];
  for(let level=1;level<=10;level++) {
    const rubric=web.difficultyRubric(level);all.push(rubric);
    assert.equal(mac.difficultyRubric(level),rubric);
    assert.ok(rubric.includes('clear eighth-grade English'));
    assert.ok(rubric.includes('Keep the assigned sentence count'));
    assert.equal(rubric.includes('non-lead'),level>=5);
    assert.equal(rubric.includes('exceptionally obscure'),level===10);
  }
  assert.equal(new Set(all.map(rule=>rule.replace(/Difficulty \d+\/10:/,''))).size,10);
  assert.equal(web.difficultyRubric(NaN),web.difficultyRubric(5));
  assert.equal(web.difficultyRubric(99),web.difficultyRubric(10));
});
test('five-entry optional windows survive JSON/cloud/native exchange, invalid entries are dropped',()=>{
  let profile=rate({},'a','heard');profile=rate(profile,'b','unknown');
  const record={id:'w',name:'Workspace',createdAt:'2026-10-23T00:00:00Z',updatedAt:'2026-10-23T00:00:00Z',state:{
    persistenceVersion:2,settings:{obscurity:5,sentenceLength:3,displayMode:'text'},topics:[],cards:[],learningProfile:profile
  }};
  const exchanged=canonicalRecord(nativeRecord(clean(record)));
  assert.deepEqual(exchanged.state.learningProfile,profile);
  assert.equal(validateSnapshot(exchanged.state,'state','load'),true);
  assert.deepEqual(clean(mac.normalizeLearningProfile(exchanged.state.learningProfile,5)),web.normalizeLearningProfile(profile,5));
  const invalid={[key]:{...current(profile),recentFeedback:[null,{cardId:'x',feedback:'bad'},{cardId:'y',feedback:'heard'},{cardId:'y',feedback:'heard'}]}};
  assert.deepEqual(current(invalid).recentFeedback,[{cardId:'y',feedback:'heard'}]);
  const reset=web.resetTopicLearningProfiles(profile,4);
  assert.equal(current(reset,4).heard,1);assert.equal(current(reset,4).unknown,1);
  assert.deepEqual(current(reset,4).recentFeedback,[]);
});
test('actual Mac feedback handler and generation lookup use the shared topic key',()=>{
  const source=readFileSync(new URL('../../App/Resources/frontend/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('  function weightedTopicPaths('),source.indexOf('  function updateTopicById('))
    +source.slice(source.indexOf('  function recordFeedback('),source.indexOf('  async function signIn('));
  const state={settings:{obscurity:5},profile:{},cards:['a','b','c'].map(id=>({id,topicPath:topic}))};
  const context={state,difficultyEngine:mac,selectedTopics:()=>[{path:topic}],flatTopics:()=>[],showToast:()=>{},saveState:()=>{},render:()=>{}};
  runInNewContext(code+'; recordFeedback("a","heard");recordFeedback("b","heard");recordFeedback("c","heard");result=weightedTopicPaths(1);',context);
  assert.equal(context.result[0].difficulty,6);
  assert.equal(state.profile[key].targetDifficulty,6);
  assert.equal(state.profile['Science / Earthquakes'],undefined);
});
test('actual React handler preserves three rapid actions before a render and ignores repeated clicks',()=>{
  const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
  const start=source.indexOf('  const handleCardAction =');
  const handler=source.slice(start,source.indexOf('  const performResetAllPreferences',start));
  const setterStart=source.indexOf('  const setLearningProfile = useCallback');
  const setter=source.slice(setterStart,source.indexOf('  const [feedHasMore',setterStart));
  const cards=['a','b','c'].map(id=>({id,topicPath:topic}));
  const context={useCallback:fn=>fn,cards:[],cardsRef:{current:cards},learningProfileRef:{current:{}},settings:{obscurity:5},
    recordTopicFeedback:web.recordTopicFeedback,normalizeDifficulty:web.normalizeDifficulty,archiveFacts:()=>{},setCards:()=>{},
    setLearningProfileState:()=>{},setToast:()=>{},startFeed:()=>{},setRabbitHole:()=>{}};
  const code=ts.transpileModule(setter+handler+'handleCardAction("a","heard");handleCardAction("b","heard");handleCardAction("c","heard");handleCardAction("c","heard");',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(code,context);
  assert.equal(context.learningProfileRef.current[key].targetDifficulty,6);
  assert.equal(context.learningProfileRef.current[key].heard,3);
});
