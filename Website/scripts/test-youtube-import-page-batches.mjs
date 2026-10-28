import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/youtube-import-lease.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

class KeyRange {
  constructor(lower, upper, lowerOpen = false, upperOpen = false) { Object.assign(this, { lower, upper, lowerOpen, upperOpen }); }
  static bound(lower, upper, lowerOpen = false, upperOpen = false) { return new KeyRange(lower, upper, lowerOpen, upperOpen); }
}

class RequestTransaction {
  constructor(database) { this.database = database; this.pending = 0; this.aborted = false; this.completed = false; }
  objectStore() { return new ObjectStore(this); }
  abort() { if (this.aborted || this.completed) return; this.aborted = true; queueMicrotask(() => this.onabort?.()); }
  addRequest(request, execute) {
    this.pending += 1;
    queueMicrotask(() => {
      if (this.aborted) return;
      try { request.result = execute(); }
      catch (error) { request.error = error; request.onerror?.(); this.abort(); return; }
      request.onsuccess?.();
      this.finishRequest();
    });
    return request;
  }
  finishRequest() {
    if (this.aborted || this.completed) return;
    this.pending -= 1;
    if (this.pending !== 0) return;
    queueMicrotask(() => {
      if (this.pending !== 0 || this.aborted || this.completed) return;
      this.completed = true;
      this.oncomplete?.();
    });
  }
}

class ObjectStore {
  constructor(transaction) { this.transaction = transaction; }
  get(key) { return this.transaction.addRequest({ result: undefined, error: null }, () => this.transaction.database.values.get(key)); }
  put(value, key) {
    return this.transaction.addRequest({ result: key, error: null }, () => { this.transaction.database.values.set(key, value); return key; });
  }
  delete(key) {
    return this.transaction.addRequest({ result: undefined, error: null }, () => {
      const values = this.transaction.database.values;
      if (key instanceof KeyRange) {
        for (const candidate of values.keys()) {
          if ((candidate > key.lower || (!key.lowerOpen && candidate === key.lower)) &&
              (candidate < key.upper || (!key.upperOpen && candidate === key.upper))) values.delete(candidate);
        }
      } else values.delete(key);
    });
  }
  getAll() { throw new Error('Checkpoint recovery must not use getAll.'); }
  openCursor(range) {
    const database = this.transaction.database;
    const keys = [...database.values.keys()].filter(key => typeof key === 'string' &&
      (key > range.lower || (!range.lowerOpen && key === range.lower)) &&
      (key < range.upper || (!range.upperOpen && key === range.upper))).sort();
    const request = { result: null, error: null, onsuccess: null, onerror: null };
    this.transaction.pending += 1;
    let index = 0;
    const dispatch = () => queueMicrotask(() => {
      if (this.transaction.aborted) return;
      const key = keys[index];
      let continued = false;
      if (key === undefined) request.result = null;
      else {
        database.cursorVisits += 1;
        database.onCursorVisit?.(database.cursorVisits);
        request.result = {
          key, primaryKey: key, value: database.values.get(key),
          continue: () => { continued = true; index += 1; dispatch(); }
        };
      }
      request.onsuccess?.();
      if (!continued) this.transaction.finishRequest();
    });
    dispatch();
    return request;
  }
}

class Database {
  constructor() { this.values = new Map(); this.cursorVisits = 0; this.batchScans = []; this.onCursorVisit = null; }
  transaction() { return new RequestTransaction(this); }
}

const listeners = new Map();
const window = {
  addEventListener(name, listener) { const set = listeners.get(name) ?? new Set(); set.add(listener); listeners.set(name, set); },
  removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
  setInterval() { return 1; }, clearInterval() {}
};
class BroadcastChannel { postMessage() {} close() {} }
let abortDuringCursor;
const context = {
  exports: {}, IDBKeyRange: KeyRange, crypto: { randomUUID }, DOMException, AbortController,
  window, BroadcastChannel, localStorage: { setItem() {} },
  setInterval, clearInterval, setTimeout,
  require(name) {
    if (name === './youtube-import-checkpoints') return {
      YOUTUBE_IMPORT_PAGE_PREFIX: 'youtube-import-page-v1:', YOUTUBE_IMPORT_PAGE_BATCH_SIZE: 25,
      importPagePrefix: sourceId => `youtube-import-page-v1:${encodeURIComponent(sourceId)}:`,
      importPageKey: page => `youtube-import-page-v1:${encodeURIComponent(page.sourceId)}:${String(page.index).padStart(8, '0')}`,
      verifyYouTubeRefreshes: async () => {}
    };
    if (name === './youtube-catalog-storage') return {
      VIDEO_RECORD_PREFIX: 'video:', VIDEO_WRITE_BATCH_SIZE: 100,
      videoRecordRange: () => KeyRange.bound('video:', 'video:\uffff'), planCatalogCommit: async () => {}
    };
    if (name === './youtube') return {};
    if (name === './background-work') return {
      yieldBackground: async signal => { if (signal.aborted) throw signal.reason ?? new DOMException('Canceled', 'AbortError'); }
    };
    throw Error(`Unexpected module ${name}`);
  }
};
runInNewContext(code, context);
const { withYouTubeImportLease } = context.exports;

async function consumePages(database, abortController) {
  return withYouTubeImportLease(async () => database, abortController.signal, () => {}, async ownership => {
    const sizes = [], indices = [];
    for await (const batch of ownership.pages.loadBatches('playlist:fixture')) {
      sizes.push(batch.length);
      indices.push(...batch.map(page => page.index));
    }
    return { sizes, indices };
  });
}

function seed(database, count) {
  const prefix = 'youtube-import-page-v1:playlist%3Afixture:';
  for (let index = 0; index < count; index += 1) {
    database.values.set(`${prefix}${String(index).padStart(8, '0')}`, { index, requestToken: String(index) });
  }
}

{
  const database = new Database(); seed(database, 61);
  const result = await consumePages(database, new AbortController());
  assert.deepEqual(result.sizes, [25, 25, 11]);
  assert.deepEqual(result.indices, Array.from({ length: 61 }, (_, index) => index));
  assert.equal(database.cursorVisits, 61);
}

{
  const database = new Database(); seed(database, 200);
  const controller = new AbortController();
  database.onCursorVisit = count => { if (count === 9) controller.abort(new DOMException('Canceled during cursor read', 'AbortError')); };
  await assert.rejects(consumePages(database, controller), { name: 'AbortError' });
  assert.equal(database.cursorVisits, 9, 'the cursor read stops at the first cancellation check');
}

{
  const database = new Database(); seed(database, 10);
  const otherPrefix = 'youtube-import-page-v1:playlist%3Aother:';
  database.values.set(`${otherPrefix}00000000`, { index: 0 });
  await withYouTubeImportLease(async () => database, new AbortController().signal, () => {}, async ownership => {
    await ownership.pages.clearFrom('playlist:fixture', 4);
  });
  const fixtureKeys = [...database.values.keys()].filter(key => key.startsWith('youtube-import-page-v1:playlist%3Afixture:')).sort();
  assert.deepEqual(fixtureKeys.map(key => Number(key.slice(-8))), [0, 1, 2, 3]);
  assert.ok(database.values.has(`${otherPrefix}00000000`), 'suffix cleanup does not affect another playlist');
}

console.log('IndexedDB import checkpoints read in bounded batches, stop promptly on cancellation, and truncate only the damaged playlist suffix.');
