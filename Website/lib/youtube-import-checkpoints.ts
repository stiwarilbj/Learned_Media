import type { YouTubeVideo } from "./youtube";
import { checkBackgroundCancellation, forEachBackground, type BackgroundCancellation } from "./background-work";

// Bump when persisted video approval/mapping rules change. No credentials are stored.
export const YOUTUBE_IMPORT_CHECKPOINT_VERSION = 1;
export const YOUTUBE_IMPORT_PAGE_PREFIX = "youtube-import-page-v1:";
export type YouTubeImportPage = {
  version: number;
  sourceId: string;
  identity: string;
  index: number;
  requestToken: string;
  nextPageToken: string | null;
  videos: YouTubeVideo[];
  savedAt: string;
};
export type YouTubeImportPageStore = {
  has: (sourceId?: string) => Promise<boolean>;
  load: (sourceId: string) => Promise<YouTubeImportPage[]>;
  save: (page: YouTubeImportPage) => Promise<void>;
  clear: (sourceId: string) => Promise<void>;
};

export function importPagePrefix(sourceId: string) { return `${YOUTUBE_IMPORT_PAGE_PREFIX}${encodeURIComponent(sourceId)}:`; }
export function importPageKey(page: Pick<YouTubeImportPage, "sourceId" | "index">) { return `${importPagePrefix(page.sourceId)}${String(page.index).padStart(8, "0")}`; }
export function importPageIdentity(catalogVersion: number, channelId: string, playlistId: string) {
  return JSON.stringify([YOUTUBE_IMPORT_CHECKPOINT_VERSION, catalogVersion, channelId, playlistId]);
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

/** A page's validated records and cursor form one durable envelope. */
export async function openImportCheckpoint(store: YouTubeImportPageStore | undefined, sourceId: string, identity: string, committedAt?: string, cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  const pages = store ? await store.load(sourceId) : [];
  let nextPageToken: string | null = "";
  const tokens = new Set<string>();
  const videos = new Map<string, YouTubeVideo>();
  let valid = true;
  await forEachBackground(pages, (page, index) => {
    if (!page || page.version !== YOUTUBE_IMPORT_CHECKPOINT_VERSION || page.sourceId !== sourceId || page.identity !== identity
      || page.index !== index || index > 99_999_999 || nextPageToken === null || page.requestToken !== nextPageToken || tokens.has(page.requestToken)
      || !Number.isFinite(Date.parse(page.savedAt)) || (committedAt && Date.parse(page.savedAt) <= Date.parse(committedAt))
      || !(page.nextPageToken === null || typeof page.nextPageToken === "string" && page.nextPageToken.length > 0 && page.nextPageToken.length <= 4096)
      || !Array.isArray(page.videos) || page.videos.length > 50 || !page.videos.every(video => validVideo(video, sourceId))) { valid = false; return false; }
    tokens.add(page.requestToken);
    if (page.nextPageToken !== null && tokens.has(page.nextPageToken)) { valid = false; return false; }
    page.videos.forEach(video => videos.set(video.id, video));
    nextPageToken = page.nextPageToken;
  }, cancellation);
  if (!valid) {
    checkBackgroundCancellation(cancellation);
    await store?.clear(sourceId);
    pages.length = 0; tokens.clear(); videos.clear(); nextPageToken = "";
  }
  return {
    get nextPageToken() { return nextPageToken; },
    get videos() { return [...videos.values()]; },
    async append(records: YouTubeVideo[], next: string | null) {
      checkBackgroundCancellation(cancellation);
      if (!(next === null || typeof next === "string" && next.length > 0 && next.length <= 4096)) throw new Error("YouTube returned an invalid continuation token. The checkpoint was not advanced.");
      if (nextPageToken === null || tokens.has(nextPageToken) || next !== null && (next === nextPageToken || tokens.has(next))) throw new Error("YouTube repeated an import page. Retry the source to restart safely.");
      if (records.length > 50 || !records.every(video => validVideo(video, sourceId))) throw new Error("YouTube returned invalid import metadata. The checkpoint was not advanced.");
      const page: YouTubeImportPage = { version: YOUTUBE_IMPORT_CHECKPOINT_VERSION, sourceId, identity, index: pages.length,
        requestToken: nextPageToken, nextPageToken: next, videos: records, savedAt: new Date().toISOString() };
      // Advance memory/progress only after the entire envelope commits.
      await store?.save(page);
      pages.push(page); tokens.add(page.requestToken); records.forEach(video => videos.set(video.id, video)); nextPageToken = next;
    }
  };
}
