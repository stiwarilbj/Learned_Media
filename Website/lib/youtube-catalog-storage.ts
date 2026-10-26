import type { YouTubeVideo, YouTubeWorkspaceState } from "./youtube";
import { reuseIndexedVideoRecords, catalogSourceMembership, restoreCatalogSourceMembership, type StoredSourceMembership } from "./video-source-index";
import { checkBackgroundCancellation, forEachBackground, type BackgroundCancellation } from "./background-work";

export const VIDEO_RECORD_PREFIX = "youtube-video-record-v1:";
export const VIDEO_WRITE_BATCH_SIZE = 100;
export type YouTubeCatalog = Pick<YouTubeWorkspaceState, "channels" | "videos" | "libraryIncomplete" | "lastSyncAt" | "catalogVersion" | "sourceStates">;
type CatalogManifest = Omit<YouTubeCatalog, "videos"> & { storageVersion: 1; entries: [string, string][]; sourceMembership?: StoredSourceMembership };
export type StoredVideo = { key: string; video: YouTubeVideo };

export function videoRecordRange() { return IDBKeyRange.bound(VIDEO_RECORD_PREFIX, `${VIDEO_RECORD_PREFIX}\uffff`); }
export function isCatalogManifest(value: unknown): value is CatalogManifest {
  return Boolean(value && typeof value === "object" && (value as CatalogManifest).storageVersion === 1 && Array.isArray((value as CatalogManifest).entries));
}

/** Immutable records are staged before a small manifest publishes the new library. */
export async function planCatalogCommit(catalog: YouTubeCatalog, previous: YouTubeVideo[], stored: unknown, cancellation?: BackgroundCancellation) {
  const references = new Map<string, string>(), oldVideos = new Map<string, YouTubeVideo>();
  await forEachBackground(isCatalogManifest(stored) ? stored.entries : [], ([id, key]) => { references.set(id, key); }, cancellation);
  await forEachBackground(previous, video => { oldVideos.set(video.id, video); }, cancellation);
  const revision = crypto.randomUUID();
  const upserts: StoredVideo[] = [], entries: [string, string][] = [];
  const ids = new Set<string>(), retainedKeys = new Set<string>();
  const videos = await reuseIndexedVideoRecords(previous, catalog.videos, cancellation);
  await forEachBackground(videos, video => {
    if (ids.has(video.id)) throw new Error("The video catalog contains a duplicate ID.");
    ids.add(video.id);
    const oldKey = references.get(video.id);
    const key = oldKey?.startsWith(VIDEO_RECORD_PREFIX) && oldVideos.get(video.id) === video
      ? oldKey : `${VIDEO_RECORD_PREFIX}${revision}:${encodeURIComponent(video.id)}`;
    entries.push([video.id, key]);
    retainedKeys.add(key);
    if (key !== oldKey) upserts.push({ key, video });
  }, cancellation);
  const { videos: _videos, ...metadata } = catalog;
  const manifest: CatalogManifest = { ...metadata, storageVersion: 1, entries, sourceMembership: await catalogSourceMembership(videos, cancellation) };
  return { manifest, upserts, retainedKeys };
}

export async function restoreStoredCatalog(raw: Record<string, unknown> | null, records: StoredVideo[], cancellation?: BackgroundCancellation): Promise<Record<string, unknown> | null> {
  // Even an empty or legacy catalog must honor cancellation.
  checkBackgroundCancellation(cancellation);
  if (!raw || raw.storageVersion === undefined) return raw; // Legacy snapshots remain readable until publication succeeds.
  if (!isCatalogManifest(raw)) throw new Error("The saved YouTube catalog manifest is invalid.");
  const byKey = new Map<string, YouTubeVideo>();
  await forEachBackground(records, record => { byKey.set(record.key, record.video); }, cancellation);
  const ids = new Set<string>(), videos: YouTubeVideo[] = [];
  await forEachBackground(raw.entries, entry => {
    if (!Array.isArray(entry) || entry.length !== 2) throw new Error("The saved video reference is invalid.");
    const [id, key] = entry, video = byKey.get(key);
    if (!video || video.id !== id || ids.has(id)) throw new Error("The saved YouTube catalog is incomplete. Retry the import to recover it.");
    ids.add(id);
    videos.push(video);
  }, cancellation);
  // Validate against records on restoration; rebuild missing or stale derived data.
  await restoreCatalogSourceMembership(videos, raw.sourceMembership, cancellation);
  const { entries: _entries, storageVersion: _version, sourceMembership: _membership, ...metadata } = raw;
  return { ...metadata, videos };
}
