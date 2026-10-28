import type { YouTubeVideo } from "./youtube";
import { checkBackgroundCancellation, forEachBackground, yieldBackground, type BackgroundCancellation } from "./background-work";

// Bump when persisted video approval/mapping rules change. No credentials are stored.
export const YOUTUBE_IMPORT_CHECKPOINT_VERSION = 1;
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
  videos: YouTubeVideo[];
  savedAt: string;
};
export type YouTubeImportPageStore = {
  has: (sourceId?: string) => Promise<boolean>;
  load: (sourceId: string) => Promise<YouTubeImportPage[]>;
  loadBatches?: (sourceId: string, cancellation?: BackgroundCancellation) => AsyncIterable<YouTubeImportPage[]>;
  save: (page: YouTubeImportPage) => Promise<void>;
  clear: (sourceId: string) => Promise<void>;
};

export function importPagePrefix(sourceId: string) { return `${YOUTUBE_IMPORT_PAGE_PREFIX}${encodeURIComponent(sourceId)}:`; }
export function importPageKey(page: Pick<YouTubeImportPage, "sourceId" | "index">) { return `${importPagePrefix(page.sourceId)}${String(page.index).padStart(8, "0")}`; }
export function importPageIdentity(catalogVersion: number, channelId: string, playlistId: string) {
  return JSON.stringify([YOUTUBE_IMPORT_CHECKPOINT_VERSION, catalogVersion, channelId, playlistId]);
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
  let generation = newRefreshGeneration();
  let pageCount = 0;
  let nextPageToken: string | null = "";
  const tokens = new Set<string>();
  const videos = new Map<string, YouTubeVideo>();
  let valid = true;
  for await (const batch of checkpointPageBatches(store, sourceId, cancellation)) {
    await forEachBackground(batch, page => {
      const index = pageCount++;
      if (index === 0 && typeof page?.refreshGeneration === "string") generation = page.refreshGeneration;
      if (!page || page.version !== YOUTUBE_IMPORT_CHECKPOINT_VERSION || page.sourceId !== sourceId || page.identity !== identity
        || typeof page.refreshGeneration !== "string" || !page.refreshGeneration.length || page.refreshGeneration.length > 128 || page.refreshGeneration !== generation
        || page.index !== index || index > 99_999_999 || nextPageToken === null || page.requestToken !== nextPageToken || tokens.has(page.requestToken)
        || !Number.isFinite(Date.parse(page.savedAt)) || (committedAt && Date.parse(page.savedAt) <= Date.parse(committedAt))
        || !(page.nextPageToken === null || typeof page.nextPageToken === "string" && page.nextPageToken.length > 0 && page.nextPageToken.length <= 4096)
        || !Array.isArray(page.videos) || page.videos.length > 50 || !page.videos.every(video => validVideo(video, sourceId))) { valid = false; return false; }
      tokens.add(page.requestToken);
      if (page.nextPageToken !== null && tokens.has(page.nextPageToken)) { valid = false; return false; }
      page.videos.forEach(video => videos.set(video.id, video));
      nextPageToken = page.nextPageToken;
    }, cancellation);
    if (!valid) break;
  }
  if (!valid) {
    checkBackgroundCancellation(cancellation);
    await store?.clear(sourceId);
    pageCount = 0; tokens.clear(); videos.clear(); nextPageToken = ""; generation = newRefreshGeneration();
  }
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
    async append(records: YouTubeVideo[], next: string | null) {
      const requestToken = validateNextPageToken(next);
      if (records.length > 50 || !records.every(video => validVideo(video, sourceId))) throw new Error("YouTube returned invalid import metadata. The checkpoint was not advanced.");
      const page: YouTubeImportPage = { version: YOUTUBE_IMPORT_CHECKPOINT_VERSION, sourceId, identity, refreshGeneration: generation, index: pageCount,
        requestToken, nextPageToken: next, videos: records, savedAt: new Date().toISOString() };
      // Advance memory/progress only after the entire envelope commits.
      await store?.save(page);
      pageCount += 1; tokens.add(page.requestToken); records.forEach(video => videos.set(video.id, video)); nextPageToken = next;
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
