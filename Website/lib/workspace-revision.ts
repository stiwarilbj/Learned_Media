import type { CloudRecord } from './cloud-records';

/** Account-scoped identity for the exact snapshot, stable across retries/reloads. */
export async function workspaceRevisionId(userId: string, record: CloudRecord): Promise<string> {
  const input = JSON.stringify(['workspace-revision-v1', userId.toLowerCase(), record], (_key, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))).slice(0, 16);
  // UUIDv8 reserves application-defined bits; keep the standard UUID variant.
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
