export type View = "feed" | "explore" | "saved" | "likes" | "history" | "settings";

export type DisplayMode = "picture-text" | "text";

export type SentenceLength = 0.5 | 1 | 2 | 3 | 4;

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

export type FactCard = {
  id: string;
  hook: string;
  title: string;
  body: string;
  topicPath: string[];
  sources: WikipediaSource[];
  image?: ImageAttribution;
  obscurity: number;
  accent: "blue" | "lilac" | "mint" | "sand" | "coral";
  liked?: boolean;
  saved?: boolean;
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
};

export type GeminiStatus = "not-configured" | "testing" | "connected" | "invalid" | "rate-limited" | "unavailable";
