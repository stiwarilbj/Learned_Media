/* Native WebKit uses the same generated search engine as the website. */
importScripts("video-semantic.js");
let snapshot = { videos: [], byId: new Map(), revision: -1 }, latest = 0;
const preparedSearchCache = new LEARNED_MEDIA_VIDEO_SEARCH.PreparedVideoSearchCache(4);
const searchSessionCache = new Map();
const SEARCH_SESSION_CACHE_LIMIT = 8, SEARCH_SESSION_TTL_MS = 5 * 60 * 1000, SEARCH_SESSION_BYTE_LIMIT = 4 * 1024 * 1024;
let searchSessionCacheBytes = 0;
function sessionBytes(session, key) {
  let bytes = 128 + key.length * 2;
  for (const list of [session.direct, session.fallback]) for (const candidate of list) {
    bytes += 96 + candidate.videoId.length * 2 + candidate.matchedFields.reduce((sum, value) => sum + 16 + value.length * 2, 0) + candidate.supportingText.reduce((sum, value) => sum + 16 + value.length * 2, 0);
    if (candidate.coverage) bytes += 48 + 4 * (candidate.coverage.matchedConcepts.length + candidate.coverage.missingConcepts.length);
  }
  return bytes;
}
function clearExpiredSearchSessions(now) {
  for (const [key, entry] of searchSessionCache) if (entry.expiresAt <= now) {
    searchSessionCache.delete(key);
    searchSessionCacheBytes -= entry.bytes;
  }
}
function getSearchSession(key) {
  const now = Date.now();
  clearExpiredSearchSessions(now);
  const entry = searchSessionCache.get(key);
  if (!entry) return undefined;
  searchSessionCache.delete(key);
  searchSessionCache.set(key, entry);
  return entry.value;
}
function rememberSearchSession(key, value) {
  const now = Date.now();
  clearExpiredSearchSessions(now);
  const previous = searchSessionCache.get(key);
  if (previous) {
    searchSessionCache.delete(key);
    searchSessionCacheBytes -= previous.bytes;
  }
  const bytes = sessionBytes(value, key);
  if (bytes > SEARCH_SESSION_BYTE_LIMIT) return;
  searchSessionCache.set(key, { value: value, bytes: bytes, expiresAt: now + SEARCH_SESSION_TTL_MS });
  searchSessionCacheBytes += bytes;
  while (searchSessionCache.size > SEARCH_SESSION_CACHE_LIMIT || searchSessionCacheBytes > SEARCH_SESSION_BYTE_LIMIT) {
    const oldest = searchSessionCache.keys().next().value;
    const entry = searchSessionCache.get(oldest);
    searchSessionCache.delete(oldest);
    if (entry) searchSessionCacheBytes -= entry.bytes;
  }
}
function sessionKey(request, revision, planKey) {
  return JSON.stringify([revision, String(request.query || "").trim().toLocaleLowerCase(), planKey, request.topic, request.channelId, Boolean(request.expanded), request.viewKey || ""]);
}
function pageFromSession(session, excludedIds, limit) {
  const direct = session.direct.filter(candidate => !excludedIds.has(candidate.videoId));
  if (direct.length >= limit) return direct.slice(0, limit);
  if (direct.length) return session.directComplete ? direct : undefined;
  if (!session.directComplete) return undefined;
  const fallback = session.fallback.filter(candidate => !excludedIds.has(candidate.videoId));
  if (fallback.length >= limit) return fallback.slice(0, limit);
  return session.fallbackComplete ? fallback : undefined;
}
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
    latest++; preparedSearchCache.clear(); searchSessionCache.clear(); searchSessionCacheBytes = 0; return;
  }
  if (request.type === "cancel") { latest++; return; }
  const token = ++latest, captured = snapshot, currentRevision = captured.revision;
  if (request.revision !== snapshot.revision) return;
  const catalog = captured.videos;
  const excludedIds = request.excludedIds && request.excludedIds.length ? new Set(request.excludedIds) : new Set();
  const direct = [], fallback = [], resultLimit = Math.max(1, Math.floor(request.limit));
  let directMatchCount = 0, fallbackMatchCount = 0;
  const planKey = JSON.stringify(request.plan);
  const key = sessionKey(request, currentRevision, planKey);
  const cachedSession = getSearchSession(key), sessionPage = cachedSession && pageFromSession(cachedSession, excludedIds, resultLimit);
  if (sessionPage) { postMessage({ requestId:request.requestId, revision:currentRevision, candidates:sessionPage }); return; }
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, currentRevision, request.viewKey || "native-worker");
  const buildSession = excludedIds.size === 0 && resultLimit <= 160;
  const sessionLimit = buildSession ? Math.min(320, Math.max(resultLimit, resultLimit * 2)) : resultLimit;
  const compareEntries = (left,right) => LEARNED_MEDIA_VIDEO_SEARCH.compareSemanticCandidates(left.candidate,right.candidate,prepared.sort) || left.index-right.index;
  for (let start=0; start<catalog.length; start+=160) {
    if (token !== latest || snapshot.revision !== currentRevision) return;
    const batch = catalog.slice(start,start+160);
    const positions = new Map(batch.map((video,index)=>[video.id,start+index]));
    // Retrieve the complete chunk before separating direct and fallback
    // matches, so a high-scoring fallback cannot hide a direct result.
    const matches = LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos(batch, prepared, batch.length, excludedIds);
    for (const candidate of matches) {
      const entry = { candidate, index:positions.get(candidate.video.id) };
      const isFallback = candidate.matchedFields.includes("semantic-fallback");
      if (isFallback) fallbackMatchCount++;
      else directMatchCount++;
      LEARNED_MEDIA_VIDEO_SEARCH.insertBoundedRanked(isFallback ? fallback : direct, entry, buildSession ? sessionLimit : resultLimit, compareEntries);
    }
    if (start+160 < catalog.length) await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (token === latest && snapshot.revision === currentRevision) {
    if (buildSession) rememberSearchSession(key, {
      direct: direct.map(({ candidate }) => ({ videoId:candidate.video.id, score:candidate.score, matchedFields:candidate.matchedFields, supportingText:candidate.supportingText })),
      fallback: fallback.map(({ candidate }) => ({ videoId:candidate.video.id, score:candidate.score, matchedFields:candidate.matchedFields, supportingText:candidate.supportingText })),
      directComplete:directMatchCount <= sessionLimit, fallbackComplete:fallbackMatchCount <= sessionLimit
    });
    const source = direct.length ? direct : fallback;
    const candidates = source.slice(0,resultLimit).map(({candidate})=>({videoId:candidate.video.id,score:candidate.score,matchedFields:candidate.matchedFields,supportingText:candidate.supportingText}));
    postMessage({ requestId:request.requestId, revision:currentRevision, candidates });
  }
};
