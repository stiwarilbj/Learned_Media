import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountKeys, KeyProvider } from './account-credentials';
import { canonicalRecord, safeMemory, type CloudRecord } from './cloud-records';
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
  constructor(readonly userId: string) {}
  async load(signal: AbortSignal) {
    const api = cloudClient();
    const loadMemoryPage = (from: number) => api.from('fact_memory').select('content,known,fingerprint').eq('user_id', this.userId).order('fact_id').range(from, from + 499).abortSignal(signal);
    // Start both independent reads together, keeping later pages sequential.
    const [revisionResult, firstMemoryPage] = await Promise.all([
      api.rpc('latest_workspace_revisions').abortSignal(signal),
      loadMemoryPage(0),
    ]);
    const { data, error } = revisionResult as { data: Array<{ record: CloudRecord }> | null; error: any };
    if (error) throw error;
    const records = (data || []).map((row: any) => canonicalRecord(row.record)) as CloudRecord[];
    const factMemory: FactMemory[] = [];
    for (let from = 0; ; from += 500) {
      const result = (from === 0 ? firstMemoryPage : await loadMemoryPage(from)) as { data: Array<{ content: Record<string, any>; known: boolean; fingerprint?: string }> | null; error: any };
      if (result.error) throw result.error;
      factMemory.push(...(result.data || []).map(row => ({ ...row.content, fingerprint: row.fingerprint || row.content.fingerprint, known: row.known }) as FactMemory));
      if ((result.data || []).length < 500) break;
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
    const pending = store.records.map(value => {
      const record = canonicalRecord(value), serialized = JSON.stringify(record);
      const row = { revision_id: crypto.randomUUID(), user_id: this.userId, workspace_id: record.id, modified_at: record.updatedAt, record };
      return { record, serialized, row };
    }).filter(item => this.sent.get(item.record.id) !== item.serialized);
    for (let offset = 0; offset < pending.length;) {
      const batch: typeof pending = [];
      let bytes = 2;
      while (offset < pending.length && batch.length < 20) {
        const item = pending[offset];
        const size = encoder.encode(JSON.stringify(item.row)).byteLength + (batch.length ? 1 : 0);
        if (batch.length && bytes + size > 1024 * 1024) break;
        batch.push(item); bytes += size; offset += 1;
      }
      const { error } = await api.from('workspace_revisions').insert(batch.map(item => item.row)).abortSignal(signal);
      if (error) throw error;
      // Keep failed/later batches dirty and acknowledge the exact uploaded versions.
      batch.forEach(item => this.sent.set(item.record.id, item.serialized));
    }
    const changed = (store.factMemory || []).map(safeMemory).filter(item => this.memories.get(item.fingerprint || item.id) !== JSON.stringify(item));
    for (let offset = 0; offset < changed.length; offset += 100) {
      const batch = changed.slice(offset, offset + 100);
      const { error } = await api.rpc('remember_facts', { items: batch }).abortSignal(signal);
      if (error) throw error;
      batch.forEach(item => this.memories.set(item.fingerprint || item.id, JSON.stringify(item)));
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
