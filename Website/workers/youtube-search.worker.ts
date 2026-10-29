/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import type { YouTubeSearchPlanLike, YouTubeTopic } from "@/lib/youtube";
import type { SearchableVideoMetadata } from "@/lib/video-metadata";
import { runBackgroundSlice } from "@/lib/background-work";
import { createVideoSearchIndexPersistence } from "@/lib/youtube-search-index-storage";
import { indexVideoSearchMetadata, isValidVideoSearchRequest, validateVideoSearchCatalogUpdate, insertBoundedRanked, nextSemanticSearchChunkSize, SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE, PreparedVideoSearchCache, searchPreparedSemanticVideos, type IndexedVideoSearchMetadata } from "@/lib/video-semantic";

type SearchRequest = {
  type: "search";
  requestId: number;
  revision: number;
  query: string;
  plan: YouTubeSearchPlanLike;
  topic: YouTubeTopic | "All";
  channelId?: string;
  limit: number;
  excludedIds?: string[];
  expanded?: boolean;
  viewKey?: string;
};
type Request =
  | { type: "initialize"; revision: number; videos: SearchableVideoMetadata[] }
  | { type: "update"; baseRevision: number; revision: number; upserts: SearchableVideoMetadata[]; removeIds: string[]; orderIds?: string[] }
  | { type: "cancel"; requestId: number }
  | SearchRequest;
type CandidateReply = { coverage?: { matchedConcepts: number[]; missingConcepts: number[]; complete: boolean }; videoId: string; score: number; matchedFields: string[]; supportingText: string[] };
type Reply = { type: "progress" | "failed"; requestId: number; revision: number } | { type: "ready" | "rebuild"; revision: number } | { type: "stale"; requestId: number; revision: number } | { type: "invalid"; requestId: number; reason: "invalid-request" } | { type: "results"; requestId: number; revision: number; query: string; viewKey?: string; candidates: CandidateReply[] };
type SearchSession = { direct: CandidateReply[]; fallback: CandidateReply[]; directComplete: boolean; fallbackComplete: boolean };

const workerScope = self as DedicatedWorkerGlobalScope;
type CatalogSnapshot = Readonly<{
  videos: Map<string, IndexedVideoSearchMetadata>;
  ordered: IndexedVideoSearchMetadata[];
  revision: number;
}>;
let snapshot: CatalogSnapshot = { videos: new Map(), ordered: [], revision: -1 };
const resultCache = new SessionCache<CandidateReply[]>(80, 30 * 60 * 1000, 4 * 1024 * 1024);
// Keep a couple of pages per group warm. The shared cache enforces both a TTL
// and a byte budget, so broad searches with long supporting passages are simply
// not retained when their result metadata would consume too much worker memory.
const searchSessionCache = new SessionCache<SearchSession>(8, 5 * 60 * 1000, 4 * 1024 * 1024);
const preparedSearchCache = new PreparedVideoSearchCache(4);
let latestRequestId = 0;
let activeRequestId = 0;
let indexEpoch = 0;
const persistedIndex = createVideoSearchIndexPersistence();
let catalogLoading: Promise<void> | undefined;

function sameVideoRecord(previous: IndexedVideoSearchMetadata | undefined, next: SearchableVideoMetadata): boolean {
  if (!previous) return false;
  const previousRecord = previous as unknown as Record<string, unknown>;
  const nextRecord = next as unknown as Record<string, unknown>;
  const previousKeys = Object.keys(previousRecord).filter((key) => !["specialPlaylistEligible", "normalizedChannelName", "searchFields"].includes(key));
  const nextKeys = Object.keys(nextRecord);
  if (previousKeys.length !== nextKeys.length) return false;
  for (const key of previousKeys) {
    if (!Object.prototype.hasOwnProperty.call(nextRecord, key)) return false;
    const left = previousRecord[key], right = nextRecord[key];
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length || left.some((value, index) => value !== right[index])) return false;
    } else if (!Object.is(left, right)) return false;
  }
  return true;
}

function mapMatchesOrderedVideos(map: Map<string, IndexedVideoSearchMetadata>, ordered: IndexedVideoSearchMetadata[]): boolean {
  if (map.size !== ordered.length) return false;
  let index = 0;
  for (const [id, video] of map) {
    const expected = ordered[index++];
    if (!expected || expected.id !== id || expected !== video) return false;
  }
  return true;
}

/** Stage independently; failures cannot alter a captured or active snapshot. */
function stageCatalog(request: Extract<Request, { type: "initialize" | "update" }>, restored?: Map<string, IndexedVideoSearchMetadata>): CatalogSnapshot {
  validateVideoSearchCatalogUpdate(request.revision, request.type === "initialize" ? request.videos : request.upserts,
    request.type === "update" ? request.removeIds : [], request.type === "update" ? request.orderIds : undefined);
  let staged = request.type === "initialize" ? restored ?? new Map<string, IndexedVideoSearchMetadata>() : snapshot.videos;
  const writable = () => { if (staged === snapshot.videos) staged = new Map(staged); return staged; };
  if (request.type === "initialize" && !restored) {
    for (const video of request.videos) staged.set(video.id, indexVideoSearchMetadata(video, staged.get(video.id)));
  } else if (request.type === "update") {
    for (const id of request.removeIds) if (staged.has(id)) writable().delete(id);
    for (const video of request.upserts) {
      const previous = staged.get(video.id);
      if (!sameVideoRecord(previous, video)) writable().set(video.id, indexVideoSearchMetadata(video, previous));
    }
    if (request.orderIds) {
      const ordered = new Map<string, IndexedVideoSearchMetadata>();
      for (const id of request.orderIds) { const video = staged.get(id); if (video) ordered.set(id, video); }
      staged = ordered;
    }
  }
  // Equal records/order retain the existing snapshot data, including no-op updates.
  const unchanged = mapMatchesOrderedVideos(staged, snapshot.ordered);
  return { videos: unchanged ? snapshot.videos : staged,
    ordered: unchanged ? snapshot.ordered : Array.from(staged.values()), revision: request.revision };
}

function remember(key: string, candidates: CandidateReply[]) {
  resultCache.set(key, candidates);
}

/** Drop every derived value as soon as its source catalog revision is replaced. */
function releaseCatalogSearchCaches() {
  resultCache.clear();
  searchSessionCache.clear();
  preparedSearchCache.clear();
}

function cacheKeys(request: SearchRequest) {
  // Serialize the complete plan once for both cache identities. Besides avoiding
  // duplicate work, this keeps the exact-page and search-session scopes aligned.
  const planKey = JSON.stringify(request.plan);
  const query = request.query.trim().toLocaleLowerCase();
  const session = [request.revision, query, planKey, request.topic, request.channelId, Boolean(request.expanded), request.viewKey ?? ""];
  return {
    result: JSON.stringify([request.revision, query, planKey, request.topic, request.channelId, request.limit, request.excludedIds ?? [], Boolean(request.expanded), request.viewKey ?? ""]),
    session: JSON.stringify(session),
  };
}

function pageFromSession(session: SearchSession, excludedIds: ReadonlySet<string>, limit: number): CandidateReply[] | undefined {
  const direct = session.direct.filter((candidate) => !excludedIds.has(candidate.videoId));
  if (direct.length >= limit) return direct.slice(0, limit);
  // Keep the existing tier rule: fallback suggestions appear only after no
  // direct result remains, never just to fill a short direct page.
  if (direct.length) return session.directComplete ? direct : undefined;
  if (!session.directComplete) return undefined;

  const fallback = session.fallback.filter((candidate) => !excludedIds.has(candidate.videoId));
  if (fallback.length >= limit) return fallback.slice(0, limit);
  return session.fallbackComplete ? fallback : undefined;
}

function rankingNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

async function search(request: SearchRequest) {
  if (request.revision !== snapshot.revision) { workerScope.postMessage({ type: "stale", requestId: request.requestId, revision: snapshot.revision } satisfies Reply); return; }
  if (activeRequestId && activeRequestId !== request.requestId) workerScope.postMessage({ type: "stale", requestId: activeRequestId, revision: snapshot.revision } satisfies Reply);
  const captured = snapshot;
  latestRequestId = request.requestId;
  activeRequestId = request.requestId;
  const epoch = indexEpoch;
  const keys = cacheKeys(request);
  const key = keys.result;
  const cached = resultCache.get(key);
  if (cached) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision: captured.revision, query: request.query, viewKey: request.viewKey, candidates: cached } satisfies Reply);
    return;
  }

  const resultLimit = Math.max(1, Math.floor(request.limit));
  const excludedIds = request.excludedIds?.length ? new Set(request.excludedIds) : new Set<string>();
  const sessionKey = keys.session;
  const cachedSession = searchSessionCache.get(sessionKey);
  const sessionPage = cachedSession && pageFromSession(cachedSession, excludedIds, resultLimit);
  if (sessionPage) {
    remember(key, sessionPage);
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision: captured.revision, query: request.query, viewKey: request.viewKey, candidates: sessionPage } satisfies Reply);
    return;
  }

  // The retained snapshot is replaced on catalog changes, never mutated, so
  // yielded searches keep stable positions even if a newer update arrives.
  const catalog = captured.ordered;
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, captured.revision, request.viewKey ?? "worker");
  type RankedCandidateEntry = { candidate: CandidateReply; index: number };
  const direct: RankedCandidateEntry[] = [];
  const fallback: RankedCandidateEntry[] = [];
  let directMatchCount = 0, fallbackMatchCount = 0;
  const buildSession = excludedIds.size === 0 && resultLimit <= 160;
  const sessionLimit = buildSession ? Math.min(320, Math.max(resultLimit, resultLimit * 2)) : resultLimit;
  const compareEntries = (left: RankedCandidateEntry, right: RankedCandidateEntry) => {
    const a = catalog[left.index], b = catalog[right.index];
    const dateOrder = prepared.sort === "newest" ? b.publishedAt.localeCompare(a.publishedAt) : prepared.sort === "oldest" ? a.publishedAt.localeCompare(b.publishedAt) : 0;
    return dateOrder || right.candidate.score - left.candidate.score || left.index - right.index;
  };
  let start = 0, lastProgress = rankingNow();
  let chunkSize = SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE;
  while (start < catalog.length) {
    if (request.requestId !== latestRequestId || request.revision !== snapshot.revision || epoch !== indexEpoch) return;
    const sliceStart = start;
    start = await runBackgroundSlice(() => {
      if (request.requestId !== latestRequestId || request.revision !== snapshot.revision || epoch !== indexEpoch) return sliceStart;
      const beganAt = rankingNow();
      const end = Math.min(catalog.length, sliceStart + chunkSize);
      const batch = catalog.slice(sliceStart, end);
      const positions = new Map(batch.map((video, index) => [video.id, sliceStart + index]));
      // The ranker returns direct and fallback results in one list. Ask for
      // the whole chunk before splitting those groups; a fixed 2N window could be
      // filled by fallback candidates and hide a lower-ranked direct match.
      const matches = searchPreparedSemanticVideos(batch, prepared, batch.length, excludedIds);
      for (const match of matches) {
        const entry = { candidate: { coverage: match.coverage, videoId: match.video.id, score: match.score, matchedFields: match.matchedFields, supportingText: match.supportingText }, index: positions.get(match.video.id)! };
        const isFallback = match.matchedFields.includes("semantic-fallback");
        if (isFallback) fallbackMatchCount++;
        else directMatchCount++;
        insertBoundedRanked(isFallback ? fallback : direct, entry, buildSession ? sessionLimit : resultLimit, compareEntries);
      }
      const elapsed = rankingNow() - beganAt;
      chunkSize = nextSemanticSearchChunkSize(chunkSize, elapsed);
      return end;
    }, { priority: "interactive", canPause: true });
    if (request.requestId !== latestRequestId || request.revision !== snapshot.revision || epoch !== indexEpoch) return;
    if (rankingNow() - lastProgress >= 1000) {
      lastProgress = rankingNow();
      workerScope.postMessage({ type: "progress", requestId: request.requestId, revision: captured.revision } satisfies Reply);
    }
  }
  const session: SearchSession | undefined = buildSession ? {
    direct: direct.map(({ candidate }) => candidate),
    fallback: fallback.map(({ candidate }) => candidate),
    directComplete: directMatchCount <= sessionLimit,
    fallbackComplete: fallbackMatchCount <= sessionLimit,
  } : undefined;
  if (session) searchSessionCache.set(sessionKey, session);
  const source = direct.length ? direct : fallback;
  const candidates = source.slice(0, resultLimit).map(({ candidate }) => candidate);
  remember(key, candidates);
  if (request.requestId === latestRequestId && request.revision === snapshot.revision) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision: captured.revision, query: request.query, viewKey: request.viewKey, candidates } satisfies Reply);
  }
}

function handleMessage(message: unknown): void | Promise<void> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return;
  const request = message as Request;
  if (request.type === "initialize" || request.type === "update") {
    if (request.type === "update" && (!Number.isSafeInteger(request.baseRevision) || request.baseRevision < 0)) return;
    if (request.type === "update" && (snapshot.revision < 0 || request.baseRevision !== snapshot.revision)) {
      indexEpoch++;
      const staleRequestId = activeRequestId;
      activeRequestId = 0;
      latestRequestId += 1;
      if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision: request.revision } satisfies Reply);
      workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply);
      return;
    }
    if (request.type === "initialize" && persistedIndex.enabled) {
      try { validateVideoSearchCatalogUpdate(request.revision, request.videos); }
      catch { workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply); return; }
      // Preserve Map's duplicate-ID semantics before computing the fingerprint.
      const originals = Array.from(new Map(request.videos.map(video => [video.id, video])).values());
      return persistedIndex.restore(originals).then(restored => {
        publishCatalog(request, stageCatalog(request, restored), Boolean(restored));
      });
    }
    let staged: CatalogSnapshot;
    try { staged = stageCatalog(request); }
    catch {
      workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply);
      return;
    }
    publishCatalog(request, staged);
  } else if (request.type === "cancel") {
    if (Number.isSafeInteger(request.requestId) && request.requestId >= 0 && request.requestId === latestRequestId) {
      latestRequestId += 1;
      activeRequestId = 0;
    }
  } else if (request.type === "search") {
    if (!isValidVideoSearchRequest(message)) {
      if (Number.isSafeInteger((message as Record<string, unknown>).requestId) && ((message as Record<string, unknown>).requestId as number) >= 0) {
        workerScope.postMessage({ type: "invalid", requestId: (message as Record<string, unknown>).requestId as number, reason: "invalid-request" } satisfies Reply);
      }
      return;
    }
    void search(request).catch(() => {
      if (activeRequestId === request.requestId && snapshot.revision === request.revision) {
        activeRequestId = 0;
        workerScope.postMessage({ type: "failed", requestId: request.requestId, revision: request.revision } satisfies Reply);
      }
    });
  }
}

function publishCatalog(request: Extract<Request, { type: "initialize" | "update" }>, staged: CatalogSnapshot, restored = false) {
  const staleRequestId = activeRequestId;
  const previous = snapshot.ordered;
  // Publish only a complete index; pending messages wait for startup hydration.
  snapshot = staged;
  indexEpoch++;
  activeRequestId = 0;
  latestRequestId += 1;
  releaseCatalogSearchCaches();
  if (!restored && previous !== staged.ordered) persistedIndex.save(staged.ordered);
  if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision: snapshot.revision } satisfies Reply);
  if (request.type === "initialize") workerScope.postMessage({ type: "ready", revision: snapshot.revision } satisfies Reply);
}

workerScope.onmessage = (event: MessageEvent<unknown>) => {
  // Only catalog loading is serialized. Searches still supersede/cancel one
  // another through the existing request and epoch checks while ranking yields.
  const result = catalogLoading ? catalogLoading.then(() => handleMessage(event.data)) : handleMessage(event.data);
  if (result) {
    const pending = result.catch(() => { workerScope.postMessage({ type: "rebuild", revision: (event.data as { revision: number }).revision } satisfies Reply); });
    catalogLoading = pending;
    void pending.then(() => { if (catalogLoading === pending) catalogLoading = undefined; });
  }
};
