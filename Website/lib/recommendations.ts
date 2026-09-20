import type { Difficulty, FactFeedback, LearningProfile, TopicLearningProfile } from "./types";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Moderate",
  4: "Challenging",
  5: "Hard",
  6: "Very Hard",
  7: "Expert",
  8: "Specialist",
  9: "Extremely Obscure",
  10: "Exceptionally Obscure"
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
