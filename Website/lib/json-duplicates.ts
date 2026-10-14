/** Replace ambiguous objects with null before JSON.parse can discard duplicate keys.
 * Arrays retain their positions, so schema validation can salvage valid siblings.
 */
export function rejectConflictingJsonFields(text: string): string {
  type Frame = { object: boolean; start: number; entry: number; colon: number; values: Map<string, string>; conflict: boolean };
  const stack: Frame[] = [], rejected: Array<[number, number]> = [];
  let quoted = false, escaped = false;
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
    return JSON.stringify(value);
  }
  function retain(frame: Frame, end: number) {
    if (!frame.object || frame.colon < 0) return;
    try {
      const key: unknown = JSON.parse(text.slice(frame.entry, frame.colon));
      if (typeof key !== 'string') return;
      const value = canonical(JSON.parse(text.slice(frame.colon + 1, end)));
      if (frame.values.has(key) && frame.values.get(key) !== value) frame.conflict = true;
      frame.values.set(key, value);
    } catch { /* Incomplete values remain subject to the existing syntax checks. */ }
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    const frame = stack.at(-1);
    if (c === '{' || c === '[') stack.push({object: c === '{', start: i, entry: i + 1, colon: -1, values: new Map(), conflict: false});
    else if (c === ':' && frame?.object && frame.colon < 0) frame.colon = i;
    else if (c === ',' && frame) { retain(frame, i); frame.entry = i + 1; frame.colon = -1; }
    else if ((c === '}' || c === ']') && frame) {
      retain(frame, i); stack.pop();
      if (frame.conflict) rejected.push([frame.start, i + 1]);
    }
  }
  // Prefer the outermost rejected object when conflicts are nested.
  const ranges = rejected.sort(([a], [b]) => a - b);
  let output = '', cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    output += text.slice(cursor, start) + 'null'; cursor = end;
  }
  return output + text.slice(cursor);
}
