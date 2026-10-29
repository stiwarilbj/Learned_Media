importScripts("background-work.js");
importScripts("topic-semantic.js");
let index = null, revision = "", latest = 0, epoch = 0, builtinIds = [];
self.onmessage = function (event) {
    const r = event.data;
    if (r.type === "initialize") {
        epoch++;
        revision = r.revision;
        index = LEARNED_MEDIA_TOPIC_SEARCH.createTopicSuggestionIndex(r.topics);
        const customIds = new Set(r.customIds || r.topics.filter(t => t.custom).map(t => t.id));
        builtinIds = r.topics.filter(t => !customIds.has(t.id)).map(t => t.id);
        self.postMessage({ type: "ready", revision });
    } else if (r.type === "update") {
        epoch++;
        if (!index || r.baseRevision !== revision) { self.postMessage({ type: "rebuild", revision: r.revision }); return; }
        LEARNED_MEDIA_TOPIC_SEARCH.updateTopicSuggestionIndex(index, r.upserts, r.removeIds, r.orderIds ? builtinIds.concat(r.orderIds) : undefined);
        revision = r.revision;
        self.postMessage({ type: "ready", revision });
    } else if (r.type === "cancel") latest = r.id;
    else if (index && r.revision === revision) {
        latest = r.id;
        const generation = epoch;
        LEARNED_MEDIA_TOPIC_SEARCH.searchTopicIndexYielding(index, r.query, r.plan || [], () => latest === r.id && revision === r.revision && generation === epoch).then(result => {
            if (result) self.postMessage({ type: "results", id: r.id, key: r.key, query: r.query, revision, ...result });
        });
    }
};
