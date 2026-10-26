import { performanceFetch, recordPerformance } from "./performance-diagnostics";
import { approximateCacheBytes } from "./session-cache";
import type { ImageAttribution, WikipediaSource } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const MAX_CONCURRENT_WIKIPEDIA_REQUESTS = 4;
const WIKIPEDIA_REQUEST_TIMEOUT_MS = 20_000;
let wikipediaInFlight = 0;
let wikipediaWaiterCount = 0;
type WikipediaWaiter = { priority: number; origin: string; active: boolean; resolve: () => void; reject: (error: Error) => void; signal?: AbortSignal; onAbort: () => void };
type WikipediaWaitQueue = { entries: WikipediaWaiter[]; head: number; inactiveCount: number; activeCount: number };
const wikipediaWaitQueues = new Map<number, WikipediaWaitQueue>();
const wikipediaNotBeforeByOrigin = new Map<string, number>();
let wikipediaCooldownTimer: ReturnType<typeof setTimeout> | undefined;
let wikipediaCooldownTimerAt = Number.POSITIVE_INFINITY;

function compactWikipediaQueue(priority: number, queue: WikipediaWaitQueue) {
  if (queue.activeCount === 0) {
    wikipediaWaitQueues.delete(priority);
    return;
  }
  const compactWhen = queue.head >= 64 && queue.head * 2 >= queue.entries.length
    || queue.inactiveCount >= 64 && queue.inactiveCount * 2 >= queue.entries.length;
  if (!compactWhen) return;
  queue.entries = queue.entries.slice(queue.head).filter((waiter) => waiter.active);
  queue.head = 0;
  queue.inactiveCount = 0;
}

function cancelWikipediaCooldownTimer() {
  if (wikipediaCooldownTimer !== undefined) clearTimeout(wikipediaCooldownTimer);
  wikipediaCooldownTimer = undefined;
  wikipediaCooldownTimerAt = Number.POSITIVE_INFINITY;
}

function scheduleWikipediaCooldownWake(at: number | undefined) {
  if (wikipediaInFlight >= MAX_CONCURRENT_WIKIPEDIA_REQUESTS || wikipediaWaiterCount === 0 || at === undefined) {
    cancelWikipediaCooldownTimer();
    return;
  }
  if (wikipediaCooldownTimer !== undefined && wikipediaCooldownTimerAt === at) return;
  cancelWikipediaCooldownTimer();
  wikipediaCooldownTimerAt = at;
  const expectedAt = at;
  const delay = Math.max(0, at - performance.now());
  wikipediaCooldownTimer = setTimeout(() => {
    if (wikipediaCooldownTimerAt !== expectedAt) return;
    wikipediaCooldownTimer = undefined;
    wikipediaCooldownTimerAt = Number.POSITIVE_INFINITY;
    dispatchWikipediaWaiters();
  }, Math.min(delay, 2_147_483_647));
}

function nextWikipediaWaiter(now = performance.now()) {
  let earliestCooldown: number | undefined;
  for (const priority of Array.from(wikipediaWaitQueues.keys()).sort((left, right) => left - right)) {
    const queue = wikipediaWaitQueues.get(priority);
    if (!queue) continue;
    while (queue.head < queue.entries.length && !queue.entries[queue.head].active) queue.head += 1;
    let selectedIndex = -1;
    for (let index = queue.head; index < queue.entries.length; index += 1) {
      const waiter = queue.entries[index];
      if (!waiter.active) continue;
      const notBefore = wikipediaNotBeforeByOrigin.get(waiter.origin) ?? 0;
      if (notBefore > now) {
        earliestCooldown = earliestCooldown === undefined ? notBefore : Math.min(earliestCooldown, notBefore);
        continue;
      }
      selectedIndex = index;
      break;
    }
    if (selectedIndex < 0) {
      compactWikipediaQueue(priority, queue);
      continue;
    }
    const waiter = queue.entries[selectedIndex];
    waiter.active = false;
    queue.activeCount -= 1;
    queue.inactiveCount += 1;
    wikipediaWaiterCount -= 1;
    waiter.signal?.removeEventListener("abort", waiter.onAbort);
    if (selectedIndex === queue.head) {
      while (queue.head < queue.entries.length && !queue.entries[queue.head].active) queue.head += 1;
    }
    compactWikipediaQueue(priority, queue);
    return { waiter, earliestCooldown };
  }
  return { waiter: undefined, earliestCooldown };
}

function dispatchWikipediaWaiters() {
  while (wikipediaInFlight < MAX_CONCURRENT_WIKIPEDIA_REQUESTS) {
    const next = nextWikipediaWaiter();
    if (!next.waiter) {
      scheduleWikipediaCooldownWake(next.earliestCooldown);
      return;
    }
    wikipediaInFlight += 1;
    next.waiter.resolve();
  }
  cancelWikipediaCooldownTimer();
}

async function acquireWikipediaSlot(signal?: AbortSignal, priority = 0, origin = WIKIPEDIA_API) {
  if (signal?.aborted) throw new DOMException("Wikipedia request canceled.", "AbortError");
  const notBefore = wikipediaNotBeforeByOrigin.get(origin) ?? 0;
  if (notBefore <= performance.now()) wikipediaNotBeforeByOrigin.delete(origin);
  if (wikipediaInFlight < MAX_CONCURRENT_WIKIPEDIA_REQUESTS && wikipediaWaiterCount === 0 && notBefore <= performance.now()) { wikipediaInFlight += 1; return; }
  await new Promise<void>((resolve, reject) => {
    let waiter: WikipediaWaiter;
    waiter = {
      priority,
      origin,
      active: true,
      resolve: () => { signal?.removeEventListener("abort", waiter.onAbort); resolve(); },
      reject,
      signal,
      onAbort: () => {
        if (!waiter.active) return;
        waiter.active = false;
        wikipediaWaiterCount -= 1;
        const queue = wikipediaWaitQueues.get(priority);
        if (queue) {
          queue.activeCount -= 1;
          queue.inactiveCount += 1;
          compactWikipediaQueue(priority, queue);
        }
        reject(new DOMException("Wikipedia request canceled.", "AbortError"));
        dispatchWikipediaWaiters();
      }
    };
    const queue = wikipediaWaitQueues.get(priority) ?? { entries: [], head: 0, inactiveCount: 0, activeCount: 0 };
    queue.entries.push(waiter);
    queue.activeCount += 1;
    wikipediaWaitQueues.set(priority, queue);
    wikipediaWaiterCount += 1;
    signal?.addEventListener("abort", waiter.onAbort, { once: true });
    if (signal?.aborted) waiter.onAbort();
    else dispatchWikipediaWaiters();
  });
}

function releaseWikipediaSlot() {
  wikipediaInFlight = Math.max(0, wikipediaInFlight - 1);
  dispatchWikipediaWaiters();
}

function retryAfterMilliseconds(value: string | null): number | undefined {
  const retryAfter = value?.trim();
  if (!retryAfter) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(retryAfter)) {
    const seconds = Number(retryAfter);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : undefined;
  }
  const timestamp = Date.parse(retryAfter);
  if (!Number.isFinite(timestamp)) return undefined;
  const delay = timestamp - Date.now();
  return delay > 0 ? delay : undefined;
}

function noteWikipediaCooldown(origin: string, value: string | null) {
  const delay = retryAfterMilliseconds(value);
  if (delay === undefined) return;
  const deadline = performance.now() + delay;
  const previous = wikipediaNotBeforeByOrigin.get(origin) ?? 0;
  if (deadline > previous) wikipediaNotBeforeByOrigin.set(origin, deadline);
  dispatchWikipediaWaiters();
}

type SearchResponse = {
  query?: { search?: Array<{ title?: string }> };
};

type PageResponse = {
  error?: unknown;
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Record<string, {
      title?: string;
      missing?: "" | boolean;
      invalid?: "" | boolean;
      known?: "" | boolean;
      fullurl?: string;
      extract?: string;
      pageimage?: string;
      thumbnail?: { source?: string };
      original?: { source?: string };
      pageprops?: { disambiguation?: "" | boolean };
      coordinates?: Array<{ lat?: number; lon?: number; primary?: "" | boolean; globe?: string; type?: string; dim?: number; country?: string; region?: string }>;
    }>;
  };
};

type ImageInfoResponse = {
  query?: {
    pages?: Record<string, {
      imageinfo?: Array<{
        url?: string;
        thumburl?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
};

type SummaryResponse = {
  title?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

export type ResolvedWikipediaSource = WikipediaSource & { image?: ImageAttribution };
export type ResolvedWikipediaCoordinate = { title: string; requestedTitle: string; url: string; latitude: number; longitude: number; broad?: boolean };
type WikipediaPage = NonNullable<NonNullable<PageResponse["query"]>["pages"]>[string];
type WikipediaImageInfo = NonNullable<NonNullable<NonNullable<ImageInfoResponse["query"]>["pages"]>[string]["imageinfo"]>[number];
type CachedRequest<T> = {
  promise: Promise<T>; expiresAt: number; value?: T; bytes?: number;
  flight?: { controller: AbortController; callers: Set<symbol>; settled: boolean };
};
export type WikipediaResolutionCache = {
  pages: Map<string, CachedRequest<WikipediaPage[]>>;
  searches: Map<string, CachedRequest<string[]>>;
  images: Map<string, CachedRequest<ImageAttribution | undefined>>;
  imageInfo: Map<string, CachedRequest<WikipediaImageInfo | undefined>>;
  places: Map<string, CachedRequest<ResolvedWikipediaCoordinate[]>>;
};

const cacheBudgets = new WeakMap<object, number>();

export function createWikipediaResolutionCache(): WikipediaResolutionCache {
  const cache: WikipediaResolutionCache = { pages: new Map(), searches: new Map(), images: new Map(), imageInfo: new Map(), places: new Map() };
  cacheBudgets.set(cache.pages, 4 * 1024 * 1024);
  cacheBudgets.set(cache.searches, 256 * 1024);
  cacheBudgets.set(cache.images, 512 * 1024);
  cacheBudgets.set(cache.imageInfo, 512 * 1024);
  cacheBudgets.set(cache.places, 512 * 1024);
  return cache;
}

export const sharedWikipediaResolutionCache = createWikipediaResolutionCache();
const WIKIPEDIA_CACHE_TTL_MS = 60 * 60 * 1000;
const WIKIPEDIA_MISSING_PAGE_TTL_MS = 60_000;
const MAX_WIKIPEDIA_CACHE_ENTRIES = 100;

function trimCache<T>(entries: Map<string, CachedRequest<T>>) {
  const budget = cacheBudgets.get(entries) ?? 4 * 1024 * 1024;
  let retainedBytes = 0;
  const references = new Map<CachedRequest<T>, number>();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= Date.now()) { entries.delete(key); continue; }
    if (entry.bytes === undefined && entry.value !== undefined) entry.bytes = approximateCacheBytes(entry.value, budget);
    if ((entry.bytes ?? 0) > budget) { entries.delete(key); continue; }
    const count = references.get(entry) ?? 0;
    retainedBytes += 96 + key.length * 2;
    if (count === 0) retainedBytes += entry.bytes ?? 128;
    references.set(entry, count + 1);
  }
  while (entries.size && (entries.size > MAX_WIKIPEDIA_CACHE_ENTRIES || retainedBytes > budget)) {
    const [key, entry] = entries.entries().next().value!;
    entries.delete(key);
    retainedBytes -= 96 + key.length * 2;
    const count = references.get(entry)!;
    // Redirect aliases share payload bytes until their last cache key is evicted.
    if (count === 1) {
      retainedBytes -= entry.bytes ?? 128;
      references.delete(entry);
    } else references.set(entry, count - 1);
  }
}

function cachedRequest<T>(entries: Map<string, CachedRequest<T>>, key: string) {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return undefined;
  }
  entries.delete(key);
  entries.set(key, entry);
  return entry;
}

function cancellationError() { return new DOMException("Wikipedia request canceled.", "AbortError"); }

function removeCachedRequest<T>(entries: Map<string, CachedRequest<T>>, entry: CachedRequest<T>) {
  for (const [alias, cached] of entries) if (cached === entry) entries.delete(alias);
}

/** Each caller owns its wait; only the final departing caller owns download cancellation. */
function sharedCachedRequest<T>(entries: Map<string, CachedRequest<T>>, key: string, signal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>, reusable: (value: T) => boolean = () => true,
  lifetime: (value: T) => number = () => WIKIPEDIA_CACHE_TTL_MS): Promise<T> {
  if (signal?.aborted) return Promise.reject(cancellationError());
  let entry = cachedRequest(entries, key);
  recordPerformance("wikipedia", entry ? (entry.flight && !entry.flight.settled ? "coalesced" : "cache_hits") : "cache_misses");
  if (!entry) {
    const flight = { controller: new AbortController(), callers: new Set<symbol>(), settled: false };
    const request = Promise.resolve().then(() => {
      if (flight.controller.signal.aborted) throw cancellationError();
      return operation(flight.controller.signal);
    });
    entry = { promise: request, expiresAt: Date.now() + WIKIPEDIA_CACHE_TTL_MS, flight };
    const created = entry;
    entries.set(key, created);
    trimCache(entries);
    void request.then((value) => {
      flight.settled = true;
      if (flight.controller.signal.aborted || !reusable(value)) removeCachedRequest(entries, created);
      else { created.value = value; created.expiresAt = Date.now() + lifetime(value); trimCache(entries); }
    }, () => {
      flight.settled = true;
      removeCachedRequest(entries, created);
    });
  }
  const shared = entry;
  const flight = shared.flight;
  const caller = Symbol();
  flight?.callers.add(caller);
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const release = () => {
      signal?.removeEventListener("abort", abort);
      flight?.callers.delete(caller);
      if (flight && !flight.settled && !flight.callers.size) {
        // Remove before aborting so a new caller never joins an abandoned request.
        removeCachedRequest(entries, shared);
        flight.controller.abort();
      }
    };
    const abort = () => {
      if (finished) return;
      finished = true; release(); reject(cancellationError());
    };
    signal?.addEventListener("abort", abort, { once: true });
    shared.promise.then((value) => {
      if (finished) return;
      finished = true; release(); resolve(value);
    }, (error) => {
      if (finished) return;
      finished = true; release(); reject(error);
    });
    if (signal?.aborted) abort();
  });
}

/**
 * Point a citation at the accepted evidence instead of the top of the article.
 * Text fragments are supported by current Safari, Chrome, and WebKit builds;
 * the plain article URL remains the fallback when a quote is unavailable.
 */
export function wikipediaEvidenceLink(url: string, quote?: string) {
  const text = quote?.replace(/^\[Section:[^\]]+\]\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text || text.length < 30) return url;
  const base = url.split("#", 1)[0];
  return `${base}#:~:text=${encodeURIComponent(text)}`;
}

function apiUrl(params: Record<string, string>) {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function getJson<T>(url: string, signal?: AbortSignal, priority = 0, cacheResponse = true): Promise<T | null> {
  const queuedAt = performance.now();
  const origin = new URL(url).origin;
  await acquireWikipediaSlot(signal, priority, origin);
  recordPerformance("wikipedia", "queue_ms", Math.max(0, performance.now() - queuedAt));
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  const timeout = setTimeout(() => controller.abort(), WIKIPEDIA_REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  let body: string;
  try {
    if (signal?.aborted) throw new DOMException("Wikipedia request canceled.", "AbortError");
    const response = await performanceFetch("wikipedia", url, {
      headers: { accept: "application/json", "user-agent": "LearnedMedia/0.2 (knowledge-feed)" },
      ...(cacheResponse ? { next: { revalidate: 3600 } } : { cache: "no-store" as const }),
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        noteWikipediaCooldown(response.url ? new URL(response.url).origin : origin, response.headers.get("Retry-After"));
      }
      return null;
    }
    body = await response.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
    releaseWikipediaSlot();
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function stripTags(value: string | undefined) {
  return value?.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

export async function searchWikipedia(query: string, limit = 3, signal?: AbortSignal) {
  const term = query.trim();
  if (!term) return [];
  const payload = await getJson<SearchResponse>(apiUrl({
    action: "query",
    list: "search",
    srsearch: term,
    srnamespace: "0",
    srlimit: String(Math.min(limit, 10))
  }), signal);
  return payload?.query?.search?.map((result) => result.title?.trim()).filter(Boolean) as string[] ?? [];
}

// Only API-confirmed normalization/redirect chains may share an article entry.
function verifiedWikipediaNames(title: string, query: PageResponse["query"], canonical: string) {
  const mappings = [...query?.normalized ?? [], ...query?.redirects ?? []];
  const redirects = new Map(mappings.map(({ from, to }) => [from, to]));
  return [...new Set([title, canonical, ...mappings.map(({ from }) => from)])].filter((name) => {
    const visited = new Set<string>();
    let current = name;
    while (current !== canonical && redirects.has(current) && !visited.has(current)) {
      visited.add(current);
      current = redirects.get(current)!;
    }
    return current === canonical;
  });
}

async function fetchPages(titles: string[], signal?: AbortSignal, cache?: WikipediaResolutionCache, priority = 0): Promise<WikipediaPage[]> {
  if (!titles.length) return [];
  // TextExtracts only returns full articles one at a time. Reuse in-flight page
  // requests within a feed batch so different cards do not fetch the same page.
  const uniqueTitles = Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
  return (await Promise.all(uniqueTitles.map((title) => {
    const key = title.toLocaleLowerCase();
    let confirmedMissing = false;
    const load = async (requestSignal: AbortSignal | undefined) => {
      const payload = await getJson<PageResponse>(apiUrl({
        action: "query",
        titles: title,
        prop: "info|extracts|pageimages",
        inprop: "url",
        redirects: "1",
        explaintext: "1",
        exsectionformat: "wiki",
        piprop: "thumbnail|name|original",
        pilicense: "free",
        pithumbsize: "1000"
      }), requestSignal, priority, false);
      // Cache only the API's explicit missing marker for the verified requested
      // title. Empty, invalid, inaccessible, or failed responses remain retryable.
      if (!payload || payload.error !== undefined) return [];
      const returnedPages = Object.values(payload.query?.pages ?? {});
      const missing = returnedPages.length === 1 ? returnedPages[0] : undefined;
      confirmedMissing = !!missing?.title && (missing.missing === "" || missing.missing === true)
        && missing.invalid === undefined && missing.known === undefined
        && verifiedWikipediaNames(title, payload.query, missing.title).includes(title);
      const pages = returnedPages.filter((page) => page?.title && page.fullurl
        && page.missing === undefined && page.invalid === undefined && page.known === undefined);
      if (!cache || pages.length !== 1) return pages;
      const page = pages[0];
      const names = verifiedWikipediaNames(title, payload?.query, page.title!);
      if (!names.includes(title)) return pages;
      const canonical = cachedRequest(cache.pages, page.title!.toLocaleLowerCase());
      const original = cache.pages.get(key);
      // Reuse completed content only: awaiting another pending alias could form a cycle.
      const existing = canonical?.value?.length === 1 && canonical.value[0].fullurl === page.fullurl ? canonical : undefined;
      if (!existing && !original) return pages;
      const entry: CachedRequest<WikipediaPage[]> = existing ?? {
        promise: Promise.resolve(pages), value: pages, expiresAt: original!.expiresAt
      };
      if (entry.expiresAt <= Date.now()) return pages;
      for (const name of names) {
        const alias = name.toLocaleLowerCase();
        cache.pages.delete(alias);
        cache.pages.set(alias, entry);
      }
      trimCache(cache.pages);
      return entry.value!;
    };
    return cache ? sharedCachedRequest(cache.pages, key, signal, load,
      (pages) => pages.length > 0 || confirmedMissing,
      (pages) => pages.length ? WIKIPEDIA_CACHE_TTL_MS : WIKIPEDIA_MISSING_PAGE_TTL_MS) : load(signal);
  }))).flat();
}

async function fetchImageInfo(pageimage: string, size: number, cache: WikipediaResolutionCache, signal?: AbortSignal, priority = 1) {
  // pageimage is Wikipedia's verified file name. File names are case-sensitive;
  // only the equivalent space/underscore representations share a cache key.
  const key = JSON.stringify([pageimage.replace(/_/g, " ").trim(), size]);
  return sharedCachedRequest(cache.imageInfo, key, signal, async (requestSignal) => {
    const payload = await getJson<ImageInfoResponse>(apiUrl({
      action: "query",
      titles: `File:${pageimage}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: String(size)
    }), requestSignal, priority);
    return Object.values(payload?.query?.pages ?? {})[0]?.imageinfo?.[0];
  }, (info) => !!info);
}

async function fetchSummary(title: string, signal?: AbortSignal, priority = 1) {
  const normalizedTitle = title.trim().replace(/\s+/g, "_");
  if (!normalizedTitle) return null;
  return getJson<SummaryResponse>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalizedTitle)}`, signal, priority);
}

function imageFileName(imageUrl: string) {
  try {
    const parts = decodeURIComponent(new URL(imageUrl).pathname).split("/").filter(Boolean);
    const thumbIndex = parts.indexOf("thumb");
    if (thumbIndex >= 0 && parts[thumbIndex + 3]) return parts[thumbIndex + 3];
    const lastPart = parts.at(-1);
    return lastPart && /\.(?:jpe?g|png|gif|svg|webp)$/i.test(lastPart) ? lastPart : undefined;
  } catch {
    return undefined;
  }
}

function filePageUrl(imageUrl: string) {
  const filename = imageFileName(imageUrl);
  if (!filename) return undefined;
  const host = imageUrl.includes("/commons/") ? "https://commons.wikimedia.org/wiki/File:" : "https://en.wikipedia.org/wiki/File:";
  return `${host}${encodeURIComponent(filename.replace(/ /g, "_"))}`;
}

async function resolveImage(page: {
  title: string;
  fullurl: string;
  pageimage?: string;
  thumbnail?: { source?: string };
  original?: { source?: string };
}, cache: WikipediaResolutionCache, signal?: AbortSignal, priority = 1): Promise<ImageAttribution | undefined> {
  const fallbackUrl = page.thumbnail?.source ?? page.original?.source;
  if (page.pageimage) {
    const image = await fetchImageInfo(page.pageimage, 1400, cache, signal, priority);
    const metadata = image?.extmetadata;
    const url = image?.thumburl ?? fallbackUrl ?? image?.url;
    if (url) {
      return {
        url,
        alt: page.title,
        sourceTitle: page.title,
        sourceUrl: page.fullurl,
        fileUrl: image?.url ?? page.original?.source ?? fallbackUrl,
        filePageUrl: image?.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage.replace(/ /g, "_"))}`,
        credit: stripTags(metadata?.Artist?.value ?? metadata?.Credit?.value ?? metadata?.LicenseShortName?.value) ?? "Wikipedia image"
      };
    }
  }
  if (fallbackUrl) {
    return {
      url: fallbackUrl,
      alt: page.title,
      sourceTitle: page.title,
      sourceUrl: page.fullurl,
      fileUrl: page.original?.source ?? fallbackUrl,
      filePageUrl: filePageUrl(fallbackUrl) ?? page.fullurl,
      credit: "Wikipedia image"
    };
  }
  const summary = await fetchSummary(page.title, signal, priority);
  const summaryUrl = summary?.thumbnail?.source ?? summary?.originalimage?.source;
  if (!summary || !summaryUrl) return undefined;
  const summaryPageUrl = summary.content_urls?.desktop?.page ?? page.fullurl;
  return {
    url: summaryUrl,
    alt: summary.title ?? page.title,
    sourceTitle: summary.title ?? page.title,
    sourceUrl: summaryPageUrl,
    fileUrl: summary.originalimage?.source ?? summaryUrl,
    filePageUrl: filePageUrl(summary.originalimage?.source ?? summaryUrl) ?? summaryPageUrl,
    credit: "Wikipedia image"
  };
}

export async function resolveWikipediaSources(queries: string[], limit = 3, signal?: AbortSignal, options: { includeImages?: boolean; cache?: WikipediaResolutionCache } = {}): Promise<ResolvedWikipediaSource[]> {
  const cleanQueries = Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).slice(0, 5);
  if (!cleanQueries.length) return [];
  const cache = options.cache ?? sharedWikipediaResolutionCache;
  const exact = await fetchPages(cleanQueries.slice(0, limit), signal, cache);
  const searchedTitles = exact.length ? [] : await Promise.all(cleanQueries.map((query) => {
    const key = query.toLocaleLowerCase();
    return sharedCachedRequest(cache.searches, key, signal, (requestSignal) => searchWikipedia(query, 1, requestSignal));
  }));
  const titles = Array.from(new Set(exact.length ? exact.map(page => page.title!) : searchedTitles.flat().filter(Boolean))).slice(0, limit);
  const pages = exact.length ? exact : await fetchPages(titles, signal, cache);
  const pagesByTitle = new Map(pages.map((page) => [page.title?.toLowerCase(), page]));
  const orderedPages = titles.map((title) => pagesByTitle.get(title.toLowerCase())).filter(Boolean) as typeof pages;
  const includeImages = options.includeImages !== false;
  const resolved = await Promise.all((orderedPages.length ? orderedPages : pages).map(async (page) => {
    const source: ResolvedWikipediaSource = {
      title: page.title as string,
      url: page.fullurl as string,
      canonicalUrl: page.fullurl as string,
      extract: page.extract?.trim() || undefined
    };
    if (includeImages) source.image = await resolveImage({
      title: page.title as string,
      fullurl: page.fullurl as string,
      pageimage: page.pageimage,
      thumbnail: page.thumbnail,
      original: page.original
    }, cache, signal, 1);
    return source;
  }));
  return resolved;
}

/** Fetch one exact article title through the shared cache without search or image attribution work. */
export async function resolveWikipediaArticle(title: string, signal?: AbortSignal, cache = sharedWikipediaResolutionCache): Promise<WikipediaSource | undefined> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return undefined;
  const page = (await fetchPages([cleanTitle], signal, cache, 1))[0];
  if (!page?.title || !page.fullurl || !page.extract) return undefined;
  return { title: page.title, url: page.fullurl, canonicalUrl: page.fullurl, extract: page.extract.trim() };
}

/** Resolve only exact article titles. Disambiguation pages and non-primary or non-Earth coordinates are ignored. */
export async function resolveWikipediaCoordinates(titles: string[], signal?: AbortSignal, cache = sharedWikipediaResolutionCache): Promise<ResolvedWikipediaCoordinate[]> {
  const cleanTitles = Array.from(new Set(titles.map(title => title.trim()).filter(Boolean))).slice(0, 2);
  if (!cleanTitles.length) return [];
  const key = cleanTitles.map(title => title.toLocaleLowerCase()).sort().join("\u0000");
  return sharedCachedRequest(cache.places, key, signal, async requestSignal => {
    const payload = await getJson<PageResponse>(apiUrl({
      action: "query", titles: cleanTitles.join("|"), redirects: "1", prop: "coordinates|info|pageprops", inprop: "url",
      coprimary: "primary", coprop: "type|dim|country|region"
    }), requestSignal, 1, false);
    if (!payload || payload.error !== undefined) throw new Error("Wikipedia location details could not be loaded.");
    const pages = Object.values(payload.query?.pages ?? {});
    const resolved: ResolvedWikipediaCoordinate[] = [];
    for (const requested of cleanTitles) {
      for (const page of pages) {
        if (!page.title || !page.fullurl || page.missing !== undefined || page.invalid !== undefined || page.known !== undefined || page.pageprops?.disambiguation !== undefined) continue;
        if (!verifiedWikipediaNames(requested, payload.query, page.title).includes(requested)) continue;
        const coordinate = page.coordinates?.find(item => (item.primary === "" || item.primary === true) && item.globe?.toLocaleLowerCase() === "earth" && Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.lat! >= -90 && item.lat! <= 90 && item.lon! >= -180 && item.lon! <= 180);
        if (!coordinate) continue;
        const broad = /^(?:country|continent|region|adm1|adm2)$/iu.test(coordinate.type ?? "") || (coordinate.dim !== undefined && coordinate.dim >= 500_000);
        resolved.push({ title: page.title, requestedTitle: requested, url: page.fullurl, latitude: coordinate.lat!, longitude: coordinate.lon!, ...(broad ? { broad: true } : {}) });
        break;
      }
    }
    return resolved;
  }, () => true);
}

export async function resolveWikipediaImage(source: WikipediaSource, signal?: AbortSignal, cache?: WikipediaResolutionCache) {
  cache ??= sharedWikipediaResolutionCache;
  const key = (source.canonicalUrl ?? source.url ?? source.title).toLocaleLowerCase();
  return sharedCachedRequest(cache.images, key, signal, async (requestSignal) => {
    const page = (await fetchPages([source.title], requestSignal, cache, 1)).find((candidate) => candidate.title?.toLocaleLowerCase() === source.title.toLocaleLowerCase());
    if (!page?.title || !page.fullurl) return undefined;
    return resolveImage({
      title: page.title,
      fullurl: page.fullurl,
      pageimage: page.pageimage,
      thumbnail: page.thumbnail,
      original: page.original
    }, cache, requestSignal, 1);
  }, (image) => !!image);
}

export async function resolveWikipediaTitle(title: string) {
  const fallbackTitle = title.trim() || "Wikipedia";
  const fallbackUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(fallbackTitle.replace(/\s+/g, "_"))}`;
  const result = (await resolveWikipediaSources([fallbackTitle], 1))[0];
  return result ? { title: result.title, url: result.url } : { title: fallbackTitle, url: fallbackUrl };
}
