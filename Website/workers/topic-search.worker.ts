/// <reference lib="webworker" />
import { createDefaultTopics } from "@/lib/demo-data";
import { flattenTopics } from "@/lib/topic-catalog";
import { normalizeSearchText } from "@/lib/search";
import { createTopicSuggestionIndex, suggestTopics, type TopicSuggestionIndex } from "@/lib/topic-suggestions";
import type { TopicNode } from "@/lib/types";
import type { TopicSearchWorkerReply } from "@/lib/topic-search-types";

type Request = { type: "initialize"; customTopics: TopicNode[]; catalogRevision: number } | { type: "search"; query: string; semanticTerms: string[]; catalogRevision: number };

const workerScope = self as DedicatedWorkerGlobalScope;
let catalogRevision = -1;
let suggestionIndex: TopicSuggestionIndex | null = null;
let searchable = new Map<string, { label: string; aliases: string[]; parent?: string; children: string[]; order: number }>();
const resultCache = new Map<string, TopicSearchWorkerReply>();

function scoreTopic(query: string, label: string, aliases: string[]) {
  if (query.length < 2) return 0;
  const values = [label, ...aliases];
  let best = 0;
  for (const value of values) {
    if (value.includes(query)) best = Math.max(best, 100 + query.length);
    else {
      const tokens = query.split(" ").filter((token) => token.length > 1);
      if (!tokens.length) continue;
      const valueTokens = value.split(" ").filter(Boolean);
      let score = 0;
      for (const token of tokens) {
        const match = valueTokens.find((candidate) => candidate.startsWith(token));
        if (!match) { score = 0; break; }
        score += match === token ? 20 : 13;
      }
      if (score) best = Math.max(best, score + 12);
    }
  }
  return best;
}

function initialize(customTopics: TopicNode[], revision: number) {
  const nodes = [...createDefaultTopics(), ...customTopics];
  const flattened = flattenTopics(nodes);
  suggestionIndex = createTopicSuggestionIndex(flattened);
  searchable = new Map(flattened.map((item, order) => [item.id, {
    label: normalizeSearchText(item.label),
    aliases: (item.aliases ?? []).map(normalizeSearchText),
    parent: undefined,
    children: item.children?.map((child) => child.id) ?? [],
    order
  }]));
  const parentByChild = new Map<string, string>();
  for (const [id, item] of searchable) for (const child of item.children) parentByChild.set(child, id);
  for (const [id, item] of searchable) item.parent = parentByChild.get(id);
  catalogRevision = revision;
  resultCache.clear();
  workerScope.postMessage({ type: "ready", catalogRevision } satisfies TopicSearchWorkerReply);
}

function search(query: string, semanticTerms: string[], revision: number) {
  if (revision !== catalogRevision || !suggestionIndex) return;
  const normalized = normalizeSearchText(query);
  const cacheKey = `${revision}\u0000${normalized}\u0000${semanticTerms.map(normalizeSearchText).join("\u0001")}`;
  const cached = resultCache.get(cacheKey);
  if (cached) { workerScope.postMessage(cached); return; }

  const scores = new Map<string, number>();
  for (const [id, item] of searchable) {
    const score = scoreTopic(normalized, item.label, item.aliases);
    if (score) scores.set(id, score);
  }
  const visibleIds = new Set<string>();
  const matchingDescendants = new Set<string>();
  for (const id of scores.keys()) {
    visibleIds.add(id);
    let parent = searchable.get(id)?.parent;
    while (parent) {
      visibleIds.add(parent);
      matchingDescendants.add(parent);
      parent = searchable.get(parent)?.parent;
    }
  }
  const reply: TopicSearchWorkerReply = {
    type: "results", query, catalogRevision: revision,
    suggestions: suggestTopics(suggestionIndex, query, semanticTerms),
    visibleIds: [...visibleIds], matchingDescendants: [...matchingDescendants], directScores: [...scores]
  };
  resultCache.set(cacheKey, reply);
  if (resultCache.size > 100) resultCache.delete(resultCache.keys().next().value!);
  workerScope.postMessage(reply);
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "initialize") initialize(request.customTopics, request.catalogRevision);
  else search(request.query, request.semanticTerms, request.catalogRevision);
};
