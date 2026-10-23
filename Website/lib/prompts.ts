import { annotateEvidenceDates } from "./evidence-dates";
import instructions from "./prompt-instructions.json";
import { factWritingRules, difficultyRubric } from "./fact-quality";

export type PromptOperation = "connection" | "candidate" | "combined" | "grounding" | "learn" | "adapt" | "glossary" | "question" | "videoInterpret" | "topicInterpret" | "videoVerify";
export type PromptField = { label: string; value: unknown; multiline?: boolean; reference?: boolean };
export type QuestionType = "when" | "why" | "difference";

/** Match the leading question only; quoted context and later clauses do not choose its type. */
export function detectQuestionType(question?: string): QuestionType | undefined {
  const query = question?.normalize("NFC").toLowerCase().replace(/[’‘]/gu, "'")
    .replace(/\s+/gu, " ").trim().replace(/^please\s+/u, "") ?? "";
  if (/^why\b/u.test(query)) return "why";
  if (/^when(?:\s+(?:exactly|approximately))?\s+(?:did|does|do|was|were|is|are|will|would|can|could|should|has|have|had)\b/u.test(query)
    || /^when\s*[?!]*$/u.test(query)) return "when";
  if (/^(?:what(?:'s| is| are))\s+the\s+(?:main\s+)?differences?(?=\s|[?!.:,]|$)/u.test(query)) return "difference";
  return undefined;
}

function questionTypeRules(question?: string): string[] {
  const type = detectQuestionType(question);
  return type ? instructions[type === "when" ? "questionWhen" : type === "why" ? "questionWhy" : "questionDifference"] : [];
}

/** Split only explicit question clauses, outside quotes and parenthetical text. */
export function questionCoverageChecklist(question?: string): string[] {
  if (!question || question.length > 4000) return [];
  const query = question.normalize("NFC").replace(/\s+/gu, " ").trim();
  const questionStart = /^(?:please\s+)?(?:how|why|when|where|who|what|which|can|could|does|do|did|is|are|was|were|will|would|should|has|have|had)\b/iu;
  if (!questionStart.test(query)) return [];
  const safe: boolean[] = [];
  let quote = "", depth = 0, escaped = false;
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    safe[i] = !quote && depth === 0 && !escaped;
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "“") quote = char === "“" ? "”" : char;
    else if ((char === "'" || char === "‘") && !/[a-z0-9]/iu.test(query[i - 1] ?? "")) quote = char === "‘" ? "’" : char;
    else if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
  }
  const separator = /(?:[,;]?\s+(?:and|also|plus)\s+|[?,;]\s*)(?=(?:how|why|when|where|who|what|which|can|could|does|do|did|is|are|was|were|will|would|should|has|have|had)\b)/giu;
  const parts: string[] = [];
  let start = 0;
  for (const match of query.matchAll(separator)) {
    if (!safe[match.index]) continue;
    parts.push(query.slice(start, match.index));
    start = match.index + match[0].length;
  }
  if (!parts.length) return [];
  parts.push(query.slice(start));
  const seen = new Set<string>();
  const items = parts.map(part => part.trim().replace(/\?+$/u, "").trim()).filter(part => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  return items.length >= 2 && items.length <= 6 && items.every(item => item.length <= 300 && questionStart.test(item)) ? items : [];
}

/** Keep explicit scope phrases as query data, without an interpretation request. */
export function questionScope(question?: string): string[] {
  if (!question || question.length > 4000) return [];
  const query = question.normalize("NFC").replace(/\s+/gu, " ").trim();
  // Ignore qualifiers inside quoted titles; retain parenthetical qualifiers.
  const safe: boolean[] = [];
  let quote = "", escaped = false;
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    safe[i] = !quote && !escaped;
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "“") quote = char === "“" ? "”" : char;
    else if ((char === "'" || char === "‘") && !/[a-z0-9]/iu.test(query[i - 1] ?? "")) quote = char === "‘" ? "’" : char;
  }
  const pattern = /\b(?:(?:(?:not|only)\s+)?(?:outside|within|in|before|after|during|since|until)\s+|for\s+(?=(?:beginners|experts|children|students|adults|researchers)\b)|compared\s+(?:with|to)\s+|versus\s+|vs\.?\s+|(?:no\s+)?(?:earlier|later)\s+than\s+)[^?;!\n]+/giu;
  const seen = new Set<string>(), scopes: string[] = [];
  const masked = query.split("").map((char, i) => safe[i] ? char : " ").join("");
  for (const match of masked.matchAll(pattern)) {
    if (!safe[match.index]) continue;
    // Keep preceding negation and limits attached to their original clause.
    const prefix = query.slice(0, match.index);
    const clauseStart = Math.max(prefix.lastIndexOf("?"), prefix.lastIndexOf(";"), prefix.lastIndexOf("!")) + 1;
    const clausePrefix = query.slice(clauseStart, match.index);
    const phrase = query.slice(match.index, match.index + match[0].length);
    const text = (/\b(?:not|never|except|without|only|just)\b|rather than|at least|at most/iu.test(clausePrefix)
      ? clausePrefix + phrase : phrase).trim().replace(/[.\s]+$/u, "");
    if (text.length > 300) return []; // The full original query still carries long scopes.
    const key = text.toLowerCase();
    if (!seen.has(key)) { seen.add(key); scopes.push(text); }
  }
  return scopes.length <= 6 ? scopes : [];
}

/** Keep instructions separate from data; never normalize evidence or user text. */
export function buildPrompt(operation: PromptOperation, rules: string[] = [], fields: PromptField[] = []) {
  const priority = operation === "connection" ? [] : instructions[operation === "question" ? "questionPriority" : "taskPriority"];
  const sourceData = fields.some(field => field.reference) ? instructions.sourceData : [];
  const datedEvidence = ["grounding", "combined", "learn", "adapt", "question"].includes(operation);
  const dateRules = datedEvidence ? instructions.evidenceDates : [];
  const acronymRules = datedEvidence ? instructions.acronymWriting : [];
  const uniqueRules = Array.from(new Set([...instructions[operation], ...priority, ...sourceData, ...dateRules, ...acronymRules, ...rules]
    .flatMap(rule => rule.split("\n"))
    .map(rule => rule.replace(/\s+/g, " ").trim()).filter(Boolean)));
  const seenFields = new Set<string>();
  const data = fields.flatMap(({ label, value, multiline, reference }) => {
    if (value === undefined || value === null || value === "" || Array.isArray(value) && !value.length) return [];
    const text = reference ? JSON.stringify({ kind: "reference_material", data: datedEvidence ? annotateEvidenceDates(value) : value }) : typeof value === "string" ? value : JSON.stringify(value);
    const field = label + (multiline ? ":\n" : ": ") + text;
    if (seenFields.has(field)) return [];
    seenFields.add(field);
    return [field];
  });
  return [uniqueRules.join(" "), ...data].join("\n\n");
}

/** Standalone cards keep exact length, difficulty, and per-sentence evidence rules. */
export function buildFactCardPrompt({ sentenceCount, difficulties, fields, combined = false }: {
  sentenceCount: number;
  difficulties: number[];
  fields: PromptField[];
  combined?: boolean;
}) {
  return buildPrompt(combined ? "combined" : "grounding", [factWritingRules(sentenceCount, "evidenceIds"),
    ...Array.from(new Set(difficulties)).sort((a, b) => a - b).map(difficultyRubric)], fields);
}

function supportingCard(card: unknown) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return undefined;
  const data = card as Record<string, unknown>;
  return Object.fromEntries(["topicPath", "hook", "title", "body", "claim"].filter(key => data[key] !== undefined).map(key => [key, data[key]]));
}

/** Question answers have independent coverage and length guidance, never card settings. */
export function buildQuestionPrompt({ card, question, detailed, history, evidence }: {
  card: unknown;
  question?: string;
  detailed?: boolean;
  history?: unknown[];
  evidence: unknown[];
}) {
  const checklist = questionCoverageChecklist(question);
  const scope = questionScope(question);
  return buildPrompt("question", [...instructions.answerWriting, ...instructions.questionEvidence, ...questionTypeRules(question),
    ...(checklist.length ? instructions.questionCoverage : []),
    ...(scope.length ? instructions.questionScope : []),
    ...instructions[detailed ? "answerDetailed" : "answerShort"]], [
    { label: "Original user query", value: question },
    { label: "Supporting card context", value: supportingCard(card), reference: true },
    { label: "Previous conversation (context only)", value: history?.slice(-6), reference: true },
    { label: "Wikipedia evidence", value: evidence, reference: true },
    { label: "Coverage checklist", value: checklist, reference: true },
    { label: "Question scope", value: scope, reference: true }
  ]);
}

export function buildLearningPrompt(options: {
  action: "learn" | "adapt" | "glossary" | "question";
  mode?: "simpler" | "deeper";
  card: unknown;
  question?: string;
  detailed?: boolean;
  history?: unknown[];
  evidence: unknown[];
}) {
  if (options.action === "question") return buildQuestionPrompt(options);
  if (options.action === "adapt") {
    const mode = options.mode === "deeper" ? "deeper" : "simpler";
    // Adaptation already carries its own evidence, citation, and scope rules.
    // Reuse the card context and shared reference-data guard without also
    // appending the longer learn-mode instructions.
    return buildPrompt("adapt", instructions[mode === "deeper" ? "adaptDeeper" : "adaptSimpler"], [
      { label: "Original fact card", value: supportingCard(options.card), reference: true },
      { label: "Wikipedia evidence", value: options.evidence, reference: true }
    ]);
  }
  if (options.action === "glossary") {
    return buildPrompt("glossary", [], [
      { label: "Original fact card", value: supportingCard(options.card), reference: true },
      { label: "Wikipedia evidence", value: options.evidence, reference: true }
    ]);
  }
  return buildPrompt("learn", instructions.learningEvidence, [
    { label: "Card", value: supportingCard(options.card), reference: true },
    { label: "Wikipedia evidence", value: options.evidence, reference: true }
  ]);
}

/** Normalize interpretation cache inputs only; preserve punctuation, places, and query meaning. */
export function buildSearchInterpretationPrompt(operation: "topicInterpret" | "videoInterpret", query: string) {
  return buildPrompt(operation, [], [{ label: "Query", value: query.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim() }]);
}
