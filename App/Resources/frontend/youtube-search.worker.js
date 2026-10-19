/* Native WebKit uses the same generated search engine as the website. */
importScripts("video-semantic.js");
let videos = [], byId = new Map(), revision = -1, latest = 0;
onmessage = async function(event) {
  const request = event.data;
  if (request.type === "initialize") { videos = request.videos; byId = new Map(videos.map(video=>[video.id,video])); revision = request.revision; latest++; return; }
  if (request.type === "update") {
    for (const id of request.removeIds) byId.delete(id);
    for (const video of request.upserts) byId.set(video.id, video);
    videos = request.orderIds ? request.orderIds.flatMap(id => { const video = byId.get(id); return video ? [video] : []; }) : Array.from(byId.values());
    if (request.orderIds) byId = new Map(videos.map(video => [video.id, video]));
    revision = request.revision; latest++; return;
  }
  if (request.type === "cancel") { latest++; return; }
  const token = ++latest, currentRevision = revision;
  if (request.revision !== revision) return;
  const candidates = [];
  for (let start=0; start<videos.length; start+=160) {
    if (token !== latest || revision !== currentRevision) return;
    const batch = LEARNED_MEDIA_VIDEO_SEARCH.searchSemanticVideos(videos.slice(start,start+160), request.plan, request.topic, request.channelId, request.limit, request.excludedIds || []);
    for (const candidate of batch) candidates.push({ videoId:candidate.video.id, score:candidate.score, matchedFields:candidate.matchedFields, supportingText:candidate.supportingText });
    if (start+160 < videos.length) await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (token === latest && revision === currentRevision) postMessage({ requestId:request.requestId, revision, candidates:candidates.sort((a,b)=>LEARNED_MEDIA_VIDEO_SEARCH.compareSemanticCandidates({video:byId.get(a.videoId),score:a.score},{video:byId.get(b.videoId),score:b.score},request.plan.sort)).slice(0,request.limit) });
};
