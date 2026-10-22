import type { FactCard, WikipediaSource } from "./types";

export type SpotlightEvidence = {
  index: number;
  sentence: number;
  sourceIndex: number;
  quote: string;
  section?: string;
};

export type SpotlightSourceGroup = {
  sourceIndex: number;
  source: WikipediaSource;
  evidence: SpotlightEvidence[];
};

export type SourceSpotlightModel = {
  mapped: boolean;
  sentences: string[];
  groups: SpotlightSourceGroup[][];
};

export type PassageContext = {
  status: "found" | "missing" | "ambiguous";
  before?: string;
  after?: string;
};

/** Deduplicate canonical article links while keeping saved evidence indexes aligned. */
export function normalizeSpotlightSources<T extends WikipediaSource, E extends { sourceIndex: number }>(sources: T[], evidence: E[], limit = 3) {
  const normalizedSources: T[] = [];
  const indexMap = new Map<number, number>();
  const canonicalIndexes = new Map<string, number>();
  sources.forEach((source, oldIndex) => {
    const canonical = (source.canonicalUrl ?? source.url).split("#", 1)[0];
    if (!source.title || !canonical) return;
    const existing = canonicalIndexes.get(canonical);
    if (existing !== undefined) {
      indexMap.set(oldIndex, existing);
      return;
    }
    if (normalizedSources.length >= limit) return;
    const nextIndex = normalizedSources.length;
    normalizedSources.push(source);
    canonicalIndexes.set(canonical, nextIndex);
    indexMap.set(oldIndex, nextIndex);
  });
  return {
    sources: normalizedSources,
    evidence: evidence.map((item) => ({ ...item, sourceIndex: indexMap.get(item.sourceIndex) ?? -1 }))
  };
}

const meaningfulStopWords = new Set("a an and are as at be been but by for from had has have he her hers him his how i if in into is it its me my of on or our she that the their them they this those through to was we were what when where which who why will with you your".split(" "));

function cleanSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function punctuationSentenceCount(value: string) {
  return (value.trim().match(/[.!?](?=(?:[\"'”’»)]|\s|$))/g) ?? []).length;
}

export function splitSpotlightSentences(text: string) {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  const pieces = Segmenter
    ? Array.from(new Segmenter("en", { granularity: "sentence" }).segment(text), item => item.segment.trim()).filter(Boolean)
    : (text.match(/[^.!?]+[.!?]+[”’\"')\]]*(?=\s|$)|[^.!?]+$/g) ?? []).map(item => item.trim()).filter(Boolean);
  return pieces;
}

function validEvidence(card: Pick<FactCard, "evidence" | "sources">) {
  const evidence = card.evidence ?? [];
  return evidence.every(item => Number.isInteger(item.sentence) && item.sentence >= 0
    && Number.isInteger(item.sourceIndex) && item.sourceIndex >= 0
    && item.sourceIndex < card.sources.length && typeof item.quote === "string" && item.quote.trim().length > 0);
}

export function buildSourceSpotlightModel(card: Pick<FactCard, "body" | "sentences" | "sentenceCount" | "evidence" | "sources">): SourceSpotlightModel {
  const body = cleanSpaces(card.body);
  const provided = Array.isArray(card.sentences) ? card.sentences.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean) : [];
  const evidence = card.evidence ?? [];
  let sentences: string[] = [];
  let mapped = false;

  if (provided.length > 0
    && cleanSpaces(provided.join(" ")) === body
    && (card.sentenceCount === undefined || provided.length === card.sentenceCount)
    && validEvidence(card)) {
    sentences = provided;
    mapped = true;
  } else if (Number.isInteger(card.sentenceCount) && validEvidence(card)) {
    const reconstructed = splitSpotlightSentences(card.body);
    if (reconstructed.length === card.sentenceCount && cleanSpaces(reconstructed.join(" ")) === body) {
      sentences = reconstructed;
      mapped = true;
    }
  }

  const sentenceGroups: Array<Map<number, SpotlightEvidence[]>> = mapped
    ? Array.from({ length: sentences.length }, () => new Map<number, SpotlightEvidence[]>())
    : [new Map<number, SpotlightEvidence[]>()];
  if (mapped) {
    evidence.forEach((item, index) => {
      if (item.sentence < 0 || item.sentence >= sentences.length || !card.sources[item.sourceIndex]) return;
      const list = sentenceGroups[item.sentence].get(item.sourceIndex) ?? [];
      list.push({ ...item, index });
      sentenceGroups[item.sentence].set(item.sourceIndex, list);
    });
    // A malformed evidence index makes the mapping uncertain as a whole.
    if (evidence.some(item => item.sentence < 0 || item.sentence >= sentences.length || !card.sources[item.sourceIndex])) {
      mapped = false;
      sentences = [];
      sentenceGroups.splice(0, sentenceGroups.length, new Map());
    }
  }
  if (!mapped) {
    for (const [index, item] of evidence.entries()) {
      if (!item.quote?.trim() || !card.sources[item.sourceIndex]) continue;
      const list = sentenceGroups[0].get(item.sourceIndex) ?? [];
      list.push({ ...item, sentence: -1, index });
      sentenceGroups[0].set(item.sourceIndex, list);
    }
    sentences = [card.body];
  }

  const groups = sentenceGroups.map((sourceMap, sentenceIndex) => Array.from(sourceMap.entries()).map(([sourceIndex, entries]) => ({
    sourceIndex,
    source: card.sources[sourceIndex],
    evidence: entries.sort((left, right) => left.index - right.index)
  })).sort((left, right) => left.evidence[0].index - right.evidence[0].index).map(group => ({ ...group, evidence: group.evidence.map(item => mapped ? { ...item, sentence: sentenceIndex } : item) })));
  return { mapped, sentences, groups: mapped ? groups : groups.slice(0, 1) };
}

type WordRange = { value: string; start: number; end: number };
function wordsWithRanges(text: string): WordRange[] {
  const words: WordRange[] = [];
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const value = match[0].normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    const start = match.index ?? 0;
    words.push({ value, start, end: start + match[0].length });
  }
  return words;
}

export function longestSharedPhraseRange(quote: string, sentence: string, claim = "") {
  const quoteWords = wordsWithRanges(quote);
  const targets = [sentence, claim].filter(Boolean).map(wordsWithRanges);
  for (const target of targets) {
    let best: { start: number; end: number; length: number; meaningful: number } | undefined;
    for (let left = 0; left < quoteWords.length; left++) {
      for (let right = 0; right < target.length; right++) {
        if (quoteWords[left].value !== target[right].value) continue;
        let count = 0;
        let meaningful = 0;
        while (left + count < quoteWords.length && right + count < target.length
          && quoteWords[left + count].value === target[right + count].value) {
          if (quoteWords[left + count].value.length > 2 && !meaningfulStopWords.has(quoteWords[left + count].value)) meaningful++;
          count++;
        }
        if (meaningful < 2) continue;
        if (!best || count > best.length || count === best.length && meaningful > best.meaningful) {
          best = { start: quoteWords[left].start, end: quoteWords[left + count - 1].end, length: count, meaningful };
        }
      }
    }
    if (best) return { start: best.start, end: best.end };
  }
  return undefined;
}

type SectionText = { name: string; text: string };
function sectionTexts(extract: string): SectionText[] {
  const marked: SectionText[] = [];
  const sectionMarker = /^\[Section:\s*([^\]]+)\]\s*$/gm;
  const markers = Array.from(extract.matchAll(sectionMarker));
  if (markers.length) {
    for (let index = 0; index < markers.length; index++) {
      const current = markers[index];
      const start = (current.index ?? 0) + current[0].length;
      const end = index + 1 < markers.length ? markers[index + 1].index! : extract.length;
      marked.push({ name: current[1].trim(), text: extract.slice(start, end).trim() });
    }
    return marked;
  }
  const headings = Array.from(extract.matchAll(/^={2,6}\s*(.*?)\s*={2,6}\s*$/gm));
  if (!headings.length) return [{ name: "", text: extract }];
  if ((headings[0].index ?? 0) > 0) marked.push({ name: "", text: extract.slice(0, headings[0].index).trim() });
  for (let index = 0; index < headings.length; index++) {
    const current = headings[index];
    const start = (current.index ?? 0) + current[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index! : extract.length;
    marked.push({ name: current[1].trim(), text: extract.slice(start, end).trim() });
  }
  return marked;
}

type SentenceRange = { text: string; start: number; end: number };
function sentenceRanges(text: string): SentenceRange[] {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (value: string) => Iterable<{ segment: string; index: number }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("en", { granularity: "sentence" }).segment(text), item => ({ text: item.segment.trim(), start: item.index, end: item.index + item.segment.length })).filter(item => item.text);
  const ranges: SentenceRange[] = [];
  const pattern = /[^.!?]+[.!?]+[”’"')\]]*(?=\s|$)|[^.!?]+$/g;
  for (const match of text.matchAll(pattern)) ranges.push({ text: match[0].trim(), start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  return ranges;
}

export function locatePassageContext(extract: string | undefined, quote: string, section?: string): PassageContext {
  if (!extract || !quote.trim()) return { status: "missing" };
  const sections = sectionTexts(extract);
  const matchingSections = section?.trim()
    ? sections.filter(item => item.name.toLocaleLowerCase() === section.trim().toLocaleLowerCase())
    : sections;
  if (section?.trim() && matchingSections.length !== 1) return { status: "missing" };
  const candidates = matchingSections.length ? matchingSections : sections;
  const matches: Array<{ text: string; start: number; end: number }> = [];
  for (const candidate of candidates) {
    let from = 0;
    while (from <= candidate.text.length) {
      const index = candidate.text.indexOf(quote, from);
      if (index < 0) break;
      matches.push({ text: candidate.text, start: index, end: index + quote.length });
      from = index + Math.max(1, quote.length);
    }
  }
  if (matches.length === 0) return { status: "missing" };
  if (matches.length !== 1) return { status: "ambiguous" };
  const match = matches[0];
  const sentences = sentenceRanges(match.text);
  const first = sentences.findIndex(item => item.start <= match.start && item.end > match.start);
  const last = sentences.findIndex(item => item.start < match.end && item.end >= match.end);
  if (first < 0 || last < 0) return { status: "missing" };
  return { status: "found", before: first > 0 ? sentences[first - 1].text : undefined, after: last + 1 < sentences.length ? sentences[last + 1].text : undefined };
}

export function sourceSpotlightContextKey(evidenceIndex: number) {
  return `evidence-${evidenceIndex}`;
}

export function canonicalWikipediaUrl(source: WikipediaSource) {
  return (source.canonicalUrl ?? source.url).split("#", 1)[0];
}

export function normalizeForSpotlightComparison(value: string) {
  return cleanSpaces(value).toLocaleLowerCase();
}
