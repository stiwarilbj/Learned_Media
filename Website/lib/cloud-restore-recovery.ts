import { createDatabaseConnection } from './indexed-db';
import { validateSnapshot } from './snapshot-validation';
import type { CloudRecord } from './cloud-records';

// A disposable, account-scoped merge journal. Cursor and validated records commit
// in the same transaction; a cursor alone must never let recovery skip data.
export type RestoreCheckpoint = {
  version: 1; ownerId: string; source: string; token: string;
  through: string; after: string | null; complete: boolean; count: number;
};
export type RestoreRow = { id: string; revision: string; record?: CloudRecord };
export type RestoreProgress = { checkpoint: RestoreCheckpoint; rows: RestoreRow[] };
export interface CloudRestoreRecovery {
  read(ownerId: string, source: string, signal: AbortSignal): Promise<RestoreProgress | undefined>;
  begin(ownerId: string, source: string, through: string, signal: AbortSignal): Promise<RestoreCheckpoint | undefined>;
  commit(previous: RestoreCheckpoint, rows: RestoreRow[], after: string | null, complete: boolean, signal: AbortSignal): Promise<RestoreCheckpoint | undefined>;
  discard(ownerId?: string, token?: string): Promise<void>;
}
const openDatabase = createDatabaseConnection('learned-media-cloud-restore', 1, db => db.createObjectStore('recovery'));
const check = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error('Cloud load was canceled.'); };
export function validRestoreCheckpoint(value: unknown, ownerId: string, source: string): value is RestoreCheckpoint {
  const item = value as RestoreCheckpoint | undefined;
  return !!item && item.version === 1 && item.ownerId === ownerId && item.source === source
    && typeof item.token === 'string' && !!item.token && typeof item.through === 'string' && !!item.through
    && (item.after === null || typeof item.after === 'string' && !!item.after && item.after <= item.through)
    && typeof item.complete === 'boolean' && Number.isSafeInteger(item.count) && item.count >= 0;
}
export function validRestoreRows(rows: RestoreRow[], checkpoint: RestoreCheckpoint) {
  let previous: string | undefined;
  return rows.every(row => {
    if (!row || typeof row.id !== 'string' || !row.id || previous !== undefined && row.id <= previous
      || checkpoint.after === null || row.id > checkpoint.after || typeof row.revision !== 'string' || !row.revision
      || row.record !== undefined && (!validateSnapshot(row.record, 'record', 'import') || row.record.id !== row.id)) return false;
    previous = row.id;
    return true;
  });
}
export function createCloudRestoreRecovery(open = openDatabase): CloudRestoreRecovery {
  async function transaction<T>(signal: AbortSignal | undefined, work: (store: IDBObjectStore, result: (value: T) => void, guard: (callback: () => void) => () => void) => void): Promise<T | undefined> {
    check(signal);
    // Unavailable/quota-failing recovery storage must not prevent a full restore.
    let database: IDBDatabase;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelOpen: (() => void) | undefined;
    try {
      const available = await Promise.race([open(), new Promise<undefined>(resolve => {
        cancelOpen = () => resolve(undefined);
        timer = setTimeout(cancelOpen, 1500);
        signal?.addEventListener('abort', cancelOpen, { once: true });
      })]);
      check(signal);
      if (!available) return;
      database = available;
    } catch { check(signal); return; }
    finally {
      if (timer !== undefined) clearTimeout(timer);
      if (cancelOpen) signal?.removeEventListener('abort', cancelOpen);
    }
    check(signal);
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = database.transaction('recovery', 'readwrite'); } catch { resolve(undefined); return; }
      let value: T | undefined;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true; cleanup();
        try { check(signal); resolve(value); } catch (error) { reject(error); }
      };
      const abort = () => {
        value = undefined;
        try { tx.abort(); } catch { /* Already finished. */ }
        finish();
      };
      signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 1500);
      const cleanup = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); };
      tx.oncomplete = finish;
      tx.onerror = tx.onabort = () => { value = undefined; finish(); };
      const guard = (callback: () => void) => () => {
        if (settled) return;
        try { callback(); } catch { abort(); }
      };
      try { work(tx.objectStore('recovery'), next => { value = next; }, guard); }
      catch { abort(); }
    });
  }
  return {
    async read(ownerId, source, signal) {
      return transaction<RestoreProgress>(signal, (store, done, guard) => {
        const header = store.get('checkpoint');
        header.onsuccess = guard(() => {
          const checkpoint = header.result;
          if (!validRestoreCheckpoint(checkpoint, ownerId, source)) { store.clear(); return; }
          const rows: RestoreRow[] = [];
          const cursor = store.openCursor(IDBKeyRange.bound('row:', 'row;', false, true));
          cursor.onsuccess = guard(() => {
            const item = cursor.result;
            if (item) { rows.push(item.value); item.continue(); return; }
            if (rows.length === checkpoint.count && validRestoreRows(rows, checkpoint)) done({ checkpoint, rows });
            else store.clear();
          });
        });
      });
    },
    async begin(ownerId, source, through, signal) {
      const checkpoint: RestoreCheckpoint = { version: 1, ownerId, source, through, after: null, complete: false, count: 0, token: crypto.randomUUID() };
      return transaction<RestoreCheckpoint>(signal, (store, done, guard) => {
        // Never overwrite another tab's in-progress journal. That tab can finish;
        // this caller still performs its normal bounded restore without caching.
        const read = store.get('checkpoint');
        read.onsuccess = guard(() => {
          if (read.result) return;
          store.clear(); store.put(checkpoint, 'checkpoint'); done(checkpoint);
        });
      });
    },
    async commit(previous, rows, after, complete, signal) {
      const next: RestoreCheckpoint = { ...previous, after, complete, count: previous.count + rows.length };
      if (!validRestoreCheckpoint(next, previous.ownerId, previous.source)
        || !validRestoreRows(rows, next) || rows.some(row => previous.after !== null && row.id <= previous.after)
        || previous.complete || (after !== null && previous.after !== null && after < previous.after)) return;
      return transaction<RestoreCheckpoint>(signal, (store, done, guard) => {
        const read = store.get('checkpoint');
        read.onsuccess = guard(() => {
          const current = read.result as RestoreCheckpoint | undefined;
          if (current?.token !== previous.token || current.ownerId !== previous.ownerId || current.after !== previous.after || current.complete) return;
          for (const row of rows) store.put(row, 'row:' + row.id);
          store.put(next, 'checkpoint'); done(next);
        });
      });
    },
    async discard(ownerId, token) {
      await transaction(undefined, (store, _done, guard) => {
        const read = store.get('checkpoint');
        read.onsuccess = guard(() => {
          const current = read.result as RestoreCheckpoint | undefined;
          if ((!ownerId || current?.ownerId === ownerId) && (!token || current?.token === token)) store.clear();
        });
      });
    },
  };
}
export const cloudRestoreRecovery = createCloudRestoreRecovery();
