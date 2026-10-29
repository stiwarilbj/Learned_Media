export type BackgroundCancellation = AbortSignal | (() => void);
export type BackgroundWorkPriority = "interactive" | "visible" | "background";
export type BackgroundWorkOptions = {
  priority?: BackgroundWorkPriority;
  /** Non-pausable work still yields to the event loop, but never waits for idle time. */
  canPause?: boolean;
  signal?: AbortSignal;
};

type WorkItem<T = unknown> = {
  run: (signal?: AbortSignal) => T | Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: BackgroundWorkPriority;
  canPause: boolean;
  queuedAt: number;
  sequence: number;
  signal?: AbortSignal;
  abort?: () => void;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

const PRIORITY: Record<BackgroundWorkPriority, number> = { background: 0, visible: 1, interactive: 2 };
const MAX_SLICE_MS = 4;

function now() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function scheduleWake(item: WorkItem, run: () => void): () => void {
  const browserWindow = typeof window === "undefined" ? undefined : window as IdleWindow;
  if (item.priority === "background" && item.canPause && browserWindow?.requestIdleCallback) {
    const id = browserWindow.requestIdleCallback(() => run(), { timeout: 200 });
    return () => browserWindow.cancelIdleCallback?.(id);
  }
  const timer = setTimeout(run, 0);
  return () => clearTimeout(timer);
}

/**
 * One cooperative slice queue per JavaScript runtime. The page shares this
 * instance across local import/index work; each dedicated worker uses the same
 * policy in its own event loop, where it cannot block page input or painting.
 */
export class LocalWorkScheduler {
  private queue: WorkItem[] = [];
  private sequence = 0;
  private scheduled: WorkItem | null = null;
  private cancelWake: (() => void) | null = null;
  private running = false;

  run<T>(work: (signal?: AbortSignal) => T | Promise<T>, options: BackgroundWorkOptions = {}): Promise<T> {
    const signal = options.signal;
    if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException("Background work canceled.", "AbortError"));
    return new Promise<T>((resolve, reject) => {
      const item: WorkItem = {
        run: work,
        resolve: value => resolve(value as T),
        reject,
        priority: options.priority ?? "background",
        canPause: options.canPause ?? true,
        queuedAt: now(),
        sequence: this.sequence++,
        signal,
      };
      if (signal) {
        item.abort = () => this.cancel(item);
        signal.addEventListener("abort", item.abort, { once: true });
      }
      this.queue.push(item);
      if (this.scheduled && this.effectivePriority(item) > this.effectivePriority(this.scheduled)) {
        const waiting = this.scheduled;
        this.cancelWake?.();
        this.cancelWake = null;
        this.scheduled = null;
        this.queue.push(waiting);
      }
      this.pump();
    });
  }

  private cancel(item: WorkItem) {
    const queuedIndex = this.queue.indexOf(item);
    if (queuedIndex >= 0) this.queue.splice(queuedIndex, 1);
    if (this.scheduled === item) {
      this.cancelWake?.();
      this.cancelWake = null;
      this.scheduled = null;
    }
    item.signal?.removeEventListener("abort", item.abort!);
    item.reject(item.signal?.reason ?? new DOMException("Background work canceled.", "AbortError"));
    this.pump();
  }

  private effectivePriority(item: WorkItem) {
    // Promote a waiting low-priority task gradually so a steady stream of
    // interactive searches cannot starve an import or catalog reconciliation.
    return PRIORITY[item.priority] + Math.floor((now() - item.queuedAt) / 250);
  }

  private bestIndex() {
    let best = 0;
    for (let index = 1; index < this.queue.length; index++) {
      const candidate = this.queue[index], selected = this.queue[best];
      const priorityDelta = this.effectivePriority(candidate) - this.effectivePriority(selected);
      if (priorityDelta > 0 || priorityDelta === 0 && !candidate.canPause && selected.canPause || priorityDelta === 0 && candidate.canPause === selected.canPause && candidate.sequence < selected.sequence) best = index;
    }
    return best;
  }

  private finish(item: WorkItem, result: { ok: true; value: unknown } | { ok: false; error: unknown }) {
    item.signal?.removeEventListener("abort", item.abort!);
    if (!result.ok) item.reject(result.error);
    else if (item.signal?.aborted) item.reject(item.signal.reason ?? new DOMException("Background work canceled.", "AbortError"));
    else item.resolve(result.value);
  }

  private pump() {
    if (this.running || this.scheduled || !this.queue.length) return;
    const item = this.queue.splice(this.bestIndex(), 1)[0];
    this.scheduled = item;
    this.cancelWake = scheduleWake(item, () => {
      if (this.scheduled !== item) return;
      this.scheduled = null;
      this.cancelWake = null;
      if (item.signal?.aborted) {
        this.finish(item, { ok: false, error: item.signal.reason ?? new DOMException("Background work canceled.", "AbortError") });
        this.pump();
        return;
      }
      this.running = true;
      let result: unknown;
      try {
        result = item.run(item.signal);
      } catch (error) {
        this.running = false;
        this.finish(item, { ok: false, error });
        this.pump();
        return;
      }
      Promise.resolve(result).then(
        value => this.finish(item, { ok: true, value }),
        error => this.finish(item, { ok: false, error }),
      ).finally(() => {
        this.running = false;
        this.pump();
      });
    });
  }
}

// Generated helper bundles can contain another copy of this module. Keep a
// symbol-keyed singleton on the realm so page modules still share one queue;
// dedicated workers naturally receive an independent scheduler.
const schedulerRegistryKey = Symbol.for("learned-media.local-work-scheduler.v1");
const schedulerRegistry = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
const registeredScheduler = schedulerRegistry[schedulerRegistryKey] as LocalWorkScheduler | undefined;
const localWorkScheduler = registeredScheduler ?? (schedulerRegistry[schedulerRegistryKey] = new LocalWorkScheduler()) as LocalWorkScheduler;

export function checkBackgroundCancellation(cancellation?: BackgroundCancellation) {
  if (typeof cancellation === "function") cancellation();
  else if (cancellation?.aborted) throw cancellation.reason ?? new DOMException("Background work canceled.", "AbortError");
}

/** Run one bounded synchronous or asynchronous unit through the shared queue. */
export function runBackgroundSlice<T>(work: (signal?: AbortSignal) => T | Promise<T>, options: BackgroundWorkOptions = {}) {
  return localWorkScheduler.run(work, options);
}

/** Yield as a priority-aware scheduler turn, checking cancellation on both sides. */
export async function yieldBackground(cancellation?: BackgroundCancellation, options: Omit<BackgroundWorkOptions, "signal"> = {}) {
  checkBackgroundCancellation(cancellation);
  await runBackgroundSlice(() => undefined, {
    ...options,
    signal: typeof cancellation === "function" ? undefined : cancellation ?? undefined,
  });
  checkBackgroundCancellation(cancellation);
}

/** Bound and prioritize each synchronous iteration slice. */
export async function forEachBackground<T>(
  items: Iterable<T>,
  visit: (item: T, index: number) => void | false,
  cancellation?: BackgroundCancellation,
  options: Omit<BackgroundWorkOptions, "signal"> = {},
) {
  checkBackgroundCancellation(cancellation);
  const iterator = items[Symbol.iterator]();
  let index = 0, finished = false;
  const signal = typeof cancellation === "function" ? undefined : cancellation ?? undefined;
  while (!finished) {
    checkBackgroundCancellation(cancellation);
    finished = await runBackgroundSlice(() => {
      const started = now();
      let count = 0;
      while (count < 1024 && now() - started < MAX_SLICE_MS) {
        checkBackgroundCancellation(cancellation);
        const next = iterator.next();
        if (next.done) return true;
        count += 1;
        if (visit(next.value, index++) === false) return true;
      }
      return false;
    }, { ...options, signal });
  }
  checkBackgroundCancellation(cancellation);
}
