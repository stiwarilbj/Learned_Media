import policy from "./difficulty-policy.json";
import type { Difficulty, FactFeedback, LearningProfile, TopicLearningProfile } from "./types";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "A Little Hard",
  2: "Easy",
  3: "Moderate",
  4: "Challenging",
  5: "Decently Hard",
  6: "Hard",
  7: "Very Hard",
  8: "Extremely Hard",
  9: "Nearly Impossible",
  10: "Impossible"
};

export const MAX_DIFFICULTY = 10;
export const DEFAULT_DIFFICULTY: Difficulty = 5;

export function normalizeDifficulty(value: unknown, fallback: Difficulty = DEFAULT_DIFFICULTY): Difficulty {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(MAX_DIFFICULTY, Math.round(numeric))) as Difficulty;
}

export function migrateLegacyDifficulty(value: unknown): Difficulty {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_DIFFICULTY;
  return normalizeDifficulty(numeric <= 5 ? numeric * 2 : numeric);
}

export function topicKey(topicPath: string[]) {
  return topicPath.map((part) => part.trim().toLowerCase()).filter(Boolean).join("::") || "surprise-topic";
}

export function defaultTopicLearningProfile(targetDifficulty: Difficulty = DEFAULT_DIFFICULTY): TopicLearningProfile {
  return { heard: 0, unknown: 0, unknownStreak: 0, targetDifficulty };
}

export const DIFFICULTY_POLICY_VERSION = policy.version;

export function difficultyRequiresInnerSection(level: number) {
  return level >= policy.innerSectionFrom;
}

export function difficultyRubric(level: number) {
  const target = normalizeDifficulty(level);
  return `Difficulty ${target}/10: ${policy.levels[target - 1]} ${policy.common} ${difficultyRequiresInnerSection(target) ? policy.innerEvidence : policy.easyEvidence}`;
}

function total(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getTopicLearningProfile(profile: LearningProfile, topicPath: string[], fallbackDifficulty: Difficulty = DEFAULT_DIFFICULTY): TopicLearningProfile {
  return normalizeTopicLearningProfile(profile[topicKey(topicPath)], fallbackDifficulty);
}

function normalizeTopicLearningProfile(current: TopicLearningProfile | undefined, fallbackDifficulty: Difficulty): TopicLearningProfile {
  const baseline = normalizeDifficulty(fallbackDifficulty);
  if (!current || typeof current !== "object") return defaultTopicLearningProfile(baseline);
  const targetDifficulty = normalizeDifficulty(Math.max(baseline - policy.maxOffset,
    Math.min(baseline + policy.maxOffset, normalizeDifficulty(current.targetDifficulty, baseline))));
  const recentFeedback: NonNullable<TopicLearningProfile["recentFeedback"]> = [];
  for (const item of Array.isArray(current.recentFeedback) ? current.recentFeedback.slice(-policy.windowSize) : []) {
    if (!item || typeof item.cardId !== "string" || !item.cardId || item.cardId.length > 200
      || (item.feedback !== "heard" && item.feedback !== "unknown") || recentFeedback.some(entry => entry.cardId === item.cardId)) continue;
    recentFeedback.push({ cardId: item.cardId, feedback: item.feedback });
  }
  return { ...current, heard: total(current.heard), unknown: total(current.unknown), unknownStreak: total(current.unknownStreak),
    targetDifficulty, recentFeedback: recentFeedback.slice(-policy.windowSize) };
}

export function normalizeLearningProfile(profile: LearningProfile, difficulty: Difficulty): LearningProfile {
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, normalizeTopicLearningProfile(value, difficulty)]));
}

export function resetTopicLearningProfiles(profile: LearningProfile, difficulty: Difficulty): LearningProfile {
  const targetDifficulty = normalizeDifficulty(difficulty);
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, { ...value,
    targetDifficulty, unknownStreak: 0, recentFeedback: [] }]));
}

/** A distinct card contributes once; edits to consumed feedback affect totals only. */
export function recordTopicFeedback(
  profile: LearningProfile,
  topicPath: string[],
  feedback: FactFeedback,
  fallbackDifficulty: Difficulty,
  cardId: string,
  previousFeedback?: FactFeedback
) {
  const key = topicKey(topicPath);
  const current = getTopicLearningProfile(profile, topicPath, fallbackDifficulty);
  const recentFeedback = [...(current.recentFeedback ?? [])];
  const existing = recentFeedback.findIndex(item => item.cardId === cardId);
  const previous = existing >= 0 ? recentFeedback[existing].feedback : previousFeedback;
  if (!cardId || cardId.length > 200 || previous === feedback) {
    return { profile, targetDifficulty: current.targetDifficulty, adjusted: false };
  }
  if (existing >= 0) recentFeedback[existing] = { cardId, feedback };
  else if (!previous) recentFeedback.push({ cardId, feedback });
  const window = recentFeedback.slice(-policy.windowSize);
  const canRaise = feedback === "heard" && (existing >= 0 || !previous)
    && window.filter(item => item.feedback === "heard").length >= policy.heardToRaise;
  const upper = Math.min(MAX_DIFFICULTY, normalizeDifficulty(fallbackDifficulty) + policy.maxOffset);
  const targetDifficulty = normalizeDifficulty(canRaise ? Math.min(upper, current.targetDifficulty + 1) : current.targetDifficulty);
  const adjusted = targetDifficulty > current.targetDifficulty;
  const next: TopicLearningProfile = { ...current,
    heard: Math.max(0, current.heard + Number(feedback === "heard") - Number(previous === "heard")),
    unknown: Math.max(0, current.unknown + Number(feedback === "unknown") - Number(previous === "unknown")),
    unknownStreak: feedback === "heard" ? 0 : current.unknownStreak + Number(!previous),
    targetDifficulty, recentFeedback: adjusted ? [] : window };
  return { profile: { ...profile, [key]: next }, targetDifficulty, adjusted };
}
