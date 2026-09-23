import type { ImageAttribution, WikipediaSource } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const MAX_CONCURRENT_WIKIPEDIA_REQUESTS = 4;
let wikipediaInFlight = 0;
const wikipediaWaiters: Array<() => void> = [];

async function acquireWikipediaSlot(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Wikipedia request canceled.", "AbortError");
  if (wikipediaInFlight >= MAX_CONCURRENT_WIKIPEDIA_REQUESTS) {
    await new Promise<void>((resolve, reject) => {
      const waiter = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        const index = wikipediaWaiters.indexOf(waiter);
        if (index >= 0) wikipediaWaiters.splice(index, 1);
        reject(new DOMException("Wikipedia request canceled.", "AbortError"));
      };
      wikipediaWaiters.push(waiter);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  wikipediaInFlight += 1;
}

function releaseWikipediaSlot() {
  wikipediaInFlight = Math.max(0, wikipediaInFlight - 1);
  wikipediaWaiters.shift()?.();
}

type SearchResponse = {
  query?: { search?: Array<{ title?: string }> };
};

type PageResponse = {
  query?: {
    pages?: Record<string, {
      title?: string;
      fullurl?: string;
      extract?: string;
      pageimage?: string;
      thumbnail?: { source?: string };
      original?: { source?: string };
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
type WikipediaPage = NonNullable<NonNullable<PageResponse["query"]>["pages"]>[string];
export type WikipediaResolutionCache = {
  pages: Map<string, Promise<WikipediaPage[]>>;
  searches: Map<string, Promise<string[]>>;
  images: Map<string, Promise<ImageAttribution | undefined>>;
};

export function createWikipediaResolutionCache(): WikipediaResolutionCache {
  return { pages: new Map(), searches: new Map(), images: new Map() };
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

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  await acquireWikipediaSlot(signal);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "LearnedMedia/0.2 (knowledge-feed)" },
      next: { revalidate: 3600 },
      signal
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  } finally {
    releaseWikipediaSlot();
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

async function fetchPages(titles: string[], signal?: AbortSignal, cache?: WikipediaResolutionCache): Promise<WikipediaPage[]> {
  if (!titles.length) return [];
  // TextExtracts only returns full articles one at a time. Reuse in-flight page
  // requests within a feed batch so different cards do not fetch the same page.
  const uniqueTitles = Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
  return (await Promise.all(uniqueTitles.map((title) => {
    const key = title.toLocaleLowerCase();
    const pending = cache?.pages.get(key);
    if (pending) return pending;
    const request = (async () => {
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
      }), signal);
      return Object.values(payload?.query?.pages ?? {}).filter((page) => page.title && page.fullurl);
    })();
    if (cache) {
      cache.pages.set(key, request);
      void request.catch(() => { if (cache.pages.get(key) === request) cache.pages.delete(key); });
    }
    return request;
  }))).flat();
}

async function fetchImageInfo(pageimage: string, signal?: AbortSignal) {
  const payload = await getJson<ImageInfoResponse>(apiUrl({
    action: "query",
    titles: `File:${pageimage}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1400"
  }), signal);
  return Object.values(payload?.query?.pages ?? {})[0]?.imageinfo?.[0];
}

async function fetchSummary(title: string, signal?: AbortSignal) {
  const normalizedTitle = title.trim().replace(/\s+/g, "_");
  if (!normalizedTitle) return null;
  return getJson<SummaryResponse>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalizedTitle)}`, signal);
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
}, signal?: AbortSignal): Promise<ImageAttribution | undefined> {
  const fallbackUrl = page.thumbnail?.source ?? page.original?.source;
  if (page.pageimage) {
    const image = await fetchImageInfo(page.pageimage, signal);
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
  const summary = await fetchSummary(page.title, signal);
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
  const cache = options.cache;
  const exact = await fetchPages(cleanQueries.slice(0, limit), signal, cache);
  const searchedTitles = exact.length ? [] : await Promise.all(cleanQueries.map((query) => {
    const key = query.toLocaleLowerCase();
    const pending = cache?.searches.get(key);
    if (pending) return pending;
    const request = searchWikipedia(query, 1, signal);
    if (cache) {
      cache.searches.set(key, request);
      void request.catch(() => { if (cache.searches.get(key) === request) cache.searches.delete(key); });
    }
    return request;
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
    }, signal);
    return source;
  }));
  return resolved;
}

export async function resolveWikipediaImage(source: WikipediaSource, signal?: AbortSignal, cache?: WikipediaResolutionCache) {
  const key = (source.canonicalUrl ?? source.url ?? source.title).toLocaleLowerCase();
  const pending = cache?.images.get(key);
  if (pending) return pending;
  const request = (async () => {
    const page = (await fetchPages([source.title], signal, cache)).find((candidate) => candidate.title?.toLocaleLowerCase() === source.title.toLocaleLowerCase());
    if (!page?.title || !page.fullurl) return undefined;
    return resolveImage({
      title: page.title,
      fullurl: page.fullurl,
      pageimage: page.pageimage,
      thumbnail: page.thumbnail,
      original: page.original
    }, signal);
  })();
  if (cache) {
    cache.images.set(key, request);
    void request.catch(() => { if (cache.images.get(key) === request) cache.images.delete(key); });
  }
  return request;
}

export async function resolveWikipediaTitle(title: string) {
  const fallbackTitle = title.trim() || "Wikipedia";
  const fallbackUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(fallbackTitle.replace(/\s+/g, "_"))}`;
  const result = (await resolveWikipediaSources([fallbackTitle], 1))[0];
  return result ? { title: result.title, url: result.url } : { title: fallbackTitle, url: fallbackUrl };
}
