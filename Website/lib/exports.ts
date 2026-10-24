import type { FactCard } from "./types";
import {
  buildZip,
  cardDownloadName,
  downloadBaseName,
  downloadFormat,
  exportText,
  snapshotDownloadCards,
  type DownloadMode,
} from "./fact-downloads";
import type { jsPDF } from "jspdf";
export type FactExportFormat = "pdf" | "txt";
export type FactExportResult = {
  blob: Blob;
  filename: string;
  omittedImages: string[];
};
type ImageAsset = { bytes: Uint8Array; width: number; height: number };
type Options = {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  individual?: boolean;
  date?: Date;
};
let fonts: Promise<string[]> | undefined;
function fontData() {
  if (!fonts)
    fonts = Promise.all(
      ["Regular", "Bold"].map(async (weight) => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/fonts/NotoSans-${weight}.ttf`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok)
          throw new Error(
            "PDF fonts could not be loaded. Reconnect and retry.",
          );
        const data = new Uint8Array(await response.arrayBuffer());
        let text = "";
        for (let i = 0; i < data.length; i += 8192)
          text += String.fromCharCode(...data.subarray(i, i + 8192));
        return btoa(text);
      }),
    ).catch((error) => {
      fonts = undefined;
      throw error;
    });
  return fonts;
}
function check(signal?: AbortSignal) {
  signal?.throwIfAborted();
}
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export function canvasImage(
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
  const [{ jsPDF: PDF }, font] = await Promise.all([
    import("jspdf"),
    fontData(),
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
  const text = (value: string, size = 11, bold = false, url?: string) => {
    pdf.setFont("NotoSans", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    for (const paragraph of value.split("\n"))
      for (const line of pdf.splitTextToSize(
        paragraph || " ",
        512,
      ) as string[]) {
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
      }
    y += 6;
  };
  text("LEARNED MEDIA", 20, true);
  text(`Workspace: ${workspace}`);
  text(`Exported: ${date}`);
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
    text(`${i + 1}. ${card.title}`, 16, true);
    text(card.hook, 12, true);
    if (image) {
      const scale = Math.min(512 / image.width, 280 / image.height);
      const width = image.width * scale,
        height = image.height * scale;
      room(height + 12);
      pdf.addImage(image.bytes, "JPEG", 50, y, width, height);
      y += height + 12;
    } else if (card.image?.url) text("Image unavailable in this download.", 9);
    text(card.body);
    text(`Topic path: ${card.topicPath.join(" / ")}`, 9);
    for (const source of card.sources) {
      text(source.title, 10, true, source.url);
      text(source.url, 9, false, source.url);
    }
    if (card.image?.credit) text(`Image credit: ${card.image.credit}`, 9);
    const sourceUrl = card.image?.filePageUrl ?? card.image?.sourceUrl;
    if (sourceUrl) text(sourceUrl, 9, false, sourceUrl);
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
  const cards = snapshotDownloadCards(input);
  if (!cards.length) throw new Error("There are no cards to download.");
  const date = (options.date ?? new Date()).toISOString(),
    format = downloadFormat(mode),
    folder = mode.endsWith("folder") && !options.individual;
  const base = downloadBaseName(workspace, date),
    images = new Map<string, ImageAsset>(),
    omittedImages: string[] = [];
  if (format === "pdf") {
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
            images.set(url, await canvasImage(url, options.signal));
          } catch (error) {
            check(options.signal);
          }
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
  const encode = async (items: FactCard[]) =>
    format === "txt"
      ? new TextEncoder().encode(exportText(workspace, date, items))
      : buildPdf(workspace, date, items, images, options);
  let bytes: Uint8Array;
  if (folder) {
    const entries = [];
    for (let i = 0; i < cards.length; i++) {
      check(options.signal);
      options.onProgress?.(`Preparing cards · ${i + 1} of ${cards.length}`);
      entries.push({
        name: `${base}/${cardDownloadName(cards[i], i, cards.length, format)}`,
        data: await encode([cards[i]]),
      });
      await yieldTask();
    }
    check(options.signal);
    bytes = buildZip(entries);
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
    filename: options.individual
      ? cardDownloadName(cards[0], 0, 1, format)
      : `${base}.${folder ? "zip" : format}`,
    omittedImages,
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
