/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import { normalizeSearchText, searchScoreNormalized } from "@/lib/search";
import { runBackgroundSlice } from "@/lib/background-work";

type SearchDocument = { id: string; text: string };
type Request =
  | { type: "initialize"; revision: number; documents: SearchDocument[] }
  | { type: "update"; revision: number; upserts: SearchDocument[]; removeIds: string[] }
  | { type: "register-eligibility"; revision: number; eligibilityScope: string; eligibilityRevision: number; ids: string[] }
  | { type: "cancel"; requestId: number }
  | { type: "search"; requestId: number; revision: number; query: string; eligibilityScope: string; eligibilityRevision: number; viewKey: string };
type Reply = { type: "ready"; revision: number } | { type: "eligibility-stale"; requestId: number; revision: number; eligibilityScope: string; eligibilityRevision: number } | { type: "results"; requestId: number; revision: number; query: string; eligibilityScope: string; eligibilityRevision: number; viewKey: string; ids: string[] };

const workerScope = self as DedicatedWorkerGlobalScope;
const documents = new Map<string, string>();
const resultCache = new SessionCache<string[]>(100, 30 * 60 * 1000, 4 * 1024 * 1024);
let activeEligibility: { scope: string; revision: number; ids: string[] } | null = null;
let revision = -1;
let latestRequestId = 0;

function addDocuments(items: SearchDocument[]) {
  for (const item of items) documents.set(item.id, normalizeSearchText(item.text));
}

function cacheResult(key: string, value: string[]) {
  resultCache.set(key, value);
}

async function search(request: Extract<Request, { type: "search" }>) {
  if (request.revision !== revision) return;
  const eligibility = activeEligibility;
  if (!eligibility || eligibility.scope !== request.eligibilityScope || eligibility.revision !== request.eligibilityRevision) {
    workerScope.postMessage({ type: "eligibility-stale", requestId: request.requestId, revision, eligibilityScope: request.eligibilityScope, eligibilityRevision: request.eligibilityRevision } satisfies Reply);
    return;
  }
  latestRequestId = request.requestId;
  const normalizedQuery = normalizeSearchText(request.query);
  const key = `${revision}\u0000${request.eligibilityScope}\u0000${request.eligibilityRevision}\u0000${normalizedQuery}\u0000${request.viewKey}`;
  const cached = resultCache.get(key);
  if (cached) {
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, eligibilityScope: eligibility.scope, eligibilityRevision: eligibility.revision, viewKey: request.viewKey, ids: cached } satisfies Reply);
    return;
  }
  const ranked: Array<{ id: string; index: number; score: number }> = [];
  for (let index = 0; index < eligibility.ids.length;) {
    if (request.requestId !== latestRequestId || activeEligibility !== eligibility) return;
    const start = index;
    const next = await runBackgroundSlice(() => {
      let position = start;
      const beganAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      while (position < eligibility.ids.length && position - start < 400 && (typeof performance !== "undefined" ? performance.now() : Date.now()) - beganAt < 4) {
        if (request.requestId !== latestRequestId || activeEligibility !== eligibility) return position;
        const id = eligibility.ids[position];
        const text = documents.get(id);
        if (text !== undefined) {
          const score = searchScoreNormalized(normalizedQuery, text);
          if (score > 0) ranked.push({ id, index: position, score });
        }
        position += 1;
      }
      return position;
    }, { priority: "interactive", canPause: true });
    if (request.requestId !== latestRequestId || request.revision !== revision || activeEligibility !== eligibility) return;
    if (next <= start) return;
    index = next;
  }
  if (request.requestId !== latestRequestId || activeEligibility !== eligibility) return;
  ranked.sort((left, right) => right.score - left.score || left.index - right.index);
  const ids = ranked.map(({ id }) => id);
  cacheResult(key, ids);
  workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, eligibilityScope: eligibility.scope, eligibilityRevision: eligibility.revision, viewKey: request.viewKey, ids } satisfies Reply);
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize") {
    documents.clear();
    addDocuments(request.documents);
    revision = request.revision;
    latestRequestId = 0;
    activeEligibility = null;
    resultCache.clear();
    workerScope.postMessage({ type: "ready", revision } satisfies Reply);
  } else if (request.type === "update") {
    latestRequestId += 1;
    for (const id of request.removeIds) documents.delete(id);
    addDocuments(request.upserts);
    revision = request.revision;
    resultCache.clear();
  } else if (request.type === "register-eligibility") {
    if (request.revision !== revision) return;
    if (activeEligibility?.scope === request.eligibilityScope && activeEligibility.revision === request.eligibilityRevision) return;
    activeEligibility = { scope: request.eligibilityScope, revision: request.eligibilityRevision, ids: request.ids.slice() };
    latestRequestId += 1;
  } else if (request.type === "cancel") {
    latestRequestId = request.requestId;
  } else {
    void search(request);
  }
};
