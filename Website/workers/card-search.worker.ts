/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import { normalizeSearchText, searchScoreNormalized, tokenizeSearchDocument, tokenizeSearchQuery } from "@/lib/search";
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
const MAX_INDEXED_FUZZY_TOKEN_LENGTH = 32;
type IndexedDocument = { normalizedText: string; tokens: string[] };
const documents = new Map<string, IndexedDocument>();
// Word postings narrow ordinary, prefix, and fuzzy matches without changing
// the scoring function. Phrase postings preserve the scorer's substring fast
// path, which can match across word boundaries.
const wordDocuments = new Map<string, Set<string>>();
const prefixWords = new Map<string, Set<string>>();
const fuzzyWords = new Map<string, Set<string>>();
const trigramDocuments = new Map<string, Set<string>>();
const documentWords = new Map<string, string[]>();
const documentTrigrams = new Map<string, string[]>();
const wordUseCounts = new Map<string, number>();
const wordFuzzyKeys = new Map<string, string[]>();
const longFuzzyTokenCounts = new Map<number, number>();
const resultCache = new SessionCache<string[]>(100, 30 * 60 * 1000, 4 * 1024 * 1024);
let activeEligibility: { scope: string; revision: number; ids: string[]; positionsById: Map<string, number[]> } | null = null;
let revision = -1;
let latestRequestId = 0;

function addToIndex(index: Map<string, Set<string>>, key: string, value: string) {
  let values = index.get(key);
  if (!values) index.set(key, values = new Set());
  values.add(value);
}

function removeFromIndex(index: Map<string, Set<string>>, key: string, value: string) {
  const values = index.get(key);
  if (!values) return;
  values.delete(value);
  if (!values.size) index.delete(key);
}

function deletionSignatures(value: string, maxDeletes: number) {
  const signatures = new Set([value]);
  let frontier = [value];
  for (let depth = 0; depth < maxDeletes && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const current of frontier) {
      for (let index = 0; index < current.length; index += 1) {
        const signature = current.slice(0, index) + current.slice(index + 1);
        if (!signatures.has(signature)) {
          signatures.add(signature);
          next.push(signature);
        }
      }
    }
    frontier = next;
  }
  return [...signatures];
}

function trigrams(value: string) {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - 3; index += 1) result.add(value.slice(index, index + 3));
  return [...result];
}

function clearSearchIndex() {
  documents.clear();
  wordDocuments.clear();
  prefixWords.clear();
  fuzzyWords.clear();
  trigramDocuments.clear();
  documentWords.clear();
  documentTrigrams.clear();
  wordUseCounts.clear();
  wordFuzzyKeys.clear();
  longFuzzyTokenCounts.clear();
}

function removeDocument(id: string) {
  if (!documents.has(id)) return;
  documents.delete(id);
  for (const word of documentWords.get(id) ?? []) {
    removeFromIndex(wordDocuments, word, id);
    const nextCount = (wordUseCounts.get(word) ?? 1) - 1;
    if (nextCount > 0) {
      wordUseCounts.set(word, nextCount);
      continue;
    }
    wordUseCounts.delete(word);
    for (let length = 1; length <= word.length; length += 1) removeFromIndex(prefixWords, word.slice(0, length), word);
    if (word.length > MAX_INDEXED_FUZZY_TOKEN_LENGTH) {
      const remaining = (longFuzzyTokenCounts.get(word.length) ?? 1) - 1;
      if (remaining > 0) longFuzzyTokenCounts.set(word.length, remaining);
      else longFuzzyTokenCounts.delete(word.length);
    } else if (word.length >= 4) {
      for (const key of wordFuzzyKeys.get(word) ?? []) removeFromIndex(fuzzyWords, key, word);
      wordFuzzyKeys.delete(word);
    }
  }
  documentWords.delete(id);
  for (const gram of documentTrigrams.get(id) ?? []) removeFromIndex(trigramDocuments, gram, id);
  documentTrigrams.delete(id);
}

function addDocument(item: SearchDocument) {
  removeDocument(item.id);
  const normalizedText = normalizeSearchText(item.text);
  const tokens = tokenizeSearchDocument(normalizedText);
  documents.set(item.id, { normalizedText, tokens });

  const words = [...new Set(tokens)];
  documentWords.set(item.id, words);
  for (const word of words) {
    addToIndex(wordDocuments, word, item.id);
    const count = wordUseCounts.get(word) ?? 0;
    wordUseCounts.set(word, count + 1);
    if (count > 0) continue;
    for (let length = 1; length <= word.length; length += 1) addToIndex(prefixWords, word.slice(0, length), word);
    if (word.length > MAX_INDEXED_FUZZY_TOKEN_LENGTH) {
      longFuzzyTokenCounts.set(word.length, (longFuzzyTokenCounts.get(word.length) ?? 0) + 1);
    } else if (word.length >= 4) {
      const keys = deletionSignatures(word, 2);
      wordFuzzyKeys.set(word, keys);
      for (const key of keys) addToIndex(fuzzyWords, key, word);
    }
  }

  const grams = trigrams(normalizedText);
  documentTrigrams.set(item.id, grams);
  for (const gram of grams) addToIndex(trigramDocuments, gram, item.id);
}

function addDocuments(items: SearchDocument[]) {
  for (const item of items) addDocument(item);
}

function candidatePostings(normalizedQuery: string, queryTokens: readonly string[]) {
  // Short queries can match arbitrary substrings that have no token index.
  // Very long fuzzy words are deliberately not expanded into quadratic-sized
  // deletion indexes; use the original full scan whenever they could matter.
  if (normalizedQuery.length < 3 || queryTokens.length === 0) return null;
  const postings = new Set<Set<string>>();
  const addWord = (word: string) => {
    const ids = wordDocuments.get(word);
    if (ids) postings.add(ids);
  };
  for (const queryToken of queryTokens) {
    for (const word of prefixWords.get(queryToken) ?? []) addWord(word);
    addWord(queryToken);
    for (let length = 1; length < queryToken.length; length += 1) addWord(queryToken.slice(0, length));

    if (queryToken.length >= 4) {
      const threshold = queryToken.length >= 8 ? 2 : 1;
      if (queryToken.length > MAX_INDEXED_FUZZY_TOKEN_LENGTH || [...longFuzzyTokenCounts.keys()].some(length => Math.abs(length - queryToken.length) <= threshold)) return null;
      for (const signature of deletionSignatures(queryToken, threshold)) {
        for (const word of fuzzyWords.get(signature) ?? []) addWord(word);
      }
    }
  }

  // Every exact phrase match contains each of its trigrams. Starting from the
  // rarest one gives a lossless, usually much smaller substring candidate set.
  let rarest: Set<string> | undefined;
  let phrasePossible = true;
  for (let index = 0; index <= normalizedQuery.length - 3; index += 1) {
    const matches = trigramDocuments.get(normalizedQuery.slice(index, index + 3));
    if (!matches) {
      phrasePossible = false;
      break;
    }
    if (!rarest || matches.size < rarest.size) rarest = matches;
  }
  if (phrasePossible && rarest) postings.add(rarest);
  return [...postings];
}

async function collectCandidatePositions(
  postingSets: Set<string>[],
  eligibility: NonNullable<typeof activeEligibility>,
  requestId: number
) {
  const positions = new Set<number>();
  let postingIndex = 0;
  let current: Iterator<string> | null = null;
  while (postingIndex < postingSets.length) {
    if (requestId !== latestRequestId || activeEligibility !== eligibility) return null;
    const startIndex = postingIndex;
    const nextIndex = await runBackgroundSlice(() => {
      let processed = 0;
      const beganAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      while (postingIndex < postingSets.length && processed < 400 && (typeof performance !== "undefined" ? performance.now() : Date.now()) - beganAt < 4) {
        if (requestId !== latestRequestId || activeEligibility !== eligibility) return postingIndex;
        current ??= postingSets[postingIndex].values();
        const result = current.next();
        if (result.done) {
          current = null;
          postingIndex += 1;
          continue;
        }
        for (const position of eligibility.positionsById.get(result.value) ?? []) positions.add(position);
        processed += 1;
      }
      return postingIndex;
    }, { priority: "interactive", canPause: true });
    if (requestId !== latestRequestId || activeEligibility !== eligibility) return null;
    if (nextIndex < startIndex || nextIndex === startIndex && !current) return null;
  }
  return [...positions];
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
  const queryTokens = tokenizeSearchQuery(normalizedQuery);
  const postingSets = candidatePostings(normalizedQuery, queryTokens);
  const candidates = postingSets === null ? null : await collectCandidatePositions(postingSets, eligibility, request.requestId);
  if (request.requestId !== latestRequestId || request.revision !== revision || activeEligibility !== eligibility) return;
  if (candidates === null && postingSets !== null) return;
  const ranked: Array<{ id: string; index: number; score: number }> = [];
  const candidateCount = candidates?.length ?? eligibility.ids.length;
  for (let index = 0; index < candidateCount;) {
    if (request.requestId !== latestRequestId || activeEligibility !== eligibility) return;
    const start = index;
    const next = await runBackgroundSlice(() => {
      let position = start;
      const beganAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      while (position < candidateCount && position - start < 400 && (typeof performance !== "undefined" ? performance.now() : Date.now()) - beganAt < 4) {
        if (request.requestId !== latestRequestId || activeEligibility !== eligibility) return position;
        const originalPosition = candidates?.[position] ?? position;
        const id = eligibility.ids[originalPosition];
        const document = documents.get(id);
        if (document !== undefined) {
          const score = searchScoreNormalized(normalizedQuery, document.normalizedText, queryTokens, document.tokens);
          if (score > 0) ranked.push({ id, index: originalPosition, score });
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
    clearSearchIndex();
    addDocuments(request.documents);
    revision = request.revision;
    latestRequestId = 0;
    activeEligibility = null;
    resultCache.clear();
    workerScope.postMessage({ type: "ready", revision } satisfies Reply);
  } else if (request.type === "update") {
    latestRequestId += 1;
    for (const id of request.removeIds) removeDocument(id);
    addDocuments(request.upserts);
    revision = request.revision;
    resultCache.clear();
  } else if (request.type === "register-eligibility") {
    if (request.revision !== revision) return;
    if (activeEligibility?.scope === request.eligibilityScope && activeEligibility.revision === request.eligibilityRevision) return;
    const ids = request.ids.slice();
    const positionsById = new Map<string, number[]>();
    ids.forEach((id, index) => {
      const positions = positionsById.get(id);
      if (positions) positions.push(index);
      else positionsById.set(id, [index]);
    });
    activeEligibility = { scope: request.eligibilityScope, revision: request.eligibilityRevision, ids, positionsById };
    latestRequestId += 1;
  } else if (request.type === "cancel") {
    latestRequestId = request.requestId;
  } else {
    void search(request).catch(() => {
      if (request.requestId === latestRequestId && request.revision === revision) workerScope.postMessage({ type: "failed", requestId: request.requestId, revision });
    });
  }
};
