/** Replace ambiguous objects with null before JSON.parse can discard duplicate keys.
 * Arrays retain their positions, so schema validation can salvage valid siblings.
 */
export function rejectConflictingJsonFields(text: string): string {
  type Value = { start: number; end: number; canonical?: string };
  type Frame = { object: boolean; start: number; entry: number; colon: number; values: Map<string, Value>; conflict: boolean };
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
      const start = frame.colon + 1;
      const previous = frame.values.get(key);
      // Unique fields need only their response offsets. Decode values lazily
      // when the same key repeats, retaining the comparison for later repeats.
      if (!previous) { frame.values.set(key, { start, end }); return; }
      const value = canonical(JSON.parse(text.slice(start, end)));
      let previousValue = previous.canonical;
      if (previousValue === undefined) {
        try { previousValue = canonical(JSON.parse(text.slice(previous.start, previous.end))); }
        catch { /* An earlier malformed value was never eligible for comparison. */ }
      }
      if (previousValue !== undefined && previousValue !== value) frame.conflict = true;
      frame.values.set(key, { start, end, canonical: value });
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
