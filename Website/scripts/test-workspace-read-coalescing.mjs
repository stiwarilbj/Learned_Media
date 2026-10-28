import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const workspaceSource = readFileSync(new URL('../lib/workspaces.ts', import.meta.url), 'utf8');
const workspaceCode = ts.transpileModule(workspaceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const validationSource = readFileSync(new URL('../lib/snapshot-validation.ts', import.meta.url), 'utf8');
const validationCode = ts.transpileModule(validationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  const committed = new Map(), transactions = [], local = new Map();
  const database = {
    failNext: false,
    objectStoreNames: { contains: () => true },
    transaction(_name, mode) { return new FakeTransaction(this, mode); }
  };
  class FakeTransaction {
    constructor(owner, mode) {
      this.owner = owner; this.mode = mode; this.pendingWrites = [];
      transactions.push(this);
      setTimeout(() => this.finish(), 12);
    }
    objectStore() {
      return {
        get: key => {
          const request = { result: undefined };
          queueMicrotask(() => {
            request.result = structuredClone(committed.get(key));
            request.onsuccess?.();
          });
          return request;
        },
        put: (value, key) => this.pendingWrites.push(() => committed.set(key, structuredClone(value)))
      };
    }
    finish() {
      if (this.owner.failNext) {
        this.owner.failNext = false;
        this.error = new Error('simulated transaction failure');
        this.onabort?.();
        return;
      }
      try {
        for (const write of this.pendingWrites) write();
        this.oncomplete?.();
      } catch (error) {
        this.error = error;
        this.onabort?.();
      }
    }
  }
  const window = {
    indexedDB: {},
    localStorage: {
      getItem: key => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value),
      removeItem: key => local.delete(key)
    }
  };
  const validationExports = {};
  runInNewContext(validationCode, { exports: validationExports, window, Date, Map, Object, JSON, Number, Array, Set, Math, String, Boolean, RegExp });
  const context = {
    exports: {}, window, structuredClone, setTimeout, clearTimeout, queueMicrotask,
    require(name) {
      if (name === './indexed-db') return { createDatabaseConnection: () => async () => database };
      if (name === './snapshot-validation') return validationExports;
      throw Error(`Unexpected module ${name}`);
    }
  };
  runInNewContext(workspaceCode, context);
  return { workspaces: context.exports, committed, transactions, local, database, window };
}

const workspace = (id, name, stamp = '2026-01-01T00:00:00.000Z') => ({
  version: 1,
  activeId: id,
  records: [{ id, name, createdAt: stamp, updatedAt: stamp, state: { topics: [], cards: [], settings: {} } }]
});

test('concurrent callers share one IndexedDB read and receive isolated stored snapshots', async () => {
  const h = harness(); h.committed.set('workspace-store', workspace('stored', 'Stored'));
  const firstPromise = h.workspaces.readWorkspaceStore(null);
  const secondPromise = h.workspaces.readWorkspaceStore(null);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(h.transactions.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
  assert.notEqual(first, second, 'concurrent callers do not share a mutable result object');
  first.records[0].name = 'Changed by first caller';
  assert.equal(second.records[0].name, 'Stored');
});

test('concurrent callers apply their own fallback after the shared empty read', async () => {
  const h = harness(), firstFallback = workspace('first', 'First fallback'), secondFallback = workspace('second', 'Second fallback');
  const [first, second] = await Promise.all([
    h.workspaces.readWorkspaceStore(firstFallback),
    h.workspaces.readWorkspaceStore(secondFallback)
  ]);
  assert.equal(h.transactions.length, 1);
  assert.equal(first, firstFallback);
  assert.equal(second, secondFallback);
});

test('concurrent callers compare the shared read with their own recovery snapshots', async () => {
  const h = harness(); h.committed.set('workspace-store', workspace('stored', 'Stored'));
  const recoveries = [workspace('recovery-a', 'Recovery A', '2026-02-01T00:00:00.000Z'), workspace('recovery-b', 'Recovery B', '2026-03-01T00:00:00.000Z')];
  let recoveryIndex = 0;
  h.window.localStorage.getItem = key => key === 'learned-media-all-workspaces' ? JSON.stringify(recoveries[recoveryIndex++]) : null;
  const [first, second] = await Promise.all([
    h.workspaces.readWorkspaceStore(null),
    h.workspaces.readWorkspaceStore(null)
  ]);
  assert.equal(h.transactions.length, 1);
  assert.equal(first.records[0].name, 'Recovery A');
  assert.equal(second.records[0].name, 'Recovery B');
});

test('a rejected shared transaction falls back per caller and clears for the next read', async () => {
  const h = harness(), firstFallback = workspace('first', 'First fallback'), secondFallback = workspace('second', 'Second fallback');
  h.database.failNext = true;
  h.committed.set('workspace-store', workspace('recovered', 'Recovered after failure'));
  const [first, second] = await Promise.all([
    h.workspaces.readWorkspaceStore(firstFallback),
    h.workspaces.readWorkspaceStore(secondFallback)
  ]);
  assert.equal(first, firstFallback);
  assert.equal(second, secondFallback);
  assert.equal(h.transactions.length, 1);
  const later = await h.workspaces.readWorkspaceStore(null);
  assert.equal(later.records[0].name, 'Recovered after failure');
  assert.equal(h.transactions.length, 2, 'the settled rejected promise is not retained as a cache');
});

test('a read after write opens a new transaction and sees the committed workspace', async () => {
  const h = harness(); h.committed.set('workspace-store', workspace('w', 'Before write'));
  const before = await h.workspaces.readWorkspaceStore(null);
  assert.equal(before.records[0].name, 'Before write');
  assert.equal(h.transactions.length, 1);
  await h.workspaces.writeWorkspaceStore(workspace('w', 'After write'), { writeRecovery: false });
  assert.equal(h.transactions.length, 2);
  const after = await h.workspaces.readWorkspaceStore(null);
  assert.equal(after.records[0].name, 'After write');
  assert.equal(h.transactions.length, 3, 'the read promise is cleared before a later storage read');
});
