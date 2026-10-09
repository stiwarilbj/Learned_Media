/// <reference lib="webworker" />
import { normalizeSearchText, searchScoreNormalized } from "@/lib/search";

type SearchDocument = { id: string; text: string };
type Request =
  | { type: "initialize"; revision: number; documents: SearchDocument[] }
  | { type: "update"; revision: number; upserts: SearchDocument[]; removeIds: string[] }
  | { type: "cancel"; requestId: number }
  | { type: "search"; requestId: number; revision: number; query: string; eligibleIds: string[]; viewKey: string };
type Reply = { type: "ready"; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey: string; ids: string[] };

const workerScope = self as DedicatedWorkerGlobalScope;
const documents = new Map<string, string>();
const resultCache = new Map<string, string[]>();
let revision = -1;
let latestRequestId = 0;

function addDocuments(items: SearchDocument[]) {
  for (const item of items) documents.set(item.id, normalizeSearchText(item.text));
}

function cacheResult(key: string, value: string[]) {
  resultCache.delete(key);
  resultCache.set(key, value);
  if (resultCache.size > 100) resultCache.delete(resultCache.keys().next().value!);
}

function yieldToWorker() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function search(request: Extract<Request, { type: "search" }>) {
  if (request.revision !== revision) return;
  latestRequestId = request.requestId;
  const normalizedQuery = normalizeSearchText(request.query);
  const key = `${revision}\u0000${request.viewKey}\u0000${normalizedQuery}\u0000${request.eligibleIds.join("\u0001")}`;
  const cached = resultCache.get(key);
  if (cached) {
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, ids: cached } satisfies Reply);
    return;
  }
  const ranked: Array<{ id: string; index: number; score: number }> = [];
  for (let index = 0; index < request.eligibleIds.length; index += 1) {
    if (request.requestId !== latestRequestId) return;
    const id = request.eligibleIds[index];
    const text = documents.get(id);
    if (text === undefined) continue;
    const score = searchScoreNormalized(normalizedQuery, text);
    if (score > 0) ranked.push({ id, index, score });
    if (index > 0 && index % 400 === 0) {
      await yieldToWorker();
      if (request.requestId !== latestRequestId || request.revision !== revision) return;
    }
  }
  if (request.requestId !== latestRequestId) return;
  ranked.sort((left, right) => right.score - left.score || left.index - right.index);
  const ids = ranked.map(({ id }) => id);
  cacheResult(key, ids);
  workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, viewKey: request.viewKey, ids } satisfies Reply);
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize") {
    documents.clear();
    addDocuments(request.documents);
    revision = request.revision;
    latestRequestId = 0;
    resultCache.clear();
    workerScope.postMessage({ type: "ready", revision } satisfies Reply);
  } else if (request.type === "update") {
    latestRequestId += 1;
    for (const id of request.removeIds) documents.delete(id);
    addDocuments(request.upserts);
    revision = request.revision;
    resultCache.clear();
  } else if (request.type === "cancel") {
    latestRequestId = request.requestId;
  } else {
    void search(request);
  }
};
