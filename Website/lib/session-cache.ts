/** Conservative retained-size estimate; no JSON copy, and shared/cyclic objects count once. */
export function approximateCacheBytes(value: unknown, limit = Infinity): number {
  let bytes = 0;
  const seen = new WeakSet<object>();
  function visit(item: unknown, depth: number) {
    if (bytes > limit) return;
    if (typeof item === 'string') { bytes += 16 + item.length * 2; return; }
    if (!item || typeof item !== 'object') { bytes += 8; return; }
    if (seen.has(item)) return;
    seen.add(item);
    if (depth > 64) { bytes = limit + 1; return; }
    bytes += 32;
    if (ArrayBuffer.isView(item)) { bytes += item.byteLength; return; }
    if (item instanceof ArrayBuffer) { bytes += item.byteLength; return; }
    if (item instanceof Map) {
      for (const [key, entry] of item) { bytes += 32; visit(key, depth + 1); visit(entry, depth + 1); if (bytes > limit) break; }
    } else if (item instanceof Set || Array.isArray(item)) {
      for (const entry of item) { bytes += 8; visit(entry, depth + 1); if (bytes > limit) break; }
    } else {
      for (const key of Object.keys(item)) { bytes += 16 + key.length * 2; visit((item as Record<string, unknown>)[key], depth + 1); if (bytes > limit) break; }
    }
  }
  visit(value, 0);
  return bytes;
}

export type SessionCacheEntry<T> = { value: T; expiresAt: number; bytes: number };

/** Small bounded cache for results that are safe to reuse within one session. */
export class SessionCache<T> {
  private readonly entries = new Map<string, SessionCacheEntry<T>>();
  private bytes = 0;

  constructor(private readonly maxEntries = 100, private readonly ttlMs = 30 * 60 * 1000, private readonly maxBytes = 4 * 1024 * 1024) {}

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.remove(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()) {
    this.remove(key);
    for (const [id, entry] of this.entries) if (entry.expiresAt <= now) this.remove(id);
    const bytes = 96 + key.length * 2 + approximateCacheBytes(value, this.maxBytes);
    if (bytes > this.maxBytes || this.maxEntries <= 0 || this.ttlMs <= 0) return;
    this.entries.set(key, { value, expiresAt: now + this.ttlMs, bytes });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) this.remove(this.entries.keys().next().value!);
  }

  clear() { this.entries.clear(); this.bytes = 0; }
  get size() { return this.entries.size; }
  get approximateBytes() { return this.bytes; }
}

/** Cache scopes are one-way hashes so API keys never become cache keys. */
export function requestCacheScope(sessionId: string, apiKey: string) {
  return hashValue(`${sessionId}\u0000${apiKey}`);
}

export function requestCacheKey(scope: string, ...parts: unknown[]) {
  const value = JSON.stringify(parts);
  return `${scope}:${hashValue(value)}:${value.length}`;
}

function hashValue(value: string) {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (const character of value) {
    first = Math.imul(first ^ character.charCodeAt(0), 16777619);
    second = Math.imul(second ^ character.charCodeAt(0), 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export type RequestIdentity = { task: string; query?: string; topics?: unknown; filters?: unknown; context?: unknown };

/** Normalize user input only. IDs, source quotations and conversation data remain exact. */
export function canonicalRequestIdentity(identity: RequestIdentity) {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return ordered({ version: 1, ...identity, query: (identity.query ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim() });
}

/** Provider JSON is reusable only when it satisfies the requested structured shape. */
export function reusableStructuredValue(value: unknown, schema: Record<string, unknown>): boolean {
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case "OBJECT": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const object = value as Record<string, unknown>, fields = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      return (!(schema.required as string[] | undefined)?.some(key => object[key] === undefined)) && Object.entries(fields).every(([key, field]) => object[key] === undefined || reusableStructuredValue(object[key], field));
    }
    case "ARRAY": return Array.isArray(value) && value.length >= Number(schema.minItems ?? 0) && value.length <= Number(schema.maxItems ?? Infinity) && value.every(item => reusableStructuredValue(item, (schema.items ?? {}) as Record<string, unknown>));
    case "STRING": return typeof value === "string" && Boolean(value.trim());
    case "INTEGER": return typeof value === "number" && Number.isInteger(value);
    case "NUMBER": return typeof value === "number" && Number.isFinite(value);
    case "BOOLEAN": return typeof value === "boolean";
    default: return true;
  }
}
