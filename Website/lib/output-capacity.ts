export const MAX_OUTPUT_CAPACITY = 65_536;

/** Increase capacity only when the provider explicitly reports an output-limit stop. */
export function nextOutputCapacity(current: number, finishReason?: string): number {
  const capacity = Math.max(128, Math.min(MAX_OUTPUT_CAPACITY, current));
  return finishReason === 'MAX_TOKENS' ? Math.min(MAX_OUTPUT_CAPACITY, capacity * 2) : capacity;
}

export function truncatedOutputFloor(outcomes: Array<{ finishReason?: string; maxOutputTokens?: number }>): number {
  return outcomes.reduce((floor, outcome) => outcome.finishReason === 'MAX_TOKENS' && outcome.maxOutputTokens
    ? Math.max(floor, nextOutputCapacity(outcome.maxOutputTokens, outcome.finishReason)) : floor, 0);
}
