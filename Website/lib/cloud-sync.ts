import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountKeys, KeyProvider } from './account-credentials';
import { canonicalRecord, safeMemory, type CloudRecord } from './cloud-records';
import { workspaceRevisionId } from './workspace-revision';
import type { FactMemory } from './fact-quality';
import type { Database } from './supabase/database.types';
// Public client configuration; authorization is enforced by RLS, never by this key.
export const CLOUD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ignafizdnpjludnvqkjz.supabase.co';
export const CLOUD_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PyviIi5NadM-SswSlJBuVg_UugoFxEe';
let client: SupabaseClient<Database> | undefined;
export function cloudClient() {
  return client ??= createClient<Database>(CLOUD_URL, CLOUD_PUBLIC_KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}
export async function googleSignIn() {
  const response = await fetch(CLOUD_URL + '/auth/v1/settings', { headers: { apikey: CLOUD_PUBLIC_KEY } });
  const settings = await response.json();
  if (!response.ok || !settings.external?.google) throw new Error('Google sign-in is not enabled yet. The project owner must configure Google OAuth in Supabase. Your work remains saved locally.');
  const { error } = await cloudClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export type CloudAccount = Pick<User, 'id' | 'email' | 'user_metadata'>;
export class WorkspaceCloudSync {
  private sent = new Map<string, string>();
  private memories = new Map<string, string>();
  private trackedMemory: FactMemory[] | undefined;
  private memoryById = new Map<string, FactMemory>();
  private changedMemoryIds = new Set<string>();
  constructor(readonly userId: string) {}
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
  async load(signal: AbortSignal) {
    const api = cloudClient();
    const loadMemoryPage = (after: string | null) => {
      let query = api.from('fact_memory').select('fact_id,content,known,fingerprint').eq('user_id', this.userId);
      if (after !== null) query = query.gt('fact_id', after);
      return query.order('fact_id', { ascending: true }).limit(500).abortSignal(signal);
    };
    // Start both independent reads together, keeping later pages sequential.
    const [revisionResult, firstMemoryPage] = await Promise.all([
      api.rpc('latest_workspace_revisions').abortSignal(signal),
      loadMemoryPage(null),
    ]);
    const { data, error } = revisionResult as { data: Array<{ record: CloudRecord }> | null; error: any };
    if (error) throw error;
    const records = (data || []).map((row: any) => canonicalRecord(row.record)) as CloudRecord[];
    const factMemory: FactMemory[] = [];
    let after: string | null = null;
    while (true) {
      const result: Awaited<ReturnType<typeof loadMemoryPage>> = after === null ? firstMemoryPage : await loadMemoryPage(after);
      if (result.error) throw result.error;
      const rows: Pick<Database['public']['Tables']['fact_memory']['Row'], 'fact_id' | 'content' | 'known' | 'fingerprint'>[] = result.data || [];
      factMemory.push(...rows.map(row => ({ ...row.content, fingerprint: row.fingerprint || row.content.fingerprint, known: row.known }) as FactMemory));
      if (rows.length < 500) break;
      // Use the immutable database key, not content.id or mutable fact fields.
      // The same database ordering and exclusive boundary apply on every page.
      const next = rows[rows.length - 1].fact_id;
      if (typeof next !== 'string' || next === after) throw new Error('Cloud fact history returned an invalid cursor.');
      after = next;
    }
    for (const record of records) this.sent.set(record.id, JSON.stringify(record));
    for (const memory of factMemory) this.memories.set(memory.fingerprint || memory.id, JSON.stringify(safeMemory(memory)));
    return { records, factMemory };
  }
  async save(store: { ownerId?: string; records: CloudRecord[]; factMemory?: FactMemory[] }, signal: AbortSignal) {
    if (store.ownerId !== this.userId) throw new Error('Account changed. Cloud save was canceled.');
    const api = cloudClient();
    // Bound both row count and payload size; a large workspace travels alone.
    const encoder = new TextEncoder();
    const changedRecords = store.records.map(value => {
      const record = canonicalRecord(value), serialized = JSON.stringify(record);
      return { record, serialized };
    }).filter(item => this.sent.get(item.record.id) !== item.serialized);
    const pending = await Promise.all(changedRecords.map(async ({ record, serialized }) => {
      const row = { revision_id: await workspaceRevisionId(this.userId, record), user_id: this.userId, workspace_id: record.id, modified_at: record.updatedAt, record };
      return { record, serialized, row };
    }));
    for (let offset = 0; offset < pending.length;) {
      const batch: typeof pending = [];
      let bytes = 2;
      while (offset < pending.length && batch.length < 20) {
        const item = pending[offset];
        const size = encoder.encode(JSON.stringify(item.row)).byteLength + (batch.length ? 1 : 0);
        if (batch.length && bytes + size > 1024 * 1024) break;
        batch.push(item); bytes += size; offset += 1;
      }
      const { error } = await api.from('workspace_revisions').upsert(batch.map(item => item.row), { onConflict: 'revision_id', ignoreDuplicates: true }).abortSignal(signal);
      if (error) throw error;
      // Keep failed/later batches dirty and acknowledge the exact uploaded versions.
      batch.forEach(item => this.sent.set(item.record.id, item.serialized));
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
