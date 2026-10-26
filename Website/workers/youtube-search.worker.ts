/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import type { YouTubeSearchPlanLike, YouTubeTopic, YouTubeVideo } from "@/lib/youtube";
import { PreparedVideoSearchCache, searchPreparedSemanticVideos } from "@/lib/video-semantic";

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
  | { type: "initialize"; revision: number; videos: YouTubeVideo[] }
  | { type: "update"; baseRevision: number; revision: number; upserts: YouTubeVideo[]; removeIds: string[]; orderIds?: string[] }
  | { type: "cancel"; requestId: number }
  | SearchRequest;
type CandidateReply = { coverage?: { matchedConcepts: number[]; missingConcepts: number[]; complete: boolean }; videoId: string; score: number; matchedFields: string[]; supportingText: string[] };
type Reply = { type: "ready" | "rebuild"; revision: number } | { type: "stale"; requestId: number; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey?: string; candidates: CandidateReply[] };

const workerScope = self as DedicatedWorkerGlobalScope;
const videos = new Map<string, YouTubeVideo>();
let orderedVideos: YouTubeVideo[] = [];
const resultCache = new SessionCache<CandidateReply[]>(80, 30 * 60 * 1000, 4 * 1024 * 1024);
const preparedSearchCache = new PreparedVideoSearchCache(4);
let revision = -1;
let latestRequestId = 0;
let activeRequestId = 0;
let indexEpoch = 0;

function sameVideoRecord(previous: YouTubeVideo | undefined, next: YouTubeVideo): boolean {
  if (!previous) return false;
  const previousRecord = previous as unknown as Record<string, unknown>;
  const nextRecord = next as unknown as Record<string, unknown>;
  const previousKeys = Object.keys(previousRecord);
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

function mapMatchesOrderedVideos(map: Map<string, YouTubeVideo>, ordered: YouTubeVideo[]): boolean {
  if (map.size !== ordered.length) return false;
  let index = 0;
  for (const [id, video] of map) {
    const expected = ordered[index++];
    if (!expected || expected.id !== id || expected !== video) return false;
  }
  return true;
}

function mapsHaveSameEntries(left: Map<string, YouTubeVideo>, right: Map<string, YouTubeVideo>): boolean {
  if (left.size !== right.size) return false;
  const leftEntries = left.entries(), rightEntries = right.entries();
  while (true) {
    const a = leftEntries.next(), b = rightEntries.next();
    if (a.done || b.done) return a.done === b.done;
    if (a.value[0] !== b.value[0] || a.value[1] !== b.value[1]) return false;
  }
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
  if (request.revision !== revision) return;
  latestRequestId = request.requestId;
  activeRequestId = request.requestId;
  const epoch = indexEpoch;
  const key = cacheKey(request);
  const cached = resultCache.get(key);
  if (cached) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, candidates: cached } satisfies Reply);
    return;
  }

  // The retained snapshot is replaced on catalog changes, never mutated, so
  // yielded searches keep stable positions even if a newer update arrives.
  const catalog = orderedVideos;
  const prepared = preparedSearchCache.get(request.plan, request.topic, request.channelId, revision, request.viewKey ?? "worker");
  const excludedIds = request.excludedIds?.length ? new Set(request.excludedIds) : new Set<string>();
  const direct: Array<{ candidate: CandidateReply; index: number }> = [];
  const fallback: Array<{ candidate: CandidateReply; index: number }> = [];
  const chunkSize = 600;
  for (let start = 0; start < catalog.length; start += chunkSize) {
    if (request.requestId !== latestRequestId || request.revision !== revision || epoch !== indexEpoch) return;
    const batch = catalog.slice(start, start + chunkSize);
    const positions = new Map(batch.map((video, index) => [video.id, start + index]));
    const matches = searchPreparedSemanticVideos(batch, prepared, request.limit, excludedIds);
    for (const match of matches) {
      const entry = { candidate: { coverage: match.coverage, videoId: match.video.id, score: match.score, matchedFields: match.matchedFields, supportingText: match.supportingText }, index: positions.get(match.video.id)! };
      (match.matchedFields.includes("semantic-fallback") ? fallback : direct).push(entry);
    }
    if (start + chunkSize < catalog.length) {
      await yieldToWorker();
      if (request.requestId !== latestRequestId || request.revision !== revision || epoch !== indexEpoch) return;
    }
  }
  const source = direct.length ? direct : fallback;
  source.sort((left, right) => {
    const a = catalog[left.index], b = catalog[right.index];
    const dateOrder = prepared.sort === "newest" ? b.publishedAt.localeCompare(a.publishedAt) : prepared.sort === "oldest" ? a.publishedAt.localeCompare(b.publishedAt) : 0;
    return dateOrder || right.candidate.score - left.candidate.score || left.index - right.index;
  });
  const candidates = source.slice(0, Math.max(1, request.limit)).map(({ candidate }) => candidate);
  remember(key, candidates);
  if (request.requestId === latestRequestId && request.revision === revision) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, candidates } satisfies Reply);
  }
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize") {
    indexEpoch++;
    videos.clear();
    for (const video of request.videos) videos.set(video.id, video);
    orderedVideos = Array.from(videos.values());
    revision = request.revision;
    latestRequestId = 0;
    activeRequestId = 0;
    resultCache.clear();
    preparedSearchCache.clear();
    workerScope.postMessage({ type: "ready", revision } satisfies Reply);
  } else if (request.type === "update") {
    indexEpoch++;
    if (revision < 0 || request.baseRevision !== revision) {
      const staleRequestId = activeRequestId;
      activeRequestId = 0;
      latestRequestId += 1;
      if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision: request.revision } satisfies Reply);
      workerScope.postMessage({ type: "rebuild", revision: request.revision } satisfies Reply);
      return;
    }
    const staleRequestId = activeRequestId;
    activeRequestId = 0;
    latestRequestId += 1;
    for (const id of request.removeIds) videos.delete(id);
    for (const video of request.upserts) {
      const previous = videos.get(video.id);
      if (!sameVideoRecord(previous, video)) videos.set(video.id, video);
    }
    if (request.orderIds) {
      const ordered = new Map<string, YouTubeVideo>();
      for (const id of request.orderIds) {
        const video = videos.get(id);
        if (video) ordered.set(id, video);
      }
      if (!mapsHaveSameEntries(videos, ordered)) {
        videos.clear();
        for (const [id, video] of ordered) videos.set(id, video);
      }
      if (!mapMatchesOrderedVideos(ordered, orderedVideos)) orderedVideos = Array.from(ordered.values());
    } else if (!mapMatchesOrderedVideos(videos, orderedVideos)) {
      orderedVideos = Array.from(videos.values());
    }
    revision = request.revision;
    resultCache.clear();
    preparedSearchCache.clear();
    if (staleRequestId) workerScope.postMessage({ type: "stale", requestId: staleRequestId, revision } satisfies Reply);
  } else if (request.type === "cancel") {
    if (request.requestId === latestRequestId) {
      latestRequestId += 1;
      activeRequestId = 0;
    }
  } else {
    void search(request);
  }
};
