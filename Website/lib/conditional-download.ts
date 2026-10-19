import { SessionCache } from "./session-cache";

type ValidatedDownload = { body: string; etag?: string; modified?: string };
type ConditionalRequest = { headers: Headers; previous?: ValidatedDownload };

function entityTag(value: string | null | undefined, fromBody = false) {
  if (!value || value.length > 1024) return undefined;
  const tag = value.trim();
  if (/^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(tag)) return tag;
  // YouTube exposes the whole-response ETag in JSON without HTTP quoting.
  if (fromBody && /^[\x21\x23-\x7e]+$/.test(tag)) return `"${tag}"`;
  return undefined;
}

function modificationDate(value: string | null) {
  if (!value || !/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? new Date(date).toUTCString() : undefined;
}

/** Retained bodies are revalidated on every use; this adds no freshness shortcut. */
export class ConditionalDownloadCache {
  private readonly entries = new SessionCache<ValidatedDownload>(100, 24 * 60 * 60 * 1000, 4 * 1024 * 1024);

  prepare(key: string, initial: HeadersInit): ConditionalRequest {
    const headers = new Headers(initial);
    const previous = this.entries.get(key);
    if (previous?.etag) headers.set("If-None-Match", previous.etag);
    else if (previous?.modified) headers.set("If-Modified-Since", previous.modified);
    return { headers, previous };
  }

  /** Call only after parsing and validating the response for this exact request. */
  validated(key: string, headers: Headers, body: string, bodyETag?: string, previous?: ValidatedDownload) {
    const vary = (headers.get("vary") ?? "").toLowerCase().split(",").map(value => value.trim()).filter(Boolean);
    const allowed = ["accept", "accept-encoding", "origin", "x-origin", "referer", "user-agent", "x-goog-api-key"];
    const etag = entityTag(headers.get("etag")) ?? entityTag(bodyETag, true) ?? previous?.etag;
    const modified = modificationDate(headers.get("last-modified")) ?? previous?.modified;
    if (/\bno-store\b/i.test(headers.get("cache-control") ?? "") || vary.some(name => !allowed.includes(name)) || (!etag && !modified)) {
      this.entries.delete(key);
      return;
    }
    this.entries.set(key, { body, etag, modified });
  }

  notModified(key: string, response: Response, previous?: ValidatedDownload) {
    if (response.status !== 304 || !previous) return undefined;
    this.validated(key, response.headers, previous.body, undefined, previous);
    return previous.body;
  }

  discard(key: string) { this.entries.delete(key); }
}
