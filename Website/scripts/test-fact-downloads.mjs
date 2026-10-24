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
function freshExports() {
  delete require.cache[require.resolve("../lib/exports.ts")];
  return require("../lib/exports.ts");
}
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
test("download feedback reflects format and unavailable pictures", () => {
  assert.equal(d.downloadContentsSummary("txt", 0), "text and sources included");
  assert.equal(d.downloadContentsSummary("pdf", 0), "all available pictures and sources included");
  assert.equal(d.downloadContentsSummary("txt", 1), "1 picture unavailable; all text and sources retained");
  assert.equal(d.downloadContentsSummary("pdf", 3), "3 pictures unavailable; all text and sources retained");
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
  assert.equal(single.format, "txt");
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
test("archives use UTF-8, retain ordering, reject invalid sizes and names", async () => {
  const bytes = await d.buildZip([
    {
      name: "Folder/001-Émilie.txt",
      data: new TextEncoder().encode("complete"),
    },
  ]);
  const zipView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(zipView.getUint16(6, true), 0x800);
  assert.equal(zipView.getUint32(14, true), 0x4267d023);
  const firstData = 30 + new TextEncoder().encode("Folder/001-Émilie.txt").length;
  assert.equal(new TextDecoder().decode(bytes.subarray(firstData, firstData + 8)), "complete");
  assert.equal(bytes[bytes.length - 22], 0x50);
  assert.equal(bytes[bytes.length - 21], 0x4b);
  await assert.rejects(
    d.buildZip(Array(65536).fill({ name: "a", data: new Uint8Array() })),
    /Too many/,
  );
  await assert.rejects(
    d.buildZip([{ name: "../unsafe", data: new Uint8Array() }]),
    /Invalid/,
  );
  assert.throws(
    () => d.assertZipArchiveSize([
      { name: "large.bin", byteLength: 512 * 1024 * 1024 },
    ]),
    /512 MB/,
  );
  const tracker = d.createZipArchiveSizeTracker();
  tracker.add({ name: "Folder/one.txt", byteLength: 8 });
  tracker.add({ name: "Folder/two.txt", byteLength: 6 });
  assert.equal(
    tracker.totalBytes,
    d.assertZipArchiveSize([
      { name: "Folder/one.txt", byteLength: 8 },
      { name: "Folder/two.txt", byteLength: 6 },
    ]),
  );
});

test("PDF text chunks preserve every character and keep surrogate pairs intact", () => {
  const text = `${"word ".repeat(900)}${"x".repeat(8191)}😀 accented Tōhoku`;
  const chunks = [...e.splitPdfText(text)];
  assert.equal(chunks.join(""), text);
  for (const chunk of chunks) {
    const last = chunk.charCodeAt(chunk.length - 1);
    assert.ok(last < 0xd800 || last > 0xdbff, "chunk ended with a high surrogate");
  }
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

test("pre-canceled PDF work performs no font requests", async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("A canceled export must not fetch fonts");
  };
  try {
    await assert.rejects(
      e.buildPdf("Workspace", "2026-10-24", [card], new Map(), {
        signal: controller.signal,
      }),
      (error) => error.name === "AbortError",
    );
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("font waits cancel promptly, coalesce subscribers, and retry after failures", async () => {
  const regular = readFileSync(new URL("../public/fonts/NotoSans-Regular.ttf", import.meta.url));
  const bold = readFileSync(new URL("../public/fonts/NotoSans-Bold.ttf", import.meta.url));
  const previousFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async (_url, { signal } = {}) => {
      requests += 1;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 80);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        }, { once: true });
      });
      return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    };
    const canceled = new AbortController();
    const canceledBuild = e.buildPdf("Workspace", "2026-10-24", [card], new Map(), { signal: canceled.signal });
    setTimeout(() => canceled.abort(), 5);
    await assert.rejects(canceledBuild, (error) => error.name === "AbortError");
    assert.equal(requests, 2);

    requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return { ok: false };
    };
    await assert.rejects(
      e.buildPdf("Workspace", "2026-10-24", [card], new Map()),
      /PDF fonts could not be loaded/,
    );
    assert.equal(requests, 2);

    requests = 0;
    globalThis.fetch = async (url, { signal } = {}) => {
      requests += 1;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 40);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        }, { once: true });
      });
      const bytes = String(url).includes("Bold") ? bold : regular;
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    };
    const one = new AbortController(), two = new AbortController();
    const first = e.buildPdf("Workspace", "2026-10-24", [card], new Map(), { signal: one.signal });
    const second = e.buildPdf("Workspace", "2026-10-24", [card], new Map(), { signal: two.signal });
    setTimeout(() => one.abort(), 5);
    const [firstResult, secondResult] = await Promise.allSettled([first, second]);
    assert.equal(firstResult.status, "rejected");
    assert.equal(firstResult.reason.name, "AbortError");
    assert.equal(secondResult.status, "fulfilled");
    assert.equal(requests, 2);
    assert.ok(secondResult.value.length > 1000);

    const renderController = new AbortController();
    const longCard = {
      ...card,
      body: "A long original sentence stays intact. ".repeat(100000),
    };
    const rendering = e.buildPdf("Workspace", "2026-10-24", [longCard], new Map(), {
      signal: renderController.signal,
    });
    setTimeout(() => renderController.abort(), 0);
    await assert.rejects(rendering, (error) => error.name === "AbortError");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("PDF fonts reject corrupt successful responses and retry only the missing font", async () => {
  const regular = readFileSync(new URL("../public/fonts/NotoSans-Regular.ttf", import.meta.url));
  const bold = readFileSync(new URL("../public/fonts/NotoSans-Bold.ttf", import.meta.url));
  const previousFetch = globalThis.fetch;
  const asBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const counts = { regular: 0, bold: 0 };
  try {
    let module = freshExports();
    globalThis.fetch = async (url) => {
      const isBold = String(url).includes("Bold");
      counts[isBold ? "bold" : "regular"] += 1;
      if (isBold && counts.bold === 1)
        return { ok: true, arrayBuffer: async () => asBuffer(new TextEncoder().encode("<html>proxy error</html>")) };
      const bytes = isBold ? bold : regular;
      return { ok: true, arrayBuffer: async () => asBuffer(bytes) };
    };
    await assert.rejects(
      module.buildPdf("Workspace", "2026-10-24", [card], new Map()),
      /PDF font download was incomplete or invalid/,
    );
    assert.deepEqual(counts, { regular: 1, bold: 1 });
    const recovered = await module.buildPdf("Workspace", "2026-10-24", [card], new Map());
    assert.ok(recovered.length > 1000);
    assert.deepEqual(counts, { regular: 1, bold: 2 }, "the already validated font remains cached");

    module = freshExports();
    counts.regular = 0;
    counts.bold = 0;
    globalThis.fetch = async (url) => {
      const isBold = String(url).includes("Bold");
      counts[isBold ? "bold" : "regular"] += 1;
      if (!isBold && counts.regular === 1) {
        const truncated = regular.subarray(0, 4096);
        return { ok: true, arrayBuffer: async () => asBuffer(truncated) };
      }
      const bytes = isBold ? bold : regular;
      return { ok: true, arrayBuffer: async () => asBuffer(bytes) };
    };
    await assert.rejects(
      module.buildPdf("Workspace", "2026-10-24", [card], new Map()),
      /PDF font download was incomplete or invalid/,
    );
    const retried = await module.buildPdf("Workspace", "2026-10-24", [card], new Map());
    assert.ok(retried.length > 1000);
    assert.deepEqual(counts, { regular: 2, bold: 1 });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("ZIP assembly yields to cancellation and never returns a partial archive", async () => {
  const controller = new AbortController();
  const timerFired = new Promise((resolve) => setTimeout(() => {
    controller.abort();
    resolve(true);
  }, 0));
  const archive = d.buildZip([
    { name: "Cards/large.txt", data: new Uint8Array(8 * 1024 * 1024) },
  ], { signal: controller.signal });
  await timerFired;
  await assert.rejects(archive, (error) => error.name === "AbortError");
});

test("ZIP assembly yields and cancels across thousands of tiny and empty files", async () => {
  const entries = Array.from({ length: 8000 }, (_, index) => ({
    name: `Cards/${String(index + 1).padStart(4, "0")}.txt`,
    data: index % 3 === 0 ? new Uint8Array() : new TextEncoder().encode("small"),
  }));
  const controller = new AbortController();
  const timerFired = new Promise((resolve) => setTimeout(() => {
    controller.abort();
    resolve(true);
  }, 0));
  const canceled = d.buildZip(entries, { signal: controller.signal });
  await timerFired;
  await assert.rejects(canceled, (error) => error.name === "AbortError");

  const archive = await d.buildZip(entries);
  assert.equal(new DataView(archive.buffer, archive.byteOffset + archive.length - 22, 22).getUint16(10, true), 8000);
  assert.equal(new DataView(archive.buffer, archive.byteOffset, archive.byteLength).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(archive.buffer, archive.byteOffset + archive.length - 22, 22).getUint32(0, true), 0x06054b50);
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
