/* Native WebKit uses the same generated search engine as the website. */
importScripts("video-semantic.js");
let snapshot = { videos: [], byId: new Map(), revision: -1 }, latest = 0;
const preparedSearchCache = new LEARNED_MEDIA_VIDEO_SEARCH.PreparedVideoSearchCache(4);
const indexVideo = video => LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata(video);
const sameVideoRecord = (previous, next) => {
  if (!previous) return false;
  const previousKeys = Object.keys(previous).filter(key => key !== "specialPlaylistEligible");
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;
  for (const key of previousKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    const left = previous[key], right = next[key];
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length || left.some((value, index) => value !== right[index])) return false;
    } else if (!Object.is(left, right)) return false;
  }
  return true;
};
function stageCatalog(request) {
  const initialize = request.type === "initialize";
  LEARNED_MEDIA_VIDEO_SEARCH.validateVideoSearchCatalogUpdate(request.revision, initialize ? request.videos : request.upserts,
    initialize ? [] : request.removeIds, initialize ? undefined : request.orderIds);
  let staged = initialize ? new Map() : snapshot.byId;
  const writable = () => { if (staged === snapshot.byId) staged = new Map(staged); return staged; };
  if (initialize) {
    for (const video of request.videos) staged.set(video.id, indexVideo(video));
  } else {
    for (const id of request.removeIds) if (staged.has(id)) writable().delete(id);
    for (const video of request.upserts) if (!sameVideoRecord(staged.get(video.id), video)) writable().set(video.id, indexVideo(video));
    if (request.orderIds) {
      const ordered = new Map();
      for (const id of request.orderIds) { const video = staged.get(id); if (video) ordered.set(id, video); }
      staged = ordered;
    }
  }
  let unchanged = staged.size === snapshot.videos.length, index = 0;
  if (unchanged) for (const [id, video] of staged) {
    const old = snapshot.videos[index++];
    if (old.id !== id || old !== video) { unchanged = false; break; }
  }
  return { byId: unchanged ? snapshot.byId : staged, videos: unchanged ? snapshot.videos : Array.from(staged.values()), revision: request.revision };
}
onmessage = async function(event) {
  const request = event.data;
  if (request.type === "initialize" || request.type === "update") {
    if (request.type === "update" && (snapshot.revision < 0 || request.baseRevision !== snapshot.revision)) { latest++; postMessage({type:"rebuild",revision:request.revision}); return; }
    let staged;
    try { staged = stageCatalog(request); }
    catch { postMessage({type:"rebuild",revision:request.revision}); return; }
    snapshot = staged;
    latest++; preparedSearchCache.clear(); return;
  }
  if (request.type === "cancel") { latest++; return; }
  const token = ++latest, captured = snapshot, currentRevision = captured.revision;
  if (request.revision !== snapshot.revision) return;
  const catalog = captured.videos;
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, currentRevision, request.viewKey || "native-worker");
  const excludedIds = request.excludedIds && request.excludedIds.length ? new Set(request.excludedIds) : new Set();
  const direct = [], fallback = [], resultLimit = Math.max(1, Math.floor(request.limit));
  const compareEntries = (left,right) => LEARNED_MEDIA_VIDEO_SEARCH.compareSemanticCandidates(left.candidate,right.candidate,prepared.sort) || left.index-right.index;
  for (let start=0; start<catalog.length; start+=160) {
    if (token !== latest || snapshot.revision !== currentRevision) return;
    const batch = catalog.slice(start,start+160);
    const positions = new Map(batch.map((video,index)=>[video.id,start+index]));
    const matches = LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos(batch, prepared, request.limit, excludedIds);
    for (const candidate of matches) {
      const entry = { candidate, index:positions.get(candidate.video.id) };
      LEARNED_MEDIA_VIDEO_SEARCH.insertBoundedRanked(candidate.matchedFields.includes("semantic-fallback") ? fallback : direct, entry, resultLimit, compareEntries);
    }
    if (start+160 < catalog.length) await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (token === latest && snapshot.revision === currentRevision) {
    const source = direct.length ? direct : fallback;
    const candidates = source.map(({candidate})=>({videoId:candidate.video.id,score:candidate.score,matchedFields:candidate.matchedFields,supportingText:candidate.supportingText}));
    postMessage({ requestId:request.requestId, revision:currentRevision, candidates });
  }
};
