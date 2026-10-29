/**
 * Session-only cache for decoded fact-card artwork. Cached bitmaps are resized
 * before retention, so revisiting image-heavy cards cannot grow memory without
 * bound. A mounted card holds a lease; inactive-workspace bitmaps are released
 * as soon as their last mounted card lets go.
 */
import { runBackgroundSlice } from "./background-work";

export type DecodedCardImage = ImageBitmap;

export type DecodedCardImageLease = {
  image: Promise<DecodedCardImage>;
  release: () => void;
};

type CacheEntry = {
  key: string;
  url: string;
  maxDimension: number;
  controller: AbortController;
  image: Promise<DecodedCardImage>;
  bitmap?: DecodedCardImage;
  bytes: number;
  references: number;
  workspaceReferences: Map<string, number>;
  workspaces: Set<string>;
  evictWhenUnused: boolean;
};

type DecodedCardImageCacheOptions = {
  maxEntries?: number;
  maxBytes?: number;
  loader?: (url: string, maxDimension: number, signal: AbortSignal) => Promise<DecodedCardImage>;
};

const DEFAULT_MAX_ENTRIES = 8;
const DEFAULT_MAX_BYTES = 24 * 1024 * 1024;
export const CARD_IMAGE_DECODE_SIZE = 960;

function awaitImageBitmap(pending: Promise<ImageBitmap>, signal: AbortSignal): Promise<ImageBitmap> {
  if (signal.aborted) {
    void pending.then(image => image.close(), () => undefined);
    return Promise.reject(signal.reason ?? new DOMException("Image load canceled.", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      // createImageBitmap has no AbortSignal support. The completion handler
      // below closes a late bitmap instead of retaining a canceled card image.
      reject(signal.reason ?? new DOMException("Image load canceled.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(image => {
      if (settled || signal.aborted) {
        image.close();
        return;
      }
      settled = true;
      cleanup();
      resolve(image);
    }, error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
  });
}

async function decodeImageBitmap(source: ImageBitmapSource, signal: AbortSignal, options?: ImageBitmapOptions) {
  let pending: Promise<ImageBitmap> | undefined;
  // Schedule only the decode start. Decoding is asynchronous and cannot be
  // interrupted by createImageBitmap, so it must not hold the shared CPU queue.
  try {
    await runBackgroundSlice(() => {
      pending = createImageBitmap(source, options);
      // Cancellation can occur after decoding starts but before this scheduled
      // turn is acknowledged. Observe failures immediately in that narrow gap.
      void pending.catch(() => undefined);
    }, { priority: "visible", canPause: true, signal });
  } catch (error) {
    if (pending) void pending.then(image => image.close(), () => undefined);
    throw error;
  }
  if (!pending) throw new Error("Image decoding did not start.");
  return awaitImageBitmap(pending, signal);
}

async function loadDecodedImage(url: string, maxDimension: number, signal: AbortSignal): Promise<DecodedCardImage> {
  if (typeof fetch !== "function" || typeof createImageBitmap !== "function") throw new Error("Decoded image caching is unavailable.");
  const response = await fetch(url, { signal, mode: "cors" });
  if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
  const blob = await response.blob();
  let source: ImageBitmap | undefined;
  try {
    source = await decodeImageBitmap(blob, signal);
  } catch (error) {
    source?.close();
    throw error;
  }
  if (!source) throw new Error("Image decoding returned no bitmap.");
  if (signal.aborted) {
    source.close();
    throw new DOMException("Image load canceled.", "AbortError");
  }
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
  if (scale >= 1) return source;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  let resized: ImageBitmap | undefined;
  try {
    resized = await decodeImageBitmap(source, signal, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
    if (!resized) throw new Error("Image resizing returned no bitmap.");
    if (signal.aborted) {
      resized.close();
      resized = undefined;
      throw new DOMException("Image load canceled.", "AbortError");
    }
    return resized;
  } catch (error) {
    resized?.close();
    throw error;
  } finally {
    source.close();
  }
}

function normalizedImageUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported card image URL.");
  url.hash = "";
  return url.href;
}

export class DecodedCardImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  private readonly loader: (url: string, maxDimension: number, signal: AbortSignal) => Promise<DecodedCardImage>;
  private activeWorkspaceId: string | null = null;
  private cachedBytes = 0;

  constructor(options: DecodedCardImageCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
    this.maxBytes = Math.max(1, Math.floor(options.maxBytes ?? DEFAULT_MAX_BYTES));
    this.loader = options.loader ?? loadDecodedImage;
  }

  setActiveWorkspace(workspaceId: string | null | undefined) {
    const next = workspaceId || null;
    if (this.activeWorkspaceId === next) return;
    this.activeWorkspaceId = next;
    for (const entry of Array.from(this.entries.values())) {
      if (next && entry.workspaces.has(next)) {
        entry.evictWhenUnused = false;
        continue;
      }
      entry.evictWhenUnused = true;
      if (entry.references === 0) this.evict(entry);
    }
    this.trim();
  }

  acquire(workspaceId: string, rawUrl: string, requestedSize = CARD_IMAGE_DECODE_SIZE): DecodedCardImageLease {
    const url = normalizedImageUrl(rawUrl);
    const maxDimension = Math.max(64, Math.min(2_048, Math.floor(requestedSize) || CARD_IMAGE_DECODE_SIZE));
    const key = JSON.stringify([url, maxDimension]);
    let entry = this.entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: CacheEntry = {
        key, url, maxDimension, controller, image: Promise.resolve(undefined as unknown as DecodedCardImage),
        bytes: 0, references: 0, workspaceReferences: new Map(), workspaces: new Set(), evictWhenUnused: false
      };
      created.image = this.loader(url, maxDimension, controller.signal).then(bitmap => {
        if (this.entries.get(key) !== created || controller.signal.aborted) {
          bitmap.close();
          throw new DOMException("Image load canceled.", "AbortError");
        }
        created.bitmap = bitmap;
        created.bytes = bitmap.width * bitmap.height * 4;
        this.cachedBytes += created.bytes;
        this.trim();
        return bitmap;
      }).catch(error => {
        if (this.entries.get(key) === created) this.evict(created);
        throw error;
      });
      entry = created;
      this.entries.set(key, entry);
    } else {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }

    entry.references += 1;
    entry.workspaceReferences.set(workspaceId, (entry.workspaceReferences.get(workspaceId) ?? 0) + 1);
    entry.workspaces.add(workspaceId);
    if (workspaceId === this.activeWorkspaceId) entry.evictWhenUnused = false;

    let released = false;
    return {
      image: entry.image,
      release: () => {
        if (released) return;
        released = true;
        entry!.references = Math.max(0, entry!.references - 1);
        const workspaceCount = entry!.workspaceReferences.get(workspaceId) ?? 0;
        if (workspaceCount <= 1) entry!.workspaceReferences.delete(workspaceId);
        else entry!.workspaceReferences.set(workspaceId, workspaceCount - 1);
        if (entry!.references === 0) {
          if (!entry!.bitmap) {
            entry!.controller.abort();
            this.evict(entry!);
          } else if (entry!.evictWhenUnused) this.evict(entry!);
        }
        this.trim();
      }
    };
  }

  clear() {
    for (const entry of Array.from(this.entries.values())) {
      entry.evictWhenUnused = true;
      if (entry.references === 0) this.evict(entry);
    }
  }

  private evict(entry: CacheEntry) {
    if (this.entries.get(entry.key) !== entry) return;
    this.entries.delete(entry.key);
    if (entry.bitmap) {
      this.cachedBytes = Math.max(0, this.cachedBytes - entry.bytes);
      entry.bitmap.close();
      entry.bitmap = undefined;
    } else entry.controller.abort();
  }

  private trim() {
    while (this.entries.size > this.maxEntries || this.cachedBytes > this.maxBytes) {
      const oldestAvailable = Array.from(this.entries.values()).find(entry => entry.references === 0 && Boolean(entry.bitmap));
      if (!oldestAvailable) return;
      this.evict(oldestAvailable);
    }
  }
}

/** Draw with the same centered `object-fit: cover` framing used by the old img. */
function drawCover(canvas: HTMLCanvasElement, image: DecodedCardImage) {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0, sy = 0, sw = image.width, sh = image.height;
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

/** Mount one lazy canvas backed by the shared bounded cache. */
export function mountDecodedCardImage(canvas: HTMLCanvasElement, workspaceId: string, url: string, onFailure: () => void): () => void {
  let disposed = false;
  let started = false;
  let lease: DecodedCardImageLease | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let intersectionObserver: IntersectionObserver | undefined;
  let loadedImage: DecodedCardImage | undefined;
  let loadGeneration = 0;
  const draw = () => { if (!disposed && loadedImage) drawCover(canvas, loadedImage); };
  const releaseCurrentImage = () => {
    loadGeneration += 1;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    const current = lease;
    lease = undefined;
    loadedImage = undefined;
    started = false;
    if (current) current.release();
    canvas.width = 0;
    canvas.height = 0;
  };
  const fail = () => {
    if (disposed) return;
    disposed = true;
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", draw);
    releaseCurrentImage();
    onFailure();
  };
  const start = () => {
    if (started || disposed) return;
    started = true;
    let currentLease: DecodedCardImageLease;
    try {
      currentLease = decodedCardImageCache.acquire(workspaceId, url, CARD_IMAGE_DECODE_SIZE);
    } catch {
      fail();
      return;
    }
    const currentGeneration = ++loadGeneration;
    lease = currentLease;
    currentLease.image.then(image => {
      if (disposed || lease !== currentLease || currentGeneration !== loadGeneration) return;
      loadedImage = image;
      draw();
      if (typeof ResizeObserver === "function") {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(draw);
        resizeObserver.observe(canvas);
      } else window.addEventListener("resize", draw, { passive: true });
    }).catch(() => {
      if (disposed || lease !== currentLease || currentGeneration !== loadGeneration) return;
      currentLease.release();
      lease = undefined;
      started = false;
      fail();
    });
  };
  if (typeof IntersectionObserver === "function") {
    intersectionObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start();
      else if (started) releaseCurrentImage();
    }, { rootMargin: "200px" });
    intersectionObserver.observe(canvas);
  } else start();
  return () => {
    if (disposed) return;
    disposed = true;
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    window.removeEventListener("resize", draw);
    releaseCurrentImage();
  };
}

export const decodedCardImageCache = new DecodedCardImageCache();
