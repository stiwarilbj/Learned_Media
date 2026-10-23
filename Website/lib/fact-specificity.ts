import policy from "./fact-specificity-policy.json";

export const SPECIFICITY_FAILURE = "This fact is a basic definition or topic overview. Choose a specific incident, mechanism, exception, experiment, decision, or result within the assigned topic.";
export class FactSpecificityError extends Error {}

const basicPatterns = policy.basic.map(pattern => new RegExp(pattern, "i"));
const paddingPatterns = policy.padding.map(pattern => new RegExp(pattern, "i"));
const detailPattern = new RegExp(policy.detail, "i");
function clauses(text: string): string[] {
  return text.replace(/[’‘]/g, "'").toLowerCase().split(/[.!?;]+/)
    .map(value => value.replace(/\s+/g, " ").trim().replace(/^(?:in|by|on) (?:[a-z]+ \d{1,2},? )?\d{4},? /, ""))
    .filter(Boolean);
}
function basic(clause: string): boolean {
  return !detailPattern.test(clause) && basicPatterns.some(pattern => pattern.test(clause));
}

/** Reject only recognizable introductory claims with no substantive explanation.
 * Unknown wording passes: local patterns cannot establish whether a fact is obscure.
 * Titles, dates and evidence metadata never count as a distinctive detail by themselves.
 */
export function factSpecificityReason(claim: string, sentences: readonly string[] = []): string | undefined {
  const main = clauses(claim);
  if (!main.length || !main.every(basic)) return undefined;
  const explanation = sentences.flatMap(clauses);
  return explanation.every(clause => basic(clause) || paddingPatterns.some(pattern => pattern.test(clause)))
    ? SPECIFICITY_FAILURE : undefined;
}
