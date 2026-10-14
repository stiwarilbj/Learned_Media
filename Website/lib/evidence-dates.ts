import patterns from "./evidence-date-patterns.json";

export type EvidenceDate = { date: string; role: "event" | "publication" | "discovery" | "revision"; at: number };
const matchers = patterns.map(({ role, pattern }) => ({ role: role as EvidenceDate["role"], regex: new RegExp(pattern, "giu") }));

/** Labels describe explicit wording, not certainty. Offsets refer to unchanged UTF-16 source text. */
export function evidenceDates(text: string): EvidenceDate[] {
  const dates: EvidenceDate[] = [];
  const bounded = text.slice(0, 16000);
  for (const { role, regex } of matchers) {
    regex.lastIndex = 0;
    let count = 0;
    for (const match of bounded.matchAll(regex)) {
      // A truncated input boundary cannot establish the end of a date.
      if (text.length > bounded.length && match.index + match[0].length === bounded.length) continue;
      dates.push({ date: match[1], role, at: match.index + match[0].lastIndexOf(match[1]) });
      if (++count >= 24) break;
    }
  }
  return dates.sort((a, b) => a.at - b.at).slice(0, 24);
}

/** Prompt-only annotations: persisted sources, evidence IDs and quotations stay untouched. */
export function annotateEvidenceDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(annotateEvidenceDates);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "dateRoles").map(([key, item]) => [key, annotateEvidenceDates(item)]));
  // Grounding spans use text; learning sources use extract. Never infer roles from titles or years alone.
  const text = typeof record.text === "string" ? record.text : typeof record.extract === "string" ? record.extract : undefined;
  const dates = text ? evidenceDates(text) : [];
  if (dates.length) result.dateRoles = dates;
  return result;
}
