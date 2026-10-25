import type { AnswerComparisonRow, AnswerPresentation, AnswerStructure, ResolvedAnswerStructure } from "./types";

export const ANSWER_STRUCTURE_POLICY_VERSION = "answer-structure-v1";
export const ANSWER_STRUCTURES: ReadonlyArray<{ value: AnswerStructure; label: string }> = [
  { value: "automatic", label: "Automatic" },
  { value: "short-explanation", label: "Short explanation" },
  { value: "ordered-steps", label: "Ordered steps" },
  { value: "side-by-side-comparison", label: "Side-by-side comparison" }
];

const resolvedStructures = new Set<ResolvedAnswerStructure>(["short-explanation", "ordered-steps", "side-by-side-comparison"]);
const answerStructures = new Set<AnswerStructure>(ANSWER_STRUCTURES.map(option => option.value));
const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const cleanText = (value: unknown, maximum = 2_000): string => {
  if (typeof value !== "string") return "";
  // String.trim() treats U+FEFF as whitespace. It is legitimate text inside
  // an answer, including at its edges, so remove only ordinary surrounding
  // whitespace while retaining boundary BOMs exactly.
  let start = 0, end = value.length;
  while (start < end && value[start] === "\uFEFF") start++;
  while (end > start && value[end - 1] === "\uFEFF") end--;
  const leading = value.slice(0, start), trailing = value.slice(end);
  return (leading + value.slice(start, end).trim() + trailing).slice(0, maximum);
};
const normalized = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();

export function normalizeAnswerStructure(value: unknown): AnswerStructure {
  return typeof value === "string" && answerStructures.has(value as AnswerStructure) ? value as AnswerStructure : "automatic";
}

export function normalizeResolvedAnswerStructure(value: unknown): ResolvedAnswerStructure | undefined {
  return typeof value === "string" && resolvedStructures.has(value as ResolvedAnswerStructure) ? value as ResolvedAnswerStructure : undefined;
}

/** Reset a submitted choice only when no later user selection superseded it. */
export function shouldResetSubmittedAnswerStructure(currentValue: unknown, submittedValue: unknown, currentRevision: number, submittedRevision: number): boolean {
  const submitted = normalizeAnswerStructure(submittedValue);
  return submitted !== "automatic" && normalizeAnswerStructure(currentValue) === submitted
    && Number.isSafeInteger(currentRevision) && Number.isSafeInteger(submittedRevision) && currentRevision === submittedRevision;
}

function normalizeTextList(value: unknown, limit: number, maxText = 2_000): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, limit).flatMap(item => {
    const text = cleanText(item, maxText);
    const key = normalized(text);
    if (!text || !key || seen.has(key)) return [];
    seen.add(key);
    return [text];
  });
}

function normalizeComparison(value: Record<string, unknown>): { subjects: [string, string]; rows: AnswerComparisonRow[] } | undefined {
  if (!Array.isArray(value.comparisonSubjects) || value.comparisonSubjects.length !== 2 || !Array.isArray(value.comparisonRows)) return undefined;
  const subjects = value.comparisonSubjects.map(item => cleanText(item, 120));
  if (subjects.some(subject => !subject) || normalized(subjects[0]) === normalized(subjects[1]) || value.comparisonRows.length === 0 || value.comparisonRows.length > 10) return undefined;
  const rows: AnswerComparisonRow[] = [];
  const seen = new Set<string>();
  for (const raw of value.comparisonRows) {
    const row = record(raw);
    const property = cleanText(row?.property, 160);
    const values = Array.isArray(row?.values) && row.values.length === 2 ? row.values.map(item => cleanText(item, 800)) : [];
    const key = normalized(property);
    // Do not silently omit malformed/duplicate rows; that could make a partial
    // comparison look balanced. Let the caller present readable prose instead.
    if (!property || values.length !== 2 || !values[0] || !values[1] || !key || seen.has(key)) return undefined;
    seen.add(key);
    rows.push({ property, values: [values[0], values[1]] });
  }
  return { subjects: [subjects[0], subjects[1]], rows };
}

function proseFromStructured(value: Record<string, unknown>, paragraphs: string[]): string[] {
  if (paragraphs.length) return paragraphs;
  const steps = normalizeTextList(value.steps, 10);
  if (steps.length) return steps;
  const comparison = normalizeComparison(value);
  if (comparison) return comparison.rows.map(row => `${row.property}: ${comparison.subjects[0]} — ${row.values[0]}; ${comparison.subjects[1]} — ${row.values[1]}.`);
  return [];
}

function makeAnswer(presentation: AnswerPresentation): string {
  const parts = [presentation.directAnswer];
  if (presentation.structure === "ordered-steps") parts.push(...(presentation.steps ?? []).map((step, index) => `${index + 1}. ${step}`));
  else if (presentation.structure === "side-by-side-comparison" && presentation.comparisonSubjects) {
    parts.push(...(presentation.comparisonRows ?? []).map(row => `${row.property}: ${presentation.comparisonSubjects![0]} — ${row.values[0]}; ${presentation.comparisonSubjects![1]} — ${row.values[1]}.`));
  } else parts.push(...(presentation.paragraphs ?? []));
  if (presentation.fallbackReason) parts.push(presentation.fallbackReason);
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Salvage readable answer text locally when Gemini's optional structure is incomplete.
 * Citations remain validated by the existing learning pipeline.
 */
export function normalizeAnswerResponse(rawValue: unknown, requestedValue: unknown): { answer: string; presentation: AnswerPresentation; structure: ResolvedAnswerStructure } | undefined {
  const raw = record(rawValue);
  if (!raw) return undefined;
  const directAnswer = cleanText(raw.directAnswer ?? raw.answer);
  if (!directAnswer) return undefined;
  const requested = normalizeAnswerStructure(requestedValue);
  const modelStructure = raw.resolvedStructure;
  const resolved = typeof modelStructure === "string" && resolvedStructures.has(modelStructure as ResolvedAnswerStructure)
    ? modelStructure as ResolvedAnswerStructure
    : "short-explanation";
  const paragraphs = normalizeTextList(raw.paragraphs, 8);
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  const steps = normalizeTextList(rawSteps, 10);
  const comparison = normalizeComparison(raw);
  const suppliedReason = cleanText(raw.fallbackReason, 300);
  const requestedFits = requested === "automatic"
    || requested === "short-explanation" && resolved === "short-explanation"
    || requested === "ordered-steps" && resolved === "ordered-steps" && steps.length >= 2
    || requested === "side-by-side-comparison" && resolved === "side-by-side-comparison" && Boolean(comparison);
  const resolvedFits = resolved === "ordered-steps" ? steps.length >= 2 && steps.length === rawSteps.length : resolved === "side-by-side-comparison" ? Boolean(comparison) : true;
  const useFallback = !requestedFits || !resolvedFits;
  const structure: ResolvedAnswerStructure = useFallback ? "short-explanation" : resolved;
  const content = useFallback ? proseFromStructured(raw, paragraphs) : paragraphs;
  const fallbackReason = useFallback
    ? suppliedReason || (requested === "ordered-steps"
      ? "A short explanation is used because the evidence does not establish a clear sequence."
      : requested === "side-by-side-comparison"
        ? "A short explanation is used because the available evidence cannot support a balanced comparison."
        : "A short explanation is used because the requested answer structure did not fit the question.")
    : undefined;
  const presentation: AnswerPresentation = structure === "ordered-steps"
    ? { structure, directAnswer, steps: steps.slice(0, 10) }
    : structure === "side-by-side-comparison" && comparison
      ? { structure, directAnswer, comparisonSubjects: comparison.subjects, comparisonRows: comparison.rows, fallbackReason }
      : { structure: "short-explanation", directAnswer, paragraphs: content, fallbackReason };
  return { answer: makeAnswer(presentation), presentation, structure: presentation.structure };
}

/** Safe persisted shape check shared by browser normalization and the native renderer. */
export function normalizeSavedAnswerPresentation(value: unknown): AnswerPresentation | undefined {
  const raw = record(value);
  if (!raw || typeof raw.structure !== "string" || !resolvedStructures.has(raw.structure as ResolvedAnswerStructure)) return undefined;
  const directAnswer = cleanText(raw.directAnswer);
  if (!directAnswer) return undefined;
  const structure = raw.structure as ResolvedAnswerStructure;
  if (structure === "ordered-steps") {
    const steps = normalizeTextList(raw.steps, 10);
    return steps.length >= 2 ? { structure, directAnswer, steps, fallbackReason: cleanText(raw.fallbackReason, 300) || undefined } : undefined;
  }
  if (structure === "side-by-side-comparison") {
    const comparison = normalizeComparison(raw);
    return comparison ? { structure, directAnswer, comparisonSubjects: comparison.subjects, comparisonRows: comparison.rows, fallbackReason: cleanText(raw.fallbackReason, 300) || undefined } : undefined;
  }
  return { structure, directAnswer, paragraphs: normalizeTextList(raw.paragraphs, 8), fallbackReason: cleanText(raw.fallbackReason, 300) || undefined };
}

export function answerStructureLabel(value: unknown): string {
  return ANSWER_STRUCTURES.find(option => option.value === value)?.label ?? "Automatic";
}

export function isAnswerStructure(value: unknown): value is AnswerStructure {
  return typeof value === "string" && answerStructures.has(value as AnswerStructure);
}
