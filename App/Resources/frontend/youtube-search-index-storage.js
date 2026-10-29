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
  const pressure = {};
  (function(exports) { const require = name => name.includes("indexed-db") ? database : scope.LEARNED_MEDIA_BACKGROUND; "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareForStorageWrite = exports.INDEX_WRITE_PAUSED_KEY = exports.DISPOSABLE_INDEX_DATABASE = exports.LARGE_STORAGE_WRITE_BYTES = void 0;
exports.approximateStoredBytes = approximateStoredBytes;
exports.reclaimDerivedSearchIndex = reclaimDerivedSearchIndex;
exports.createStoragePressureGuard = createStoragePressureGuard;
const indexed_db_1 = require("./indexed-db");
const background_work_1 = require("./background-work");
exports.LARGE_STORAGE_WRITE_BYTES = 4 * 1024 * 1024;
const STORAGE_RESERVE_BYTES = 8 * 1024 * 1024;
exports.DISPOSABLE_INDEX_DATABASE = "learned-media-video-search-index";
exports.INDEX_WRITE_PAUSED_KEY = "pressure-until";
const INDEX_WRITE_PAUSE_MS = 60_000;
const openDisposableIndex = (0, indexed_db_1.createDatabaseConnection)(exports.DISPOSABLE_INDEX_DATABASE, 1, database => {
    if (!database.objectStoreNames.contains("index"))
        database.createObjectStore("index");
});
/** A conservative structured-clone estimate, without another serialized copy.
 * Process large collections in scheduler slices; never retain the input. */
async function approximateStoredBytes(value, cancellation) {
    let bytes = 0;
    const seen = new WeakSet();
    function* values() {
        const pending = [[value][Symbol.iterator]()];
        while (pending.length) {
            const next = pending[pending.length - 1].next();
            if (next.done) {
                pending.pop();
                continue;
            }
            const item = next.value;
            yield item;
            if (!item || typeof item !== "object" || seen.has(item))
                continue;
            seen.add(item);
            if (Array.isArray(item))
                pending.push(item[Symbol.iterator]());
            else
                pending.push((function* () {
                    for (const key of Object.keys(item)) {
                        yield key;
                        yield item[key];
                    }
                })());
        }
    }
    await (0, background_work_1.forEachBackground)(values(), item => {
        bytes += typeof item === "string" ? item.length * 2 + 16 : 16;
    }, cancellation, { priority: "visible", canPause: false });
    return bytes;
}
/** This exact derived-data store is the entire deletion allowlist. In particular,
 * no workspace, video record, checkpoint, activity or credential store is opened. */
function reclaimDerivedSearchIndex() {
    return new Promise((resolve, reject) => {
        let expired = false, transaction;
        const timer = setTimeout(() => {
            expired = true;
            try {
                transaction?.abort();
            }
            catch { /* Already settled. */ }
            reject(new Error("Disposable storage cleanup timed out."));
        }, 1500);
        const fail = (error) => { clearTimeout(timer); reject(error); };
        void openDisposableIndex().then(database => {
            if (expired)
                return; // Never reclaim after the save has continued.
            transaction = database.transaction("index", "readwrite");
            const store = transaction.objectStore("index");
            store.delete("current");
            // Checked by all tabs/workers in the same transaction as their cache put.
            store.put(Date.now() + INDEX_WRITE_PAUSE_MS, exports.INDEX_WRITE_PAUSED_KEY);
            transaction.oncomplete = () => { clearTimeout(timer); resolve(); };
            transaction.onerror = transaction.onabort = () => fail(transaction?.error ?? new Error("Disposable storage cleanup failed."));
        }).catch(fail);
    });
}
const browserEstimate = () => globalThis.navigator?.storage?.estimate?.() ?? Promise.resolve(undefined);
/** Quota estimates are advisory. Cleanup failures never acknowledge, suppress or
 * replace the authoritative write and its existing recovery/error handling. */
function createStoragePressureGuard(estimate = browserEstimate, reclaim = reclaimDerivedSearchIndex) {
    let active;
    return async (value, options = {}) => {
        (0, background_work_1.checkBackgroundCancellation)(options.cancellation);
        // Missing estimates (including native WebKit) keep the ordinary write path.
        if (estimate === browserEstimate && !globalThis.navigator?.storage?.estimate)
            return;
        const bytes = options.bytes ?? await approximateStoredBytes(value, options.cancellation);
        (0, background_work_1.checkBackgroundCancellation)(options.cancellation);
        if (!Number.isFinite(bytes) || bytes < exports.LARGE_STORAGE_WRITE_BYTES)
            return;
        let available;
        let timer;
        try {
            const result = await Promise.race([estimate(), new Promise(resolve => { timer = setTimeout(() => resolve(undefined), 500); })]);
            if (!result || !Number.isFinite(result.quota) || !Number.isFinite(result.usage) || result.quota < 0 || result.usage < 0)
                return;
            available = Math.max(0, result.quota - result.usage);
        }
        catch {
            return;
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
        (0, background_work_1.checkBackgroundCancellation)(options.cancellation);
        const needed = bytes * (options.copies ?? 1) + STORAGE_RESERVE_BYTES;
        if (available >= needed)
            return;
        // Concurrent large saves share only reclamation, never their snapshots.
        active ??= Promise.resolve().then(reclaim).catch(() => { }).finally(() => { active = undefined; });
        await active;
        (0, background_work_1.checkBackgroundCancellation)(options.cancellation);
    };
}
exports.prepareForStorageWrite = createStoragePressureGuard();
 })(pressure);
  scope.LEARNED_MEDIA_STORAGE_PRESSURE = pressure;
  const require = name => name.includes("indexed-db") ? database : name.includes("storage-pressure") ? pressure : name.includes("background-work") ? scope.LEARNED_MEDIA_BACKGROUND : scope.LEARNED_MEDIA_VIDEO_SEARCH;
  const exports = {};
  "use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVideoSearchIndexStore = createVideoSearchIndexStore;
exports.createVideoSearchIndexPersistence = createVideoSearchIndexPersistence;
exports.createVideoSearchIndexLoader = createVideoSearchIndexLoader;
const indexed_db_1 = require("./indexed-db");
const video_semantic_1 = require("./video-semantic");
const background_work_1 = require("./background-work");
const storage_pressure_1 = require("./storage-pressure");
// Disposable derived data lives outside every workspace, credential and import
// database. Its single atomic record can be removed without losing user data.
const openIndexDatabase = (0, indexed_db_1.createDatabaseConnection)(storage_pressure_1.DISPOSABLE_INDEX_DATABASE, 1, database => {
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
            const request = store.get(write ? storage_pressure_1.INDEX_WRITE_PAUSED_KEY : "current");
            if (write)
                request.onsuccess = () => {
                    try {
                        const pausedUntil = request.result;
                        if (typeof pausedUntil === "number" && Number.isFinite(pausedUntil) && pausedUntil > Date.now())
                            return;
                        store.put(value, "current");
                        if (pausedUntil !== undefined)
                            store.delete(storage_pressure_1.INDEX_WRITE_PAUSED_KEY);
                    }
                    catch (error) {
                        try {
                            transaction?.abort();
                        }
                        catch { /* Already settled. */ }
                        fail(error);
                    }
                };
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
