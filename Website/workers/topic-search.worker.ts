/// <reference lib="webworker" />
import { SessionCache } from "@/lib/session-cache";
import { createDefaultTopics } from "@/lib/demo-data";
import { normalizeSearchText } from "@/lib/search";
import { createTopicSuggestionIndex, topicSearchRecords, updateTopicSuggestionIndex, searchTopicIndexYielding, type TopicQueryPlan, type TopicSearchRecord } from "@/lib/topic-suggestions";
import type { TopicNode } from "@/lib/types";
import type { TopicSearchWorkerReply } from "@/lib/topic-search-types";

type Request = {
    type: "initialize";
    customRecords?: TopicSearchRecord[];
    customTopics?: TopicNode[];
    catalogRevision: number;
} | {
    type: "update";
    baseRevision: number;
    catalogRevision: number;
    upserts: TopicSearchRecord[];
    removeIds: string[];
    orderIds?: string[];
} | {
    type: "search";
    requestId: number;
    query: string;
    semanticTerms: string[];
    plan?: TopicQueryPlan;
    catalogRevision: number;
} | { type: "cancel"; requestId: number };

const scope = self as DedicatedWorkerGlobalScope;
let revision = -1, latest = 0, epoch = 0;
let index: ReturnType<typeof createTopicSuggestionIndex> | null = null;
let builtinIds: string[] = [];
const cache = new SessionCache<TopicSearchWorkerReply>(100, 30 * 60 * 1000, 4 * 1024 * 1024);

scope.onmessage = (event: MessageEvent<Request>) => {
    const r = event.data;
    if (r.type === "initialize") {
        epoch++;
        revision = r.catalogRevision;
        cache.clear();
        const builtins = topicSearchRecords(createDefaultTopics());
        builtinIds = builtins.map(topic => topic.id);
        index = createTopicSuggestionIndex([...builtins, ...(r.customRecords ?? topicSearchRecords(r.customTopics ?? []))]);
        scope.postMessage({ type: "ready", catalogRevision: revision } satisfies TopicSearchWorkerReply);
    } else if (r.type === "update") {
        epoch++;
        if (!index || r.baseRevision !== revision) {
            scope.postMessage({ type: "rebuild", catalogRevision: r.catalogRevision } satisfies TopicSearchWorkerReply);
            return;
        }
        updateTopicSuggestionIndex(index, r.upserts, r.removeIds, r.orderIds ? [...builtinIds, ...r.orderIds] : undefined);
        revision = r.catalogRevision;
        cache.clear();
        scope.postMessage({ type: "ready", catalogRevision: revision } satisfies TopicSearchWorkerReply);
    } else if (r.type === "cancel") latest = r.requestId;
    else void search(r);
};

async function search(r: Extract<Request, { type: "search" }>) {
    if (!index || r.catalogRevision !== revision) return;
    latest = r.requestId;
    const generation = epoch;
    const key = JSON.stringify([revision, normalizeSearchText(r.query), r.plan || r.semanticTerms]);
    const cached = cache.get(key);
    if (cached) {
        scope.postMessage({ ...cached, query: r.query, requestId: r.requestId });
        return;
    }
    const result = await searchTopicIndexYielding(index, r.query, r.plan || r.semanticTerms, () => latest === r.requestId && revision === r.catalogRevision && generation === epoch);
    if (!result) return;
    const reply: TopicSearchWorkerReply = { type: "results", query: r.query, requestId: r.requestId, catalogRevision: revision, ...result };
    cache.set(key, reply);
    scope.postMessage(reply);
}
