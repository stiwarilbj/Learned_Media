import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const require = createRequire(import.meta.url), Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { validateSnapshot } = require('../lib/snapshot-validation.ts');
const code = ts.transpileModule(readFileSync(new URL('../lib/cloud-restore-recovery.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
runInNewContext(code, { exports, crypto: webcrypto, setTimeout, clearTimeout, IDBKeyRange: { bound: (lower, upper) => ({ lower, upper }) },
  require(name) {
    if (name === './snapshot-validation') return { validateSnapshot };
    if (name === './indexed-db') return { createDatabaseConnection: () => async () => { throw Error('unavailable'); } };
    throw Error(name);
  }
});
const { createCloudRestoreRecovery, validRestoreRows } = exports;
const signal = () => new AbortController().signal;
const row = id => ({ id, revision: 'revision-' + id, record: { id, name: id, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', state: { topics: [], cards: [], settings: { obscurity: 5, sentenceLength: 3, displayMode: 'text' } } } });

// Serialized, atomic transactions with asynchronous request callbacks. A failed
// put rolls back both page records and cursor, as real IndexedDB must do.
function database() {
  const db = { data: new Map(), queued: [], busy: false, failKey: undefined, transactions: [], reverseCursor: false, cursorRowsVisited: 0, onCursorRow: undefined };
  class Transaction {
    constructor() { this.jobs = []; this.ended = false; db.transactions.push(this); db.queued.push(this); db.start(); }
    objectStore() {
      const request = work => { const result = {}; this.jobs.push(() => { result.result = work(); result.onsuccess?.(); }); return result; };
      return {
        get: key => request(() => structuredClone(this.staged.get(key))),
        put: (value, key) => { if (key === db.failSyncKey) throw Error('synchronous quota'); const copy = structuredClone(value); return request(() => { if (key === db.failKey) throw Error('quota'); this.staged.set(key, copy); }); },
        clear: () => request(() => this.staged.clear()),
        openCursor: range => {
          const result = {};
          let entries, index = 0;
          const advance = () => {
            if (!entries) {
              entries = [...this.staged].filter(([key]) => key >= range.lower && key < range.upper).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
              if (db.reverseCursor) entries.reverse();
            }
            const entry = entries[index++];
            result.result = entry ? { key: entry[0], value: structuredClone(entry[1]), continue: () => this.jobs.push(advance) } : null;
            result.onsuccess?.();
            if (entry) { db.cursorRowsVisited += 1; db.onCursorRow?.(entry[0]); }
          };
          this.jobs.push(advance); return result;
        }
      };
    }
    abort() { if (!this.ended) this.finish(false); }
    finish(success) {
      if (this.ended) return;
      this.ended = true;
      if (success) { db.data = this.staged; this.oncomplete?.(); } else this.onabort?.();
      db.busy = false; db.start();
    }
    pump() {
      if (this.ended) return;
      if (!this.jobs.length) { this.finish(true); return; }
      try { this.jobs.shift()(); setTimeout(() => this.pump(), 0); } catch { this.finish(false); }
    }
  }
  db.start = () => {
    if (db.busy || !db.queued.length) return;
    db.busy = true;
    const next = db.queued.shift(); next.staged = structuredClone(db.data);
    setTimeout(() => next.pump(), 0);
  };
  db.transaction = () => new Transaction();
  return db;
}

test('page records and cursor acknowledge together; aborted writes retain the last prefix', async () => {
  const db = database(), recovery = createCloudRestoreRecovery(async () => db);
  const initial = await recovery.begin('owner', 'source', 'z', signal());
  const first = await recovery.commit(initial, [row('a')], 'a', false, signal());
  assert.equal(first.after, 'a');
  db.failKey = 'checkpoint';
  assert.equal(await recovery.commit(first, [row('b')], 'b', false, signal()), undefined);
  assert.equal(db.data.has('row:b'), false);
  assert.equal(db.data.get('checkpoint').after, 'a');
  db.failKey = undefined;
  db.failSyncKey = 'checkpoint';
  assert.equal(await recovery.commit(first, [row('b')], 'b', false, signal()), undefined);
  assert.equal(db.data.has('row:b'), false, 'an exception in a request callback also aborts the page');
  db.failSyncKey = undefined;
  const saved = await recovery.read('owner', 'source', signal());
  assert.deepEqual(Array.from(saved.rows, item => item.id), ['a']);
  const completed = await recovery.commit(saved.checkpoint, [row('b')], 'b', true, signal());
  assert.equal(completed.complete, true);
  await recovery.discard('owner', completed.token);
  assert.equal(db.data.size, 0);
});

test('stale writers cannot advance a newer cursor or clear another account', async () => {
  const db = database(), recovery = createCloudRestoreRecovery(async () => db);
  const initial = await recovery.begin('owner', 'source', 'z', signal());
  assert.equal(await recovery.begin('owner', 'source', 'z', signal()), undefined);
  await recovery.commit(initial, [row('a')], 'a', false, signal());
  assert.equal(await recovery.commit(initial, [row('b')], 'b', false, signal()), undefined);
  await recovery.discard('other');
  assert.equal(db.data.get('checkpoint').after, 'a');
  assert.equal(await recovery.read('other', 'source', signal()), undefined);
  assert.equal(db.data.size, 0);
});

test('missing, malformed or foreign recovery rows reset the disposable journal', async () => {
  for (const damage of ['missing', 'invalid', 'source', 'version']) {
    const db = database(), recovery = createCloudRestoreRecovery(async () => db);
    const start = await recovery.begin('owner', 'source', 'z', signal());
    await recovery.commit(start, [row('a')], 'a', false, signal());
    if (damage === 'missing') db.data.delete('row:a');
    if (damage === 'invalid') db.data.get('row:a').record.state.cards = 'corrupt';
    if (damage === 'source') db.data.get('checkpoint').source = 'foreign';
    if (damage === 'version') db.data.get('checkpoint').version = 2;
    assert.equal(await recovery.read('owner', 'source', signal()), undefined, damage);
    assert.equal(db.data.size, 0, damage);
  }
});

test('a corrupt row at every cursor position invalidates the whole recovery journal', async () => {
  for (const damagedId of ['a', 'b', 'c']) {
    const db = database(), recovery = createCloudRestoreRecovery(async () => db);
    const initial = await recovery.begin('owner', 'source', 'z', signal());
    await recovery.commit(initial, [row('a'), row('b'), row('c')], 'c', true, signal());
    db.data.get('row:' + damagedId).record.state.cards = 'corrupt';
    assert.equal(await recovery.read('owner', 'source', signal()), undefined, `damaged ${damagedId} row is rejected`);
    assert.equal(db.data.size, 0, `damaged ${damagedId} row clears the complete journal`);
  }
});

test('read validates cursor order, key identity, and checkpoint boundaries as rows arrive', async () => {
  for (const damage of ['descending', 'key-identity', 'after-boundary']) {
    const db = database(), recovery = createCloudRestoreRecovery(async () => db);
    const initial = await recovery.begin('owner', 'source', 'z', signal());
    await recovery.commit(initial, [row('a'), row('b'), row('c')], 'c', true, signal());
    if (damage === 'descending') db.reverseCursor = true;
    if (damage === 'key-identity') db.data.set('row:b', row('z'));
    if (damage === 'after-boundary') db.data.get('checkpoint').after = 'b';
    assert.equal(await recovery.read('owner', 'source', signal()), undefined, damage);
    assert.equal(db.data.size, 0, `${damage} invalidates the journal`);
    if (damage === 'descending') assert.equal(db.cursorRowsVisited, 2, 'descending rows are rejected on the first ordering violation');
  }

  const checkpoint = { version: 1, ownerId: 'owner', source: 'source', token: 'token', through: 'z', after: 'b', complete: true, count: 2 };
  assert.equal(validRestoreRows([row('b'), row('a')], checkpoint), false, 'the array validator retains strict cursor ordering');
  assert.equal(validRestoreRows([row('c')], checkpoint), false, 'rows beyond the saved cursor are invalid');
});

test('count mismatches invalidate both underfull and overfull journals', async () => {
  for (const expectedCount of [2, 4]) {
    const db = database(), recovery = createCloudRestoreRecovery(async () => db);
    const initial = await recovery.begin('owner', 'source', 'z', signal());
    await recovery.commit(initial, [row('a'), row('b'), row('c')], 'c', true, signal());
    db.data.get('checkpoint').count = expectedCount;
    assert.equal(await recovery.read('owner', 'source', signal()), undefined, `stored count ${expectedCount} does not match three rows`);
    assert.equal(db.data.size, 0, 'count mismatch clears all recovered state');
    if (expectedCount === 2) assert.equal(db.cursorRowsVisited, 3, 'overfull journals stop when the first extra row arrives');
  }
});

test('cancellation during cursor traversal returns nothing and preserves the committed journal', async () => {
  const db = database(), recovery = createCloudRestoreRecovery(async () => db);
  const initial = await recovery.begin('owner', 'source', 'z', signal());
  await recovery.commit(initial, [row('a'), row('b'), row('c')], 'c', true, signal());
  const controller = new AbortController();
  db.onCursorRow = () => controller.abort();
  await assert.rejects(recovery.read('owner', 'source', controller.signal), /canceled/);
  assert.equal(db.cursorRowsVisited, 1, 'the cursor stops after cancellation');
  assert.equal(db.data.get('checkpoint').count, 3, 'the last committed checkpoint remains intact');
  assert.deepEqual([...db.data.keys()].filter(key => key.startsWith('row:')).sort(), ['row:a', 'row:b', 'row:c']);
});

test('abort before startup, during open, or during a transaction never acknowledges a cursor', async () => {
  const db = database(), recovery = createCloudRestoreRecovery(async () => db);
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(recovery.begin('owner', 'source', 'z', canceled.signal), /canceled/);
  assert.equal(db.transactions.length, 0);
  const opening = createCloudRestoreRecovery(() => new Promise(() => {})), pending = new AbortController();
  const wait = opening.read('owner', 'source', pending.signal); pending.abort();
  await assert.rejects(wait, /canceled/);
  const start = await recovery.begin('owner', 'source', 'z', signal()), controller = new AbortController();
  const saving = recovery.commit(start, [row('a')], 'a', false, controller.signal);
  await Promise.resolve(); controller.abort();
  await assert.rejects(saving, /canceled/);
  assert.equal(db.data.get('checkpoint').after, null);
  assert.equal(db.data.has('row:a'), false);
});

test('unavailable journal storage and synchronous transaction failures leave normal restore available', async () => {
  assert.equal(await createCloudRestoreRecovery(async () => { throw Error('unavailable'); }).read('owner', 'source', signal()), undefined);
  assert.equal(await createCloudRestoreRecovery(async () => ({ transaction() { throw Error('closed'); } })).begin('owner', 'source', 'z', signal()), undefined);
});
