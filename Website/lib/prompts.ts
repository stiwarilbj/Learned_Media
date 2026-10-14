import instructions from "./prompt-instructions.json";
import { factWritingRules, difficultyRubric } from "./fact-quality";

export type PromptOperation = "connection" | "candidate" | "grounding" | "learn" | "question" | "videoInterpret" | "topicInterpret" | "videoVerify";
export type PromptField = { label: string; value: unknown; multiline?: boolean; reference?: boolean };

/** Keep instructions separate from data; never normalize evidence or user text. */
export function buildPrompt(operation: PromptOperation, rules: string[] = [], fields: PromptField[] = []) {
  const priority = operation === "connection" ? [] : instructions[operation === "question" ? "questionPriority" : "taskPriority"];
  const sourceData = fields.some(field => field.reference) ? instructions.sourceData : [];
  const uniqueRules = Array.from(new Set([...instructions[operation], ...priority, ...sourceData, ...rules]
    .flatMap(rule => rule.split("\n"))
    .map(rule => rule.replace(/\s+/g, " ").trim()).filter(Boolean)));
  const seenFields = new Set<string>();
  const data = fields.flatMap(({ label, value, multiline, reference }) => {
    if (value === undefined || value === null || value === "" || Array.isArray(value) && !value.length) return [];
    const text = reference ? JSON.stringify({ kind: "reference_material", data: value }) : typeof value === "string" ? value : JSON.stringify(value);
    const field = label + (multiline ? ":\n" : ": ") + text;
    if (seenFields.has(field)) return [];
    seenFields.add(field);
    return [field];
  });
  return [uniqueRules.join(" "), ...data].join("\n\n");
}

/** Standalone cards keep exact length, difficulty, and per-sentence evidence rules. */
export function buildFactCardPrompt({ sentenceCount, difficulties, fields }: {
  sentenceCount: number;
  difficulties: number[];
  fields: PromptField[];
}) {
  return buildPrompt("grounding", [factWritingRules(sentenceCount, "evidenceIds"),
    ...Array.from(new Set(difficulties)).sort((a, b) => a - b).map(difficultyRubric)], fields);
}

function supportingCard(card: unknown) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return undefined;
  const data = card as Record<string, unknown>;
  return Object.fromEntries(["topicPath", "hook", "title", "body"].filter(key => data[key] !== undefined).map(key => [key, data[key]]));
}

/** Question answers have independent coverage and length guidance, never card settings. */
export function buildQuestionPrompt({ card, question, detailed, history, evidence }: {
  card: unknown;
  question?: string;
  detailed?: boolean;
  history?: unknown[];
  evidence: unknown[];
}) {
  return buildPrompt("question", [...instructions.answerWriting, ...instructions.questionEvidence,
    ...instructions[detailed ? "answerDetailed" : "answerShort"]], [
    { label: "Original user query", value: question },
    { label: "Supporting card context", value: supportingCard(card), reference: true },
    { label: "Previous conversation (context only)", value: history?.slice(-6), reference: true },
    { label: "Wikipedia evidence", value: evidence, reference: true }
  ]);
}

export function buildLearningPrompt(options: {
  action: "learn" | "question";
  card: unknown;
  question?: string;
  detailed?: boolean;
  history?: unknown[];
  evidence: unknown[];
}) {
  if (options.action === "question") return buildQuestionPrompt(options);
  return buildPrompt("learn", instructions.learningEvidence, [
    { label: "Card", value: supportingCard(options.card), reference: true },
    { label: "Wikipedia evidence", value: options.evidence, reference: true }
  ]);
}
