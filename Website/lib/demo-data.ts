import type { FeedSettings, TopicNode } from "./types";
import { createCatalogTopics } from "./topic-catalog";

export const DEFAULT_SETTINGS: FeedSettings = {
  obscurity: 5,
  displayMode: "picture-text",
  sentenceLength: 3,
  surpriseMe: true
};

export function createDefaultTopics(): TopicNode[] {
  return createCatalogTopics();
}

export const EXPLORE_CATEGORIES = [
  { label: "History", description: "Forgotten inventions, turning points, and people", tone: "blue", topics: ["Ancient History", "History of Technology", "U.S. History"] },
  { label: "Science", description: "Explore the natural world and the ideas behind the systems we use every day", tone: "mint", topics: ["Biology", "Space", "Physics", "Computer Science"] },
  { label: "Geography", description: "Unusual places, borders, landscapes, and cities", tone: "sand", topics: ["Cities", "Rivers", "Biomes"] },
  { label: "Entertainment", description: "Stories, music, screens, and ideas people love", tone: "rose", topics: ["Literature", "Movies", "Television", "Music"] }
];
