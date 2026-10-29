import { createDatabaseConnection } from "./indexed-db";
import { checkBackgroundCancellation, forEachBackground, type BackgroundCancellation } from "./background-work";

export const LARGE_STORAGE_WRITE_BYTES = 4 * 1024 * 1024;
const STORAGE_RESERVE_BYTES = 8 * 1024 * 1024;
export const DISPOSABLE_INDEX_DATABASE = "learned-media-video-search-index";
export const INDEX_WRITE_PAUSED_KEY = "pressure-until";
const INDEX_WRITE_PAUSE_MS = 60_000;

const openDisposableIndex = createDatabaseConnection(DISPOSABLE_INDEX_DATABASE, 1, database => {
  if (!database.objectStoreNames.contains("index")) database.createObjectStore("index");
});

/** A conservative structured-clone estimate, without another serialized copy.
 * Process large collections in scheduler slices; never retain the input. */
export async function approximateStoredBytes(value: unknown, cancellation?: BackgroundCancellation) {
  let bytes = 0;
  const seen = new WeakSet<object>();
  function* values(): Generator<unknown> {
    const pending: Iterator<unknown>[] = [[value][Symbol.iterator]()];
    while (pending.length) {
      const next = pending[pending.length - 1].next();
      if (next.done) { pending.pop(); continue; }
      const item = next.value;
      yield item;
      if (!item || typeof item !== "object" || seen.has(item)) continue;
      seen.add(item);
      if (Array.isArray(item)) pending.push(item[Symbol.iterator]());
      else pending.push((function* () {
        for (const key of Object.keys(item)) { yield key; yield (item as Record<string, unknown>)[key]; }
      })());
    }
  }
  await forEachBackground(values(), item => {
    bytes += typeof item === "string" ? item.length * 2 + 16 : 16;
  }, cancellation, { priority: "visible", canPause: false });
  return bytes;
}

/** This exact derived-data store is the entire deletion allowlist. In particular,
 * no workspace, video record, checkpoint, activity or credential store is opened. */
export function reclaimDerivedSearchIndex() {
  return new Promise<void>((resolve, reject) => {
    let expired = false, transaction: IDBTransaction | undefined;
    const timer = setTimeout(() => {
      expired = true;
      try { transaction?.abort(); } catch { /* Already settled. */ }
      reject(new Error("Disposable storage cleanup timed out."));
    }, 1500);
    const fail = (error: unknown) => { clearTimeout(timer); reject(error); };
    void openDisposableIndex().then(database => {
      if (expired) return; // Never reclaim after the save has continued.
      transaction = database.transaction("index", "readwrite");
      const store = transaction.objectStore("index");
      store.delete("current");
      // Checked by all tabs/workers in the same transaction as their cache put.
      store.put(Date.now() + INDEX_WRITE_PAUSE_MS, INDEX_WRITE_PAUSED_KEY);
      transaction.oncomplete = () => { clearTimeout(timer); resolve(); };
      transaction.onerror = transaction.onabort = () => fail(transaction?.error ?? new Error("Disposable storage cleanup failed."));
    }).catch(fail);
  });
}

type Estimate = { quota?: number; usage?: number };
type WriteOptions = { copies?: number; cancellation?: BackgroundCancellation; bytes?: number };
const browserEstimate = () => globalThis.navigator?.storage?.estimate?.() ?? Promise.resolve(undefined);

/** Quota estimates are advisory. Cleanup failures never acknowledge, suppress or
 * replace the authoritative write and its existing recovery/error handling. */
export function createStoragePressureGuard(
  estimate: () => Promise<Estimate | undefined> = browserEstimate,
  reclaim: () => Promise<void> = reclaimDerivedSearchIndex,
) {
  let active: Promise<void> | undefined;
  return async (value: unknown, options: WriteOptions = {}) => {
    checkBackgroundCancellation(options.cancellation);
    // Missing estimates (including native WebKit) keep the ordinary write path.
    if (estimate === browserEstimate && !globalThis.navigator?.storage?.estimate) return;
    const bytes = options.bytes ?? await approximateStoredBytes(value, options.cancellation);
    checkBackgroundCancellation(options.cancellation);
    if (!Number.isFinite(bytes) || bytes < LARGE_STORAGE_WRITE_BYTES) return;
    let available: number;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([estimate(), new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), 500); })]);
      if (!result || !Number.isFinite(result.quota) || !Number.isFinite(result.usage) || result.quota! < 0 || result.usage! < 0) return;
      available = Math.max(0, result.quota! - result.usage!);
    } catch { return; }
    finally { if (timer !== undefined) clearTimeout(timer); }
    checkBackgroundCancellation(options.cancellation);
    const needed = bytes * (options.copies ?? 1) + STORAGE_RESERVE_BYTES;
    if (available >= needed) return;
    // Concurrent large saves share only reclamation, never their snapshots.
    active ??= Promise.resolve().then(reclaim).catch(() => {}).finally(() => { active = undefined; });
    await active;
    checkBackgroundCancellation(options.cancellation);
  };
}

export const prepareForStorageWrite = createStoragePressureGuard();
