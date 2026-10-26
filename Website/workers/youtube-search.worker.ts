/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import type { YouTubeSearchPlanLike, YouTubeTopic } from "@/lib/youtube";
import type { SearchableVideoMetadata } from "@/lib/video-metadata";
import { indexVideoSearchMetadata, validateVideoSearchCatalogUpdate, insertBoundedRanked, PreparedVideoSearchCache, searchPreparedSemanticVideos, type IndexedVideoSearchMetadata } from "@/lib/video-semantic";

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
type Reply = { type: "ready" | "rebuild"; revision: number } | { type: "stale"; requestId: number; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey?: string; candidates: CandidateReply[] };

const workerScope = self as DedicatedWorkerGlobalScope;
type CatalogSnapshot = Readonly<{
  videos: Map<string, IndexedVideoSearchMetadata>;
  ordered: IndexedVideoSearchMetadata[];
  revision: number;
}>;
let snapshot: CatalogSnapshot = { videos: new Map(), ordered: [], revision: -1 };
const resultCache = new SessionCache<CandidateReply[]>(80, 30 * 60 * 1000, 4 * 1024 * 1024);
const preparedSearchCache = new PreparedVideoSearchCache(4);
let latestRequestId = 0;
let activeRequestId = 0;
let indexEpoch = 0;

function sameVideoRecord(previous: IndexedVideoSearchMetadata | undefined, next: SearchableVideoMetadata): boolean {
  if (!previous) return false;
  const previousRecord = previous as unknown as Record<string, unknown>;
  const nextRecord = next as unknown as Record<string, unknown>;
  const previousKeys = Object.keys(previousRecord).filter((key) => key !== "specialPlaylistEligible");
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
function stageCatalog(request: Extract<Request, { type: "initialize" | "update" }>): CatalogSnapshot {
  validateVideoSearchCatalogUpdate(request.revision, request.type === "initialize" ? request.videos : request.upserts,
    request.type === "update" ? request.removeIds : [], request.type === "update" ? request.orderIds : undefined);
  let staged = request.type === "initialize" ? new Map<string, IndexedVideoSearchMetadata>() : snapshot.videos;
  const writable = () => { if (staged === snapshot.videos) staged = new Map(staged); return staged; };
  if (request.type === "initialize") {
    for (const video of request.videos) staged.set(video.id, indexVideoSearchMetadata(video));
  } else {
    for (const id of request.removeIds) if (staged.has(id)) writable().delete(id);
    for (const video of request.upserts) {
      if (!sameVideoRecord(staged.get(video.id), video)) writable().set(video.id, indexVideoSearchMetadata(video));
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

function cacheKey(request: SearchRequest) {
  return JSON.stringify([request.revision, request.query.trim().toLocaleLowerCase(), request.plan, request.topic, request.channelId, request.limit, request.excludedIds ?? [], Boolean(request.expanded), request.viewKey ?? ""]);
}

function yieldToWorker() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function search(request: SearchRequest) {
  if (request.revision !== snapshot.revision) return;
  const captured = snapshot;
  latestRequestId = request.requestId;
  activeRequestId = request.requestId;
  const epoch = indexEpoch;
  const key = cacheKey(request);
  const cached = resultCache.get(key);
  if (cached) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision: captured.revision, query: request.query, viewKey: request.viewKey, candidates: cached } satisfies Reply);
    return;
  }

  // The retained snapshot is replaced on catalog changes, never mutated, so
  // yielded searches keep stable positions even if a newer update arrives.
  const catalog = captured.ordered;
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, captured.revision, request.viewKey ?? "worker");
  const excludedIds = request.excludedIds?.length ? new Set(request.excludedIds) : new Set<string>();
  type RankedCandidateEntry = { candidate: CandidateReply; index: number };
  const direct: RankedCandidateEntry[] = [];
  const fallback: RankedCandidateEntry[] = [];
  const resultLimit = Math.max(1, Math.floor(request.limit));
  const compareEntries = (left: RankedCandidateEntry, right: RankedCandidateEntry) => {
    const a = catalog[left.index], b = catalog[right.index];
    const dateOrder = prepared.sort === "newest" ? b.publishedAt.localeCompare(a.publishedAt) : prepared.sort === "oldest" ? a.publishedAt.localeCompare(b.publishedAt) : 0;
    return dateOrder || right.candidate.score - left.candidate.score || left.index - right.index;
  };
  const chunkSize = 600;
  for (let start = 0; start < catalog.length; start += chunkSize) {
    if (request.requestId !== latestRequestId || request.revision !== snapshot.revision || epoch !== indexEpoch) return;
    const batch = catalog.slice(start, start + chunkSize);
    const positions = new Map(batch.map((video, index) => [video.id, start + index]));
    const matches = searchPreparedSemanticVideos(batch, prepared, request.limit, excludedIds);
    for (const match of matches) {
      const entry = { candidate: { coverage: match.coverage, videoId: match.video.id, score: match.score, matchedFields: match.matchedFields, supportingText: match.supportingText }, index: positions.get(match.video.id)! };
      insertBoundedRanked(match.matchedFields.includes("semantic-fallback") ? fallback : direct, entry, resultLimit, compareEntries);
    }
    if (start + chunkSize < catalog.length) {
      await yieldToWorker();
      if (request.requestId !== latestRequestId || request.revision !== snapshot.revision || epoch !== indexEpoch) return;
    }
  }
  const source = direct.length ? direct : fallback;
  const candidates = source.map(({ candidate }) => candidate);
  remember(key, candidates);
  if (request.requestId === latestRequestId && request.revision === snapshot.revision) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision: captured.revision, query: request.query, viewKey: request.viewKey, candidates } satisfies Reply);
  }
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize" || request.type === "update") {
    if (request.type === "update" && (snapshot.revision < 0 || request.baseRevision !== snapshot.revision)) {
      indexEpoch++;
      const staleRequestId = activeRequestId;
      activeRequestId = 0;
      latestRequestId += 1;
      if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision: request.revision } satisfies Reply);
      workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply);
      return;
    }
    let staged: CatalogSnapshot;
    try { staged = stageCatalog(request); }
    catch {
      workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply);
      return;
    }
    const staleRequestId = activeRequestId;
    // One publication point: map, ordered index and revision become visible together.
    snapshot = staged;
    indexEpoch++;
    activeRequestId = 0;
    latestRequestId += 1;
    resultCache.clear();
    preparedSearchCache.clear();
    if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision: snapshot.revision } satisfies Reply);
    if (request.type === "initialize") workerScope.postMessage({ type: "ready", revision: snapshot.revision } satisfies Reply);
  } else if (request.type === "cancel") {
    if (request.requestId === latestRequestId) {
      latestRequestId += 1;
      activeRequestId = 0;
    }
  } else {
    void search(request);
  }
};
