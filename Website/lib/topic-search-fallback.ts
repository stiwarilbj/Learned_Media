import { normalizeSearchText } from "./search";
import { createTopicSuggestionIndex, suggestTopics } from "./topic-suggestions";
import type { TopicSearchWorkerReply } from "./topic-search-types";
import type { TopicNode } from "./types";

type FallbackIndex = {
  suggestionIndex: ReturnType<typeof createTopicSuggestionIndex>;
  searchable: Map<string, { label: string; aliases: string[]; parent?: string }>;
};

const fallbackIndexes = new Map<number, Promise<FallbackIndex>>();

function topicScore(query: string, label: string, aliases: string[]) {
  if (query.length < 2) return 0;
  let best = 0;
  for (const value of [label, ...aliases]) {
    if (value.includes(query)) best = Math.max(best, 100 + query.length);
    else {
      const tokens = query.split(" ").filter((token) => token.length > 1);
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

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function buildFallbackIndex(nodes: TopicNode[]): Promise<FallbackIndex> {
  const flattened: Array<TopicNode & { path: string[] }> = [];
  const searchable = new Map<string, { label: string; aliases: string[]; parent?: string }>();
  const stack = nodes.slice().reverse().map((node) => ({ node, parent: undefined as string | undefined, parentPath: [] as string[] }));

  while (stack.length) {
    const { node, parent, parentPath } = stack.pop()!;
    const path = [...parentPath, node.label];
    flattened.push({ ...node, path });
    searchable.set(node.id, { label: normalizeSearchText(node.label), aliases: (node.aliases ?? []).map(normalizeSearchText), parent });
    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index -= 1) {
      stack.push({ node: node.children![index], parent: node.id, parentPath: path });
    }
    if (flattened.length % 500 === 0) await yieldToBrowser();
  }

  return { suggestionIndex: createTopicSuggestionIndex(flattened), searchable };
}

function fallbackIndex(nodes: TopicNode[], catalogRevision: number) {
  let index = fallbackIndexes.get(catalogRevision);
  if (!index) {
    index = buildFallbackIndex(nodes);
    fallbackIndexes.set(catalogRevision, index);
    while (fallbackIndexes.size > 4) fallbackIndexes.delete(fallbackIndexes.keys().next().value!);
  }
  return index;
}

export async function searchTopicsWithYieldingFallback(nodes: TopicNode[], query: string, semanticTerms: string[], catalogRevision: number, isCurrent: () => boolean = () => true): Promise<TopicSearchWorkerReply | null> {
  const { suggestionIndex, searchable } = await fallbackIndex(nodes, catalogRevision);
  if (!isCurrent()) return null;
  const normalizedQuery = normalizeSearchText(query);
  const directScores = new Map<string, number>();
  const visibleIds = new Set<string>();
  const matchingDescendants = new Set<string>();
  let processed = 0;
  for (const [id, item] of searchable) {
    const score = topicScore(normalizedQuery, item.label, item.aliases);
    if (score) {
      directScores.set(id, score);
      visibleIds.add(id);
      let parent = item.parent;
      while (parent) {
        visibleIds.add(parent);
        matchingDescendants.add(parent);
        parent = searchable.get(parent)?.parent;
      }
    }
    processed += 1;
    if (processed % 800 === 0) {
      await yieldToBrowser();
      if (!isCurrent()) return null;
    }
  }

  return {
    type: "results",
    query,
    catalogRevision,
    suggestions: suggestTopics(suggestionIndex, query, semanticTerms),
    visibleIds: [...visibleIds],
    matchingDescendants: [...matchingDescendants],
    directScores: [...directScores]
  };
}
