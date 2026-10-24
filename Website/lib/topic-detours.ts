export type TopicDetourPhase = "queued" | "generating" | "reading";

export type TopicDetour = {
  id: string;
  workspaceId: string;
  sourceCardId: string;
  topicPath: string[];
  slotCardIds: Array<string | null>;
  furthestReached: number;
  phase: TopicDetourPhase;
};

export type TopicDetourProgress = "focus" | "visible" | "bottom" | "passed";

export function createTopicDetour(workspaceId: string, sourceCardId: string, topicPath: string[], id = `detour-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): TopicDetour {
  return { id, workspaceId, sourceCardId, topicPath: [...topicPath], slotCardIds: [null, null, null], furthestReached: -1, phase: "queued" };
}

export function missingTopicDetourSlots(detour: TopicDetour) {
  return detour.slotCardIds.flatMap((cardId, index) => cardId ? [] : [index]);
}

export function acceptTopicDetourCard(detour: TopicDetour, slot: number, cardId: string): TopicDetour {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3 || !cardId) return detour;
  if (detour.slotCardIds[slot] || detour.slotCardIds.includes(cardId)) return detour;
  const slotCardIds = [...detour.slotCardIds];
  slotCardIds[slot] = cardId;
  return { ...detour, slotCardIds, phase: slotCardIds.every(Boolean) ? "reading" : "generating" };
}

export function orderTopicDetourCards<T extends { id: string }>(cards: T[], detour: TopicDetour, incoming?: T): T[] {
  const byId = new Map(cards.map(card => [card.id, card]));
  if (incoming) byId.set(incoming.id, incoming);
  const detourIds = new Set(detour.slotCardIds.filter((id): id is string => Boolean(id)));
  const detourCards = detour.slotCardIds.flatMap(id => id && byId.has(id) ? [byId.get(id)!] : []);
  const rest = cards.filter(card => !detourIds.has(card.id) && card.id !== incoming?.id);
  const sourceIndex = rest.findIndex(card => card.id === detour.sourceCardId);
  if (sourceIndex < 0) return [...rest, ...detourCards];
  return [...rest.slice(0, sourceIndex + 1), ...detourCards, ...rest.slice(sourceIndex + 1)];
}

export function markTopicDetourProgress(detour: TopicDetour, cardId: string, progress: TopicDetourProgress) {
  const slot = detour.slotCardIds.indexOf(cardId);
  if (slot < 0) return { detour, completed: false };
  const furthestReached = Math.max(detour.furthestReached, slot);
  const next = furthestReached === detour.furthestReached ? detour : { ...detour, furthestReached };
  return { detour: next, completed: slot === 2 && (progress === "bottom" || progress === "passed") };
}
