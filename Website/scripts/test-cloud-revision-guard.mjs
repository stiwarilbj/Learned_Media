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
const { canonicalRecord, mergeRecords } = baseRequire('./cloud-records.ts');
const { snapshotDiagnostics } = baseRequire('./snapshot-validation.ts');
const { workspaceRevisionId } = baseRequire('./workspace-revision.ts');
const record = (time = 1, id = 'w') => ({ id, name: `Workspace ${time}`, createdAt: '2026-01-01T00:00:00Z', updatedAt: `2026-10-26T12:00:0${time}.000Z`, state: { topics: [], cards: [], settings: { obscurity: 5, sentenceLength: 3, displayMode: "text" }, youtubeActivity: {} } });
const signal = () => new AbortController().signal;
function server() {
  const db = { heads: new Map(), accepted: new Map(), writes: [], reads: 0, failures: [], onWrite: null, onRead: null, acknowledgments: null };
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
      upsert(rows) {
        const options = {};
        const builder = {
          select(columns) { options.returning = columns; return builder; },
          async abortSignal(s) {
            if (s.aborted) throw Error('aborted');
            db.writes.push(structuredClone(rows));
            if (db.onWrite) await db.onWrite(rows);
            if (db.failures.length) return { data: null, error: db.failures.shift() };
            // Whole request is transactional: no rows from a conflicting batch commit.
            for (const row of rows) if (!db.accepted.has(row.revision_id) && (db.heads.get(row.workspace_id)?.revision_id ?? null) !== row.expected_revision_id) return { data: null, error: { code: '40001' } };
            const inserted = [];
            for (const row of rows) if (!db.accepted.has(row.revision_id)) {
              db.accepted.set(row.revision_id, structuredClone(row));
              if (!db.heads.has(row.workspace_id) || row.modified_at >= db.heads.get(row.workspace_id).modified_at) db.heads.set(row.workspace_id, structuredClone(row));
              inserted.push({ workspace_id: row.workspace_id, revision_id: row.revision_id });
            }
            const data = options.returning ? (db.acknowledgments ? db.acknowledgments(rows, inserted) : inserted) : null;
            return { data, error: null };
          }
        };
        return builder;
      }
    }; }
  };
  return db;
}
function client(db, user = 'account', stats) {
  const exports = {};
  vm.runInNewContext(source, { exports, process, Uint8Array, Map, Set, crypto, TextEncoder, TextDecoder, AbortController,
    require(name) {
      if (name === '@supabase/supabase-js') return { createClient: () => db.api };
      if (name === './cloud-records' && stats) {
        const cloudRecords = baseRequire(name);
        return { ...cloudRecords, canonicalRecord(value) { stats.canonicalRecordCalls = (stats.canonicalRecordCalls || 0) + 1; return cloudRecords.canonicalRecord(value); } };
      }
      if (name === './snapshot-validation' && stats) {
        const validation = baseRequire(name);
        return { ...validation, validateSnapshot(value, category, operation) {
          if (category === 'record' && operation === 'import') stats.recordValidationCalls = (stats.recordValidationCalls || 0) + 1;
          return validation.validateSnapshot(value, category, operation);
        } };
      }
      if (name === './workspace-revision' && stats) {
        const revisions = baseRequire(name);
        return { ...revisions, serializeWorkspaceRecord(value) {
          stats.serializationCalls = (stats.serializationCalls || 0) + 1;
          return revisions.serializeWorkspaceRecord(value);
        } };
      }
      if (name === './performance-diagnostics' && stats) {
        return { recordPerformance(service, metric) {
          (stats.localFailureCategories ||= []).push([service, metric]);
        } };
      }
      return baseRequire(name);
    }
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
test('unchanged workspace revisions reuse the validated canonical snapshot', async () => {
  const db = server(), stats = {};
  await seed(db, record()); const c = client(db, 'account', stats);
  const first = await c.load(signal()), validationCalls = stats.recordValidationCalls, normalizationCalls = stats.canonicalRecordCalls;
  const cachedBytes = c.canonicalWorkspaceSnapshots.get('w').bytes;
  assert.equal(c.sent.get('w'), cachedBytes, 'the restore bookkeeping reuses the trusted canonical bytes');
  const serializationCalls = stats.serializationCalls;
  const second = await c.load(signal());
  assert.deepEqual(JSON.parse(JSON.stringify(second.records)), JSON.parse(JSON.stringify(first.records)));
  assert.equal(stats.recordValidationCalls, validationCalls, 'matching canonical bytes bypass repeated snapshot validation');
  assert.equal(stats.canonicalRecordCalls, normalizationCalls, 'matching revisions bypass repeated record normalization');
  assert.equal(stats.serializationCalls, serializationCalls + 1, 'the second restore only serializes the returned row for revision verification');
  assert.equal(c.sent.get('w'), cachedBytes, 'the same validated byte buffer is reused after the second restore');
});
test('a changed revision invalidates the cached snapshot and follows normal validation', async () => {
  const db = server(), stats = {};
  await seed(db, record()); const c = client(db, 'account', stats); await c.load(signal());
  const previousValidationCalls = stats.recordValidationCalls, previousNormalizationCalls = stats.canonicalRecordCalls;
  const newRevision = await seed(db, record(4));
  const restored = await c.load(signal());
  assert.equal(restored.records[0].name, 'Workspace 4');
  assert.equal(stats.recordValidationCalls, previousValidationCalls + 1);
  assert.equal(stats.canonicalRecordCalls, previousNormalizationCalls + 1);
  assert.equal(c.canonicalWorkspaceSnapshots.get('w').revisionId, newRevision);
});
test('malformed payloads with a reused revision invalidate the cache and retain validation diagnostics', async () => {
  snapshotDiagnostics.reset();
  const db = server(), stats = {};
  await seed(db, record()); const c = client(db, 'account', stats); await c.load(signal());
  const previousCalls = stats.recordValidationCalls;
  db.heads.get('w').record = { ...canonicalRecord(record()), state: { cards: 'malformed' } };
  const restored = await c.load(signal());
  assert.equal(restored.records.length, 0);
  assert.equal(stats.recordValidationCalls, previousCalls + 1, 'changed bytes under the same revision return to full validation');
  assert.equal(c.canonicalWorkspaceSnapshots.has('w'), false);
  assert.equal(Object.values(snapshotDiagnostics.snapshot().failures).reduce((sum, count) => sum + count, 0), 1);
});
test('stale workspace identities and a new account do not reuse cached snapshots', async () => {
  const db = server(), firstStats = {}, secondStats = {};
  await seed(db, record()); const first = client(db, 'account', firstStats); await first.load(signal());
  db.heads.get('w').record = { ...canonicalRecord(record()), id: 'stale-workspace-id' };
  const stale = await first.load(signal());
  assert.equal(stale.records.length, 0);
  assert.equal(first.canonicalWorkspaceSnapshots.has('w'), false);
  assert.ok(firstStats.recordValidationCalls >= 3, 'stale identity is checked by the ordinary validator');

  db.heads.get('w').record = canonicalRecord(record());
  const otherAccount = client(db, 'other-account', secondStats), restored = await otherAccount.load(signal());
  assert.equal(restored.records.length, 1);
  assert.equal(secondStats.recordValidationCalls, 1, 'a new account-scoped sync instance validates instead of sharing cache state');
});
test('a restore that no longer verifies a workspace head drops its cached snapshot', async () => {
  const db = server(); await seed(db, record()); const c = client(db);
  await c.load(signal()); assert.equal(c.canonicalWorkspaceSnapshots.has('w'), true);
  db.heads.delete('w');
  const restored = await c.load(signal());
  assert.equal(restored.records.length, 0);
  assert.equal(c.canonicalWorkspaceSnapshots.has('w'), false);
});
test('delayed older tab fetches and merges newer head before retry', async () => {
  const db = server(); await seed(db, record()); const a = client(db), b = client(db); await a.load(signal()); await b.load(signal());
  await save(a, record(4)); const newest = db.heads.get('w').revision_id; await save(b, record(2));
  assert.equal(db.heads.get('w').revision_id, newest); assert.equal(db.writes.at(-1)[0].expected_revision_id, newest);
  assert.equal(db.writes.at(-1)[0].record.name, 'Workspace 4'); assert.equal(b.takeMergedRecords()[0].name, 'Workspace 4');
  const count = db.writes.length; await save(b, record(2)); assert.equal(db.writes.length, count + 1, 'the ignored duplicate revision remains pending without a returned acknowledgment');
  await save(b, record(3)); assert.equal(db.heads.get('w').revision_id, newest);
});
test('newer local edit uses existing merge rule after conflict', async () => {
  const db = server(); await seed(db, record()); const c = client(db); await c.load(signal()); const remote = await seed(db, record(2));
  await save(c, record(3)); assert.equal(db.writes.at(-1)[0].expected_revision_id, remote); assert.equal(db.heads.get('w').record.name, 'Workspace 3');
});
test('conflict response matching preserves response order, ignores missing batch IDs, and deduplicates returned IDs', async () => {
  const db = server();
  for (const id of ['a', 'b', 'c', 'outside']) await seed(db, record(1, id));
  const c = client(db); await c.load(signal());
  const priorASent = c.sent.get('a'), priorBSent = c.sent.get('b');
  await seed(db, record(5, 'a')); await seed(db, record(6, 'b'));
  db.readResult = () => ({ data: [db.heads.get('b'), db.heads.get('outside'), db.heads.get('b'), db.heads.get('a')], error: null });

  await save(c, ['c', 'a', 'b'].map(id => record(2, id)));

  assert.equal(db.writes.length, 2, 'one conflict response is followed by one successful retry');
  assert.deepEqual(db.writes[1].map(row => row.workspace_id), ['a', 'b', 'c']);
  assert.equal(JSON.stringify([...c.conflictRecords.keys()]), JSON.stringify(['b', 'a']), 'matched conflict rows retain first response order');
  assert.equal(JSON.stringify(c.takeMergedRecords().map(value => [value.id, value.name])), JSON.stringify([
    ['a', 'Workspace 5'], ['b', 'Workspace 6']
  ]), 'reordered conflict rows merge in submitted batch order; an absent c row has no remote conflict');
  assert.equal(c.sent.get('a'), priorASent, 'an ignored duplicate revision is not synchronized without a returned row');
  assert.equal(c.sent.get('b'), priorBSent, 'the other ignored duplicate remains pending too');
  assert.equal(c.observed.get('a'), db.heads.get('a').revision_id, 'the fetched cloud head remains a valid conditional-write base');
  assert.equal(c.observed.get('b'), db.heads.get('b').revision_id);
  assert.equal(c.sent.has('c'), true, 'the newly inserted sibling with a returned row is acknowledged');
});
test('duplicate submitted workspace IDs remain pending while unique siblings are acknowledged', async () => {
  const db = server(), c = client(db);
  await save(c, [record(4, 'duplicate'), record(2, 'duplicate'), record(3, 'other')]);
  assert.deepEqual(db.writes[0].map(row => row.workspace_id), ['duplicate', 'duplicate', 'other']);
  assert.equal(JSON.stringify(c.takeMergedRecords()), '[]', 'the duplicate lookup uses the same first matching submission as Array.find');
  assert.equal(c.sent.has('duplicate'), false, 'duplicate workspace submissions are ambiguous even when returned');
  assert.equal(c.sent.has('other'), true);
  await save(c, [record(4, 'duplicate'), record(2, 'duplicate'), record(3, 'other')]);
  assert.deepEqual(db.writes.at(-1).map(row => row.workspace_id), ['duplicate', 'duplicate'], 'only the unacknowledged workspace is sent in the next save cycle');
});
test('partial, duplicate, and mismatched acknowledgments update only confirmed workspace IDs', async () => {
  const db = server(), c = client(db), records = ['confirmed', 'omitted', 'duplicated', 'mismatched'].map(id => record(2, id));
  db.acknowledgments = (_submitted, inserted) => {
    const confirmed = inserted.find(row => row.workspace_id === 'confirmed');
    const duplicated = inserted.find(row => row.workspace_id === 'duplicated');
    return [confirmed, duplicated, duplicated, { workspace_id: 'mismatched', revision_id: 'wrong-revision' }].filter(Boolean);
  };
  await save(c, records);

  assert.equal(c.sent.has('confirmed'), true);
  for (const id of ['omitted', 'duplicated', 'mismatched']) assert.equal(c.sent.has(id), false, `${id} remains unsynchronized`);
  assert.equal(c.observed.has('confirmed'), true);
  for (const id of ['omitted', 'duplicated', 'mismatched']) assert.equal(c.observed.has(id), false);

  db.acknowledgments = null;
  await save(c, records);
  assert.deepEqual(db.writes.at(-1).map(row => row.workspace_id), ['duplicated', 'mismatched', 'omitted']);
  assert.equal(c.sent.has('confirmed'), true, 'confirmed workspace is not resent');
  for (const id of ['omitted', 'duplicated', 'mismatched']) assert.equal(c.sent.has(id), false);
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
  await assert.rejects(save(c, record()), /another device/); assert.equal(db.writes.length, 2); assert.equal(c.hasPendingUploads, true);
  const d = server(), other = client(d); d.failures = [{ code: '42501' }]; await assert.rejects(save(other, record()), error => error.code === '42501'); assert.equal(d.writes.length, 1);
});
test('a second conflict leaves the local revision pending without another rebase read', async () => {
  const db = server(), c = client(db);
  const originalRevision = await seed(db, record());
  await c.load(signal());
  const initialSnapshot = c.sent.get('w');
  await seed(db, record(2));
  let conflictReads = 0, writes = 0, fetchedRevision = '';
  db.onRead = async options => {
    if (!options.select && options.after === undefined && options.through === undefined) {
      conflictReads++;
      if (conflictReads === 1) fetchedRevision = await seed(db, record(3));
    }
  };
  db.onWrite = async () => {
    writes++;
    if (writes === 2) await seed(db, record(5));
  };

  await assert.rejects(save(c, record(4)), /another device/);

  assert.equal(writes, 2, 'one initial write and one retry are attempted');
  assert.equal(conflictReads, 1, 'a conflict on the retry does not trigger another read/merge cycle');
  assert.equal(c.observed.get('w'), fetchedRevision, 'the fetched revision remains the retry base');
  assert.notEqual(c.observed.get('w'), originalRevision);
  assert.equal(c.sent.get('w'), initialSnapshot, 'the unacknowledged local payload remains pending');
  assert.equal(c.hasPendingUploads, true);
  assert.equal(db.heads.get('w').record.name, 'Workspace 5', 'the competing writer remains untouched');
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
test('workspace restoration releases raw provider rows before requesting the next bounded page', async () => {
  const db = server(); seedWorkspaceRange(db, 205);
  let firstRawPage;
  db.readResult = options => {
    if (!options.through || options.after !== undefined) return null;
    firstRawPage = [...db.heads.values()]
      .filter(row => row.workspace_id <= options.through)
      .sort((a, b) => a.workspace_id < b.workspace_id ? -1 : a.workspace_id > b.workspace_id ? 1 : 0)
      .slice(0, 100);
    return { data: firstRawPage, error: null };
  };
  db.onRead = options => {
    if (options.after === 'w-00099') assert.equal(firstRawPage.length, 0, 'the previous raw page must be released before the next request starts');
  };

  const result = await client(db).load(signal());
  assert.equal(firstRawPage.length, 0);
  assert.equal(result.records.length, 205);
  assert.equal(result.records[0].id, 'w-00000');
  assert.equal(result.records.at(-1).id, 'w-00204');
  assert.equal(db.requests.length, 4, 'the fixed cursor continues through the expected bounded pages');
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
  for (const failure of ['error', 'duplicate']) {
    const db = server(); seedWorkspaceRange(db, 150); const c = client(db);
    db.readResult = options => options.after ? failure === 'error'
      ? { data: null, error: Error('page failed') }
      : { data: [{ workspace_id: failure === 'duplicate' ? 'w-00000' : 'wrong', revision_id: 'bad', record: record(1, 'w-00000') }], error: null } : null;
    await assert.rejects(c.load(signal()), /page failed|invalid cursor/);
    assert.equal(c.observed.size, 0); assert.equal(c.sent.size, 0);
  }
});
test('workspace cursor pages must advance strictly and stay within the captured high-water mark', async () => {
  const cases = [
    ['repeated prior key', options => options.after ? [{ workspace_id: 'w-00000', revision_id: 'repeated', record: record(1, 'w-00000') }] : null],
    ['descending page key', options => options.after ? [
      { workspace_id: 'w-00101', revision_id: 'later', record: record(1, 'w-00101') },
      { workspace_id: 'w-00100', revision_id: 'earlier', record: record(1, 'w-00100') }
    ] : null],
    ['key beyond high-water mark', options => options.after ? [{ workspace_id: 'z-new', revision_id: 'new', record: record(1, 'z-new') }] : null]
  ];
  for (const [label, malformedPage] of cases) {
    const db = server(); seedWorkspaceRange(db, 150);
    const stats = {}, c = client(db, 'account', stats);
    await c.load(signal());
    const localRevision = c.observed.get('w-00000'), localSnapshot = c.sent.get('w-00000');
    db.readResult = options => {
      if (options.after === 'w-00099') {
        const rows = malformedPage(options);
        return rows ? { data: rows, error: null } : null;
      }
      return null;
    };
    await assert.rejects(c.load(signal()), /invalid cursor/, label);
    assert.equal(c.observed.get('w-00000'), localRevision, `${label}: observed local revision is retained`);
    assert.equal(c.sent.get('w-00000'), localSnapshot, `${label}: acknowledged local snapshot is retained`);
    assert.deepEqual(stats.localFailureCategories, [['cloud', 'cursor_failures']], `${label}: only the bounded cursor-failure category is recorded`);
  }
});
test('cancellation between workspace pages stops before another page is sent', async () => {
  const db = server(); seedWorkspaceRange(db, 300); const c = client(db), controller = new AbortController();
  db.onRead = async options => { if (options.after) controller.abort(); };
  await assert.rejects(c.load(controller.signal), /canceled/);
  assert.equal(db.requests.length, 3); assert.equal(c.observed.size, 0);
});


test('malformed snapshots at every batch position keep local copies and restore valid siblings', async () => {
  for (const position of [0, 75, 149]) {
    snapshotDiagnostics.reset();
    const db = server(); seedWorkspaceRange(db, 150);
    const id = `w-${String(position).padStart(5, '0')}`, local = record(2, id);
    db.heads.get(id).record = { ...record(4, id), name: 'PRIVATE BAD PAYLOAD', state: { cards: 'invalid' } };
    const c = client(db), restored = await c.load(signal());
    assert.equal(restored.records.length, 149);
    assert.equal(restored.records.some(r => r.id === id), false);
    assert.deepEqual(mergeRecords([local], restored.records).find(r => r.id === id), canonicalRecord(local));
    assert.equal(c.sent.has(id), false, 'invalid bytes are not acknowledged');
    assert.equal(c.observed.get(id), `revision-${position}`, 'only envelope identity is retained for conditional writes');
    assert.equal(c.conflictRecords.has(id), false);
    const diagnostic = snapshotDiagnostics.snapshot();
    assert.equal(Object.values(diagnostic.failures).reduce((a,b) => a+b, 0), 1);
    assert.equal(JSON.stringify(diagnostic).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(diagnostic).includes(id), false);
  }
});
test('an entirely malformed page does not end cursor traversal or replace local recovery', async () => {
  const db = server(); seedWorkspaceRange(db, 201);
  for (const [id, row] of [...db.heads].slice(0,100)) row.record = { id, name: 'sensitive' };
  const result = await client(db).load(signal());
  assert.equal(result.records.length, 101); assert.equal(result.records[0].id, 'w-00100');
  assert.equal(db.requests.length, 4);
});
test('identity mismatches and missing revision metadata skip only their row', async () => {
  const db = server(); seedWorkspaceRange(db, 3);
  db.heads.get('w-00000').record.id = 'different';
  delete db.heads.get('w-00001').revision_id;
  const c = client(db), result = await c.load(signal());
  assert.deepEqual(Array.from(result.records, r => r.id), ['w-00002']);
  assert.equal(c.observed.has('w-00001'), false);
  assert.equal(c.sent.size, 1);
});
test('a malformed conflict head cannot poison valid local snapshots or its batch siblings', async () => {
  const db = server(); seedWorkspaceRange(db, 2);
  db.heads.get('w-00000').record = { id: 'w-00000', state: { cards: 'bad' } };
  const c = client(db);
  const local = record(5, 'w-00000'), good = record(5, 'w-00001');
  await save(c, [local, good]);
  assert.deepEqual(db.writes.at(-1).map(row => row.record.name), ['Workspace 5','Workspace 5']);
  assert.equal(c.takeMergedRecords().length, 0);
  assert.equal(c.conflictRecords.has('w-00000'), false);
});

test('a normalization failure is isolated and contains no exception text in diagnostics', async () => {
  const db = server(); seedWorkspaceRange(db, 3);
  const module = baseRequire('./cloud-records.ts'), normalize = module.canonicalRecord;
  snapshotDiagnostics.reset();
  module.canonicalRecord = value => {
    if (value.id === 'w-00001') throw Error('PRIVATE NORMALIZATION DETAIL');
    return normalize(value);
  };
  try {
    const result = await client(db).load(signal());
    assert.deepEqual(Array.from(result.records, r => r.id), ['w-00000','w-00002']);
    assert.equal(JSON.stringify(snapshotDiagnostics.snapshot()).includes('PRIVATE'), false);
  } finally { module.canonicalRecord = normalize; }
});
test('Mac workspace merging retains the local copy omitted by row validation', () => {
  const c = nativeConflictQueue(() => ({})), local = record(2, 'bad'), good = record(1, 'good');
  const merged = c.context.mergeWorkspaceRecords([local,good], [record(4,'good')]);
  assert.equal(merged.find(r => r.id === 'bad'), local);
  assert.equal(merged.find(r => r.id === 'good').name, 'Workspace 4');
});
