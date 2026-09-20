/** Small, deterministic fuzzy matching helpers used by the local search UI. */
export function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9\u0080-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();
}

function distance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

function tokenScore(queryToken: string, textToken: string) {
  if (queryToken === textToken) return 20;
  if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) return 13;
  const limit = queryToken.length >= 8 ? 2 : 1;
  return queryToken.length >= 4 && textToken.length >= 4 && distance(queryToken, textToken) <= limit ? 7 : 0;
}

export function searchScore(query: string, text: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
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

export function rankSearchResults<T>(query: string, items: T[], getText: (item: T) => string, limit = items.length) {
  return items
    .map((item, index) => ({ item, index, score: searchScore(query, getText(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
