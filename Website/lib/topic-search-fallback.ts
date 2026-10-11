import { flattenTopics } from "./topic-catalog";
import { createTopicSuggestionIndex, searchTopicIndexYielding, type TopicQueryPlan } from "./topic-suggestions";
import type { TopicSearchWorkerReply } from "./topic-search-types";
import type { TopicNode } from "./types";
const indexes = new Map<number, ReturnType<typeof createTopicSuggestionIndex>>();
export async function searchTopicsWithYieldingFallback(nodes: TopicNode[], query: string, enrichment: TopicQueryPlan | string[], catalogRevision: number, isCurrent: () => boolean = () => true): Promise<TopicSearchWorkerReply | null> { let index = indexes.get(catalogRevision); if (!index) {
    await new Promise(r => setTimeout(r, 0));
    if (!isCurrent())
        return null;
    index = createTopicSuggestionIndex(flattenTopics(nodes));
    indexes.set(catalogRevision, index);
    if (indexes.size > 4)
        indexes.delete(indexes.keys().next().value!);
} const result = await searchTopicIndexYielding(index, query, enrichment, isCurrent); return result ? { type: "results", query, catalogRevision, ...result } : null; }
