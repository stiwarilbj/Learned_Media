declare const monotonicDeadlineBrand: unique symbol;
export type MonotonicDeadlineMs = number & { readonly [monotonicDeadlineBrand]: true };

export function monotonicDeadlineAfter(delayMs: number, monotonicNow = performance.now()): MonotonicDeadlineMs {
  return (monotonicNow + Math.max(0, Number.isFinite(delayMs) ? delayMs : 0)) as MonotonicDeadlineMs;
}

/** Convert a wall-clock deadline once, so later wall-clock changes cannot move an in-session retry. */
export function monotonicDeadlineFromWallTime(
  wallDeadlineMs: number,
  wallNow = Date.now(),
  monotonicNow = performance.now()
): MonotonicDeadlineMs {
  return monotonicDeadlineAfter(wallDeadlineMs - wallNow, monotonicNow);
}

export function remainingMonotonicMs(deadline: MonotonicDeadlineMs, monotonicNow = performance.now()): number {
  return Math.max(0, deadline - monotonicNow);
}

export function maxMonotonicDeadline(...deadlines: MonotonicDeadlineMs[]): MonotonicDeadlineMs {
  return Math.max(...deadlines) as MonotonicDeadlineMs;
}

export function transientRetryDelayMs(failureCount: number, retryAfterMs = 0) {
  const steppedDelay = [2_000, 4_000, 8_000][Math.min(Math.max(0, failureCount - 1), 2)];
  return Math.max(steppedDelay, retryAfterMs);
}
