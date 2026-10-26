import type { CloudRecord } from './cloud-records';

export type SerializedWorkspaceRecord = {
  /** Recursively key-sorted UTF-8 JSON, matching the existing revision hash replacer. */
  readonly bytes: Uint8Array;
};

export type WorkspaceRevisionRowMetadata = {
  revision_id: string;
  user_id: string;
  workspace_id: string;
  modified_at: string;
};

const encoder = new TextEncoder();

/** Serialize once using the exact key ordering used by workspaceRevisionId. */
export function serializeWorkspaceRecord(record: CloudRecord): SerializedWorkspaceRecord {
  const json = JSON.stringify(record, (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
  return { bytes: encoder.encode(json) };
}

/** Exact UTF-8 size of a revision row without serializing its record again. */
export function workspaceRevisionRowByteLength(row: WorkspaceRevisionRowMetadata, record: SerializedWorkspaceRecord): number {
  const prefix = `{"revision_id":${JSON.stringify(row.revision_id)},"user_id":${JSON.stringify(row.user_id)},"workspace_id":${JSON.stringify(row.workspace_id)},"modified_at":${JSON.stringify(row.modified_at)},"record":`;
  return encoder.encode(prefix).byteLength + record.bytes.byteLength + 1;
}

/** Account-scoped identity for the exact snapshot, stable across retries/reloads. */
export async function workspaceRevisionIdFromSerialization(userId: string, record: SerializedWorkspaceRecord): Promise<string> {
  // The legacy preimage was JSON.stringify([version, user, record], stableReplacer).
  // Compose that same byte sequence around the already serialized record so no
  // second record serialization is needed.
  const prefix = encoder.encode(`${JSON.stringify(['workspace-revision-v1', userId.toLowerCase()]).slice(0, -1)},`);
  const suffix = encoder.encode(']');
  const input = new Uint8Array(prefix.byteLength + record.bytes.byteLength + suffix.byteLength);
  input.set(prefix, 0);
  input.set(record.bytes, prefix.byteLength);
  input.set(suffix, prefix.byteLength + record.bytes.byteLength);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', input)).slice(0, 16);
  // UUIDv8 reserves application-defined bits; keep the standard UUID variant.
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Backwards-compatible wrapper for callers without a prepared serialization. */
export function workspaceRevisionId(userId: string, record: CloudRecord): Promise<string> {
  return workspaceRevisionIdFromSerialization(userId, serializeWorkspaceRecord(record));
}
