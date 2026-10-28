import type { YouTubeVideo } from "./youtube";
import { checkBackgroundCancellation, yieldBackground, type BackgroundCancellation } from "./background-work";

// Bump when persisted page-validation or video-mapping rules change. No credentials are stored.
export const YOUTUBE_IMPORT_CHECKPOINT_VERSION = 2;
export const YOUTUBE_IMPORT_PAGE_PREFIX = "youtube-import-page-v1:";
export const YOUTUBE_IMPORT_PAGE_BATCH_SIZE = 25;
export type YouTubeImportPage = {
  version: number;
  sourceId: string;
  identity: string;
  refreshGeneration: string;
  index: number;
  requestToken: string;
  nextPageToken: string | null;
  checkpointDigest: string;
  pageDigest?: string;
  contentDigest?: string;
  videos: YouTubeVideo[];
  savedAt: string;
};
export type YouTubeImportPageDigests = { pageDigest: string; contentDigest?: string };
export type YouTubeImportPageStore = {
  has: (sourceId?: string) => Promise<boolean>;
  load: (sourceId: string) => Promise<YouTubeImportPage[]>;
  loadBatches?: (sourceId: string, cancellation?: BackgroundCancellation) => AsyncIterable<YouTubeImportPage[]>;
  save: (page: YouTubeImportPage) => Promise<void>;
  clear: (sourceId: string) => Promise<void>;
  clearFrom?: (sourceId: string, index: number) => Promise<void>;
};

export function importPagePrefix(sourceId: string) { return `${YOUTUBE_IMPORT_PAGE_PREFIX}${encodeURIComponent(sourceId)}:`; }
export function importPageKey(page: Pick<YouTubeImportPage, "sourceId" | "index">) { return `${importPagePrefix(page.sourceId)}${String(page.index).padStart(8, "0")}`; }
export function importPageIdentity(catalogVersion: number, channelId: string, playlistId: string) {
  return JSON.stringify([YOUTUBE_IMPORT_CHECKPOINT_VERSION, catalogVersion, channelId, playlistId]);
}

async function compactDigest(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A cursor-sensitive signature plus a content signature for rotating-token duplicates. */
export async function youtubeImportPageDigests(videoIds: readonly string[], nextPageToken: string | null): Promise<YouTubeImportPageDigests> {
  const orderedIds = Array.from(videoIds);
  const pageDigest = await compactDigest(JSON.stringify([orderedIds, nextPageToken]));
  const contentDigest = orderedIds.length ? await compactDigest(JSON.stringify(orderedIds)) : undefined;
  return { pageDigest, ...(contentDigest ? { contentDigest } : {}) };
}

/** Integrity digest for the exact durable page envelope used during recovery. */
export async function youtubeImportCheckpointDigest(index: number, videoIds: readonly string[], nextPageToken: string | null) {
  return compactDigest(JSON.stringify([YOUTUBE_IMPORT_CHECKPOINT_VERSION, index, Array.from(videoIds), nextPageToken]));
}

async function* checkpointPageBatches(store: YouTubeImportPageStore | undefined, sourceId: string, cancellation?: BackgroundCancellation) {
  if (!store) return;
  if (store.loadBatches) {
    for await (const batch of store.loadBatches(sourceId, cancellation)) {
      checkBackgroundCancellation(cancellation);
      yield batch;
    }
    checkBackgroundCancellation(cancellation);
    return;
  }
  // Compatibility path for in-memory and older stores. Production storage
  // adapters provide loadBatches so IndexedDB/native reads stay bounded.
  const pages = await store.load(sourceId);
  for (let offset = 0; offset < pages.length; offset += YOUTUBE_IMPORT_PAGE_BATCH_SIZE) {
    checkBackgroundCancellation(cancellation);
    yield pages.slice(offset, offset + YOUTUBE_IMPORT_PAGE_BATCH_SIZE);
    await yieldBackground(cancellation);
  }
}

function validVideo(video: YouTubeVideo, sourceId: string) {
  return video && typeof video.id === "string" && video.id.length > 0 && typeof video.channelId === "string" && typeof video.channelName === "string"
    && typeof video.title === "string" && typeof video.description === "string" && typeof video.publishedAt === "string"
    && typeof video.durationLabel === "string" && Number.isFinite(video.durationSeconds) && video.durationSeconds >= 0
    && typeof video.embedAvailable === "boolean" && video.approved === true
    && Array.isArray(video.tags) && video.tags.every(tag => typeof tag === "string")
    && Array.isArray(video.topics) && video.topics.every(topic => typeof topic === "string")
    && Array.isArray(video.sourceIds) && video.sourceIds.includes(sourceId);
}

// getRandomValues also works in the native file-based WebKit frontend.
function newRefreshGeneration() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A page's validated records and cursor form one durable envelope. */
export async function openImportCheckpoint(store: YouTubeImportPageStore | undefined, sourceId: string, identity: string, committedAt?: string, cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  let generation = "";
  let pageCount = 0;
  let nextPageToken: string | null = "";
  const tokens = new Set<string>();
  const pageDigests = new Set<string>();
  const contentDigests = new Set<string>();
  const videos = new Map<string, YouTubeVideo>();
  let corrupt = false;
  for await (const batch of checkpointPageBatches(store, sourceId, cancellation)) {
    for (const page of batch) {
      checkBackgroundCancellation(cancellation);
      const index = pageCount;
      if (!page || page.version !== YOUTUBE_IMPORT_CHECKPOINT_VERSION || page.sourceId !== sourceId || page.identity !== identity
        || typeof page.refreshGeneration !== "string" || !page.refreshGeneration.length || page.refreshGeneration.length > 128
        || generation && page.refreshGeneration !== generation
        || page.index !== index || index > 99_999_999 || nextPageToken === null || page.requestToken !== nextPageToken || tokens.has(page.requestToken)
        || !Number.isFinite(Date.parse(page.savedAt)) || (committedAt && Date.parse(page.savedAt) <= Date.parse(committedAt))
        || !(page.nextPageToken === null || typeof page.nextPageToken === "string" && page.nextPageToken.length > 0 && page.nextPageToken.length <= 4096)
        || typeof page.checkpointDigest !== "string" || !/^[\da-f]{32}$/.test(page.checkpointDigest)
        || page.pageDigest !== undefined && (typeof page.pageDigest !== "string" || !/^[\da-f]{32}$/.test(page.pageDigest))
        || page.contentDigest !== undefined && (typeof page.contentDigest !== "string" || !/^[\da-f]{32}$/.test(page.contentDigest))
        || !Array.isArray(page.videos) || page.videos.length > 50 || !page.videos.every(video => validVideo(video, sourceId))) {
        corrupt = true;
        break;
      }
      const expectedDigest = await youtubeImportCheckpointDigest(index, page.videos.map(video => video.id), page.nextPageToken);
      checkBackgroundCancellation(cancellation);
      if (page.checkpointDigest !== expectedDigest) { corrupt = true; break; }
      if (page.nextPageToken !== null && tokens.has(page.nextPageToken)) { corrupt = true; break; }
      if (index === 0) generation = page.refreshGeneration;
      tokens.add(page.requestToken);
      if (page.pageDigest) pageDigests.add(page.pageDigest);
      if (page.contentDigest) contentDigests.add(page.contentDigest);
      page.videos.forEach(video => videos.set(video.id, video));
      nextPageToken = page.nextPageToken;
      pageCount += 1;
    }
    if (corrupt) break;
  }
  if (corrupt) {
    checkBackgroundCancellation(cancellation);
    if (store?.clearFrom) await store.clearFrom(sourceId, pageCount);
    else {
      await store?.clear(sourceId);
      pageCount = 0; tokens.clear(); pageDigests.clear(); contentDigests.clear(); videos.clear(); nextPageToken = "";
    }
    if (!pageCount) generation = newRefreshGeneration();
  }
  if (!generation) generation = newRefreshGeneration();
  function assertPageRequestAllowed() {
    checkBackgroundCancellation(cancellation);
    if (nextPageToken === null || tokens.has(nextPageToken)) throw new Error("YouTube repeated an import page. Retry the source to restart safely.");
    return nextPageToken;
  }
  function validateNextPageToken(next: string | null) {
    const requestToken = assertPageRequestAllowed();
    if (!(next === null || typeof next === "string" && next.length > 0 && next.length <= 4096)) throw new Error("YouTube returned an invalid continuation token. The checkpoint was not advanced.");
    if (next !== null && (next === requestToken || tokens.has(next))) throw new Error("YouTube repeated an import page. Retry the source to restart safely.");
    return requestToken;
  }
  function hasRepeatedPageDigest(digests: YouTubeImportPageDigests) {
    return pageDigests.has(digests.pageDigest) || Boolean(digests.contentDigest && contentDigests.has(digests.contentDigest));
  }
  return {
    completedRefresh() {
      checkBackgroundCancellation(cancellation);
      if (nextPageToken !== null || !pageCount) throw new Error("The YouTube refresh is incomplete. Previous playlist associations were retained.");
      return { sourceId, identity, generation, complete: true as const, videos: [...videos.values()] };
    },
    get nextPageToken() { return nextPageToken; },
    get videos() { return [...videos.values()]; },
    assertPageRequestAllowed,
    validateNextPageToken,
    hasRepeatedPageDigest,
    async append(records: YouTubeVideo[], next: string | null, digests?: YouTubeImportPageDigests) {
      const requestToken = validateNextPageToken(next);
      if (digests && (!/^[\da-f]{32}$/.test(digests.pageDigest) || digests.contentDigest !== undefined && !/^[\da-f]{32}$/.test(digests.contentDigest))) {
        throw new Error("YouTube returned an invalid import page digest. The checkpoint was not advanced.");
      }
      if (digests && hasRepeatedPageDigest(digests)) throw new Error("YouTube repeated an import page. Retry the source to restart safely.");
      if (records.length > 50 || !records.every(video => validVideo(video, sourceId))) throw new Error("YouTube returned invalid import metadata. The checkpoint was not advanced.");
      const checkpointDigest = await youtubeImportCheckpointDigest(pageCount, records.map(video => video.id), next);
      checkBackgroundCancellation(cancellation);
      const page: YouTubeImportPage = { version: YOUTUBE_IMPORT_CHECKPOINT_VERSION, sourceId, identity, refreshGeneration: generation, index: pageCount,
        requestToken, nextPageToken: next, ...(digests ?? {}), checkpointDigest, videos: records, savedAt: new Date().toISOString() };
      // Advance memory/progress only after the entire envelope commits.
      await store?.save(page);
      pageCount += 1; tokens.add(page.requestToken);
      if (digests) { pageDigests.add(digests.pageDigest); if (digests.contentDigest) contentDigests.add(digests.contentDigest); }
      records.forEach(video => videos.set(video.id, video)); nextPageToken = next;
    }
  };
}

export type CompletedYouTubeRefresh = ReturnType<Awaited<ReturnType<typeof openImportCheckpoint>>["completedRefresh"]>;
export type YouTubeRefreshReceipt = Pick<CompletedYouTubeRefresh, "sourceId" | "identity" | "generation">;

/** Recheck durable completion before publishing a destructive catalog replacement. */
export async function verifyYouTubeRefreshes(receipts: readonly YouTubeRefreshReceipt[], store: YouTubeImportPageStore, cancellation?: BackgroundCancellation) {
  for (const receipt of receipts) {
    const checkpoint = await openImportCheckpoint(store, receipt.sourceId, receipt.identity, undefined, cancellation);
    if (checkpoint.completedRefresh().generation !== receipt.generation) throw new Error("The YouTube refresh changed before publication. Previous playlist associations were retained.");
  }
  checkBackgroundCancellation(cancellation);
}
