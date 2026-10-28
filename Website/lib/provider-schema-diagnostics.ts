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

type PathStep = Readonly<{ key: string; firstElement: boolean }>;
type PreparedPath = Readonly<{ path: string; steps: readonly PathStep[] }>;
const preparedSchemaFields: ReadonlyMap<string, readonly PreparedPath[]> = new Map(
  Object.entries(providerSchemaFields).map(([schema, paths]) => [schema, Object.freeze(paths.map(path => Object.freeze({
    path,
    steps: Object.freeze(path === "$" ? [] : path.split(".").map(segment => {
      const firstElement = segment.endsWith("[0]");
      return Object.freeze({ key: firstElement ? segment.slice(0, -3) : segment, firstElement });
    }))
  })))] as const)
);

const ringCapacity = 64;
const ring: (string | undefined)[] = new Array(ringCapacity);
let ringOldest = 0;
let ringSize = 0;
const counts = new Map<string, number>();
const schemaIDs = Object.keys(providerSchemaFields) as ProviderResponseSchema[];
const schemaIndexes = new Map(schemaIDs.map((schema, index) => [schema, index]));
const typeNames = ["missing", "null", "array", "object", "string", "number", "boolean", "other", "invalid-json", "non-json"] as const;
const localRuntime = typeof window !== "undefined" || (typeof self !== "undefined" && "importScripts" in globalThis);

function readPath(value: unknown, steps: readonly PathStep[]): unknown {
  let current = value;
  for (const { key, firstElement } of steps) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
    if (firstElement) current = Array.isArray(current) ? current[0] : undefined;
  }
  return current;
}

function observedTypeCode(value: unknown, override?: "invalid-json" | "non-json") {
  if (override === "invalid-json") return 8;
  if (override === "non-json") return 9;
  if (value === undefined) return 0;
  if (value === null) return 1;
  if (Array.isArray(value)) return 2;
  switch (typeof value) {
    case "object": return 3;
    case "string": return 4;
    case "number": return 5;
    case "boolean": return 6;
    default: return 7;
  }
}

function readableFingerprint(compact: string) {
  const separator = compact.indexOf(":");
  if (separator < 0) return "";
  const schema = schemaIDs[Number.parseInt(compact.slice(0, separator), 36)];
  if (!schema) return "";
  const fields = preparedSchemaFields.get(schema);
  const codes = compact.slice(separator + 1);
  if (!fields || fields.length !== codes.length) return "";
  return `${schema}|${fields.map(({ path }, index) => `${path}:${typeNames[codes.charCodeAt(index) - 65] ?? "other"}`).join(",")}`;
}

/** Keeps only allowlisted field names and JSON types; payload values are never retained. */
export function recordProviderSchemaFailure(schema: ProviderResponseSchema, payload?: unknown, rootOverride?: "invalid-json" | "non-json") {
  if (!localRuntime) return;
  try {
    const fields = preparedSchemaFields.get(schema);
    const schemaIndex = schemaIndexes.get(schema);
    if (!fields || schemaIndex === undefined) return;
    const safeRootOverride = rootOverride === "invalid-json" || rootOverride === "non-json" ? rootOverride : undefined;
    const compact = `${schemaIndex.toString(36)}:${fields.map(({ path, steps }) => String.fromCharCode(65 + observedTypeCode(readPath(payload, steps), path === "$" ? safeRootOverride : undefined))).join("")}`;
    let slot: number;
    if (ringSize === ringCapacity) {
      const expired = ring[ringOldest]!;
      const remaining = (counts.get(expired) ?? 1) - 1;
      if (remaining <= 0) counts.delete(expired);
      else counts.set(expired, remaining);
      slot = ringOldest;
      ringOldest = (ringOldest + 1) % ringCapacity;
    } else {
      slot = (ringOldest + ringSize) % ringCapacity;
      ringSize += 1;
    }
    ring[slot] = compact;
    counts.set(compact, (counts.get(compact) ?? 0) + 1);
  } catch {
    // Diagnostics must never alter provider-response handling.
  }
}

export function providerSchemaFailureSnapshot() {
  return Array.from(counts, ([compact, count]) => ({ fingerprint: readableFingerprint(compact), count }));
}

export function resetProviderSchemaFailures() {
  ring.fill(undefined);
  ringOldest = 0;
  ringSize = 0;
  counts.clear();
}
