export type BackgroundCancellation = AbortSignal | (() => void);

export function checkBackgroundCancellation(cancellation?: BackgroundCancellation) {
  if (typeof cancellation === "function") cancellation();
  else if (cancellation?.aborted) throw cancellation.reason ?? new DOMException("Background work canceled.", "AbortError");
}

/** Yield a browser task, rather than a microtask, so input and cancellation run. */
export async function yieldBackground(cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>(resolve => setTimeout(resolve, 0));
  checkBackgroundCancellation(cancellation);
}

/** Bound each synchronous slice by elapsed time and record count. */
export async function forEachBackground<T>(items: Iterable<T>, visit: (item: T, index: number) => void | false, cancellation?: BackgroundCancellation) {
  checkBackgroundCancellation(cancellation);
  let index = 0, count = 0, started = performance.now();
  for (const item of items) {
    if (visit(item, index++) === false) break;
    if (++count >= 1024 || performance.now() - started >= 4) {
      await yieldBackground(cancellation);
      count = 0; started = performance.now();
    }
  }
  checkBackgroundCancellation(cancellation);
}
