import instructions from "./prompt-instructions.json";

export type PromptOperation = Exclude<keyof typeof instructions, "learningEvidence" | "cardWriting">;
export type PromptField = { label: string; value: unknown; multiline?: boolean };

/** Keep instructions separate from data; never normalize evidence or user text. */
export function buildPrompt(operation: PromptOperation, rules: string[] = [], fields: PromptField[] = []) {
  const uniqueRules = Array.from(new Set([...instructions[operation], ...rules]
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

export const learningEvidenceRules = instructions.learningEvidence;
