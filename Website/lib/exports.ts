import type { FactCard } from "./types";

export type FactExportFormat = "pdf" | "txt" | "docx";
export type FactExportCollection = "all" | "saved";

export type FactExportResult = {
  blob: Blob;
  filename: string;
  omittedImages: string[];
};

type ImageAsset = { id: string; bytes: Uint8Array; width: number; height: number };
type PreparedFact = FactCard & { exportImage?: ImageAsset };

function xmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] ?? character));
}

function pdfString(value: string) {
  const codeUnits = Array.from(value).map((character) => character.charCodeAt(0));
  return `<FEFF${codeUnits.map((code) => code.toString(16).padStart(4, "0")).join("")}>`;
}

function pdfLiteral(value: string) {
  return `(${value.replace(/[\\()]/g, "\\$&")})`;
}

function wrapText(value: string, maxCharacters: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    if (word.length > maxCharacters) {
      if (line) { lines.push(line); line = ""; }
      for (let index = 0; index < word.length; index += maxCharacters) lines.push(word.slice(index, index + maxCharacters));
      return;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) { lines.push(line); line = word; }
    else line = candidate;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function exportText(workspaceName: string, exportedAt: string, cards: FactCard[]) {
  const lines = [`LEARNED MEDIA`, `Workspace: ${workspaceName}`, `Exported: ${exportedAt}`, ""];
  cards.forEach((card, index) => {
    lines.push("=".repeat(72), `${index + 1}. ${card.title}`, `Hook: ${card.hook}`, `Fact: ${card.body}`, `Topic path: ${card.topicPath.join(" / ")}`, "Wikipedia Sources:");
    (card.sources ?? []).forEach((source) => lines.push(`- ${source.title}`, `  ${source.url}`));
    if (card.image?.credit) lines.push(`Image credit: ${card.image.credit}`);
    if (card.image?.filePageUrl ?? card.image?.sourceUrl) lines.push(`Image source: ${card.image.filePageUrl ?? card.image.sourceUrl}`);
    lines.push("");
  });
  return lines.join("\n");
}

function canvasImage(url: string) {
  return new Promise<ImageAsset>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const width = 1200;
        const height = 675;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawnWidth = image.naturalWidth * scale;
        const drawnHeight = image.naturalHeight * scale;
        context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error("Image could not be exported")); return; }
          resolve({ id: "", bytes: new Uint8Array(await blob.arrayBuffer()), width, height });
        }, "image/jpeg", 0.88);
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = url;
  });
}

async function prepareFacts(cards: FactCard[]) {
  const omittedImages: string[] = [];
  const facts: PreparedFact[] = [];
  for (const card of cards) {
    if (!card.image?.url) { facts.push(card); continue; }
    try {
      const image = await canvasImage(card.image.url);
      image.id = `image-${facts.length + 1}`;
      facts.push({ ...card, exportImage: image });
    } catch {
      omittedImages.push(card.title);
      facts.push(card);
    }
  }
  return { facts, omittedImages };
}

type PdfAnnotation = { x: number; y: number; width: number; height: number; url: string };
type PdfPage = { commands: string[]; annotations: PdfAnnotation[]; images: ImageAsset[]; y: number };

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

function buildPdf(workspaceName: string, exportedAt: string, facts: PreparedFact[]) {
  const pages: PdfPage[] = [{ commands: [], annotations: [], images: [], y: 742 }];
  const margin = 50;
  const lineHeight = (size: number) => size * 1.35;
  const current = () => pages[pages.length - 1];
  const ensure = (height: number) => { if (current().y - height < 55) pages.push({ commands: [], annotations: [], images: [], y: 742 }); };
  const addLine = (text: string, size: 11 | 14 | 20, link?: string) => {
    ensure(lineHeight(size));
    const page = current();
    const y = page.y;
    page.commands.push(`BT /F1 ${size} Tf 0.08 0.16 0.30 rg 1 0 0 1 ${margin} ${y} Tm ${pdfString(text)} Tj ET`);
    if (link) page.annotations.push({ x: margin, y: y - 2, width: Math.min(512, Math.max(20, text.length * 5.4)), height: size + 3, url: link });
    page.y -= lineHeight(size);
  };
  const addBlock = (text: string, size: 11 | 14 | 20, link?: string) => wrapText(text, size === 20 ? 42 : size === 14 ? 58 : 78).forEach((line) => addLine(line, size, link));
  addBlock("LEARNED MEDIA", 20);
  addLine(`Workspace: ${workspaceName}`, 11);
  addLine(`Exported: ${exportedAt}`, 11);
  pages[0].y -= 12;
  facts.forEach((card, index) => {
    ensure(50);
    if (current().commands.length) current().y -= 8;
    addBlock(`${index + 1}. ${card.title}`, 14);
    if (card.exportImage) {
      ensure(178);
      const page = current();
      const height = 150;
      const y = page.y - height;
      const asset = card.exportImage;
      page.images.push(asset);
      page.commands.push(`q 512 ${height} ${margin} ${y} cm /${asset.id} Do Q`);
      page.y = y - 12;
    }
    addBlock(card.hook, 11);
    addBlock(card.body, 11);
    addBlock(`Topic path: ${card.topicPath.join(" / ")}`, 11);
    addLine("Wikipedia Sources", 11);
    card.sources.forEach((source) => { addBlock(source.title, 11, source.url); addBlock(source.url, 11, source.url); });
    if (card.image?.credit) addBlock(`Image credit: ${card.image.credit}`, 11);
    if (card.image?.filePageUrl ?? card.image?.sourceUrl) addBlock(card.image.filePageUrl ?? card.image.sourceUrl, 11, card.image.filePageUrl ?? card.image.sourceUrl);
  });
  pages.forEach((page, index) => page.commands.push(`BT /F1 11 Tf 0.35 0.42 0.55 rg 1 0 0 1 50 30 Tm ${pdfString(`${index + 1} / ${pages.length}`)} Tj ET`));

  let nextObject = 4;
  const imageObjectIds = new Map<ImageAsset, number>();
  pages.flatMap((page) => page.images).forEach((image) => { if (!imageObjectIds.has(image)) imageObjectIds.set(image, nextObject++); });
  const contentIds = pages.map(() => nextObject++);
  const pageIds = pages.map(() => nextObject++);
  const annotationIds = pages.map((page) => page.annotations.map(() => nextObject++));
  const objects = new Map<number, Uint8Array>();
  const encoder = new TextEncoder();
  const textObject = (value: string) => encoder.encode(value);
  pages.forEach((page, index) => {
    const content = `${page.commands.join("\n")}\n`;
    objects.set(contentIds[index], textObject(`<< /Length ${content.length} >>\nstream\n${content}endstream`));
    page.annotations.forEach((annotation, annotationIndex) => objects.set(annotationIds[index][annotationIndex], textObject(`<< /Type /Annot /Subtype /Link /Rect [${annotation.x} ${annotation.y} ${annotation.x + annotation.width} ${annotation.y + annotation.height}] /Border [0 0 0] /A << /S /URI /URI ${pdfLiteral(annotation.url)} >> >>`)));
    const xObjects = Array.from(new Set(page.images)).map((image) => `/${image.id} ${imageObjectIds.get(image)} 0 R`).join(" ");
    const annotations = annotationIds[index].length ? ` /Annots [${annotationIds[index].map((id) => `${id} 0 R`).join(" ")}]` : "";
    objects.set(pageIds[index], textObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>${xObjects ? ` /XObject << ${xObjects} >>` : ""} >> /Contents ${contentIds[index]} 0 R${annotations} >>`));
  });
  imageObjectIds.forEach((objectId, image) => objects.set(objectId, concatBytes([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, encoder.encode("\nendstream")])));
  objects.set(3, textObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  objects.set(2, textObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`));
  objects.set(1, textObject("<< /Type /Catalog /Pages 2 0 R >>"));
  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n%âãÏÓ\n")];
  const offsets: number[] = [0];
  for (let id = 1; id < nextObject; id += 1) {
    offsets[id] = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(encoder.encode(`${id} 0 obj\n`), objects.get(id) ?? encoder.encode("<<>>"), encoder.encode("\nendobj\n"));
  }
  const xrefOffset = parts.reduce((sum, part) => sum + part.length, 0);
  parts.push(encoder.encode(`xref\n0 ${nextObject}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${nextObject} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatBytes(parts);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function littleEndian(value: number) { return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]); }
function shortEndian(value: number) { return new Uint8Array([value & 255, (value >>> 8) & 255]); }

function buildZip(entries: Array<{ name: string; data: Uint8Array }>) {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  entries.forEach((entry) => {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const header = concatBytes([new Uint8Array([0x50, 0x4b, 3, 4]), shortEndian(20), shortEndian(0), shortEndian(0), shortEndian(0), shortEndian(0), littleEndian(crc), littleEndian(entry.data.length), littleEndian(entry.data.length), shortEndian(name.length), shortEndian(0), name]);
    local.push(header, entry.data);
    central.push(concatBytes([new Uint8Array([0x50, 0x4b, 1, 2]), shortEndian(20), shortEndian(20), shortEndian(0), shortEndian(0), shortEndian(0), shortEndian(0), littleEndian(crc), littleEndian(entry.data.length), littleEndian(entry.data.length), shortEndian(name.length), shortEndian(0), shortEndian(0), shortEndian(0), shortEndian(0), littleEndian(0), littleEndian(offset), name]));
    offset += header.length + entry.data.length;
  });
  const centralBytes = central.reduce((sum, item) => sum + item.length, 0);
  const localBytes = local.reduce((sum, item) => sum + item.length, 0);
  const end = concatBytes([new Uint8Array([0x50, 0x4b, 5, 6]), shortEndian(0), shortEndian(0), shortEndian(entries.length), shortEndian(entries.length), littleEndian(centralBytes), littleEndian(localBytes), shortEndian(0)]);
  return concatBytes([...local, ...central, end]);
}

function docxRun(text: string, size: number) {
  return `<w:r><w:rPr><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxParagraph(text: string, size: number, keepNext = false) {
  return `<w:p>${keepNext ? "<w:pPr><w:keepNext/></w:pPr>" : ""}${docxRun(text, size)}</w:p>`;
}

function buildDocx(workspaceName: string, exportedAt: string, facts: PreparedFact[]) {
  const relationships: string[] = [];
  const mediaEntries: Array<{ name: string; data: Uint8Array }> = [];
  let relationshipId = 1;
  const hyperlink = (label: string, url: string) => {
    const id = `rId${relationshipId++}`;
    relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(url)}" TargetMode="External"/>`);
    return `<w:hyperlink r:id="${id}">${docxRun(label, 11)}</w:hyperlink>`;
  };
  const paragraphs: string[] = [docxParagraph("LEARNED MEDIA", 20, true), docxParagraph(`Workspace: ${workspaceName}`, 11), docxParagraph(`Exported: ${exportedAt}`, 11)];
  facts.forEach((card, index) => {
    if (index) paragraphs.push("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>");
    paragraphs.push(docxParagraph(`${index + 1}. ${card.title}`, 14, true));
    if (card.exportImage) {
      const id = `rId${relationshipId++}`;
      relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${card.exportImage.id}.jpg"/>`);
      mediaEntries.push({ name: `word/media/${card.exportImage.id}.jpg`, data: card.exportImage.bytes });
      paragraphs.push(`<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="5486400" cy="3086100"/><wp:docPr id="${index + 1}" name="Fact image"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${index + 1}" name="${xmlEscape(card.title)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
    }
    paragraphs.push(docxParagraph(card.hook, 11), docxParagraph(card.body, 11), docxParagraph(`Topic path: ${card.topicPath.join(" / ")}`, 11), docxParagraph("Wikipedia Sources", 11, true));
    card.sources.forEach((source) => { paragraphs.push(`<w:p>${hyperlink(source.title, source.url)}</w:p>`, `<w:p>${hyperlink(source.url, source.url)}</w:p>`); });
    if (card.image?.credit) paragraphs.push(docxParagraph(`Image credit: ${card.image.credit}`, 11));
    if (card.image?.filePageUrl ?? card.image?.sourceUrl) paragraphs.push(`<w:p>${hyperlink(card.image.filePageUrl ?? card.image.sourceUrl, card.image.filePageUrl ?? card.image.sourceUrl)}</w:p>`);
  });
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paragraphs.join("")}<w:sectPr><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style></w:styles>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const utf8 = (text: string) => new TextEncoder().encode(text);
  return buildZip([{ name: "[Content_Types].xml", data: utf8(contentTypes) }, { name: "_rels/.rels", data: utf8(rootRels) }, { name: "word/document.xml", data: utf8(documentXml) }, { name: "word/styles.xml", data: utf8(stylesXml) }, { name: "word/_rels/document.xml.rels", data: utf8(relsXml) }, ...mediaEntries]);
}

export async function buildFactExport(format: FactExportFormat, workspaceName: string, cards: FactCard[]): Promise<FactExportResult> {
  const exportedAt = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const { facts, omittedImages } = await prepareFacts(cards);
  const safeName = workspaceName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  if (format === "txt") return { blob: new Blob([exportText(workspaceName, exportedAt, facts)], { type: "text/plain;charset=utf-8" }), filename: `${safeName}-facts.txt`, omittedImages };
  if (format === "pdf") return { blob: new Blob([buildPdf(workspaceName, exportedAt, facts)], { type: "application/pdf" }), filename: `${safeName}-facts.pdf`, omittedImages };
  return { blob: new Blob([buildDocx(workspaceName, exportedAt, facts)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), filename: `${safeName}-facts.docx`, omittedImages };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
