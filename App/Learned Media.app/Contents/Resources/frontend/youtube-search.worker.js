/* Native WebKit uses the same generated search engine as the website. */
importScripts("background-work.js");
importScripts("video-semantic.js");
importScripts("youtube-search-index-storage.js");
const persistedIndex = LEARNED_MEDIA_VIDEO_INDEX_STORAGE.createVideoSearchIndexPersistence();
let catalogLoading, activeRequestId = 0;
let snapshot = { videos: [], byId: new Map(), channelPositions: new Map(), nextChannelPosition: 0, revision: -1 }, latest = 0;
const preparedSearchCache = new LEARNED_MEDIA_VIDEO_SEARCH.PreparedVideoSearchCache(4);
const searchSessionCache = new Map();
const SEARCH_SESSION_CACHE_LIMIT = 8, SEARCH_SESSION_TTL_MS = 5 * 60 * 1000, SEARCH_SESSION_BYTE_LIMIT = 4 * 1024 * 1024;
let searchSessionCacheBytes = 0;
function rankingNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
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
function releaseCatalogSearchCaches() {
  preparedSearchCache.clear();
  searchSessionCache.clear();
  searchSessionCacheBytes = 0;
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
const indexVideo = (video, previous) => LEARNED_MEDIA_VIDEO_SEARCH.indexVideoSearchMetadata(video, previous);
const indexedOnlyFields = new Set(["specialPlaylistEligible", "normalizedChannelName", "searchFields"]);
const sameVideoRecord = (previous, next) => {
  if (!previous) return false;
  const previousKeys = Object.keys(previous).filter(key => !indexedOnlyFields.has(key));
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
function createChannelPositionIndex(ordered) {
  const channelPositions = new Map();
  ordered.forEach((video, position) => {
    const entries = channelPositions.get(video.channelId) || [];
    entries.push({ position, video });
    channelPositions.set(video.channelId, entries);
  });
  return { channelPositions, nextChannelPosition: ordered.length };
}
function insertChannelPosition(entries, entry) {
  let low = 0, high = entries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (entries[middle].position < entry.position) low = middle + 1;
    else high = middle;
  }
  entries.splice(low, 0, entry);
}
function stageCatalog(request, restored) {
  const initialize = request.type === "initialize";
  LEARNED_MEDIA_VIDEO_SEARCH.validateVideoSearchCatalogUpdate(request.revision, initialize ? request.videos : request.upserts,
    initialize ? [] : request.removeIds, initialize ? undefined : request.orderIds);
  let staged = initialize ? restored || new Map() : snapshot.byId;
  let channelPositions = snapshot.channelPositions;
  let nextChannelPosition = snapshot.nextChannelPosition;
  let channelMapWritable = false;
  const writableChannels = new Set();
  const writableChannelMap = () => {
    if (!channelMapWritable) {
      channelPositions = new Map(channelPositions);
      channelMapWritable = true;
    }
    return channelPositions;
  };
  const mutableChannel = channelId => {
    writableChannelMap();
    let entries = channelPositions.get(channelId);
    if (!writableChannels.has(channelId)) {
      entries = entries ? entries.slice() : [];
      channelPositions.set(channelId, entries);
      writableChannels.add(channelId);
    } else if (!entries) {
      entries = [];
      channelPositions.set(channelId, entries);
    }
    return entries;
  };
  const removeChannelPosition = video => {
    const entries = mutableChannel(video.channelId);
    const index = entries.findIndex(entry => entry.video.id === video.id);
    if (index >= 0) entries.splice(index, 1);
    if (!entries.length) channelPositions.delete(video.channelId);
  };
  const updateChannelPosition = (previous, video) => {
    if (!previous) {
      insertChannelPosition(mutableChannel(video.channelId), { position: nextChannelPosition++, video });
      return;
    }
    const oldEntries = channelPositions.get(previous.channelId) || [];
    const oldIndex = oldEntries.findIndex(entry => entry.video.id === previous.id);
    const position = oldIndex >= 0 ? oldEntries[oldIndex].position : nextChannelPosition++;
    if (oldIndex >= 0) {
      const entries = mutableChannel(previous.channelId);
      entries.splice(oldIndex, 1);
      if (!entries.length) channelPositions.delete(previous.channelId);
    }
    insertChannelPosition(mutableChannel(video.channelId), { position, video });
  };
  const writable = () => { if (staged === snapshot.byId) staged = new Map(staged); return staged; };
  if (initialize && !restored) {
    for (const video of request.videos) staged.set(video.id, indexVideo(video, staged.get(video.id)));
  } else if (!initialize) {
    for (const id of request.removeIds) {
      const previous = staged.get(id);
      if (previous) {
        if (!request.orderIds) removeChannelPosition(previous);
        writable().delete(id);
      }
    }
    for (const video of request.upserts) {
      const previous = staged.get(video.id);
      if (!sameVideoRecord(previous, video)) {
        const indexed = indexVideo(video, previous);
        if (!request.orderIds) updateChannelPosition(previous, indexed);
        writable().set(video.id, indexed);
      }
    }
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
  if (unchanged) return { ...snapshot, revision: request.revision };
  const videos = Array.from(staged.values());
  if (initialize || request.orderIds) ({ channelPositions, nextChannelPosition } = createChannelPositionIndex(videos));
  return { byId: staged, videos, channelPositions, nextChannelPosition, revision: request.revision };
}
function handleMessage(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return;
  if (request.type === "initialize" || request.type === "update") {
    if (request.type === "update" && (!Number.isSafeInteger(request.baseRevision) || request.baseRevision < 0)) return;
    if (request.type === "update" && (snapshot.revision < 0 || request.baseRevision !== snapshot.revision)) { latest++; postMessage({type:"rebuild",revision:request.revision}); return; }
    if (request.type === "initialize" && persistedIndex.enabled) {
      try { LEARNED_MEDIA_VIDEO_SEARCH.validateVideoSearchCatalogUpdate(request.revision, request.videos); }
      catch { postMessage({type:"rebuild",revision:request.revision}); return; }
      const originals = Array.from(new Map(request.videos.map(video => [video.id,video])).values());
      return persistedIndex.restore(originals).then(restored => publishCatalog(stageCatalog(request,restored), Boolean(restored), true));
    }
    let staged;
    try { staged = stageCatalog(request); }
    catch { postMessage({type:"rebuild",revision:request.revision}); return; }
    publishCatalog(staged, false, request.type === "initialize"); return;
  }
  if (request.type === "cancel") {
    if (request.requestId !== undefined && (!Number.isSafeInteger(request.requestId) || request.requestId < 0)) return;
    if (request.requestId === undefined || request.requestId === activeRequestId) { latest++; activeRequestId = 0; }
    return;
  }
  if (request.type !== "search") return;
  if (!LEARNED_MEDIA_VIDEO_SEARCH.isValidVideoSearchRequest(request)) {
    if (Number.isSafeInteger(request.requestId) && request.requestId >= 0) postMessage({ type:"invalid", requestId:request.requestId, reason:"invalid-request" });
    return;
  }
  void search(request).catch(() => {
    if (activeRequestId === request.requestId && snapshot.revision === request.revision) {
      activeRequestId = 0;
      postMessage({ type:"failed", requestId:request.requestId, revision:request.revision });
    }
  });
}
function publishCatalog(staged, restored, initialize) {
  if (activeRequestId) postMessage({ type:"stale", requestId:activeRequestId, revision:staged.revision });
  activeRequestId = 0;
  const previous = snapshot.videos;
  snapshot = staged;
  latest++; releaseCatalogSearchCaches();
  if (!restored && previous !== staged.videos) persistedIndex.save(staged.videos);
  if (initialize) postMessage({ type:"ready", revision:staged.revision });
}
async function search(request) {
  if (request.revision !== snapshot.revision) { postMessage({ type:"stale", requestId:request.requestId, revision:snapshot.revision }); return; }
  if (activeRequestId && activeRequestId !== request.requestId) postMessage({ type:"stale", requestId:activeRequestId, revision:snapshot.revision });
  activeRequestId = request.requestId;
  const token = ++latest, captured = snapshot, currentRevision = captured.revision;
  const catalog = captured.videos;
  const hasSelectedChannel = Boolean(request.channelId), hasPlannedChannel = Boolean(request.plan.channelId);
  const hasChannelFilter = hasSelectedChannel || hasPlannedChannel;
  const channelFilter = hasSelectedChannel && hasPlannedChannel && request.channelId !== request.plan.channelId
    ? undefined : request.channelId || request.plan.channelId;
  const channelCatalog = hasChannelFilter ? channelFilter ? captured.channelPositions.get(channelFilter) || [] : [] : undefined;
  const candidateCount = channelCatalog ? channelCatalog.length : catalog.length;
  const excludedIds = request.excludedIds && request.excludedIds.length ? new Set(request.excludedIds) : new Set();
  const direct = [], fallback = [], resultLimit = Math.max(1, Math.floor(request.limit));
  let directMatchCount = 0, fallbackMatchCount = 0;
  const planKey = JSON.stringify(request.plan);
  const key = sessionKey(request, currentRevision, planKey);
  const cachedSession = getSearchSession(key), sessionPage = cachedSession && pageFromSession(cachedSession, excludedIds, resultLimit);
  if (sessionPage) { activeRequestId = 0; postMessage({ requestId:request.requestId, revision:currentRevision, candidates:sessionPage }); return; }
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, currentRevision, request.viewKey || "native-worker");
  const buildSession = excludedIds.size === 0 && resultLimit <= 160;
  const sessionLimit = buildSession ? Math.min(320, Math.max(resultLimit, resultLimit * 2)) : resultLimit;
  const compareEntries = (left,right) => LEARNED_MEDIA_VIDEO_SEARCH.compareSemanticCandidates(left.candidate,right.candidate,prepared.sort) || left.position-right.position;
  let start = 0, lastProgress = rankingNow(), chunkSize = LEARNED_MEDIA_VIDEO_SEARCH.SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE;
  while (start < candidateCount) {
    if (token !== latest || snapshot.revision !== currentRevision) return;
    const sliceStart = start;
    start = await LEARNED_MEDIA_BACKGROUND.runBackgroundSlice(() => {
      if (token !== latest || snapshot.revision !== currentRevision) return sliceStart;
      const beganAt = rankingNow(), end = Math.min(candidateCount, sliceStart + chunkSize);
      const channelBatch = channelCatalog ? channelCatalog.slice(sliceStart, end) : undefined;
      const batch = channelBatch ? channelBatch.map(entry => entry.video) : catalog.slice(sliceStart,end);
      const positions = channelBatch
        ? new Map(channelBatch.map(entry => [entry.video.id, entry.position]))
        : new Map(batch.map((video,index)=>[video.id,sliceStart+index]));
      // Retrieve the complete chunk before separating direct and fallback
      // matches, so a high-scoring fallback cannot hide a direct result.
      const matches = LEARNED_MEDIA_VIDEO_SEARCH.searchPreparedSemanticVideos(batch, prepared, batch.length, excludedIds);
      for (const candidate of matches) {
        const entry = { candidate, position:positions.get(candidate.video.id) };
        const isFallback = candidate.matchedFields.includes("semantic-fallback");
        if (isFallback) fallbackMatchCount++;
        else directMatchCount++;
        LEARNED_MEDIA_VIDEO_SEARCH.insertBoundedRanked(isFallback ? fallback : direct, entry, buildSession ? sessionLimit : resultLimit, compareEntries);
      }
      const elapsed = rankingNow() - beganAt;
      chunkSize = LEARNED_MEDIA_VIDEO_SEARCH.nextSemanticSearchChunkSize(chunkSize, elapsed);
      return end;
    }, { priority:"interactive", canPause:true });
    if (token !== latest || snapshot.revision !== currentRevision) return;
    if (rankingNow() - lastProgress >= 1000) {
      lastProgress = rankingNow();
      postMessage({ type:"progress", requestId:request.requestId, revision:currentRevision });
    }
  }
  if (token === latest && snapshot.revision === currentRevision) {
    if (buildSession) rememberSearchSession(key, {
      direct: direct.map(({ candidate }) => ({ videoId:candidate.video.id, score:candidate.score, matchedFields:candidate.matchedFields, supportingText:candidate.supportingText })),
      fallback: fallback.map(({ candidate }) => ({ videoId:candidate.video.id, score:candidate.score, matchedFields:candidate.matchedFields, supportingText:candidate.supportingText })),
      directComplete:directMatchCount <= sessionLimit, fallbackComplete:fallbackMatchCount <= sessionLimit
    });
    const source = direct.length ? direct : fallback;
    const candidates = source.slice(0,resultLimit).map(({candidate})=>({videoId:candidate.video.id,score:candidate.score,matchedFields:candidate.matchedFields,supportingText:candidate.supportingText}));
    activeRequestId = 0;
    postMessage({ requestId:request.requestId, revision:currentRevision, candidates });
  }
};

onmessage = event => {
  const result = catalogLoading ? catalogLoading.then(() => handleMessage(event.data)) : handleMessage(event.data);
  if (result) {
    const pending = result.catch(() => postMessage({type:"rebuild",revision:event.data && event.data.revision}));
    catalogLoading = pending;
    void pending.then(() => { if (catalogLoading === pending) catalogLoading = undefined; });
  }
};
