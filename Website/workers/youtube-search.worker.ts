/// <reference lib="webworker" />
import { searchYouTubeCandidates, type YouTubeSearchPlanLike, type YouTubeTopic, type YouTubeVideo } from "@/lib/youtube";

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
  | { type: "update"; revision: number; upserts: YouTubeVideo[]; removeIds: string[] }
  | { type: "cancel"; requestId: number }
  | SearchRequest;
type CandidateReply = { videoId: string; score: number; matchedFields: string[]; supportingText: string[] };
type Reply = { type: "ready"; revision: number } | { type: "stale"; requestId: number; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey?: string; candidates: CandidateReply[] };

const workerScope = self as DedicatedWorkerGlobalScope;
const videos = new Map<string, YouTubeVideo>();
const resultCache = new Map<string, CandidateReply[]>();
let revision = -1;
let latestRequestId = 0;
let activeRequestId = 0;

function remember(key: string, candidates: CandidateReply[]) {
  resultCache.delete(key);
  resultCache.set(key, candidates);
  if (resultCache.size > 80) resultCache.delete(resultCache.keys().next().value!);
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
  const key = cacheKey(request);
  const cached = resultCache.get(key);
  if (cached) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, candidates: cached } satisfies Reply);
    return;
  }

  const orderedVideos = [...videos.values()];
  const direct: Array<{ candidate: CandidateReply; index: number }> = [];
  const fallback: Array<{ candidate: CandidateReply; index: number }> = [];
  const chunkSize = 600;
  for (let start = 0; start < orderedVideos.length; start += chunkSize) {
    if (request.requestId !== latestRequestId || request.revision !== revision) return;
    const batch = orderedVideos.slice(start, start + chunkSize);
    const matches = searchYouTubeCandidates(batch, request.plan, request.topic, request.channelId, request.limit, request.excludedIds ?? [], Boolean(request.expanded));
    for (const match of matches) {
      const entry = { candidate: { videoId: match.video.id, score: match.score, matchedFields: match.matchedFields, supportingText: match.supportingText }, index: start + batch.findIndex((video) => video.id === match.video.id) };
      (match.matchedFields.includes("semantic-fallback") ? fallback : direct).push(entry);
    }
    if (start + chunkSize < orderedVideos.length) {
      await yieldToWorker();
      if (request.requestId !== latestRequestId || request.revision !== revision) return;
    }
  }
  const source = direct.length ? direct : fallback;
  source.sort((left, right) => right.candidate.score - left.candidate.score || left.index - right.index);
  const candidates = source.slice(0, Math.max(1, Math.min(80, request.limit))).map(({ candidate }) => candidate);
  remember(key, candidates);
  if (request.requestId === latestRequestId && request.revision === revision) {
    if (activeRequestId === request.requestId) activeRequestId = 0;
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, candidates } satisfies Reply);
  }
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize") {
    videos.clear();
    for (const video of request.videos) videos.set(video.id, video);
    revision = request.revision;
    latestRequestId = 0;
    activeRequestId = 0;
    resultCache.clear();
    workerScope.postMessage({ type: "ready", revision } satisfies Reply);
  } else if (request.type === "update") {
    const staleRequestId = activeRequestId;
    activeRequestId = 0;
    latestRequestId += 1;
    for (const id of request.removeIds) videos.delete(id);
    for (const video of request.upserts) videos.set(video.id, video);
    revision = request.revision;
    resultCache.clear();
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
