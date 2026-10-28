import type { FactCard, WikipediaSource } from "./types";
import { MAX_RECENT_CARD_TOOL_CARDS, pruneCardToolState, registerCardToolStatePruner } from "./card-tool-state-retention";

export type CardLocationAnchor = { field: "title" | "hook" | "body"; sentenceIndex?: number };
export type SavedCardLocation = {
  name: string;
  articleTitle: string;
  anchor: CardLocationAnchor;
  latitude?: number;
  longitude?: number;
  countryCode?: string;
  broad?: boolean;
};
export type SavedCardLocations = { locations: SavedCardLocation[]; fingerprint: string };
export type PocketMapPlace = SavedCardLocation & { url: string };
export type CountryOutline = { name: string; iso: string; aliases: string[]; polygons: number[][][][] };
export type CountryOutlines = { version: string; source: string; countries: CountryOutline[] };
type LocationCard = Pick<FactCard, "title" | "hook" | "body" | "sources"> & { sentences?: string[]; locations?: SavedCardLocations | unknown };

const countryNames: Array<[string, string, string[]]> = [
  ["United States", "USA", ["United States of America", "United States", "USA", "U.S."]],
  ["United Kingdom", "GBR", ["United Kingdom", "Britain", "Great Britain", "UK", "U.K.", "England", "Scotland", "Wales"]],
  ["France", "FRA", ["France"]], ["Italy", "ITA", ["Italy"]], ["Russia", "RUS", ["Russia", "Russian Federation"]],
  ["China", "CHN", ["China", "People's Republic of China"]], ["India", "IND", ["India"]],
  ["Japan", "JPN", ["Japan"]], ["Canada", "CAN", ["Canada"]], ["Mexico", "MEX", ["Mexico"]],
  ["Brazil", "BRA", ["Brazil"]], ["Australia", "AUS", ["Australia"]], ["New Zealand", "NZL", ["New Zealand"]],
  ["South Africa", "ZAF", ["South Africa"]], ["Egypt", "EGY", ["Egypt"]], ["Turkey", "TUR", ["Turkey", "Türkiye"]],
  ["Iran", "IRN", ["Iran"]], ["Iraq", "IRQ", ["Iraq"]], ["Israel", "ISR", ["Israel"]],
  ["Ukraine", "UKR", ["Ukraine"]], ["Poland", "POL", ["Poland"]], ["Spain", "ESP", ["Spain"]],
  ["Portugal", "PRT", ["Portugal"]], ["Greece", "GRC", ["Greece"]], ["Germany", "DEU", ["Germany"]],
  ["Argentina", "ARG", ["Argentina"]], ["Chile", "CHL", ["Chile"]], ["Peru", "PER", ["Peru"]],
  ["Kenya", "KEN", ["Kenya"]], ["Nigeria", "NGA", ["Nigeria"]], ["Iceland", "ISL", ["Iceland"]]
];
const countryByAlias = new Map(countryNames.flatMap(([name, code, aliases]) => aliases.map(alias => [alias.toLocaleLowerCase(), { name, code, alias }] as const)));
const bundledOutlines = new Map<string, CountryOutlines>();
let outlinePromise: Promise<CountryOutlines> | undefined;
const panelFingerprints = new Map<string, string>();
const panelListeners = new Map<string, Set<() => void>>();
const MAX_OPEN_PANELS = 500;

function clean(value: unknown) { return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : ""; }
function normal(value: string) { return clean(value).normalize("NFC").toLocaleLowerCase(); }
function exactMention(text: string, term: string) {
  const haystack = normal(text), needle = normal(term);
  if (!needle) return false;
  let at = haystack.indexOf(needle);
  while (at >= 0) {
    const before = haystack[at - 1] ?? "", after = haystack[at + needle.length] ?? "";
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
    at = haystack.indexOf(needle, at + 1);
  }
  return false;
}
function cardSentences(card: LocationCard) {
  const saved = Array.isArray(card.sentences) ? card.sentences.filter((value): value is string => typeof value === "string").map(clean).filter(Boolean) : [];
  if (saved.length && normal(saved.join(" ")) === normal(card.body)) return saved;
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("en", { granularity: "sentence" }).segment(card.body)).map(item => clean(item.segment)).filter(Boolean);
  return card.body.match(/[^.!?]+(?:[.!?]+[”’"')\]]*)?(?:\s+|$)/gu)?.map(clean).filter(Boolean) ?? (card.body ? [card.body] : []);
}
export function cardLocationsFingerprint(card: LocationCard) {
  const identity = JSON.stringify([card.title, card.hook, card.body, cardSentences(card)]);
  let a = 2166136261, b = 0x9e3779b9;
  for (let index = 0; index < identity.length; index++) { const code = identity.charCodeAt(index); a = Math.imul(a ^ code, 16777619); b = Math.imul(b ^ (code + index), 2246822519); }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
function anchorText(card: LocationCard, anchor: CardLocationAnchor) {
  if (anchor.field === "title") return card.title;
  if (anchor.field === "hook") return card.hook;
  return typeof anchor.sentenceIndex === "number" ? cardSentences(card)[anchor.sentenceIndex] ?? "" : card.body;
}
function normalizeLocation(raw: unknown, card: LocationCard): SavedCardLocation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const item = raw as Partial<SavedCardLocation>;
  const name = clean(item.name), articleTitle = clean(item.articleTitle);
  const anchor = item.anchor;
  if (!name || name.length > 100 || !articleTitle || articleTitle.length > 160 || !anchor || !["title", "hook", "body"].includes(anchor.field)) return undefined;
  if (anchor.field === "body" && !Number.isInteger(anchor.sentenceIndex)) return undefined;
  const safeAnchor: CardLocationAnchor = anchor.field === "body" && Number.isInteger(anchor.sentenceIndex)
    ? { field: "body", sentenceIndex: anchor.sentenceIndex }
    : { field: anchor.field };
  if (!exactMention(anchorText(card, safeAnchor), name)) return undefined;
  const latitude = Number.isFinite(item.latitude) && item.latitude! >= -90 && item.latitude! <= 90 ? item.latitude : undefined;
  const longitude = Number.isFinite(item.longitude) && item.longitude! >= -180 && item.longitude! <= 180 ? item.longitude : undefined;
  return { name, articleTitle, anchor: safeAnchor, ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}), ...(typeof item.countryCode === "string" && /^[A-Z]{3}$/u.test(item.countryCode) ? { countryCode: item.countryCode } : {}), ...(item.broad === true ? { broad: true } : {}) };
}

function isCountryName(value: string) {
  const match = countryByAlias.get(normal(value));
  return Boolean(match || countryNames.some(([name]) => normal(name) === normal(value)));
}

/** Optional place hints are validated independently so bad hints never invalidate a card. */
export function createSavedCardLocations(raw: unknown, card: LocationCard): SavedCardLocations | undefined {
  const entries = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { locations?: unknown }).locations) ? (raw as { locations: unknown[] }).locations : [];
  const seen = new Set<string>();
  const valid = entries.map(item => normalizeLocation(item, card)).filter((item): item is SavedCardLocation => {
    if (!item) return false;
    const key = normal(item.name);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const places = valid.some(item => !isCountryName(item.name)) ? valid.filter(item => !isCountryName(item.name)) : valid;
  const locations = places.slice(0, 2);
  return locations.length ? { locations, fingerprint: cardLocationsFingerprint(card) } : undefined;
}

export function normalizeSavedCardLocations(card: LocationCard): SavedCardLocations | undefined {
  const raw = card.locations as Partial<SavedCardLocations> | undefined;
  if (!raw || raw.fingerprint !== cardLocationsFingerprint(card) || !Array.isArray(raw.locations)) return undefined;
  const normalized = createSavedCardLocations(raw.locations, card);
  return normalized ? { ...normalized, fingerprint: raw.fingerprint } : undefined;
}

function legacyLocations(card: LocationCard): SavedCardLocation[] {
  const fullText = `${card.title} ${card.hook} ${card.body}`;
  const sentences = cardSentences(card);
  const candidates: SavedCardLocation[] = [];
  const add = (name: string, articleTitle: string, code?: string) => {
    const anchors: Array<{ field: "title" | "hook" | "body"; sentenceIndex?: number; text: string }> = [
      { field: "title", text: card.title }, { field: "hook", text: card.hook }, ...sentences.map((text, sentenceIndex) => ({ field: "body" as const, sentenceIndex, text }))
    ];
    const anchor = anchors.find(item => exactMention(item.text, name));
    if (anchor && !candidates.some(item => normal(item.name) === normal(name))) candidates.push({ name, articleTitle, anchor: { field: anchor.field, ...(anchor.sentenceIndex !== undefined ? { sentenceIndex: anchor.sentenceIndex } : {}) }, ...(code ? { countryCode: code } : {}) });
  };
  for (const source of card.sources ?? []) {
    const title = clean(source.title).replace(/\s*\([^)]*\)\s*$/u, "");
    if (title && title.length > 2 && exactMention(fullText, title)) {
      const known = countryByAlias.get(title.toLocaleLowerCase());
      add(title, known?.name ?? title, known?.code);
    }
  }
  for (const [alias, place] of countryByAlias) {
    if (alias.length > 2 && exactMention(fullText, place.alias)) add(place.alias, place.name, place.code);
  }
  // A country that merely supplies orientation should not compete with an explicitly named city/site.
  const nonCountry = candidates.filter(item => !countryNames.some(([name]) => normal(name) === normal(item.name)));
  return (nonCountry.length ? nonCountry : candidates).slice(0, 2);
}

export function getVisibleCardLocations(card: LocationCard, visibleSentenceCount: number, bodyFullyVisible: boolean): SavedCardLocation[] {
  const saved = normalizeSavedCardLocations(card);
  const locations = saved?.locations ?? legacyLocations(card);
  return locations.filter(location => location.anchor.field !== "body" || bodyFullyVisible || location.anchor.sentenceIndex !== undefined && location.anchor.sentenceIndex < visibleSentenceCount);
}

export function attachVerifiedLocationCoordinates(card: LocationCard, updates: Array<Pick<SavedCardLocation, "articleTitle" | "latitude" | "longitude" | "countryCode" | "broad">>) {
  const existing = normalizeSavedCardLocations(card)?.locations ?? legacyLocations(card);
  const updateMap = new Map(updates.map(item => [normal(item.articleTitle), item]));
  const locations = existing.map(location => {
    const update = updateMap.get(normal(location.articleTitle));
    if (!update) return location;
    const hasCoordinates = Number.isFinite(update.latitude) && Number.isFinite(update.longitude);
    return { ...location, ...(hasCoordinates ? { latitude: update.latitude, longitude: update.longitude } : {}), ...(update.countryCode ? { countryCode: update.countryCode } : {}), ...(update.broad !== undefined ? { broad: update.broad } : {}), name: location.name, anchor: location.anchor };
  });
  const normalized = createSavedCardLocations(locations, card);
  return normalized ? { locations: normalized.locations, fingerprint: normalized.fingerprint } : undefined;
}

export function getCardLocationPanelOpen(workspaceId: string, cardId: string, fingerprint: string) { return panelFingerprints.get(`${workspaceId}\u0000${cardId}`) === fingerprint; }
export type CardLocationPanelState = { fingerprint: string; status: "idle" | "loading" | "ready" | "error"; attempt?: number; requestedKey?: string };
const panelStates = new Map<string, CardLocationPanelState>();
const idleStates = new Map<string, CardLocationPanelState>();
const MAX_IDLE_PANEL_STATES = MAX_RECENT_CARD_TOOL_CARDS * 2;
function notifyPanelListeners(key: string) { for (const listener of panelListeners.get(key) ?? []) listener(); }
registerCardToolStatePruner(({ workspaceId, retainedCardIds }) => {
  const cardKeyFor = (key: string) => {
    const separator = key.indexOf("\u0000");
    if (separator < 0) return null;
    const cardSeparator = key.indexOf("\u0000", separator + 1);
    return cardSeparator < 0 ? null : { workspace: key.slice(0, separator), cardId: key.slice(separator + 1, cardSeparator), cardKey: key.slice(0, cardSeparator) };
  };
  for (const [key, state] of panelStates) {
    const isOpen = panelFingerprints.get(key) === state.fingerprint;
    const card = cardKeyFor(`${key}\u0000${state.fingerprint}`);
    const isRetained = card?.workspace === workspaceId && retainedCardIds.has(card.cardId);
    if (isOpen || isRetained) continue;
    panelStates.delete(key);
    notifyPanelListeners(key);
  }
  for (const [key, state] of idleStates) {
    const card = cardKeyFor(key);
    const isOpen = card ? panelFingerprints.get(card.cardKey) === state.fingerprint : false;
    const isRetained = card?.workspace === workspaceId && retainedCardIds.has(card.cardId);
    if (!isOpen && !isRetained) idleStates.delete(key);
  }
});
export function getCardLocationPanelState(workspaceId: string, cardId: string, fingerprint: string): CardLocationPanelState { const key = `${workspaceId}\u0000${cardId}`, state = panelStates.get(key); if (state?.fingerprint === fingerprint) return state; const idleKey = `${key}\u0000${fingerprint}`; let idle = idleStates.get(idleKey); if (!idle) { idle = { fingerprint, status: "idle" }; idleStates.set(idleKey, idle); while (idleStates.size > MAX_IDLE_PANEL_STATES) idleStates.delete(idleStates.keys().next().value!); } return idle; }
export function setCardLocationPanelState(workspaceId: string, cardId: string, state: CardLocationPanelState) { const key = `${workspaceId}\u0000${cardId}`; idleStates.delete(`${key}\u0000${state.fingerprint}`); panelStates.delete(key); panelStates.set(key, state); while (panelStates.size > MAX_OPEN_PANELS) panelStates.delete(panelStates.keys().next().value!); for (const listener of panelListeners.get(key) ?? []) listener(); }
export function subscribeCardLocationPanel(workspaceId: string, cardId: string, listener: () => void) {
  const key = `${workspaceId}\u0000${cardId}`, set = panelListeners.get(key) ?? new Set<() => void>(); set.add(listener); panelListeners.set(key, set);
  return () => { set.delete(listener); if (!set.size) panelListeners.delete(key); };
}
export function setCardLocationPanelOpen(workspaceId: string, cardId: string, fingerprint: string, open: boolean) {
  const key = `${workspaceId}\u0000${cardId}`;
  if (open) { panelFingerprints.delete(key); panelFingerprints.set(key, fingerprint); while (panelFingerprints.size > MAX_OPEN_PANELS) panelFingerprints.delete(panelFingerprints.keys().next().value!); }
  else panelFingerprints.delete(key);
  for (const listener of panelListeners.get(key) ?? []) listener();
  if (!open) pruneCardToolState();
}

export async function loadCountryOutlines(load?: () => Promise<CountryOutlines>) {
  const cached = bundledOutlines.get("110m-v1"); if (cached) return cached;
  const appBase = typeof window !== "undefined" && window.location.pathname.startsWith("/Learned_Media/") ? "/Learned_Media/" : "/";
  outlinePromise ??= (load ? load() : fetch(new URL(`${appBase}country-outlines.json`, window.location.origin).toString()).then(response => { if (!response.ok) throw new Error("The map outline could not be loaded."); return response.json() as Promise<CountryOutlines>; }))
    .then(value => { if (!Array.isArray(value.countries)) throw new Error("The map outline data is invalid."); bundledOutlines.set("110m-v1", value); return value; })
    .catch(error => { outlinePromise = undefined; throw error; });
  return outlinePromise;
}

function longitudeDelta(longitude: number, center: number) { return ((longitude - center + 540) % 360) - 180; }
function pointInRing(longitude: number, latitude: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
function pointInCountry(longitude: number, latitude: number, country: CountryOutline) { return country.polygons.some(polygon => polygon.length && pointInRing(longitude, latitude, polygon[0])); }

export type PocketMapLayout = { width: number; height: number; outlines: Array<{ key: string; d: string; selected: boolean }>; markers: Array<{ x: number; y: number; labelX: number; labelY: number; anchor: "start" | "end"; number: number; name: string; url: string; country?: string }> };
export function layoutPocketMap(countries: CountryOutline[], places: PocketMapPlace[], width = 720, height = 330): PocketMapLayout {
  const valid = places.filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)).slice(0, 2);
  const lons = valid.map(place => place.longitude! * Math.PI / 180);
  const centerLon = lons.length ? Math.atan2(lons.reduce((sum, lon) => sum + Math.sin(lon), 0), lons.reduce((sum, lon) => sum + Math.cos(lon), 0)) * 180 / Math.PI : 0;
  const centerLat = valid.length ? valid.reduce((sum, place) => sum + place.latitude!, 0) / valid.length : 0;
  const cosLat = Math.max(0.15, Math.cos(centerLat * Math.PI / 180));
  const projected = (lon: number, lat: number) => [longitudeDelta(lon, centerLon) * cosLat, Math.max(-85, Math.min(85, lat))];
  const points = valid.map(place => projected(place.longitude!, place.latitude!));
  let minX = points.length ? Math.min(...points.map(p => p[0])) : -30, maxX = points.length ? Math.max(...points.map(p => p[0])) : 30;
  let minY = points.length ? Math.min(...points.map(p => p[1])) : -20, maxY = points.length ? Math.max(...points.map(p => p[1])) : 20;
  const padding = 44;
  if (maxX - minX < 4) { minX -= 2; maxX += 2; } if (maxY - minY < 3) { minY -= 1.5; maxY += 1.5; }
  const aspect = (width - padding * 2) / (height - padding * 2);
  const dataAspect = (maxX - minX) / (maxY - minY);
  if (dataAspect < aspect) { const target = (maxY - minY) * aspect; const extra = (target - (maxX - minX)) / 2; minX -= extra; maxX += extra; }
  else { const target = (maxX - minX) / aspect; const extra = (target - (maxY - minY)) / 2; minY -= extra; maxY += extra; }
  const project = (lon: number, lat: number) => [padding + (projected(lon, lat)[0] - minX) / (maxX - minX) * (width - padding * 2), height - padding - (projected(lon, lat)[1] - minY) / (maxY - minY) * (height - padding * 2)];
  const selected = new Set<string>();
  valid.forEach(place => { const country = countries.find(item => item.iso === place.countryCode) ?? countries.find(item => pointInCountry(place.longitude!, place.latitude!, item)); if (country) selected.add(country.iso); });
  const outlines = countries.map(country => {
    const chunks: string[] = [];
    country.polygons.forEach(polygon => polygon.forEach(ring => {
      let path = "", previousRelativeLongitude: number | undefined;
      ring.forEach(([longitude, latitude], index) => {
        const relativeLongitude = longitudeDelta(longitude, centerLon);
        if (previousRelativeLongitude !== undefined && Math.abs(relativeLongitude - previousRelativeLongitude) > 180 && path) { chunks.push(path + "Z"); path = ""; }
        const [x, y] = project(longitude, latitude);
        path += `${path ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        previousRelativeLongitude = relativeLongitude;
      });
      if (path) chunks.push(path + "Z");
    }));
    return { key: country.iso, d: chunks.join(""), selected: selected.has(country.iso) };
  }).filter(country => country.d);
  const markers = valid.map((place, index) => {
    const [x, y] = project(place.longitude!, place.latitude!);
    const anchor = x > width * 0.72 ? "end" as const : "start" as const;
    return { x, y, labelX: x + (anchor === "start" ? 13 : -13), labelY: y + (index === 0 ? -12 : 20), anchor, number: index + 1, name: place.name, url: place.url, country: countries.find(item => item.iso === place.countryCode)?.name ?? countries.find(item => pointInCountry(place.longitude!, place.latitude!, item))?.name };
  });
  return { width, height, outlines, markers };
}

export function wikiArticleUrl(title: string) { return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.trim().replace(/\s+/gu, "_"))}`; }
export function countryCodeForTitle(title: string) { return countryByAlias.get(normal(title))?.code; }
