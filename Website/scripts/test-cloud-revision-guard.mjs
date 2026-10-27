import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const require = createRequire(import.meta.url), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
if (!globalThis.crypto?.subtle) globalThis.crypto = require('node:crypto').webcrypto;
const source = ts.transpileModule(readFileSync(new URL('../lib/cloud-sync.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const baseRequire = createRequire(new URL('../lib/cloud-sync.ts', import.meta.url));
const { canonicalRecord } = baseRequire('./cloud-records.ts');
const { workspaceRevisionId } = baseRequire('./workspace-revision.ts');
const record = (time = 1, id = 'w') => ({ id, name: `Workspace ${time}`, createdAt: '2026-01-01T00:00:00Z', updatedAt: `2026-10-26T12:00:0${time}.000Z`, state: { topics: [], cards: [], settings: { obscurity: 5, sentenceLength: 3, displayMode: "text" }, youtubeActivity: {} } });
const signal = () => new AbortController().signal;
function server() {
  const db = { heads: new Map(), accepted: new Map(), writes: [], reads: 0, failures: [], onWrite: null, onRead: null };
  db.api = {
    rpc(name) { return { async abortSignal(s) { if (s.aborted) throw Error('aborted'); if (name === 'remember_facts') return { error: null }; db.reads++; if (db.onRead) await db.onRead(); return { data: [...db.heads.values()], error: null }; } }; },
    from(name) { return {
      select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
      async abortSignal() { assert.equal(name, 'fact_memory'); return { data: [], error: null }; },
      upsert(rows) { return { async abortSignal(s) {
        if (s.aborted) throw Error('aborted');
        db.writes.push(structuredClone(rows));
        if (db.onWrite) await db.onWrite(rows);
        if (db.failures.length) return { error: db.failures.shift() };
        // Whole request is transactional: no rows from a conflicting batch commit.
        for (const row of rows) if (!db.accepted.has(row.revision_id) && (db.heads.get(row.workspace_id)?.revision_id ?? null) !== row.expected_revision_id) return { error: { code: '40001' } };
        for (const row of rows) if (!db.accepted.has(row.revision_id)) { db.accepted.set(row.revision_id, structuredClone(row)); if (!db.heads.has(row.workspace_id) || row.modified_at >= db.heads.get(row.workspace_id).modified_at) db.heads.set(row.workspace_id, structuredClone(row)); }
        return { error: null };
      } }; }
    }; }
  };
  return db;
}
function client(db, user = 'account') {
  const exports = {};
  vm.runInNewContext(source, { exports, process, Uint8Array, Map, Set, crypto, TextEncoder, AbortController,
    require(name) { if (name === '@supabase/supabase-js') return { createClient: () => db.api }; return baseRequire(name); }
  });
  return new exports.WorkspaceCloudSync(user);
}
async function seed(db, value) {
  const r = canonicalRecord(value), revision_id = await workspaceRevisionId('account', r);
  const row = { workspace_id: r.id, user_id: 'account', revision_id, record: r, modified_at: r.updatedAt };
  db.heads.set(r.id, row); db.accepted.set(revision_id, row); return revision_id;
}
const save = (c, r, s = signal()) => c.save({ ownerId: 'account', records: Array.isArray(r) ? r : [r] }, s);

test('unchanged revision: one ordinary write, unchanged snapshot skips it', async () => {
  const db = server(), id = await seed(db, record()), c = client(db); await c.load(signal());
  await save(c, record(2)); assert.equal(db.writes.length, 1); assert.equal(db.writes[0][0].expected_revision_id, id);
  await save(c, record(2)); assert.equal(db.writes.length, 1);
});
test('delayed older tab fetches and merges newer head before retry', async () => {
  const db = server(); await seed(db, record()); const a = client(db), b = client(db); await a.load(signal()); await b.load(signal());
  await save(a, record(4)); const newest = db.heads.get('w').revision_id; await save(b, record(2));
  assert.equal(db.heads.get('w').revision_id, newest); assert.equal(db.writes.at(-1)[0].expected_revision_id, newest);
  assert.equal(db.writes.at(-1)[0].record.name, 'Workspace 4'); assert.equal(b.takeMergedRecords()[0].name, 'Workspace 4');
  const count = db.writes.length; await save(b, record(2)); assert.equal(db.writes.length, count);
  await save(b, record(3)); assert.equal(db.heads.get('w').revision_id, newest);
});
test('newer local edit uses existing merge rule after conflict', async () => {
  const db = server(); await seed(db, record()); const c = client(db); await c.load(signal()); const remote = await seed(db, record(2));
  await save(c, record(3)); assert.equal(db.writes.at(-1)[0].expected_revision_id, remote); assert.equal(db.heads.get('w').record.name, 'Workspace 3');
});
test('simultaneous first saves cannot overwrite the newer initial record', async () => {
  const db = server(), a = client(db), b = client(db); await Promise.all([a.load(signal()), b.load(signal())]);
  await Promise.all([save(a, record(4)), save(b, record(2))]); assert.equal(db.heads.get('w').record.name, 'Workspace 4');
});
test('retrying a lost acknowledgement keeps revision identity', async () => {
  const db = server(), c = client(db); let first = true;
  db.onWrite = async rows => { if (first) { first = false; for (const row of rows) { db.heads.set(row.workspace_id, structuredClone(row)); db.accepted.set(row.revision_id, structuredClone(row)); } throw Error('lost response'); } };
  await assert.rejects(save(c, record(2)), /lost response/); await seed(db, record(4)); await save(c, record(2));
  assert.equal(db.writes[0][0].revision_id, db.writes[1][0].revision_id); assert.equal(db.heads.get('w').record.name, 'Workspace 4');
});
test('persistent conflicts are bounded and remain dirty; permission errors are not retried', async () => {
  const db = server(), c = client(db); db.failures = Array.from({ length: 3 }, () => ({ code: '40001' }));
  await assert.rejects(save(c, record()), /another device/); assert.equal(db.writes.length, 3); assert.equal(c.hasPendingUploads, true);
  const d = server(), other = client(d); d.failures = [{ code: '42501' }]; await assert.rejects(save(other, record()), error => error.code === '42501'); assert.equal(d.writes.length, 1);
});
test('canceled conflict read cannot retry or publish stale merged state', async () => {
  const db = server(), c = client(db), controller = new AbortController(); await seed(db, record(4));
  db.onRead = async () => controller.abort(); await assert.rejects(save(c, record(2), controller.signal), /canceled/);
  assert.equal(db.writes.length, 1); assert.equal(c.takeMergedRecords().length, 0);
});
test('account mismatch sends nothing and independent workspace conflicts stay scoped', async () => {
  const db = server(), c = client(db); await assert.rejects(c.save({ ownerId: 'other', records: [record()] }, signal()), /Account changed/); assert.equal(db.writes.length, 0);
  await seed(db, record(4)); await seed(db, record(1, 'other')); await save(c, [record(2), record(2, 'other')]);
  assert.equal(db.heads.get('w').record.name, 'Workspace 4'); assert.equal(db.heads.get('other').record.name, 'Workspace 2');
});
test('newest waiting snapshot merges the conflict discovered by its active upload', async () => {
  const db = server(); await seed(db, record()); const c = client(db); await c.load(signal());
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
  let first = true;
  db.onWrite = async () => { if (first) { first = false; started(); await waiting; } };
  const active = save(c, record(2)); await began; const queued = save(c, record(3)); await seed(db, record(4)); release();
  await Promise.all([active, queued]); assert.equal(db.heads.get('w').record.name, 'Workspace 4');
  assert.equal(c.hasPendingUploads, false); assert.equal(db.writes.at(-1)[0].record.name, 'Workspace 4');
});
test('larger conflict winners are split again by the existing upload byte budget', async () => {
  const db = server(), c = client(db), large = record(4); large.state.settings.padding = 'x'.repeat(1024 * 1024);
  await seed(db, large); await save(c, [record(2), record(2, 'other')]);
  assert.equal(db.writes.length, 3); assert.equal(db.writes[1].length, 1); assert.equal(db.writes[2].length, 1);
  assert.equal(db.heads.get('w').record.name, 'Workspace 4'); assert.equal(db.heads.get('other').record.name, 'Workspace 2');
});
