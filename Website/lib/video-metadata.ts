import { checkBackgroundCancellation, forEachBackground, type BackgroundCancellation } from "./background-work";

/** Shared by catalog imports and search workers. Video records are immutable. */
export type SearchableVideoMetadata = {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  tags: string[];
  topics: string[];
  publishedAt: string;
  durationSeconds: number;
  approved: boolean;
  special?: boolean;
  sourceIds?: string[];
};

/** Project a full catalog record to the exact document shape sent to search workers. */
export function toVideoSearchDocument(video: SearchableVideoMetadata): SearchableVideoMetadata {
  return {
    id: video.id,
    channelId: video.channelId,
    channelName: video.channelName,
    title: video.title,
    description: video.description,
    tags: video.tags,
    topics: video.topics,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    approved: video.approved,
    ...(video.special === undefined ? {} : { special: video.special }),
    ...(video.sourceIds === undefined ? {} : { sourceIds: video.sourceIds }),
  };
}

const fingerprints = new WeakMap<SearchableVideoMetadata, string>();
const searchScalars = ["id", "channelId", "channelName", "title", "description", "publishedAt", "durationSeconds", "approved", "special"] as const;
const searchArrays = ["tags", "topics", "sourceIds"] as const;

/** Compact, versioned, memory-only identity; never trust a hash alone for equality. */
export function videoSearchFingerprint(video: SearchableVideoMetadata): string {
  const cached = fingerprints.get(video);
  if (cached) return cached;
  const text = JSON.stringify([searchScalars.map(key => video[key]), searchArrays.map(key => video[key] ?? [])]);
  let left = 0x811c9dc5, right = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  const fingerprint = `video-metadata-v1:${text.length}:${(left >>> 0).toString(36)}:${(right >>> 0).toString(36)}`;
  fingerprints.set(video, fingerprint);
  return fingerprint;
}

export function sameVideoSearchMetadata(previous: SearchableVideoMetadata | undefined, next: SearchableVideoMetadata): boolean {
  if (previous === next) return true;
  if (!previous || videoSearchFingerprint(previous) !== videoSearchFingerprint(next)) return false;
  // Confirm exact fields so a hash collision cannot retain stale metadata or filters.
  return searchScalars.every(key => previous[key] === next[key]) && searchArrays.every(key => {
    const left = previous[key] ?? [], right = next[key] ?? [];
    return left.length === right.length && left.every((value, index) => value === right[index]);
  });
}

function reusableVideo<T extends SearchableVideoMetadata>(stored: T | undefined, video: T): T {
  if (stored === video) return stored;
  if (!stored || !sameVideoSearchMetadata(stored, video)) return video;
  // Source scan times live in sourceStates. A scan timestamp alone does not
  // change a video. Check every other field, including display-only metadata
  // and future fields, before retaining the stored record.
  const keys = new Set([...Object.keys(stored), ...Object.keys(video)]);
  for (const key of keys) {
    if (key === "metadataRefreshedAt" || searchArrays.some(field => field === key)) continue;
    if ((stored as Record<string, unknown>)[key] !== (video as Record<string, unknown>)[key]) return video;
  }
  return stored;
}

export function reuseUnchangedVideoRecords<T extends SearchableVideoMetadata>(previous: T[], next: T[]): T[] {
  if (previous === next || !previous.length) return next;
  const byId = new Map(previous.map(video => [video.id, video]));
  const records = next.map(video => reusableVideo(byId.get(video.id), video));
  return previous.length === records.length && records.every((video, index) => video === previous[index]) ? previous : records;
}

/** Imports/restoration use bounded slices; synchronous UI callers keep their API. */
export async function reuseUnchangedVideoRecordsYielding<T extends SearchableVideoMetadata>(previous: T[], next: T[], cancellation?: BackgroundCancellation): Promise<T[]> {
  checkBackgroundCancellation(cancellation);
  if (previous === next || !previous.length) return next;
  const byId = new Map<string, T>(), records: T[] = [];
  let unchanged = previous.length === next.length;
  await forEachBackground(previous, video => { byId.set(video.id, video); }, cancellation);
  await forEachBackground(next, (video, index) => {
    const record = reusableVideo(byId.get(video.id), video);
    records.push(record);
    if (record !== previous[index]) unchanged = false;
  }, cancellation);
  return unchanged ? previous : records;
}

/** Keep unchanged worker objects (and their normalized search entries) intact. */
export function diffVideoSearchMetadata<T extends SearchableVideoMetadata>(indexed: Map<string, T>, next: T[]) {
  const upserts: T[] = [], removeIds: string[] = [];
  const orderIds = next.map(video => video.id);
  const ids = new Set(orderIds);
  const previousOrder = indexed.keys();
  let orderChanged = indexed.size !== next.length;
  for (const video of next) {
    if (previousOrder.next().value !== video.id) orderChanged = true;
    if (!sameVideoSearchMetadata(indexed.get(video.id), video)) upserts.push(video);
  }
  for (const id of indexed.keys()) if (!ids.has(id)) removeIds.push(id);
  return { upserts, removeIds, orderIds: orderChanged ? orderIds : undefined, changed: orderChanged || upserts.length > 0 || removeIds.length > 0 };
}

export type VideoSearchIndexPatch<T extends SearchableVideoMetadata> = {
  baseRevision: number; revision: number; upserts: T[]; removeIds: string[]; orderIds?: string[];
};

/** Keep full records locally; project and clone only the final pending patch. */
export function createVideoSearchPatchQueue<T extends SearchableVideoMetadata>(
  publish: (patch: VideoSearchIndexPatch<T>) => void,
  schedule: (flush: () => void) => () => void = flush => {
    const timer = setTimeout(flush, 16);
    return () => clearTimeout(timer);
  }
) {
  let pending: { baseRevision: number; revision: number; upserts: Map<string, T>; removeIds: Set<string>; orderIds?: string[] } | undefined;
  let cancelScheduled: (() => void) | undefined;
  const clear = () => { cancelScheduled?.(); cancelScheduled = undefined; pending = undefined; };
  const flush = () => {
    const patch = pending;
    clear();
    if (patch) publish({ baseRevision: patch.baseRevision, revision: patch.revision,
      upserts: [...patch.upserts.values()], removeIds: [...patch.removeIds], orderIds: patch.orderIds });
  };
  return {
    clear, flush,
    enqueue(patch: VideoSearchIndexPatch<T>) {
      if (pending && pending.revision !== patch.baseRevision) throw new Error("Noncontiguous video index patches require a rebuild.");
      pending ??= { baseRevision: patch.baseRevision, revision: patch.revision, upserts: new Map(), removeIds: new Set() };
      pending.revision = patch.revision;
      for (const id of patch.removeIds) { pending.upserts.delete(id); pending.removeIds.add(id); }
      for (const video of patch.upserts) { pending.removeIds.delete(video.id); pending.upserts.set(video.id, video); }
      if (patch.orderIds !== undefined) pending.orderIds = patch.orderIds.slice();
      if (!cancelScheduled) {
        const scheduledPatch = pending;
        cancelScheduled = schedule(() => { if (pending === scheduledPatch) flush(); });
      }
    }
  };
}
