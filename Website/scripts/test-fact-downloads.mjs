import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url),
  Module = require("node:module"),
  ts = require("typescript");
Module._extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const d = require("../lib/fact-downloads.ts"),
  e = require("../lib/exports.ts");
const card = {
  id: "one",
  title: "Tōhoku, Gödel and Émilie",
  hook: "A complete hook.",
  body: "The original body stays complete. A hidden sentence survives.",
  topicPath: ["Science", "Earth"],
  sources: [
    { title: "Tōhoku", url: "https://en.wikipedia.org/wiki/T%C5%8Dhoku" },
  ],
  image: {
    url: "https://unused.invalid/image.jpg",
    credit: "Zoë — CC BY",
    sourceUrl: "https://example.org/credit",
  },
  learnMore: "NOT ORIGINAL",
  answer: "NOT ORIGINAL",
};
test("four modes, default and inherited individual formats", () => {
  assert.deepEqual(
    d.DOWNLOAD_MODES.map((m) => m.id),
    ["pdf-single", "txt-single", "pdf-folder", "txt-folder"],
  );
  assert.equal(d.normalizeDownloadMode(null), "pdf-single");
  assert.equal(d.normalizeDownloadMode("docx"), "pdf-single");
  assert.equal(d.downloadFormat("pdf-folder"), "pdf");
  assert.equal(d.downloadFormat("txt-folder"), "txt");
});
test("snapshots isolate arriving cards and edits; text keeps full original only", () => {
  const original = structuredClone(card),
    result = d.snapshotDownloadCards([original]);
  original.body = "changed";
  original.sources[0].title = "changed";
  assert.equal(result[0].body, card.body);
  const text = d.exportText("Workspace", "2026-10-23", result);
  assert.ok(text.includes(card.body));
  assert.ok(text.includes(card.sources[0].url));
  assert.ok(text.includes("Zoë"));
  assert.ok(!text.includes("NOT ORIGINAL"));
});
test("safe, ordered and distinct Unicode filenames", () => {
  const names = [0, 1].map((i) =>
    d.cardDownloadName({ title: "../Tōhoku: Gödel?" }, i, 2, "txt"),
  );
  assert.notEqual(...names);
  assert.ok(names[0].startsWith("001-"));
  assert.ok(!names[0].includes("/"));
  assert.ok(names[0].includes("Tōhoku"));
  assert.equal(d.safeDownloadName("..."), "Learned Media");
});
test("TXT paths never request images, including per-card archives", async () => {
  globalThis.Image = class {
    constructor() {
      throw new Error("TXT must not load images");
    }
  };
  globalThis.fetch = () => {
    throw new Error("TXT must not fetch");
  };
  const cards = [card, { ...card, id: "two" }];
  const single = await e.buildFactExport("txt-single", "Session", cards, {
    date: new Date("2026-10-23"),
  });
  assert.ok((await single.blob.text()).includes("2. Tōhoku"));
  const zip = await e.buildFactExport("txt-folder", "Session", cards, {
    date: new Date("2026-10-23"),
  });
  assert.equal(zip.filename, "Session-facts-2026-10-23.zip");
  const individual = await e.buildFactExport("txt-folder", "Session", [card], {
    individual: true,
  });
  assert.ok(individual.filename.endsWith(".txt"));
  assert.equal(individual.blob.type, "text/plain;charset=utf-8");
});
test("archives use UTF-8, retain ordering, reject invalid sizes and names", () => {
  const bytes = d.buildZip([
    {
      name: "Folder/001-Émilie.txt",
      data: new TextEncoder().encode("complete"),
    },
  ]);
  assert.equal(new DataView(bytes.buffer).getUint16(6, true), 0x800);
  assert.throws(
    () => d.buildZip(Array(65536).fill({ name: "a", data: new Uint8Array() })),
    /Too many/,
  );
  assert.throws(
    () => d.buildZip([{ name: "../unsafe", data: new Uint8Array() }]),
    /Invalid/,
  );
});
test("canceled preparation and empty collections produce no file", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    e.buildFactExport("txt-single", "Session", [card], {
      signal: controller.signal,
    }),
    (error) => error.name === "AbortError",
  );
  await assert.rejects(
    e.buildFactExport("txt-single", "Session", []),
    /no cards/,
  );
});
