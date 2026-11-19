import type { FactCard, WikipediaSource } from "./types";
import { memoizedCardFingerprint } from "./card-content-fingerprint";

export type CardExplanationMode = "simpler" | "deeper";
export type CardExplanation = { text: string; sources: WikipediaSource[]; fingerprint: string };
export type CardExplanationSelection = CardExplanationMode | undefined;

type ExplanationCardIdentity = Pick<FactCard, "title" | "hook" | "body" | "topicPath" | "sources"> & { claim?: string; evidence?: FactCard["evidence"] };

function explanationFingerprint(card: ExplanationCardIdentity, legacy: boolean): string {
  const dependencies = [card.claim ?? "", card.topicPath, card.sources, card.evidence];
  return memoizedCardFingerprint(card, legacy ? "card-explanation-v1" : "card-explanation-v2", dependencies, () => {
    const evidence = card.evidence ?? [];
    // Keep the original web writer's field order while ignoring the order used by the native bridge.
    const sourceText = JSON.stringify([
      card.title,
      card.hook,
      card.body,
      card.claim ?? "",
      card.topicPath,
      card.sources.map(source => [source.canonicalUrl ?? source.url, source.extract ?? ""]),
      legacy ? evidence : evidence.map(({ sentence, sourceIndex, quote, section }) => ({ sentence, sourceIndex, quote, section }))
    ]);
    let first = 2166136261;
    let second = 0x9e3779b9;
    for (let index = 0; index < sourceText.length; index++) {
      const code = sourceText.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ (code + index), 2246822519);
    }
    return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
  });
}

export function cardExplanationFingerprint(card: ExplanationCardIdentity): string {
  return explanationFingerprint(card, false);
}

/** Verify a saved result and return the stable fingerprint to write back. */
export function matchingCardExplanationFingerprint(card: ExplanationCardIdentity, saved: unknown): string | undefined {
  if (typeof saved !== "string" || !/^[a-f0-9]{16}$/.test(saved)) return undefined;
  const fingerprint = cardExplanationFingerprint(card);
  if (saved === fingerprint || (card.evidence?.length && saved === explanationFingerprint(card, true))) return fingerprint;
}

const selections = new Map<string, CardExplanationSelection>();
const listeners = new Map<string, Set<() => void>>();
const MAX_SELECTIONS = 500;

function selectionKey(workspaceId: string, cardId: string) {
  return `${workspaceId}\u0000${cardId}`;
}

export function getCardExplanationSelection(workspaceId: string, cardId: string) {
  return selections.get(selectionKey(workspaceId, cardId));
}

export function subscribeCardExplanationSelection(workspaceId: string, cardId: string, listener: () => void) {
  const key = selectionKey(workspaceId, cardId);
  const subscribers = listeners.get(key) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(key, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(key);
  };
}

export function setCardExplanationSelection(workspaceId: string, cardId: string, mode: CardExplanationSelection) {
  const key = selectionKey(workspaceId, cardId);
  if (mode) {
    selections.delete(key);
    selections.set(key, mode);
    while (selections.size > MAX_SELECTIONS) selections.delete(selections.keys().next().value!);
  } else selections.delete(key);
  for (const listener of listeners.get(key) ?? []) listener();
}

export function normalizeCardExplanations(card: ExplanationCardIdentity & { explanations?: Partial<Record<CardExplanationMode, CardExplanation>> }) {
  const result: Partial<Record<CardExplanationMode, CardExplanation>> = {};
  for (const mode of ["simpler", "deeper"] as const) {
    const explanation = card.explanations?.[mode];
    if (typeof explanation?.text !== "string" || !explanation.text.trim() || !Array.isArray(explanation.sources)) continue;
    const fingerprint = matchingCardExplanationFingerprint(card, explanation.fingerprint);
    if (!fingerprint) continue;
    const sources = explanation.sources.filter(source => typeof source?.title === "string" && source.title.trim() && typeof source?.url === "string" && source.url.trim());
    if (sources.length) result[mode] = { text: explanation.text.trim(), sources, fingerprint };
  }
  return Object.keys(result).length ? result : undefined;
}
