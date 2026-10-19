import type { TopicSuggestion } from "./topic-suggestions";

export type TopicSearchIndex = {
  query: string;
  catalogRevision: number;
  ready?: boolean;
  visibleIds: Set<string>;
  matchingDescendants: Set<string>;
  directScores: Map<string, number>;
};

export type TopicSearchWorkerReply = {
  type: "ready" | "results" | "rebuild";
  requestId?: number;
  query?: string;
  catalogRevision?: number;
  suggestions?: TopicSuggestion[];
  matchedIds?: string[];
  completeCoverage?: boolean;
  visibleIds?: string[];
  matchingDescendants?: string[];
  directScores?: Array<[string, number]>;
};
