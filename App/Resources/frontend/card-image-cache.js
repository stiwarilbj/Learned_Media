// Generated from Website/lib/card-image-cache.ts. Run node Website/scripts/build-native-card-image-cache.mjs.
(function(scope){ const require = () => scope.LEARNED_MEDIA_BACKGROUND; const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodedCardImageCache = exports.DecodedCardImageCache = exports.CARD_IMAGE_DECODE_SIZE = void 0;
exports.cardImagePriorityForBounds = cardImagePriorityForBounds;
exports.mountDecodedCardImage = mountDecodedCardImage;
/**
 * Session-only cache for decoded fact-card artwork. Cached bitmaps are resized
 * before retention, so revisiting image-heavy cards cannot grow memory without
 * bound. A mounted card holds a lease; inactive-workspace bitmaps are released
 * as soon as their last mounted card lets go.
 */
const background_work_1 = require("./background-work");
function cardImagePriorityForBounds(card, viewport, focused = false) {
    if (focused || card.bottom > viewport.top && card.top < viewport.bottom)
        return "visible";
    const height = Math.max(1, viewport.bottom - viewport.top);
    return card.bottom > viewport.top - height && card.top < viewport.bottom + height ? "nearby" : undefined;
}
const DEFAULT_MAX_ENTRIES = 8;
const DEFAULT_MAX_BYTES = 24 * 1024 * 1024;
const MAX_CONCURRENT_CARD_IMAGE_LOADS = 3;
const CARD_IMAGE_RELEASE_GRACE_MS = 100;
exports.CARD_IMAGE_DECODE_SIZE = 960;
function awaitImageBitmap(pending, signal) {
    if (signal.aborted) {
        void pending.then(image => image.close(), () => undefined);
        return Promise.reject(signal.reason ?? new DOMException("Image load canceled.", "AbortError"));
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => signal.removeEventListener("abort", onAbort);
        const onAbort = () => {
            if (settled)
                return;
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
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        });
    });
}
async function decodeImageBitmap(source, signal, priority, options) {
    let pending;
    // Schedule only the decode start. Decoding is asynchronous and cannot be
    // interrupted by createImageBitmap, so it must not hold the shared CPU queue.
    try {
        await (0, background_work_1.runBackgroundSlice)(() => {
            pending = createImageBitmap(source, options);
            // Cancellation can occur after decoding starts but before this scheduled
            // turn is acknowledged. Observe failures immediately in that narrow gap.
            void pending.catch(() => undefined);
        }, { priority: priority() === "visible" ? "visible" : "background", canPause: true, signal });
    }
    catch (error) {
        if (pending)
            void pending.then(image => image.close(), () => undefined);
        throw error;
    }
    if (!pending)
        throw new Error("Image decoding did not start.");
    return awaitImageBitmap(pending, signal);
}
async function loadDecodedImage(url, maxDimension, signal, priority) {
    if (typeof fetch !== "function" || typeof createImageBitmap !== "function")
        throw new Error("Decoded image caching is unavailable.");
    const response = await fetch(url, { signal, mode: "cors" });
    if (!response.ok)
        throw new Error(`Image request failed (${response.status}).`);
    const blob = await response.blob();
    let source;
    try {
        source = await decodeImageBitmap(blob, signal, priority);
    }
    catch (error) {
        source?.close();
        throw error;
    }
    if (!source)
        throw new Error("Image decoding returned no bitmap.");
    if (signal.aborted) {
        source.close();
        throw new DOMException("Image load canceled.", "AbortError");
    }
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    if (scale >= 1)
        return source;
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    let resized;
    try {
        resized = await decodeImageBitmap(source, signal, priority, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
        if (!resized)
            throw new Error("Image resizing returned no bitmap.");
        if (signal.aborted) {
            resized.close();
            resized = undefined;
            throw new DOMException("Image load canceled.", "AbortError");
        }
        return resized;
    }
    catch (error) {
        resized?.close();
        throw error;
    }
    finally {
        source.close();
    }
}
function normalizedImageUrl(raw) {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("Unsupported card image URL.");
    url.hash = "";
    return url.href;
}
class DecodedCardImageCache {
    entries = new Map();
    pendingLoads = new Set();
    activeLoads = 0;
    nextLoadOrder = 0;
    maxEntries;
    maxBytes;
    loader;
    activeWorkspaceId = null;
    cachedBytes = 0;
    constructor(options = {}) {
        this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
        this.maxBytes = Math.max(1, Math.floor(options.maxBytes ?? DEFAULT_MAX_BYTES));
        this.loader = options.loader ?? loadDecodedImage;
    }
    setActiveWorkspace(workspaceId) {
        const next = workspaceId || null;
        if (this.activeWorkspaceId === next)
            return;
        this.activeWorkspaceId = next;
        for (const entry of Array.from(this.entries.values())) {
            if (next && entry.workspaces.has(next)) {
                entry.evictWhenUnused = false;
                continue;
            }
            entry.evictWhenUnused = true;
            if (entry.references === 0)
                this.evict(entry);
        }
        this.trim();
    }
    acquire(workspaceId, rawUrl, requestedSize = exports.CARD_IMAGE_DECODE_SIZE, priority = "nearby") {
        const url = normalizedImageUrl(rawUrl);
        const maxDimension = Math.max(64, Math.min(2_048, Math.floor(requestedSize) || exports.CARD_IMAGE_DECODE_SIZE));
        const key = JSON.stringify([url, maxDimension]);
        let entry = this.entries.get(key);
        if (!entry) {
            const controller = new AbortController();
            let resolveImage;
            let rejectImage;
            const image = new Promise((resolve, reject) => { resolveImage = resolve; rejectImage = reject; });
            const created = {
                key, url, maxDimension, controller, image, resolveImage, rejectImage, state: "queued", order: this.nextLoadOrder++,
                bytes: 0, references: 0, workspaceReferences: new Map(), workspaces: new Set(), visibleReferences: 0, evictWhenUnused: false
            };
            entry = created;
            this.entries.set(key, entry);
            this.pendingLoads.add(created);
        }
        else {
            this.entries.delete(key);
            this.entries.set(key, entry);
        }
        entry.references += 1;
        if (entry.releaseTimer !== undefined) {
            clearTimeout(entry.releaseTimer);
            entry.releaseTimer = undefined;
        }
        if (entry.state === "queued" && !this.pendingLoads.has(entry))
            this.pendingLoads.add(entry);
        let leasePriority = priority;
        if (leasePriority === "visible")
            entry.visibleReferences += 1;
        entry.workspaceReferences.set(workspaceId, (entry.workspaceReferences.get(workspaceId) ?? 0) + 1);
        entry.workspaces.add(workspaceId);
        if (workspaceId === this.activeWorkspaceId)
            entry.evictWhenUnused = false;
        this.pumpLoads();
        let released = false;
        return {
            image: entry.image,
            setPriority: nextPriority => {
                if (released || nextPriority === leasePriority)
                    return;
                if (leasePriority === "visible")
                    entry.visibleReferences = Math.max(0, entry.visibleReferences - 1);
                leasePriority = nextPriority;
                if (leasePriority === "visible")
                    entry.visibleReferences += 1;
                this.pumpLoads();
            },
            release: () => {
                if (released)
                    return;
                released = true;
                if (leasePriority === "visible")
                    entry.visibleReferences = Math.max(0, entry.visibleReferences - 1);
                entry.references = Math.max(0, entry.references - 1);
                const workspaceCount = entry.workspaceReferences.get(workspaceId) ?? 0;
                if (workspaceCount <= 1)
                    entry.workspaceReferences.delete(workspaceId);
                else
                    entry.workspaceReferences.set(workspaceId, workspaceCount - 1);
                if (entry.references === 0) {
                    if (!entry.bitmap) {
                        this.pendingLoads.delete(entry);
                        if (entry.releaseTimer === undefined) {
                            // Native rerenders replace card DOM synchronously and remount its
                            // canvas on the next observer turn. Briefly retain the lease so
                            // that redraws do not restart the same queued thumbnail request.
                            entry.releaseTimer = setTimeout(() => {
                                entry.releaseTimer = undefined;
                                if (entry.references !== 0 || this.entries.get(entry.key) !== entry || entry.bitmap)
                                    return;
                                entry.controller.abort();
                                this.evict(entry);
                            }, CARD_IMAGE_RELEASE_GRACE_MS);
                        }
                    }
                    else if (entry.evictWhenUnused)
                        this.evict(entry);
                }
                this.trim();
            }
        };
    }
    clear() {
        for (const entry of Array.from(this.entries.values())) {
            entry.evictWhenUnused = true;
            if (entry.references === 0)
                this.evict(entry);
        }
    }
    evict(entry) {
        if (this.entries.get(entry.key) !== entry)
            return;
        if (entry.releaseTimer !== undefined)
            clearTimeout(entry.releaseTimer);
        entry.releaseTimer = undefined;
        this.entries.delete(entry.key);
        this.pendingLoads.delete(entry);
        if (entry.bitmap) {
            this.cachedBytes = Math.max(0, this.cachedBytes - entry.bytes);
            entry.bitmap.close();
            entry.bitmap = undefined;
        }
        else {
            entry.controller.abort();
            if (entry.state === "queued")
                entry.rejectImage(new DOMException("Image load canceled.", "AbortError"));
        }
        this.pumpLoads();
    }
    pumpLoads() {
        while (this.activeLoads < MAX_CONCURRENT_CARD_IMAGE_LOADS && this.pendingLoads.size) {
            let selected;
            for (const candidate of this.pendingLoads) {
                if (!selected || candidate.visibleReferences > selected.visibleReferences
                    || candidate.visibleReferences === selected.visibleReferences && candidate.order < selected.order)
                    selected = candidate;
            }
            if (!selected)
                return;
            this.pendingLoads.delete(selected);
            if (this.entries.get(selected.key) !== selected || selected.controller.signal.aborted || selected.references === 0)
                continue;
            selected.state = "loading";
            this.activeLoads += 1;
            const entry = selected;
            void Promise.resolve().then(() => this.loader(entry.url, entry.maxDimension, entry.controller.signal, () => entry.visibleReferences > 0 ? "visible" : "nearby")).then(bitmap => {
                if (this.entries.get(entry.key) !== entry || entry.controller.signal.aborted) {
                    bitmap.close();
                    throw new DOMException("Image load canceled.", "AbortError");
                }
                entry.bitmap = bitmap;
                entry.state = "ready";
                entry.bytes = bitmap.width * bitmap.height * 4;
                this.cachedBytes += entry.bytes;
                this.trim();
                entry.resolveImage(bitmap);
            }).catch(error => {
                if (this.entries.get(entry.key) === entry)
                    this.evict(entry);
                entry.rejectImage(error);
            }).finally(() => {
                this.activeLoads = Math.max(0, this.activeLoads - 1);
                this.pumpLoads();
            });
        }
    }
    trim() {
        while (this.entries.size > this.maxEntries || this.cachedBytes > this.maxBytes) {
            const oldestAvailable = Array.from(this.entries.values()).find(entry => entry.references === 0 && Boolean(entry.bitmap));
            if (!oldestAvailable)
                return;
            this.evict(oldestAvailable);
        }
    }
}
exports.DecodedCardImageCache = DecodedCardImageCache;
/** Draw with the same centered `object-fit: cover` framing used by the old img. */
function drawCover(canvas, image) {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0)
        return;
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
    }
    else {
        sh = image.width / targetRatio;
        sy = (image.height - sh) / 2;
    }
    const context = canvas.getContext("2d");
    if (!context)
        return;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}
/** Mount one lazy canvas backed by the shared bounded cache. */
function mountDecodedCardImage(canvas, workspaceId, url, onFailure) {
    let disposed = false;
    let started = false;
    let lease;
    let resizeObserver;
    let intersectionObserver;
    let visibilityObserver;
    let fallbackRoot = null;
    let loadedImage;
    let loadGeneration = 0;
    let priority = "nearby";
    const draw = () => { if (!disposed && loadedImage)
        drawCover(canvas, loadedImage); };
    const releaseCurrentImage = () => {
        loadGeneration += 1;
        resizeObserver?.disconnect();
        resizeObserver = undefined;
        const current = lease;
        lease = undefined;
        loadedImage = undefined;
        started = false;
        if (current)
            current.release();
        canvas.width = 0;
        canvas.height = 0;
    };
    const fail = () => {
        if (disposed)
            return;
        disposed = true;
        intersectionObserver?.disconnect();
        visibilityObserver?.disconnect();
        resizeObserver?.disconnect();
        window.removeEventListener("resize", draw);
        window.removeEventListener("scroll", refreshFallbackPriority, true);
        window.removeEventListener("resize", refreshFallbackPriority);
        releaseCurrentImage();
        onFailure();
    };
    const start = () => {
        if (started || disposed)
            return;
        started = true;
        let currentLease;
        try {
            currentLease = exports.decodedCardImageCache.acquire(workspaceId, url, exports.CARD_IMAGE_DECODE_SIZE, priority);
        }
        catch {
            fail();
            return;
        }
        const currentGeneration = ++loadGeneration;
        lease = currentLease;
        currentLease.image.then(image => {
            if (disposed || lease !== currentLease || currentGeneration !== loadGeneration)
                return;
            loadedImage = image;
            draw();
            if (typeof ResizeObserver === "function") {
                resizeObserver?.disconnect();
                resizeObserver = new ResizeObserver(draw);
                resizeObserver.observe(canvas);
            }
            else
                window.addEventListener("resize", draw, { passive: true });
        }).catch(() => {
            if (disposed || lease !== currentLease || currentGeneration !== loadGeneration)
                return;
            currentLease.release();
            lease = undefined;
            started = false;
            fail();
        });
    };
    const refreshFallbackPriority = () => {
        if (disposed || typeof IntersectionObserver === "function")
            return;
        const host = document.querySelector(".main-scroll");
        const overflowY = host ? getComputedStyle(host).overflowY : "";
        fallbackRoot = host && (overflowY === "auto" || overflowY === "scroll") ? host : null;
        const viewport = fallbackRoot ? fallbackRoot.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const nextPriority = cardImagePriorityForBounds(canvas.getBoundingClientRect(), viewport, canvas.parentElement?.contains(document.activeElement) ?? false) ?? null;
        if (nextPriority) {
            priority = nextPriority;
            lease?.setPriority(nextPriority);
            start();
        }
        else if (started)
            releaseCurrentImage();
    };
    if (typeof IntersectionObserver === "function") {
        const scrollHost = document.querySelector(".main-scroll");
        const overflowY = scrollHost ? getComputedStyle(scrollHost).overflowY : "";
        const root = scrollHost && (overflowY === "auto" || overflowY === "scroll") ? scrollHost : null;
        const viewport = root ? root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        priority = cardImagePriorityForBounds(canvas.getBoundingClientRect(), viewport, canvas.parentElement?.contains(document.activeElement) ?? false) ?? "nearby";
        intersectionObserver = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting))
                start();
            else if (started)
                releaseCurrentImage();
        }, { root, rootMargin: "100% 0px" });
        visibilityObserver = new IntersectionObserver(entries => {
            const entry = entries.find(item => item.target === canvas);
            if (!entry)
                return;
            priority = entry.isIntersecting ? "visible" : "nearby";
            lease?.setPriority(priority);
        }, { root });
        intersectionObserver.observe(canvas);
        visibilityObserver.observe(canvas);
    }
    else {
        window.addEventListener("scroll", refreshFallbackPriority, { passive: true, capture: true });
        window.addEventListener("resize", refreshFallbackPriority, { passive: true });
        refreshFallbackPriority();
    }
    return () => {
        if (disposed)
            return;
        disposed = true;
        intersectionObserver?.disconnect();
        visibilityObserver?.disconnect();
        resizeObserver?.disconnect();
        window.removeEventListener("resize", draw);
        window.removeEventListener("scroll", refreshFallbackPriority, true);
        window.removeEventListener("resize", refreshFallbackPriority);
        releaseCurrentImage();
    };
}
exports.decodedCardImageCache = new DecodedCardImageCache();

scope.LEARNED_MEDIA_CARD_IMAGE_CACHE = Object.assign(exports, { cache: exports.decodedCardImageCache }); })(globalThis);
