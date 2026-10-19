/** Numeric aggregates only. No event log, identifiers, persistence, or uploads. */
const services = ['gemini', 'youtube', 'wikipedia', 'cloud', 'cache'] as const;
const metrics = ['requests', 'cache_hits', 'cache_misses', 'coalesced', 'queue_ms', 'retries', 'request_bytes', 'response_bytes_reported', 'response_bytes_read'] as const;
export type DiagnosticService = typeof services[number];
export type DiagnosticMetric = typeof metrics[number];
type Counter = { samples: number; total: number; max: number };
const counters = new Map<string, Counter>();
const limit = Number.MAX_SAFE_INTEGER;
const localRuntime = typeof window !== 'undefined' || (typeof self !== 'undefined' && 'importScripts' in globalThis);

export function recordPerformance(service: DiagnosticService, metric: DiagnosticMetric, value = 1) {
  // Runtime allowlists also reject arbitrary strings from JavaScript callers.
  if (!localRuntime || !services.includes(service) || !metrics.includes(metric) || !Number.isFinite(value) || value < 0) return;
  const key = `${service}.${metric}`;
  const sample = Math.min(value, limit);
  const previous = counters.get(key) ?? { samples: 0, total: 0, max: 0 };
  previous.samples = Math.min(limit, previous.samples + 1);
  previous.total = Math.min(limit, previous.total + sample);
  previous.max = Math.max(previous.max, sample);
  counters.set(key, previous);
}

export const performanceDiagnostics = Object.freeze({
  snapshot: () => ({ version: 1, scope: 'current-runtime', counters: Object.fromEntries([...counters].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, { ...value }])) }),
  reset: () => counters.clear()
});

// Count UTF-8 bytes without retaining text or allocating a second payload buffer.
export function diagnosticTextBytes(text: string) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

/** Observe existing fetches; never clone/read responses or add requests. */
export const performanceFetch = async (service: DiagnosticService, input: RequestInfo | URL, init?: RequestInit) => {
  if (!localRuntime) return fetch(input, init);
  recordPerformance(service, 'requests');
  if (typeof init?.body === 'string') recordPerformance(service, 'request_bytes', diagnosticTextBytes(init.body));
  const response = await fetch(input, init);
  const length = response.headers.get('content-length');
  if (length !== null && /^\d+$/.test(length)) recordPerformance(service, 'response_bytes_reported', Number(length));
  return response;
};

if (localRuntime) {
  try { Object.defineProperty(globalThis, 'LearnedMediaDiagnostics', { value: performanceDiagnostics, configurable: true }); } catch { /* An optional inspection hook must not prevent app startup. */ }
}
