importScripts('topic-semantic.js');
let index = null, revision = '', latest = 0;
self.onmessage = function (event) { const r = event.data; if (r.type === 'initialize') {
    revision = r.revision;
    index = LEARNED_MEDIA_TOPIC_SEARCH.createTopicSuggestionIndex(r.topics);
    latest = 0;
    self.postMessage({ type: 'ready', revision });
}
else if (r.type === 'cancel')
    latest = r.id;
else if (index && r.revision === revision) {
    latest = r.id;
    LEARNED_MEDIA_TOPIC_SEARCH.searchTopicIndexYielding(index, r.query, r.plan || [], () => latest === r.id && revision === r.revision).then(result => { if (result)
        self.postMessage({ type: 'results', id: r.id, key: r.key, query: r.query, revision, ...result }); });
} };
