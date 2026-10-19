import type { YouTubeVideo, YouTubeWorkspaceState } from "./youtube";
import { reuseUnchangedVideoRecords } from "./video-metadata";

export const VIDEO_RECORD_PREFIX = "youtube-video-record-v1:";
export const VIDEO_WRITE_BATCH_SIZE = 100;
export type YouTubeCatalog = Pick<YouTubeWorkspaceState, "channels" | "videos" | "libraryIncomplete" | "lastSyncAt" | "catalogVersion" | "sourceStates">;
type CatalogManifest = Omit<YouTubeCatalog, "videos"> & { storageVersion: 1; entries: [string, string][] };
export type StoredVideo = { key: string; video: YouTubeVideo };

export function videoRecordRange() { return IDBKeyRange.bound(VIDEO_RECORD_PREFIX, `${VIDEO_RECORD_PREFIX}\uffff`); }
export function isCatalogManifest(value: unknown): value is CatalogManifest {
  return Boolean(value && typeof value === "object" && (value as CatalogManifest).storageVersion === 1 && Array.isArray((value as CatalogManifest).entries));
}

/** Immutable records are staged before a small manifest publishes the new library. */
export function planCatalogCommit(catalog: YouTubeCatalog, previous: YouTubeVideo[], stored: unknown) {
  const references = new Map(isCatalogManifest(stored) ? stored.entries : []);
  const oldVideos = new Map(previous.map(video => [video.id, video]));
  const revision = crypto.randomUUID();
  const upserts: StoredVideo[] = [], entries: [string, string][] = [];
  const ids = new Set<string>();
  for (const video of reuseUnchangedVideoRecords(previous, catalog.videos)) {
    if (ids.has(video.id)) throw new Error("The video catalog contains a duplicate ID.");
    ids.add(video.id);
    const oldKey = references.get(video.id);
    const key = oldKey?.startsWith(VIDEO_RECORD_PREFIX) && oldVideos.get(video.id) === video
      ? oldKey : `${VIDEO_RECORD_PREFIX}${revision}:${encodeURIComponent(video.id)}`;
    entries.push([video.id, key]);
    if (key !== oldKey) upserts.push({ key, video });
  }
  const { videos: _videos, ...metadata } = catalog;
  const manifest: CatalogManifest = { ...metadata, storageVersion: 1, entries };
  return { manifest, upserts, retainedKeys: new Set(entries.map(([, key]) => key)) };
}

export function restoreStoredCatalog(raw: Record<string, unknown> | null, records: StoredVideo[]): Record<string, unknown> | null {
  if (!raw || raw.storageVersion === undefined) return raw; // Legacy snapshots remain readable until publication succeeds.
  if (!isCatalogManifest(raw)) throw new Error("The saved YouTube catalog manifest is invalid.");
  const byKey = new Map(records.map(record => [record.key, record.video]));
  const ids = new Set<string>();
  const videos = raw.entries.map(entry => {
    if (!Array.isArray(entry) || entry.length !== 2) throw new Error("The saved video reference is invalid.");
    const [id, key] = entry, video = byKey.get(key);
    if (!video || video.id !== id || ids.has(id)) throw new Error("The saved YouTube catalog is incomplete. Retry the import to recover it.");
    ids.add(id);
    return video;
  });
  const { entries: _entries, storageVersion: _version, ...metadata } = raw;
  return { ...metadata, videos };
}
