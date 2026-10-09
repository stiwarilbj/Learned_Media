export function transientRetryDelayMs(failureCount: number, retryAfterMs = 0) {
  const steppedDelay = [2_000, 4_000, 8_000][Math.min(Math.max(0, failureCount - 1), 2)];
  return Math.max(steppedDelay, retryAfterMs);
}
