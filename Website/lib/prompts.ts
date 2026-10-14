import instructions from "./prompt-instructions.json";

export type PromptOperation = "connection" | "candidate" | "grounding" | "learn" | "question" | "videoInterpret" | "topicInterpret" | "videoVerify";
export type PromptField = { label: string; value: unknown; multiline?: boolean };

/** Keep instructions separate from data; never normalize evidence or user text. */
export function buildPrompt(operation: PromptOperation, rules: string[] = [], fields: PromptField[] = []) {
  const priority = operation === "connection" ? [] : instructions[operation === "question" ? "questionPriority" : "taskPriority"];
  const uniqueRules = Array.from(new Set([...instructions[operation], ...priority, ...rules]
    .flatMap(rule => rule.split("\n"))
    .map(rule => rule.replace(/\s+/g, " ").trim()).filter(Boolean)));
  const seenFields = new Set<string>();
  const data = fields.flatMap(({ label, value, multiline }) => {
    if (value === undefined || value === null || value === "" || Array.isArray(value) && !value.length) return [];
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const field = label + (multiline ? ":\n" : ": ") + text;
    if (seenFields.has(field)) return [];
    seenFields.add(field);
    return [field];
  });
  return [uniqueRules.join(" "), ...data].join("\n\n");
}

export function buildLearningPrompt({ action, card, question, detailed, history, evidence }: {
  action: "learn" | "question";
  card: unknown;
  question?: string;
  detailed?: boolean;
  history?: unknown[];
  evidence: unknown[];
}) {
  const asking = action === "question";
  return buildPrompt(action, [
    ...(asking ? instructions.questionEvidence : instructions.learningEvidence),
    ...(asking ? [detailed ? "Answer in approximately 150 to 250 words." : "Answer in 2 to 4 sentences."] : [])
  ], [
    { label: "Original user query", value: asking ? question : undefined },
    { label: asking ? "Supporting card context" : "Card", value: card },
    { label: "Previous conversation (context only)", value: asking ? history?.slice(-6) : undefined },
    { label: "Wikipedia evidence", value: evidence }
  ]);
}
