// Common browser/native wire format. No account tokens, API keys or imported video catalog.
export type CloudRecord = { id: string; name: string; createdAt: string; updatedAt: string; state: Record<string, any> };
const secretFields = new Set(['key', 'apiKey', 'youtubeKey', 'geminiKey', 'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token']);
function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretFields.has(key)).map(([key, item]) => [key, clean(item)]));
}
export function canonicalRecord(record: CloudRecord): CloudRecord {
  const state = record.state || {};
  const activity = state.youtubeActivity || {};
  return clean({ id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt, state: {
    persistenceVersion: 2, topicCatalogVersion: state.topicCatalogVersion ?? state.catalogVersion ?? 0,
    savedAt: state.savedAt, topics: state.topics || [], settings: state.settings || {}, cards: state.cards || [],
    learningProfile: state.learningProfile || state.profile || {}, feedStarted: state.feedStarted ?? state.started ?? false,
    theme: state.theme || 'light', youtubeActivity: { ...activity, selectedTopic: activity.selectedTopic ?? activity.topic ?? 'All', activeTab: activity.activeTab ?? activity.tab ?? 'discover', channelOrder: activity.channelOrder ?? activity.order ?? 'newest' }
  }});
}
export function nativeRecord(record: CloudRecord): CloudRecord {
  const canonical = canonicalRecord(record), state = canonical.state, activity = state.youtubeActivity || {};
  return { ...canonical, state: { ...state, catalogVersion: state.topicCatalogVersion, profile: state.learningProfile, started: state.feedStarted, youtubeActivity: { ...activity, topic: activity.selectedTopic, tab: activity.activeTab, order: activity.channelOrder } } };
}
export function mergeRecords(local: CloudRecord[], remote: CloudRecord[]) {
  const records = new Map(local.map(record => [record.id, canonicalRecord(record)]));
  for (const incoming of remote) {
    const old = records.get(incoming.id);
    if (!old || incoming.updatedAt > old.updatedAt) records.set(incoming.id, canonicalRecord(incoming));
  }
  return Array.from(records.values());
}
export function safeMemory(item: any) {
  return clean({ id: item.id, title: item.title, hook: item.hook, body: item.body, claim: item.claim, topicPath: item.topicPath || [], sourceUrls: item.sourceUrls || [], evidence: item.evidence || [], known: Boolean(item.known) });
}
