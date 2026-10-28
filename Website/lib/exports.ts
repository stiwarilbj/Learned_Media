import type { FactCard } from "./types";
import {
  buildZip,
  createZipArchiveSizeTracker,
  prepareDownloadNames,
  exportText,
  snapshotDownloadCards,
  type DownloadMode,
} from "./fact-downloads";
import type { jsPDF } from "jspdf";
export type FactExportFormat = "pdf" | "txt";
export type FactExportResult = {
  blob: Blob;
  filename: string;
  format: FactExportFormat;
  omittedImages: string[];
  cardCount: number;
};
type ImageAsset = { bytes: Uint8Array; width: number; height: number };
type Options = {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  individual?: boolean;
  date?: Date;
  tagNames?: readonly string[];
};
export function* splitPdfText(value: string, chunkSize = 8192) {
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + chunkSize, value.length);
    if (end < value.length) {
      const boundary = value.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(chunkSize / 2)) end = boundary + 1;
    }
    if (
      end < value.length &&
      end > start &&
      value.charCodeAt(end - 1) >= 0xd800 &&
      value.charCodeAt(end - 1) <= 0xdbff &&
      value.charCodeAt(end) >= 0xdc00 &&
      value.charCodeAt(end) <= 0xdfff
    )
      end -= 1;
    if (end <= start) end = Math.min(start + 2, value.length);
    yield value.slice(start, end);
    start = end;
  }
}
type FontWeight = "Regular" | "Bold";
type FontFlight = {
  controller: AbortController;
  promise: Promise<string>;
  subscribers: number;
  settled: boolean;
  timeout: ReturnType<typeof setTimeout>;
};
const FONT_ASSET_VERSION = "noto-sans-v1";
const FONT_SHA256_BY_VERSION: Record<typeof FONT_ASSET_VERSION, Record<FontWeight, string>> = {
  "noto-sans-v1": {
    Regular: "b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5",
    Bold: "c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a",
  },
};
const cachedFonts = new Map<FontWeight, string>();
const fontFlights = new Map<FontWeight, FontFlight>();
function check(signal?: AbortSignal) {
  signal?.throwIfAborted();
}
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  check(signal);
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      cleanup();
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Download canceled", "AbortError"),
      );
    };
    const cleanup = () => signal.removeEventListener("abort", aborted);
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}
function createFontFlight(weight: FontWeight): FontFlight {
  const controller = new AbortController();
  const flight: FontFlight = {
    controller,
    promise: Promise.resolve(""),
    subscribers: 0,
    settled: false,
    timeout: setTimeout(() => {
      controller.abort(
        new DOMException("PDF fonts could not be loaded. Reconnect and retry.", "TimeoutError"),
      );
    }, 20000),
  };
  fontFlights.set(weight, flight);
  flight.promise = Promise.resolve().then(async () => {
      check(controller.signal);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/NotoSans-${weight}.ttf`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error("PDF fonts could not be loaded. Reconnect and retry.");
      const data = new Uint8Array(await response.arrayBuffer());
      check(controller.signal);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
      check(controller.signal);
      const actualHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (actualHash !== FONT_SHA256_BY_VERSION[FONT_ASSET_VERSION][weight])
        throw new Error("A PDF font download was incomplete or invalid. Please retry the download.");
      let text = "";
      for (let i = 0; i < data.length; i += 8192) {
        check(controller.signal);
        text += String.fromCharCode(...data.subarray(i, i + 8192));
        if (i + 8192 < data.length) await yieldTask();
      }
      return btoa(text);
    })
    .then((value) => {
      if (!controller.signal.aborted) cachedFonts.set(weight, value);
      return value;
    })
    .catch((error) => {
      if (!controller.signal.aborted) controller.abort(error);
      throw error;
    })
    .finally(() => {
      flight.settled = true;
      clearTimeout(flight.timeout);
      if (fontFlights.get(weight) === flight) fontFlights.delete(weight);
    });
  // A canceled final subscriber can leave the shared fetch settling after its
  // own wait has already ended. Keep that expected abort from becoming unhandled.
  void flight.promise.catch(() => undefined);
  return flight;
}
async function fontFor(weight: FontWeight, signal?: AbortSignal) {
  check(signal);
  const cached = cachedFonts.get(weight);
  if (cached) return cached;
  const flight = fontFlights.get(weight) ?? createFontFlight(weight);
  flight.subscribers += 1;
  try {
    const value = await waitWithSignal(flight.promise, signal);
    check(signal);
    return value;
  } finally {
    flight.subscribers -= 1;
    if (!flight.settled && flight.subscribers === 0) {
      if (fontFlights.get(weight) === flight) fontFlights.delete(weight);
      flight.controller.abort(new DOMException("Download canceled", "AbortError"));
    }
  }
}
async function fontData(signal?: AbortSignal) {
  check(signal);
  return Promise.all([
    fontFor("Regular", signal),
    fontFor("Bold", signal),
  ]);
}
type ImageFlight = {
  controller: AbortController;
  promise: Promise<ImageAsset>;
  subscribers: number;
  settled: boolean;
};
type CachedImage = { asset: ImageAsset; bytes: number; expiresAt: number; timer: ReturnType<typeof setTimeout> };
const IMAGE_CACHE_LIFETIME_MS = 30_000;
const IMAGE_CACHE_MAX_ENTRIES = 24;
const IMAGE_CACHE_MAX_BYTES = 24 * 1024 * 1024;
const imageFlights = new Map<string, ImageFlight>();
const cachedImages = new Map<string, CachedImage>();
let cachedImageBytes = 0;

function removeCachedImage(url: string, expected?: CachedImage) {
  const current = cachedImages.get(url);
  if (!current || (expected && current !== expected)) return;
  clearTimeout(current.timer);
  cachedImages.delete(url);
  cachedImageBytes -= current.bytes;
}

function cachedImage(url: string) {
  const entry = cachedImages.get(url);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    removeCachedImage(url, entry);
    return undefined;
  }
  // Keep frequently reused image URLs newest in the bounded cache.
  cachedImages.delete(url);
  cachedImages.set(url, entry);
  return entry.asset;
}

function rememberImage(url: string, asset: ImageAsset) {
  const bytes = asset.bytes.byteLength;
  if (!bytes || bytes > IMAGE_CACHE_MAX_BYTES) return;
  removeCachedImage(url);
  while (cachedImages.size >= IMAGE_CACHE_MAX_ENTRIES || cachedImageBytes + bytes > IMAGE_CACHE_MAX_BYTES) {
    const oldest = cachedImages.keys().next().value;
    if (oldest === undefined) return;
    removeCachedImage(oldest);
  }
  const entry = { asset, bytes, expiresAt: Date.now() + IMAGE_CACHE_LIFETIME_MS, timer: undefined as unknown as ReturnType<typeof setTimeout> };
  entry.timer = setTimeout(() => removeCachedImage(url, entry), IMAGE_CACHE_LIFETIME_MS);
  // Avoid holding a Node test process open solely for the browser cache timer.
  (entry.timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  cachedImages.set(url, entry);
  cachedImageBytes += bytes;
}

function createImageFlight(url: string): ImageFlight {
  const controller = new AbortController();
  const flight: ImageFlight = { controller, promise: Promise.resolve({ bytes: new Uint8Array(), width: 0, height: 0 }), subscribers: 0, settled: false };
  imageFlights.set(url, flight);
  flight.promise = Promise.resolve()
    .then(() => loadCanvasImage(url, controller.signal))
    .then((asset) => {
      if (!controller.signal.aborted) rememberImage(url, asset);
      return asset;
    })
    .catch((error) => {
      if (!controller.signal.aborted) controller.abort(error);
      throw error;
    })
    .finally(() => {
      flight.settled = true;
      if (imageFlights.get(url) === flight) imageFlights.delete(url);
    });
  // A last-subscriber cancellation can finish the shared request after its
  // callers have left. Observe that expected rejection independently.
  void flight.promise.catch(() => undefined);
  return flight;
}

/** Share one image preparation across exports while keeping their cancellation independent. */
export async function canvasImage(url: string, signal?: AbortSignal): Promise<ImageAsset> {
  check(signal);
  const cached = cachedImage(url);
  if (cached) return cached;
  const flight = imageFlights.get(url) ?? createImageFlight(url);
  flight.subscribers += 1;
  try {
    const asset = await waitWithSignal(flight.promise, signal);
    check(signal);
    return asset;
  } finally {
    flight.subscribers -= 1;
    if (!flight.settled && flight.subscribers === 0) {
      if (imageFlights.get(url) === flight) imageFlights.delete(url);
      flight.controller.abort(new DOMException("Download canceled", "AbortError"));
    }
  }
}

async function loadCanvasImage(
  url: string,
  signal?: AbortSignal,
): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (error?: unknown, result?: ImageAsset) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      image.onload = image.onerror = null;
      if (error) {
        image.src = "";
        reject(error);
      } else resolve(result!);
    };
    const abort = () =>
      finish(new DOMException("Download canceled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Image timed out")), 12000);
    image.onload = () => {
      try {
        check(signal);
        if (!image.naturalWidth || !image.naturalHeight)
          throw new Error("Invalid image");
        const scale = Math.min(
          1,
          1200 / image.naturalWidth,
          1000 / image.naturalHeight,
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            try {
              if (!blob) throw new Error("Image unavailable");
              check(signal);
              finish(undefined, {
                bytes: new Uint8Array(await blob.arrayBuffer()),
                width: canvas.width,
                height: canvas.height,
              });
            } catch (error) {
              finish(error);
            }
          },
          "image/jpeg",
          0.8,
        );
      } catch (error) {
        finish(error);
      }
    };
    image.onerror = () => finish(new Error("Image unavailable"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else image.src = url;
  });
}
export async function buildPdf(
  workspace: string,
  date: string,
  cards: FactCard[],
  images: Map<string, ImageAsset>,
  options: Options = {},
): Promise<Uint8Array> {
  check(options.signal);
  const [{ jsPDF: PDF }, font] = await Promise.all([
    waitWithSignal(import("jspdf"), options.signal),
    fontData(options.signal),
  ]);
  check(options.signal);
  const pdf: jsPDF = new PDF({ unit: "pt", format: "letter", compress: true });
  ["normal", "bold"].forEach((style, i) => {
    pdf.addFileToVFS(`NotoSans-${style}.ttf`, font[i]);
    pdf.addFont(`NotoSans-${style}.ttf`, "NotoSans", style);
  });
  pdf.setProperties({
    title: `${workspace} — Learned Media`,
    creator: "Learned Media",
  });
  pdf.setFont("NotoSans");
  let y = 50;
  const room = (height: number) => {
    if (y + height > 740) {
      pdf.addPage();
      y = 50;
    }
  };
  const text = async (value: string, size = 11, bold = false, url?: string) => {
    pdf.setFont("NotoSans", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    let renderedLines = 0;
    for (const paragraph of value.split("\n")) {
      check(options.signal);
      const content = paragraph || " ";
      for (const chunk of splitPdfText(content)) {
        check(options.signal);
        const lines = pdf.splitTextToSize(chunk, 512) as string[];
        for (const line of lines) {
          check(options.signal);
          room(size * 1.5);
          pdf.text(line, 50, y);
          if (url)
            pdf.link(
              50,
              y - size,
              Math.min(512, pdf.getTextWidth(line)),
              size * 1.4,
              { url },
            );
          y += size * 1.5;
          renderedLines += 1;
          if (renderedLines % 32 === 0) await yieldTask();
        }
        await yieldTask();
      }
    }
    y += 6;
  };
  await text("LEARNED MEDIA", 20, true);
  await text(`Workspace: ${workspace}`);
  await text(`Exported: ${date}`);
  for (let i = 0; i < cards.length; i++) {
    check(options.signal);
    const card = cards[i];
    const image = card.image?.url ? images.get(card.image.url) : undefined;
    pdf.setFont("NotoSans", "bold");
    pdf.setFontSize(16);
    const titleHeight =
      pdf.splitTextToSize(`${i + 1}. ${card.title}`, 512).length * 24;
    pdf.setFontSize(12);
    const hookHeight = pdf.splitTextToSize(card.hook, 512).length * 18;
    const pictureHeight = image
      ? Math.min(512 / image.width, 280 / image.height) * image.height + 12
      : 0;
    room(Math.min(650, titleHeight + hookHeight + pictureHeight + 50));
    await text(`${i + 1}. ${card.title}`, 16, true);
    await text(card.hook, 12, true);
    if (image) {
      const scale = Math.min(512 / image.width, 280 / image.height);
      const width = image.width * scale,
        height = image.height * scale;
      room(height + 12);
      pdf.addImage(image.bytes, "JPEG", 50, y, width, height);
      y += height + 12;
    } else if (card.image?.url) await text("Image unavailable in this download.", 9);
    await text(card.body);
    await text(`Topic path: ${card.topicPath.join(" / ")}`, 9);
    for (const source of card.sources) {
      await text(source.title, 10, true, source.url);
      await text(source.url, 9, false, source.url);
    }
    if (card.image?.credit) await text(`Image credit: ${card.image.credit}`, 9);
    const sourceUrl = card.image?.filePageUrl ?? card.image?.sourceUrl;
    if (sourceUrl) await text(sourceUrl, 9, false, sourceUrl);
    y += 14;
    if (i % 4 === 0) await yieldTask();
  }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFontSize(9);
    pdf.text(String(page), 50, 770);
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
export async function buildFactExport(
  mode: DownloadMode,
  workspace: string,
  input: FactCard[],
  options: Options = {},
): Promise<FactExportResult> {
  check(options.signal);
  const cards = snapshotDownloadCards(input);
  check(options.signal);
  if (!cards.length) throw new Error("There are no cards to download.");
  const date = (options.date ?? new Date()).toISOString(),
    naming = prepareDownloadNames(
      mode,
      cards,
      options.tagNames ?? [],
      options.individual,
    ),
    { format, folder } = naming;
  const images = new Map<string, ImageAsset>(),
    omittedImages: string[] = [];
  if (format === "pdf") {
    check(options.signal);
    const urls = [
      ...new Set(
        cards.map((c) => c.image?.url).filter((v): v is string => Boolean(v)),
      ),
    ];
    let next = 0,
      done = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, urls.length) }, async () => {
        while (next < urls.length) {
          check(options.signal);
          const url = urls[next++];
          try {
            const image = await canvasImage(url, options.signal);
            check(options.signal);
            images.set(url, image);
          } catch (error) {
            check(options.signal);
          }
          check(options.signal);
          options.onProgress?.(
            `Preparing pictures · ${++done} of ${urls.length}`,
          );
        }
      }),
    );
    cards.forEach((c) => {
      if (c.image?.url && !images.has(c.image.url)) omittedImages.push(c.title);
    });
  }
  const encode = async (items: FactCard[]) => {
    check(options.signal);
    return format === "txt"
      ? new TextEncoder().encode(exportText(workspace, date, items))
      : buildPdf(workspace, date, items, images, options);
  };
  let bytes: Uint8Array;
  if (folder) {
    const entries: Array<{ name: string; data: Uint8Array }> = [];
    const archiveSize = createZipArchiveSizeTracker();
    for (let i = 0; i < cards.length; i++) {
      check(options.signal);
      options.onProgress?.(`Preparing cards · ${i + 1} of ${cards.length}`);
      entries.push({
        name: naming.entries[i],
        data: await encode([cards[i]]),
      });
      archiveSize.add({ name: naming.entries[i], byteLength: entries[i].data.length });
      await yieldTask();
    }
    check(options.signal);
    bytes = await buildZip(entries, {
      signal: options.signal,
      onProgress: (processed, total) => {
        if (processed === total || processed % (1024 * 1024) < 256 * 1024)
          options.onProgress?.(
            `Preparing archive · ${Math.min(100, Math.floor((processed / total) * 100))}%`,
          );
      },
    });
  } else {
    options.onProgress?.(
      `Preparing ${cards.length} card${cards.length === 1 ? "" : "s"}`,
    );
    bytes = await encode(cards);
  }
  check(options.signal);
  return {
    blob: new Blob([bytes as BlobPart], {
      type: folder
        ? "application/zip"
        : format === "pdf"
          ? "application/pdf"
          : "text/plain;charset=utf-8",
    }),
    filename: naming.filename,
    format,
    omittedImages,
    cardCount: cards.length,
  };
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
