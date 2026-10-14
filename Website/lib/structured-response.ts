import { JsonArrayItemStreamParser } from "./stream-json";

type Schema = Record<string, unknown>;
const setFields = new Set(["evidenceIds", "claimEvidenceIds", "terms", "include", "alternatives", "topics", "related", "equivalents", "wikipediaSearchTitles"]);
function stable(value: unknown): string {
  return JSON.stringify(value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(stable(item))]))
    : Array.isArray(value) ? value.map(item => JSON.parse(stable(item))) : value);
}

/** Repair syntax only outside quoted text; never complete an unfinished value. */
function trailingCommas(text: string) {
  let output = "", quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === ",") {
      let next = i + 1; while (next < text.length && /\s/.test(text[next])) next++;
      if (text[next] === "}" || text[next] === "]") continue;
    }
    output += c;
  }
  return output;
}

function completeFields(text: string) {
  const fields: Record<string, unknown> = {}, counts = new Map<string, number>();
  let depth = 0, quoted = false, escaped = false, stringStart = -1, key: string | undefined, start = -1;
  function retain(end: number) {
    if (key === undefined || start < 0) return;
    try { fields[key] = JSON.parse(text.slice(start, end)); } catch { /* Only complete JSON values are retained. */ }
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') { quoted = false; if (depth === 1 && start < 0) { try { key = JSON.parse(text.slice(stringStart, i + 1)); } catch {} } }
      continue;
    }
    if (c === ":" && depth === 1 && key !== undefined && start < 0) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      let next = i + 1; while (/\s/.test(text[next] ?? "") && next < text.length) next++;
      start = next; continue;
    }
    if (c === '"') { quoted = true; stringStart = i; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 1) retain(i + 1); else if (depth === 0) retain(i); }
    else if (c === "," && depth === 1) { retain(i); key = undefined; start = -1; }
  }
  return {fields, counts};
}

/** Drop invalid fields/items independently. Never invent factual content or evidence. */
export function normalizeStructuredValue(value: unknown, schema: Schema, field = "", root = false): unknown {
  if (schema.type === "INTEGER" && typeof value === "string" && /^(0|[1-9]\d*)$/.test(value.trim()) && Number.isSafeInteger(Number(value))) value = Number(value);
  if (typeof value === "string" && schema.type === "STRING") value = value.trim();
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return undefined;
  switch (schema.type) {
    case "OBJECT": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      const object = value as Record<string, unknown>, clean: Record<string, unknown> = {};
      for (const [key, itemSchema] of Object.entries((schema.properties ?? {}) as Record<string, Schema>)) {
        const item = normalizeStructuredValue(object[key], itemSchema, key);
        if (item !== undefined) clean[key] = item;
      }
      const properties = (schema.properties ?? {}) as Record<string, Schema>;
      const conceptGroup = properties.terms?.type === "ARRAY" || properties.equivalents?.type === "ARRAY";
      if (conceptGroup) {
        const terms = (clean.terms ?? clean.equivalents) as string[] | undefined;
        if (properties.label?.type === "STRING" && clean.label === undefined && terms?.length) clean.label = terms[0];
        if (properties.related?.type === "ARRAY" && clean.related === undefined) clean.related = [];
      }
      if (!root && (schema.required as string[] | undefined)?.some(key => clean[key] === undefined)) return undefined;
      // The provider schema also permits needs_evidence, so grounded content is checked conditionally here.
      if (clean.status === "grounded" && "sentences" in ((schema.properties ?? {}) as Schema) &&
          ["title", "hook", "claim", "sentences", "evidence", "claimEvidenceIds"].some(key => clean[key] === undefined || Array.isArray(clean[key]) && (clean[key] as unknown[]).length === 0)) return undefined;
      return clean;
    }
    case "ARRAY": {
      if (!Array.isArray(value)) return undefined;
      const clean = value.map(item => normalizeStructuredValue(item, (schema.items ?? {}) as Schema)).filter(item => item !== undefined);
      // Identical duplicate slots/references are harmless; conflicting duplicates remain for slot validation.
      return setFields.has(field) || field === "facts" || field === "evidence"
        ? Array.from(new Map(clean.map(item => [stable(item), item])).values()) : clean;
    }
    case "STRING": return typeof value === "string" && value.length ? value : undefined;
    case "INTEGER": return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
    case "NUMBER": return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    case "BOOLEAN": return typeof value === "boolean" ? value : undefined;
    default: return value;
  }
}

export function parseStructuredResponse(raw: string, schema: Schema): Record<string, unknown> {
  const text = trailingCommas(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "").trim());
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch {
    if (!text.startsWith("{")) throw new Error("Malformed structured output");
    const {fields, counts} = completeFields(text);
    for (const [key, itemSchema] of Object.entries((schema.properties ?? {}) as Record<string, Schema>)) {
      if (counts.get(key) !== 1) { delete fields[key]; continue; }
      if (!(key in fields) && itemSchema.type === "ARRAY" && (itemSchema.items as Schema)?.type === "OBJECT") {
        const items = new JsonArrayItemStreamParser(key).push(text);
        if (items.length) fields[key] = items;
      }
    }
    if (!Object.keys(fields).length) throw new Error("Malformed structured output");
    parsed = fields;
  }
  const value = normalizeStructuredValue(parsed, schema, "", true);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed structured output");
  return value as Record<string, unknown>;
}
