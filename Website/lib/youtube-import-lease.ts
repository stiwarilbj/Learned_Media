// The catalog and lease share a store so ownership checks and commits are atomic.
const LEASE_KEY = "youtube-import-lease-v1";
const COMMIT_KEY = "youtube-import-commit-v1";
const NOTICE_KEY = "learned-media-youtube-import-notice-v1";
const LEASE_MS = 30_000;
const HEARTBEAT_MS = 5_000;
const POLL_MS = 2_000;
type Lease<P> = { owner: string; expiresAt: number; progress?: P };
type Commit = { id: string };
type OpenDatabase = () => Promise<IDBDatabase>;
export type ImportOwnership = { signal: AbortSignal; assertOwned: () => Promise<void>; commit: (catalog: unknown) => Promise<void> };

function canceled() { return new DOMException("YouTube import canceled.", "AbortError"); }
function lostOwnership() { return new Error("Another tab took over the YouTube import. Its saved results will be loaded automatically."); }

function transaction<T>(db: IDBDatabase, update: (store: IDBObjectStore, lease: Lease<unknown> | undefined, commit: Commit | undefined) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite");
    const store = tx.objectStore("workspace");
    const lease = store.get(LEASE_KEY), commit = store.get(COMMIT_KEY);
    let result: T, failure: unknown;
    let remaining = 2;
    const apply = () => {
      if (--remaining) return;
      try { result = update(store, lease.result, commit.result); }
      catch (error) { failure = error; tx.abort(); }
    };
    lease.onsuccess = apply; commit.onsuccess = apply;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error("Could not coordinate the YouTube import. Please retry."));
  });
}

function notify() {
  const notice = crypto.randomUUID();
  try { const channel = new BroadcastChannel(NOTICE_KEY); channel.postMessage(notice); channel.close(); } catch { /* Polling and storage events remain available. */ }
  try { localStorage.setItem(NOTICE_KEY, notice); } catch { /* IndexedDB remains authoritative. */ }
}

export function subscribeYouTubeImportChanges(listener: () => void) {
  let channel: BroadcastChannel | undefined;
  try { channel = new BroadcastChannel(NOTICE_KEY); channel.onmessage = listener; } catch { /* Storage events and polling are sufficient. */ }
  const storage = (event: StorageEvent) => { if (event.key === NOTICE_KEY) listener(); };
  window.addEventListener("storage", storage);
  return () => { channel?.close(); window.removeEventListener("storage", storage); };
}

export async function youtubeCatalogCommitId(openDatabase: OpenDatabase) {
  const db = await openDatabase();
  return new Promise<string>((resolve, reject) => {
    const request = db.transaction("workspace", "readonly").objectStore("workspace").get(COMMIT_KEY);
    request.onsuccess = () => resolve(request.result?.id ?? "");
    request.onerror = () => reject(request.error);
  });
}

function waitForChange(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let unsubscribe = () => {};
    const cleanup = () => { clearTimeout(timer); unsubscribe(); signal.removeEventListener("abort", abort); };
    const finish = () => { cleanup(); resolve(); };
    const abort = () => { cleanup(); reject(canceled()); };
    const timer = window.setTimeout(finish, POLL_MS);
    unsubscribe = subscribeYouTubeImportChanges(finish);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Returns undefined when another owner committed the result while this caller waited. */
export async function withYouTubeImportLease<P, T>(openDatabase: OpenDatabase, signal: AbortSignal,
  onProgress: (progress: P) => void, run: (ownership: ImportOwnership, progress: (value: P) => void) => Promise<T>): Promise<T | undefined> {
  if (signal.aborted) throw canceled();
  const owner = crypto.randomUUID();
  let baseline: string | undefined;
  while (true) {
    if (signal.aborted) throw canceled();
    const db = await openDatabase();
    const decision = await transaction(db, (store, lease, commit) => {
      if (signal.aborted) throw canceled();
      baseline ??= commit?.id ?? "";
      if ((commit?.id ?? "") !== baseline) return { kind: "committed" as const };
      if (lease && lease.expiresAt > Date.now()) return { kind: "waiting" as const, progress: lease.progress as P | undefined };
      store.put({ owner, expiresAt: Date.now() + LEASE_MS }, LEASE_KEY);
      return { kind: "owned" as const };
    });
    if (decision.kind === "committed") return undefined;
    if (decision.kind === "owned") break;
    if (decision.progress !== undefined) onProgress(decision.progress);
    await waitForChange(signal);
  }

  const controller = new AbortController();
  let progress: P | undefined;
  let failure: unknown;
  let stopped = false;
  let renewal: Promise<void> | undefined;
  const abort = () => controller.abort();
  const pagehide = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  window.addEventListener("pagehide", pagehide);
  if (signal.aborted) abort();
  const check = async (renew: boolean, catalog?: { value: unknown }) => {
    if (controller.signal.aborted) throw failure ?? canceled();
    const db = await openDatabase();
    await transaction(db, (store, lease) => {
      if (controller.signal.aborted) throw failure ?? canceled();
      if (lease?.owner !== owner || lease.expiresAt <= Date.now()) throw lostOwnership();
      if (renew) store.put({ owner, expiresAt: Date.now() + LEASE_MS, progress }, LEASE_KEY);
      if (catalog) {
        store.put(catalog.value, "catalog");
        store.put({ id: crypto.randomUUID() }, COMMIT_KEY);
      }
    });
  };
  const renew = () => {
    if (stopped || renewal) return;
    renewal = check(true).catch(error => { failure = error; controller.abort(); }).finally(() => { renewal = undefined; });
  };
  const timer = window.setInterval(renew, HEARTBEAT_MS);
  try {
    return await run({
      signal: controller.signal,
      assertOwned: () => check(false).catch(error => { failure = error; controller.abort(); throw error; }),
      commit: async catalog => { await check(false, { value: catalog }); notify(); }
    }, value => { progress = value; onProgress(value); });
  } catch (error) {
    throw failure ?? error;
  } finally {
    stopped = true;
    clearInterval(timer);
    controller.abort();
    signal.removeEventListener("abort", abort);
    window.removeEventListener("pagehide", pagehide);
    // Pending renewals must finish before release; a stale owner can never delete a successor.
    await renewal;
    try {
      const db = await openDatabase();
      await transaction(db, (store, lease) => { if (lease?.owner === owner) store.delete(LEASE_KEY); });
      notify();
    } catch { /* A closed tab or unavailable database is recovered by lease expiry. */ }
  }
}
