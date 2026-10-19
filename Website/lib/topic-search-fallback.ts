import { createTopicSuggestionIndex, diffTopicSearchRecords, topicSearchRecords, updateTopicSuggestionIndex, searchTopicIndexYielding, type TopicQueryPlan, type TopicSearchRecord } from "./topic-suggestions";
import type { TopicSearchWorkerReply } from "./topic-search-types";
import type { TopicNode } from "./types";

type CachedIndex = { revision: number; index: ReturnType<typeof createTopicSuggestionIndex>; custom: Map<string, TopicSearchRecord>; builtinIds: string[] };
const indexes = new Map<string, CachedIndex>();

export async function searchTopicsWithYieldingFallback(nodes: TopicNode[], query: string, enrichment: TopicQueryPlan | string[], catalogRevision: number, isCurrent: () => boolean = () => true, rebuildKey = "default"): Promise<TopicSearchWorkerReply | null> {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!isCurrent()) return null;
    const custom = topicSearchRecords(nodes.filter(topic => topic.custom));
    let cached = indexes.get(rebuildKey);
    if (!cached) {
        const builtins = topicSearchRecords(nodes.filter(topic => !topic.custom));
        cached = { revision: catalogRevision, index: createTopicSuggestionIndex([...builtins, ...custom]), custom: new Map(custom.map(topic => [topic.id, topic])), builtinIds: builtins.map(topic => topic.id) };
        indexes.set(rebuildKey, cached);
        if (indexes.size > 4) indexes.delete(indexes.keys().next().value!);
    } else if (cached.revision !== catalogRevision) {
        const changes = diffTopicSearchRecords(cached.custom, custom);
        updateTopicSuggestionIndex(cached.index, changes.upserts, changes.removeIds, changes.orderIds ? [...cached.builtinIds, ...changes.orderIds] : undefined);
        cached.custom = new Map(custom.map(topic => [topic.id, topic]));
        cached.revision = catalogRevision;
    }
    const result = await searchTopicIndexYielding(cached.index, query, enrichment, () => isCurrent() && cached.revision === catalogRevision);
    return result ? { type: "results", query, catalogRevision, ...result } : null;
}
