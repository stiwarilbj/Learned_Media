import { backgroundCloudFetch } from './background-retry';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountKeys, KeyProvider } from './account-credentials';
import { canonicalRecord, mergeRecords, safeMemory, type CloudRecord } from './cloud-records';
import { serializeWorkspaceRecord, workspaceRevisionIdFromSerialization, workspaceRevisionRowByteLength } from './workspace-revision';
import { LatestSnapshotQueue } from './latest-snapshot-queue';
import type { FactMemory } from './fact-quality';
import type { Database } from './supabase/database.types';
import { assertSnapshot, validateSnapshot } from './snapshot-validation';
import { recordPerformance } from './performance-diagnostics';

function sameBytes(previous: Uint8Array | undefined, next: Uint8Array) {
  if (!previous || previous.byteLength !== next.byteLength) return false;
  for (let index = 0; index < next.byteLength; index += 1) if (previous[index] !== next[index]) return false;
  return true;
}
const workspaceDecoder = new TextDecoder();
type CachedWorkspaceSnapshot = { revisionId: string; bytes: Uint8Array };
function invalidWorkspaceCursor() {
  // Keep diagnostics aggregate-only: never retain workspace IDs or page data.
  recordPerformance('cloud', 'cursor_failures');
  return new Error('Cloud workspace history returned an invalid cursor.');
}

// Public client configuration; authorization is enforced by RLS, never by this key.
export const CLOUD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ignafizdnpjludnvqkjz.supabase.co';
export const CLOUD_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PyviIi5NadM-SswSlJBuVg_UugoFxEe';
let client: SupabaseClient<Database> | undefined;
export function cloudClient() {
  return client ??= createClient<Database>(CLOUD_URL, CLOUD_PUBLIC_KEY, { global: { fetch: backgroundCloudFetch }, auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}
export async function googleSignIn() {
  const response = await fetch(CLOUD_URL + '/auth/v1/settings', { headers: { apikey: CLOUD_PUBLIC_KEY } });
  const settings = await response.json();
  if (!response.ok || !settings.external?.google) throw new Error('Google sign-in is not enabled yet. The project owner must configure Google OAuth in Supabase. Your work remains saved locally.');
  const { error } = await cloudClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export type CloudAccount = Pick<User, 'id' | 'email' | 'user_metadata'>;
type CloudSnapshot = { ownerId?: string; records: CloudRecord[]; factMemory?: FactMemory[] };
export class WorkspaceCloudSync {
  private sent = new Map<string, Uint8Array>();
  private observed = new Map<string, string>();
  private canonicalWorkspaceSnapshots = new Map<string, CachedWorkspaceSnapshot>();
  private conflictRecords = new Map<string, CloudRecord>();
  private merged = new Map<string, CloudRecord>();
  takeMergedRecords() { const records = [...this.merged.values()]; this.merged.clear(); return records; }
  private memories = new Map<string, string>();
  private trackedMemory: FactMemory[] | undefined;
  private memoryById = new Map<string, FactMemory>();
  private changedMemoryIds = new Set<string>();
  private uploads = new LatestSnapshotQueue<{ store: CloudSnapshot; signal: AbortSignal }>(
    ({ store, signal }) => this.saveSnapshot(store, signal)
  );
  constructor(readonly userId: string) {}
  get hasPendingUploads() { return this.uploads.hasUnacknowledged; }
  get isUploading() { return this.uploads.isWriting; }
  markFactMemoriesChanged(previous: FactMemory[], next: FactMemory[], ids: Set<string>) {
    // An unknown replacement (import/recovery) must take the full comparison path.
    if (this.trackedMemory !== previous) return;
    const retained = new Set(next.map(item => item.id));
    for (const id of this.memoryById.keys()) if (!retained.has(id)) {
      this.memoryById.delete(id);
      this.changedMemoryIds.delete(id);
    }
    for (const item of next) if (ids.has(item.id)) {
      this.memoryById.set(item.id, item);
      this.changedMemoryIds.add(item.id);
    }
    this.trackedMemory = next;
  }
  private decodedWorkspaceRecord(row: { workspace_id: string; revision_id?: string; record: unknown }): CloudRecord | undefined {
    const revisionId = typeof row.revision_id === 'string' && row.revision_id ? row.revision_id : undefined;
    if (!revisionId) this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
    let cacheable = Boolean(revisionId);
    const cached = this.canonicalWorkspaceSnapshots.get(row.workspace_id);
    if (cached && revisionId) {
      if (cached.revisionId !== revisionId) this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
      else {
        // A matching revision is reusable only when the returned payload still
        // has the exact canonical bytes previously validated for that revision.
        let returnedBytes: Uint8Array | undefined;
        try { returnedBytes = serializeWorkspaceRecord(row.record as CloudRecord).bytes; }
        catch { /* Let the existing snapshot validator report malformed data. */ }
        if (returnedBytes && sameBytes(cached.bytes, returnedBytes)) {
          try { return JSON.parse(workspaceDecoder.decode(cached.bytes)) as CloudRecord; }
          catch { /* Discard an unreadable cache entry and take the normal path. */ }
        }
        this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
        cacheable = false;
      }
    }
    if (!validateSnapshot(row.record, 'record', 'import')) {
      this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
      return;
    }
    if ((row.record as CloudRecord).id !== row.workspace_id) {
      this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
      validateSnapshot(null, 'record', 'import');
      return;
    }
    try {
      const record = canonicalRecord(row.record as CloudRecord);
      if (cacheable && revisionId) {
        const bytes = serializeWorkspaceRecord(record).bytes;
        this.canonicalWorkspaceSnapshots.set(row.workspace_id, { revisionId, bytes });
      }
      return record;
    } catch {
      this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
      validateSnapshot(null, 'record', 'import');
    }
  }
  private async loadWorkspaceRevisions(signal: AbortSignal) {
    const api = cloudClient();
    const checkCancellation = () => { if (signal.aborted) throw new Error('Cloud load was canceled.'); };
    checkCancellation();
    // The RPC returns one head per stable workspace ID. Revision IDs change on
    // every save and must never be used as workspace pagination cursors.
    const boundary = await api.rpc('latest_workspace_revisions').select('workspace_id')
      .order('workspace_id', { ascending: false }).limit(1).abortSignal(signal);
    if (boundary.error) throw boundary.error;
    checkCancellation();
    if (!Array.isArray(boundary.data) || boundary.data.length > 1) throw new Error('Cloud workspace history returned an invalid cursor.');
    if (!boundary.data.length) {
      this.canonicalWorkspaceSnapshots.clear();
      return { records: [] as CloudRecord[], heads: new Map<string, string>() };
    }
    const through = boundary.data[0]?.workspace_id;
    if (typeof through !== 'string' || !through) throw new Error('Cloud workspace history returned an invalid cursor.');
    const records: CloudRecord[] = [], heads = new Map<string, string>();
    let after: string | null = null;
    while (true) {
      checkCancellation();
      let query = api.rpc('latest_workspace_revisions').lte('workspace_id', through);
      if (after !== null) query = query.gt('workspace_id', after);
      const result = await query.order('workspace_id', { ascending: true }).limit(100).abortSignal(signal);
      if (result.error) throw result.error;
      checkCancellation();
      if (!Array.isArray(result.data) || result.data.length > 100) throw new Error('Cloud workspace history returned an invalid page.');
      const pageRows = result.data;
      const pageLength = pageRows.length;
      let pageCursor: string | null = after;
      try {
        for (const row of pageRows) {
          const workspaceId = row?.workspace_id;
          if (typeof workspaceId !== 'string' || !workspaceId
            || (pageCursor !== null && workspaceId <= pageCursor) || workspaceId > through) {
            throw invalidWorkspaceCursor();
          }
          pageCursor = workspaceId;
          if (typeof row.revision_id !== 'string' || !row.revision_id) {
            this.canonicalWorkspaceSnapshots.delete(workspaceId);
            validateSnapshot(null, 'record', 'import');
            continue;
          }
          // Keep only trusted envelope identity for conditional writes. Invalid
          // snapshot bytes never enter restored records or acknowledged content.
          heads.set(workspaceId, row.revision_id);
          const record = this.decodedWorkspaceRecord(row);
          if (record) records.push(record);
        }
      } finally {
        // The validated CloudRecords and revision heads above are the only page
        // data needed for the final merge. Release the raw provider rows before
        // issuing another bounded request.
        pageRows.length = 0;
      }
      if (pageLength < 100 || pageCursor === through) break;
      if (pageCursor === null || pageCursor === after) throw invalidWorkspaceCursor();
      after = pageCursor;
    }
    // The full cursor traversal is the revision verification boundary for this
    // restore. Drop snapshots for workspaces that no longer have a verified head.
    for (const workspaceId of this.canonicalWorkspaceSnapshots.keys()) {
      if (!heads.has(workspaceId)) this.canonicalWorkspaceSnapshots.delete(workspaceId);
    }
    return { records, heads };
  }
  async load(signal: AbortSignal) {
    const api = cloudClient();
    const loadMemoryPage = (after: string | null) => {
      let query = api.from('fact_memory').select('fact_id,content,known,fingerprint').eq('user_id', this.userId);
      if (after !== null) query = query.gt('fact_id', after);
      return query.order('fact_id', { ascending: true }).limit(500).abortSignal(signal);
    };
    // Start both independent reads together, keeping later pages sequential.
    const [revisionResult, firstMemoryPage] = await Promise.all([
      this.loadWorkspaceRevisions(signal),
      loadMemoryPage(null),
    ]);
    const { records, heads } = revisionResult;
    const factMemory: FactMemory[] = [];
    let after: string | null = null;
    while (true) {
      const result: Awaited<ReturnType<typeof loadMemoryPage>> = after === null ? firstMemoryPage : await loadMemoryPage(after);
      if (result.error) throw result.error;
      const rows: Pick<Database['public']['Tables']['fact_memory']['Row'], 'fact_id' | 'content' | 'known' | 'fingerprint'>[] = result.data || [];
      const page = rows.map(row => ({ ...row.content, fingerprint: row.fingerprint || row.content?.fingerprint, known: row.known }) as FactMemory);
      assertSnapshot(page, 'memory', 'import');
      factMemory.push(...page);
      if (rows.length < 500) break;
      // Use the immutable database key, not content.id or mutable fact fields.
      // The same database ordering and exclusive boundary apply on every page.
      const next = rows[rows.length - 1].fact_id;
      if (typeof next !== 'string' || next === after) throw new Error('Cloud fact history returned an invalid cursor.');
      after = next;
    }
    if (signal.aborted) throw new Error('Cloud load was canceled.');
    for (const [id, revision] of heads) {
      this.observed.set(id, revision);
      this.conflictRecords.delete(id);
    }
    for (const record of records) {
      const cached = this.canonicalWorkspaceSnapshots.get(record.id);
      const bytes = cached && cached.revisionId === heads.get(record.id)
        ? cached.bytes
        : serializeWorkspaceRecord(record).bytes;
      this.sent.set(record.id, bytes);
    }
    for (const memory of factMemory) this.memories.set(memory.fingerprint || memory.id, JSON.stringify(safeMemory(memory)));
    return { records, factMemory };
  }
  save(store: CloudSnapshot, signal: AbortSignal) {
    if (store.ownerId !== this.userId || signal.aborted) return Promise.reject(new Error('Account changed. Cloud save was canceled.'));
    // Store records are replaced/updated in place by the app. Capture their current
    // state references now; canonicalization only runs for snapshots actually sent.
    const snapshot = { ...store, records: store.records.map(record => ({ ...record, state: { ...record.state } })) };
    return this.uploads.enqueue({ store: snapshot, signal });
  }
  private async saveSnapshot(store: CloudSnapshot, signal: AbortSignal) {
    if (signal.aborted) throw new Error('Cloud save was canceled.');
    if (store.ownerId !== this.userId) throw new Error('Account changed. Cloud save was canceled.');
    for (const record of store.records) assertSnapshot(record, 'record', 'save');
    const api = cloudClient();
    // Bound both row count and payload size; a large workspace travels alone.
    const changedRecords = store.records.map(value => {
      const record = canonicalRecord(value);
      const serialization = serializeWorkspaceRecord(record);
      return { record, serialization };
    }).filter(item => !sameBytes(this.sent.get(item.record.id), item.serialization.bytes));
    // Always merge against conflicts already observed by this sync session. A queued
    // older snapshot must not reintroduce the state a previous conflict rejected.
    const pending = await Promise.all(changedRecords.sort((a, b) => a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0).map(async item => ({
      ...item, revisionId: await workspaceRevisionIdFromSerialization(this.userId, item.serialization)
    })));
    for (let offset = 0; offset < pending.length;) {
      const batch: typeof pending = [];
      let bytes = 2;
      while (offset < pending.length && batch.length < 20) {
        const item = pending[offset];
        const size = workspaceRevisionRowByteLength({ revision_id: item.revisionId, user_id: this.userId,
          workspace_id: item.record.id, modified_at: item.record.updatedAt,
          expected_revision_id: this.observed.get(item.record.id) ?? null }, item.serialization) + (batch.length ? 1 : 0);
        if (batch.length && bytes + size > 1024 * 1024) break;
        batch.push(item); bytes += size; offset += 1;
      }
      // Preserve Array.find's first-match behavior for duplicate workspace IDs.
      // The same index serves both conflict responses and save acknowledgments.
      const submittedById = new Map<string, (typeof batch)[number]>();
      for (const item of batch) if (!submittedById.has(item.record.id)) submittedById.set(item.record.id, item);
      let completed = false;
      let rebased = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted) throw new Error('Cloud save was canceled.');
        const prepared = await Promise.all(batch.map(async item => {
          const remote = this.conflictRecords.get(item.record.id);
          const record = remote ? mergeRecords([item.record], [remote])[0] : item.record;
          const serialization = record === item.record ? item.serialization : serializeWorkspaceRecord(record);
          const row = { revision_id: record === item.record ? item.revisionId : await workspaceRevisionIdFromSerialization(this.userId, serialization),
            user_id: this.userId, workspace_id: record.id, modified_at: record.updatedAt, record,
            expected_revision_id: this.observed.get(record.id) ?? null };
          return { row, serialization };
        }));
        const rows = prepared.map(item => item.row);
        if (signal.aborted) throw new Error('Cloud save was canceled.');
        // A conflicting remote workspace may be much larger than the submitted
        // one. Reapply the existing byte limit after resolving that conflict.
        const preparedCountByWorkspace = new Map<string, number>();
        for (const { row } of prepared) {
          preparedCountByWorkspace.set(row.workspace_id, (preparedCountByWorkspace.get(row.workspace_id) ?? 0) + 1);
        }
        const acknowledgmentCounts = new Map<string, number>();
        const acknowledgmentRevisions = new Map<string, string>();
        const ambiguousAcknowledgments = new Set<string>();
        let error: { code?: string; message?: string } | null = null;
        for (let index = 0; index < prepared.length;) {
          const upload: typeof rows = []; let size = 2;
          while (index < prepared.length) {
            const item = prepared[index], next = workspaceRevisionRowByteLength(item.row, item.serialization) + (upload.length ? 1 : 0);
            if (upload.length && size + next > 1024 * 1024) break;
            upload.push(item.row); size += next; index++;
          }
          const result = await api.from('workspace_revisions')
            .upsert(upload, { onConflict: 'revision_id', ignoreDuplicates: true })
            .select('workspace_id,revision_id').abortSignal(signal);
          if (result.error) { error = result.error; break; }
          if (!Array.isArray(result.data)) continue;
          const uploadRevisions = new Map<string, Set<string>>();
          for (const row of upload) {
            const revisions = uploadRevisions.get(row.workspace_id) ?? new Set<string>();
            revisions.add(row.revision_id);
            uploadRevisions.set(row.workspace_id, revisions);
          }
          for (const acknowledgment of result.data) {
            const workspaceId = acknowledgment?.workspace_id;
            if (typeof workspaceId !== 'string') continue;
            if (!uploadRevisions.has(workspaceId)) {
              if (preparedCountByWorkspace.has(workspaceId)) ambiguousAcknowledgments.add(workspaceId);
              continue;
            }
            const count = (acknowledgmentCounts.get(workspaceId) ?? 0) + 1;
            acknowledgmentCounts.set(workspaceId, count);
            const expectedRevisions = uploadRevisions.get(workspaceId)!;
            if (expectedRevisions.size !== 1 || typeof acknowledgment.revision_id !== 'string'
              || !expectedRevisions.has(acknowledgment.revision_id) || count !== 1) {
              ambiguousAcknowledgments.add(workspaceId);
              acknowledgmentRevisions.delete(workspaceId);
            } else {
              acknowledgmentRevisions.set(workspaceId, acknowledgment.revision_id);
            }
          }
        }
        if (error?.code === '40001') {
          // A save gets one rebase read and one retry. If that retry races again,
          // leave the snapshot dirty for a later sync pass instead of spinning.
          if (rebased) break;
          rebased = true;
          // The trigger rejects the entire batch atomically. Read only its current
          // heads and use the ordinary timestamp merge before trying again.
          const latest = await api.rpc('latest_workspace_revisions').abortSignal(signal);
          if (latest.error) throw latest.error;
          if (signal.aborted) throw new Error('Cloud save was canceled.');
          const seen = new Set<string>();
          for (const row of latest.data || []) {
            if (seen.has(row.workspace_id) || !submittedById.has(row.workspace_id)) continue;
            seen.add(row.workspace_id);
            if (typeof row.revision_id !== 'string' || !row.revision_id) {
              this.canonicalWorkspaceSnapshots.delete(row.workspace_id);
              validateSnapshot(null, 'record', 'import');
              continue;
            }
            this.observed.set(row.workspace_id, row.revision_id);
            const record = this.decodedWorkspaceRecord(row);
            if (record) this.conflictRecords.set(record.id, record);
            else this.conflictRecords.delete(row.workspace_id);
          }
          continue;
        }
        if (error) throw error;
        if (signal.aborted) throw new Error('Cloud save was canceled.');
        prepared.forEach(({ row, serialization }) => {
          const workspaceId = row.workspace_id;
          const submitted = submittedById.get(workspaceId)!;
          if (row.record.updatedAt > submitted.record.updatedAt) this.merged.set(row.workspace_id, row.record);
          if (preparedCountByWorkspace.get(workspaceId) !== 1 || acknowledgmentCounts.get(workspaceId) !== 1
            || ambiguousAcknowledgments.has(workspaceId) || acknowledgmentRevisions.get(workspaceId) !== row.revision_id) return;
          this.observed.set(workspaceId, row.revision_id);
          // Only confirmed IDs advance acknowledged revision and snapshot state.
          this.canonicalWorkspaceSnapshots.set(workspaceId, { revisionId: row.revision_id, bytes: serialization.bytes });
          this.sent.set(workspaceId, serialization.bytes);
        });
        completed = true;
        break;
      }
      if (!completed) throw new Error('This workspace changed on another device. Please retry syncing.');
    }
    const history = store.factMemory;
    if (this.trackedMemory !== history || !this.trackedMemory) {
      // Full comparison on first save, account restore, imports and recovery.
      this.memoryById = new Map((history || []).map(item => [item.id, item]));
      this.changedMemoryIds = new Set(this.memoryById.keys());
      this.trackedMemory = history;
    }
    const changed = [];
    for (const id of this.changedMemoryIds) {
      const value = this.memoryById.get(id);
      if (!value) { this.changedMemoryIds.delete(id); continue; }
      assertSnapshot([value], 'memory', 'save');
      const item = safeMemory(value);
      const key = item.fingerprint || item.id, serialized = JSON.stringify(item);
      if (this.memories.get(key) === serialized) { this.changedMemoryIds.delete(id); continue; }
      changed.push({ id, value, item, key, serialized });
    }
    for (let offset = 0; offset < changed.length; offset += 100) {
      const batch = changed.slice(offset, offset + 100);
      const { error } = await api.rpc('remember_facts', { items: batch.map(entry => entry.item) }).abortSignal(signal);
      if (error) throw error;
      batch.forEach(entry => {
        this.memories.set(entry.key, entry.serialized);
        // A new edit arriving during the request remains dirty.
        if (this.memoryById.get(entry.id) === entry.value) this.changedMemoryIds.delete(entry.id);
      });
    }
  }
}

/** Session SDK refreshes access tokens; RLS authorizes each provider row. */
export async function loadAccountKeys(userId: string, signal: AbortSignal): Promise<Partial<AccountKeys>> {
  const { data, error } = await cloudClient().from('account_credentials').select('provider,api_key').eq('user_id', userId).abortSignal(signal);
  if (error) throw error;
  const keys: Partial<AccountKeys> = {};
  for (const row of data || []) if (row.provider === 'gemini' || row.provider === 'youtube') keys[row.provider] = row.api_key;
  return keys;
}
export async function saveAccountKey(userId: string, provider: KeyProvider, value: string, signal: AbortSignal) {
  const { error } = await cloudClient().from('account_credentials').upsert({user_id: userId, provider, api_key: value}, {onConflict: 'user_id,provider'}).abortSignal(signal);
  if (error) throw error;
}
