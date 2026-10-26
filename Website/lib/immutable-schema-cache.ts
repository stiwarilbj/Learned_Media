function freezeTree<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  return Object.isFrozen(value) ? value : Object.freeze(value) as T;
}

/** Small LRU cache for JSON-only schema structures shared by concurrent requests. */
export class ImmutableSchemaCache {
  private readonly entries = new Map<string, object>();

  constructor(private readonly capacity = 16) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError("Schema cache capacity must be a positive integer.");
  }

  get size() {
    return this.entries.size;
  }

  get<T extends object>(key: string, create: () => T): T {
    const cached = this.entries.get(key) as T | undefined;
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }

    const schema = freezeTree(create());
    this.entries.set(key, schema);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return schema;
  }
}
