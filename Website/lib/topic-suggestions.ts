import { normalizeSearchText } from "./search";
import type { TopicNode } from "./types";

export type TopicSuggestionGroup = "keyword" | "related" | "explore";

export type TopicSuggestion = {
  id: string;
  label: string;
  path: string[];
  group: TopicSuggestionGroup;
};

type TopicWithPath = TopicNode & { path: string[] };

type SearchableTopic = {
  topic: TopicWithPath;
  label: string;
  aliases: string[];
  path: string;
  labelTokens: string[];
  aliasTokens: string[][];
  pathTokens: string[];
  fallbackGroupKey: string;
  order: number;
};

export type TopicSuggestionIndex = {
  entries: SearchableTopic[];
  fallbackGroups: Array<{ key: string; entries: SearchableTopic[] }>;
};

const RESULT_COUNT = 100;
const DIRECT_RESULT_COUNT = 10;
const PATH_ANCHOR_LIMIT = 20;
const PATH_SEPARATOR = "\u0000";
const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "did", "do", "for", "from", "how", "i", "in", "is", "it", "me", "of", "on", "or", "our", "please", "some", "that", "the", "their", "them", "there", "these", "this", "to", "was", "what", "when", "where", "which", "who", "why", "with", "would"
]);

// These are deliberately short concept bridges into the existing catalog. They
// let local search make useful suggestions for natural language even offline.
const CONCEPT_BRIDGES: Array<{ phrases: string[]; topics: string[] }> = [
  { phrases: ["ancient dna", "ancient genetics", "old human dna", "genetic ancestry"], topics: ["genetics", "archaeology", "human origins", "evolution", "paleontology", "prehistoric life"] },
  { phrases: ["shaking ground", "ground shaking", "tremors", "seismic activity", "earth tremor", "earthquake", "earthquakes", "quake", "quakes"], topics: ["earthquakes", "geology", "plate tectonics", "volcanoes", "tsunamis", "landslides", "faults", "seismic waves"] },
  { phrases: ["erupting mountain", "molten rock", "lava flow", "magma", "volcanic eruption", "ash cloud", "volcano", "volcanoes", "volcanology"], topics: ["geology", "plate tectonics", "earthquakes", "tsunamis", "landslides", "natural disasters"] },
  { phrases: ["fossil record", "fossil hunting", "prehistoric creatures", "ancient life", "extinct animals", "paleontology", "fossils"], topics: ["archaeology", "dinosaurs", "prehistoric life", "evolution", "mass extinctions", "human origins", "ancient dna"] },
  { phrases: ["life beyond earth", "alien life", "life on other planets", "search for extraterrestrial life"], topics: ["extraterrestrial life", "astronomy", "space exploration", "planets", "astrophysics"] },
  { phrases: ["outer space", "exploring space", "stars and planets", "the cosmos"], topics: ["space exploration", "astronomy", "planets", "astrophysics", "spaceflight"] },
  { phrases: ["how societies began", "ancient civilizations", "lost civilizations", "early human societies"], topics: ["archaeology", "ancient history", "human origins", "early civilizations", "anthropology"] },
  { phrases: ["human behavior", "how people think", "the mind", "mental processes"], topics: ["psychology", "cognitive science", "neuroscience", "philosophy of mind"] },
  { phrases: ["climate crisis", "global warming", "rising temperatures", "changing climate"], topics: ["climate change", "climatology", "environmental science", "renewable energy", "conservation"] },
  { phrases: ["machine intelligence", "thinking machines", "computer intelligence", "generative ai"], topics: ["artificial intelligence", "computer science", "robotics", "machine learning", "technology history"] },
  { phrases: ["how money works", "financial markets", "wealth and poverty", "economic systems"], topics: ["economics", "history of money", "finance", "business", "economic history"] },
  { phrases: ["world religions", "spiritual traditions", "belief systems", "sacred texts"], topics: ["religion", "religious history", "philosophy", "mythology", "theology"] }
];

function tokenize(value: string) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function meaningfulTokens(value: string) {
  return tokenize(value).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function containsWholePhrase(text: string, phrase: string) {
  if (!text || !phrase) return false;
  return (` ${text} `).includes(` ${phrase} `);
}

function tokenMatch(queryToken: string, candidateTokens: string[]) {
  if (candidateTokens.includes(queryToken)) return 2;
  if (queryToken.length >= 4 && candidateTokens.some((candidate) => candidate.startsWith(queryToken))) return 1;
  return 0;
}

function scoreField(query: string, queryTokens: string[], field: string, fieldTokens: string[], base: number) {
  if (!field) return 0;
  if (containsWholePhrase(field, query)) return base + 300 + query.length;
  if (!queryTokens.length) return 0;
  let exact = 0;
  let matched = 0;
  for (const token of queryTokens) {
    const result = tokenMatch(token, fieldTokens);
    if (result > 0) matched += 1;
    if (result === 2) exact += 1;
  }
  const minimumMatches = queryTokens.length === 1 ? 1 : Math.ceil(queryTokens.length * 0.6);
  if (matched < minimumMatches) return 0;
  return base + matched * 24 + exact * 5;
}

function scoreTopic(normalizedQuery: string, queryTokens: string[], entry: SearchableTopic, includePath = true) {
  if (!queryTokens.length) return 0;
  const labelScore = scoreField(normalizedQuery, queryTokens, entry.label, entry.labelTokens, 300);
  const aliasScore = entry.aliases.reduce((best, alias, index) => Math.max(best, scoreField(normalizedQuery, queryTokens, alias, entry.aliasTokens[index], 230)), 0);
  const pathScore = includePath ? scoreField(normalizedQuery, queryTokens, entry.path, entry.pathTokens, 150) : 0;
  return Math.max(labelScore, aliasScore, pathScore);
}

function phraseIsPresent(query: string, phrase: string) {
  return containsWholePhrase(query, normalizeSearchText(phrase));
}

function getConceptQueries(query: string) {
  const normalized = normalizeSearchText(query);
  const phrases = CONCEPT_BRIDGES.filter((bridge) => bridge.phrases.some((phrase) => phraseIsPresent(normalized, phrase))).flatMap((bridge) => bridge.topics);
  return Array.from(new Set(phrases));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createTopicSuggestionIndex(topics: TopicWithPath[]): TopicSuggestionIndex {
  const entries = topics.map((topic, order): SearchableTopic => {
    const aliases = Array.from(new Set([topic.label, ...(topic.aliases ?? [])]));
    return {
      topic,
      label: normalizeSearchText(topic.label),
      aliases: aliases.map(normalizeSearchText),
      path: normalizeSearchText(topic.path.join(" ")),
      labelTokens: tokenize(topic.label),
      aliasTokens: aliases.map(tokenize),
      pathTokens: tokenize(topic.path.join(" ")),
      fallbackGroupKey: topic.path.slice(0, 2).join(PATH_SEPARATOR) || topic.path[0] || "",
      order
    };
  });

  const groups = new Map<string, SearchableTopic[]>();
  const leafEntries = entries.filter((entry) => !entry.topic.children?.length && entry.topic.path.length > 1);
  for (const entry of leafEntries.length ? leafEntries : entries) {
    const bucket = groups.get(entry.fallbackGroupKey) ?? [];
    bucket.push(entry);
    groups.set(entry.fallbackGroupKey, bucket);
  }

  return {
    entries,
    fallbackGroups: Array.from(groups, ([key, groupEntries]) => ({ key, entries: groupEntries }))
  };
}

function sharedPathScore(left: string[], right: string[]) {
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) shared += 1;
  const leftDistance = left.length - shared;
  const rightDistance = right.length - shared;
  const distance = leftDistance + rightDistance;

  if (shared === left.length || shared === right.length) return Math.max(70, 240 - distance * 24);
  if (shared === left.length - 1 && shared >= 2) return Math.max(95, 225 - distance * 20);
  if (shared >= 2) return Math.max(65, 175 + shared * 8 - distance * 18);
  return 0;
}

function rankTopics(query: string, entries: SearchableTopic[], includePath = true) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = meaningfulTokens(normalizedQuery);
  if (!queryTokens.length) return [];
  return entries
    .map((entry) => ({ entry, score: scoreTopic(normalizedQuery, queryTokens, entry, includePath) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.order - right.entry.order);
}

function exploreFallback(index: TopicSuggestionIndex, query: string, excluded: Set<string>, count: number) {
  if (count <= 0 || !index.fallbackGroups.length) return [];
  const result: SearchableTopic[] = [];
  const groups = index.fallbackGroups;
  const start = hashString(query) % groups.length;
  const maxGroupSize = Math.max(...groups.map((group) => group.entries.length));
  for (let depth = 0; depth < maxGroupSize && result.length < count; depth += 1) {
    for (let offset = 0; offset < groups.length && result.length < count; offset += 1) {
      const group = groups[(start + offset) % groups.length];
      const position = (depth + hashString(`${query}:${group.key}`) % group.entries.length) % group.entries.length;
      const candidate = group.entries[position];
      if (excluded.has(candidate.topic.id)) continue;
      excluded.add(candidate.topic.id);
      result.push(candidate);
    }
  }

  if (result.length < count) {
    for (const candidate of index.entries) {
      if (result.length >= count) break;
      if (excluded.has(candidate.topic.id)) continue;
      excluded.add(candidate.topic.id);
      result.push(candidate);
    }
  }
  return result;
}

export function suggestTopics(index: TopicSuggestionIndex, rawQuery: string, semanticTerms: string[] = []): TopicSuggestion[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const allDirectMatches = rankTopics(query, index.entries);
  const directMatches = allDirectMatches.slice(0, DIRECT_RESULT_COUNT);
  const directIds = new Set(allDirectMatches.map(({ entry }) => entry.topic.id));
  const exactDirectAnchors = allDirectMatches
    .filter(({ entry }) => entry.label === normalizeSearchText(query) || entry.aliases.includes(normalizeSearchText(query)))
    .slice(0, PATH_ANCHOR_LIMIT);
  const directAnchors = exactDirectAnchors.length ? exactDirectAnchors : directMatches;
  const semanticQueries = Array.from(new Set([...getConceptQueries(query), ...semanticTerms.map(normalizeSearchText).filter(Boolean)]));

  const semanticScores = new Map<string, { entry: SearchableTopic; score: number }>();
  for (const term of semanticQueries) {
    for (const result of rankTopics(term, index.entries, false).slice(0, PATH_ANCHOR_LIMIT)) {
      const current = semanticScores.get(result.entry.topic.id);
      semanticScores.set(result.entry.topic.id, { entry: result.entry, score: Math.max(current?.score ?? 0, result.score) });
    }
  }

  const pathAnchors = new Map<string, { entry: SearchableTopic; score: number }>();
  for (const { entry, score } of directAnchors) pathAnchors.set(entry.topic.id, { entry, score: score + 200 });
  for (const [id, { entry, score }] of semanticScores) {
    const current = pathAnchors.get(id);
    pathAnchors.set(id, { entry, score: Math.max(current?.score ?? 0, score) });
  }
  const anchors = Array.from(pathAnchors.values()).sort((left, right) => right.score - left.score).slice(0, PATH_ANCHOR_LIMIT + DIRECT_RESULT_COUNT);

  const rankedRelated = index.entries
    .filter((entry) => !directIds.has(entry.topic.id))
    .map((entry) => {
      const semanticScore = semanticScores.get(entry.topic.id)?.score ?? 0;
      const pathScore = anchors.reduce((best, anchor) => Math.max(best, sharedPathScore(anchor.entry.topic.path, entry.topic.path)), 0);
      return { entry, score: semanticScore + pathScore, branchKey: entry.topic.path.slice(0, 3).join(PATH_SEPARATOR) };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.order - right.entry.order);

  const relatedMatches: typeof rankedRelated = [];
  const branchCounts = new Map<string, number>();
  const selectedRelatedIds = new Set<string>();
  const relatedLimit = RESULT_COUNT - directMatches.length;
  for (let branchLimit = 8; relatedMatches.length < relatedLimit; branchLimit *= 2) {
    let added = 0;
    for (const candidate of rankedRelated) {
      if (relatedMatches.length >= relatedLimit) break;
      if (selectedRelatedIds.has(candidate.entry.topic.id)) continue;
      if ((branchCounts.get(candidate.branchKey) ?? 0) >= branchLimit) continue;
      selectedRelatedIds.add(candidate.entry.topic.id);
      branchCounts.set(candidate.branchKey, (branchCounts.get(candidate.branchKey) ?? 0) + 1);
      relatedMatches.push(candidate);
      added += 1;
    }
    if (!added || branchLimit > rankedRelated.length) break;
  }

  const usedIds = new Set([...directIds, ...relatedMatches.map(({ entry }) => entry.topic.id)]);
  const fallback = exploreFallback(index, query, usedIds, RESULT_COUNT - directMatches.length - relatedMatches.length);
  const toSuggestion = (entry: SearchableTopic, group: TopicSuggestionGroup): TopicSuggestion => ({
    id: entry.topic.id,
    label: entry.topic.label,
    path: entry.topic.path,
    group
  });

  return [
    ...directMatches.map(({ entry }) => toSuggestion(entry, "keyword")),
    ...relatedMatches.map(({ entry }) => toSuggestion(entry, "related")),
    ...fallback.map((entry) => toSuggestion(entry, "explore"))
  ];
}
