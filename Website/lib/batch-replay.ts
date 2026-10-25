import type { BatchSetup, BatchSetupSlot, FactCard } from "./types";
import type { FactNoveltySignature } from "./fact-novelty";

export const BATCH_SETUP_VERSION = 1;
const FACT_ANGLES = new Set(["varied", "unexpected-mechanism", "unusual-decision", "failed-experiment", "overlooked-detail"]);
const SENTENCE_LENGTHS = new Set([1, 2, 3, 4, 6, 8, 10]);

function validNoveltySignature(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.kind === "fact-novelty" && item.version === 1
    && typeof item.id === "string" && item.id.length <= 200 && typeof item.title === "string" && item.title.length <= 180 && typeof item.claim === "string" && item.claim.length <= 260
    && typeof item.hasClaim === "boolean" && typeof item.fingerprint === "string" && item.fingerprint.length > 0 && item.fingerprint.length <= 80
    && typeof item.claimFingerprint === "string" && item.claimFingerprint.length > 0 && item.claimFingerprint.length <= 80
    && typeof item.bodyFingerprint === "string" && item.bodyFingerprint.length > 0 && item.bodyFingerprint.length <= 80
    && (item.bodyTerms == null || (typeof item.bodyTerms === "string" && item.bodyTerms.length <= 500))
    && Array.isArray(item.detailMarkers) && item.detailMarkers.length <= 16 && item.detailMarkers.every((part) => typeof part === "string" && part.length <= 80)
    && Array.isArray(item.topicPath) && item.topicPath.length <= 5 && item.topicPath.every((part) => typeof part === "string" && part.length <= 120)
    && Array.isArray(item.evidenceKeys) && item.evidenceKeys.length <= 6 && item.evidenceKeys.every((part) => typeof part === "string" && part.length <= 100)
    && typeof item.negated === "boolean";
}

export function isBatchSetup(value: unknown): value is BatchSetup {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const setup = value as Record<string, unknown>;
  const settings = setup.settings as Record<string, unknown> | null;
  if (setup.version !== BATCH_SETUP_VERSION || typeof setup.createdAt !== "string" || !Number.isFinite(Date.parse(setup.createdAt))
    || !Array.isArray(setup.slots) || setup.slots.length < 1 || setup.slots.length > 10
    || !settings || !Number.isInteger(settings.obscurity) || Number(settings.obscurity) < 1 || Number(settings.obscurity) > 10
    || (settings.displayMode !== "text" && settings.displayMode !== "picture-text")
    || !SENTENCE_LENGTHS.has(Number(settings.sentenceLength)) || typeof settings.surpriseMe !== "boolean"
    || typeof setup.factAngle !== "string" || !FACT_ANGLES.has(setup.factAngle)
    || (setup.rabbitHole !== null && (typeof setup.rabbitHole !== "string" || setup.rabbitHole.length > 4000))
    || (setup.novelty != null && (!Array.isArray(setup.novelty) || setup.novelty.length > 10 || !setup.novelty.every(validNoveltySignature)))) return false;
  const ids = new Set<string>();
  return setup.slots.every((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const slot = raw as Record<string, unknown>;
    if (typeof slot.id !== "string" || !slot.id.trim() || slot.id.length > 200 || ids.has(slot.id) || !Array.isArray(slot.topicPath)
      || slot.topicPath.length < 1 || slot.topicPath.length > 12
      || !slot.topicPath.every((part) => typeof part === "string" && part.trim().length > 0 && part.length <= 120)
      || !Number.isInteger(slot.difficulty) || Number(slot.difficulty) < 1 || Number(slot.difficulty) > 10) return false;
    ids.add(slot.id);
    return true;
  });
}

export function createBatchSetup(input: {
  id: string;
  slots: Array<Omit<BatchSetupSlot, "id">>;
  settings: BatchSetup["settings"];
  factAngle: BatchSetup["factAngle"];
  rabbitHole: string | null;
}): BatchSetup {
  const setup: BatchSetup = {
    version: BATCH_SETUP_VERSION,
    createdAt: new Date().toISOString(),
    slots: input.slots.map((slot, index) => ({ id: `${input.id}:${index}`, topicPath: [...slot.topicPath], difficulty: slot.difficulty })),
    settings: { ...input.settings },
    factAngle: input.factAngle,
    rabbitHole: input.rabbitHole,
    novelty: []
  };
  if (!isBatchSetup(setup)) throw new TypeError("The batch setup contains invalid generation settings or topic assignments.");
  return setup;
}

/** Make a new transient generation from a saved setup without mutating the saved snapshot. */
export function cloneBatchSetupForRepeat(setup: BatchSetup, id: string, createdAt = new Date().toISOString()): BatchSetup {
  if (!isBatchSetup(setup) || !id.trim()) throw new TypeError("A valid completed batch setup is required.");
  return {
    ...setup,
    createdAt,
    slots: setup.slots.map((slot, index) => ({
      id: `${id}:${index}`,
      topicPath: [...slot.topicPath],
      difficulty: slot.difficulty
    })),
    settings: { ...setup.settings },
    novelty: (setup.novelty ?? []).map(signature => ({
      ...signature,
      detailMarkers: [...signature.detailMarkers],
      topicPath: [...signature.topicPath],
      evidenceKeys: [...signature.evidenceKeys]
    }))
  };
}

/** Assignments must describe every requested slot exactly once before provider work begins. */
export function validBatchSlotAssignments(setup: BatchSetup, assignments: Array<{ slotId?: string; path: string[]; difficulty?: number }>): boolean {
  if (!assignments.length || assignments.length > setup.slots.length) return false;
  const byId = new Map(setup.slots.map(slot => [slot.id, slot] as const));
  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (!assignment.slotId || seen.has(assignment.slotId) || !Array.isArray(assignment.path)) return false;
    const slot = byId.get(assignment.slotId);
    if (!slot || assignment.difficulty !== slot.difficulty || assignment.path.length !== slot.topicPath.length
      || assignment.path.some((part, index) => part !== slot.topicPath[index])) return false;
    seen.add(assignment.slotId);
  }
  return seen.size === assignments.length;
}

/** Validate provider-facing assignments while keeping legacy callers without slot IDs compatible. */
export function validStableBatchAssignments(assignments: Array<{ slotId?: unknown; path?: unknown; difficulty?: unknown }>, requestedCount: number): boolean {
  const hasStableIds = assignments.some(assignment => assignment.slotId !== undefined);
  if (!hasStableIds) return true;
  if (assignments.length !== requestedCount || requestedCount < 1 || requestedCount > 10) return false;
  const ids = new Set<string>();
  return assignments.every(assignment => {
    if (typeof assignment.slotId !== "string" || !assignment.slotId.trim() || assignment.slotId.length > 200 || ids.has(assignment.slotId)
      || !Array.isArray(assignment.path) || assignment.path.length < 1 || assignment.path.length > 12
      || !assignment.path.every(part => typeof part === "string" && part.trim().length > 0 && part.length <= 120)
      || (assignment.difficulty !== undefined && (!Number.isInteger(assignment.difficulty) || Number(assignment.difficulty) < 1 || Number(assignment.difficulty) > 10))) return false;
    ids.add(assignment.slotId);
    return true;
  });
}

export function missingBatchSetupSlots(setup: BatchSetup, acceptedSlotIds: Iterable<string>) {
  const accepted = new Set(acceptedSlotIds);
  return setup.slots.filter((slot) => !accepted.has(slot.id));
}

export function batchSetupComplete(setup: BatchSetup, acceptedSlotIds: Iterable<string>) {
  return missingBatchSetupSlots(setup, acceptedSlotIds).length === 0;
}

export function summarizeBatchSetup(setup: BatchSetup) {
  const topics = new Map<string, { path: string; difficulty: number; count: number }>();
  for (const slot of setup.slots) {
    const label = slot.topicPath.join(" → ");
    const key = `${label}\u0000${slot.difficulty}`;
    const current = topics.get(key);
    topics.set(key, { path: label, difficulty: slot.difficulty, count: (current?.count ?? 0) + 1 });
  }
  const difficulties = [...new Set(setup.slots.map((slot) => slot.difficulty))].sort((a, b) => a - b);
  return {
    count: setup.slots.length,
    topics: [...topics.values()],
    difficulty: difficulties.map(level => `Level ${level}`).join(", "),
    sentenceLength: setup.settings.sentenceLength,
    displayMode: setup.settings.displayMode,
    surpriseMe: setup.settings.surpriseMe,
    factAngle: setup.factAngle,
    rabbitHole: setup.rabbitHole
  };
}

export function cardsForBatchSetup(setup: BatchSetup, acceptedBySlot: Map<string, FactCard>, cards: FactCard[]) {
  return setup.slots.flatMap((slot) => {
    const card = acceptedBySlot.get(slot.id);
    return card && cards.some((item) => item.id === card.id) ? [card] : [];
  });
}

export function completeBatchSetup(setup: BatchSetup, acceptedBySlot: Map<string, FactCard>, cards: FactCard[], signatures: FactNoveltySignature[]): BatchSetup | null {
  if (!batchSetupComplete(setup, acceptedBySlot.keys())) return null;
  const acceptedIds = new Set(cardsForBatchSetup(setup, acceptedBySlot, cards).map((card) => card.id));
  if (acceptedIds.size !== setup.slots.length) return null;
  return { ...setup, novelty: signatures.filter((signature) => acceptedIds.has(signature.id)).slice(0, 10) };
}
