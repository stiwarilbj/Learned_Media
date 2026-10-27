/** Authoritative ordered schema IDs and paths; build-native-diagnostics emits the Swift equivalent. */
export const providerSchemaFields = {
  "wikipedia.search": ["$", "error", "error.code", "error.info", "query", "query.search", "query.search[0]", "query.search[0].title"],
  "wikipedia.pages": ["$", "error", "error.code", "error.info", "query", "query.normalized", "query.redirects", "query.pages", "query.pages[0]", "query.pages[0].title", "query.pages[0].fullurl", "query.pages[0].extract", "query.pages[0].pageimage", "query.pages[0].thumbnail", "query.pages[0].thumbnail.source", "query.pages[0].original", "query.pages[0].original.source", "query.pages[0].coordinates", "query.pages[0].coordinates[0]", "query.pages[0].coordinates[0].lat", "query.pages[0].coordinates[0].lon", "query.pages[0].pageprops", "query.pages[0].pageprops.disambiguation"],
  "wikipedia.images": ["$", "error", "error.code", "error.info", "query", "query.pages", "query.pages[0]", "query.pages[0].imageinfo", "query.pages[0].imageinfo[0]", "query.pages[0].imageinfo[0].url", "query.pages[0].imageinfo[0].thumburl", "query.pages[0].imageinfo[0].descriptionurl", "query.pages[0].imageinfo[0].extmetadata"],
  "wikipedia.summary": ["$", "title", "thumbnail", "thumbnail.source", "originalimage", "originalimage.source", "content_urls", "content_urls.desktop", "content_urls.desktop.page"],
  "youtube.channels": ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.customUrl", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.relatedPlaylists", "items[0].contentDetails.relatedPlaylists.uploads"],
  "youtube.search": ["$", "items", "items[0]", "items[0].id", "items[0].id.channelId", "items[0].id.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.channelTitle", "items[0].snippet.channelId"],
  "youtube.playlistItems": ["$", "items", "items[0]", "items[0].contentDetails", "items[0].contentDetails.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "nextPageToken"],
  "youtube.videos": ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "items[0].snippet.channelTitle", "items[0].snippet.tags", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.duration", "items[0].status", "items[0].status.privacyStatus", "items[0].status.embeddable"],
  "youtube.error": ["$", "error", "error.code", "error.message", "error.status", "error.errors", "error.errors[0]", "error.errors[0].reason"]
} as const;

export type ProviderResponseSchema = keyof typeof providerSchemaFields;

const ringCapacity = 64;
const ring: string[] = [];
const counts = new Map<string, number>();
const localRuntime = typeof window !== "undefined" || (typeof self !== "undefined" && "importScripts" in globalThis);

function readPath(value: unknown, path: string): unknown {
  if (path === "$") return value;
  let current = value;
  for (const segment of path.split(".")) {
    const arrayIndex = segment.endsWith("[0]");
    const key = arrayIndex ? segment.slice(0, -3) : segment;
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
    if (arrayIndex) current = Array.isArray(current) ? current[0] : undefined;
  }
  return current;
}

function observedType(value: unknown, override?: "invalid-json" | "non-json") {
  if (override) return override;
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object": return "object";
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    default: return "other";
  }
}

/** Keeps only allowlisted field names and JSON types; payload values are never retained. */
export function recordProviderSchemaFailure(schema: ProviderResponseSchema, payload?: unknown, rootOverride?: "invalid-json" | "non-json") {
  if (!localRuntime) return;
  try {
    const fields = providerSchemaFields[schema];
    if (!fields) return;
    const safeRootOverride = rootOverride === "invalid-json" || rootOverride === "non-json" ? rootOverride : undefined;
    const fingerprint = `${schema}|${fields.map(path => `${path}:${observedType(readPath(payload, path), path === "$" ? safeRootOverride : undefined)}`).join(",")}`;
    if (ring.length === ringCapacity) {
      const expired = ring.shift()!;
      const remaining = (counts.get(expired) ?? 1) - 1;
      if (remaining <= 0) counts.delete(expired);
      else counts.set(expired, remaining);
    }
    ring.push(fingerprint);
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  } catch {
    // Diagnostics must never alter provider-response handling.
  }
}

export function providerSchemaFailureSnapshot() {
  return Array.from(counts, ([fingerprint, count]) => ({ fingerprint, count }));
}

export function resetProviderSchemaFailures() {
  ring.length = 0;
  counts.clear();
}
