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
const web=require('../lib/topic-tree.ts'),catalog=require('../lib/topic-catalog.ts'),preferences=require('../lib/topic-preferences.ts'),youtube=require('../lib/youtube.ts'),storage=require('../lib/snapshot-validation.ts'),videoMetadata=require('../lib/video-metadata.ts');
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
test('native worker sender captures compact initialization, forced rebuild, and incremental payloads',()=>{
 const messages=[];
 class FakeWorker{postMessage(message){messages.push(message);}terminate(){}}
 const source={id:'compact-source',channelId:'approved-channel',channelName:'Approved Channel',title:'Gravitational lensing',description:'Full searchable description. '.repeat(12),tags:['astronomy','optics'],topics:['Science','Astronomy'],publishedAt:'2025-01-01T00:00:00Z',durationSeconds:642,approved:true,special:false,sourceIds:['playlist:approved'],thumbnailUrl:'https://example.test/full.jpg',thumbnailWidth:1280,thumbnailHeight:720,durationLabel:'10:42',embedAvailable:true,metadataRefreshedAt:1234,unrelatedImportField:'retain'};
 const state={youtube:{catalogVersion:3,videos:[source]}};
 const context={state,videoSearch:{VIDEO_SEMANTIC_VERSION:9},window:{LEARNED_MEDIA_VIDEO_METADATA:videoMetadata},shared:mac,youtubeIndexPolicy:'',youtubeIndexedVideos:null,youtubeIndexRevision:0,youtubeById:new Map(),youtubeVideosByTopic:new Map(),youtubeVideosByChannel:new Map(),youtubeSemanticWorker:null,youtubeSemanticWorkerFailed:false,youtubeWorkerPending:new Map(),youtubeSmartSearchCache:{clear(){}},preparedVideoSearchCache:{clear(){}},Worker:FakeWorker};
 const indexStart=native.indexOf('  function videoSearchIndex('),indexEnd=native.indexOf('\n  async function localVideoCandidates(',indexStart);
 runInNewContext(native.slice(indexStart,indexEnd)+';api={videoSearchIndex};',context);
 context.api.videoSearchIndex();
 assert.equal(messages.length,1);
 assert.equal(messages[0].type,'initialize');
 assert.deepEqual(clean(messages[0].videos[0]),clean(videoMetadata.toVideoSearchDocument(source)));
 assert.deepEqual(Object.keys(messages[0].videos[0]),['id','channelId','channelName','title','description','tags','topics','publishedAt','durationSeconds','approved','special','sourceIds']);
 assert.equal(state.youtube.videos[0].thumbnailUrl,source.thumbnailUrl,'the primary catalog retains complete display and import data');

 const displayUpdate={...source,thumbnailUrl:'https://example.test/updated.jpg',durationLabel:'10:43'};
 state.youtube.videos=[displayUpdate];context.api.videoSearchIndex();
 assert.equal(messages.length,1,'display-only changes do not send an incremental worker update');
 assert.equal(context.youtubeById.get(source.id).thumbnailUrl,displayUpdate.thumbnailUrl,'the main-thread comparison map still has the full newest record');

 const searchableUpdate={...displayUpdate,description:displayUpdate.description+'New searchable passage.'};
 state.youtube.videos=[searchableUpdate];context.api.videoSearchIndex();
 assert.equal(messages.length,2);assert.equal(messages[1].type,'update');
 assert.deepEqual(clean(messages[1].upserts[0]),clean(videoMetadata.toVideoSearchDocument(searchableUpdate)));
 assert.equal(messages[1].upserts[0].thumbnailUrl,undefined);

 context.api.videoSearchIndex(true);
 assert.equal(messages.length,3);assert.equal(messages[2].type,'initialize','forced rebuild uses compact initialization documents');
 assert.deepEqual(clean(messages[2].videos[0]),clean(videoMetadata.toVideoSearchDocument(searchableUpdate)));
 assert.equal(context.youtubeIndexedVideos[0].unrelatedImportField,'retain');

 const page=readFileSync(new URL('../../Website/app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/videos: nextVideos\.map\(toVideoSearchDocument\)/,'website rebuilds and initialization project documents');
 assert.match(page,/upserts: upserts\.map\(toVideoSearchDocument\)/,'website incremental updates project only changed searchable records');
 assert.match(page,/videos: initialVideos\.map\(toVideoSearchDocument\)/,'website startup projects initial records');
 assert.match(readFileSync(new URL('../../Website/workers/youtube-search.worker.ts',import.meta.url),'utf8'),/Map<string, SearchableVideoMetadata>/);
});
test('website worker sender captures compact initialization, forced rebuild, and changed-only upserts',()=>{
 const page=readFileSync(new URL('../../Website/app/page.tsx',import.meta.url),'utf8');
 const start=page.indexOf('const syncYouTubeSearchIndex = useCallback('),end=page.indexOf('\n  }, []);',start);
 assert.ok(start>=0&&end>start,'locate the real website sender callback');
 const callback=page.slice(start+'const syncYouTubeSearchIndex = useCallback('.length,end+4);
 const compiled=require('typescript').transpileModule(`const syncYouTubeSearchIndex = ${callback}; globalThis.api = { syncYouTubeSearchIndex };`,{compilerOptions:{target:require('typescript').ScriptTarget.ES2022}}).outputText;
 const messages=[];
 const worker={postMessage(message){messages.push(message);}};
 const context={YOUTUBE_CATALOG_VERSION:youtube.YOUTUBE_CATALOG_VERSION,VIDEO_SEMANTIC_VERSION:9,toVideoSearchDocument:videoMetadata.toVideoSearchDocument,diffVideoSearchMetadata:videoMetadata.diffVideoSearchMetadata,setYoutubeSearchIndexRevision(){},youtubeSearchWorker:{current:worker},youtubeSearchWorkerReady:{current:true},youtubeSearchWorkerPendingVideos:{current:null},youtubeSearchWorkerIndexedVideos:{current:new Map()},youtubeSearchWorkerRevision:{current:0},youtubeSearchWorkerNeedsRebuild:{current:false},youtubeSearchWorkerPolicy:{current:''},youtubeSearchPending:{current:new Map()}};
 runInNewContext(compiled,context);
 const source={id:'web-video',channelId:'c',channelName:'Channel',title:'Gravitational lensing',description:'Complete description. '.repeat(10),tags:['astronomy'],topics:['Science'],publishedAt:'2025-01-01',durationSeconds:600,approved:true,special:false,sourceIds:['playlist:approved'],thumbnailUrl:'https://example.test/full.jpg',durationLabel:'10:00',embedAvailable:true};
 context.api.syncYouTubeSearchIndex([source]);
 assert.equal(messages[0].type,'initialize');
 assert.deepEqual(clean(messages[0].videos[0]),clean(videoMetadata.toVideoSearchDocument(source)));
 assert.equal(context.youtubeSearchWorkerIndexedVideos.current.get(source.id).thumbnailUrl,source.thumbnailUrl,'website index comparison map remains a full-record map');
 context.youtubeSearchWorkerReady.current=true; // emulate the worker's ready reply after initialization

 const displayOnly={...source,thumbnailUrl:'https://example.test/new.jpg',durationLabel:'10:01'};
 context.api.syncYouTubeSearchIndex([displayOnly]);
 assert.equal(messages.length,1,'display-only changes do not create worker updates');
 const changed={...displayOnly,description:displayOnly.description+'Added searchable content.'};
 context.api.syncYouTubeSearchIndex([changed]);
 assert.equal(messages.length,2);assert.equal(messages[1].type,'update');
 assert.deepEqual(clean(messages[1].upserts[0]),clean(videoMetadata.toVideoSearchDocument(changed)));
 assert.equal(messages[1].upserts[0].thumbnailUrl,undefined);

 context.api.syncYouTubeSearchIndex([changed],true);
 assert.equal(messages.length,3);assert.equal(messages[2].type,'initialize','forced rebuild posts projected documents');
 assert.deepEqual(clean(messages[2].videos[0]),clean(videoMetadata.toVideoSearchDocument(changed)));
});
test('approved channel pools and lossless YouTube activity merging match on web and Mac',()=>{
 const videos=Array.from({length:30000},(_,index)=>({id:String(index),approved:index%17!==0,title:index===15?'A #Shorts clip':'Video '+index,description:'',tags:[],channelName:'Channel',channelId:'c'+index%10,topics:index%2?['Science']:['History'],publishedAt:'2025-01-01'}));
 const websitePools=youtube.createYouTubeChannelPools(videos),nativePools=mac.youtube.createYouTubeChannelPools(videos);
 const poolIDs=pools=>Array.from(pools,([channelId,pool])=>[channelId,pool.map(video=>video.id)]);
 assert.deepEqual(clean(poolIDs(nativePools)),clean(poolIDs(websitePools)));
 for(const [channelId,pool] of websitePools){
  assert.deepEqual(pool.map(video=>video.id),youtube.filterYouTubeVideos(videos,'','All',channelId).map(video=>video.id));
  assert.ok(pool.every(video=>youtube.isApprovedYouTubeVideo(video)));
 }
 const legacy={savedIds:['legacy','shared'],history:[{videoId:'old'},{videoId:'same',watchedAt:'old'}],playbackPositions:{older:3,shared:4},prioritizeRecentByChannel:{'Crash Course':true,'History Matters':true}};
 const canonical={savedIds:['new','shared'],history:[{videoId:'newer'},{videoId:'same',watchedAt:'new'}],playbackPositions:{older:8,current:9},prioritizeRecentByChannel:{'Crash Course':false,'Mental Floss':false}};
 assert.deepEqual(clean(mac.youtube.mergeYouTubeActivity(legacy,canonical)),clean(youtube.mergeYouTubeActivity(legacy,canonical)));
});
test('large video grouping and progress batching match on website and Mac',()=>{
 const videos=Array.from({length:30000},(_,id)=>({id:String(id)}));
 const reasons={"7":{relevance:'broader'},"20000":{relevance:'broader'}};
 const websiteGroups=youtube.partitionYouTubeVideoResults(videos,reasons),nativeGroups=mac.youtube.partitionYouTubeVideoResults(videos,reasons);
 assert.deepEqual(clean(nativeGroups),clean(websiteGroups));
 const websiteUnsplit=youtube.partitionYouTubeVideoResults(videos,{}),nativeUnsplit=mac.youtube.partitionYouTubeVideoResults(videos,{});
 assert.equal(websiteUnsplit.strong,videos);assert.equal(nativeUnsplit.strong,videos);
 for(const createStore of [youtube.createYouTubeProgressStore,mac.youtube.createYouTubeProgressStore]){
  const frames=new Map();let nextFrame=0,notifications=0;
  const store=createStore({phase:'importing',completedChannels:0,totalChannels:4,importedVideos:0},callback=>{const id=++nextFrame;frames.set(id,callback);return {kind:'timeout',id};},frame=>frames.delete(frame.id));
  store.subscribe(()=>notifications++);
  store.publish({phase:'importing',completedChannels:0,totalChannels:4,importedVideos:0});
  store.publish({phase:'importing',completedChannels:1,totalChannels:4,importedVideos:10});
  store.publish({phase:'importing',completedChannels:2,totalChannels:4,importedVideos:20});
  assert.equal(notifications,0);
  [...frames.values()][0]();frames.clear();
  assert.equal(notifications,1);assert.equal(store.getSnapshot().importedVideos,20);
  store.publish({phase:'complete',completedChannels:4,totalChannels:4,importedVideos:30});
  assert.equal(notifications,2);assert.equal(store.getSnapshot().phase,'complete');
 }
});
test('a canceled native YouTube import cannot clear a newer attempt',async()=>{
 const pending=[];
 const state={youtubeKey:'fixture',youtube:{channels:[],videos:[],sourceStates:{},discoverIds:[],prioritizeRecentByChannel:{},incomplete:false},youtubeProgress:{phase:'idle'},connectionToken:0,youtubeStatus:'not-configured',youtubeError:''};
 const context={state,youtubeSyncActive:false,youtubeSyncToken:0,window:{LEARNED_MEDIA_YOUTUBE:{CHANNELS:[],YOUTUBE_CATALOG_VERSION:1,sync:()=>new Promise(resolve=>pending.push(resolve)),shuffle:()=>[]}},shared:{youtube:{YOUTUBE_CATALOG_VERSION:1}},publishNativeYouTubeProgress(progress){state.youtubeProgress=progress;},render(){},bridge:()=>Promise.resolve(),discoveryVideos:()=>[],videoSearchIndex(){},saveState(){},showToast(){},Date,Promise,Object,Boolean};
 context.state.youtube.discoverIds=[];
 runInNewContext(native.slice(native.indexOf('  function invalidateNativeYouTubeSync('),native.indexOf('  const videoSearch ='))+';api={youtubeConnect,invalidateNativeYouTubeSync};',context);
 const result={channels:[],videos:[],sourceStates:{},incomplete:false,lastSyncAt:'2026-10-25T00:00:00.000Z',progress:{},completedCheckpointSources:[]};
 context.api.youtubeConnect(false);
 assert.equal(pending.length,1);
 context.api.invalidateNativeYouTubeSync();
 state.connectionToken+=1;
 context.api.youtubeConnect(false);
 assert.equal(pending.length,2,'the next import should start immediately after cancellation');
 pending[0](result);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(context.youtubeSyncActive,true,'the stale attempt must not clear the replacement attempt’s active state');
 pending[1](result);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(context.youtubeSyncActive,false,'the current attempt clears its own active state on completion');
});
test('website YouTube progress ignores aborted imports and imports from another workspace',()=>{
 const page=readFileSync(new URL('../../Website/app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/!controller\.signal\.aborted && youtubeKeyRef\.current\.trim\(\) === keyAtStart && workspaceIdRef\.current === workspaceAtStart/);
 assert.match(page,/publishYouTubeImportProgress\(\{ phase: "idle", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS\.length, importedVideos: 0, completedSources: 0 \}, true\)/);
 assert.match(page,/if \(credentialOwner\.current !== owner\) \{\s*cancelWorkspaceRequests\(\);/);
 assert.match(native,/state\.account\?\.id !== result\.account\?\.id\) \{ cancelWorkspaceOperations\(\);/);
});
test('native Discover reuses strict topic pools instead of rescanning the catalog',()=>{
 const videos=[{id:'a',approved:true,title:'A',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['Science']},{id:'b',approved:true,title:'B',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['History']},{id:'short',approved:true,title:'A #Shorts clip',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['Science']}];
 let scans=0,indexes=0;
 const context={state:{youtube:{topic:'Science',videos}},youtubeIndexedVideos:null,youtubeVideosByTopic:new Map(),window:{LEARNED_MEDIA_YOUTUBE:{filter(){scans++;return [];}}}};
 context.videoSearchIndex=()=>{indexes++;context.youtubeIndexedVideos=context.state.youtube.videos;context.youtubeVideosByTopic=mac.youtube.createYouTubeTopicPools(context.state.youtube.videos);};
 runInNewContext(extract('discoveryVideos','relatedVideosFor')+';result=discoveryVideos();',context);
 assert.deepEqual(clean(context.result).map(v=>v.id),['a']);
 assert.equal(indexes,1);assert.equal(scans,0,'the cached pool should serve Discover directly');
});
test('native channel and Discover lists stay stable across unrelated activity changes',()=>{
 const videos=Array.from({length:30000},(_,index)=>({id:String(index),approved:index%17!==0,title:index===5?'A #Shorts clip':'Video '+index,description:'',tags:[],channelName:'Channel',channelId:'c'+index%10,topics:['Science'],publishedAt:new Date(Date.UTC(2025,0,index%28+1)).toISOString()}));
 const state={workspaceId:'workspace',youtube:{videos,savedIds:[],history:[],tab:'channels',searchText:'',smartRan:false,selectedChannelId:'c5',topic:'Science',order:'random',discoverIds:['5','15','25'],prioritizeRecentByChannel:{}}};
 let shuffles=0,filters=0;
 const context={state,youtubeIndexRevision:1,youtubeFilteredListMemo:mac.youtube.createYouTubeListMemo(),youtubeById:new Map(videos.map(video=>[video.id,video])),youtubeVideosByChannel:mac.youtube.createYouTubeChannelPools(videos),videoSearchIndex(){},window:{LEARNED_MEDIA_YOUTUBE:{filter(list,query,topic,channel){filters++;return youtube.filterYouTubeVideos(list,query,topic,channel);},shuffle(list){shuffles++;return [...list].reverse();}}}};
 runInNewContext(extract('youtubeFilteredVideos','discoveryVideos')+';api={youtubeFilteredVideos};',context);
 const first=context.api.youtubeFilteredVideos();
 assert.equal(first.length,youtube.filterYouTubeVideos(videos,'','Science','c5').length);
 state.youtube.savedIds=['5'];state.youtube.history=[{videoId:'15'}];
 assert.equal(context.api.youtubeFilteredVideos(),first,'saving and viewing history must not invalidate a channel list');
 assert.equal(shuffles,1,'a random channel must not reshuffle after saving a video');
 assert.equal(filters,1,'an indexed channel list must not rescan its 30,000-video catalog');
 state.youtube.tab='discover';state.youtube.selectedChannelId=undefined;
 const discover=context.api.youtubeFilteredVideos();
 state.youtube.savedIds=['25'];state.youtube.history=[{videoId:'5'}];
 assert.equal(context.api.youtubeFilteredVideos(),discover,'Saved and History changes must not invalidate Discover');
 assert.equal(filters,2,'Discover must filter only its loaded IDs after building indexed pools');
});
test('native playback preserves the channel/search origin and completed search identity',()=>{
 const anchor={dataset:{videoId:'anchor'},getBoundingClientRect:()=>({top:125,bottom:225})};
 const root={scrollTop:700,getBoundingClientRect:()=>({top:0,bottom:800})};
 const state={account:{id:'account'},workspaceId:'workspace',cloudOwnerId:'account',view:'videos',key:'fixture',youtube:{selectedVideoId:null,selectedChannelId:'channel',activeTab:'channels',searchText:'black holes',topic:'Science',order:'random',history:[]}};
 const context={state,document:{querySelector:()=>root,querySelectorAll:()=>[anchor]},getComputedStyle:()=>({overflowY:'auto'}),window:{scrollY:0,innerHeight:800},saveState(){},render(){},youtubeOwnerID:()=>state.account.id,scopedCacheKey:()=>"completed-search",videoSearch:{normalizeVideoQuery:value=>value.trim().toLowerCase()},videoSearchIndex(){},youtubeIndexRevision:1,youtubeSearchController:null,youtubeSmartSearchCalls:0,youtubeSmartSearch(){context.youtubeSmartSearchCalls++;},cancelYoutubeSearch(){context.youtubeSearchController=null;},youtubeSearchAutoKey:'completed-search'};
 const autoStart=native.indexOf('  function automaticYoutubeSearch('),autoEnd=native.indexOf('\n  async function showMoreYoutube',autoStart);
 const code='let playerEndedIdentity="",youtubeBrowseReturn=null;'+extract('youtubeOpenVideo','youtubeOpenChannel')+extract('youtubeBackToVideos','videoTabs')+native.slice(autoStart,autoEnd)+';api={youtubeOpenVideo,youtubeBackToVideos,automaticYoutubeSearch,get browseReturn(){return youtubeBrowseReturn;}};';
 runInNewContext(code,context);
 context.api.youtubeOpenVideo('first');
 assert.equal(state.youtube.selectedChannelId,'channel');
 assert.equal(state.youtube.searchText,'black holes');
 const originalReturn=context.api.browseReturn;
 assert.equal(originalReturn.anchorVideoID,'anchor');assert.equal(originalReturn.anchorOffset,125);
 context.api.youtubeOpenVideo('related');
 assert.equal(context.api.browseReturn,originalReturn,'related navigation should keep the original browse anchor');
 context.api.youtubeBackToVideos();
 assert.equal(state.youtube.selectedVideoId,null);
 assert.equal(state.youtube.selectedChannelId,'channel');
 assert.equal(state.youtube.searchText,'black holes');
 state.youtube.selectedVideoId='first';
 context.api.automaticYoutubeSearch();
 assert.equal(context.youtubeSearchAutoKey,'completed-search','opening the player keeps a completed search identity');
 state.youtube.selectedVideoId=null;
 context.api.automaticYoutubeSearch();
 assert.equal(context.youtubeSmartSearchCalls,0,'returning to completed results must not restart search');
 context.youtubeSearchAutoKey='completed-search';context.youtubeSearchController={};
 state.youtube.selectedVideoId='first';context.api.automaticYoutubeSearch();
 assert.equal(context.youtubeSearchAutoKey,'','only canceled unfinished work should be eligible to resume');
 state.youtube.selectedVideoId=null;context.api.automaticYoutubeSearch();
 assert.equal(context.youtubeSmartSearchCalls,1,'canceled unfinished search can resume when returning');
});
test('native checkpoint restoration prefers newer local playback and retains legacy activity',()=>{
 const record={id:'workspace',state:{youtube:{savedIds:['legacy'],history:[{videoId:'legacy-history'}],playbackPositions:{'old-video':4}},youtubeActivity:{savedIds:['canonical'],history:[{videoId:'canonical-history'}],playbackPositions:{'old-video':8}}}};
 const context={shared:mac,record,youtubeLivePlaybackCheckpoints:new Map([['account\0workspace',{videoID:'live-video',seconds:90,updatedAt:300}]]),Object,Number,String};
 const code=extract('mergeNativePlaybackCheckpoints','currentWorkspaceSnapshot')+';result=mergeNativePlaybackCheckpoints([record],"account",{workspace:{videoID:"saved-video",seconds:12,updatedAt:200}});';
 runInNewContext(code,context);
 const activity=context.result[0].state.youtubeActivity;
 assert.deepEqual(clean(activity.savedIds),['canonical','legacy']);
 assert.deepEqual(clean(activity.history.map(item=>item.videoId)),['canonical-history','legacy-history']);
 assert.deepEqual(clean(activity.playbackPositions),{'old-video':8,'live-video':90});
});
test('website player navigation preserves channel origin and separates All channels from Back to videos',()=>{
 const page=readFileSync(new URL('../../Website/app/page.tsx',import.meta.url),'utf8'),component=readFileSync(new URL('../../Website/components/learned-media/VideoWorkspace.tsx',import.meta.url),'utf8');
 assert.match(page,/return \{ \.\.\.current, selectedVideoId: id, history \}/,'opening a video should not discard the originating channel and query');
 assert.match(page,/onBack=\{backFromVideo\}/);assert.match(page,/onBackFromChannel=\{backFromChannel\}/);
 assert.match(page,/anchorVideoId: anchor\?\.dataset\.videoId/);assert.match(page,/origin\.anchorVideoId/);
 assert.match(component,/data-video-id=\{video\.id\}/);
 assert.match(component,/onClick=\{onBackFromChannel\}>[\s\S]*?All channels/);
 assert.match(component,/onClick=\{\(\) => \{ setEndedIdentity\(null\); onBack\(\); \}\}>[\s\S]*?Back to videos/);
});
test('related videos are computed only for the ended workspace-video identity and use topic pools',()=>{
 const videos=[{id:'current',approved:true,title:'Current',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['Science']},{id:'near',approved:true,title:'Nearby',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['Science']},{id:'other',approved:true,title:'Other',description:'',tags:[],channelName:'Channel',channelId:'c',publishedAt:'2025-01-01',topics:['History']}];
 let indexes=0;const context={playerEndedIdentity:'',state:{youtube:{videos,prioritizeRecentByChannel:{}}},youtubeVideosByTopic:mac.youtube.createYouTubeTopicPools(videos),videoSearchIndex(){indexes++;},shared:mac};
 runInNewContext(extract('relatedVideosFor','videoTabs')+';before=relatedVideosFor(state.youtube.videos[0],"workspace:current");playerEndedIdentity="workspace:current";after=relatedVideosFor(state.youtube.videos[0],"workspace:current");playerEndedIdentity="other:current";stale=relatedVideosFor(state.youtube.videos[0],"workspace:current");',context);
 assert.deepEqual(clean(context.before),[]);assert.equal(indexes,1);
 assert.ok(context.after.some(video=>video.id==='near'));assert.ok(context.after.every(video=>video.id!=='other'));
 assert.deepEqual(clean(context.stale),[]);assert.equal(indexes,1,'switching identities clears recs without recalculating them');
});
test('website defers related-video work until the active player ends',()=>{
 const component=readFileSync(new URL('../../Website/components/learned-media/VideoWorkspace.tsx',import.meta.url),'utf8');
 assert.match(component,/const relatedPool = useMemo\(\(\) => \{\s*if \(!ended \|\| !activeVideo\) return \[\];/);
 assert.match(component,/const related = useMemo\(\(\) => ended && activeVideo \? relatedYouTubeVideos\(relatedPool/);
 assert.match(component,/const activeIdentity = activeVideo \? `\$\{workspaceId\}:\$\{activeVideo\.id\}` : null;/);
 assert.match(component,/setEndedIdentity\(`\$\{workspaceId\}:\$\{activeVideo\.id\}`\)/);
 assert.match(component,/useEffect\(\(\) => \{ setEndedIdentity\(null\); \}, \[workspaceId\]\)/);
});
test('native selected-video lookup and playback checkpoints avoid full workspace saves',()=>{
 assert.doesNotMatch(native,/state\.youtube\.videos\.find\(function \(video\) \{ return video\.id === state\.youtube\.selectedVideoId/);
 const saveStart=native.indexOf('saveIntervalMs: 15000');const saveEnd=native.indexOf('\n        }',saveStart);const callback=native.slice(saveStart,saveEnd);
 assert.match(callback,/saveYouTubePlaybackCheckpoint/);assert.doesNotMatch(callback,/saveState\(/);
 assert.match(native,/function render\(\) \{\s*if\(state\.view !== "videos" && youtubeSearchController\) cancelYoutubeSearch\(\);\s*if\(state\.view === "videos"\) videoSearchIndex\(\)/);
 const swift=readFileSync(new URL('../../App/Sources/LearnedMediaApp/main.swift',import.meta.url),'utf8');
 assert.match(swift,/case "saveYouTubePlaybackCheckpoint"/);
 assert.match(swift,/youtubePlaybackCheckpoints\.mergingIntoSnapshot\(workspace\.load\(\)\)/);
 assert.match(swift,/workspace\.save\(youtubePlaybackCheckpoints\.mergingIntoSnapshot\(value\)\)/);
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
test('card-search callers register scoped ordered eligibility and reuse its revision while typing',()=>{
 const page=readFileSync(new URL('../../Website/app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/cardSearchEligibilityScope = JSON\.stringify\(\[account\?\.id \?\? "local", workspaceId, view\]\)/);
 assert.match(page,/type: "register-eligibility"[^\n]*eligibilityRevision: eligibility\.revision, ids: eligibility\.ids/);
 assert.match(page,/type: "search"[^\n]*eligibilityRevision: eligibility\.revision, viewKey: view/);
 assert.doesNotMatch(page.slice(page.indexOf('const cardSearchEligibilityScope'),page.indexOf('const cardById')),/eligibleIds/,'website queries carry the list revision rather than eligible IDs');

 const start=native.indexOf('  let nativeCardWorker='),end=native.indexOf('  function collectionView(',start);
 assert.ok(start>=0&&end>start,'locate the native card-search caller');
 const messages=[];
 class FakeWorker{postMessage(message){messages.push(message);}terminate(){}}
 const state={account:{id:'account-a'},workspaceId:'workspace-a',view:'feed',query:'first query',cards:[{id:'one',title:'First fact',saved:true},{id:'two',title:'Second fact',saved:false}]};
 const context={state,shared:{search:{normalizeSearchText:value=>String(value).toLowerCase().trim(),searchScoreNormalized:()=>0},cards:{cardSearchText:card=>card.title}},Worker:FakeWorker,render(){}};
 runInNewContext(native.slice(start,end)+';api={searchedCards};',context);
 context.api.searchedCards('feed');
 const firstRegistration=messages.find(message=>message.type==='register-eligibility');
 const firstSearch=messages.find(message=>message.type==='search');
 assert.deepEqual(clean(firstRegistration.ids),['one','two']);
 assert.equal(firstSearch.eligibilityRevision,firstRegistration.eligibilityRevision);
 state.query='second query';context.api.searchedCards('feed');
 assert.equal(messages.filter(message=>message.type==='register-eligibility').length,1,'typing another query does not resend the list');
 assert.equal(messages.filter(message=>message.type==='search').length,2);
 assert.equal(messages.at(-1).eligibilityRevision,firstRegistration.eligibilityRevision);
 assert.equal(messages.at(-1).eligibleIds,undefined);
 context.api.searchedCards('saved');
 const registrations=messages.filter(message=>message.type==='register-eligibility');
 assert.equal(registrations.length,2,'switching collection registers a separate list');
 assert.deepEqual(clean(registrations.at(-1).ids),['one']);
 assert.notEqual(registrations.at(-1).eligibilityScope,firstRegistration.eligibilityScope);
 assert.match(registrations.at(-1).eligibilityScope,/account-a.*workspace-a.*saved/);
});
test('bridge status and detail preferences are independent and scoped',()=>{
 assert.match(native,/card\.questionDetailed=!card\.questionDetailed/);
 assert.match(native,/Answer options/);
 for(const structure of ['automatic','short-explanation','ordered-steps','side-by-side-comparison'])assert.ok(native.includes(structure),`native menu includes ${structure}`);
 assert.match(native,/answerDetailed=questionResolution\?questionResolution\.effectiveDetailed/);
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
 const runtime={};runInNewContext(readFileSync(new URL('../../App/Resources/frontend/answer-structure.js',import.meta.url),'utf8'),runtime);
 const context={state,generationToken:0,Map,Boolean,window:{LEARNED_MEDIA_ANSWER_STRUCTURE:runtime.LEARNED_MEDIA_ANSWER_STRUCTURE},questionStructures:new Map(),questionStructureRevisions:new Map(),questionInstructionPreferences:new Map(),questionInstructionRevisions:new Map(),questionDrafts:new Map(),questionDraftKey:c=>state.workspaceId+'\0'+c.id,answerOptionsOpenKey:'',cardExplanations:{cardExplanationFingerprint:c=>c.body},scopedCacheKey:(_key,x)=>JSON.stringify(x),learningResponseCache:cache,render(){},mergeGeminiModelOutcomes(){},saveState(){},bridge(action,payload){assert.equal(action,'learn');return new Promise(resolve=>requests.set(payload.action,resolve));}};
 runInNewContext(native.slice(native.indexOf('  const learningTasks=new Map();'),native.indexOf('  function toggleCard('))+';api={runCardLearning};',context);
 const jobs={learn:context.api.runCardLearning(card,'learn'),question:context.api.runCardLearning(card,'question','Why?')};
 card.questionDetailed=false;
 for(const action of order){requests.get(action)({answer:action+' response',citations:[{title:action,url:'https://en.wikipedia.org/wiki/'+action}]});await jobs[action];}
 assert.equal(card.learnMoreSources[0].title,'learn');assert.equal(card.answerSources[0].title,'question');
 assert.equal(card.answerDetailed,true);assert.equal(card.questionDetailed,false);assert.equal(card.question,'Why?');
});
test('native stale learning completion cannot clear a newer operation',async()=>{
 const card={id:'card',body:'Original',questionDetailed:false},state={workspaceId:'old',keyEditEpoch:0,key:'fixture',cards:[card],errorByCard:{}};let resolve;
 const runtime={};runInNewContext(readFileSync(new URL('../../App/Resources/frontend/answer-structure.js',import.meta.url),'utf8'),runtime);
 const context={state,generationToken:0,Map,Boolean,window:{LEARNED_MEDIA_ANSWER_STRUCTURE:runtime.LEARNED_MEDIA_ANSWER_STRUCTURE},questionStructures:new Map(),questionStructureRevisions:new Map(),questionInstructionPreferences:new Map(),questionInstructionRevisions:new Map(),questionDrafts:new Map(),questionDraftKey:c=>state.workspaceId+'\0'+c.id,cardExplanations:{cardExplanationFingerprint:c=>c.body},scopedCacheKey:()=> 'cache',learningResponseCache:new Map(),render(){},mergeGeminiModelOutcomes(){throw Error('stale outcome');},saveState(){throw Error('stale save');},bridge:()=>new Promise(done=>resolve=done)};
 runInNewContext(native.slice(native.indexOf('  const learningTasks=new Map();'),native.indexOf('  function toggleCard('))+';api={runCardLearning};',context);
 const task=context.api.runCardLearning(card,'question','Why?');state.workspaceId='new';state.questionLoading='new-card';
 resolve({answer:'Obsolete',citations:[]});await task;
 assert.equal(card.answer,undefined);assert.equal(state.questionLoading,'new-card');
});
test('native question captures its structure and preserves a newer draft choice',async()=>{
 const card={id:'structured-card',body:'Original',questionDetailed:true,questionHistory:[]};
 const state={workspaceId:'workspace',keyEditEpoch:0,key:'fixture',cards:[card],errorByCard:{}};
 const runtime={};runInNewContext(readFileSync(new URL('../../App/Resources/frontend/answer-structure.js',import.meta.url),'utf8'),runtime);
 const key=state.workspaceId+'\0'+card.id,questionStructures=new Map([[key,'ordered-steps']]),questionStructureRevisions=new Map([[key,2]]),questionInstructionPreferences=new Map([[key,'settings']]),questionInstructionRevisions=new Map([[key,4]]),questionDrafts=new Map([[key,'Why did it fail? Answer in one sentence.']]);
 let request;
 const context={state,generationToken:0,Map,Boolean,window:{LEARNED_MEDIA_ANSWER_STRUCTURE:runtime.LEARNED_MEDIA_ANSWER_STRUCTURE},questionStructures,questionStructureRevisions,questionInstructionPreferences,questionInstructionRevisions,questionDrafts,questionDraftKey:c=>state.workspaceId+'\0'+c.id,cardExplanations:{cardExplanationFingerprint:c=>c.body},scopedCacheKey:(_key,x)=>JSON.stringify(x),learningResponseCache:new Map(),render(){},mergeGeminiModelOutcomes(){},saveState(){},bridge(action,payload){assert.equal(action,'learn');request=payload;return new Promise(resolve=>{context.resolve=resolve;});}};
 runInNewContext(native.slice(native.indexOf('  const learningTasks=new Map();'),native.indexOf('  function toggleCard('))+';api={runCardLearning};',context);
 const task=context.api.runCardLearning(card,'question','Why did it fail? Answer in one sentence.','ordered-steps',2,'settings',4);
 assert.equal(request.structure,'ordered-steps');assert.equal(request.detailed,true);
 assert.equal(request.instructionPreference,'settings');
 questionInstructionPreferences.set(key,'written');questionInstructionRevisions.set(key,5);questionDrafts.set(key,'A newer question');
 questionStructures.set(key,'side-by-side-comparison');questionStructureRevisions.set(key,3);
 context.resolve({directAnswer:'Pressure moves the diaphragm.',resolvedStructure:'ordered-steps',steps:['Pressure rises.','The diaphragm moves.'],citationIndexes:[0],citations:[{title:'Mechanism',url:'https://en.wikipedia.org/wiki/Mechanism'}],modelOutcomes:[]});
 await task;
 assert.equal(card.answerStructure,'ordered-steps');assert.match(card.answer,/1\. Pressure rises\./);assert.equal(card.answerDetailed,true);
 assert.equal(questionStructures.get(key),'side-by-side-comparison');assert.equal(questionStructureRevisions.get(key),3);
 assert.equal(questionInstructionPreferences.get(key),'written');assert.equal(questionInstructionRevisions.get(key),5);
});
