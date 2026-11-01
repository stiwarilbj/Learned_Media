import { createDatabaseConnection } from './indexed-db';

const DATABASE_NAME = 'learned-media-cloud-sync';
const DATABASE_VERSION = 1;
const STORE_NAME = 'leases';
const LEASE_MS = 30_000;
const HEARTBEAT_MS = 5_000;
const WAIT_MIN_MS = 250;
const WAIT_JITTER_MS = 250;

type LeaseKind = 'restore' | 'upload';
type CloudLease = { version: 1; owner: string; expiresAt: number };

const openDatabase = createDatabaseConnection(DATABASE_NAME, DATABASE_VERSION, database => {
  if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
});

function canceled() { return new DOMException('Cloud sync was canceled.', 'AbortError'); }
function leaseLost() { return new Error('Cloud sync ownership changed in another tab. Retry the sync to continue safely.'); }

function transaction<T>(database: IDBDatabase, signal: AbortSignal | undefined,
  update: (store: IDBObjectStore, resolve: (value: T) => void, abort: (error: unknown) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = database.transaction(STORE_NAME, 'readwrite'); }
    catch (error) { reject(error); return; }
    let value!: T;
    let failure: unknown;
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      failure = canceled();
      try { tx.abort(); } catch { /* The transaction may already be completing. */ }
    };
    const abort = (error: unknown) => {
      failure ??= error;
      try { tx.abort(); } catch { /* The transaction may already be completing. */ }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (signal?.aborted) reject(canceled());
      else resolve(value);
    };
    tx.onerror = tx.onabort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(failure ?? tx.error ?? new Error('Cloud sync lease storage failed.'));
    };
    if (signal?.aborted) { onAbort(); return; }
    try {
      update(tx.objectStore(STORE_NAME), next => { value = next; }, abort);
    } catch (error) { abort(error); }
  });
}

function validLease(value: unknown): value is CloudLease {
  const lease = value as CloudLease | undefined;
  return !!lease && lease.version === 1 && typeof lease.owner === 'string' && !!lease.owner
    && typeof lease.expiresAt === 'number' && Number.isFinite(lease.expiresAt);
}

function claim(database: IDBDatabase, key: string, owner: string, signal: AbortSignal) {
  return transaction<boolean>(database, signal, (store, resolve, abort) => {
    const request = store.get(key);
    request.onerror = () => abort(request.error ?? new Error('Could not read the cloud sync lease.'));
    request.onsuccess = () => {
      if (signal.aborted) { abort(canceled()); return; }
      const current = request.result;
      if (validLease(current) && current.expiresAt > Date.now()) { resolve(false); return; }
      store.put({ version: 1, owner, expiresAt: Date.now() + LEASE_MS } satisfies CloudLease, key);
      resolve(true);
    };
  });
}

function renew(database: IDBDatabase, key: string, owner: string) {
  return transaction<boolean>(database, undefined, (store, resolve, abort) => {
    const request = store.get(key);
    request.onerror = () => abort(request.error ?? new Error('Could not renew the cloud sync lease.'));
    request.onsuccess = () => {
      const current = request.result;
      if (!validLease(current) || current.owner !== owner) { resolve(false); return; }
      store.put({ version: 1, owner, expiresAt: Date.now() + LEASE_MS } satisfies CloudLease, key);
      resolve(true);
    };
  });
}

function release(database: IDBDatabase, key: string, owner: string) {
  return transaction<void>(database, undefined, (store, resolve, abort) => {
    const request = store.get(key);
    request.onerror = () => abort(request.error ?? new Error('Could not release the cloud sync lease.'));
    request.onsuccess = () => {
      const current = request.result;
      if (validLease(current) && current.owner === owner) store.delete(key);
      resolve(undefined);
    };
  });
}

function waitForLease(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', abort);
    };
    const done = () => { cleanup(); resolve(); };
    const abort = () => { cleanup(); reject(canceled()); };
    timer = setTimeout(done, WAIT_MIN_MS + Math.floor(Math.random() * WAIT_JITTER_MS));
    signal.addEventListener('abort', abort, { once: true });
    if (typeof window !== 'undefined') window.addEventListener('pagehide', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Coordinate one restore or upload pass per account across same-origin tabs. */
export async function withCloudSyncLease<T>(userId: string, kind: LeaseKind, signal: AbortSignal,
  work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (signal.aborted) throw canceled();
  let database: IDBDatabase;
  try { database = await openDatabase(); }
  catch {
    if (signal.aborted) throw canceled();
    // IndexedDB can be unavailable in restricted browser modes. Existing cloud
    // revision guards remain in force, so sync can still proceed without a lease.
    return work(signal);
  }

  const key = `${kind}:${userId}`;
  const owner = crypto.randomUUID();
  let acquired = false;
  while (!acquired) {
    if (signal.aborted) throw canceled();
    try { acquired = await claim(database, key, owner, signal); }
    catch {
      if (signal.aborted) throw canceled();
      // A failing local coordination store must not make cloud data unavailable.
      return work(signal);
    }
    if (!acquired) await waitForLease(signal);
  }

  const controller = new AbortController();
  const callerAbort = () => controller.abort();
  const pageHide = () => controller.abort();
  signal.addEventListener('abort', callerAbort, { once: true });
  if (typeof window !== 'undefined') window.addEventListener('pagehide', pageHide, { once: true });
  if (signal.aborted) controller.abort();
  let failure: unknown;
  let renewal: Promise<void> | undefined;
  const heartbeat = setInterval(() => {
    if (controller.signal.aborted || renewal) return;
    renewal = renew(database, key, owner).then(owned => {
      if (!owned) throw leaseLost();
    }).catch(error => {
      failure = error instanceof Error ? error : leaseLost();
      controller.abort();
    }).finally(() => { renewal = undefined; });
  }, HEARTBEAT_MS);

  try {
    const result = await work(controller.signal);
    if (renewal) await renewal;
    if (failure) throw failure;
    if (signal.aborted || controller.signal.aborted) throw canceled();
    if (!await renew(database, key, owner)) throw leaseLost();
    return result;
  } finally {
    clearInterval(heartbeat);
    signal.removeEventListener('abort', callerAbort);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', pageHide);
    if (renewal) await renewal;
    await release(database, key, owner).catch(() => undefined);
  }
}
