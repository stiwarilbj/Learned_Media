import { performanceFetch, recordPerformance, diagnosticTextBytes } from "./performance-diagnostics";
import { backgroundRetryDelay, serverRetryAt, waitForBackgroundRetry } from "./background-retry";
import { withYouTubeImportLease, youtubeCatalogCommitId, subscribeYouTubeImportChanges } from "./youtube-import-lease";
import { createDatabaseConnection } from "./indexed-db";
import { makeLocalVideoPlan, searchSemanticVideos, semanticCoverage } from "./video-semantic";
import { reuseUnchangedVideoRecordsYielding } from "./video-metadata";
import { checkBackgroundCancellation, forEachBackground, yieldBackground } from "./background-work";
import { YOUTUBE_IMPORT_PAGE_PREFIX, importPageIdentity, openImportCheckpoint, type YouTubeImportPageStore } from "./youtube-import-checkpoints";
import { restoreStoredCatalog, videoRecordRange, type StoredVideo } from "./youtube-catalog-storage";
import { ConditionalDownloadCache } from "./conditional-download";
import { requestCacheScope } from "./session-cache";
export type YouTubeTopic = "History" | "Politics" | "Geography" | "Science" | "Nature" | "Mathematics" | "Literature" | "Sports" | "Culture" | "Technology";

export type ApprovedChannelSeed = {
  name: string;
  handle?: string;
  channelId?: string;
  titleAliases?: string[];
  playlistIds?: string[];
};

export type ApprovedVideoSeed = {
  creator: string;
  title: string;
  videoId?: string;
};

export type YouTubeChannelRecord = {
  id: string;
  name: string;
  handle?: string;
  thumbnailUrl?: string;
  uploadsPlaylistId?: string;
  videoCount: number;
  approved: true;
  lastImportedAt?: string;
  sourceKind?: "uploads" | "playlists";
  approvedPlaylistIds?: string[];
};

export type YouTubeVideo = {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  durationSeconds: number;
  durationLabel: string;
  thumbnailUrl?: string;
  embedAvailable: boolean;
  topics: YouTubeTopic[];
  approved: true;
  special?: boolean;
  sourceIds?: string[];
  metadataRefreshedAt?: string;
};

export type YouTubeSourceState = {
  sourceId: string;
  label: string;
  kind: "uploads" | "playlist" | "individual";
  status: "ready" | "error";
  lastSuccessfulSyncAt?: string;
  lastAttemptedSyncAt?: string;
  importedVideoCount?: number;
  error?: string;
};

export type YouTubeWorkspaceState = {
  channels: YouTubeChannelRecord[];
  videos: YouTubeVideo[];
  savedIds: string[];
  history: Array<{ videoId: string; watchedAt: string }>;
  playbackPositions: Record<string, number>;
  searchText: string;
  selectedTopic: YouTubeTopic | "All";
  activeTab: "discover" | "channels" | "saved" | "history";
  selectedChannelId?: string;
  selectedVideoId?: string;
  discoverIds: string[];
  channelOrder: "relevance" | "newest" | "oldest" | "random";
  prioritizeRecentByChannel: Record<string, boolean>;
  /** Catalog-wide legacy defaults retained only in memory when switching workspace activity. */
  legacyPrioritizeRecentByChannel?: Record<string, boolean>;
  libraryIncomplete: boolean;
  lastSyncAt?: string;
  catalogVersion: number;
  sourceStates: Record<string, YouTubeSourceState>;
};

export type YouTubeActivityState = Pick<YouTubeWorkspaceState, "savedIds" | "history" | "playbackPositions" | "searchText" | "selectedTopic" | "activeTab" | "selectedChannelId" | "selectedVideoId" | "discoverIds" | "channelOrder" | "prioritizeRecentByChannel">;

export type YouTubeImportProgress = {
  phase: "idle" | "resolving" | "importing" | "complete" | "paused" | "error";
  completedChannels: number;
  totalChannels: number;
  importedVideos: number;
  completedSources?: number;
  totalSources?: number;
  currentSource?: string;
  error?: string;
  paused?: boolean;
};

type ProgressFrame = { kind: "animation" | "timeout"; id: number | ReturnType<typeof setTimeout> };

function scheduleYouTubeProgressFrame(callback: () => void): ProgressFrame {
  if (typeof requestAnimationFrame === "function") return { kind: "animation", id: requestAnimationFrame(callback) };
  return { kind: "timeout", id: setTimeout(callback, 16) };
}

function cancelYouTubeProgressFrame(frame: ProgressFrame) {
  if (frame.kind === "animation" && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame.id as number);
  else clearTimeout(frame.id as ReturnType<typeof setTimeout>);
}

/**
 * Keeps the latest import progress while limiting presentation updates to one per frame.
 * Phase changes and terminal states flush immediately so controls stay responsive.
 */
export function createYouTubeProgressStore(initial: YouTubeImportProgress, scheduleFrame = scheduleYouTubeProgressFrame, cancelFrame = cancelYouTubeProgressFrame) {
  let snapshot = initial;
  let latest = initial;
  let frame: ProgressFrame | null = null;
  const listeners = new Set<() => void>();

  const flush = () => {
    frame = null;
    if (snapshot === latest) return;
    snapshot = latest;
    listeners.forEach((listener) => listener());
  };

  const publish = (next: YouTubeImportProgress, immediate = false) => {
    const phaseChanged = next.phase !== latest.phase;
    latest = next;
    const terminal = next.phase === "idle" || next.phase === "complete" || next.phase === "paused" || next.phase === "error";
    if (immediate || phaseChanged || terminal) {
      if (frame) cancelFrame(frame);
      flush();
      return;
    }
    if (!frame) frame = scheduleFrame(flush);
  };

  const update = (change: (current: YouTubeImportProgress) => YouTubeImportProgress, immediate = false) => {
    publish(change(latest), immediate);
  };

  return {
    getSnapshot: () => snapshot,
    getLatest: () => latest,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish,
    update,
    flush
  };
}

/** Memoizes a derived video list by shallow identity of its source inputs. */
export function createYouTubeListMemo<T>() {
  let previousKey: readonly unknown[] | undefined;
  let previousValue: T;
  return (key: readonly unknown[], create: () => T): T => {
    if (previousKey && previousKey.length === key.length && key.every((value, index) => Object.is(value, previousKey![index]))) return previousValue;
    previousKey = key;
    previousValue = create();
    return previousValue;
  };
}

export function partitionYouTubeVideoResults<T extends Pick<YouTubeVideo, "id">>(videos: T[], reasons?: Record<string, { relevance?: string } | undefined>) {
  let strong: T[] | undefined;
  let broader: T[] | undefined;
  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    if (reasons?.[video.id]?.relevance === "broader") {
      if (!broader) {
        strong = videos.slice(0, index);
        broader = [];
      }
      broader.push(video);
    } else if (strong) {
      strong.push(video);
    }
  }
  return strong && broader ? { strong, broader } : { strong: videos, broader: [] as T[] };
}

export type YouTubeSearchConceptGroup = {
  related?: string[];
  label?: string;
  terms: string[];
  required?: boolean;
};

export type YouTubeSearchPlanLike = {
  terms?: string[];
  include?: string[];
  alternatives?: string[];
  exclude?: string[];
  topics?: string[];
  topicHints?: string[];
  conceptGroups?: YouTubeSearchConceptGroup[];
  anyOf?: number[][];
  channel?: string;
  channelId?: string;
  dateIntent?: "upload" | "event" | "either";
  minDate?: string;
  maxDate?: string;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  sort?: "relevance" | "newest" | "oldest" | "random";
};

export type YouTubeSearchCandidate = {
  coverage?: { matchedConcepts: number[]; missingConcepts: number[]; complete: boolean };
  video: YouTubeVideo;
  score: number;
  matchedFields: string[];
  supportingText: string[];
};

export const YOUTUBE_TOPICS: YouTubeTopic[] = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"];

export const YOUTUBE_CATALOG_VERSION = 5;

// Pin the approved channel IDs so lookalike channel names cannot redirect an
// import, and channel resolution does not spend YouTube search quota.
export const APPROVED_YOUTUBE_CHANNELS: ApprovedChannelSeed[] = [
  { name: "History Matters", channelId: "UC22BdTgxefuvUivrjesETjg" },
  { name: "Election History", channelId: "UCKfTfhaihmkvdvPF5DSGaow" },
  { name: "Secret Base", channelId: "UCDRmGMSgrtZkOsh_NQl4_xw" },
  { name: "Geo History", channelId: "UC2Cl2g2xFTZoAEldxYVzQFg" },
  { name: "Great Books Explained", channelId: "UCSzITlgppFAIRbQGIwcInCA" },
  { name: "BooneU", channelId: "UC7ZwKfpjiQEaZpdPql7VVPA" },
  { name: "Joon Lee", channelId: "UC8Ks8V76mHziboEtTAwMV8A" },
  { name: "TLDR News Global", channelId: "UC-uhvujip5deVcEtLxnW8qg" },
  { name: "Mr. Beat", channelId: "UCmYesELO6axBrCuSpf7S9DQ" },
  { name: "The Generalist Papers", channelId: "UCN9UPjA8I-uwvAy0-N9maOA" },
  { name: "CGP Grey", handle: "@CGPGrey", channelId: "UC2C_jShtL725hvbm1arSV9w" },
  { name: "Power Politics", channelId: "UCy0vqn9lOSWBToKU5ggTOUw" },
  { name: "Half as Interesting", channelId: "UCuCkxoKLYO_EQ2GeFtbM_bw" },
  { name: "Hoser", channelId: "UCAiEWppTvoNSHU939xhMb2g" },
  { name: "The History Guy: History Deserves to Be Remembered", channelId: "UC4sEmXUuWIFlxRIFBRV6VXQ" },
  { name: "History Buffs Hub", channelId: "UC2P1qb3jXoTnh3D16O1x7hQ" },
  { name: "Ceramic", handle: "@ceramic01", channelId: "UC01XCPlLs4ysH9LYs6Y4J6A" },
  { name: "Reading Through History", channelId: "UChyG2JVCWQACzzTbzS3Z3jg" },
  { name: "Atlas Pro", channelId: "UCz1oFxMrgrQ82-276UCOU9w" },
  { name: "African Biographics", channelId: "UCJmmxwdAsR7lD8fBA_qbEMw" },
  { name: "Phil Edwards", channelId: "UCb_MAhL8Thb3HJ_wPkH3gcw" },
  { name: "Tor’s Cabinet of Curiosities", channelId: "UC8oMvYlwaS7m5VpMwOTvgzw" },
  { name: "Extra History", channelId: "UCCODtTcd5M1JavPCOr_Uydg" },
  { name: "Justin Portela", channelId: "UChMicznKldDUO5vxIzu2L0w" },
  { name: "Patrick Kelly", handle: "@PatKellyTeaches", channelId: "UCXGtJRfZ_pmJgKKE67PeCEA" },
  { name: "Historically", channelId: "UCoZd78hRUdxxsuGiABuHF_A" },
  { name: "Mental Floss", channelId: "UCpZ5qUqpW4hW4zdfuBxMSJA" },
  { name: "Crash Course", handle: "@crashcourse", channelId: "UCX6b17PVsYBQ0ip5gyeme-Q", titleAliases: ["CrashCourse"] },
  { name: "SciShow", channelId: "UCZYTClx2T1of7BRZ86-8fow" },
  { name: "OverSimplified", channelId: "UCNIuvl7V8zACPpTmmNIqP2A" },
  { name: "vlogbrothers", channelId: "UCGaVdbSav8xWuFWTadK6loA" },
  { name: "Sam O’Nella Academy", channelId: "UC1DTYW241WD64ah5BFWn4JA" },
  { name: "3Blue1Brown", channelId: "UCYO_jab_esuFRV4b17AJtAw", playlistIds: ["PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"] },
  { name: "Shawn Grows", channelId: "UCzOXodveGcVO5xqLyc5l_Zg" },
  { name: "General Knowledge", channelId: "UCnD4jogYqIgUWY1ZYPU-Dew" },
  { name: "Jay Hona", channelId: "UCxSn-rKHu1FUFxjHyY1nKmw" },
  { name: "Veritasium", channelId: "UCHnyfMqiRRG1u-2MsSQLbXA" },
  { name: "theweeklyjack", handle: "@theweeklyjack1", channelId: "UCMWYB9dXQtv_1t_DgyhSWeg" },
  { name: "Jackdaw", handle: "@JackdawJPG", channelId: "UCvhjLch7MMc9O8toGFW0hSg" },
  { name: "Grist", handle: "@Grist", channelId: "UC7ga3FLMFOOpMQwaYoW42bw" },
  { name: "Bizarre Beasts", channelId: "UC9Lp_AA5M2cMGrlvnnIns-g" },
  { name: "Ze Frank", channelId: "UCVpankR4HtoAVtYnFDUieYA" },
  { name: "Make Thing With Hand", channelId: "UCP8HNHLFff9xAtKHS0a0qGQ" },
  { name: "Be Smart", channelId: "UCH4BNI0-FOK2dMXoFtViWHw" },
  { name: "PBS Eons", channelId: "UCzR-rom72PHN9Zg7RML9EbA" },
  { name: "Deep Look", channelId: "UC-3SbfTPJsL8fJAPKiVqBLg" },
  { name: "MinuteEarth", channelId: "UCeiYXex_fwgYDonaTcSIk6w" },
  { name: "minutephysics", channelId: "UCUHW94eEFW7hkUMVaZz4eDg" },
  { name: "Brailor", channelId: "UCufSP4vHIwEWyL5pQ_s1Geg" },
  { name: "hydn", channelId: "UCc2ujf1IwvhGv0co1FzkDkQ" },
  { name: "ExtinctZoo", handle: "@ExtinctZoo", channelId: "UC0ggS8bt4v7NiZpDfGqNpZQ" },
  { name: "PBS Terra", handle: "@pbsterra", channelId: "UCpxYSWgxVt3Pyn1ovXsGQ0g" },
  { name: "PolyMatter", handle: "@PolyMatter", channelId: "UCgNg3vwj3xt7QOrcIDaHdFg" },
  { name: "AlternateHistoryHub", handle: "@AlternateHistoryHub", channelId: "UClfEht64_NrzHf8Y0slKEjw" },
  { name: "J.J. McCullough", handle: "@JJMcCullough", channelId: "UCyhOl6uRlxryALlT5yifldw" },
  { name: "Primer", handle: "@PrimerBlobs", channelId: "UCKzJFdi57J53Vr_BkTfN3uQ" },
  { name: "Primal Space", handle: "@primalspace", channelId: "UClZbmi9JzfnB2CEb0fG8iew" },
  { name: "Mitsi Studio", handle: "@mitsistudio", channelId: "UCuXCgyOCMXic7j0_wghXnRA" },
  { name: "Jabroni Baseball", handle: "@JabroniBaseball", channelId: "UCfBXZotQqPlpDWXTbRbi2qA" }
];

export const DEFAULT_YOUTUBE_RECENCY_PREFERENCES: Record<string, boolean> = Object.fromEntries(
  APPROVED_YOUTUBE_CHANNELS.map(({ name }) => [name, name === "Crash Course" || name === "Mental Floss"])
);

export function mergeYouTubeRecencyPreferences(
  legacy: Partial<Record<string, boolean>> = {},
  activeWorkspace: Partial<Record<string, boolean>> = {}
): Record<string, boolean> {
  const merged = { ...DEFAULT_YOUTUBE_RECENCY_PREFERENCES };
  for (const preferences of [legacy, activeWorkspace]) {
    for (const [channel, enabled] of Object.entries(preferences)) if (typeof enabled === "boolean") merged[channel] = enabled;
  }
  return merged;
}

// Individual videos are intentionally separate from the channel catalog.
// Unknown IDs are resolved by an exact title + creator search and never by a
// broad recommendation query.
export const APPROVED_INDIVIDUAL_VIDEOS: ApprovedVideoSeed[] = [
  { creator: "melodysheep", title: "TIMELAPSE OF THE ENTIRE UNIVERSE", videoId: "TBikbn5XJhg" },
  { creator: "melodysheep", title: "TIMELAPSE OF THE UNIVERSE: 13 Billion Years in 10 Minutes • Updated and Remastered", videoId: "QTQVZuBV9oA" },
  { creator: "Ollie Bye", title: "The History of the World: Every Year", videoId: "-6Wu0Q7x5D0" },
  { creator: "Ollie Bye", title: "Top 5 Tallest Buildings Throughout History", videoId: "0MobSmVpvTM" },
  { creator: "Ollie Bye", title: "The Largest Cities Throughout History: Every Year", videoId: "kptMVQRud5c" },
  { creator: "Ollie Bye", title: "The Spread of Writing: Every Year", videoId: "eUpJ4yVCNrI" },
  { creator: "American Museum of Natural History", title: "Human Population Through Time (Updated in 2023)", videoId: "vJ5p3pZlBi4" }
];

const APPROVED_3BLUE_PLAYLIST_SOURCE_IDS = new Set((APPROVED_YOUTUBE_CHANNELS.find((seed) => seed.name === "3Blue1Brown")?.playlistIds ?? []).map((id) => `playlist:${id}`));

export const DEFAULT_YOUTUBE_WORKSPACE: YouTubeWorkspaceState = {
  channels: [], videos: [], savedIds: [], history: [], playbackPositions: {}, searchText: "", selectedTopic: "All", activeTab: "discover", channelOrder: "newest", discoverIds: [], prioritizeRecentByChannel: DEFAULT_YOUTUBE_RECENCY_PREFERENCES, libraryIncomplete: false, catalogVersion: YOUTUBE_CATALOG_VERSION, sourceStates: {}
};

const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  status?: number;
  reason?: string;
  retryable: boolean;
  retryAt?: number;

  constructor(message: string, status?: number, reason?: string, retryable = false, retryAt?: number) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
    this.retryAt = retryAt;
  }
}

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function matchesApprovedChannelTitle(value: string, seed: ApprovedChannelSeed) {
  return [seed.name, ...(seed.titleAliases ?? [])].some((title) => normalized(value) === normalized(title));
}

function normalizedApprovedVideoTitle(value: string) {
  return normalized(value.replace(/(?:\s+#[^\s#]+)+\s*$/u, ""));
}

function abortError() {
  return new YouTubeApiError("YouTube request canceled.", undefined, "canceled", false);
}

class YouTubeRequestLimiter {
  private permits = 4;
  private waiters: Array<{ resolve: () => void; reject: (reason: unknown) => void; signal?: AbortSignal; onAbort?: () => void }> = [];

  private remove(waiter: { resolve: () => void; reject: (reason: unknown) => void; signal?: AbortSignal; onAbort?: () => void }) {
    const index = this.waiters.indexOf(waiter);
    if (index >= 0) this.waiters.splice(index, 1);
    waiter.signal?.removeEventListener("abort", waiter.onAbort as EventListener);
  }

  async acquire(signal?: AbortSignal) {
    if (signal?.aborted) throw abortError();
    if (this.permits > 0) {
      this.permits -= 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const waiter: { resolve: () => void; reject: (reason: unknown) => void; signal?: AbortSignal; onAbort?: () => void } = { resolve, reject, signal };
      waiter.onAbort = () => { this.remove(waiter); reject(abortError()); };
      this.waiters.push(waiter);
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
    });
  }

  release() {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.signal?.removeEventListener("abort", waiter.onAbort as EventListener);
      waiter.resolve();
    } else {
      this.permits += 1;
    }
  }

  async run<T>(signal: AbortSignal | undefined, work: () => Promise<T>) {
    const queuedAt = performance.now();
    await this.acquire(signal);
    recordPerformance("youtube", "queue_ms", Math.max(0, performance.now() - queuedAt));
    try {
      return await work();
    } finally {
      this.release();
    }
  }
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  return { controller, cleanup: () => { window.clearTimeout(timer); signal?.removeEventListener("abort", abort); } };
}

const youtubeDownloads = new ConditionalDownloadCache();

async function fetchYouTubeJson<T>(apiKey: string, resource: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${YOUTUBE_API_ROOT}/${resource}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.sort();
  // The page context also scopes the browser-supplied Origin/Referer headers.
  const pageContext = typeof window === "undefined" ? "" : window.location.href;
  const cacheKey = JSON.stringify([requestCacheScope("youtube-http-v1", apiKey), url.toString(), pageContext]);
  const conditional = youtubeDownloads.prepare(cacheKey, { accept: "application/json", "x-goog-api-key": apiKey });
  const timeout = withTimeout(signal);
  try {
    if (signal?.aborted) throw abortError();
    const response = await performanceFetch("youtube", url, { headers: conditional.headers, cache: "no-store", signal: timeout.controller.signal });
    if (signal?.aborted) throw abortError();
    const retryAt = serverRetryAt(response.headers.get("retry-after"));
    const reused = youtubeDownloads.notModified(cacheKey, response, conditional.previous);
    if (response.status === 304 && reused === undefined) throw new YouTubeApiError("YouTube returned Not Modified without a validated response.", 304, "missingCachedResponse", true);
    const raw = reused ?? await response.text();
    if (signal?.aborted) throw abortError();
    recordPerformance("youtube", "response_bytes_read", reused === undefined ? diagnosticTextBytes(raw) : 0);
    if (reused !== undefined) recordPerformance("youtube", "cache_hits");
    let payload: unknown = {};
    try { payload = JSON.parse(raw); } catch { youtubeDownloads.discard(cacheKey); throw new YouTubeApiError("YouTube returned malformed data.", response.status, "malformed", true, retryAt); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      youtubeDownloads.discard(cacheKey);
      throw new YouTubeApiError("YouTube returned malformed data.", response.status, "malformed", true, retryAt);
    }
    if (!response.ok && response.status !== 304) {
      const error = (payload as { error?: { message?: string; errors?: Array<{ reason?: string }> } }).error;
      const reason = error?.errors?.[0]?.reason;
      const message = error?.message || `YouTube returned HTTP ${response.status}.`;
      const quotaExhausted = reason === "quotaExceeded" || reason === "dailyLimitExceeded";
      const rateLimited = reason === "rateLimitExceeded" || reason === "userRateLimitExceeded";
      const retryable = !quotaExhausted && (rateLimited || response.status === 408 || response.status === 429 || response.status >= 500);
      throw new YouTubeApiError(quotaExhausted ? "YouTube API quota is exhausted. Resume tomorrow after the quota resets." : message, response.status, reason, retryable, retryAt);
    }
    const list = payload as { items?: unknown; nextPageToken?: unknown; etag?: unknown; error?: unknown } | null;
    if (reused === undefined && response.status === 200 && list && typeof list === "object" && !Array.isArray(list)
      && list.error === undefined && Array.isArray(list.items) && list.items.every(item => !!item && typeof item === "object" && !Array.isArray(item))
      && (list.nextPageToken === undefined || typeof list.nextPageToken === "string")) {
      youtubeDownloads.validated(cacheKey, response.headers, raw, typeof list.etag === "string" ? list.etag : undefined);
    } else if (reused === undefined) youtubeDownloads.discard(cacheKey);
    return payload as T;
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (error instanceof DOMException && error.name === "AbortError") throw new YouTubeApiError("YouTube request timed out. Retrying may help.", undefined, "timeout", true);
    if (error instanceof TypeError) throw new YouTubeApiError("Could not reach YouTube. Check the connection and retry.", undefined, "network", true);
    throw error;
  } finally {
    timeout.cleanup();
  }
}

function parseDuration(value: string | undefined) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function hasExplicitShortMarker(title: string, description: string, tags: string[]) {
  return /(?:^|[^a-z0-9])#shorts?\b/i.test(`${title}\n${description}`)
    || /\byoutube shorts?\b|\bshorts video\b/i.test(title)
    || tags.some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalized(tag)));
}

function isYouTubeShortMetadata(video: { title: string; description: string; tags: string[]; publishedAt: string; durationSeconds: number; thumbnails?: Array<YouTubeThumbnail | undefined> }) {
  if (hasExplicitShortMarker(video.title, video.description, video.tags)) return true;

  // Shorts published before 15 October 2024 are limited to 60 seconds; later
  // Shorts can be up to three minutes. The Data API has no isShort field, so
  // combine that duration rule with the aspect ratio reported for thumbnails.
  const publishedAt = Date.parse(video.publishedAt);
  const threeMinuteShortsLaunch = Date.parse("2024-10-15T00:00:00Z");
  const maxShortDuration = publishedAt >= threeMinuteShortsLaunch ? 180 : 60;
  if (!Number.isFinite(publishedAt) || video.durationSeconds <= 0 || video.durationSeconds > maxShortDuration) return false;

  return (video.thumbnails ?? []).some((thumbnail) => {
    if (!thumbnail?.width || !thumbnail.height) return false;
    return thumbnail.width / thumbnail.height <= 1.05;
  });
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function classifyTopics(channelName: string, title: string, description: string, tags: string[]): YouTubeTopic[] {
  const text = normalized([channelName, title, description, ...tags].join(" "));
  const rules: Array<[YouTubeTopic, string[]]> = [
    ["History", ["history", "historical", "war", "empire", "ancient", "president", "revolution"]],
    ["Politics", ["politics", "election", "government", "congress", "policy", "democracy"]],
    ["Geography", ["geography", "map", "country", "city", "border", "earth", "geographic"]],
    ["Science", ["science", "physics", "biology", "chemistry", "experiment", "evolution"]],
    ["Nature", ["nature", "animal", "wildlife", "beast", "ocean", "plant", "extinct"]],
    ["Mathematics", ["math", "mathematics", "number", "geometry", "calculus", "probability"]],
    ["Literature", ["book", "books", "poem", "literature", "novel", "author", "writing"]],
    ["Sports", ["sports", "baseball", "football", "basketball", "soccer", "athlete"]],
    ["Culture", ["culture", "music", "film", "art", "language", "food"]],
    ["Technology", ["technology", "computer", "internet", "engineering", "software", "device"]]
  ];
  const matches: YouTubeTopic[] = rules.filter(([, words]) => words.some((word) => text.includes(word))).map(([topic]) => topic);
  return matches.length ? matches : ["Culture"];
}

type ChannelApiResponse = { items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }> };
type PlaylistApiResponse = { nextPageToken?: string; items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string } }> };
type YouTubeThumbnail = { url?: string; width?: number; height?: number };
type VideoApiResponse = { items?: Array<{ id?: string; snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string; channelTitle?: string; tags?: string[]; thumbnails?: { high?: YouTubeThumbnail; medium?: YouTubeThumbnail; default?: YouTubeThumbnail; standard?: YouTubeThumbnail; maxres?: YouTubeThumbnail } }; contentDetails?: { duration?: string }; status?: { privacyStatus?: string; embeddable?: boolean } }> };
type VideoMetadataLoader = (ids: string[]) => Promise<NonNullable<VideoApiResponse["items"]>>;
type SearchApiResponse = { items?: Array<{ id?: { channelId?: string; videoId?: string }; snippet?: { title?: string; channelTitle?: string; channelId?: string } }> };
type CatalogJob = { sourceId: string; label: string; kind: "uploads" | "playlist" | "individual"; channel?: YouTubeChannelRecord; playlistId?: string; seed?: ApprovedVideoSeed };

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const result = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      result[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return result;
}

// Keep search, identity checks, pagination, and Shorts metadata in partial responses.
const YOUTUBE_RESPONSE_FIELDS: Record<string, string> = {
  channels: "etag,items(id,snippet(title,customUrl,thumbnails),contentDetails(relatedPlaylists(uploads)))",
  search: "etag,items(id(channelId,videoId),snippet(title,channelTitle,channelId))",
  playlistItems: "etag,nextPageToken,items(contentDetails(videoId),snippet(title,description))",
  videos: "etag,items(id,snippet(channelId,channelTitle,title,description,tags,publishedAt,thumbnails),contentDetails(duration),status(privacyStatus,embeddable))",
};

export class YouTubeClient {
  private readonly limiter = new YouTubeRequestLimiter();

  constructor(private readonly apiKey: string, private readonly requestOverride?: (resource: string, params: Record<string, string>, signal?: AbortSignal) => Promise<unknown>, private readonly beforeRequest?: () => Promise<void>) {}

  private request<T>(resource: string, params: Record<string, string>, signal?: AbortSignal) {
    const fields = YOUTUBE_RESPONSE_FIELDS[resource];
    const requestParams = fields ? { ...params, fields } : params;
    return this.limiter.run(signal, async () => {
      let attempt = 0;
      while (true) {
        try {
          if (signal?.aborted) throw abortError();
          await this.beforeRequest?.();
          if (signal?.aborted) throw abortError();
          if (attempt > 0) recordPerformance("youtube", "retries");
          if (this.requestOverride) return await this.requestOverride(resource, requestParams, signal) as T;
          return await fetchYouTubeJson<T>(this.apiKey, resource, requestParams, signal);
        } catch (error) {
          if (!(error instanceof YouTubeApiError) || !error.retryable || attempt >= 2) throw error;
          await waitForBackgroundRetry(backgroundRetryDelay(500 * (2 ** attempt), error.retryAt), signal);
          attempt += 1;
        }
      }
    });
  }

  async resolveChannel(seed: ApprovedChannelSeed, signal?: AbortSignal): Promise<YouTubeChannelRecord> {
    let payload: ChannelApiResponse;
    if (seed.channelId) {
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", id: seed.channelId }, signal);
    } else if (seed.handle) {
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", forHandle: seed.handle.replace(/^@/, "") }, signal);
    } else {
      const search = await this.request<SearchApiResponse>("search", { part: "snippet", q: seed.name, type: "channel", maxResults: "8" }, signal);
      const candidate = (search.items ?? []).find((item) => matchesApprovedChannelTitle(item.snippet?.title ?? "", seed));
      if (!candidate?.id?.channelId) throw new YouTubeApiError(`Could not verify the approved channel “${seed.name}”.`, undefined, "channel-not-found", false);
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", id: candidate.id.channelId }, signal);
    }
    const item = payload.items?.[0];
    if (!item?.id || (seed.channelId && item.id !== seed.channelId) || !matchesApprovedChannelTitle(item.snippet?.title ?? "", seed)) throw new YouTubeApiError(`YouTube returned a different channel for “${seed.name}”.`, undefined, "channel-mismatch", false);
    return { id: item.id, name: seed.name, handle: item.snippet?.customUrl ?? seed.handle, thumbnailUrl: item.snippet?.thumbnails?.default?.url, uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads, videoCount: 0, approved: true, sourceKind: seed.playlistIds?.length ? "playlists" : "uploads", approvedPlaylistIds: seed.playlistIds };
  }

  private createMetadataLoader(signal?: AbortSignal): VideoMetadataLoader {
    // Share raw metadata within one import, keeping approval decisions source-specific.
    const pending = new Map<string, Promise<NonNullable<VideoApiResponse["items"]>[number] | undefined>>();
    return async (ids) => {
      const uniqueIds = Array.from(new Set(ids));
      const missing = uniqueIds.filter((id) => !pending.has(id));
      for (let offset = 0; offset < missing.length; offset += 50) {
        const batch = missing.slice(offset, offset + 50);
        const response = this.request<VideoApiResponse>("videos", { part: "snippet,contentDetails,status", id: batch.join(",") }, signal)
          .then((payload) => {
            if (!payload || !Array.isArray(payload.items)) throw new YouTubeApiError("YouTube returned invalid video metadata. The checkpoint was not advanced.", undefined, "malformed-metadata", false);
            return new Map(payload.items.map((item) => [item.id, item]));
          });
        batch.forEach((id) => pending.set(id, response.then((items) => items.get(id))));
      }
      const items = await Promise.all(uniqueIds.map((id) => pending.get(id)!));
      return items.filter((item): item is NonNullable<typeof item> => Boolean(item));
    };
  }

  private async importPlaylist(channel: YouTubeChannelRecord, playlistId: string, sourceId: string, metadata: VideoMetadataLoader, signal?: AbortSignal,
    onPage?: (count: number) => void, pages?: YouTubeImportPageStore, committedAt?: string) {
    const identity = importPageIdentity(YOUTUBE_CATALOG_VERSION, channel.id, playlistId);
    let checkpoint = await openImportCheckpoint(pages, sourceId, identity, committedAt, signal);
    let restarted = false;
    while (checkpoint.nextPageToken !== null) {
      if (signal?.aborted) throw abortError();
      const pageToken = checkpoint.nextPageToken;
      let payload: PlaylistApiResponse;
      try {
        payload = await this.request<PlaylistApiResponse>("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }, signal);
      } catch (error) {
        if (pageToken && !restarted && error instanceof YouTubeApiError && error.reason === "invalidPageToken") {
          checkBackgroundCancellation(signal);
          await pages?.clear(sourceId);
          checkpoint = await openImportCheckpoint(pages, sourceId, identity, committedAt, signal); restarted = true;
          continue;
        }
        throw error;
      }
      if (!payload || !Array.isArray(payload.items) || payload.nextPageToken !== undefined && typeof payload.nextPageToken !== "string") throw new YouTubeApiError("YouTube returned an invalid import page. Its checkpoint was not advanced.", undefined, "malformed-page", false);
      const ids: string[] = [];
      for (const item of payload.items ?? []) {
        const videoId = item.contentDetails?.videoId;
        if (!videoId || hasExplicitShortMarker(item.snippet?.title ?? "", item.snippet?.description ?? "", [])) continue;
        ids.push(videoId);
      }
      const items = await metadata(ids);
      if (signal?.aborted) throw abortError();
      await checkpoint.append(this.mapPlaylistPage(items, channel, sourceId), payload.nextPageToken || null);
      if (onPage) onPage(checkpoint.videos.length);
      await yieldBackground(signal);
    }
    return checkpoint.videos;
  }

  private mapPlaylistPage(items: Awaited<ReturnType<VideoMetadataLoader>>, channel: YouTubeChannelRecord, sourceId: string) {
    const mapped: YouTubeVideo[] = [];
    items.forEach((item) => {
      if (!item.id || item.status?.privacyStatus && item.status.privacyStatus !== "public" || item.snippet?.channelId !== channel.id) return;
      const snippet = item.snippet;
      const durationSeconds = parseDuration(item.contentDetails?.duration);
      const title = snippet?.title?.trim();
      if (!title || !snippet?.publishedAt) return;
      if (isYouTubeShortMetadata({ title, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt, durationSeconds, thumbnails: Object.values(snippet.thumbnails ?? {}) })) return;
      mapped.push({ id: item.id, channelId: channel.id, channelName: channel.name, title, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt, durationSeconds, durationLabel: formatDuration(durationSeconds), thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url, embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(channel.name, title, snippet.description ?? "", snippet.tags ?? []), approved: true, sourceIds: [sourceId], metadataRefreshedAt: new Date().toISOString() });
    });
    return mapped;
  }

  private async importChannel(channel: YouTubeChannelRecord, metadata: VideoMetadataLoader, signal?: AbortSignal, onPage?: (count: number) => void,
    pages?: YouTubeImportPageStore, committedAt?: string) {
    if (!channel.uploadsPlaylistId) throw new YouTubeApiError(`The approved channel “${channel.name}” has no uploads playlist.`, undefined, "uploads-playlist-missing", false);
    return this.importPlaylist(channel, channel.uploadsPlaylistId, `channel:${channel.id}`, metadata, signal, onPage, pages, committedAt);
  }

  private async resolveSpecial(seed: ApprovedVideoSeed, channels: YouTubeChannelRecord[], metadata: VideoMetadataLoader, signal?: AbortSignal): Promise<YouTubeVideo | null> {
    let videoId = seed.videoId;
    if (!videoId) {
      const channel = channels.find((item) => normalized(item.name) === normalized(seed.creator));
      const search = await this.request<SearchApiResponse>("search", { part: "snippet", q: seed.title, type: "video", maxResults: "10", ...(channel ? { channelId: channel.id } : {}) }, signal);
      const found = (search.items ?? []).find((item) => normalizedApprovedVideoTitle(item.snippet?.title ?? "") === normalizedApprovedVideoTitle(seed.title) && normalized(item.snippet?.channelTitle ?? "") === normalized(seed.creator));
      videoId = found?.id?.videoId;
    }
    if (!videoId) throw new YouTubeApiError(`Could not verify the approved video “${seed.title}”.`, undefined, "video-not-found", false);
    const [item] = await metadata([videoId]);
    if (!item?.id || normalizedApprovedVideoTitle(item.snippet?.title ?? "") !== normalizedApprovedVideoTitle(seed.title) || normalized(item.snippet?.channelTitle ?? "") !== normalized(seed.creator)) throw new YouTubeApiError(`The approved video “${seed.title}” did not match its creator and title.`, undefined, "video-mismatch", false);
    const snippet = item.snippet!;
    const durationSeconds = parseDuration(item.contentDetails?.duration);
    if (isYouTubeShortMetadata({ title: snippet.title ?? seed.title, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt ?? "", durationSeconds, thumbnails: Object.values(snippet.thumbnails ?? {}) })) return null;
    return { id: item.id, channelId: snippet.channelId ?? `special-${normalized(seed.creator).replace(/ /g, "-")}`, channelName: snippet.channelTitle ?? seed.creator, title: snippet.title!, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt ?? new Date().toISOString(), durationSeconds, durationLabel: formatDuration(durationSeconds), ...(snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ? { thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url } : {}), embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(seed.creator, snippet.title!, snippet.description ?? "", snippet.tags ?? []), approved: true, special: true, sourceIds: [`individual:${item.id}`], metadataRefreshedAt: new Date().toISOString() } as YouTubeVideo;
  }

  async syncApprovedCatalog(existingChannels: YouTubeChannelRecord[] = [], signal?: AbortSignal, onProgress?: (progress: YouTubeImportProgress) => void, options: { existingVideos?: YouTubeVideo[]; sourceStates?: Record<string, YouTubeSourceState>; force?: boolean; pages?: YouTubeImportPageStore } = {}) {
    checkBackgroundCancellation(signal);
    const metadata = this.createMetadataLoader(signal);
    const existingVideos = options.existingVideos ?? [];
    const sourceStates: Record<string, YouTubeSourceState> = { ...(options.sourceStates ?? {}) };
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const errors: string[] = [];
    const progress: YouTubeImportProgress = { phase: "resolving", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 };
    onProgress?.({ ...progress });
    const channels = await mapWithConcurrency(APPROVED_YOUTUBE_CHANNELS, 4, async (seed, index) => {
      checkBackgroundCancellation(signal);
      const previous = existingChannels.find((item) => normalized(item.name) === normalized(seed.name));
      try {
        const needsPinnedResolution = Boolean(seed.channelId && previous?.id !== seed.channelId);
        const channel = previous?.id && !needsPinnedResolution ? { ...previous, name: seed.name, handle: seed.handle ?? previous.handle, sourceKind: seed.playlistIds?.length ? "playlists" : "uploads", approvedPlaylistIds: seed.playlistIds } : await this.resolveChannel(seed, signal);
        checkBackgroundCancellation(signal);
        progress.completedChannels = index + 1;
        onProgress?.({ ...progress });
        return { seed, channel };
      } catch (error) {
        checkBackgroundCancellation(signal);
        progress.completedChannels = index + 1;
        const message = error instanceof Error ? error.message : `Could not verify ${seed.name}.`;
        errors.push(message);
        progress.error = errors.slice(0, 3).join(" · ");
        onProgress?.({ ...progress });
        const previousIsPinnedMatch = previous?.id && (!seed.channelId || previous.id === seed.channelId);
        return { seed, channel: previousIsPinnedMatch ? { ...previous, name: seed.name } : null };
      }
    });
    const verified = channels.filter((entry): entry is { seed: ApprovedChannelSeed; channel: YouTubeChannelRecord } => Boolean(entry.channel));
    const jobs: CatalogJob[] = [];
    verified.forEach(({ seed, channel }) => {
      if (seed.playlistIds?.length) seed.playlistIds.forEach((playlistId) => jobs.push({ sourceId: `playlist:${playlistId}`, label: `${channel.name} · approved playlist`, kind: "playlist", channel, playlistId }));
      else jobs.push({ sourceId: `channel:${channel.id}`, label: channel.name, kind: "uploads", channel });
    });
    jobs.push(...APPROVED_INDIVIDUAL_VIDEOS.map((seed) => ({ sourceId: `individual:${seed.videoId ?? normalized(seed.title)}`, label: seed.title, kind: "individual" as const, seed })));
    progress.totalSources = jobs.length;
    progress.phase = "importing";
    onProgress?.({ ...progress });
    const imported = await mapWithConcurrency(jobs, 4, async (job) => {
      checkBackgroundCancellation(signal);
      progress.currentSource = job.label;
      const prior = sourceStates[job.sourceId];
      const due = Boolean(options.force || prior?.status === "error" || !prior?.lastSuccessfulSyncAt || now - new Date(prior.lastSuccessfulSyncAt).getTime() >= day || await options.pages?.has(job.sourceId));
      checkBackgroundCancellation(signal);
      if (!due) {
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        onProgress?.({ ...progress });
        return { job, videos: [] as YouTubeVideo[], scanned: false, ok: true };
      }
      try {
        let videos: YouTubeVideo[];
        if (job.kind === "uploads") videos = await this.importChannel(job.channel!, metadata, signal, undefined, options.pages, prior?.lastSuccessfulSyncAt);
        else if (job.kind === "playlist") videos = await this.importPlaylist(job.channel!, job.playlistId!, job.sourceId, metadata, signal, undefined, options.pages, prior?.lastSuccessfulSyncAt);
        else {
          const checkpoint = await openImportCheckpoint(options.pages, job.sourceId, importPageIdentity(YOUTUBE_CATALOG_VERSION, job.seed!.creator, job.seed!.videoId ?? job.seed!.title), prior?.lastSuccessfulSyncAt, signal);
          if (checkpoint.nextPageToken !== null) {
            const specialVideo = await this.resolveSpecial(job.seed!, verified.map((entry) => entry.channel), metadata, signal);
            if (signal?.aborted) throw abortError();
            await checkpoint.append(specialVideo ? [{ ...specialVideo, sourceIds: [job.sourceId] }] : [], null);
          }
          videos = checkpoint.videos;
        }
        checkBackgroundCancellation(signal);
        progress.importedVideos += videos.length;
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "ready", lastSuccessfulSyncAt: new Date().toISOString(), lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: videos.length };
        onProgress?.({ ...progress });
        return { job, videos, scanned: true, ok: true };
      } catch (error) {
        checkBackgroundCancellation(signal);
        const message = error instanceof Error ? error.message : `Could not import ${job.label}.`;
        errors.push(message);
        progress.error = errors.slice(0, 3).join(" · ");
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "error", lastSuccessfulSyncAt: prior?.lastSuccessfulSyncAt, lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: prior?.importedVideoCount, error: message };
        onProgress?.({ ...progress });
        return { job, videos: [] as YouTubeVideo[], scanned: false, ok: false };
      }
    });
    const merged = new Map<string, YouTubeVideo>(), videosBySource = new Map<string, Set<string>>();
    await forEachBackground(existingVideos, video => {
      merged.set(video.id, video);
      for (const sourceId of video.sourceIds ?? []) {
        if (!videosBySource.has(sourceId)) videosBySource.set(sourceId, new Set());
        videosBySource.get(sourceId)!.add(video.id);
      }
    }, signal);
    for (const result of imported) {
      if (!result.scanned || !result.ok) continue;
      const importedIds = new Set<string>();
      await forEachBackground(result.videos, video => { importedIds.add(video.id); }, signal);
      // Only revisit this source's records instead of rescanning the whole library.
      await forEachBackground(videosBySource.get(result.job.sourceId) ?? [], id => {
        const video = merged.get(id);
        if (!importedIds.has(id) && video?.sourceIds?.includes(result.job.sourceId)) {
          const sourceIds = video.sourceIds.filter((sourceId) => sourceId !== result.job.sourceId);
          if (sourceIds.length) merged.set(id, { ...video, sourceIds }); else merged.delete(id);
        }
      }, signal);
      await forEachBackground(result.videos, video => {
        const previous = merged.get(video.id);
        merged.set(video.id, { ...previous, ...video, sourceIds: Array.from(new Set([...(previous?.sourceIds ?? []), result.job.sourceId])) });
      }, signal);
      videosBySource.set(result.job.sourceId, importedIds);
    }
    if (verified.length === APPROVED_YOUTUBE_CHANNELS.length) {
      const activeSourceIds = new Set(jobs.map((job) => job.sourceId));
      await forEachBackground(merged, ([id, video]) => {
        const sourceIds = video.sourceIds ?? [];
        const retainedSourceIds = sourceIds.filter((sourceId) => !/^(?:channel|playlist):/.test(sourceId) || activeSourceIds.has(sourceId));
        if (retainedSourceIds.length === sourceIds.length) return;
        if (retainedSourceIds.length) merged.set(id, { ...video, sourceIds: retainedSourceIds });
        else merged.delete(id);
      }, signal);
      Object.keys(sourceStates).forEach((sourceId) => { if (!activeSourceIds.has(sourceId)) delete sourceStates[sourceId]; });
    }
    const playlistSourceIds = new Set(APPROVED_YOUTUBE_CHANNELS.flatMap((seed) => seed.playlistIds ?? []).map((id) => `playlist:${id}`));
    const threeBlue = APPROVED_YOUTUBE_CHANNELS.find((seed) => seed.name === "3Blue1Brown");
    const allowed: YouTubeVideo[] = [];
    await forEachBackground(merged.values(), video => {
      const approved = threeBlue && (normalized(video.channelName) === normalized(threeBlue.name) || video.channelId === threeBlue.channelId)
        ? video.special === true || video.sourceIds?.some(sourceId => playlistSourceIds.has(sourceId)) : video.approved;
      if (approved) allowed.push(video);
    }, signal);
    const unique = await reuseUnchangedVideoRecordsYielding(existingVideos, allowed, signal);
    const channelCounts = new Map<string, number>();
    await forEachBackground(unique, video => { channelCounts.set(video.channelId, (channelCounts.get(video.channelId) ?? 0) + 1); }, signal);
    const channelsWithCounts = verified.map(({ channel }) => ({ ...channel, videoCount: channelCounts.get(channel.id) ?? 0, lastImportedAt: new Date().toISOString() }));
    const complete = errors.length === 0 && verified.length === APPROVED_YOUTUBE_CHANNELS.length;
    progress.phase = "complete";
    progress.currentSource = undefined;
    progress.error = complete ? undefined : (progress.error ?? "Some approved video sources need a retry.");
    onProgress?.({ ...progress });
    return { channels: channelsWithCounts, videos: unique, sourceStates, incomplete: !complete, progress,
      completedCheckpointSources: imported.filter(result => result.scanned && result.ok).map(result => result.job.sourceId) };
  }
}

const discoveryMetadata = new WeakMap<YouTubeVideo, {
  publishedAt: string; channelName: string; timestamp: number; normalizedChannel: string;
}>();

export function selectRandomVideos(videos: YouTubeVideo[], count: number, exclude: string[] = [], prioritizeRecentByChannel: Record<string, boolean> = {}) {
  const excluded = new Set(exclude);
  const extraRecentBias = new Set(Object.entries(prioritizeRecentByChannel).filter(([, enabled]) => enabled).map(([name]) => normalized(name)));
  const currentTime = Date.now();
  const yearInMs = 365.25 * 24 * 60 * 60 * 1000;
  const targetCount = Math.max(0, Math.floor(count));
  const recentPool: Array<{ video: YouTubeVideo; ageInYears: number; halfLifeInYears: number }> = [];
  const olderPreferredPool: Array<{ video: YouTubeVideo; ageInYears: number; halfLifeInYears: number }> = [];
  for (const video of videos) {
    if (excluded.has(video.id)) continue;
    let metadata = discoveryMetadata.get(video);
    if (!metadata || metadata.publishedAt !== video.publishedAt || metadata.channelName !== video.channelName) {
      metadata = {
        publishedAt: video.publishedAt, channelName: video.channelName,
        timestamp: Date.parse(video.publishedAt), normalizedChannel: normalized(video.channelName)
      };
      discoveryMetadata.set(video, metadata);
    }
    const ageInYears = Number.isFinite(metadata.timestamp) ? Math.max(0, (currentTime - metadata.timestamp) / yearInMs) : 0;
    const recentBias = extraRecentBias.has(metadata.normalizedChannel);
    const candidate = { video, ageInYears, halfLifeInYears: recentBias ? 1.5 : 8 };
    if (recentBias && ageInYears > 5) olderPreferredPool.push(candidate);
    else recentPool.push(candidate);
  }

  // The feed needs only a small random sample from a potentially large
  // imported catalog. A full sort here made choosing the first 24 videos
  // increasingly expensive as the library grew. Keep only the best weighted
  // random keys in a max heap, which bounds work to O(library * log(sample)).
  const weightedSample = (pool: Array<{ video: YouTubeVideo; ageInYears: number; halfLifeInYears: number }>, sampleCount: number) => {
    const limit = Math.min(pool.length, Math.max(0, sampleCount));
    if (!limit) return [];
    if (limit === pool.length) return pool.map(({ video }) => video);

    const heap: Array<{ video: YouTubeVideo; randomKey: number }> = [];
    for (const { video, ageInYears, halfLifeInYears } of pool) {
      const recencyWeight = Math.pow(0.5, ageInYears / halfLifeInYears);
      const random = Math.max(Math.random(), Number.MIN_VALUE);
      const candidate = { video, randomKey: -Math.log(random) / recencyWeight };
      if (heap.length < limit) {
        let index = heap.push(candidate) - 1;
        while (index > 0) {
          const parent = Math.floor((index - 1) / 2);
          if (heap[parent].randomKey >= heap[index].randomKey) break;
          [heap[parent], heap[index]] = [heap[index], heap[parent]];
          index = parent;
        }
        continue;
      }
      if (candidate.randomKey >= heap[0].randomKey) continue;
      heap[0] = candidate;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let largest = index;
        if (left < heap.length && heap[left].randomKey > heap[largest].randomKey) largest = left;
        if (right < heap.length && heap[right].randomKey > heap[largest].randomKey) largest = right;
        if (largest === index) break;
        [heap[index], heap[largest]] = [heap[largest], heap[index]];
        index = largest;
      }
    }
    return heap.map(({ video }) => video);
  };

  const olderVideoLimit = olderPreferredPool.length ? Math.max(1, Math.ceil(targetCount / 24)) : 0;
  const recentVideos = weightedSample(recentPool, Math.max(0, targetCount - olderVideoLimit));
  const olderVideos = weightedSample(olderPreferredPool, Math.min(olderVideoLimit, targetCount - recentVideos.length));
  const selected = [...recentVideos, ...olderVideos];
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [selected[index], selected[swap]] = [selected[swap], selected[index]];
  }
  return selected;
}

/** Synonyms may satisfy required concepts without repeating the user's wording. */
export function strongLocalVideoCandidates(query: string, candidates: YouTubeSearchCandidate[]) {
  return strongLocalVideoPlanCandidates(makeLocalVideoPlan(query), candidates);
}
export function strongLocalVideoPlanCandidates(plan: YouTubeSearchPlanLike, candidates: YouTubeSearchCandidate[]) {
  return candidates.filter((candidate) => semanticCoverage(candidate.video, plan));
}
export function searchYouTubeCandidates(videos: YouTubeVideo[], plan: YouTubeSearchPlanLike, topic: YouTubeTopic | "All" = "All", channelId?: string, limit = 80, excludedIds: string[] = [], _expanded = false): YouTubeSearchCandidate[] {
  return searchSemanticVideos(videos, plan, topic, channelId, limit, excludedIds);
}

export function filterYouTubeVideos(videos: YouTubeVideo[], searchText: string, topic: YouTubeTopic | "All", channelId?: string) {
  const term = normalized(searchText);
  if (!term) return videos.filter((video) => isApprovedYouTubeVideo(video) && (!channelId || video.channelId === channelId) && (topic === "All" || video.topics.includes(topic)));
  return searchYouTubeCandidates(videos, makeLocalVideoPlan(searchText, [], channelId), topic, channelId, Math.min(80, videos.length)).map((candidate) => candidate.video);
}

export function relatedYouTubeVideos(videos: YouTubeVideo[], current: YouTubeVideo, count = 6, prioritizeRecentByChannel: Record<string, boolean> = {}) {
  const shared = videos.filter((video) => video.id !== current.id && isApprovedYouTubeVideo(video) && video.topics.some((topic) => current.topics.includes(topic)));
  return selectRandomVideos(shared, count, [current.id], prioritizeRecentByChannel);
}

export function isApprovedYouTubeVideo(video: YouTubeVideo) {
  if (!video.approved || hasExplicitShortMarker(video.title, video.description, video.tags ?? [])) return false;
  if (normalized(video.channelName) === normalized("3Blue1Brown") || video.channelId === "UCYO_jab_esuFRV4b17AJtAw") return video.special === true || Boolean(video.sourceIds?.some((sourceId) => APPROVED_3BLUE_PLAYLIST_SOURCE_IDS.has(sourceId)));
  return true;
}

const DB_NAME = "learned-media-youtube";
const DB_VERSION = 1;
const YOUTUBE_ACTIVITY_KEY_PREFIX = "activity:";

function youtubeCatalogOf(workspace: YouTubeWorkspaceState) {
  return {
    channels: workspace.channels,
    videos: workspace.videos,
    libraryIncomplete: workspace.libraryIncomplete,
    lastSyncAt: workspace.lastSyncAt,
    catalogVersion: workspace.catalogVersion,
    sourceStates: workspace.sourceStates
  };
}

function youtubeActivityOf(workspace: YouTubeWorkspaceState): YouTubeActivityState {
  return {
    savedIds: workspace.savedIds,
    history: workspace.history,
    playbackPositions: workspace.playbackPositions,
    searchText: workspace.searchText,
    selectedTopic: workspace.selectedTopic,
    activeTab: workspace.activeTab,
    selectedChannelId: workspace.selectedChannelId,
    selectedVideoId: workspace.selectedVideoId,
    discoverIds: workspace.discoverIds,
    channelOrder: workspace.channelOrder,
    prioritizeRecentByChannel: workspace.prioritizeRecentByChannel
  };
}

const openYouTubeDb = createDatabaseConnection(DB_NAME, DB_VERSION, database => {
  if (!database.objectStoreNames.contains("workspace")) database.createObjectStore("workspace");
});

export async function hasPendingYouTubeImport() {
  if (typeof window === "undefined" || !window.indexedDB) return false;
  const db = await openYouTubeDb();
  return new Promise<boolean>((resolve, reject) => {
    const request = db.transaction("workspace", "readonly").objectStore("workspace")
      .count(IDBKeyRange.bound(YOUTUBE_IMPORT_PAGE_PREFIX, `${YOUTUBE_IMPORT_PAGE_PREFIX}\uffff`));
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
}

export async function loadYouTubeActivity(workspaceId: string, fallback?: Partial<YouTubeActivityState>): Promise<Partial<YouTubeActivityState> | null> {
  if (typeof window === "undefined" || !window.indexedDB) return fallback ?? null;
  try {
    const db = await openYouTubeDb();
    const stored = await new Promise<Partial<YouTubeActivityState> | null>((resolve, reject) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get(`${YOUTUBE_ACTIVITY_KEY_PREFIX}${workspaceId}`);
      request.onsuccess = () => resolve((request.result as Partial<YouTubeActivityState> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    return stored ?? fallback ?? null;
  } catch { return fallback ?? null; }
}

export async function loadYouTubeWorkspace(workspaceId = "local-workspace", fallbackActivity?: Partial<YouTubeActivityState>, strict = false, signal?: AbortSignal) {
  checkBackgroundCancellation(signal);
  if (typeof window === "undefined" || !window.indexedDB) {
    if (strict) throw new Error("YouTube import coordination requires browser storage. Enable site storage and retry.");
    return { ...DEFAULT_YOUTUBE_WORKSPACE };
  }
  try {
    const db = await openYouTubeDb();
    const saved = await new Promise<{ catalog: Record<string, unknown> | null; records: StoredVideo[]; legacy: Record<string, unknown> | null; activity: Partial<YouTubeActivityState> | null }>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readonly");
      const store = transaction.objectStore("workspace");
      const catalogRequest = store.get("catalog");
      const legacyRequest = store.get("state");
      const activityRequest = store.get(`${YOUTUBE_ACTIVITY_KEY_PREFIX}${workspaceId}`);
      let records: IDBRequest<StoredVideo[]> | undefined;
      catalogRequest.onsuccess = () => { if (catalogRequest.result?.storageVersion !== undefined) records = store.getAll(videoRecordRange()); };
      transaction.oncomplete = () => resolve({ catalog: catalogRequest.result ?? null, records: records?.result ?? [], legacy: legacyRequest.result ?? null, activity: activityRequest.result ?? null });
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    // Normalize after the read transaction completes: yielding inside an active
    // IndexedDB transaction could close it before its requests are finished.
    const raw = await restoreStoredCatalog(saved.catalog, saved.records, signal) ?? saved.legacy ?? {};
    const savedActivity = saved.activity ?? fallbackActivity ?? saved.legacy as Partial<YouTubeActivityState> | undefined;
    const legacyRecencyPreferences = mergeYouTubeRecencyPreferences(
      (saved.legacy?.prioritizeRecentByChannel as Record<string, boolean> | undefined) ?? {},
      (raw.prioritizeRecentByChannel as Record<string, boolean> | undefined) ?? {}
    );
    const savedCatalogVersion = typeof raw.catalogVersion === "number" && Number.isInteger(raw.catalogVersion) ? raw.catalogVersion : undefined;
    const catalogWasValidatedAtCurrentVersion = Boolean(saved.catalog) && savedCatalogVersion !== undefined && savedCatalogVersion >= YOUTUBE_CATALOG_VERSION;
    const inferredCatalogVersion = (Array.isArray(raw.channels) && raw.channels.length || Array.isArray(raw.videos) && raw.videos.length) ? 0 : YOUTUBE_CATALOG_VERSION;
    const workspace = { ...DEFAULT_YOUTUBE_WORKSPACE, ...raw, ...(savedActivity ?? {}), catalogVersion: savedCatalogVersion ?? inferredCatalogVersion, sourceStates: { ...(raw.sourceStates ?? {}) }, legacyPrioritizeRecentByChannel: legacyRecencyPreferences, prioritizeRecentByChannel: mergeYouTubeRecencyPreferences(legacyRecencyPreferences, savedActivity?.prioritizeRecentByChannel ?? {}) } as YouTubeWorkspaceState;
    if (!catalogWasValidatedAtCurrentVersion) {
      const videos: YouTubeVideo[] = [];
      await forEachBackground(workspace.videos ?? [], video => {
        if (isApprovedYouTubeVideo(video)) videos.push({ ...video, sourceIds: video.sourceIds ?? [] });
      }, signal);
      workspace.videos = videos;
    } else workspace.videos ??= [];
    const availableVideoIds = new Set<string>();
    await forEachBackground(workspace.videos, video => { availableVideoIds.add(video.id); }, signal);
    const savedIds: string[] = [], history: YouTubeWorkspaceState["history"] = [], playbackPositions: Record<string, number> = {}, discoverIds: string[] = [];
    await forEachBackground(workspace.savedIds ?? [], id => { if (availableVideoIds.has(id)) savedIds.push(id); }, signal);
    await forEachBackground(workspace.history ?? [], item => { if (availableVideoIds.has(item.videoId)) history.push(item); }, signal);
    await forEachBackground(Object.entries(workspace.playbackPositions ?? {}), ([id, seconds]) => { if (availableVideoIds.has(id)) playbackPositions[id] = seconds; }, signal);
    await forEachBackground(workspace.discoverIds ?? [], id => { if (availableVideoIds.has(id)) discoverIds.push(id); }, signal);
    Object.assign(workspace, { savedIds, history, playbackPositions, discoverIds });
    if (workspace.selectedVideoId && !availableVideoIds.has(workspace.selectedVideoId)) workspace.selectedVideoId = undefined;
    if (!saved.catalog && saved.legacy && workspace.videos.length) void saveYouTubeWorkspace(workspace, { activity: true, workspaceId });
    if (!raw.prioritizeRecentByChannel && !saved.catalog && workspace.videos.length && !workspace.discoverIds.length) {
      workspace.discoverIds = selectRandomVideos(filterYouTubeVideos(workspace.videos, "", workspace.selectedTopic), 24, [], DEFAULT_YOUTUBE_RECENCY_PREFERENCES).map((video) => video.id);
    }
    return workspace;
  } catch (error) { checkBackgroundCancellation(signal); if (strict) throw error; return { ...DEFAULT_YOUTUBE_WORKSPACE }; }
}

const pendingActivitySaves = new Map<string, { signature: string; write: Promise<void> }>();

export async function saveYouTubeWorkspace(workspace: YouTubeWorkspaceState, options: { activity?: boolean; workspaceId?: string } = {}) {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const { activity = false, workspaceId = "local-workspace" } = options;
  if (!activity) return;
  const snapshot = youtubeActivityOf(workspace);
  const signature = JSON.stringify(snapshot);
  const pending = pendingActivitySaves.get(workspaceId);
  // Pause, visibilitychange and pagehide can flush the same position together.
  if (pending?.signature === signature) return pending.write;
  const write = (async () => {
    // Preserve activity order when another snapshot is already being written.
    await pending?.write;
    try {
      const db = await openYouTubeDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("workspace", "readwrite");
        transaction.objectStore("workspace").put(snapshot, `${YOUTUBE_ACTIVITY_KEY_PREFIX}${workspaceId}`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch { /* IndexedDB is best effort; the active session remains usable. */ }
  })();
  pendingActivitySaves.set(workspaceId, { signature, write });
  await write;
  if (pendingActivitySaves.get(workspaceId)?.write === write) pendingActivitySaves.delete(workspaceId);
}

/** Shared catalog ownership is origin-wide, matching the existing IndexedDB catalog. */
export async function importCoordinatedYouTubeCatalog(apiKey: string, signal: AbortSignal,
  onProgress: (progress: YouTubeImportProgress) => void, options: { force: boolean; workspaceId: string }) {
  if (typeof window === "undefined" || !window.indexedDB) throw new Error("YouTube import coordination requires browser storage. Enable site storage and retry.");
  const imported = await withYouTubeImportLease(openYouTubeDb, signal, onProgress, async (owner, progress) => {
    const snapshot = await loadYouTubeWorkspace(options.workspaceId, undefined, true, owner.signal);
    const fresh = snapshot.catalogVersion >= YOUTUBE_CATALOG_VERSION && !snapshot.libraryIncomplete && snapshot.videos.length
      && snapshot.lastSyncAt && Date.now() - Date.parse(snapshot.lastSyncAt) < 24 * 60 * 60 * 1000;
    if (!options.force && fresh && !await owner.pages.has()) return { workspace: snapshot, error: undefined };
    const client = new YouTubeClient(apiKey, undefined, owner.assertOwned);
    const result = await client.syncApprovedCatalog(snapshot.channels, owner.signal, progress, {
      existingVideos: snapshot.videos, sourceStates: snapshot.sourceStates,
      force: options.force || snapshot.catalogVersion < YOUTUBE_CATALOG_VERSION, pages: owner.pages
    });
    if (owner.signal.aborted) throw abortError();
    const workspace: YouTubeWorkspaceState = { ...snapshot, channels: result.channels, videos: result.videos, sourceStates: result.sourceStates,
      catalogVersion: result.incomplete ? snapshot.catalogVersion : YOUTUBE_CATALOG_VERSION, libraryIncomplete: result.incomplete,
      lastSyncAt: result.incomplete ? snapshot.lastSyncAt : new Date().toISOString() };
    await owner.commit(youtubeCatalogOf(workspace), result.completedCheckpointSources, snapshot.videos);
    return { workspace, error: result.progress.error };
  });
  if (signal.aborted) throw abortError();
  const result = imported ?? { workspace: await loadYouTubeWorkspace(options.workspaceId, undefined, true, signal), error: undefined };
  return { ...result, error: result.error ?? (result.workspace.libraryIncomplete ? "Some approved video sources need a retry." : undefined) };
}

export function watchCommittedYouTubeCatalog(listener: () => void) {
  let lastCommit: string | undefined;
  let active = true, checking = false, pending = false;
  const check = async () => {
    if (!active || document.visibilityState === "hidden") return;
    if (checking) { pending = true; return; }
    checking = true;
    try {
      const revision = await youtubeCatalogCommitId(openYouTubeDb);
      if (!active) return;
      const previous = lastCommit;
      lastCommit = revision;
      if (revision && revision !== previous) listener();
    } catch { /* A future notification or focus event retries. */ }
    finally {
      checking = false;
      if (pending && active) { pending = false; void check(); }
    }
  };
  const unsubscribe = subscribeYouTubeImportChanges(() => void check());
  const focus = () => void check();
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", focus);
  void check();
  return () => { active = false; unsubscribe(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
}
