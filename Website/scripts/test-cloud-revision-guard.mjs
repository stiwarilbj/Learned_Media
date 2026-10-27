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
    rpc(name) {
      const options = {};
      return {
        select(value) { options.select = value; return this; },
        order(column, value) { options.column = column; options.ascending = value.ascending; return this; },
        limit(value) { options.limit = value; return this; },
        gt(column, value) { options.after = value; return this; },
        lte(column, value) { options.through = value; return this; },
        async abortSignal(s) {
          if (s.aborted) throw Error('aborted'); if (name === 'remember_facts') return { error: null };
          db.reads++; (db.requests ??= []).push({ ...options });
          if (db.onRead) await db.onRead(options);
          if (db.readResult) { const result = db.readResult(options); if (result) return result; }
          let rows = [...db.heads.values()];
          if (options.after !== undefined) rows = rows.filter(row => row.workspace_id > options.after);
          if (options.through !== undefined) rows = rows.filter(row => row.workspace_id <= options.through);
          if (options.column) rows.sort((a,b) => (a.workspace_id < b.workspace_id ? -1 : a.workspace_id > b.workspace_id ? 1 : 0) * (options.ascending ? 1 : -1));
          if (options.limit !== undefined) rows = rows.slice(0, options.limit);
          if (options.select === 'workspace_id') rows = rows.map(row => ({ workspace_id: row.workspace_id }));
          return { data: rows, error: null };
        }
      };
    },
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

function nativeConflictQueue(checkpointRead) {
  const app = readFileSync(new URL('../../App/Resources/frontend/app.js', import.meta.url), 'utf8');
  const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
  const state = { account: { id: 'account' }, workspaces: [record()], workspaceId: 'w' };
  const calls = { saved: 0, rendered: 0, applied: [] };
  const context = vm.createContext({ state, cloudSyncToken: 1,
    window: { LEARNED_MEDIA_SNAPSHOTS: baseRequire('./latest-snapshot-queue.ts'), LEARNED_MEDIA_STORAGE: baseRequire('./snapshot-validation.ts') },
    shared: { youtube: { mergeYouTubeActivity: (legacy, canonical) => ({ ...legacy, ...canonical }) } },
    youtubeLivePlaybackCheckpoints: new Map(), sentFactMemories: new Map(), factMemoryById: new Map(), changedFactMemoryIds: new Set(),
    bridge: async action => action === 'cloudSave' ? { mergedRecords: [record(4)] } : checkpointRead(),
    applyWorkspaceSnapshot: (value, preserve) => calls.applied.push({ value, preserve }),
    saveState: () => calls.saved++, render: () => calls.rendered++
  });
  vm.runInContext(extract('  function mergeWorkspaceRecords(', '  function mergeFactMemories(')
    + extract('  function mergeNativePlaybackCheckpoints(', '  function currentWorkspaceSnapshot(')
    + extract('  function createCloudUploadQueue(', '  function scheduleCloudSave(')
    + '\nglobalThis.queue = createCloudUploadQueue();', context);
  return { context, state, calls, send: () => context.queue.enqueue({ token: 1, ownerId: 'account', payload: '{}', changedMemories: [] }) };
}
test('Mac conflict application overlays local playback before preserving the reading state', async () => {
  const c = nativeConflictQueue(() => ({ w: { videoID: 'video', seconds: 91, updatedAt: 10 } }));
  await c.send();
  assert.equal(c.state.workspaces[0].state.youtubeActivity.playbackPositions.video, 91);
  assert.equal(c.calls.applied[0].preserve, true);
  assert.equal(c.calls.saved, 1); assert.equal(c.calls.rendered, 1);
});
test('Mac account changes during checkpoint restoration discard the cloud result', async () => {
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
  const c = nativeConflictQueue(() => { started(); return waiting; });
  const pending = c.send(); await began;
  c.state.account = { id: 'other' }; c.context.cloudSyncToken++;
  release({ w: { videoID: 'video', seconds: 91, updatedAt: 10 } }); await pending;
  assert.equal(c.state.workspaces[0].name, 'Workspace 1');
  assert.equal(c.calls.applied.length, 0); assert.equal(c.calls.saved, 0); assert.equal(c.calls.rendered, 0);
});


function seedWorkspaceRange(db, count) {
  for (let index = 0; index < count; index++) {
    const id = `w-${String(index).padStart(5, '0')}`;
    db.heads.set(id, { workspace_id: id, revision_id: `revision-${index}`, record: record(1, id) });
  }
}
test('workspace restoration pages beyond the API row cap with one fixed high-water mark', async () => {
  const db = server(); seedWorkspaceRange(db, 1105);
  // New heads outside the captured range cannot extend this restoration. A
  // changing revision of an existing workspace cannot move its cursor key.
  db.onRead = async options => {
    if (options.after === 'w-00099') {
      db.heads.set('z-new', { workspace_id: 'z-new', revision_id: 'new', record: record(1, 'z-new') });
      db.heads.set('w-00150', { workspace_id: 'w-00150', revision_id: 'updated', record: record(4, 'w-00150') });
    }
  };
  const c = client(db), result = await c.load(signal());
  assert.equal(result.records.length, 1105); assert.equal(new Set(result.records.map(r => r.id)).size, 1105);
  assert.equal(result.records.find(r => r.id === 'w-00150').name, 'Workspace 4');
  assert.equal(result.records.some(r => r.id === 'z-new'), false);
  assert.equal(db.requests[0].select, 'workspace_id'); assert.equal(db.requests[0].limit, 1);
  assert.equal(db.requests.length, 13);
  assert.ok(db.requests.slice(1).every(q => q.through === 'w-01104' && q.limit === 100 && q.ascending));
  assert.equal(c.observed.get('w-00150'), 'updated');
});
test('empty, short, and exact-page accounts stop without an unbounded read', async () => {
  for (const count of [0, 1, 99, 100, 101, 200]) {
    const db = server(); seedWorkspaceRange(db, count); const result = await client(db).load(signal());
    assert.equal(result.records.length, count);
    assert.equal(db.requests.length, 1 + Math.ceil(count / 100));
    assert.ok(db.requests.every(q => q.limit === 1 || q.limit === 100));
  }
});
test('failed later workspace pages never acknowledge a partial restoration', async () => {
  for (const failure of ['error', 'duplicate', 'mismatch']) {
    const db = server(); seedWorkspaceRange(db, 150); const c = client(db);
    db.readResult = options => options.after ? failure === 'error'
      ? { data: null, error: Error('page failed') }
      : { data: [{ workspace_id: failure === 'duplicate' ? 'w-00000' : 'wrong', revision_id: 'bad', record: record(1, 'w-00000') }], error: null } : null;
    await assert.rejects(c.load(signal()), /page failed|invalid cursor/);
    assert.equal(c.observed.size, 0); assert.equal(c.sent.size, 0);
  }
});
test('cancellation between workspace pages stops before another page is sent', async () => {
  const db = server(); seedWorkspaceRange(db, 300); const c = client(db), controller = new AbortController();
  db.onRead = async options => { if (options.after) controller.abort(); };
  await assert.rejects(c.load(controller.signal), /canceled/);
  assert.equal(db.requests.length, 3); assert.equal(c.observed.size, 0);
});
