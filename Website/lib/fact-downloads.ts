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
function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndian(value: number) {
  return new Uint8Array([
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  ]);
}
function shortEndian(value: number) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

export function buildZip(entries: Array<{ name: string; data: Uint8Array }>) {
  if (entries.length > 65535)
    throw new Error("Too many files for this archive.");
  const total = entries.reduce(
    (sum, e) =>
      sum + e.data.length + new TextEncoder().encode(e.name).length * 2 + 76,
    22,
  );
  if (
    total > 512 * 1024 * 1024 ||
    entries.some((e) => new TextEncoder().encode(e.name).length > 65535)
  )
    throw new Error(
      "Archive exceeds the 512 MB download limit. Download a smaller collection.",
    );
  if (
    entries.some(
      (e) => e.name.startsWith("/") || e.name.split("/").includes(".."),
    )
  )
    throw new Error("Invalid download filename.");
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  entries.forEach((entry) => {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const header = concatBytes([
      new Uint8Array([0x50, 0x4b, 3, 4]),
      shortEndian(20),
      shortEndian(0x800),
      shortEndian(0),
      shortEndian(0),
      shortEndian(0),
      littleEndian(crc),
      littleEndian(entry.data.length),
      littleEndian(entry.data.length),
      shortEndian(name.length),
      shortEndian(0),
      name,
    ]);
    local.push(header, entry.data);
    central.push(
      concatBytes([
        new Uint8Array([0x50, 0x4b, 1, 2]),
        shortEndian(20),
        shortEndian(20),
        shortEndian(0x800),
        shortEndian(0),
        shortEndian(0),
        shortEndian(0),
        littleEndian(crc),
        littleEndian(entry.data.length),
        littleEndian(entry.data.length),
        shortEndian(name.length),
        shortEndian(0),
        shortEndian(0),
        shortEndian(0),
        shortEndian(0),
        littleEndian(0),
        littleEndian(offset),
        name,
      ]),
    );
    offset += header.length + entry.data.length;
  });
  const centralBytes = central.reduce((sum, item) => sum + item.length, 0);
  const localBytes = local.reduce((sum, item) => sum + item.length, 0);
  const end = concatBytes([
    new Uint8Array([0x50, 0x4b, 5, 6]),
    shortEndian(0),
    shortEndian(0),
    shortEndian(entries.length),
    shortEndian(entries.length),
    littleEndian(centralBytes),
    littleEndian(localBytes),
    shortEndian(0),
  ]);
  return concatBytes([...local, ...central, end]);
}
