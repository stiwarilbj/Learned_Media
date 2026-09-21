export type YouTubeTopic = "History" | "Politics" | "Geography" | "Science" | "Nature" | "Mathematics" | "Literature" | "Sports" | "Culture" | "Technology";

export type ApprovedChannelSeed = {
  name: string;
  handle?: string;
  channelId?: string;
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
  channelOrder: "newest" | "oldest" | "random";
  libraryIncomplete: boolean;
  lastSyncAt?: string;
  catalogVersion: number;
  sourceStates: Record<string, YouTubeSourceState>;
};

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

export type YouTubeSearchConceptGroup = {
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
  conceptGroups?: YouTubeSearchConceptGroup[];
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
  video: YouTubeVideo;
  score: number;
  matchedFields: string[];
  supportingText: string[];
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
  { name: "3Blue1Brown", channelId: "UCYO_jab_esuFRV4b17AJtAw", playlistIds: ["PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"] },
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
  { name: "ExtinctZoo", handle: "@ExtinctZoo" },
  { name: "PBS Terra", handle: "@pbsterra", channelId: "UCpxYSWgxVt3Pyn1ovXsGQ0g" },
  { name: "PolyMatter", handle: "@PolyMatter", channelId: "UCgNg3vwj3xt7QOrcIDaHdDQ" },
  { name: "AlternateHistoryHub", handle: "@AlternateHistoryHub", channelId: "UClfEht64_NrzHf8Y0slKEjw" },
  { name: "J.J. McCullough", handle: "@JJMcCullough", channelId: "UCyhOl6uRlxryALlT5yifldw" },
  { name: "Primer", handle: "@primerlearning", channelId: "UCKzJFdi57J53Vr_BkTfN3uQ" },
  { name: "Primal Space", handle: "@primalspace", channelId: "UClZbmi9JzfnB2CEb0fG8iew" },
  { name: "Mitsi Studio", handle: "@mitsistudio", channelId: "UCuXCgyOCMXic7j0_wghXnRA" },
  { name: "Jabroni Baseball", handle: "@JabroniBaseball", channelId: "UCfBXZotQqPlpDWXTbRbi2qA" }
];

// Individual videos are intentionally separate from the channel catalog.
// Unknown IDs are resolved by an exact title + creator search and never by a
// broad recommendation query.
export const APPROVED_INDIVIDUAL_VIDEOS: ApprovedVideoSeed[] = [
  { creator: "melodysheep", title: "TIMELAPSE OF THE ENTIRE UNIVERSE", videoId: "TBikbn5XJhg" },
  { creator: "Ollie Bye", title: "The History of the World: Every Year", videoId: "-6Wu0Q7x5D0" },
  { creator: "Ollie Bye", title: "Top 5 Tallest Buildings Throughout History", videoId: "0MobSmVpvTM" },
  { creator: "Ollie Bye", title: "The Largest Cities Throughout History: Every Year", videoId: "kptMVQRud5c" },
  { creator: "Ollie Bye", title: "The Spread of Writing: Every Year", videoId: "eUpJ4yVCNrI" },
  { creator: "American Museum of Natural History", title: "Human Population Through Time (Updated in 2023)", videoId: "vJ5p3pZlBi4" }
];

const APPROVED_3BLUE_PLAYLIST_SOURCE_IDS = new Set((APPROVED_YOUTUBE_CHANNELS.find((seed) => seed.name === "3Blue1Brown")?.playlistIds ?? []).map((id) => `playlist:${id}`));

export const DEFAULT_YOUTUBE_WORKSPACE: YouTubeWorkspaceState = {
  channels: [], videos: [], savedIds: [], history: [], playbackPositions: {}, searchText: "", selectedTopic: "All", activeTab: "discover", channelOrder: "newest", discoverIds: [], libraryIncomplete: false, catalogVersion: 3, sourceStates: {}
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
    await this.acquire(signal);
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
type PlaylistApiResponse = { nextPageToken?: string; items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { title?: string; publishedAt?: string; channelId?: string } }> };
type VideoApiResponse = { items?: Array<{ id?: string; snippet?: { title?: string; description?: string; publishedAt?: string; channelId?: string; channelTitle?: string; tags?: string[]; thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } } }; contentDetails?: { duration?: string }; status?: { privacyStatus?: string; embeddable?: boolean } }> };
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

export class YouTubeClient {
  private readonly limiter = new YouTubeRequestLimiter();

  constructor(private readonly apiKey: string, private readonly requestOverride?: (resource: string, params: Record<string, string>, signal?: AbortSignal) => Promise<unknown>) {}

  private request<T>(resource: string, params: Record<string, string>, signal?: AbortSignal) {
    return this.limiter.run(signal, async () => {
      if (this.requestOverride) return this.requestOverride(resource, params, signal) as Promise<T>;
      return fetchYouTubeJson<T>(this.apiKey, resource, params, signal);
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
      const candidate = (search.items ?? []).find((item) => normalized(item.snippet?.title ?? "") === normalized(seed.name));
      if (!candidate?.id?.channelId) throw new YouTubeApiError(`Could not verify the approved channel “${seed.name}”.`, undefined, "channel-not-found", false);
      payload = await this.request<ChannelApiResponse>("channels", { part: "snippet,contentDetails", id: candidate.id.channelId }, signal);
    }
    const item = payload.items?.[0];
    if (!item?.id || (seed.channelId && item.id !== seed.channelId) || normalized(item.snippet?.title ?? "") !== normalized(seed.name)) throw new YouTubeApiError(`YouTube returned a different channel for “${seed.name}”.`, undefined, "channel-mismatch", false);
    return { id: item.id, name: item.snippet?.title ?? seed.name, handle: item.snippet?.customUrl ?? seed.handle, thumbnailUrl: item.snippet?.thumbnails?.default?.url, uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads, videoCount: 0, approved: true, sourceKind: seed.playlistIds?.length ? "playlists" : "uploads", approvedPlaylistIds: seed.playlistIds };
  }

  private async importPlaylist(channel: YouTubeChannelRecord, playlistId: string, sourceId: string, signal?: AbortSignal, onPage?: (count: number) => void) {
    const ids: string[] = [];
    let pageToken = "";
    do {
      const payload = await this.request<PlaylistApiResponse>("playlistItems", { part: "snippet,contentDetails", playlistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) }, signal);
      for (const item of payload.items ?? []) if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      onPage?.(ids.length);
      pageToken = payload.nextPageToken ?? "";
    } while (pageToken);
    const videos = await mapWithConcurrency(Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50)), 4, async (batch) => this.request<VideoApiResponse>("videos", { part: "snippet,contentDetails,status", id: batch.join(",") }, signal));
    const mapped: YouTubeVideo[] = [];
    videos.flatMap((payload) => payload.items ?? []).forEach((item) => {
      if (!item.id || item.status?.privacyStatus && item.status.privacyStatus !== "public" || item.snippet?.channelId && item.snippet.channelId !== channel.id) return;
      const snippet = item.snippet;
      const durationSeconds = parseDuration(item.contentDetails?.duration);
      const title = snippet?.title?.trim();
      if (!title || !snippet?.publishedAt) return;
      mapped.push({ id: item.id, channelId: channel.id, channelName: snippet.channelTitle ?? channel.name, title, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt, durationSeconds, durationLabel: formatDuration(durationSeconds), thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url, embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(channel.name, title, snippet.description ?? "", snippet.tags ?? []), approved: true, sourceIds: [sourceId], metadataRefreshedAt: new Date().toISOString() });
    });
    return mapped;
  }

  private async importChannel(channel: YouTubeChannelRecord, signal?: AbortSignal, onPage?: (count: number) => void) {
    if (!channel.uploadsPlaylistId) throw new YouTubeApiError(`The approved channel “${channel.name}” has no uploads playlist.`, undefined, "uploads-playlist-missing", false);
    return this.importPlaylist(channel, channel.uploadsPlaylistId, `channel:${channel.id}`, signal, onPage);
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
    return { id: item.id, channelId: snippet.channelId ?? `special-${normalized(seed.creator).replace(/ /g, "-")}`, channelName: snippet.channelTitle ?? seed.creator, title: snippet.title!, description: snippet.description ?? "", tags: snippet.tags ?? [], publishedAt: snippet.publishedAt ?? new Date().toISOString(), durationSeconds, durationLabel: formatDuration(durationSeconds), ...(snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ? { thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url } : {}), embedAvailable: item.status?.embeddable !== false, topics: classifyTopics(seed.creator, snippet.title!, snippet.description ?? "", snippet.tags ?? []), approved: true, special: true, sourceIds: [`individual:${item.id}`], metadataRefreshedAt: new Date().toISOString() } as YouTubeVideo;
  }

  async syncApprovedCatalog(existingChannels: YouTubeChannelRecord[] = [], signal?: AbortSignal, onProgress?: (progress: YouTubeImportProgress) => void, options: { existingVideos?: YouTubeVideo[]; sourceStates?: Record<string, YouTubeSourceState>; force?: boolean } = {}) {
    const existingVideos = options.existingVideos ?? [];
    const sourceStates: Record<string, YouTubeSourceState> = { ...(options.sourceStates ?? {}) };
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const errors: string[] = [];
    const progress: YouTubeImportProgress = { phase: "resolving", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 };
    onProgress?.({ ...progress });
    const channels = await mapWithConcurrency(APPROVED_YOUTUBE_CHANNELS, 4, async (seed, index) => {
      const previous = existingChannels.find((item) => normalized(item.name) === normalized(seed.name));
      try {
        const needsPinnedResolution = Boolean(seed.channelId && previous?.id !== seed.channelId);
        const channel = previous?.id && !needsPinnedResolution ? { ...previous, sourceKind: seed.playlistIds?.length ? "playlists" : "uploads", approvedPlaylistIds: seed.playlistIds } : await this.resolveChannel(seed, signal);
        progress.completedChannels = index + 1;
        onProgress?.({ ...progress });
        return { seed, channel };
      } catch (error) {
        progress.completedChannels = index + 1;
        const message = error instanceof Error ? error.message : `Could not verify ${seed.name}.`;
        errors.push(message);
        progress.error = errors.slice(0, 3).join(" · ");
        onProgress?.({ ...progress });
        return { seed, channel: previous?.id ? previous : null };
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
      progress.currentSource = job.label;
      const prior = sourceStates[job.sourceId];
      const due = Boolean(options.force || !prior?.lastSuccessfulSyncAt || now - new Date(prior.lastSuccessfulSyncAt).getTime() >= day);
      if (!due) {
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        onProgress?.({ ...progress });
        return { job, videos: [] as YouTubeVideo[], scanned: false, ok: true };
      }
      try {
        const videos = job.kind === "uploads"
          ? await this.importChannel(job.channel!, signal)
          : job.kind === "playlist"
            ? await this.importPlaylist(job.channel!, job.playlistId!, job.sourceId, signal)
            : [await this.resolveSpecial(job.seed!, verified.map((entry) => entry.channel), signal)];
        progress.importedVideos += videos.length;
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "ready", lastSuccessfulSyncAt: new Date().toISOString(), lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: videos.length };
        onProgress?.({ ...progress });
        return { job, videos, scanned: true, ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Could not import ${job.label}.`;
        errors.push(message);
        progress.error = errors.slice(0, 3).join(" · ");
        progress.completedSources = (progress.completedSources ?? 0) + 1;
        sourceStates[job.sourceId] = { sourceId: job.sourceId, label: job.label, kind: job.kind, status: "error", lastSuccessfulSyncAt: prior?.lastSuccessfulSyncAt, lastAttemptedSyncAt: new Date().toISOString(), importedVideoCount: prior?.importedVideoCount, error: message };
        onProgress?.({ ...progress });
        return { job, videos: [] as YouTubeVideo[], scanned: false, ok: false };
      }
    });
    const merged = new Map(existingVideos.map((video) => [video.id, { ...video }]));
    imported.filter((result) => result.scanned && result.ok).forEach((result) => {
      merged.forEach((video, id) => {
        if (video.sourceIds?.includes(result.job.sourceId)) {
          const sourceIds = video.sourceIds.filter((sourceId) => sourceId !== result.job.sourceId);
          if (sourceIds.length) merged.set(id, { ...video, sourceIds }); else merged.delete(id);
        }
      });
      result.videos.forEach((video) => {
        const previous = merged.get(video.id);
        merged.set(video.id, { ...previous, ...video, sourceIds: Array.from(new Set([...(previous?.sourceIds ?? []), result.job.sourceId])) });
      });
    });
    const playlistSourceIds = new Set(APPROVED_YOUTUBE_CHANNELS.flatMap((seed) => seed.playlistIds ?? []).map((id) => `playlist:${id}`));
    const threeBlue = APPROVED_YOUTUBE_CHANNELS.find((seed) => seed.name === "3Blue1Brown");
    const unique = Array.from(merged.values()).filter((video) => {
      if (threeBlue && (normalized(video.channelName) === normalized(threeBlue.name) || video.channelId === threeBlue.channelId)) return video.special === true || video.sourceIds?.some((sourceId) => playlistSourceIds.has(sourceId));
      return video.approved;
    });
    const channelsWithCounts = verified.map(({ channel }) => ({ ...channel, videoCount: unique.filter((video) => video.channelId === channel.id).length, lastImportedAt: new Date().toISOString() }));
    const complete = errors.length === 0 && verified.length === APPROVED_YOUTUBE_CHANNELS.length;
    progress.phase = "complete";
    progress.currentSource = undefined;
    progress.error = complete ? undefined : (progress.error ?? "Some approved video sources need a retry.");
    onProgress?.({ ...progress });
    return { channels: channelsWithCounts, videos: unique, sourceStates, incomplete: !complete, progress };
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

const SEARCH_BOILERPLATE = /(?:subscribe|like and subscribe|follow us|social media|patreon|sponsor(?:ed)? by|use code|affiliate|merch(?:andise)?|join the discord|business inquiries|check out my|support the channel|all links? in the description)[^.!?]*(?:[.!?]|$)/gi;

function searchableDescription(video: YouTubeVideo) {
  // Keep meaningful passages from the whole description. A beginning-only
  // excerpt misses the subject when creators put their useful notes later.
  return video.description.replace(SEARCH_BOILERPLATE, " ").replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function tokenMatches(token: string, words: string[]) {
  if (token.length < 3) return words.includes(token);
  return words.some((word) => {
    if (word === token) return true;
    if (token.length >= 5 && word.length >= 5 && (word.startsWith(token) || token.startsWith(word)) && Math.min(token.length, word.length) >= 5 && Math.abs(token.length - word.length) <= 4) return true;
    return token.length >= 5 && word.length >= 5 && editDistance(token, word) <= (token.length >= 8 ? 2 : 1);
  });
}

function matchesSearchTerm(term: string, value: string) {
  const query = normalized(term);
  const text = normalized(value);
  if (!query || !text) return false;
  if (` ${text} `.includes(` ${query} `)) return true;
  const queryWords = query.split(" ").filter(Boolean);
  const textWords = text.split(" ").filter(Boolean);
  return queryWords.length > 1 ? queryWords.every((word) => tokenMatches(word, textWords)) : tokenMatches(query, textWords);
}

function fieldMatches(term: string, fields: Array<{ name: string; value: string }>) {
  const normalizedTerm = normalized(term);
  if (!normalizedTerm) return { matched: false, score: 0, fields: [], supportingText: [] as string[] };
  const termWords = normalizedTerm.split(" ").filter((word) => word.length > 1);
  let score = 0;
  const matchedFields: string[] = [];
  const supportingText: string[] = [];
  fields.forEach(({ name, value }) => {
    const normalizedValue = normalized(value);
    const words = normalizedValue.split(" ").filter(Boolean);
    const phrase = ` ${normalizedValue} `.includes(` ${normalizedTerm} `);
    const matchedWords = termWords.filter((word) => tokenMatches(word, words));
    const coverage = matchedWords.length / Math.max(termWords.length, 1);
    if (!phrase && (!matchedWords.length || coverage < (termWords.length === 1 ? 1 : 0.5))) return;
    const multiplier = name === "title" ? 10 : name === "channel" ? 8 : name === "tags" ? 4 : name === "topics" ? 3 : name === "description" ? 2 : 1;
    score += multiplier * (phrase ? (termWords.length === 1 ? 1.6 : 2.2) : coverage);
    matchedFields.push(name);
    if (name === "title" || name === "description" || name === "channel") supportingText.push(value.slice(0, 220));
  });
  return { matched: score > 0, score, fields: Array.from(new Set(matchedFields)), supportingText: supportingText.slice(0, 3) };
}

function broadTokenScore(term: string, fields: Array<{ name: string; value: string }>) {
  const words = normalized(term).split(" ").filter((word) => word.length > 2);
  if (!words.length) return 0;
  const searchableWords = normalized(fields.map((field) => field.value).join(" ")).split(" ").filter(Boolean);
  const matched = words.filter((word) => tokenMatches(word, searchableWords));
  return matched.length / words.length;
}

export function searchYouTubeCandidates(videos: YouTubeVideo[], plan: YouTubeSearchPlanLike, topic: YouTubeTopic | "All" = "All", channelId?: string, limit = 80, excludedIds: string[] = [], expanded = false) {
  const excluded = new Set(excludedIds);
  const groups = (plan.conceptGroups ?? []).filter((group) => group.terms?.length).map((group) => ({ ...group, terms: group.terms.slice(0, 12) }));
  const primaryTerms = [...(plan.terms ?? []), ...(plan.include ?? [])];
  const terms = [
    ...primaryTerms,
    ...(expanded ? (plan.alternatives ?? []) : [])
  ].filter((term) => term.trim()).filter((term, index, all) => all.findIndex((candidate) => normalized(candidate) === normalized(term)) === index).slice(0, 48);
  const effectiveChannelId = plan.channelId ?? channelId;
  const explicitTopics = new Set((plan.topics ?? []).map((value) => normalized(value)));
  const exclusions = (plan.exclude ?? []).map((term) => normalized(term)).filter(Boolean);
  const results: YouTubeSearchCandidate[] = [];
  const semanticFallback: YouTubeSearchCandidate[] = [];
  videos.forEach((video) => {
    if (excluded.has(video.id) || !isApprovedYouTubeVideo(video)) return;
    if (effectiveChannelId && video.channelId !== effectiveChannelId) return;
    if (topic !== "All" && !video.topics.includes(topic)) return;
    if (explicitTopics.size && !video.topics.some((item) => explicitTopics.has(normalized(item)))) return;
    const dateIntent = plan.dateIntent ?? "upload";
    if (dateIntent !== "event" && plan.minDate && video.publishedAt < plan.minDate) return;
    if (dateIntent !== "event" && plan.maxDate && video.publishedAt > plan.maxDate) return;
    if (plan.minDurationSeconds !== undefined && video.durationSeconds < plan.minDurationSeconds) return;
    if (plan.maxDurationSeconds !== undefined && video.durationSeconds > plan.maxDurationSeconds) return;
    const description = searchableDescription(video);
    const fields = [
      { name: "title", value: video.title },
      { name: "channel", value: video.channelName },
      { name: "description", value: description },
      { name: "tags", value: video.tags.join(" ") },
      { name: "topics", value: video.topics.join(" ") }
    ];
    const searchable = normalized(fields.map((field) => field.value).join(" "));
    if (exclusions.some((term) => matchesSearchTerm(term, searchable))) return;
    const matches = terms.map((term) => fieldMatches(term, fields)).filter((match) => match.matched);
    const groupMatches = groups.map((group) => {
      const groupResults = group.terms.map((term) => fieldMatches(term, fields)).filter((match) => match.matched);
      return groupResults.sort((left, right) => right.score - left.score)[0];
    });
    if (groups.some((group, index) => group.required !== false && !groupMatches[index])) return;
    const matched = [...matches, ...groupMatches.filter(Boolean)];
    const softScore = terms.length ? Math.max(...terms.map((term) => broadTokenScore(term, fields)), 0) : 0;
    if (!matched.length) {
      if (!explicitTopics.size && softScore >= 0.2) semanticFallback.push({ video, score: softScore, matchedFields: ["semantic-fallback"], supportingText: [] });
      return;
    }
    const score = matched.reduce((sum, match) => sum + match.score, 0) + (matched.length ? softScore * 0.35 : softScore);
    results.push({
      video,
      score,
      matchedFields: Array.from(new Set(matched.flatMap((match) => match.fields).concat(matched.length ? [] : ["semantic-fallback"]))),
      supportingText: Array.from(new Set(matched.flatMap((match) => match.supportingText))).slice(0, 3)
    });
  });
  const maxResults = Math.max(1, Math.min(80, limit));
  if (!results.length && !explicitTopics.size) return semanticFallback.sort((left, right) => right.score - left.score).slice(0, maxResults);
  return results.sort((left, right) => right.score - left.score).slice(0, maxResults);
}

export function filterYouTubeVideos(videos: YouTubeVideo[], searchText: string, topic: YouTubeTopic | "All", channelId?: string) {
  const term = normalized(searchText);
  if (!term) return videos.filter((video) => isApprovedYouTubeVideo(video) && (!channelId || video.channelId === channelId) && (topic === "All" || video.topics.includes(topic)));
  return searchYouTubeCandidates(videos, { terms: [searchText] }, topic, channelId, Math.min(80, videos.length)).map((candidate) => candidate.video);
}

export function relatedYouTubeVideos(videos: YouTubeVideo[], current: YouTubeVideo, count = 6) {
  const shared = videos.filter((video) => video.id !== current.id && isApprovedYouTubeVideo(video) && video.topics.some((topic) => current.topics.includes(topic)));
  return selectRandomVideos(shared, count, [current.id]);
}

export function isApprovedYouTubeVideo(video: YouTubeVideo) {
  if (!video.approved) return false;
  if (normalized(video.channelName) === normalized("3Blue1Brown") || video.channelId === "UCYO_jab_esuFRV4b17AJtAw") return video.special === true || Boolean(video.sourceIds?.some((sourceId) => APPROVED_3BLUE_PLAYLIST_SOURCE_IDS.has(sourceId)));
  return true;
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
      request.onsuccess = () => {
        const raw = request.result ?? {};
        const workspace = { ...DEFAULT_YOUTUBE_WORKSPACE, ...raw, catalogVersion: 3, sourceStates: { ...(raw.sourceStates ?? {}) } } as YouTubeWorkspaceState;
        workspace.videos = (workspace.videos ?? []).filter(isApprovedYouTubeVideo).map((video) => ({ ...video, sourceIds: video.sourceIds ?? [] }));
        resolve(workspace);
      };
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
