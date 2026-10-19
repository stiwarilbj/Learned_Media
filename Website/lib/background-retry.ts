import { performanceFetch, recordPerformance } from "./performance-diagnostics";
// Background transports only. Gemini has its own retry policy.
export function serverRetryAt(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
  const deadline = Number.isFinite(seconds) ? now + seconds * 1_000 : Date.parse(text);
  return Number.isFinite(deadline) ? Math.max(now, deadline) : undefined;
}

export function backgroundRetryDelay(baseMs: number, retryAt = 0): number {
  return Math.max(baseMs, retryAt - Date.now(), 0) + Math.random() * Math.min(baseMs * 0.25, 250);
}

export async function waitForBackgroundRetry(ms: number, signal?: AbortSignal | null): Promise<void> {
  const deadline = Date.now() + ms;
  do {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal?.reason ?? new DOMException('Canceled', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.min(60_000, Math.max(0, deadline - Date.now())));
      signal?.addEventListener('abort', abort, { once: true });
    });
  } while (Date.now() < deadline);
  signal?.throwIfAborted();
}

type Failure = { retryAt: number; recordedAt: number };
const cloudFailures = new Map<string, Failure>();

// Delay later, already-scheduled cloud retries; never replay a write or add an attempt.
export const backgroundCloudFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (!url.pathname.startsWith('/rest/v1/')) return fetch(input, init);
  const key = `${init?.method ?? (input instanceof Request ? input.method : 'GET')} ${url.origin}${url.pathname}`;
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const now = Date.now();
  for (const [id, state] of cloudFailures) if (now - state.recordedAt > 30 * 60_000 && state.retryAt <= now) cloudFailures.delete(id);
  let previous = cloudFailures.get(key);
  const retry = Boolean(previous);
  const queuedAt = performance.now();
  while (previous) {
    await waitForBackgroundRetry(Math.max(0, previous.retryAt - Date.now()) + Math.random() * 250, signal);
    if (cloudFailures.get(key) === previous) break;
    previous = cloudFailures.get(key);
  }
  signal?.throwIfAborted();
  if (retry) { recordPerformance("cloud", "retries"); recordPerformance("cloud", "queue_ms", Math.max(0, performance.now() - queuedAt)); }
  const failed = (header: string | null) => {
    const recordedAt = Date.now();
    const retryAt = Math.max(recordedAt, serverRetryAt(header, recordedAt) ?? 0, cloudFailures.get(key)?.retryAt ?? 0);
    cloudFailures.delete(key);
    // Keep live server deadlines even if that means temporarily exceeding the soft cap.
    if (cloudFailures.size >= 100) {
      const expired = [...cloudFailures].find(([, state]) => state.retryAt <= recordedAt);
      if (expired) cloudFailures.delete(expired[0]);
    }
    cloudFailures.set(key, { retryAt, recordedAt });
  };
  try {
    const response = await performanceFetch("cloud", input, init);
    if ([408, 409, 429].includes(response.status) || response.status >= 500) failed(response.headers.get('retry-after'));
    else if (cloudFailures.get(key) === previous) cloudFailures.delete(key);
    return response;
  } catch (error) {
    if (!signal?.aborted && error instanceof TypeError) failed(null);
    throw error;
  }
};
