import type { FactCard, SavedCardGlossary, WikipediaSource } from "./types";
import { cardExplanationFingerprint } from "./card-explanations";

type GlossaryCard = Pick<FactCard, "id" | "title" | "hook" | "body" | "topicPath" | "sources"> & {
  claim?: string;
  evidence?: FactCard["evidence"];
};

const glossaryPanels = new Map<string, { fingerprint: string; open: true }>();
const glossaryPanelListeners = new Map<string, Set<() => void>>();
const MAX_GLOSSARY_PANELS = 500;

export function cardGlossaryFingerprint(card: GlossaryCard) {
  return cardExplanationFingerprint(card);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function wordCount(value: string) {
  return (value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function termAppears(term: string, text: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function isOneSentence(value: string) {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter("en", { granularity: "sentence" }).segment(value)).filter(item => item.segment.trim()).length === 1;
  return (value.match(/[.!?](?=(?:["'”’»)]|\s|$))/gu) ?? []).length <= 1;
}

function validSource(source: unknown): source is WikipediaSource {
  return Boolean(source && typeof source === "object"
    && cleanText((source as WikipediaSource).title)
    && cleanText((source as WikipediaSource).url));
}

/** Keep only bounded, source-linked definitions that still describe this card. */
export function normalizeCardGlossary(card: GlossaryCard & { glossary?: SavedCardGlossary | unknown }): SavedCardGlossary | undefined {
  const saved = card.glossary as Partial<SavedCardGlossary> | undefined;
  const fingerprint = cardGlossaryFingerprint(card);
  if (!saved || saved.fingerprint !== fingerprint || !Array.isArray(saved.entries) || !Array.isArray(saved.sources)) return undefined;
  const sourceIndexes = new Map<number, number>();
  const sources: WikipediaSource[] = [];
  saved.sources.forEach((source, index) => {
    if (!validSource(source) || sources.length >= 3) return;
    sourceIndexes.set(index, sources.length);
    sources.push(source);
  });
  const text = `${card.title} ${card.hook ?? ""} ${card.body}`;
  const seenTerms = new Set<string>();
  const entries = saved.entries.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const term = cleanText((raw as { term?: unknown }).term).slice(0, 80);
    const definition = cleanText((raw as { definition?: unknown }).definition);
    const mappedSourceIndexes = Array.isArray((raw as { sourceIndexes?: unknown }).sourceIndexes)
      ? Array.from(new Set((raw as { sourceIndexes: unknown[] }).sourceIndexes.flatMap(index => Number.isInteger(index) && Number(index) >= 0 ? [sourceIndexes.get(Number(index))] : []).filter((index): index is number => index !== undefined))).slice(0, 3)
      : [];
    const key = term.toLocaleLowerCase();
    if (!term || !definition || wordCount(definition) > 35 || !isOneSentence(definition)
      || !termAppears(term, text) || !mappedSourceIndexes.length || seenTerms.has(key)) return [];
    seenTerms.add(key);
    return [{ term, definition, sourceIndexes: mappedSourceIndexes }];
  }).slice(0, 3);
  // An empty result is a successful, reusable glossary. Invalid entries do not survive normalization.
  return { entries, sources, fingerprint };
}

export function getVisibleCardGlossaryEntries(glossary: SavedCardGlossary | undefined, visibleText: string) {
  if (!glossary) return [];
  const text = cleanText(visibleText);
  return glossary.entries.filter(entry => termAppears(entry.term, text));
}

function panelKey(workspaceId: string, cardId: string) {
  return `${workspaceId}\u0000${cardId}`;
}

export function getCardGlossaryPanelOpen(workspaceId: string, cardId: string, fingerprint: string) {
  return glossaryPanels.get(panelKey(workspaceId, cardId))?.fingerprint === fingerprint;
}

export function subscribeCardGlossaryPanel(workspaceId: string, cardId: string, listener: () => void) {
  const key = panelKey(workspaceId, cardId);
  const listeners = glossaryPanelListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  glossaryPanelListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) glossaryPanelListeners.delete(key);
  };
}

export function setCardGlossaryPanelOpen(workspaceId: string, cardId: string, fingerprint: string, open: boolean) {
  const key = panelKey(workspaceId, cardId);
  if (open) {
    glossaryPanels.delete(key);
    glossaryPanels.set(key, { fingerprint, open: true });
    while (glossaryPanels.size > MAX_GLOSSARY_PANELS) glossaryPanels.delete(glossaryPanels.keys().next().value!);
  } else glossaryPanels.delete(key);
  for (const listener of glossaryPanelListeners.get(key) ?? []) listener();
}
