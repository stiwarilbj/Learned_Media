/* Native WebKit uses the same generated search engine as the website. */
importScripts("video-semantic.js");
let videos = [], byId = new Map(), revision = -1, latest = 0;
const preparedSearchCache = new LEARNED_MEDIA_VIDEO_SEARCH.PreparedVideoSearchCache(4);
onmessage = async function(event) {
  const request = event.data;
  if (request.type === "initialize") { videos = request.videos; byId = new Map(videos.map(video=>[video.id,video])); revision = request.revision; latest++; preparedSearchCache.clear(); return; }
  if (request.type === "update") {
    latest++;
    if (revision < 0 || request.baseRevision !== revision) { postMessage({type:"rebuild",revision:request.revision}); return; }
    for (const id of request.removeIds) byId.delete(id);
    for (const video of request.upserts) byId.set(video.id, video);
    videos = request.orderIds ? request.orderIds.flatMap(id => { const video = byId.get(id); return video ? [video] : []; }) : Array.from(byId.values());
    if (request.orderIds) byId = new Map(videos.map(video => [video.id, video]));
    revision = request.revision; preparedSearchCache.clear(); return;
  }
  if (request.type === "cancel") { latest++; return; }
  const token = ++latest, currentRevision = revision;
  if (request.revision !== revision) return;
  const catalog = videos;
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, revision, request.viewKey || "native-worker");
  const excludedIds = request.excludedIds && request.excludedIds.length ? new Set(request.excludedIds) : new Set();
  const direct = [], fallback = [], resultLimit = Math.max(1, Math.floor(request.limit));
  const compareEntries = (left,right) => LEARNED_MEDIA_VIDEO_SEARCH.compareSemanticCandidates(left.candidate,right.candidate,prepared.sort) || left.index-right.index;
  for (let start=0; start<catalog.length; start+=160) {
    if (token !== latest || revision !== currentRevision) return;
    const batch = catalog.slice(start,start+160);
    const positions = new Map(batch.map((video,index)=>[video.id,start+index]));
    const matches = LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos(batch, prepared, request.limit, excludedIds);
    for (const candidate of matches) {
      const entry = { candidate, index:positions.get(candidate.video.id) };
      LEARNED_MEDIA_VIDEO_SEARCH.insertBoundedRanked(candidate.matchedFields.includes("semantic-fallback") ? fallback : direct, entry, resultLimit, compareEntries);
    }
    if (start+160 < catalog.length) await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (token === latest && revision === currentRevision) {
    const source = direct.length ? direct : fallback;
    const candidates = source.map(({candidate})=>({videoId:candidate.video.id,score:candidate.score,matchedFields:candidate.matchedFields,supportingText:candidate.supportingText}));
    postMessage({ requestId:request.requestId, revision, candidates });
  }
};
