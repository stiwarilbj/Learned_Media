export type CardRevealModel = {
  fingerprint: string;
  sentences: string[];
};

export type CardRevealProgress = {
  fingerprint: string;
  visibleCount: number;
  complete: boolean;
};

const progress = new Map<string, CardRevealProgress>();
const listeners = new Map<string, Set<() => void>>();
const MAX_PROGRESS_ENTRIES = 1000;

function cleanSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fingerprint(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length}:${(first >>> 0).toString(36)}:${(second >>> 0).toString(36)}`;
}

function keyFor(workspaceId: string, cardId: string) {
  return `${workspaceId}\u0000${cardId}`;
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/** Use only sentence boundaries validated by the source spotlight model. */
export function buildCardRevealModel(body: string, validatedSentences?: string[]): CardRevealModel {
  const normalizedBody = cleanSpaces(body);
  const candidates = Array.isArray(validatedSentences)
    ? validatedSentences.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
    : [];
  const sentences = candidates.length > 0 && cleanSpaces(candidates.join(" ")) === normalizedBody
    ? candidates
    : [body];
  return { fingerprint: fingerprint(body), sentences };
}

export function getCardRevealProgress(workspaceId: string, cardId: string, model: CardRevealModel) {
  const current = progress.get(keyFor(workspaceId, cardId));
  return current?.fingerprint === model.fingerprint ? current : undefined;
}

export function subscribeCardRevealProgress(workspaceId: string, cardId: string, listener: () => void) {
  const key = keyFor(workspaceId, cardId);
  const subscribers = listeners.get(key) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(key, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(key);
  };
}

export function startCardReveal(workspaceId: string, cardId: string, model: CardRevealModel) {
  setProgress(workspaceId, cardId, { fingerprint: model.fingerprint, visibleCount: 0, complete: false });
}

export function revealNextCardSentence(workspaceId: string, cardId: string, model: CardRevealModel) {
  const current = getCardRevealProgress(workspaceId, cardId, model);
  const visibleCount = Math.min(model.sentences.length, (current?.visibleCount ?? 0) + 1);
  setProgress(workspaceId, cardId, { fingerprint: model.fingerprint, visibleCount, complete: visibleCount >= model.sentences.length });
}

export function revealCardThroughSentence(workspaceId: string, cardId: string, model: CardRevealModel, sentenceIndex: number) {
  const visibleCount = Math.max(getCardRevealProgress(workspaceId, cardId, model)?.visibleCount ?? 0, Math.min(model.sentences.length, sentenceIndex + 1));
  setProgress(workspaceId, cardId, { fingerprint: model.fingerprint, visibleCount, complete: visibleCount >= model.sentences.length });
}

export function showAllCardSentences(workspaceId: string, cardId: string, model: CardRevealModel) {
  setProgress(workspaceId, cardId, { fingerprint: model.fingerprint, visibleCount: model.sentences.length, complete: true });
}

export function clearCardRevealProgress() {
  const keys = Array.from(progress.keys());
  progress.clear();
  for (const key of keys) notify(key);
}

function setProgress(workspaceId: string, cardId: string, next: CardRevealProgress) {
  const key = keyFor(workspaceId, cardId);
  progress.delete(key);
  progress.set(key, next);
  while (progress.size > MAX_PROGRESS_ENTRIES) {
    const oldest = progress.keys().next().value;
    if (oldest === undefined) break;
    progress.delete(oldest);
    notify(oldest);
  }
  notify(key);
}
