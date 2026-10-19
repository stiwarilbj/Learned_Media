import { unsupportedCausality } from "./causal-validation";
import { unsupportedQuantities } from "./quantity-validation";
import promptInstructions from "./prompt-instructions.json";
import { SessionCache } from "./session-cache";
import type { FactCard, WikipediaSource } from "./types";

import type { SentenceLength } from "./types";

export const SENTENCE_LENGTH_OPTIONS = [1, 2, 3, 4, 6, 8, 10] as const;

export function normalizeSentenceLength(value: unknown): SentenceLength {
  const number = typeof value === "number" ? value : Number(value);
  return SENTENCE_LENGTH_OPTIONS.includes(number as (typeof SENTENCE_LENGTH_OPTIONS)[number]) ? number as SentenceLength : 3;
}

/** Count the sentence endings that a reader will see in a rendered card. */
export function countSentences(text: string) {
  return (text.trim().match(/[.!?](?=(?:["'”’»)]|\s|$))/g) ?? []).length;
}

export function hasExactSentenceCount(text: string, expected: SentenceLength | number) {
  return countSentences(text) === normalizeSentenceLength(expected);
}

// Bump when sentence, section, tokenization or passage-eligibility rules change.
const PASSAGE_VALIDATION_POLICY_VERSION = "wikipedia-passages-v1";
const sentenceCache = new SessionCache<readonly string[]>(128, 60 * 60 * 1000, 2 * 1024 * 1024);
function completeSentences(text: string): readonly string[] {
  const key = `${PASSAGE_VALIDATION_POLICY_VERSION}\u0000${text}`;
  const cached = sentenceCache.get(key);
  if (cached) return cached;
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  const pieces = Segmenter
    ? Array.from(new Segmenter("en", { granularity: "sentence" }).segment(text), item => item.segment.trim()).filter(Boolean)
    : (text.match(/[^.!?]+[.!?]+[”’\"')\]]*(?=\s|$)|[^.!?]+$/g) ?? []).map(item => item.trim()).filter(Boolean);
  if (text.length <= 20_000) sentenceCache.set(key, pieces);
  return pieces;
}

export function completeSentenceChunks(text: string, maxCharacters = 1200) {
  const pieces = completeSentences(text);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of pieces) {
    const next = current ? current + " " + sentence : sentence;
    if (current && next.length > maxCharacters) {
      chunks.push(current);
      current = sentence;
    } else current = next;
  }
  if (current) {
    if (current.length < 90 && chunks.length) chunks[chunks.length - 1] += " " + current;
    else chunks.push(current);
  }
  return chunks;
}

export function factWritingRules(sentenceCount: SentenceLength | number = 3, citationFormat: "quotation" | "evidenceIds" = "quotation") {
  const count = normalizeSentenceLength(sentenceCount);
  const structure = {
    1: "Use one complete sentence that states the concrete fact and its essential named detail.",
    2: "Sentence one states the concrete fact; sentence two gives a directly supported detail or consequence.",
    3: "Sentence one states the concrete fact; sentence two gives a supported detail about how it happened; sentence three gives its supported consequence or significance.",
    4: "Use the first three sentences for the fact, a named supporting detail, and its consequence; sentence four adds one more directly supported piece of context.",
    6: "Use the first three sentences for the fact, named support, and consequence; use sentences four through six for additional named context that stays on the same claim.",
    8: "Build a coherent, well-developed explanation around one claim: establish the fact, add named evidence and consequences, then use sentences four through eight only for closely related context.",
    10: "Build a complete explanation of one narrow claim: state the fact, identify the named evidence and mechanism, explain documented consequences, and use the remaining sentences only for closely related context."
  }[count];
  const citationRule = citationFormat === "evidenceIds"
    ? "Use supplied evidence IDs for sentence support; quotations and section names are restored locally."
    : "For every sentence, provide a verbatim quotation and its exact section name; every quotation must occur in the supplied Wikipedia passage.";
  const supportRule = citationFormat === "evidenceIds" ? "Keep evidence within the same narrow passage whenever possible."
    : "Keep all quotations within the same narrow passage whenever possible.";
  const resultRule = citationFormat === "evidenceIds" ? "" : " Return an empty facts array when the evidence cannot support the requested fact. Never silently substitute a different fact.";
  return [...promptInstructions.cardWriting, structure,
    `Write exactly ${count} complete, useful sentences—no more and no fewer. Each sentence must contain at least 8 words and 35–600 characters, express one complete thought, and include supported detail.`,
    citationRule, supportRule, resultRule.trim()].filter(Boolean).join(" ");
}

export const FACT_WRITING_RULES = factWritingRules(3);

export function difficultyRubric(level: number) {
  const target = Math.max(1, Math.min(10, Math.round(level)));
  const key = target >= 10 ? "difficultyMaximum" : target >= 9 ? "difficultyHigh" : target >= 5 ? "difficultyMedium" : "difficultyLow";
  return `Difficulty ${target}/10: ${promptInstructions[key].join(" ")}`;
}

export type FactMemory = Pick<FactCard, "id" | "title" | "hook" | "body" | "topicPath"> & {
  claim?: string;
  fingerprint: string;
  claimFingerprint?: string;
  sourceUrls: string[];
  evidence?: string[];
  evidenceKeys?: string[];
  evidenceSections?: string[];
  known?: boolean;
};

/** Compact, one-way exclusion data safe to send to the local generation endpoint. */
export type FactAvoidKey = {
  fingerprint: string;
  claimFingerprint?: string;
  evidenceKeys?: string[];
};

export function factFingerprint(fact: Pick<FactMemory, "title" | "body"> & { claim?: string }) {
  return normalizedText(`${fact.claim ?? fact.title} ${fact.body}`);
}

export function claimFingerprint(fact: Pick<FactMemory, "title"> & { claim?: string }) {
  return normalizedText(fact.claim ?? fact.title);
}

export function hashFactKey(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function factAvoidKeys(memories: FactMemory[]): FactAvoidKey[] {
  return memories.map(memory => ({
    fingerprint: hashFactKey(memory.fingerprint || factFingerprint(memory)),
    claimFingerprint: hashFactKey(memory.claimFingerprint || claimFingerprint(memory)),
    evidenceKeys: (memory.evidenceKeys ?? []).map(hashFactKey)
  }));
}

export function rememberFact(card: FactCard): FactMemory {
  const sourceUrls = card.sources.map(source => source.canonicalUrl ?? source.url.split("#", 1)[0]);
  const evidence = card.evidence?.map(item => item.quote) ?? [];
  const evidenceKeys = card.evidence?.map(item => `${sourceUrls[item.sourceIndex] ?? ""}|${normalizedText(item.section ?? "")}|${normalizedText(item.quote)}`).filter(Boolean) ?? [];
  const evidenceSections = card.evidence?.map(item => item.section?.trim()).filter((section): section is string => Boolean(section)) ?? [];
  return { id: card.id, title: card.title, hook: card.hook, body: card.body, topicPath: card.topicPath, claim: card.claim, fingerprint: factFingerprint(card), claimFingerprint: claimFingerprint(card), sourceUrls, evidence, evidenceKeys, evidenceSections, known: card.known || card.feedback === "heard" };
}

export function normalizedText(text: string) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const stop = new Set("a an the of in on at to for from by with and or but is was were are be been this that it its as his her their had has have who which they he she into through about also one two three".split(" "));
function normalizedTokens(text: string) { return new Set(text.split(" ").filter(word => word.length > 2 && !stop.has(word))); }
function tokens(text: string) { return normalizedTokens(normalizedText(text)); }
function overlap(a: Set<string>, b: Set<string>) { return [...a].filter(token => b.has(token)).length / Math.max(1, Math.min(a.size, b.size)); }
type PreparedFactMemory = {
  title: string; body: string; claim: string;
  quotes: Set<string>; sections: Set<string>; titleTokens: Set<string>; bodyTokens: Set<string>;
};
const preparedFactMemories = new WeakMap<FactMemory, {
  title: string; body: string; claim?: string; evidence: string[]; evidenceSections: string[];
  prepared: PreparedFactMemory;
}>();
function prepareFactMemory(memory: FactMemory): PreparedFactMemory {
  const cached = preparedFactMemories.get(memory);
  const evidence = memory.evidence ?? [];
  const evidenceSections = memory.evidenceSections ?? [];
  if (cached && cached.title === memory.title && cached.body === memory.body && cached.claim === memory.claim &&
      cached.evidence.length === evidence.length && cached.evidence.every((quote, index) => quote === evidence[index]) &&
      cached.evidenceSections.length === evidenceSections.length && cached.evidenceSections.every((section, index) => section === evidenceSections[index])) return cached.prepared;
  const title = normalizedText(memory.title);
  const body = normalizedText(memory.body);
  const prepared = {
    title, body, claim: normalizedText(memory.claim ?? ""),
    quotes: new Set(evidence.map(normalizedText)), sections: new Set(evidenceSections.map(normalizedText)),
    titleTokens: normalizedTokens(title), bodyTokens: normalizedTokens(body)
  };
  // Copy source arrays so in-place edits also invalidate the cached preparation.
  preparedFactMemories.set(memory, { title: memory.title, body: memory.body, claim: memory.claim, evidence: [...evidence], evidenceSections: [...evidenceSections], prepared });
  return prepared;
}
export function nearestMemories(fact: Pick<FactMemory, "title" | "body" | "topicPath">, memories: FactMemory[], limit = 40) {
  const words = tokens(fact.title + " " + fact.body);
  return memories.map(memory => ({ memory, score: overlap(words, tokens(memory.title + " " + memory.body)) + (memory.topicPath.at(-1) === fact.topicPath.at(-1) ? .2 : 0) }))
    .filter(item => item.score > .12).sort((a, b) => b.score - a.score).slice(0, limit).map(item => item.memory);
}
export function isRepeatedFact(fact: FactMemory, memory: FactMemory) {
  if (fact.id === memory.id) return true;
  const preparedFact = prepareFactMemory(fact), preparedMemory = prepareFactMemory(memory);
  if (preparedFact.title === preparedMemory.title || preparedFact.body === preparedMemory.body) return true;
  if (fact.fingerprint && memory.fingerprint && fact.fingerprint === memory.fingerprint) return true;
  if (fact.claimFingerprint && memory.claimFingerprint && fact.claimFingerprint === memory.claimFingerprint) return true;
  if (fact.claim && memory.claim && preparedFact.claim === preparedMemory.claim) return true;
  if (fact.evidenceKeys?.some(key => memory.evidenceKeys?.includes(key))) return true;
  if ([...preparedFact.quotes].some(quote => preparedMemory.quotes.has(quote))) return true;
  const sharedSection = [...preparedFact.sections].some(section => preparedMemory.sections.has(section));
  return overlap(preparedFact.bodyTokens, preparedMemory.bodyTokens) >= (sharedSection ? .62 : .78) && (overlap(preparedFact.titleTokens, preparedMemory.titleTokens) >= .5 || fact.sourceUrls.some(url => memory.sourceUrls.includes(url)));
}
export function mergeFactMemory(current: FactMemory[], incoming: FactMemory[]) {
  const map = new Map<string, FactMemory>();
  for (const item of [...current, ...incoming]) {
    const fingerprint = item.fingerprint || factFingerprint(item);
    const normalized = { ...item, fingerprint, claimFingerprint: item.claimFingerprint || claimFingerprint(item), sourceUrls: item.sourceUrls || [], evidenceKeys: item.evidenceKeys || [], evidenceSections: item.evidenceSections || [] };
    const existing = [...map.entries()].find(([, old]) => isRepeatedFact(normalized, old));
    const key = existing?.[0] ?? fingerprint ?? item.id;
    const previous = existing?.[1] ?? map.get(key);
    map.set(key, { ...previous, ...normalized, known: Boolean(item.known || previous?.known) });
  }
  return [...map.values()];
}

type PreparedParagraph = { section: string; skipped: boolean; chunks: Array<{ text: string; terms: Set<string>; eligible: boolean }> };
const passageCache = new SessionCache<readonly PreparedParagraph[]>(24, 60 * 60 * 1000, 4 * 1024 * 1024);
function preparedPassages(extract: string): readonly PreparedParagraph[] {
  // Exact content is part of the key: titles/redirects cannot reuse stale passages.
  const key = `${PASSAGE_VALIDATION_POLICY_VERSION}\u0000${extract}`;
  const cached = passageCache.get(key);
  if (cached) return cached;
  let section = "Introduction";
  const paragraphs: PreparedParagraph[] = [];
  for (const paragraph of extract.split(/\n+/)) {
    const heading = paragraph.match(/^=+\s*(.*?)\s*=+$/);
    if (heading) { section = heading[1]; continue; }
    const skipped = /^(References|Notes|External links|Further reading|Bibliography|See also)$/i.test(section) || paragraph.trim().length < 90;
    paragraphs.push({ section, skipped, chunks: skipped ? [] : completeSentenceChunks(paragraph, 1200).map(text => ({
      text, terms: tokens(text), eligible: text.length >= 90 && /[.!?][”’"\')\]]*$/.test(text)
    })) });
  }
  if (extract.length <= 200_000) passageCache.set(key, paragraphs);
  return paragraphs;
}

/** Rank complete passages locally; never cache question-specific scores or choices. */
export function selectEvidence(extract: string, focus: string, difficulty: number) {
  const words = tokens(focus);
  const passages: Array<{ text: string; section: string; score: number; position: number }> = [];
  let position = 0;
  for (const paragraph of preparedPassages(extract)) {
    const { section } = paragraph;
    if (paragraph.skipped || (difficulty >= 5 && section === "Introduction")) { position++; continue; }
    for (const { text, terms, eligible } of paragraph.chunks) {
      const index = position++;
      if (!eligible) continue;
      const coverage = overlap(words, terms);
      if (!coverage || passages.some(item => item.section === section && item.text === text)) continue;
      passages.push({ text, section, score: coverage * 5, position: index });
    }
  }
  const ranked = [...passages].sort((a, b) => b.score - a.score || a.position - b.position);
  const best = ranked[0];
  if (!best) return "";
  const neighbor = ranked.find(item => item.section === best.section && Math.abs(item.position - best.position) === 1 && item.score >= best.score * 0.5);
  return [best, ...(neighbor ? [neighbor] : [])].sort((a,b) => a.position - b.position)
    .map(item => `[Section: ${item.section}]\n${item.text}`).join("\n\n");
}

/** Conservative identity: formatting variants share an ID; source, section and meaning stay distinct. */
export function evidencePassageKey(sourceUrl: string, section: string, quote: string) {
  const normalize = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
  return `${sourceUrl.trim()}\u0000${normalize(section)}\u0000${normalize(quote)}`;
}

/** Same UTF-8 hash on web and native; IDs depend on passage identity, not batch position. */
export function stableEvidenceId(key: string) {
  let hash = BigInt("0xcbf29ce484222325");
  for (const byte of new TextEncoder().encode(key)) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * BigInt("0x100000001b3"));
  return "e" + hash.toString(16).padStart(16, "0");
}

export type GroundedDraft = { title: string; hook: string; claim: string; sentences: string[]; claimEvidence?: string[]; evidence: Array<{ sentence: number; sourceIndex: number; quote: string; section?: string }> };
/** Resolve every returned ID against this card's allowlist before citation validation. */
export function restoreEvidenceReferences(references: unknown, assigned: ReadonlyMap<string, { sourceIndex: number; quote: string; section?: string }>, sentenceCount: number): GroundedDraft["evidence"] {
  if (!Array.isArray(references) || !references.length || references.length > 12) throw new Error("The card is missing valid evidence references.");
  const restored = references.flatMap(item => {
    if (!item || !Number.isInteger(item.sentence) || item.sentence < 0 || item.sentence >= sentenceCount
        || !Array.isArray(item.evidenceIds) || !item.evidenceIds.length || item.evidenceIds.length > 3) {
      throw new Error("The card returned an invalid evidence reference or sentence index.");
    }
    return item.evidenceIds.map((id: unknown) => {
      const match = typeof id === "string" ? assigned.get(id) : undefined;
      if (!match) throw new Error("The card referenced an unknown evidence ID or an ID assigned to another card.");
      return { sentence: item.sentence, sourceIndex: match.sourceIndex, quote: match.quote, section: match.section };
    });
  });
  if (restored.length > 12) throw new Error("The card returned too many evidence references.");
  return restored;
}

function evidenceSection(extract: string, quote: string, section: string) {
  const marker = `[Section: ${section}]`;
  const start = extract.indexOf(marker);
  if (start < 0) return false;
  const next = extract.indexOf("[Section:", start + marker.length);
  const passage = extract.slice(start, next < 0 ? undefined : next);
  return normalizedText(passage).includes(normalizedText(quote));
}
export function validateDraft(draft: GroundedDraft, sources: WikipediaSource[], expectedSentences: SentenceLength | number = 3, difficulty = 0) {
  const sentenceCount = normalizeSentenceLength(expectedSentences);
  if (!draft || typeof draft.title !== "string" || !draft.title.trim() || typeof draft.hook !== "string" || typeof draft.claim !== "string" || !draft.claim.trim()) throw new Error("The card is missing its central fact or headings.");
  const count = draft.hook.trim().split(/\s+/).length;
  if (count < 4 || count > 12 || /\b(?:and|or|of|the|a|to|with)$/i.test(draft.hook.trim())) throw new Error("The fact hook is incomplete or outside 4–12 words.");
  if (normalizedText(draft.title) === normalizedText(draft.hook)) throw new Error("The black heading must be more specific than the blue hook.");
  if (!Array.isArray(draft.sentences) || draft.sentences.length !== sentenceCount || draft.sentences.some(sentence => typeof sentence !== "string" || sentence.trim().length < 35 || sentence.trim().split(/\s+/).length < 8 || sentence.length > 600 || !/[.!?][”"']?$/.test(sentence.trim()))) throw new Error(`Each fact must contain exactly ${sentenceCount} complete sentence${sentenceCount === 1 ? "" : "s"}.`);
  if (!Array.isArray(draft.evidence) || draft.evidence.length > 12 || draft.evidence.some(item => !item || !Number.isInteger(item.sentence) || item.sentence < 0 || item.sentence >= sentenceCount)) throw new Error("The fact is missing verifiable evidence.");
  const sections = new Set<string>();
  for (let sentence = 0; sentence < sentenceCount; sentence++) {
    const quotes = draft.evidence.filter(item => item.sentence === sentence);
    if (!quotes.length || quotes.some(item => !Number.isInteger(item.sourceIndex) || !sources[item.sourceIndex] || typeof item.quote !== "string" || item.quote.trim().length < 30 || !normalizedText(sources[item.sourceIndex].extract ?? "").includes(normalizedText(item.quote)) || (difficulty > 0 && !item.section?.trim()) || (difficulty > 0 && !evidenceSection(sources[item.sourceIndex].extract ?? "", item.quote, item.section?.trim() ?? "")))) throw new Error("A sentence does not have a matching quotation in its specific Wikipedia passage.");
    const unsupported = unsupportedQuantities(draft.sentences[sentence], quotes.map(item => item.quote));
    if (unsupported.length) throw new Error(`A sentence contains unsupported numbers or units: ${unsupported.join(", ")}.`);
    if (unsupportedCausality(draft.sentences[sentence], quotes.map(item => item.quote)).length) throw new Error("A sentence contains unsupported causal wording; its own evidence must establish the relationship, not co-occurrence.");
    quotes.forEach(item => { if (item.section) sections.add(normalizedText(item.section)); });
  }
  const allQuotes = draft.evidence.map(item => item.quote);
  if (draft.claimEvidence && (!Array.isArray(draft.claimEvidence) || !draft.claimEvidence.length || draft.claimEvidence.some(quote => !allQuotes.includes(quote)))) throw new Error("The card’s main claim evidence is missing from its sentence citations.");
  const unsupported = [...unsupportedQuantities(draft.claim, draft.claimEvidence ?? allQuotes), ...unsupportedQuantities(draft.title, allQuotes), ...unsupportedQuantities(draft.hook, allQuotes)];
  if (unsupported.length) throw new Error(`The card contains unsupported numbers or units: ${unsupported.join(", ")}.`);
  if ([...unsupportedCausality(draft.claim, draft.claimEvidence ?? allQuotes), ...unsupportedCausality(draft.title, allQuotes), ...unsupportedCausality(draft.hook, allQuotes)].length) throw new Error("The card contains unsupported causal wording; evidence must establish the same cause and outcome.");
  if (difficulty >= 5 && [...sections].some(section => section === "introduction" || section === "lead")) throw new Error("This difficulty requires an inner Wikipedia section, not the article lead.");
  if (difficulty > 0 && sections.size !== 1) throw new Error("Every generated fact must stay inside one narrowly bounded Wikipedia section.");
}
