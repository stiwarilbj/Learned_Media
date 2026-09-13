import type { FactCard, ImageAttribution, WikipediaSource } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

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

export type ResolvedWikipediaSource = WikipediaSource & { image?: ImageAttribution };

function apiUrl(params: Record<string, string>) {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "LearnedMedia/0.2 (knowledge-feed)" },
      next: { revalidate: 3600 }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function stripTags(value: string | undefined) {
  return value?.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

export async function searchWikipedia(query: string, limit = 3) {
  const term = query.trim();
  if (!term) return [];
  const payload = await getJson<SearchResponse>(apiUrl({
    action: "query",
    list: "search",
    srsearch: term,
    srnamespace: "0",
    srlimit: String(Math.min(limit, 10))
  }));
  return payload?.query?.search?.map((result) => result.title?.trim()).filter(Boolean) as string[] ?? [];
}

async function fetchPages(titles: string[]) {
  if (!titles.length) return [];
  const payload = await getJson<PageResponse>(apiUrl({
    action: "query",
    titles: titles.join("|"),
    prop: "info|extracts|pageimages",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail|name|original",
    pilicense: "free",
    pithumbsize: "1000"
  }));
  return Object.values(payload?.query?.pages ?? {}).filter((page) => page.title && page.fullurl);
}

async function fetchImageInfo(pageimage: string) {
  const payload = await getJson<ImageInfoResponse>(apiUrl({
    action: "query",
    titles: `File:${pageimage}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1400"
  }));
  return Object.values(payload?.query?.pages ?? {})[0]?.imageinfo?.[0];
}

async function resolveImage(page: {
  title: string;
  fullurl: string;
  pageimage?: string;
  thumbnail?: { source?: string };
  original?: { source?: string };
}): Promise<ImageAttribution | undefined> {
  const fallbackUrl = page.thumbnail?.source ?? page.original?.source;
  if (!fallbackUrl || !page.pageimage) {
    return fallbackUrl ? { url: fallbackUrl, alt: page.title, sourceTitle: page.title, sourceUrl: page.fullurl } : undefined;
  }
  const image = await fetchImageInfo(page.pageimage);
  const metadata = image?.extmetadata;
  return {
    url: image?.thumburl ?? fallbackUrl,
    alt: page.title,
    sourceTitle: page.title,
    sourceUrl: page.fullurl,
    fileUrl: image?.url ?? page.original?.source ?? fallbackUrl,
    filePageUrl: image?.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage.replace(/ /g, "_"))}`,
    credit: stripTags(metadata?.Artist?.value ?? metadata?.Credit?.value ?? metadata?.LicenseShortName?.value)
  };
}

export async function resolveWikipediaSources(queries: string[], limit = 3): Promise<ResolvedWikipediaSource[]> {
  const cleanQueries = Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean))).slice(0, 5);
  if (!cleanQueries.length) return [];
  const searchedTitles = await Promise.all(cleanQueries.map((query) => searchWikipedia(query, 1)));
  const titles = Array.from(new Set(searchedTitles.flat().filter(Boolean))).slice(0, limit);
  const pages = await fetchPages(titles);
  const pagesByTitle = new Map(pages.map((page) => [page.title?.toLowerCase(), page]));
  const orderedPages = titles.map((title) => pagesByTitle.get(title.toLowerCase())).filter(Boolean) as typeof pages;
  const resolved = await Promise.all((orderedPages.length ? orderedPages : pages).map(async (page) => ({
    title: page.title as string,
    url: page.fullurl as string,
    extract: page.extract?.trim() || undefined,
    image: await resolveImage({
      title: page.title as string,
      fullurl: page.fullurl as string,
      pageimage: page.pageimage,
      thumbnail: page.thumbnail,
      original: page.original
    })
  })));
  return resolved;
}

export async function resolveWikipediaTitle(title: string) {
  const fallbackTitle = title.trim() || "Wikipedia";
  const fallbackUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(fallbackTitle.replace(/\s+/g, "_"))}`;
  const result = (await resolveWikipediaSources([fallbackTitle], 1))[0];
  return result ? { title: result.title, url: result.url } : { title: fallbackTitle, url: fallbackUrl };
}

export async function enrichDemoCards(cards: FactCard[]) {
  return Promise.all(cards.map(async (card) => {
    const sources = await resolveWikipediaSources(card.sources.map((source) => source.title), 3);
    const image = sources.find((source) => source.image)?.image;
    return {
      ...card,
      sources: sources.length ? sources.map(({ image: _image, ...source }) => source) : card.sources,
      image: card.image ?? image
    };
  }));
}
