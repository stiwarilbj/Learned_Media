import type { YouTubeVideo } from "./youtube";
import { reuseUnchangedVideoRecordsYielding } from "./video-metadata";
import { checkBackgroundCancellation, forEachBackground, type BackgroundCancellation } from "./background-work";

export type StoredSourceMembership = { version: 1; entries: [string, string[]][] };
type SourceIndex = { videos: Map<string, YouTubeVideo>; members: Map<string, Set<string>> };
// Catalog arrays and records are immutable snapshots, just like search indexes.
// A restored/imported array always gets its own index derived from its records.
const indexes = new WeakMap<readonly YouTubeVideo[], SourceIndex>();

/** Record reuse can return a new array; carry its already-prepared memberships. */
export async function reuseIndexedVideoRecords(previous: YouTubeVideo[], next: YouTubeVideo[], cancellation?: BackgroundCancellation) {
  const videos = await reuseUnchangedVideoRecordsYielding(previous, next, cancellation);
  const prepared = indexes.get(next);
  if (prepared && videos !== next && !indexes.has(videos)) {
    const byId = new Map<string, YouTubeVideo>();
    await forEachBackground(videos, video => { byId.set(video.id, video); }, cancellation);
    indexes.set(videos, { videos: byId, members: prepared.members });
  }
  return videos;
}

async function sourceIndex(videos: readonly YouTubeVideo[], cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  const cached = indexes.get(videos);
  if (cached) return cached;
  const index: SourceIndex = { videos: new Map(), members: new Map() };
  await forEachBackground(videos, video => {
    if (index.videos.has(video.id)) throw new Error("The video catalog contains a duplicate ID.");
    index.videos.set(video.id, video);
    for (const source of video.sourceIds ?? []) {
      let members = index.members.get(source);
      if (!members) index.members.set(source, members = new Set());
      members.add(video.id);
    }
  }, cancellation);
  indexes.set(videos, index);
  return index;
}

/** Serialize a derived lookup; records and their provenance remain authoritative. */
export async function catalogSourceMembership(videos: readonly YouTubeVideo[], cancellation?: BackgroundCancellation): Promise<StoredSourceMembership> {
  const index = await sourceIndex(videos, cancellation);
  const entries: [string, string[]][] = [];
  for (const [source, ids] of index.members) {
    const members: string[] = [];
    await forEachBackground(ids, id => { members.push(id); }, cancellation);
    entries.push([source, members]);
  }
  return { version: 1, entries };
}

/** Restore from records, never trusting an absent, outdated, or malformed lookup. */
export async function restoreCatalogSourceMembership(videos: readonly YouTubeVideo[], stored: unknown, cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  const saved = stored as Partial<StoredSourceMembership> | null;
  if (!saved || saved.version !== 1 || !Array.isArray(saved.entries)) {
    await sourceIndex(videos, cancellation);
    return;
  }
  const index: SourceIndex = { videos: new Map(), members: new Map() };
  let valid = true, storedCount = 0, actualCount = 0;
  for (const entry of saved.entries) {
    checkBackgroundCancellation(cancellation);
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !Array.isArray(entry[1]) || !entry[1].length || index.members.has(entry[0])) { valid = false; break; }
    const ids = new Set<string>();
    await forEachBackground(entry[1], id => {
      if (typeof id !== "string" || ids.has(id)) { valid = false; return false; }
      ids.add(id);
    }, cancellation);
    if (!valid) break;
    storedCount += ids.size;
    index.members.set(entry[0], ids);
  }
  if (valid) await forEachBackground(videos, video => {
    index.videos.set(video.id, video);
    for (const source of new Set(video.sourceIds ?? [])) {
      actualCount++;
      if (!index.members.get(source)?.has(video.id)) { valid = false; return false; }
    }
  }, cancellation);
  // Full coverage plus equal cardinality rules out missing, stale and invented IDs.
  if (valid && storedCount === actualCount) indexes.set(videos, index);
  else await sourceIndex(videos, cancellation);
}

export type VideoSourceRefresh = { sourceId: string; videos: readonly YouTubeVideo[]; generation?: string; complete?: boolean };
export function isCompleteVideoSourceRefresh(refresh: VideoSourceRefresh) {
  return refresh.complete === true && typeof refresh.generation === "string" && refresh.generation.length > 0 && refresh.generation.length <= 128;
}

/** Update only old/new members of refreshed sources; copy sets only when edited. */
export async function mergeVideoSourceRefreshes(
  previous: readonly YouTubeVideo[], refreshes: readonly VideoSourceRefresh[],
  allowed: (video: YouTubeVideo) => boolean, activeSources?: ReadonlySet<string>, cancellation?: BackgroundCancellation
) {
  const base = await sourceIndex(previous, cancellation);
  const index: SourceIndex = { videos: new Map(base.videos), members: new Map(base.members) };
  const edited = new Set<string>();
  const writableMembers = (source: string) => {
    if (!edited.has(source)) {
      index.members.set(source, new Set(index.members.get(source)));
      edited.add(source);
    }
    return index.members.get(source)!;
  };
  const replace = (id: string, video?: YouTubeVideo) => {
    const old = index.videos.get(id);
    const oldSources = new Set(old?.sourceIds ?? []), newSources = new Set(video?.sourceIds ?? []);
    for (const source of oldSources) if (!newSources.has(source)) writableMembers(source).delete(id);
    for (const source of newSources) if (!oldSources.has(source)) writableMembers(source).add(id);
    if (video) index.videos.set(id, video);
    else index.videos.delete(id);
  };
  const removeSource = (id: string, source: string) => {
    const video = index.videos.get(id);
    if (!video?.sourceIds?.includes(source)) return;
    const sourceIds = video.sourceIds.filter(value => value !== source);
    replace(id, sourceIds.length ? { ...video, sourceIds } : undefined);
  };
  for (const refresh of refreshes) {
    checkBackgroundCancellation(cancellation);
    const imported = new Set<string>();
    await forEachBackground(refresh.videos, video => { imported.add(video.id); }, cancellation);
    // Iterate the old immutable set even when removal creates a writable copy.
    if (isCompleteVideoSourceRefresh(refresh)) await forEachBackground(index.members.get(refresh.sourceId) ?? [], id => {
      if (!imported.has(id)) removeSource(id, refresh.sourceId);
    }, cancellation);
    await forEachBackground(refresh.videos, video => {
      const old = index.videos.get(video.id);
      replace(video.id, { ...old, ...video, sourceIds: Array.from(new Set([...(old?.sourceIds ?? []), refresh.sourceId])) });
    }, cancellation);
  }
  if (activeSources) {
    // Retired playlist/channel rules use the same lookup, not a catalog scan.
    for (const source of index.members.keys()) {
      if (!/^(?:channel|playlist):/.test(source) || activeSources.has(source)) continue;
      await forEachBackground(index.members.get(source) ?? [], id => { removeSource(id, source); }, cancellation);
    }
  }
  const videos: YouTubeVideo[] = [];
  await forEachBackground(index.videos, ([id, video]) => {
    if (allowed(video)) videos.push(video);
    else replace(id);
  }, cancellation);
  for (const [source, members] of index.members) if (!members.size) index.members.delete(source);
  checkBackgroundCancellation(cancellation);
  indexes.set(videos, index);
  return videos;
}
