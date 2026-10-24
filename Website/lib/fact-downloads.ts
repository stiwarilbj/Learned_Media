import type { FactCard, TopicNode } from "./types";
export const DOWNLOAD_MODES = [
  { id: "pdf-single", label: "One PDF file — with pictures" },
  { id: "txt-single", label: "One TXT file — text only" },
  {
    id: "pdf-folder",
    label: "Individual PDF files in a ZIP folder — with pictures",
  },
  {
    id: "txt-folder",
    label: "Individual TXT files in a ZIP folder — text only",
  },
] as const;
export type DownloadMode = (typeof DOWNLOAD_MODES)[number]["id"];
export const DOWNLOAD_PREFERENCE_KEY = "learned-media-download-mode-v1";
export function normalizeDownloadMode(value: unknown): DownloadMode {
  return DOWNLOAD_MODES.some((m) => m.id === value)
    ? (value as DownloadMode)
    : "pdf-single";
}
export function downloadFormat(mode: DownloadMode): "pdf" | "txt" {
  return mode.startsWith("txt") ? "txt" : "pdf";
}
// Leave room for an extension within common 255-byte filesystem components.
const NAME_BYTE_LIMIT = 240;
const nameOrder = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: false,
});
function alphabetical(a: string, b: string) {
  return nameOrder.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}
function byteLength(text: string) {
  return new TextEncoder().encode(text).length;
}
export function safeDownloadName(value: string, maxBytes = NAME_BYTE_LIMIT) {
  let name = value
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, "-")
    .replace(/^[. ]+|[. ]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = "_" + name;
  let result = "",
    size = 0;
  for (const character of name) {
    const bytes = byteLength(character);
    if (size + bytes > maxBytes) break;
    result += character;
    size += bytes;
  }
  return result.replace(/[. ]+$/g, "") || "Cards";
}

// Calculate full subtree selection once, including fully selected parents but
// excluding mixed parents. Return priority order so size trimming drops the
// lowest-priority tags, rather than whichever name happens to sort last.
export function activeDownloadTags(topics: TopicNode[]): string[] {
  const candidates: Array<{ label: string; depth: number }> = [];
  function visit(node: TopicNode, depth: number): boolean {
    let selected = Boolean(node.selected);
    if (node.children?.length) {
      selected = true;
      for (const child of node.children) {
        if (!visit(child, depth + 1)) selected = false;
      }
    }
    const label = node.label.normalize("NFC").trim().replace(/\s+/g, " ");
    if (selected && label) candidates.push({ label, depth });
    return selected;
  }
  topics.forEach((node) => visit(node, 0));
  candidates.sort(
    (a, b) => a.depth - b.depth || alphabetical(a.label, b.label),
  );
  const seen = new Set<string>(),
    names: string[] = [];
  for (const { label } of candidates) {
    const key = label.toLocaleLowerCase("en");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(label);
    if (names.length === 10) break;
  }
  return names;
}

export function downloadBaseName(tags: readonly string[]) {
  const names: string[] = [],
    seen = new Set<string>();
  for (const tag of tags) {
    // Sanitize before joining, without truncating individual names prematurely.
    const name = safeDownloadName(tag, Number.MAX_SAFE_INTEGER),
      key = name.toLocaleLowerCase("en");
    if (!seen.has(key)) {
      names.push(name);
      seen.add(key);
    }
    if (names.length === 10) break;
  }
  const joined = () => [...names].sort(alphabetical).join(", ");
  while (names.length > 1 && byteLength(joined()) > NAME_BYTE_LIMIT)
    names.pop();
  return safeDownloadName(joined());
}
export function cardDownloadName(
  card: Pick<FactCard, "title">,
  index: number,
  total: number,
  format: string,
) {
  const prefix =
    total > 1
      ? `${String(index + 1).padStart(Math.max(3, String(total).length), "0")} - `
      : "";
  return `${prefix}${safeDownloadName(card.title, NAME_BYTE_LIMIT - byteLength(prefix) - format.length - 1)}.${format}`;
}

// This manifest is captured before asynchronous preparation on both platforms.
export function prepareDownloadNames(
  mode: DownloadMode,
  cards: Array<Pick<FactCard, "title">>,
  tags: readonly string[],
  individual = false,
) {
  if (!cards.length) throw new Error("There are no cards to download.");
  const format = downloadFormat(mode);
  const folder = cards.length > 1 && !individual && mode.endsWith("folder");
  const base = downloadBaseName(tags);
  const filename =
    cards.length === 1 || individual
      ? cardDownloadName(cards[0], 0, 1, format)
      : `${base}.${folder ? "zip" : format}`;
  const entries = folder
    ? cards.map(
        (card, index) =>
          `${base}/${cardDownloadName(card, index, cards.length, format)}`,
      )
    : [filename];
  return { format, folder, filename, entries };
}
export function snapshotDownloadCards(cards: FactCard[]): FactCard[] {
  return cards.map(
    (c) =>
      ({
        id: c.id,
        title: c.title,
        hook: c.hook,
        body: c.body,
        topicPath: [...c.topicPath],
        sources: c.sources.map((s) => ({ ...s })),
        image: c.image ? { ...c.image } : undefined,
      }) as FactCard,
  );
}
export function exportText(
  workspaceName: string,
  exportedAt: string,
  cards: FactCard[],
) {
  const lines = [
    "LEARNED MEDIA",
    `Workspace: ${workspaceName}`,
    `Exported: ${exportedAt}`,
    "",
  ];
  cards.forEach((card, index) => {
    lines.push(
      "=".repeat(72),
      `${index + 1}. ${card.title}`,
      `Hook: ${card.hook}`,
      `Fact: ${card.body}`,
      `Topic path: ${card.topicPath.join(" / ")}`,
      "Wikipedia Sources:",
    );
    (card.sources ?? []).forEach((source) =>
      lines.push(`- ${source.title}`, `  ${source.url}`),
    );
    if (card.image?.credit) lines.push(`Image credit: ${card.image.credit}`);
    if (card.image?.filePageUrl ?? card.image?.sourceUrl)
      lines.push(
        `Image source: ${card.image.filePageUrl ?? card.image.sourceUrl}`,
      );
    lines.push("");
  });
  return lines.join("\n");
}
export const MAX_DOWNLOAD_ARCHIVE_BYTES = 512 * 1024 * 1024;
const ZIP_UINT32_MAX = 0xffffffff;
const ZIP_CHUNK_BYTES = 256 * 1024;
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const ZIP_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
type ZipEntrySize = { name: string; byteLength: number };

function validateZipEntryName(name: string) {
  return (
    !name.startsWith("/") &&
    !name.includes("\\") &&
    !name.split("/").includes("..") &&
    !name.split("/").includes("")
  );
}

/** Incrementally check a running archive total without retaining file bytes. */
export function createZipArchiveSizeTracker() {
  let count = 0,
    total = 22,
    centralBytes = 0,
    localBytes = 0;
  return {
    add(entry: ZipEntrySize) {
      if (count >= 65535)
        throw new Error("Too many files for this archive.");
      if (!Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0) {
        throw new Error(
          "Archive exceeds the 512 MB download limit. Download a smaller collection.",
        );
      }
      const nameLength = new TextEncoder().encode(entry.name).length;
      if (!validateZipEntryName(entry.name))
        throw new Error("Invalid download filename.");
      if (nameLength > 65535) {
        throw new Error(
          "Archive exceeds the 512 MB download limit. Download a smaller collection.",
        );
      }
      const nextLocalBytes = localBytes + 30 + nameLength + entry.byteLength,
        nextCentralBytes = centralBytes + 46 + nameLength,
        nextTotal = total + 76 + nameLength * 2 + entry.byteLength;
      if (
        nextTotal > MAX_DOWNLOAD_ARCHIVE_BYTES ||
        nextTotal > ZIP_UINT32_MAX ||
        nextLocalBytes > ZIP_UINT32_MAX ||
        nextCentralBytes > ZIP_UINT32_MAX ||
        entry.byteLength > ZIP_UINT32_MAX
      )
        throw new Error(
          "Archive exceeds the 512 MB download limit. Download a smaller collection.",
        );
      count += 1;
      localBytes = nextLocalBytes;
      centralBytes = nextCentralBytes;
      total = nextTotal;
      return total;
    },
    get totalBytes() {
      return total;
    },
  };
}

/** Check an entire archive up front when all entries are already available. */
export function assertZipArchiveSize(entries: readonly ZipEntrySize[]) {
  const tracker = createZipArchiveSizeTracker();
  for (const entry of entries) tracker.add(entry);
  return tracker.totalBytes;
}

function write16(output: Uint8Array, offset: number, value: number) {
  output[offset] = value & 255;
  output[offset + 1] = (value >>> 8) & 255;
}
function write32(output: Uint8Array, offset: number, value: number) {
  output[offset] = value & 255;
  output[offset + 1] = (value >>> 8) & 255;
  output[offset + 2] = (value >>> 16) & 255;
  output[offset + 3] = (value >>> 24) & 255;
}
function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Download canceled", "AbortError");
}
async function checksum(
  bytes: Uint8Array,
  signal: AbortSignal | undefined,
  progress: (bytes: number) => void,
) {
  let crc = 0xffffffff;
  for (let start = 0; start < bytes.length; start += ZIP_CHUNK_BYTES) {
    checkAbort(signal);
    const end = Math.min(start + ZIP_CHUNK_BYTES, bytes.length);
    for (let index = start; index < end; index += 1) {
      crc = (crc >>> 8) ^ ZIP_CRC_TABLE[(crc ^ bytes[index]) & 0xff];
    }
    progress(end - start);
    if (end < bytes.length) await yieldTask();
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function buildZip(
  entries: Array<{ name: string; data: Uint8Array }>,
  options: {
    signal?: AbortSignal;
    onProgress?: (bytesProcessed: number, totalBytes: number) => void;
  } = {},
) {
  checkAbort(options.signal);
  const total = assertZipArchiveSize(
    entries.map((entry) => ({ name: entry.name, byteLength: entry.data.length })),
  );
  const metadata: Array<{
    name: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }> = [];
  let processed = 0,
    offset = 0;
  let lastReported = 0;
  const output = new Uint8Array(total);
  for (const entry of entries) {
    checkAbort(options.signal);
    const name = new TextEncoder().encode(entry.name);
    const crc = await checksum(entry.data, options.signal, (count) => {
      processed += count;
      if (processed - lastReported >= 1024 * 1024) {
        lastReported = processed;
        options.onProgress?.(processed, total);
      }
    });
    checkAbort(options.signal);
    const start = offset;
    output.set([0x50, 0x4b, 3, 4], offset);
    write16(output, offset + 4, 20);
    write16(output, offset + 6, 0x800);
    write16(output, offset + 8, 0);
    write16(output, offset + 10, 0);
    write16(output, offset + 12, 0);
    write32(output, offset + 14, crc);
    write32(output, offset + 18, entry.data.length);
    write32(output, offset + 22, entry.data.length);
    write16(output, offset + 26, name.length);
    write16(output, offset + 28, 0);
    output.set(name, offset + 30);
    offset += 30 + name.length;
    metadata.push({ name, data: entry.data, crc, offset: start });
    for (let startData = 0; startData < entry.data.length; startData += ZIP_CHUNK_BYTES) {
      checkAbort(options.signal);
      const end = Math.min(startData + ZIP_CHUNK_BYTES, entry.data.length);
      output.set(entry.data.subarray(startData, end), offset);
      offset += end - startData;
      if (end < entry.data.length) await yieldTask();
    }
  }
  checkAbort(options.signal);
  const centralStart = offset;
  let centralSinceYield = 0;
  for (const entry of metadata) {
    checkAbort(options.signal);
    output.set([0x50, 0x4b, 1, 2], offset);
    write16(output, offset + 4, 20);
    write16(output, offset + 6, 20);
    write16(output, offset + 8, 0x800);
    write16(output, offset + 10, 0);
    write16(output, offset + 12, 0);
    write16(output, offset + 14, 0);
    write32(output, offset + 16, entry.crc);
    write32(output, offset + 20, entry.data.length);
    write32(output, offset + 24, entry.data.length);
    write16(output, offset + 28, entry.name.length);
    write16(output, offset + 30, 0);
    write16(output, offset + 32, 0);
    write16(output, offset + 34, 0);
    write16(output, offset + 36, 0);
    write32(output, offset + 38, 0);
    write32(output, offset + 42, entry.offset);
    output.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
    centralSinceYield += 46 + entry.name.length;
    if (centralSinceYield >= ZIP_CHUNK_BYTES * 4) {
      centralSinceYield = 0;
      await yieldTask();
    }
  }
  checkAbort(options.signal);
  const centralLength = offset - centralStart;
  output.set([0x50, 0x4b, 5, 6], offset);
  write16(output, offset + 4, 0);
  write16(output, offset + 6, 0);
  write16(output, offset + 8, entries.length);
  write16(output, offset + 10, entries.length);
  write32(output, offset + 12, centralLength);
  write32(output, offset + 16, centralStart);
  write16(output, offset + 20, 0);
  options.onProgress?.(total, total);
  checkAbort(options.signal);
  return output;
}
