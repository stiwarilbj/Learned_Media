import { createDatabaseConnection } from "./indexed-db";
import { VIDEO_SEARCH_INDEX_FORMAT, VIDEO_SEMANTIC_VERSION, indexVideoSearchMetadata, restoreVideoSearchIndex, serializeVideoSearchIndex, videoSearchCatalogFingerprint, type IndexedVideoSearchMetadata } from "./video-semantic";
import { forEachBackground } from "./background-work";
import type { SearchableVideoMetadata } from "./video-metadata";

// Disposable derived data lives outside every workspace, credential and import
// database. Its single atomic record can be removed without losing user data.
const openIndexDatabase = createDatabaseConnection("learned-media-video-search-index", 1, database => {
  if (!database.objectStoreNames.contains("index")) database.createObjectStore("index");
});
const MAX_INDEX_BYTES = 64 * 1024 * 1024;

export type VideoSearchIndexStore = {
  read: () => Promise<unknown>;
  write: (value: unknown) => Promise<void>;
};

export function createVideoSearchIndexStore(open = openIndexDatabase): VideoSearchIndexStore {
  const transact = (write: boolean, value?: unknown) => new Promise<unknown>((resolve, reject) => {
    let expired = false;
    let transaction: IDBTransaction | undefined;
    const timer = setTimeout(() => {
      expired = true;
      try { transaction?.abort(); } catch { /* Already completed. */ }
      reject(new Error("Search index storage timed out."));
    }, 1500);
    const fail = (error: unknown) => { clearTimeout(timer); reject(error); };
    void open().then(database => {
      // A blocked open may complete after its wait timed out. Never write late.
      if (expired) return;
      transaction = database.transaction("index", write ? "readwrite" : "readonly");
      const store = transaction.objectStore("index");
      const request = write ? store.put(value, "current") : store.get("current");
      transaction.oncomplete = () => { clearTimeout(timer); resolve(write ? undefined : request.result); };
      transaction.onerror = transaction.onabort = () => fail(transaction?.error ?? new Error("Search index storage failed."));
    }).catch(fail);
  });
  return { read: () => transact(false), write: async value => { await transact(true, value); } };
}

/** One latest snapshot; saves are coalesced and never delay catalog publication. */
export function createVideoSearchIndexPersistence(store?: VideoSearchIndexStore) {
  const enabled = Boolean(store || typeof indexedDB !== "undefined" && globalThis.crypto?.subtle);
  const storage = store ?? createVideoSearchIndexStore();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let saving = false;
  let pending: readonly IndexedVideoSearchMetadata[] | undefined;
  let controller: AbortController | undefined;
  const fingerprints = new WeakMap<readonly SearchableVideoMetadata[], string>();
  const fingerprint = async (videos: readonly SearchableVideoMetadata[], signal?: AbortSignal) => {
    const known = fingerprints.get(videos);
    if (known) return known;
    const result = await videoSearchCatalogFingerprint(videos, signal);
    fingerprints.set(videos, result);
    return result;
  };

  const drain = async () => {
    if (saving || !pending) return;
    saving = true;
    const videos = pending, identity = generation;
    pending = undefined;
    const active = new AbortController();
    controller = active;
    try {
      const value = await serializeVideoSearchIndex(videos, await fingerprint(videos, active.signal), active.signal);
      if (identity !== generation || active.signal.aborted) return;
      // Derived strings dominate this cache; use a conservative UTF-16 bound
      // without allocating another full serialized catalog to measure it.
      let bytes = 1024;
      await forEachBackground(value.records, record => {
        bytes += 128 + (record.id.length + record.normalizedChannelName.length) * 2;
        for (const field of record.fields) bytes += 96 + (field.name.length + field.text.length) * 2;
        if (bytes > MAX_INDEX_BYTES) return false;
      }, active.signal);
      if (bytes > MAX_INDEX_BYTES || identity !== generation || active.signal.aborted) return;
      await storage.write(value);
    } catch { /* This cache is optional; never acknowledge or alter a workspace save. */ }
    finally {
      if (controller === active) controller = undefined;
      saving = false;
      if (pending && timer === undefined) timer = setTimeout(() => { timer = undefined; void drain(); }, 250);
    }
  };

  return {
    enabled,
    async restore(videos: readonly SearchableVideoMetadata[]) {
      if (!enabled) return undefined;
      try {
        const cached = await storage.read();
        if (!cached || typeof cached !== "object" || !("format" in cached) || cached.format !== VIDEO_SEARCH_INDEX_FORMAT
          || !("policy" in cached) || cached.policy !== VIDEO_SEMANTIC_VERSION) return undefined;
        return await restoreVideoSearchIndex(videos, cached, await fingerprint(videos));
      } catch { return undefined; }
    },
    save(videos: readonly IndexedVideoSearchMetadata[]) {
      if (!enabled) return;
      generation += 1;
      controller?.abort();
      pending = videos;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; void drain(); }, 1000);
    },
  };
}

/** The workerless path shares the same disposable index, with caller cancellation
 * independent of the shared preparation. Only a changed catalog replaces it. */
export function createVideoSearchIndexLoader(persistence = createVideoSearchIndexPersistence()) {
  let source: readonly SearchableVideoMetadata[] | undefined;
  let pending: Promise<IndexedVideoSearchMetadata[]> | undefined;
  let current: Map<string, IndexedVideoSearchMetadata> | undefined;
  let controller: AbortController | undefined;
  return {
    load(videos: readonly SearchableVideoMetadata[]) {
      if (source === videos && pending) return pending;
      source = videos;
      controller?.abort();
      const active = new AbortController();
      controller = active;
      const previous = current;
      const result = (async () => {
        // Last duplicate wins without changing the first occurrence's position.
        const originals = Array.from(new Map(videos.map(video => [video.id, video])).values());
        let restored = previous ? undefined : await persistence.restore(originals);
        const fromStorage = Boolean(restored);
        if (!restored) {
          restored = new Map();
          await forEachBackground(originals, video => {
            const known = previous?.get(video.id);
            restored!.set(video.id, indexVideoSearchMetadata(video, known));
          }, active.signal);
        }
        if (active.signal.aborted) throw active.signal.reason;
        current = restored;
        const indexed = Array.from(restored.values());
        if (!fromStorage) persistence.save(indexed);
        return indexed;
      })();
      pending = result;
      void result.catch(() => { if (pending === result) { pending = undefined; source = undefined; } });
      return result;
    },
  };
}
