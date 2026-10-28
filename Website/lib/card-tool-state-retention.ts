/**
 * Bounds transient panel state to the active card list and a small recent window.
 * Open panels are protected by each panel controller; this registry only tells
 * controllers which closed-card state is still worth keeping.
 */
export const MAX_RECENT_CARD_TOOL_CARDS = 120;

export type CardToolRetentionSnapshot = {
  workspaceId: string;
  retainedCardIds: ReadonlySet<string>;
};

type CardToolStatePruner = (snapshot: CardToolRetentionSnapshot) => void;

let activeWorkspaceId: string | null = null;
const recentCardIds = new Map<string, true>();
let activeWorkspaceCardIds: Set<string> | null = null;
let lastWindowIds: string[] = [];
const pruners = new Set<CardToolStatePruner>();

function notifyPruners() {
  if (activeWorkspaceId === null) return;
  const snapshot = { workspaceId: activeWorkspaceId, retainedCardIds: new Set(recentCardIds.keys()) };
  for (const prune of pruners) prune(snapshot);
}

/** Reset recency on workspace changes, pruning closed state from the old workspace. */
export function activateCardToolWorkspace(workspaceId: string) {
  if (activeWorkspaceId === workspaceId) return;
  activeWorkspaceId = workspaceId;
  recentCardIds.clear();
  activeWorkspaceCardIds = null;
  lastWindowIds = [];
  notifyPruners();
}

/** Keep membership for the active feed so reset/replacement can discard stale closed state immediately. */
export function setCardToolWorkspaceCards(workspaceId: string, cardIds: readonly string[]) {
  activateCardToolWorkspace(workspaceId);
  const next = new Set<string>();
  for (const id of cardIds) if (typeof id === "string" && id.length > 0) next.add(id);
  const previous = activeWorkspaceCardIds;
  if (previous && previous.size === next.size) {
    let unchanged = true;
    for (const id of previous) if (!next.has(id)) { unchanged = false; break; }
    if (unchanged) return;
  }
  activeWorkspaceCardIds = next;
  for (const id of recentCardIds.keys()) if (!next.has(id)) recentCardIds.delete(id);
  lastWindowIds = lastWindowIds.filter(id => next.has(id));
  notifyPruners();
}

/**
 * Retain the current rendered/overscan cards and the most recently visited cards.
 * The caller supplies only its bounded virtualized window, never its full feed.
 */
export function retainCardToolWindow(workspaceId: string, cardIds: readonly string[]) {
  activateCardToolWorkspace(workspaceId);
  const nextWindow: string[] = [];
  const seen = new Set<string>();
  for (const rawId of cardIds) {
    const id = typeof rawId === "string" ? rawId : "";
    if (!id || seen.has(id) || activeWorkspaceCardIds && !activeWorkspaceCardIds.has(id)) continue;
    seen.add(id);
    nextWindow.push(id);
  }
  const boundedWindow = nextWindow.slice(-MAX_RECENT_CARD_TOOL_CARDS);
  if (boundedWindow.length === lastWindowIds.length && boundedWindow.every((id, index) => id === lastWindowIds[index])) return;
  lastWindowIds = boundedWindow;
  for (const id of boundedWindow) {
    if (recentCardIds.has(id)) recentCardIds.delete(id);
    recentCardIds.set(id, true);
  }
  while (recentCardIds.size > MAX_RECENT_CARD_TOOL_CARDS) recentCardIds.delete(recentCardIds.keys().next().value!);
  notifyPruners();
}

export function isCardToolCardRetained(workspaceId: string, cardId: string) {
  return activeWorkspaceId === workspaceId && recentCardIds.has(cardId) && (activeWorkspaceCardIds === null || activeWorkspaceCardIds.has(cardId));
}

/** Re-run pruning when a panel closes, without changing recency. */
export function pruneCardToolState() { notifyPruners(); }

export function registerCardToolStatePruner(prune: CardToolStatePruner) {
  pruners.add(prune);
  return () => pruners.delete(prune);
}

/** Small read-only view used by focused tests and native bridge pruning. */
export function cardToolRetentionSnapshot(): CardToolRetentionSnapshot | undefined {
  return activeWorkspaceId === null ? undefined : { workspaceId: activeWorkspaceId, retainedCardIds: new Set(recentCardIds.keys()) };
}
