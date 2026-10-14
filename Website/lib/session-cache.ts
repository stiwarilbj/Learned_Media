export type SessionCacheEntry<T> = { value: T; expiresAt: number };

/** Small bounded cache for results that are safe to reuse within one session. */
export class SessionCache<T> {
  private readonly entries = new Map<string, SessionCacheEntry<T>>();

  constructor(private readonly maxEntries = 100, private readonly ttlMs = 30 * 60 * 1000) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }
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
