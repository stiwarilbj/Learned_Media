import type { CardChronologyAnchor, CardChronologyEvent, FactCard, SavedCardChronology } from "./types";
import { memoizedCardFingerprint } from "./card-content-fingerprint";

type ChronologyCard = Pick<FactCard, "id" | "title" | "hook" | "body"> & {
  sentences?: string[];
  chronology?: SavedCardChronology | unknown;
};
type ParsedDate = { year: number; month?: number; day?: number; precision: "year" | "month" | "day" };
type DateParseLookup = Map<string, ParsedDate | undefined>;
export type DisplayChronologyEvent = CardChronologyEvent & { description: string; intervalBefore?: string; originalIndex: number };

const monthNumbers: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12
};
const monthPattern = "January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const dateCandidatePattern = new RegExp(`\\b(?:\\d{4}-\\d{2}-\\d{2}|(?:${monthPattern})\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{1,4}(?:\\s+(?:BCE|BC|CE|AD))?|(?:${monthPattern})\\s+\\d{1,4}(?:\\s+(?:BCE|BC|CE|AD))?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthPattern})\\s+\\d{1,4}(?:\\s+(?:BCE|BC|CE|AD))?|(?:(?:BCE|BC|CE|AD)\\s*)?\\d{1,4}(?:\\s*(?:BCE|BC|CE|AD))?)\\b`, "giu");
const eventVerb = /\b(?:was born|born|died|founded|established|began|started|opened|discovered|invented|published|released|launched|completed|occurred|erupted|landed|won|signed|declared|became|built|created|introduced|formed|ended|arrived|crossed|elected|married|graduated|laid|closed|first appeared|first performed|first recorded|independence|was created|was constructed|was discovered|was introduced|was established|was released|was launched|was completed|was signed|was declared)\b/iu;
const metadataDate = /\b(?:last\s+updated|last\s+revised|retrieved|accessed|(?:this\s+)?(?:page|article)\s+(?:was\s+)?(?:published|revised|updated|retrieved|accessed)|(?:wikipedia\s+)?article\s+(?:was\s+)?(?:published|revised|updated|retrieved|accessed)|revision\s+date)\b/iu;
const speculative = /\b(?:may have|might have|possibly|perhaps|probably|allegedly|is believed to have)\b/iu;
const approximateDate = /\b(?:about|around|circa|approximately|roughly|nearly|early|mid|late)\b/iu;
const relativeDuration = /^\s*(?:days?|weeks?|months?|years?|decades?|centuries?)\b/iu;

function clean(value: unknown) { return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : ""; }
function normalized(value: string) { return clean(value).normalize("NFC").toLocaleLowerCase(); }
function includesExact(haystack: string, needle: string) { return normalized(haystack).includes(normalized(needle)); }
function hasSupportedDateOccurrence(source: string, dateText: string) {
  const pattern = new RegExp(escapeRegExp(dateText), "giu");
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0, end = start + match[0].length;
    const before = source.slice(Math.max(0, start - 64), start), after = source.slice(end, Math.min(source.length, end + 32));
    if (/\p{L}|\p{N}/u.test(source[start - 1] ?? "") || /\p{L}|\p{N}/u.test(source[end] ?? "")) continue;
    if (/\b(?:about|around|circa|approximately|roughly|nearly|early|mid|late|before|after|between|from|until|since|prior\s+to|no\s+later\s+than)\s*$/iu.test(before)) continue;
    if (/^\s*(?:[-–—/]\s*\d|to\s+\d|through\s+\d|\/\s*\d)/iu.test(after) || relativeDuration.test(after)) continue;
    const negation = /\b(?:not|never)\b([\s\S]{0,64})$/iu.exec(before)?.[1] ?? "";
    if (negation && !/\buntil\b/iu.test(negation)) continue;
    return true;
  }
  return false;
}
export function cardChronologyFingerprint(card: ChronologyCard) {
  return memoizedCardFingerprint(card, "card-chronology-v1", [card.sentences], () => {
    const identity = JSON.stringify([card.title, card.hook, card.body, card.sentences ?? []]);
    let first = 2166136261, second = 0x9e3779b9;
    for (let i = 0; i < identity.length; i++) { const code = identity.charCodeAt(i); first = Math.imul(first ^ code, 16777619); second = Math.imul(second ^ (code + i), 2246822519); }
    return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
  });
}

function validCalendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}
function civilYear(year: number, era?: string) { return era && /^(?:BCE|BC)$/iu.test(era) ? 1 - year : year; }

/** Supports exact years, month/year, named-month dates, and ISO dates only. */
export function parseChronologyDate(value: string): ParsedDate | undefined {
  const text = clean(value).replace(/,/gu, "").replace(/\s+/gu, " ");
  let match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text);
  if (match) {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    return year !== 0 && validCalendarDate(year, month, day) ? { year, month, day, precision: "day" } : undefined;
  }
  const eraPattern = "(BCE|BC|CE|AD)?";
  match = new RegExp(`^(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(\\d{1,4})\\s*${eraPattern}$`, "iu").exec(text);
  if (match) {
    if (!Number(match[3])) return undefined;
    const month = monthNumbers[match[1].toLocaleLowerCase()], day = Number(match[2]), year = civilYear(Number(match[3]), match[4]);
    return (year !== 0 || /^(?:BCE|BC)$/iu.test(match[4] ?? "")) && validCalendarDate(year, month, day) ? { year, month, day, precision: "day" } : undefined;
  }
  match = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(\\d{1,4})\\s*${eraPattern}$`, "iu").exec(text);
  if (match) {
    if (!Number(match[3])) return undefined;
    const month = monthNumbers[match[2].toLocaleLowerCase()], day = Number(match[1]), year = civilYear(Number(match[3]), match[4]);
    return (year !== 0 || /^(?:BCE|BC)$/iu.test(match[4] ?? "")) && validCalendarDate(year, month, day) ? { year, month, day, precision: "day" } : undefined;
  }
  match = new RegExp(`^(${monthPattern})\\s+(\\d{1,4})\\s*${eraPattern}$`, "iu").exec(text);
  if (match) {
    if (!Number(match[2])) return undefined;
    const month = monthNumbers[match[1].toLocaleLowerCase()], year = civilYear(Number(match[2]), match[3]);
    return year !== 0 || /^(?:BCE|BC)$/iu.test(match[3] ?? "") ? { year, month, precision: "month" } : undefined;
  }
  match = /^(?:(BCE|BC|CE|AD)\s*)?(\d{1,4})(?:\s*(BCE|BC|CE|AD))?$/iu.exec(text);
  if (match) {
    const value = Number(match[2]), era = match[1] || match[3];
    if (!value) return undefined;
    const year = civilYear(value, era);
    return year !== 0 || /^(?:BCE|BC)$/iu.test(era ?? "") ? { year, precision: "year" } : undefined;
  }
  return undefined;
}

function parseDateCached(value: string, lookup: DateParseLookup) {
  if (lookup.has(value)) return lookup.get(value);
  const parsed = parseChronologyDate(value);
  lookup.set(value, parsed);
  return parsed;
}

function cardSentences(card: ChronologyCard) {
  const body = clean(card.body);
  const saved = Array.isArray(card.sentences) ? card.sentences.map(clean).filter(Boolean) : [];
  if (saved.length && normalized(saved.join(" ")) === normalized(body)) return saved;
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("en", { granularity: "sentence" }).segment(body)).map(item => clean(item.segment)).filter(Boolean);
  return body.match(/[^.!?]+(?:[.!?]+[”’"')\]]*)?(?:\s+|$)/gu)?.map(clean).filter(Boolean) ?? (body ? [body] : []);
}

function sourceForAnchor(card: ChronologyCard, anchor: CardChronologyAnchor, sentences: string[]) {
  if (anchor.field === "title") return clean(card.title);
  if (anchor.field === "hook") return clean(card.hook);
  if (anchor.field === "body" && Number.isInteger(anchor.sentenceIndex) && anchor.sentenceIndex! >= 0) return sentences[anchor.sentenceIndex!] ?? "";
  return "";
}
function cleanEventText(eventText: string, dateText: string) {
  return clean(eventText.replace(new RegExp(escapeRegExp(dateText), "iu"), "").replace(/\b(?:on|in|at|by|during)\s+(?=[,.!?;:]|$)/giu, " ").replace(/^\s*(?:on|in|at|by|during)\s+/iu, "").replace(/^[,;:—–-]+|[,;:—–-]+$/gu, "").replace(/\s+([,.!?;:])/gu, "$1").replace(/[.!?]+$/gu, "").replace(/\s{2,}/gu, " ")) || clean(eventText);
}
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }

function normalizeEvent(raw: unknown, card: ChronologyCard, sentences: string[], dateLookup: DateParseLookup): CardChronologyEvent | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const dateText = clean(value.dateText), eventText = clean(value.eventText);
  const anchorRaw = value.anchor;
  if (!anchorRaw || typeof anchorRaw !== "object" || !dateText || !eventText || eventText.length > 240 || eventText.split(/\s+/u).length > 35) return undefined;
  const anchorValue = anchorRaw as Record<string, unknown>;
  const field = anchorValue.field;
  if (field !== "title" && field !== "hook" && field !== "body") return undefined;
  const anchor: CardChronologyAnchor = field === "body"
    ? { field, sentenceIndex: Number.isInteger(anchorValue.sentenceIndex) ? Number(anchorValue.sentenceIndex) : -1 }
    : { field };
  const source = sourceForAnchor(card, anchor, sentences);
  if (!source || !parseDateCached(dateText, dateLookup) || !includesExact(eventText, dateText)
    || metadataDate.test(eventText) || speculative.test(eventText) || approximateDate.test(eventText)
    || !hasSupportedDateOccurrence(source, dateText) || !includesExact(source, eventText)) return undefined;
  const description = cleanEventText(eventText, dateText);
  if (!description || normalized(description) === normalized(dateText)) return undefined;
  return { dateText, eventText, anchor };
}

export function createSavedCardChronology(value: unknown, card: ChronologyCard): SavedCardChronology | undefined {
  if (!value || typeof value !== "object") return undefined;
  const eventsValue = (value as { events?: unknown }).events;
  if (!Array.isArray(eventsValue)) return undefined;
  const dateLookup: DateParseLookup = new Map();
  const sentences = cardSentences(card);
  const events = deduplicate(eventsValue.slice(0, 12).map(item => normalizeEvent(item, card, sentences, dateLookup)).filter((event): event is CardChronologyEvent => Boolean(event)), dateLookup);
  return events.length >= 2 ? { events: events.slice(0, 8), fingerprint: cardChronologyFingerprint(card) } : undefined;
}

function normalizeSavedCardChronologyWithLookup(card: ChronologyCard, dateLookup: DateParseLookup): SavedCardChronology | undefined {
  const stored = card.chronology as Partial<SavedCardChronology> | undefined;
  if (!stored || stored.fingerprint !== cardChronologyFingerprint(card) || !Array.isArray(stored.events)) return undefined;
  const sentences = cardSentences(card);
  const events = deduplicate(stored.events.slice(0, 12).map(item => normalizeEvent(item, card, sentences, dateLookup)).filter((event): event is CardChronologyEvent => Boolean(event)), dateLookup);
  return events.length >= 2 ? { events: events.slice(0, 8), fingerprint: cardChronologyFingerprint(card) } : undefined;
}

export function normalizeSavedCardChronology(card: ChronologyCard): SavedCardChronology | undefined {
  return normalizeSavedCardChronologyWithLookup(card, new Map());
}

function deduplicate(events: CardChronologyEvent[], dateLookup: DateParseLookup) {
  const seen = new Set<string>();
  return events.filter(event => {
    const parsedDate = parseDateCached(event.dateText, dateLookup);
    const dateKey = parsedDate ? `${parsedDate.year}-${parsedDate.month ?? "*"}-${parsedDate.day ?? "*"}` : normalized(event.dateText);
    const description = cleanEventText(event.eventText, event.dateText);
    const key = `${dateKey}\u0000${normalized(description).replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sentenceDateEvents(text: string, anchor: CardChronologyAnchor, dateLookup: DateParseLookup): CardChronologyEvent[] {
  const candidates: Array<{ dateText: string; index: number }> = [];
  dateCandidatePattern.lastIndex = 0;
  for (const match of text.matchAll(dateCandidatePattern)) {
    const dateText = clean(match[0]);
    const start = match.index ?? 0, end = start + match[0].length;
    if ([text[start - 1], text[end]].some(character => character === "/" || character === "-" || character === "–" || character === "—")) continue;
    if (parseDateCached(dateText, dateLookup)) candidates.push({ dateText, index: match.index ?? 0 });
  }
  if (!candidates.length || (candidates.length > 1 && !text.includes(";"))) return [];
  const segments = text.split(/(?<=[;])\s*/u);
  return candidates.flatMap(candidate => {
    const segment = segments.find(item => item.length >= candidate.index && item.length >= candidate.dateText.length && text.indexOf(item) <= candidate.index && text.indexOf(item) + item.length >= candidate.index + candidate.dateText.length) ?? text;
    if (metadataDate.test(segment) || speculative.test(segment) || approximateDate.test(segment) || !hasSupportedDateOccurrence(segment, candidate.dateText) || !eventVerb.test(segment)) return [];
    eventVerb.lastIndex = 0;
    const eventText = clean(segment);
    if (eventText.length > 240) return [];
    return [{ dateText: candidate.dateText, eventText, anchor }];
  });
}

function detectLegacyEvents(card: ChronologyCard, dateLookup: DateParseLookup) {
  const sentences = cardSentences(card);
  const events = [
    ...sentenceDateEvents(clean(card.title), { field: "title" }, dateLookup),
    ...sentenceDateEvents(clean(card.hook), { field: "hook" }, dateLookup),
    ...sentences.flatMap((sentence, sentenceIndex) => sentenceDateEvents(sentence, { field: "body", sentenceIndex }, dateLookup))
  ];
  return deduplicate(events.filter(event => Boolean(parseDateCached(event.dateText, dateLookup))), dateLookup);
}

function compareDate(a: ParsedDate, b: ParsedDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month === undefined || b.month === undefined) return 0;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day === undefined || b.day === undefined) return 0;
  return a.day - b.day;
}
function sameDay(a: ParsedDate, b: ParsedDate) { return a.precision === "day" && b.precision === "day" && a.year === b.year && a.month === b.month && a.day === b.day; }
function plural(value: number, unit: string) { return `${value} ${unit}${value === 1 ? "" : "s"} later`; }
function about(value: number, unit: string) { return `About ${value} ${unit}${value === 1 ? "" : "s"} later`; }
function floorDiv(a: number, b: number) { return Math.floor(a / b); }
function daysBeforeYear(year: number) {
  const previous = year - 1;
  return 365 * previous + floorDiv(previous, 4) - floorDiv(previous, 100) + floorDiv(previous, 400);
}
function dayNumber(value: ParsedDate) {
  const leap = value.year % 4 === 0 && (value.year % 100 !== 0 || value.year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysBeforeYear(value.year) + lengths.slice(0, (value.month ?? 1) - 1).reduce((sum, length) => sum + length, 0) + (value.day ?? 1);
}
function intervalBetween(previous: ParsedDate, next: ParsedDate) {
  if (previous.year === next.year) return sameDay(previous, next) ? "Same day" : "Same year";
  if (previous.precision === "year" && next.precision === "year") return plural(Math.abs(next.year - previous.year), "year");
  if (previous.precision === "year" || next.precision === "year") {
    const years = Math.abs(next.year - previous.year);
    return years > 0 ? about(years, "year") : undefined;
  }
  if (previous.precision === "day" && next.precision === "day") {
    const days = dayNumber(next) - dayNumber(previous);
    if (days <= 0) return undefined;
    const exactYears = next.year - previous.year;
    if (previous.month === next.month && previous.day === next.day && exactYears > 0) return plural(exactYears, "year");
    const roundedYears = Math.round(days / 365.2425);
    if (roundedYears >= 1) return about(roundedYears, "year");
    const roundedMonths = Math.round(days / 30.436875);
    return roundedMonths >= 1 ? about(roundedMonths, "month") : "Less than a month later";
  }
  if (previous.month !== undefined && next.month !== undefined) {
    const months = Math.abs((next.year - previous.year) * 12 + next.month - previous.month);
    const roundedYears = Math.round(months / 12);
    if (roundedYears >= 1) return about(roundedYears, "year");
    return months > 0 ? about(months, "month") : undefined;
  }
  return undefined;
}

export function getCardChronologyEvents(card: ChronologyCard, visibleBodySentenceCount = Number.POSITIVE_INFINITY, bodyFullyVisible = visibleBodySentenceCount === Number.POSITIVE_INFINITY): DisplayChronologyEvent[] {
  const dateLookup: DateParseLookup = new Map();
  const saved = normalizeSavedCardChronologyWithLookup(card, dateLookup);
  const events = saved?.events ?? detectLegacyEvents(card, dateLookup);
  const visible = events.filter(event => event.anchor.field !== "body" || bodyFullyVisible || (event.anchor.sentenceIndex ?? -1) < visibleBodySentenceCount);
  const sorted = visible.map((event, originalIndex) => ({ event, originalIndex, date: parseDateCached(event.dateText, dateLookup) }))
    .filter((item): item is typeof item & { date: ParsedDate } => Boolean(item.date))
    .sort((a, b) => compareDate(a.date, b.date) || a.originalIndex - b.originalIndex);
  return sorted.map((item, index) => ({
    ...item.event,
    description: cleanEventText(item.event.eventText, item.event.dateText),
    originalIndex: item.originalIndex,
    ...(index > 0 ? { intervalBefore: intervalBetween(sorted[index - 1].date, item.date) } : {})
  }));
}

const panels = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const MAX_PANELS = 500;
function panelKey(workspaceId: string, cardId: string) { return `${workspaceId}\u0000${cardId}`; }
export function getCardChronologyPanelOpen(workspaceId: string, cardId: string, contentFingerprint: string) { return panels.get(panelKey(workspaceId, cardId)) === contentFingerprint; }
export function subscribeCardChronologyPanel(workspaceId: string, cardId: string, listener: () => void) {
  const key = panelKey(workspaceId, cardId), subscribers = listeners.get(key) ?? new Set<() => void>();
  subscribers.add(listener); listeners.set(key, subscribers);
  return () => { subscribers.delete(listener); if (!subscribers.size) listeners.delete(key); };
}
export function setCardChronologyPanelOpen(workspaceId: string, cardId: string, contentFingerprint: string, open: boolean) {
  const key = panelKey(workspaceId, cardId);
  if (open) { panels.delete(key); panels.set(key, contentFingerprint); while (panels.size > MAX_PANELS) panels.delete(panels.keys().next().value!); }
  else panels.delete(key);
  for (const listener of listeners.get(key) ?? []) listener();
}
