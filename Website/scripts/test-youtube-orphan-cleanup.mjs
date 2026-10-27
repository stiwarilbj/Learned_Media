import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/youtube-import-lease.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

class FakeKeyRange {
  constructor(lower, upper, lowerOpen = false, upperOpen = false) { Object.assign(this, { lower, upper, lowerOpen, upperOpen }); }
  static bound(lower, upper, lowerOpen = false, upperOpen = false) { return new FakeKeyRange(lower, upper, lowerOpen, upperOpen); }
}

class FakeDatabase {
  constructor(records, owner, expiresAt = Date.now() + 60_000) {
    this.records = new Map(records);
    this.records.set('youtube-import-lease-v1', { owner, expiresAt });
    this.scans = [];
  }
  transaction() { return new FakeTransaction(this); }
}

class FakeTransaction {
  constructor(database) {
    this.database = database;
    this.pending = 0;
    this.aborted = false;
    this.completed = false;
    this.oncomplete = this.onerror = this.onabort = null;
  }
  objectStore() { return new FakeObjectStore(this); }
  abort() {
    if (this.completed || this.aborted) return;
    this.aborted = true;
    queueMicrotask(() => this.onabort?.());
  }
  request(run, after = () => {}) {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    this.pending += 1;
    queueMicrotask(() => {
      if (this.aborted) return;
      try { request.result = run(); }
      catch (error) { request.error = error; request.onerror?.(); this.abort(); return; }
      request.onsuccess?.();
      after();
      this.finishRequest();
    });
    return request;
  }
  finishRequest() {
    this.pending -= 1;
    if (this.pending !== 0 || this.aborted || this.completed) return;
    queueMicrotask(() => {
      if (this.pending !== 0 || this.aborted || this.completed) return;
      this.completed = true;
      this.oncomplete?.();
    });
  }
}

class FakeObjectStore {
  constructor(transaction) { this.transaction = transaction; }
  get(key) { return this.transaction.request(() => this.transaction.database.records.get(key)); }
  openKeyCursor(range) {
    const db = this.transaction.database;
    const keys = [...db.records.keys()].filter(key => typeof key === 'string' &&
      (key > range.lower || (!range.lowerOpen && key === range.lower)) &&
      (key < range.upper || (!range.upperOpen && key === range.upper))).sort();
    const scan = { count: 0 };
    db.scans.push(scan);
    let index = 0;
    const request = { result: null, error: null, onsuccess: null, onerror: null };
    this.transaction.pending += 1;
    const schedule = () => queueMicrotask(() => {
      if (this.transaction.aborted) return;
      const key = keys[index];
      scan.count += key === undefined ? 0 : 1;
      if (key === undefined) request.result = null;
      let continued = false;
      if (key !== undefined) request.result = {
        key,
        continue: () => { continued = true; index += 1; schedule(); },
        delete: () => { db.records.delete(key); return { error: null, onerror: null }; }
      };
      request.onsuccess?.();
      if (!continued) this.transaction.finishRequest();
    });
    schedule();
    return request;
  }
}

let yieldHook = async () => {};
const context = {
  exports: {}, IDBKeyRange: FakeKeyRange, Date, DOMException,
  require(name) {
    if (name === './youtube-import-checkpoints') return { YOUTUBE_IMPORT_PAGE_PREFIX: '', importPageKey() {}, importPagePrefix() {}, verifyYouTubeRefreshes: async () => {} };
    if (name === './youtube-catalog-storage') return {
      VIDEO_RECORD_PREFIX: 'youtube-video-record-v1:', VIDEO_WRITE_BATCH_SIZE: 100,
      planCatalogCommit() {}, videoRecordRange: () => FakeKeyRange.bound('youtube-video-record-v1:', 'youtube-video-record-v1:\uffff')
    };
    if (name === './youtube') return {};
    if (name === './background-work') return { yieldBackground: async signal => { await yieldHook(signal); if (signal.aborted) throw new DOMException('Canceled', 'AbortError'); } };
    throw Error(`Unexpected module ${name}`);
  }
};
runInNewContext(code, context);
const { cleanupOrphanVideoRecords } = context.exports;

const prefix = 'youtube-video-record-v1:';
const records = count => Array.from({ length: count }, (_, index) => [`${prefix}${String(index).padStart(5, '0')}`, { id: index }]);
const owner = 'current-owner';
const controller = () => new AbortController();

{
  const db = new FakeDatabase(records(2_500), owner);
  const retained = new Set(records(2_500).filter((_, index) => index % 4 !== 0).map(([key]) => key));
  yieldHook = async () => {};
  await cleanupOrphanVideoRecords(async () => db, owner, retained, controller().signal);
  assert.equal(db.records.size, retained.size + 1, 'only the lease and retained catalog records remain');
  assert.equal(db.scans.length, 26, 'the cursor processes bounded chunks plus one final empty range');
  assert.ok(db.scans.every(scan => scan.count <= 100), 'no cleanup transaction scans more than one batch');
  assert.equal([...db.records.keys()].filter(key => key.startsWith(prefix)).some(key => !retained.has(key)), false);
}

{
  const db = new FakeDatabase(records(350), owner);
  let batches = 0;
  yieldHook = async () => { if (++batches === 1) throw new DOMException('Interrupted cleanup', 'AbortError'); };
  await assert.rejects(cleanupOrphanVideoRecords(async () => db, owner, new Set(), controller().signal), /Interrupted cleanup/);
  assert.equal(db.records.size, 251, 'the completed first batch stays committed when cleanup is interrupted');
  assert.equal(db.scans.length, 1, 'an interrupted cleanup does not scan the remaining catalog');
}

{
  const db = new FakeDatabase(records(350), owner);
  let changedOwner = false;
  yieldHook = async () => {
    if (changedOwner) return;
    changedOwner = true;
    db.records.set('youtube-import-lease-v1', { owner: 'new-owner', expiresAt: Date.now() + 60_000 });
  };
  await assert.rejects(cleanupOrphanVideoRecords(async () => db, owner, new Set(), controller().signal), /Another tab took over/);
  assert.equal(db.records.size, 251, 'the old owner stops after its already completed batch');
  yieldHook = async () => {};
  await cleanupOrphanVideoRecords(async () => db, 'new-owner', new Set(), controller().signal);
  assert.equal(db.records.size, 1, 'the new lease owner can finish cleaning the remaining orphans');
}

console.log('YouTube orphan cleanup uses bounded key cursors and safely stops on interruption or lease takeover.');
