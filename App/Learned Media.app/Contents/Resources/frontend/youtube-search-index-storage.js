// Generated from Website/lib/youtube-search-index-storage.ts. Run node Website/scripts/build-native-video-index-storage.mjs.
(function(scope) {
  const database = {};
  (function(exports) { "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseConnection = createDatabaseConnection;
/** Reuse a connection and pending open, retiring failed or outdated handles. */
function createDatabaseConnection(name, version, upgrade) {
    let active;
    return function open() {
        if (active)
            return active.promise;
        const entry = {};
        entry.promise = new Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);
            const release = (database) => {
                if (active === entry)
                    active = undefined;
                database?.close();
            };
            request.onupgradeneeded = () => upgrade(request.result);
            request.onerror = () => {
                release();
                reject(request.error ?? new Error(`Could not open ${name}.`));
            };
            request.onblocked = () => {
                release();
                reject(new Error(`Another tab is blocking the ${name} database upgrade.`));
            };
            request.onsuccess = () => {
                const database = request.result;
                // A blocked open can complete after its caller has already retried.
                if (active !== entry) {
                    database.close();
                    return;
                }
                database.onversionchange = () => release(database);
                database.onclose = () => release();
                database.onerror = () => release(database);
                resolve(database);
            };
        });
        active = entry;
        // Synchronous open failures must not leave a rejected promise cached.
        void entry.promise.catch(() => { if (active === entry)
            active = undefined; });
        return entry.promise;
    };
}
 })(database);
  const require = name => name.includes("indexed-db") ? database : name.includes("background-work") ? scope.LEARNED_MEDIA_BACKGROUND : scope.LEARNED_MEDIA_VIDEO_SEARCH;
  const exports = {};
  "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVideoSearchIndexStore = createVideoSearchIndexStore;
exports.createVideoSearchIndexPersistence = createVideoSearchIndexPersistence;
exports.createVideoSearchIndexLoader = createVideoSearchIndexLoader;
const indexed_db_1 = require("./indexed-db");
const video_semantic_1 = require("./video-semantic");
const background_work_1 = require("./background-work");
// Disposable derived data lives outside every workspace, credential and import
// database. Its single atomic record can be removed without losing user data.
const openIndexDatabase = (0, indexed_db_1.createDatabaseConnection)("learned-media-video-search-index", 1, database => {
    if (!database.objectStoreNames.contains("index"))
        database.createObjectStore("index");
});
const MAX_INDEX_BYTES = 64 * 1024 * 1024;
function createVideoSearchIndexStore(open = openIndexDatabase) {
    const transact = (write, value) => new Promise((resolve, reject) => {
        let expired = false;
        let transaction;
        const timer = setTimeout(() => {
            expired = true;
            try {
                transaction?.abort();
            }
            catch { /* Already completed. */ }
            reject(new Error("Search index storage timed out."));
        }, 1500);
        const fail = (error) => { clearTimeout(timer); reject(error); };
        void open().then(database => {
            // A blocked open may complete after its wait timed out. Never write late.
            if (expired)
                return;
            transaction = database.transaction("index", write ? "readwrite" : "readonly");
            const store = transaction.objectStore("index");
            const request = write ? store.put(value, "current") : store.get("current");
            transaction.oncomplete = () => { clearTimeout(timer); resolve(write ? undefined : request.result); };
            transaction.onerror = transaction.onabort = () => fail(transaction?.error ?? new Error("Search index storage failed."));
        }).catch(fail);
    });
    return { read: () => transact(false), write: async (value) => { await transact(true, value); } };
}
/** One latest snapshot; saves are coalesced and never delay catalog publication. */
function createVideoSearchIndexPersistence(store) {
    const enabled = Boolean(store || typeof indexedDB !== "undefined" && globalThis.crypto?.subtle);
    const storage = store ?? createVideoSearchIndexStore();
    let timer;
    let generation = 0;
    let saving = false;
    let pending;
    let controller;
    const fingerprints = new WeakMap();
    const fingerprint = async (videos, signal) => {
        const known = fingerprints.get(videos);
        if (known)
            return known;
        const result = await (0, video_semantic_1.videoSearchCatalogFingerprint)(videos, signal);
        fingerprints.set(videos, result);
        return result;
    };
    const drain = async () => {
        if (saving || !pending)
            return;
        saving = true;
        const videos = pending, identity = generation;
        pending = undefined;
        const active = new AbortController();
        controller = active;
        try {
            const value = await (0, video_semantic_1.serializeVideoSearchIndex)(videos, await fingerprint(videos, active.signal), active.signal);
            if (identity !== generation || active.signal.aborted)
                return;
            // Derived strings dominate this cache; use a conservative UTF-16 bound
            // without allocating another full serialized catalog to measure it.
            let bytes = 1024;
            await (0, background_work_1.forEachBackground)(value.records, record => {
                bytes += 128 + (record.id.length + record.normalizedChannelName.length) * 2;
                for (const field of record.fields)
                    bytes += 96 + (field.name.length + field.text.length) * 2;
                if (bytes > MAX_INDEX_BYTES)
                    return false;
            }, active.signal);
            if (bytes > MAX_INDEX_BYTES || identity !== generation || active.signal.aborted)
                return;
            await storage.write(value);
        }
        catch { /* This cache is optional; never acknowledge or alter a workspace save. */ }
        finally {
            if (controller === active)
                controller = undefined;
            saving = false;
            if (pending && timer === undefined)
                timer = setTimeout(() => { timer = undefined; void drain(); }, 250);
        }
    };
    return {
        enabled,
        async restore(videos) {
            if (!enabled)
                return undefined;
            try {
                const cached = await storage.read();
                if (!cached || typeof cached !== "object" || !("format" in cached) || cached.format !== video_semantic_1.VIDEO_SEARCH_INDEX_FORMAT
                    || !("policy" in cached) || cached.policy !== video_semantic_1.VIDEO_SEMANTIC_VERSION)
                    return undefined;
                return await (0, video_semantic_1.restoreVideoSearchIndex)(videos, cached, await fingerprint(videos));
            }
            catch {
                return undefined;
            }
        },
        save(videos) {
            if (!enabled)
                return;
            generation += 1;
            controller?.abort();
            pending = videos;
            if (timer !== undefined)
                clearTimeout(timer);
            timer = setTimeout(() => { timer = undefined; void drain(); }, 1000);
        },
    };
}
/** The workerless path shares the same disposable index, with caller cancellation
 * independent of the shared preparation. Only a changed catalog replaces it. */
function createVideoSearchIndexLoader(persistence = createVideoSearchIndexPersistence()) {
    let source;
    let pending;
    let current;
    let controller;
    return {
        load(videos) {
            if (source === videos && pending)
                return pending;
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
                    await (0, background_work_1.forEachBackground)(originals, video => {
                        const known = previous?.get(video.id);
                        restored.set(video.id, (0, video_semantic_1.indexVideoSearchMetadata)(video, known));
                    }, active.signal);
                }
                if (active.signal.aborted)
                    throw active.signal.reason;
                current = restored;
                const indexed = Array.from(restored.values());
                if (!fromStorage)
                    persistence.save(indexed);
                return indexed;
            })();
            pending = result;
            void result.catch(() => { if (pending === result) {
                pending = undefined;
                source = undefined;
            } });
            return result;
        },
    };
}

  scope.LEARNED_MEDIA_VIDEO_INDEX_STORAGE = exports;
})(globalThis);
