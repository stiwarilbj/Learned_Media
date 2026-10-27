import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/workspaces.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const snapshotSource = readFileSync(new URL('../lib/snapshot-validation.ts', import.meta.url), 'utf8');
const snapshotCode = ts.transpileModule(snapshotSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const committed = new Map();
const database = { failNext: false, transactions: [] };
class FakeTransaction {
  constructor(mode) {
    this.mode = mode;
    this.pending = [];
    this.reads = [];
    database.transactions.push(this);
    setTimeout(() => this.finish(), 15);
  }
  objectStore() {
    return {
      put: (value, key) => this.pending.push(() => committed.set(key, structuredClone(value))),
      get: key => {
        this.reads.push(key);
        const request = { result: undefined };
        this.pending.push(() => { request.result = structuredClone(committed.get(key)); });
        this.getRequest = request;
        return request;
      }
    };
  }
  finish() {
    if (database.failNext) {
      database.failNext = false;
      this.error = new Error('simulated transaction failure');
      this.onabort?.();
      return;
    }
    try { for (const operation of this.pending) operation(); this.oncomplete?.(); }
    catch (error) { this.error = error; this.onabort?.(); }
  }
}
const db = {
  objectStoreNames: { contains: () => true },
  transaction(_name, mode) { return new FakeTransaction(mode); }
};
const window = { indexedDB: {} };
const snapshotExports = {};
runInNewContext(snapshotCode, { exports: snapshotExports, window, Date, Map, Object, JSON, Number, Array, Set, Math, String, Boolean, RegExp });
const context = {
  exports: {}, window, structuredClone, setTimeout,
  require(name) {
    if (name === './indexed-db') return { createDatabaseConnection: () => async () => db };
    if (name === './snapshot-validation') return snapshotExports;
    throw Error(`Unexpected module ${name}`);
  }
};
runInNewContext(code, context);
const { accountWorkspaceBackup } = context.exports;

const workspace = (id, name) => ({
  version: 1,
  activeId: id,
  records: [{ id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    state: { persistenceVersion: 3, topics: [], cards: [], settings: { obscurity: 3, displayMode: 'text', sentenceLength: 3 }, savedAt: '2026-01-01T00:00:00.000Z' } }]
});
const original = workspace('w1', 'Original');
let settled = false;
const save = accountWorkspaceBackup('owner', original).then(value => { settled = true; return value; });
original.records[0].name = 'Mutated after invocation';
await new Promise(resolve => setTimeout(resolve, 5));
assert.equal(settled, false, 'the call cannot acknowledge before IndexedDB commits');
const stored = await save;
assert.equal(stored.records[0].name, 'Original', 'the returned snapshot is isolated from caller mutation');
assert.equal(committed.get('account:owner').records[0].name, 'Original');
assert.equal(database.transactions.at(-1).reads.length, 0, 'the write path does not read back its put');

database.failNext = true;
await assert.rejects(accountWorkspaceBackup('owner', workspace('w2', 'Failed write')));
assert.equal(committed.get('account:owner').records[0].name, 'Original', 'a failed transaction leaves the acknowledged backup intact');
const read = await accountWorkspaceBackup('owner');
assert.equal(read.records[0].name, 'Original', 'the ordinary read path remains unchanged');
assert.deepEqual(database.transactions.at(-1).reads, ['account:owner']);
console.log('Workspace backup writes acknowledge only committed isolated snapshots and avoid a post-write read.');
