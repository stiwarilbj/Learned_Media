export type SpotlightContextState =
  | { status: "idle"; attempt?: number }
  | { status: "loading" }
  | { status: "ready"; before?: string; after?: string }
  | { status: "unverified" }
  | { status: "error" };

export type SourceSpotlightState = {
  sentenceIndex: number;
  triggerId: string;
  expandedEvidence: string[];
  contexts: Record<string, SpotlightContextState>;
};

const states = new Map<string, SourceSpotlightState>();
const listeners = new Map<string, Set<() => void>>();
const MAX_STORED_SPOTLIGHTS = 500;

function stateKey(workspaceId: string, cardId: string) {
  return `${workspaceId}\u0000${cardId}`;
}

export function getSourceSpotlightState(workspaceId: string, cardId: string) {
  return states.get(stateKey(workspaceId, cardId));
}

export function subscribeSourceSpotlight(workspaceId: string, cardId: string, listener: () => void) {
  const key = stateKey(workspaceId, cardId);
  const subscribers = listeners.get(key) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(key, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(key);
  };
}

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

export function setSourceSpotlightState(workspaceId: string, cardId: string, next: SourceSpotlightState | undefined) {
  const key = stateKey(workspaceId, cardId);
  if (next) {
    states.delete(key);
    states.set(key, next);
    while (states.size > MAX_STORED_SPOTLIGHTS) {
      const oldest = states.keys().next().value!;
      states.delete(oldest);
      notify(oldest);
    }
  } else states.delete(key);
  notify(key);
}

export function updateSourceSpotlightState(workspaceId: string, cardId: string, update: (current: SourceSpotlightState | undefined) => SourceSpotlightState | undefined) {
  setSourceSpotlightState(workspaceId, cardId, update(getSourceSpotlightState(workspaceId, cardId)));
}
