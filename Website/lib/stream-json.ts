/** Incrementally extracts object entries from a named array in a JSON object. */
export class JsonArrayItemStreamParser {
  private buffer = "";
  private cursor = 0;
  private stack: Array<"object" | "array"> = [];
  private inString = false;
  private escaped = false;
  private stringStart = -1;
  private rootKey: string | undefined;
  private pendingRootKey: string | undefined;
  private arrayDepth = 0;
  private itemStart = -1;

  constructor(private readonly property: string) {}

  reset() {
    this.buffer = "";
    this.cursor = 0;
    this.stack = [];
    this.inString = false;
    this.escaped = false;
    this.stringStart = -1;
    this.rootKey = undefined;
    this.pendingRootKey = undefined;
    this.arrayDepth = 0;
    this.itemStart = -1;
  }

  push(fragment: string): Array<Record<string, unknown>> {
    this.buffer += fragment;
    const items: Array<Record<string, unknown>> = [];
    while (this.cursor < this.buffer.length) {
      const index = this.cursor++;
      const char = this.buffer[index];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (char === "\\") this.escaped = true;
        else if (char === '"') {
          this.inString = false;
          if (this.stack.length === 1 && this.stack[0] === "object" && this.arrayDepth === 0 && this.stringStart >= 0) {
            try { this.rootKey = JSON.parse(this.buffer.slice(this.stringStart, index + 1)) as string; }
            catch { this.rootKey = undefined; }
          }
        }
        continue;
      }

      if (char === '"') {
        this.inString = true;
        this.stringStart = index;
        continue;
      }
      if (/\s/.test(char)) continue;
      if (char === ":" && this.stack.length === 1 && this.stack[0] === "object" && this.arrayDepth === 0) {
        this.pendingRootKey = this.rootKey;
        this.rootKey = undefined;
        continue;
      }
      if (char === "{" || char === "[") {
        if (char === "[" && this.pendingRootKey === this.property && this.stack.length === 1 && this.stack[0] === "object") {
          this.arrayDepth = this.stack.length + 1;
          this.pendingRootKey = undefined;
        }
        if (this.arrayDepth > 0 && char === "{" && this.stack.length === this.arrayDepth) this.itemStart = index;
        this.stack.push(char === "{" ? "object" : "array");
        continue;
      }
      if (char === "}" || char === "]") {
        const closing = char === "}" ? "object" : "array";
        if (this.stack.at(-1) !== closing) continue;
        this.stack.pop();
        if (char === "}" && this.arrayDepth > 0 && this.stack.length === this.arrayDepth && this.itemStart >= 0) {
          try {
            const value = JSON.parse(this.buffer.slice(this.itemStart, index + 1)) as unknown;
            if (value && typeof value === "object" && !Array.isArray(value)) items.push(value as Record<string, unknown>);
          } catch { /* The completed outer JSON response remains authoritative. */ }
          this.itemStart = -1;
        }
        if (char === "]" && this.arrayDepth > 0 && this.stack.length + 1 === this.arrayDepth) this.arrayDepth = 0;
        continue;
      }
      if (char === "," && this.stack.length === 1 && this.stack[0] === "object" && this.arrayDepth === 0) {
        this.rootKey = undefined;
        this.pendingRootKey = undefined;
      }
    }
    return items;
  }
}
