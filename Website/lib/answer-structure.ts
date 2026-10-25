import type { AnswerComparisonRow, AnswerPresentation, AnswerStructure, QuestionInstructionPreference, QuestionInstructionResolution, ResolvedAnswerStructure } from "./types";

export const ANSWER_STRUCTURE_POLICY_VERSION = "answer-structure-v1";
export const QUESTION_INSTRUCTION_POLICY_VERSION = "question-instruction-override-v1";
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

type DetectedInstruction = { kind: "length" | "structure"; key: string; label: string; start: number; end: number; length?: { count: number; exact: boolean; kind: "sentences" | "words" }; structure?: ResolvedAnswerStructure };
type DetectedInstructionMatch = Omit<DetectedInstruction, "kind" | "start" | "end"> & { phrase: string };
const smallNumbers: Record<string, number> = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function parseBoundedNumber(value: string, maximum: number) {
  const count = /^\d+$/u.test(value) ? Number(value) : smallNumbers[value.toLocaleLowerCase()];
  return Number.isInteger(count) && count! >= 1 && count! <= maximum ? count : undefined;
}
function maskQuotedQuestion(value: string) {
  const chars = value.split("");
  let quote = "";
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (quote) {
      chars[i] = " ";
      if (char === quote || quote === "“" && char === "”" || quote === "‘" && char === "’") quote = "";
      continue;
    }
    if (char === "\"" || char === "“" || (char === "‘" && (i === 0 || /\s/u.test(chars[i - 1])))) {
      quote = char;
      chars[i] = " ";
    }
  }
  return chars.join("");
}
function numberWords(maximum: number) {
  return maximum === 10 ? "(?:one|a|an|two|three|four|five|six|seven|eight|nine|ten|[1-9]|10)" : "(?:one|a|an|two|three|four|five|six|seven|eight|nine|ten|\\d{1,3})";
}
function collectPattern(text: string, pattern: RegExp, kind: "length" | "structure", build: (match: RegExpExecArray) => DetectedInstructionMatch): DetectedInstruction[] {
  const result: DetectedInstruction[] = [];
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const item = build(match);
    const phrase = item.phrase;
    const relativeStart = phrase ? match[0].lastIndexOf(phrase) : match[0].length;
    const start = match.index + Math.max(0, relativeStart);
    const clauseStart = Math.max(text.lastIndexOf(".", start - 1), text.lastIndexOf("?", start - 1), text.lastIndexOf("!", start - 1), text.lastIndexOf(";", start - 1), text.lastIndexOf("\n", start - 1)) + 1;
    const beforeAction = text.slice(clauseStart, start);
    // Only recognize an instruction phrased as a direct request. References to
    // hypothetical, quoted, or negated instructions are ordinary question text.
    if (/\b(?:if|unless|imagine|suppose|hypothetically|would|could|might|should|don't|do not|never|not to)\b/iu.test(beforeAction)) continue;
    const end = start + (phrase?.length ?? 0);
    if (end > start) result.push({ kind, ...item, start, end });
    if (!match[0].length) pattern.lastIndex++;
  }
  return result;
}

function detectQuestionInstructions(question: string): { directive?: QuestionInstructionResolution["directive"]; items: DetectedInstruction[] } {
  const masked = maskQuotedQuestion(question);
  const action = "(?:please\\s+)?(?:answer|respond|explain|summarize|write|use|give(?:\\s+me)?|provide|keep\\s+(?:it|the answer))";
  const sentenceNumber = numberWords(10);
  const wordNumber = numberWords(500);
  const lengthPatterns = [
    { kind: "sentences" as const, noun: "sentence", maximum: 10, regex: new RegExp(`\\b${action}\\b[^?!.;\\n]{0,70}?\\b((?:in|within)\\s+(?:(?:exactly|at most|no more than|up to)\\s+)?${sentenceNumber}\\s+sentences?|(?:in|within)\\s+(?:a\\s+)?(?:maximum|max)(?:\\s+of)?\\s+${sentenceNumber}\\s+sentences?|(?:exactly|at most|no more than|up to|(?:a\\s+)?(?:maximum|max)(?:\\s+of)?)\\s+${sentenceNumber}\\s+sentences?)\\b`, "giu") },
    { kind: "words" as const, noun: "word", maximum: 500, regex: new RegExp(`\\b${action}\\b[^?!.;\\n]{0,70}?\\b((?:in|within)\\s+(?:(?:exactly|at most|no more than|up to)\\s+)?${wordNumber}\\s+words?|(?:in|within)\\s+(?:a\\s+)?(?:maximum|max)(?:\\s+of)?\\s+${wordNumber}\\s+words?|(?:exactly|at most|no more than|up to|(?:a\\s+)?(?:maximum|max)(?:\\s+of)?)\\s+${wordNumber}\\s+words?)\\b`, "giu") }
  ];
  const items: DetectedInstruction[] = [];
  for (const spec of lengthPatterns) {
    items.push(...collectPattern(masked, spec.regex, "length", match => {
      const phrase = match[1].replace(/\s+/gu, " ").trim();
      const countMatch = phrase.match(new RegExp(`(${spec.kind === "sentences" ? sentenceNumber : wordNumber})\\s+${spec.noun}s?`, "iu"));
      const count = countMatch ? parseBoundedNumber(countMatch[1], spec.maximum) : undefined;
      const exact = /\bexactly\b/iu.test(phrase)
        || /\b(?:in|within)\b/iu.test(phrase) && !/\b(?:at most|no more than|up to|maximum|max)\b/iu.test(phrase);
      if (!count) return { key: "", label: "", phrase: "" };
      const label = spec.kind === "sentences"
        ? exact ? count === 1 ? "one sentence" : `${count} sentences` : `up to ${count} ${count === 1 ? "sentence" : "sentences"}`
        : exact ? `exactly ${count} ${count === 1 ? "word" : "words"}` : `up to ${count} ${count === 1 ? "word" : "words"}`;
      return { key: `${spec.kind}:${count}:${exact}`, label, phrase, length: { count, exact, kind: spec.kind } };
    }).filter(item => item.key));
  }
  const formatPatterns: Array<{ regex: RegExp; structure: ResolvedAnswerStructure; label: string; phrase: (match: RegExpExecArray) => string }> = [
    { regex: /\b(?:please\s+)?(?:use|answer|respond|explain|format|present|organize|write|give|provide)\b[^?!.;\n]{0,55}?\b((?:(?:in|as|with|using)\s+(?:(?:clear|ordered|numbered)\s+)?steps?|(?:numbered|ordered)\s+steps?|(?:in|as|with|using)\s+(?:numbered|ordered)\s+lists?))\b/giu, structure: "ordered-steps", label: "ordered steps", phrase: match => match[1] },
    { regex: /\b(?:please\s+)?(?:compare|use|answer|respond|format|present|organize|write|give|provide)\b[^?!.;\n]{0,75}?\b(side[- ]by[- ]side(?:\s+comparison)?(?:\s+table)?|(?:in|as)\s+(?:a\s+)?comparison\s+table)\b/giu, structure: "side-by-side-comparison", label: "side-by-side comparison", phrase: match => match[1] },
    { regex: /\b(?:please\s+)?(?:give(?:\s+me)?|provide|write|answer|explain|keep(?:\s+it)?)\b[^?!.;\n]{0,50}?\b((?:a\s+)?(?:short|brief)\s+explanation|in\s+(?:plain\s+)?prose|as\s+(?:a\s+)?paragraph)\b/giu, structure: "short-explanation", label: "short explanation", phrase: match => match[1] }
  ];
  for (const spec of formatPatterns) {
    items.push(...collectPattern(masked, spec.regex, "structure", match => {
      const phrase = spec.phrase(match).replace(/\s+/gu, " ").trim();
      return { key: `structure:${spec.structure}`, label: spec.label, phrase, structure: spec.structure };
    }));
  }
  const unique = new Map<string, DetectedInstruction>();
  for (const item of items) unique.set(item.key, item);
  const all = [...unique.values()];
  const lengths = all.filter(item => item.kind === "length");
  const structures = all.filter(item => item.kind === "structure");
  const contradictoryRemainder = lengths.some(item => {
    const clauseEnd = masked.slice(item.end).search(/[.!?;\n]/u);
    const remainder = masked.slice(item.end, clauseEnd < 0 ? undefined : item.end + clauseEnd);
    const countPattern = item.length?.kind === "sentences" ? sentenceNumber : wordNumber;
    const noun = item.length?.kind === "sentences" ? "sentences?" : "words?";
    const connectorPattern = "\\b(?:or|rather than|instead of|not|but|and)\\s+(?:(?:then|instead)\\s+)?(?:(?:please\\s+)?(?:use|write|answer|keep(?:\\s+it)?|respond)\\s+)?(?:(?:in|within)\\s+)?(?:exactly\\s+|at most\\s+|no more than\\s+|up to\\s+)?(" + countPattern + ")(?:\\s+" + noun + ")?\\b";
    const alternative = remainder.match(new RegExp(connectorPattern, "iu"));
    const count = alternative ? parseBoundedNumber(alternative[1], item.length?.kind === "sentences" ? 10 : 500) : undefined;
    return count !== undefined && count !== item.length?.count;
  });
  // Competing explicit values or incompatible requested forms are ambiguous.
  if (contradictoryRemainder || new Set(lengths.map(item => item.key.split(":").slice(0, 2).join(":"))).size > 1
    || new Set(structures.map(item => item.key)).size > 1
    || lengths.some(item => item.length?.kind === "sentences" && item.length.count === 1) && structures.some(item => item.structure === "ordered-steps" || item.structure === "side-by-side-comparison")) {
    return { items: [] };
  }
  const length = lengths[0]?.length;
  const structure = structures[0]?.structure;
  if (!length && !structure) return { items: [] };
  const label = [lengths[0]?.label, structures[0]?.label].filter(Boolean).join(" · ");
  return { items: all, directive: { ...(length ? { length } : {}), ...(structure ? { structure } : {}), label } };
}

function questionWithoutInstructions(question: string, removed: DetectedInstruction[]) {
  let value = question;
  for (const item of [...removed].sort((a, b) => b.start - a.start)) value = value.slice(0, item.start) + " " + value.slice(item.end);
  return value.replace(/\s+/gu, " ").replace(/\s+([,.;:?!])/gu, "$1").replace(/([,;:]\s*){2,}/gu, " ").trim()
    .replace(/^(?:please\s+)?(?:answer|respond|write|use|format|present|organize|structure|give|provide)\s*[:,-]\s*/iu, "")
    .replace(/^use\s+to\s+/iu, "").replace(/^[,;:–—-]+\s*/u, "").replace(/[\s,;:–—-]+$/u, "")
    .replace(/(?:^|[\s,;:–—-])(?:please\s+)?(?:answer|respond|write|use|format|present|organize|structure|give|provide)\s*[.!?]*$/iu, "")
    .trim().replace(/^([a-z])/u, character => character.toLocaleUpperCase());
}

export function resolveQuestionInstructions(question: string, detailed: boolean, structureValue: unknown, preferenceValue: unknown = "written"): QuestionInstructionResolution {
  const preference: QuestionInstructionPreference = preferenceValue === "settings" ? "settings" : "written";
  const settingStructure = normalizeAnswerStructure(structureValue);
  const rawDetected = detectQuestionInstructions(question);
  const rawCleanedQuestion = questionWithoutInstructions(question, rawDetected.items);
  const instructionOnly = !rawCleanedQuestion.trim() || /^(?:please\s+)?(?:answer|respond|explain|write|use|format|present|organize|structure|give|provide)\s*[.!?]*$/iu.test(rawCleanedQuestion)
    || /^(?:can|could|would)\s+you\s*$/iu.test(rawCleanedQuestion);
  const detected = instructionOnly ? { items: [] as DetectedInstruction[], directive: undefined } : rawDetected;
  const directive = detected.directive;
  const sentenceLimit = directive?.length?.kind === "sentences" ? directive.length : undefined;
  const wordLimit = directive?.length?.kind === "words" ? directive.length : undefined;
  const shortFormat = directive?.structure === "short-explanation";
  const lengthConflict = Boolean(sentenceLimit && (sentenceLimit.count === 1 || !detailed && sentenceLimit.exact && sentenceLimit.count > 4))
    || Boolean(wordLimit && detailed && (wordLimit.exact ? wordLimit.count < 150 || wordLimit.count > 250 : wordLimit.count < 150))
    || Boolean(shortFormat && detailed);
  const structureConflict = Boolean(directive?.structure && settingStructure !== "automatic" && directive.structure !== settingStructure)
    || Boolean(sentenceLimit && sentenceLimit.count === 1 && (settingStructure === "ordered-steps" || settingStructure === "side-by-side-comparison"));
  const conflict = Boolean(directive && (lengthConflict || structureConflict));
  const suppressedKinds = new Set<string>();
  if (preference === "settings" && conflict) {
    if (lengthConflict) suppressedKinds.add("length");
    if (structureConflict) suppressedKinds.add("structure");
  }
  const activeItems = detected.items.filter(item => !suppressedKinds.has(item.kind));
  const activeLength = activeItems.find(item => item.kind === "length")?.length;
  const activeStructure = activeItems.find(item => item.kind === "structure")?.structure;
  const oneSentence = activeLength?.kind === "sentences" && activeLength.count === 1;
  const effectiveStructure = activeStructure ?? (oneSentence ? "short-explanation" : settingStructure);
  const effectiveDetailed = effectiveStructure === "short-explanation" || oneSentence ? false : detailed;
  // Keep the original draft in card history, but give the writer the
  // substantive question separately from the resolved output instructions.
  const questionForPrompt = detected.items.length ? questionWithoutInstructions(question, detected.items) || question : question;
  const conflictLabel = conflict ? detected.items.filter(item => suppressedKinds.has(item.kind) || preference === "written" && ((item.kind === "length" && lengthConflict) || (item.kind === "structure" && structureConflict))).map(item => item.label).filter((item, index, list) => list.indexOf(item) === index).join(" · ") : "";
  return { preference, directive: activeItems.length ? { ...(activeLength ? { length: activeLength } : {}), ...(activeStructure ? { structure: activeStructure } : {}), label: activeItems.map(item => item.label).filter((item, index, list) => list.indexOf(item) === index).join(" · ") } : undefined, conflict, conflictLabel, effectiveDetailed, effectiveStructure, questionForPrompt, policyVersion: QUESTION_INSTRUCTION_POLICY_VERSION };
}

export function isQuestionInstructionPreference(value: unknown): value is QuestionInstructionPreference {
  return value === "written" || value === "settings";
}

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
