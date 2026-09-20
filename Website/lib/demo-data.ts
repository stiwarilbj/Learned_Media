import type { FeedSettings, TopicNode } from "./types";
import { createCatalogTopics } from "./topic-catalog";

export const DEFAULT_SETTINGS: FeedSettings = {
  obscurity: 10,
  displayMode: "picture-text",
  sentenceLength: 2,
  surpriseMe: true
};

export function createDefaultTopics(): TopicNode[] {
  return createCatalogTopics();
}

export const EXPLORE_CATEGORIES = [
  { label: "History", description: "Forgotten inventions, turning points, and people.", tone: "blue", topics: ["Ancient History", "History of Technology", "U.S. History"] },
  { label: "Science", description: "Strange systems, hidden mechanisms, and the natural world.", tone: "mint", topics: ["Biology", "Space", "Physics"] },
  { label: "Computer Science", description: "The small ideas behind the systems we use every day.", tone: "lilac", topics: ["AI & Machine Learning", "Programming", "Computing History"] },
  { label: "Geography", description: "Unusual places, borders, landscapes, and cities.", tone: "sand", topics: ["Cities", "Rivers", "Biomes"] },
  { label: "Literature", description: "Books, poems, plays, and ideas that shaped how people think.", tone: "rose", topics: ["Books", "Poems", "Political Writings", "Plays and Drama"] }
];
