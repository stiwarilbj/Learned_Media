/** Small, deterministic fuzzy matching helpers used by the local search UI. */
function foldSearchText(value: string, preserveHyphens = false) {
  const folded = value.replace(/[\u2010-\u2015\u2212]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(preserveHyphens ? /[^a-z0-9\u0080-\uFFFF-]+/g : /[^a-z0-9\u0080-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();
  return folded;
}

export function normalizeSearchText(value: string) { return foldSearchText(value); }

/** Retain the compound spelling as well as its spaced search equivalent. */
export function searchTextForms(value: string) {
  return [...new Set([foldSearchText(value, true), normalizeSearchText(value)])];
}

// Alternate spellings are search metadata, never additional catalog nodes.
const NAME_VARIANTS = [
  ["Fyodor Dostoevsky", "Fyodor Dostoyevsky", "Dostoevsky", "Dostoyevsky"],
  ["J.R.R. Tolkien", "J. R. R. Tolkien", "JRR Tolkien", "Tolkien"]
];
const nameKey = (value: string) => normalizeSearchText(value).replace(/\s/g, "");
const nameVariants = new Map(NAME_VARIANTS.flatMap(variants => variants.map(name => [nameKey(name), variants] as const)));
export function commonNameAliases(label: string): string[] {
  return (nameVariants.get(nameKey(label)) ?? []).filter(name => name !== label);
}

const SHORT_ALIASES: Record<string, { expansion: string; context: RegExp }> = {
  us: { expansion: "united states", context: /\b(?:united states|american|presidents?|congress|senate|constitution|elections?|politics|political|history|government|states|federal)\b/ },
  ai: { expansion: "artificial intelligence", context: /\b(?:artificial|intelligence|machine|learning|neural|models?|robots?|robotics|generative|algorithms?|computers?|automation|chatbots?|tools|ethics)\b/ },
  it: { expansion: "information technology", context: /\b(?:information|technology|computers?|networks?|networking|software|hardware|cybersecurity|security|support|infrastructure|systems|services|jobs|careers|departments?)\b/ }
};
/** Case alone is not disambiguation: require nearby domain words, not pronoun syntax. */
export function contextualSearchText(value: string) {
  const text = foldSearchText(value, true);
  return text.replace(/\b(?:us|ai|it)\b/g, (token: string, offset: number) => {
    const alias = SHORT_ALIASES[token];
    const before = normalizeSearchText(text.slice(0, offset)).split(" ").slice(-3).join(" ");
    const after = normalizeSearchText(text.slice(offset + token.length)).split(" ").slice(0, 3).join(" ");
    if (token === "us" && (/\b(?:tell|show|teach|help|give|let|ask|makes?|made) us$/.test(before + " us") || /^(?:about|how|why|what|when|where|who|to|with|the|a|an)\b/.test(after))) return "";
    if (token === "it" && (/\b(?:does|did|do|is|was|were|can|could|will|would|has|have|had) it$/.test(before + " it") || /^(?:is|was|does|did|can|will|would|has|seems|means|works)\b/.test(after))) return "";
    return alias.context.test(before + " " + after) ? alias.expansion : "";
  }).replace(/\s+/g, " ").trim();
}

const compoundCache = new Map<string, string[]>();
/** Keep prefixes and short components together before stop-word filtering. */
export function protectedSearchTerms(value: string) {
  const cached = compoundCache.get(value);
  if (cached) return cached;
  const original = foldSearchText(value, true);
  const spaced = normalizeSearchText(value);
  const compounds = [...original.matchAll(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g)].map(match => normalizeSearchText(match[0]));
  const variants = [...spaced.matchAll(/\b(?:x ray|(?:non|post|pre|anti|pro|neo) [a-z0-9]+)\b/g)].map(match => match[0]);
  const terms = [...new Set([...compounds, ...variants])].sort((a, b) => b.length - a.length);
  if (compoundCache.size >= 500) compoundCache.delete(compoundCache.keys().next().value!);
  compoundCache.set(value, terms);
  return terms;
}

const NATURAL_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "how", "i", "in", "into", "is", "it", "of", "on", "or", "the", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with", "explain", "find", "show", "tell", "please", "me", "learn", "understand", "video", "videos", "topics"]);

/** Coverage is authoritative: one complete match beats any number of weak recommendations. */
export function shouldExpandNaturalSearch(query: string, completeCoverage = false) {
  if (completeCoverage) return false;
  const contentWords = normalizeSearchText(query).split(" ").filter(word => word.length > 1 && !NATURAL_SEARCH_STOP_WORDS.has(word));
  return contentWords.length >= 2;
}

function distance(left: string, right: string, maxDistance: number) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
  if (left.length > right.length) [left, right] = [right, left];
  if (!left.length) return right.length;

  const infinity = maxDistance + 1;
  const width = right.length + 1;
  let previous = new Uint32Array(width);
  let current = new Uint32Array(width);
  previous.fill(infinity);
  previous[0] = 0;
  for (let column = 1; column <= Math.min(right.length, maxDistance); column += 1) previous[column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    const firstColumn = Math.max(1, row - maxDistance);
    const lastColumn = Math.min(right.length, row + maxDistance);
    current[0] = row <= maxDistance ? row : infinity;
    if (firstColumn > 1) current[firstColumn - 1] = infinity;

    let rowMinimum = current[0];
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const value = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      current[column] = Math.min(value, infinity);
      rowMinimum = Math.min(rowMinimum, current[column]);
    }

    if (lastColumn < right.length) current[lastColumn + 1] = infinity;
    if (rowMinimum > maxDistance) return infinity;
    [previous, current] = [current, previous];
  }
  return previous[right.length];
}

function tokenScore(queryToken: string, textToken: string) {
  if (queryToken === textToken) return 20;
  if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) return 13;
  const limit = queryToken.length >= 8 ? 2 : 1;
  return queryToken.length >= 4 && textToken.length >= 4 && distance(queryToken, textToken, limit) <= limit ? 7 : 0;
}

export function searchScoreNormalized(normalizedQuery: string, normalizedText: string) {
  if (!normalizedQuery || !normalizedText) return 0;
  if (normalizedText.includes(normalizedQuery)) return 100 + normalizedQuery.length;
  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const textTokens = normalizedText.split(" ").filter(Boolean);
  if (!queryTokens.length) return 0;
  let score = 0;
  let matched = 0;
  queryTokens.forEach((queryToken) => {
    const best = Math.max(...textTokens.map((textToken) => tokenScore(queryToken, textToken)), 0);
    if (best > 0) {
      matched += 1;
      score += best;
    }
  });
  if (!matched) return 0;
  const coverage = matched / queryTokens.length;
  if (coverage < (queryTokens.length > 1 ? 0.5 : 1)) return 0;
  return score * coverage + (matched === queryTokens.length ? 12 : 0);
}

export function searchScore(query: string, text: string) {
  return searchScoreNormalized(normalizeSearchText(query), normalizeSearchText(text));
}

export function rankSearchResults<T>(query: string, items: T[], getText: (item: T) => string, limit = items.length) {
  return items
    .map((item, index) => ({ item, index, score: searchScore(query, getText(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
