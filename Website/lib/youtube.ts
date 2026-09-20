export type YouTubeTopic = "History" | "Politics" | "Geography" | "Science" | "Nature" | "Mathematics" | "Literature" | "Sports" | "Culture" | "Technology";

export type ApprovedChannelSeed = {
  name: string;
  handle?: string;
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
  channelOrder: "newest" | "oldest" | "random";
  libraryIncomplete: boolean;
  lastSyncAt?: string;
};

export type YouTubeImportProgress = {
  phase: "idle" | "resolving" | "importing" | "complete" | "paused" | "error";
  completedChannels: number;
  totalChannels: number;
  importedVideos: number;
  error?: string;
  paused?: boolean;
};

export const YOUTUBE_TOPICS: YouTubeTopic[] = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"];

// This is the only channel catalog used by the feature. Handles are retained
// where the user supplied or confirmed them; other IDs are resolved strictly
// by exact channel-title matching and saved after verification.
export const APPROVED_YOUTUBE_CHANNELS: ApprovedChannelSeed[] = [
  { name: "History Matters" },
  { name: "Election History" },
  { name: "Secret Base" },
  { name: "Geo History" },
  { name: "Great Books Explained" },
  { name: "BooneU" },
  { name: "Joon Lee" },
  { name: "TLDR News Global" },
  { name: "Mr. Beat" },
  { name: "The Generalist Papers" },
  { name: "CGP Grey", handle: "@CGPGrey" },
  { name: "Power Politics" },
  { name: "Half as Interesting" },
  { name: "Hoser" },
  { name: "The History Guy: History Deserves to Be Remembered" },
  { name: "History Buffs Hub" },
  { name: "Ceramic", handle: "@ceramic01" },
  { name: "Reading Through History" },
  { name: "Atlas Pro" },
  { name: "African Biographics" },
  { name: "Phil Edwards" },
  { name: "Tor’s Cabinet of Curiosities" },
  { name: "Extra History" },
  { name: "Justin Portela" },
  { name: "Patrick Kelly" },
  { name: "Historically" },
  { name: "Mental Floss" },
  { name: "Crash Course" },
  { name: "SciShow" },
  { name: "OverSimplified" },
  { name: "vlogbrothers" },
  { name: "Sam O’Nella Academy" },
  { name: "3Blue1Brown" },
  { name: "Shawn Grows" },
  { name: "General Knowledge" },
  { name: "Jay Hona" },
  { name: "Veritasium" },
  { name: "theweeklyjack", handle: "@theweeklyjack1" },
  { name: "Jackdaw" },
  { name: "Grist" },
  { name: "Bizarre Beasts" },
  { name: "Ze Frank" },
  { name: "Make Thing With Hand" },
  { name: "Be Smart" },
  { name: "PBS Eons" },
  { name: "Deep Look" },
  { name: "MinuteEarth" },
  { name: "minutephysics" },
  { name: "Brailor" },
  { name: "hydn" },
  { name: "ExtinctZoo", handle: "@ExtinctZoo" }
];

// Individual videos are intentionally separate from the channel catalog.
// Unknown IDs are resolved by an exact title + creator search and never by a
// broad recommendation query.
export const APPROVED_INDIVIDUAL_VIDEOS: ApprovedVideoSeed[] = [
  { creator: "melodysheep", title: "TIMELAPSE OF THE ENTIRE UNIVERSE", videoId: "TBikbn5XJhg" },
  { creator: "Ollie Bye", title: "The History of the World: Every Year", videoId: "-6Wu0Q7x5D0" },
  { creator: "Ollie Bye", title: "Top 5 Tallest Buildings Throughout History" },
  { creator: "Ollie Bye", title: "The Largest Cities Throughout History: Every Year" },
  { creator: "Ollie Bye", title: "The Spread of Writing: Every Year", videoId: "eUpJ4yVCNrI" },
  { creator: "American Museum of Natural History", title: "Human Population Through Time (Updated in 2023)" }
];

export const DEFAULT_YOUTUBE_WORKSPACE: YouTubeWorkspaceState = {
  channels: [], videos: [], savedIds: [], history: [], playbackPositions: {}, searchText: "", selectedTopic: "All", activeTab: "discover", channelOrder: "newest", discoverIds: [], libraryIncomplete: false
};

const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  status?: number;
  reason?: string;
  retryable: boolean;

  constructor(message: string, status?: number, reason?: string, retryable = false) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
  }
}

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function abortError() {
  return new YouTubeApiError("YouTube request canceled.", undefined, "canceled", false);
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  return { controller, cleanup: () => { window.clearTimeout(timer); signal?.removeEventListener("abort", abort); } };
}

async function fetchYouTubeJson<T>(apiKey: string, resource: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${YOUTUBE_API_ROOT}/${resource}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const timeout = withTimeout(signal);
  try {
    if (signal?.aborted) throw abortError();
    const response = await fetch(url, { headers: { accept: "application/json", "x-goog-api-key": apiKey }, signal: timeout.controller.signal });
    const raw = await response.text();
    let payload: unknown = {};
    try { payload = JSON.parse(raw); } catch { throw new YouTubeApiError("YouTube returned malformed data.", response.status, "malformed", true); }
    if (!response.ok) {
      const error = (payload as { error?: { message?: string; errors?: Array<{ reason?: string }> } }).error;
      const reason = error?.errors?.[0]?.reason;
      const message = error?.message || `YouTube returned HTTP ${response.status}.`;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new YouTubeApiError(reason === "quotaExceeded" ? "YouTube API quota is exhausted. Resume tomorrow after the quota resets." : message, response.status, reason, retryable);
    }
    return payload as T;
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw abortError();
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
type PlaylistApiResponse = { nextPageToken?: string; items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string } }> };
type VideoApiResponse = { items?: Array<{ id?: string; snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string; channelTitle?: string; tags?: string[]; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } }; contentDetails?: { duration?: string }; status?: { privacyStatus?: string; embeddable?: boolean } }> };
type SearchApiResponse = { items?: Array<{ id?: { channelId?: string; videoId?: string }; snippet?: { title?: string; channelTitle?: string; channelId?: string } }> };

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

export class YouTubeClient {
  constructor(private readonly apiKey: string, private readonly requestOverride?: (resource: string, params: Record<string, string>, signal?: AbortSignal) => Promise<unknown>) {}

  private request<T>(resource: string, params: Record<string, string>, signal?: AbortSignal) {
    if (this.requestOverride) return this.requestOverride(resource, params, signal) as Promise<T>;
    return fetchYouTubeJson<T>(this.apiKey, resource, params, signal);
  }

  async resolveChannel(seed: ApprovedChannelSeed, signal?: AbortSignal): Promise<YouTubeChannelRecord> {
    let payload: ChannelApiResponse;
    if (seed.handle) {
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", forHandle: seed.handle.replace(/^@/, "") }, signal);
    } else {
      const search = await this.request<SearchApiResponse>("search", { part: "snippet", q: seed.name, type: "channel", maxResults: "8" }, signal);
      const candidate = (search.items ?? []).find((item) => normalized(item.snippet?.title ?? "") === normalized(seed.name));
      if (!candidate?.id?.channelId) throw new YouTubeApiError(`Could not verify the approved channel “${seed.name}”.`, undefined, "channel-not-found", false);
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", id: candidate.id.channelId }, signal);
    }
    const item = payload.items?.[0];
    if (!item?.id || normalized(item.snippet?.title ?? "") !== normalized(seed.name)) throw new YouTubeApiError(`YouTube returned a different channel for “${seed.name}”.`, undefined, "channel-mismatch", false);
    return { id: item.id, name: item.snippet?.title ?? seed.name, handle: item.snippet?.customUrl, thumbnailUrl: item.snippet?.thumbnails?.default?.url, uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads, videoCount: 0, approved: true };
  }

  private async importChannel(channel: YouTubeChannelRecord, signal?: AbortSignal, onPage?: (count: number) => void) {
    if (!channel.uploadsPlaylistId) throw new YouTubeApiError(`The approved channel “${channel.name}” has no uploads playlist.`, undefined, "uploads-playlist-missing", false);
    const ids: string[] = [];
    let pageToken = "";
    do {
      const payload = await this.request<PlaylistApiResponse>("playlistItems", { part: "snippet,contentDetails", playlistId: channel.uploadsPlaylistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }, signal);
      for (const item of payload.items ?? []) if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      onPage?.(ids.length);
      pageToken = payload.nextPageToken ?? "";
    } while (pageToken);
    const videos = await mapWithConcurrency(Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50)), 4, async (batch) => this.request<VideoApiResponse>("videos", { part: "snippet,contentDetails,status", id: batch.join(",") }, signal));
    const mapped: YouTubeVideo[] = [];
    videos.flatMap((payload) => payload.items ?? []).forEach((item) => {
      if (!item.id || item.status?.privacyStatus && item.status.privacyStatus !== "public") return;
      const snippet = item.snippet;
      const durationSeconds = parseDuration(item.contentDetails?.duration);
      const title = snippet?.title?.trim();
      if (!title || !snippet?.publishedAt) return;
      mapped.push({ id: item.id, channelId: channel.id, channelName: snippet.channelTitle ?? channel.name, title, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt, durationSeconds, durationLabel: formatDuration(durationSeconds), thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url, embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(channel.name, title, snippet.description ?? "", snippet.tags ?? []), approved: true });
    });
    return mapped;
  }

  private async resolveSpecial(seed: ApprovedVideoSeed, channels: YouTubeChannelRecord[], signal?: AbortSignal) {
    let videoId = seed.videoId;
    if (!videoId) {
      const channel = channels.find((item) => normalized(item.name) === normalized(seed.creator));
      const search = await this.request<SearchApiResponse>("search", { part: "snippet", q: seed.title, type: "video", maxResults: "10", ...(channel ? { channelId: channel.id } : {}) }, signal);
      const found = (search.items ?? []).find((item) => normalized(item.snippet?.title ?? "") === normalized(seed.title) && normalized(item.snippet?.channelTitle ?? "") === normalized(seed.creator));
      videoId = found?.id?.videoId;
    }
    if (!videoId) throw new YouTubeApiError(`Could not verify the approved video “${seed.title}”.`, undefined, "video-not-found", false);
    const payload = await this.request<VideoApiResponse>("videos", { part: "snippet,contentDetails,status", id: videoId }, signal);
    const item = payload.items?.[0];
    if (!item?.id || normalized(item.snippet?.title ?? "") !== normalized(seed.title) || normalized(item.snippet?.channelTitle ?? "") !== normalized(seed.creator)) throw new YouTubeApiError(`The approved video “${seed.title}” did not match its creator and title.`, undefined, "video-mismatch", false);
    const snippet = item.snippet!;
    const durationSeconds = parseDuration(item.contentDetails?.duration);
    return { id: item.id, channelId: snippet.channelId ?? `special-${normalized(seed.creator).replace(/ /g, "-")}`, channelName: snippet.channelTitle ?? seed.creator, title: snippet.title!, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt ?? new Date().toISOString(), durationSeconds, durationLabel: formatDuration(durationSeconds), ...(snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ? { thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url } : {}), embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(seed.creator, snippet.title!, snippet.description ?? "", snippet.tags ?? []), approved: true, special: true } as YouTubeVideo;
  }

  async syncApprovedCatalog(existingChannels: YouTubeChannelRecord[] = [], signal?: AbortSignal, onProgress?: (progress: YouTubeImportProgress) => void) {
    const progress: YouTubeImportProgress = { phase: "resolving", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0 };
    onProgress?.({ ...progress });
    const channels = await mapWithConcurrency(APPROVED_YOUTUBE_CHANNELS, 4, async (seed, index) => {
      const previous = existingChannels.find((item) => normalized(item.name) === normalized(seed.name));
      try {
        const channel = previous?.id ? previous : await this.resolveChannel(seed, signal);
        progress.completedChannels = index + 1;
        onProgress?.({ ...progress });
        return channel;
      } catch (error) {
        progress.completedChannels = index + 1;
        progress.error = error instanceof Error ? error.message : `Could not verify ${seed.name}.`;
        onProgress?.({ ...progress });
        return null;
      }
    });
    const verified = channels.filter((channel): channel is YouTubeChannelRecord => Boolean(channel));
    progress.phase = "importing";
    progress.error = undefined;
    onProgress?.({ ...progress });
    const imported = await mapWithConcurrency(verified, 4, async (channel) => {
      try {
        const videos = await this.importChannel(channel, signal);
        progress.importedVideos += videos.length;
        onProgress?.({ ...progress });
        return { channel: { ...channel, videoCount: videos.length, lastImportedAt: new Date().toISOString() }, videos };
      } catch (error) {
        progress.error = error instanceof Error ? error.message : `Could not import ${channel.name}.`;
        onProgress?.({ ...progress });
        return { channel, videos: [] as YouTubeVideo[] };
      }
    });
    const special = await mapWithConcurrency(APPROVED_INDIVIDUAL_VIDEOS, 4, async (seed) => {
      try { return await this.resolveSpecial(seed, imported.map((item) => item.channel), signal); } catch { return null; }
    });
    const verifiedSpecial = special.filter((video): video is YouTubeVideo => video !== null);
    const videos = [...imported.flatMap((item) => item.videos), ...verifiedSpecial];
    const unique = Array.from(new Map(videos.map((video) => [video.id, video])).values());
    progress.phase = "complete";
    progress.error = verified.length < APPROVED_YOUTUBE_CHANNELS.length ? "Some approved channels could not be verified. Retry to finish the library." : undefined;
    onProgress?.({ ...progress });
    return { channels: imported.map((item) => item.channel), videos: unique, incomplete: verified.length < APPROVED_YOUTUBE_CHANNELS.length, progress };
  }
}

export function selectRandomVideos(videos: YouTubeVideo[], count: number, exclude: string[] = []) {
  const excluded = new Set(exclude);
  const groups = new Map<string, YouTubeVideo[]>();
  videos.filter((video) => !excluded.has(video.id)).forEach((video) => groups.set(video.channelId, [...(groups.get(video.channelId) ?? []), video]));
  const groupValues = Array.from(groups.values());
  groupValues.forEach((group) => { for (let index = group.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [group[index], group[swap]] = [group[swap], group[index]]; } });
  for (let index = groupValues.length - 1; index > 0; index -= 1) { const swap = Math.floor(Math.random() * (index + 1)); [groupValues[index], groupValues[swap]] = [groupValues[swap], groupValues[index]]; }
  const result: YouTubeVideo[] = [];
  let cursor = 0;
  while (result.length < count && groupValues.length) {
    let added = false;
    for (let offset = 0; offset < groupValues.length && result.length < count; offset += 1) {
      const group = groupValues[(cursor + offset) % groupValues.length];
      const next = group.shift();
      if (next) { result.push(next); added = true; }
    }
    cursor = (cursor + 1) % Math.max(groupValues.length, 1);
    if (!added) break;
  }
  return result;
}

export function filterYouTubeVideos(videos: YouTubeVideo[], searchText: string, topic: YouTubeTopic | "All", channelId?: string) {
  const term = normalized(searchText);
  return videos.filter((video) => {
    if (channelId && video.channelId !== channelId) return false;
    if (topic !== "All" && !video.topics.includes(topic)) return false;
    if (!term) return true;
    const haystack = normalized([video.title, video.description, video.channelName, video.tags.join(" "), video.topics.join(" ")].join(" "));
    const words = term.split(" ").filter((word) => word.length > 1);
    return words.every((word) => haystack.includes(word));
  });
}

export function relatedYouTubeVideos(videos: YouTubeVideo[], current: YouTubeVideo, count = 6) {
  const shared = videos.filter((video) => video.id !== current.id && video.approved && video.topics.some((topic) => current.topics.includes(topic)));
  return selectRandomVideos(shared, count, [current.id]);
}

const DB_NAME = "learned-media-youtube";
const DB_VERSION = 1;

function openYouTubeDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains("workspace")) db.createObjectStore("workspace"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("YouTube catalog storage could not open."));
  });
}

export async function loadYouTubeWorkspace() {
  if (typeof window === "undefined" || !window.indexedDB) return { ...DEFAULT_YOUTUBE_WORKSPACE };
  try {
    const db = await openYouTubeDb();
    return await new Promise<YouTubeWorkspaceState>((resolve, reject) => {
      const request = db.transaction("workspace", "readonly").objectStore("workspace").get("state");
      request.onsuccess = () => resolve({ ...DEFAULT_YOUTUBE_WORKSPACE, ...(request.result ?? {}) });
      request.onerror = () => reject(request.error);
    });
  } catch { return { ...DEFAULT_YOUTUBE_WORKSPACE }; }
}

export async function saveYouTubeWorkspace(workspace: YouTubeWorkspaceState) {
  if (typeof window === "undefined" || !window.indexedDB) return;
  try {
    const db = await openYouTubeDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction("workspace", "readwrite").objectStore("workspace").put(workspace, "state");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch { /* IndexedDB is best effort; the active session remains usable. */ }
}
