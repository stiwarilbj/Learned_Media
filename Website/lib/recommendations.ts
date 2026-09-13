import type { Difficulty, FactCard, FactFeedback, FeedSettings, LearningProfile, TopicLearningProfile } from "./types";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Starter",
  2: "Familiar",
  3: "Curious",
  4: "Unusual",
  5: "Interesting",
  6: "Challenging",
  7: "Deep cut",
  8: "Rare",
  9: "Esoteric",
  10: "Obscure"
};

export const MAX_DIFFICULTY = 10;
export const DEFAULT_DIFFICULTY: Difficulty = 10;

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

export function getTopicLearningProfile(profile: LearningProfile, topicPath: string[], fallbackDifficulty: Difficulty = DEFAULT_DIFFICULTY) {
  return profile[topicKey(topicPath)] ?? defaultTopicLearningProfile(fallbackDifficulty);
}

/** Harder topics tolerate more consecutive unknown cards before adapting downward. */
export function unknownThreshold(difficulty: Difficulty) {
  return Math.round(10 + (difficulty - 1) * (10 / 9));
}

export function recordTopicFeedback(
  profile: LearningProfile,
  topicPath: string[],
  feedback: FactFeedback,
  fallbackDifficulty: Difficulty = DEFAULT_DIFFICULTY
) {
  const key = topicKey(topicPath);
  const current = profile[key] ?? defaultTopicLearningProfile(fallbackDifficulty);
  const threshold = unknownThreshold(current.targetDifficulty);

  if (feedback === "heard") {
    const targetDifficulty = normalizeDifficulty(current.targetDifficulty + 1);
    return {
      profile: {
        ...profile,
        [key]: { ...current, heard: current.heard + 1, unknownStreak: 0, targetDifficulty }
      },
      targetDifficulty,
      threshold,
      adjusted: targetDifficulty > current.targetDifficulty
    };
  }

  const nextStreak = current.unknownStreak + 1;
  const shouldEase = nextStreak >= threshold && current.targetDifficulty > 1;
  const targetDifficulty = shouldEase ? normalizeDifficulty(current.targetDifficulty - 1) : current.targetDifficulty;
  return {
    profile: {
      ...profile,
      [key]: {
        ...current,
        unknown: current.unknown + 1,
        unknownStreak: shouldEase ? 0 : nextStreak,
        targetDifficulty
      }
    },
    targetDifficulty,
    threshold,
    adjusted: shouldEase
  };
}

function topicMatches(cardPath: string[], selectedPath: string[]) {
  const normalizedCard = cardPath.map((part) => part.toLowerCase());
  const normalizedSelected = selectedPath.map((part) => part.toLowerCase());
  return normalizedSelected.every((part, index) => normalizedCard[index] === part) || normalizedCard.every((part, index) => normalizedSelected[index] === part);
}

function cardTargetDifficulty(card: FactCard, selectedPaths: Array<{ path: string[]; weight: number }>, profile: LearningProfile, fallback: Difficulty) {
  const exact = getTopicLearningProfile(profile, card.topicPath, fallback);
  if (profile[topicKey(card.topicPath)]) return exact.targetDifficulty;
  const related = selectedPaths.find(({ path }) => topicMatches(card.topicPath, path));
  return related ? getTopicLearningProfile(profile, related.path, fallback).targetDifficulty : fallback;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function selectDemoFacts(
  cards: FactCard[],
  selectedPaths: Array<{ path: string[]; weight: number }>,
  settings: FeedSettings,
  profile: LearningProfile,
  avoid: string[]
) {
  const avoided = new Set(avoid.map((title) => title.trim().toLowerCase()).filter(Boolean));
  const relevant = cards.filter((card) => !selectedPaths.length || selectedPaths.some(({ path }) => topicMatches(card.topicPath, path)));
  const pool = relevant.length ? relevant : cards;
  const ranked = [...pool]
    .sort((a, b) => {
      const aTarget = cardTargetDifficulty(a, selectedPaths, profile, normalizeDifficulty(settings.obscurity));
      const bTarget = cardTargetDifficulty(b, selectedPaths, profile, normalizeDifficulty(settings.obscurity));
      const aAvoid = avoided.has(a.title.toLowerCase()) ? -100 : 0;
      const bAvoid = avoided.has(b.title.toLowerCase()) ? -100 : 0;
      const aScore = aAvoid + 20 - Math.abs(a.difficulty - aTarget) * 5 + (a.difficulty >= aTarget ? 2 : 0);
      const bScore = bAvoid + 20 - Math.abs(b.difficulty - bTarget) * 5 + (b.difficulty >= bTarget ? 2 : 0);
      return bScore - aScore || Math.random() - 0.5;
    });
  const notRecentlyShown = ranked.filter((card) => !avoided.has(card.title.toLowerCase()));
  const candidateWindow = (notRecentlyShown.length ? notRecentlyShown : ranked).slice(0, Math.min(16, ranked.length));
  return shuffle(candidateWindow).slice(0, 10);
}
