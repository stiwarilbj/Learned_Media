import type { FactAngle } from "./fact-angle";
import type { FactNoveltySignature } from "./fact-novelty";

export type View = "feed" | "explore" | "videos" | "saved" | "likes" | "history" | "settings";

export type DisplayMode = "picture-text" | "text";

export type SentenceLength = 1 | 2 | 3 | 4 | 6 | 8 | 10;

export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type FactFeedback = "heard" | "unknown";

export type CardExplanationMode = "simpler" | "deeper";
export type CardExplanation = { text: string; sources: WikipediaSource[]; fingerprint: string };
export type CardGlossaryEntry = { term: string; definition: string; sourceIndexes: number[] };
export type SavedCardGlossary = { entries: CardGlossaryEntry[]; sources: WikipediaSource[]; fingerprint: string };
export type SavedFollowUpQuestions = { questions: string[]; fingerprint: string };
export type CardChronologyAnchor = { field: "title" | "hook" | "body"; sentenceIndex?: number };
export type CardChronologyEvent = { dateText: string; eventText: string; anchor: CardChronologyAnchor };
export type SavedCardChronology = { events: CardChronologyEvent[]; fingerprint: string };
export type CardLocationAnchor = { field: "title" | "hook" | "body"; sentenceIndex?: number };
export type SavedCardLocation = { name: string; articleTitle: string; anchor: CardLocationAnchor; latitude?: number; longitude?: number; countryCode?: string; broad?: boolean };
export type SavedCardLocations = { locations: SavedCardLocation[]; fingerprint: string };

export type FactCardAction = "like" | "save" | "more" | "less" | "heard" | "unknown" | "rabbit";

export type TopicLearningProfile = {
  heard: number;
  unknown: number;
  unknownStreak: number;
  targetDifficulty: Difficulty;
  recentFeedback?: Array<{ cardId: string; feedback: FactFeedback }>;
};

export type LearningProfile = Record<string, TopicLearningProfile>;

export type TopicNode = {
  id: string;
  label: string;
  aliases?: string[];
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

/** A completed generation request, retained so readers can repeat its inputs. */
export type BatchSetupSlot = {
  id: string;
  topicPath: string[];
  difficulty: Difficulty;
};
export type BatchSetup = {
  version: 1;
  createdAt: string;
  slots: BatchSetupSlot[];
  settings: FeedSettings;
  factAngle: FactAngle;
  rabbitHole: string | null;
  novelty?: FactNoveltySignature[];
};

export type WikipediaSource = {
  title: string;
  url: string;
  /** The stable article URL, without the evidence text fragment used by the UI link. */
  canonicalUrl?: string;
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

export type AnswerStructure = "automatic" | "short-explanation" | "ordered-steps" | "side-by-side-comparison";
export type ResolvedAnswerStructure = Exclude<AnswerStructure, "automatic">;
export type QuestionInstructionPreference = "written" | "settings";
export type QuestionLengthInstruction = { count: number; exact: boolean; kind: "sentences" | "words" };
export type QuestionInstructionDirective = {
  length?: QuestionLengthInstruction;
  structure?: ResolvedAnswerStructure;
  label: string;
};
export type QuestionInstructionResolution = {
  preference: QuestionInstructionPreference;
  directive?: QuestionInstructionDirective;
  conflict: boolean;
  conflictLabel: string;
  effectiveDetailed: boolean;
  effectiveStructure: AnswerStructure;
  questionForPrompt: string;
  policyVersion: string;
};
export type AnswerComparisonRow = { property: string; values: [string, string] };
export type AnswerPresentation = {
  structure: ResolvedAnswerStructure;
  directAnswer: string;
  paragraphs?: string[];
  steps?: string[];
  comparisonSubjects?: [string, string];
  comparisonRows?: AnswerComparisonRow[];
  fallbackReason?: string;
};

export type GeminiModelCheckStatus = "unchecked" | "checking" | "working" | "failed" | "cooldown";

export type GeminiModelCheck = {
  model: string;
  status: GeminiModelCheckStatus;
  statusCode?: number;
  quotaScope?: "model" | "project" | "unknown";
  latencyMs?: number;
  checkedAt?: string;
  error?: string;
  resolvedModel?: string;
  retryAt?: string;
  supportedGenerationMethods?: string[];
};

export type GeminiModelOutcome = {
  finishReason?: string;
  outputLimitReached?: boolean;
  maxOutputTokens?: number;
  model: string;
  resolvedModel?: string;
  stage: "candidate" | "grounding" | "learning";
  status: "success" | "failed" | "cooldown";
  latencyMs?: number;
  error?: string;
  retryAt?: string;
};

export type FactCard = {
  id: string;
  hook: string;
  title: string;
  body: string;
  /** Original validated sentence boundaries used to place saved citations safely. */
  sentences?: string[];
  sentenceCount?: SentenceLength;
  claim?: string;
  evidence?: Array<{ sentence: number; sourceIndex: number; quote: string; section?: string }>;
  topicPath: string[];
  sources: WikipediaSource[];
  image?: ImageAttribution;
  /** Per-card presentation captured by a repeated batch; an explicit global mode change clears it. */
  displayModeOverride?: DisplayMode;
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
  explanations?: Partial<Record<CardExplanationMode, CardExplanation>>;
  glossary?: SavedCardGlossary;
  followUpQuestions?: SavedFollowUpQuestions;
  chronology?: SavedCardChronology;
  locations?: SavedCardLocations;
  learnMore?: string;
  learnMoreSources?: WikipediaSource[];
  question?: string;
  questionDetailed?: boolean;
  answer?: string;
  answerDetailed?: boolean;
  answerStructure?: ResolvedAnswerStructure;
  answerPresentation?: AnswerPresentation;
  answerSources?: WikipediaSource[];
  questionHistory?: LearningMessage[];
  provenance?: {
    provider: "gemini";
    model: string;
    generatedAt: string;
  };
};

export type GeminiStatus = "not-configured" | "testing" | "connected" | "invalid" | "rate-limited" | "unavailable";
