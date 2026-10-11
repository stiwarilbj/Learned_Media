/// <reference lib="webworker" />
import { createDefaultTopics } from "@/lib/demo-data";
import { flattenTopics } from "@/lib/topic-catalog";
import { normalizeSearchText } from "@/lib/search";
import { createTopicSuggestionIndex, searchTopicIndexYielding, type TopicQueryPlan } from "@/lib/topic-suggestions";
import type { TopicNode } from "@/lib/types";
import type { TopicSearchWorkerReply } from "@/lib/topic-search-types";
type Request = {
    type: "initialize";
    customTopics: TopicNode[];
    catalogRevision: number;
} | {
    type: "search";
    requestId: number;
    query: string;
    semanticTerms: string[];
    plan?: TopicQueryPlan;
    catalogRevision: number;
} | {
    type: "cancel";
    requestId: number;
};
const scope = self as DedicatedWorkerGlobalScope;
let revision = -1, latest = 0, index: ReturnType<typeof createTopicSuggestionIndex> | null = null;
const cache = new Map<string, TopicSearchWorkerReply>();
scope.onmessage = (event: MessageEvent<Request>) => { const r = event.data; if (r.type === "initialize") {
    revision = r.catalogRevision;
    latest = 0;
    cache.clear();
    index = createTopicSuggestionIndex(flattenTopics([...createDefaultTopics(), ...r.customTopics]));
    scope.postMessage({ type: "ready", catalogRevision: revision });
}
else if (r.type === "cancel")
    latest = r.requestId;
else
    void search(r); };
async function search(r: Extract<Request, {
    type: "search";
}>) { if (!index || r.catalogRevision !== revision)
    return; latest = r.requestId; const key = JSON.stringify([revision, normalizeSearchText(r.query), r.plan || r.semanticTerms]); const cached = cache.get(key); if (cached) {
    scope.postMessage({ ...cached, query: r.query, requestId: r.requestId });
    return;
} const result = await searchTopicIndexYielding(index, r.query, r.plan || r.semanticTerms, () => latest === r.requestId && revision === r.catalogRevision); if (!result)
    return; const reply: TopicSearchWorkerReply = { type: "results", query: r.query, requestId: r.requestId, catalogRevision: revision, ...result }; cache.set(key, reply); if (cache.size > 100)
    cache.delete(cache.keys().next().value!); scope.postMessage(reply); }
