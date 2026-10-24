import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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
  assert.ok(names[0].startsWith("001 - "));
  assert.ok(!names[0].includes("/"));
  assert.ok(names[0].includes("Tōhoku"));
  assert.equal(d.safeDownloadName("..."), "Cards");
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
  assert.equal(zip.filename, "Cards.zip");
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

function topic(label, selected = true, children) {
  return { id: label, label, selected, children, expanded: false, weight: 1 };
}
test("selected parents and descendants qualify, mixed parents do not", () => {
  const tree = [
    topic("Science", false, [
      topic("Earth", false, [topic("Quakes"), topic("Volcanoes")]),
    ]),
    topic("History", true, [topic("Rome"), topic("Greece", false)]),
  ];
  assert.deepEqual(d.activeDownloadTags(tree), [
    "Science",
    "Earth",
    "Rome",
    "Quakes",
    "Volcanoes",
  ]);
  assert.equal(
    d.downloadBaseName(d.activeDownloadTags(tree)),
    "Earth, Quakes, Rome, Science, Volcanoes",
  );
});
test("choose ten unique names by depth and alphabetical ties, then alphabetize display", () => {
  const tree = [
    topic("Zoology", true, [topic("A deep child")]),
    ...Array.from({ length: 11 }, (_, i) =>
      topic(`Root ${String(i).padStart(2, "0")}`),
    ),
    topic("ROOT 00"),
  ];
  const tags = d.activeDownloadTags(tree);
  assert.equal(tags.length, 10);
  assert.ok(!tags.includes("A deep child"));
  assert.ok(!tags.includes("Root 10"));
  assert.equal(new Set(tags.map((n) => n.toLowerCase())).size, 10);
  assert.equal(d.downloadBaseName([]), "Cards");
  assert.equal(
    d.downloadBaseName(["Science", "Astronomy", "History"]),
    "Astronomy, History, Science",
  );
  assert.deepEqual(
    d.activeDownloadTags([topic("Écriture"), topic("Écriture")]),
    ["Écriture"],
  );
});
test("long names drop lowest priority tags before Unicode-safe truncation", () => {
  const tags = ["Z".repeat(100), "A".repeat(100), "B".repeat(100)];
  assert.equal(d.downloadBaseName(tags), tags[1] + ", " + tags[0]);
  const long = d.downloadBaseName(["🌍".repeat(100)]);
  assert.equal(new TextEncoder().encode(long).length, 240);
  assert.ok(!long.includes("\uFFFD"));
  const file = d.cardDownloadName({ title: "é".repeat(300) }, 999, 1000, "pdf");
  assert.ok(file.startsWith("1000 - "));
  assert.ok(new TextEncoder().encode(file).length <= 240);
  for (const name of ["../unsafe: name?", "CON", "nul.txt", "...", "A/B"]) {
    const safe = d.safeDownloadName(name);
    assert.ok(!/[\\/:*?"<>|]/.test(safe));
    assert.ok(!/^(con|nul)(\.|$)/i.test(safe));
  }
});
test("all four modes use tag names for batches and unnumbered titles for single cards", () => {
  for (const { id } of d.DOWNLOAD_MODES) {
    const one = d.prepareDownloadNames(id, [card], ["Science"]);
    assert.equal(one.folder, false);
    assert.equal(one.filename, card.title + "." + d.downloadFormat(id));
    assert.deepEqual(one.entries, [one.filename]);
    assert.deepEqual(d.prepareDownloadNames(id, [card], [], true), one);
    const many = d.prepareDownloadNames(
      id,
      [card, card],
      ["Science", "Astronomy"],
    );
    assert.equal(
      many.filename,
      "Astronomy, Science." +
        (id.endsWith("folder") ? "zip" : d.downloadFormat(id)),
    );
    if (many.folder)
      assert.deepEqual(
        many.entries,
        [1, 2].map(
          (n) => `Astronomy, Science/00${n} - ${card.title}.${many.format}`,
        ),
      );
  }
});
test("preparation snapshots tag names and cards before asynchronous work", async () => {
  const tree = [topic("Science")],
    tags = d.activeDownloadTags(tree),
    cards = [structuredClone(card), { ...card, id: "two" }];
  const pending = e.buildFactExport("txt-folder", "Ignored workspace", cards, {
    tagNames: tags,
  });
  tree[0].selected = false;
  tags[0] = "Changed";
  cards[0].title = "Changed";
  const result = await pending;
  assert.equal(result.filename, "Science.zip");
  const text = new TextDecoder().decode(await result.blob.arrayBuffer());
  assert.ok(text.includes("Science/001 - " + card.title + ".txt"));
  assert.ok(!text.includes("Changed"));
  const single = await e.buildFactExport("txt-folder", "Ignored", [card]);
  assert.equal(single.filename, card.title + ".txt");
  assert.equal(single.blob.type, "text/plain;charset=utf-8");
});
test("generated Mac naming matches browser selection and packaging", () => {
  const context = { TextEncoder };
  runInNewContext(
    readFileSync(
      new URL(
        "../../App/Resources/frontend/fact-downloads.js",
        import.meta.url,
      ),
      "utf8",
    ),
    context,
  );
  const native = context.LEARNED_MEDIA_FACT_DOWNLOADS;
  for (const tree of [
    [topic("Science", true, [topic("Earth"), topic("Space")])],
    [topic("Mixed", true, [topic("Écriture"), topic("Other", false)])],
    [],
  ]) {
    const tags = d.activeDownloadTags(tree);
    assert.equal(
      JSON.stringify(native.activeDownloadTags(tree)),
      JSON.stringify(tags),
    );
    for (const { id } of d.DOWNLOAD_MODES)
      for (const cards of [[card], [card, card]]) {
        assert.equal(
          JSON.stringify(native.prepareDownloadNames(id, cards, tags)),
          JSON.stringify(d.prepareDownloadNames(id, cards, tags)),
        );
      }
  }
});
