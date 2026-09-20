export type View = "feed" | "explore" | "saved" | "likes" | "history" | "settings";

export type DisplayMode = "picture-text" | "text";

export type SentenceLength = 0.5 | 1 | 2 | 3 | 4;

export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type FactFeedback = "heard" | "unknown";

export type FactCardAction = "like" | "save" | "more" | "less" | "heard" | "unknown" | "rabbit";

export type TopicLearningProfile = {
  heard: number;
  unknown: number;
  unknownStreak: number;
  targetDifficulty: Difficulty;
};

export type LearningProfile = Record<string, TopicLearningProfile>;

export type TopicNode = {
  id: string;
  label: string;
  selected: boolean;
  expanded: boolean;
  weight: number;
  children?: TopicNode[];
  custom?: boolean;
};

export type FeedSettings = {
  obscurity: number;
  displayMode: DisplayMode;
  sentenceLength: SentenceLength;
  surpriseMe: boolean;
};

export type WikipediaSource = {
  title: string;
  url: string;
  extract?: string;
};

export type ImageAttribution = {
  url: string;
  alt: string;
  sourceTitle: string;
  sourceUrl: string;
  fileUrl?: string;
  filePageUrl?: string;
  credit?: string;
};

export type LearningMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiModelCheckStatus = "checking" | "working" | "failed" | "cooldown";

export type GeminiModelCheck = {
  model: string;
  status: GeminiModelCheckStatus;
  latencyMs?: number;
  checkedAt?: string;
  error?: string;
  resolvedModel?: string;
  supportedGenerationMethods?: string[];
};

export type GeminiModelOutcome = {
  model: string;
  resolvedModel?: string;
  stage: "candidate" | "grounding" | "learning";
  status: "success" | "failed" | "cooldown";
  latencyMs?: number;
  error?: string;
};

export type FactCard = {
  id: string;
  hook: string;
  title: string;
  body: string;
  topicPath: string[];
  sources: WikipediaSource[];
  image?: ImageAttribution;
  difficulty: Difficulty;
  /** Legacy field kept so older saved cards can be migrated without losing their visual signal. */
  obscurity?: Difficulty;
  accent: "blue" | "lilac" | "mint" | "sand" | "coral";
  liked?: boolean;
  saved?: boolean;
  feedback?: FactFeedback;
  known?: boolean;
  moreLike?: boolean;
  lessLike?: boolean;
  surprise?: boolean;
  createdAt?: string;
  learnMore?: string;
  question?: string;
  answer?: string;
  answerDetailed?: boolean;
  answerSources?: WikipediaSource[];
  questionHistory?: LearningMessage[];
  provenance?: {
    provider: "gemini";
    model: string;
    generatedAt: string;
  };
};

export type GeminiStatus = "not-configured" | "testing" | "connected" | "invalid" | "rate-limited" | "unavailable";
