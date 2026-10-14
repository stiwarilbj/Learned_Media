/** Per-operation diagnostics contain no model output, quotations, or arbitrary error details.
 * Validation still runs for every response; only diagnostic storage is coalesced.
 */
export type ValidationDiagnostic = { operation: string; slot: number; failureType: string; message: string; occurrences: number };
const rules: Array<[string, RegExp, string]> = [
  ["unknown-evidence-id", /unknown evidence ID|unknown ID|unassigned evidence/i, "The card referenced unknown or unassigned evidence."],
  ["needs-evidence", /more evidence is needed/i, "The main claim needs supporting evidence."],
  ["duplicate-fact", /already been shown|repeats another|duplicate/i, "The card repeats a completed fact."],
  ["missing-slot", /omitted/i, "Gemini omitted a slot or returned the wrong topic."],
  ["topic-mismatch", /different topic|wrong topic/i, "The card has the wrong topic."],
  ["invalid-evidence", /evidence reference|evidence IDs|claim evidence/i, "The card has invalid evidence references."],
  ["unsupported-quantity", /number|unit|quantit/i, "A numerical claim lacks matching support."],
  ["unsupported-causality", /causal/i, "A causal claim lacks supporting evidence."],
  ["invalid-status", /valid evidence status/i, "The card is missing a valid evidence status."],
  ["invalid-headings", /heading|hook/i, "The card has invalid headings."],
  ["invalid-sentences", /complete sentence|supported sentences/i, "The card has invalid sentences."],
  ["quotation-mismatch", /quotation|verifiable evidence/i, "A sentence lacks a matching source passage."],
  ["invalid-section", /Wikipedia section|article lead/i, "The card uses an invalid source section."],
  ["invalid-card", /.*/i, "The card failed local content validation."],
];
export class ValidationDiagnostics {
  private readonly records = new Map<string, ValidationDiagnostic>();
  record(operation: "candidate" | "grounding", slot: number, detail: string): string {
    const bounded = detail.slice(0, 1024);
    const [failureType, , message] = rules.find(([, pattern]) => pattern.test(bounded))!;
    const key = JSON.stringify([operation, slot, failureType]);
    const existing = this.records.get(key);
    if (existing) existing.occurrences += 1;
    else this.records.set(key, { operation, slot, failureType, message, occurrences: 1 });
    // Generation has at most ten slots and two operations; the fixed type set bounds storage.
    const count = this.records.get(key)!.occurrences;
    return count > 1 ? `${message} (${count} occurrences)` : message;
  }
  snapshot(): ValidationDiagnostic[] { return Array.from(this.records.values(), item => ({ ...item })); }
}
