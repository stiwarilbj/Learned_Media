import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);

const youtube = require(path.join(root, "lib/youtube.ts"));

test("channel normalization preserves existing accent, punctuation, case, and empty-name rules", () => {
  const normalize = youtube.createChannelNameNormalizer();
  assert.equal(normalize("Café"), "caf");
  assert.equal(normalize("Cafe"), "cafe");
  assert.equal(normalize("Beyoncé"), "beyonc");
  assert.equal(normalize("Beyonce"), "beyonce");
  assert.equal(normalize("O’Connor  Lab"), "oconnor lab");
  assert.equal(normalize("O'Connor Lab"), "oconnor lab");
  assert.equal(normalize(""), "");
});

test("the bounded operation cache normalizes repeated names once and is discarded between imports", () => {
  const calls = new Map();
  const countingNormalize = value => {
    calls.set(value, (calls.get(value) ?? 0) + 1);
    return value.toLowerCase();
  };
  const names = ["Crash Course", "O’Connor Lab", "Café", ""];
  const normalize = youtube.createChannelNameNormalizer(countingNormalize, 8);

  // Repeated names and aliases arriving over many playlist pages share only
  // this import's memoized normalization results.
  for (let page = 0; page < 80; page += 1) {
    for (const name of names) normalize(name);
  }
  assert.deepEqual(Object.fromEntries(calls), Object.fromEntries(names.map(name => [name, 1])));

  const nextImportNormalizer = youtube.createChannelNameNormalizer(countingNormalize, 8);
  nextImportNormalizer(names[0]);
  assert.equal(calls.get(names[0]), 2, "a later import starts with a fresh cache");
});

test("cache capacity stays bounded and evicted strings can be normalized again", () => {
  const calls = new Map();
  const normalize = youtube.createChannelNameNormalizer(value => {
    calls.set(value, (calls.get(value) ?? 0) + 1);
    return value;
  }, 2);

  normalize("A");
  normalize("B");
  normalize("A"); // A remains cached; hits do not refresh the FIFO order.
  normalize("C"); // Evicts A.
  normalize("A");

  assert.equal(calls.get("A"), 2);
  assert.equal(calls.get("B"), 1);
  assert.equal(calls.get("C"), 1);
});

test("channel title aliases match alternate apostrophe spelling without changing ID verification", async () => {
  const requests = [];
  const client = new youtube.YouTubeClient("fixture", async (resource, params) => {
    requests.push({ resource, params });
    if (resource === "search") return { items: [{ id: { channelId: "UC-oconnor" }, snippet: { title: "O'Connor Lab" } }] };
    if (resource === "channels") return { items: [{ id: "UC-oconnor", snippet: { title: "O'Connor Lab" }, contentDetails: { relatedPlaylists: { uploads: "UU-oconnor" } } }] };
    throw new Error(`Unexpected YouTube resource: ${resource}`);
  });

  const channel = await client.resolveChannel({ name: "O’Connor Lab", titleAliases: ["O'Connor Lab"] });
  assert.equal(channel.id, "UC-oconnor");
  assert.deepEqual(requests.map(request => request.resource), ["search", "channels"]);
});

test("a pinned stable channel ID bypasses name search even if a same-name legacy row exists", async () => {
  const requests = [];
  const client = new youtube.YouTubeClient("fixture", async (resource, params) => {
    requests.push({ resource, params });
    assert.equal(resource, "channels");
    assert.equal(params.id, "UC-pinned");
    return { items: [{ id: "UC-pinned", snippet: { title: "Fixture Channel" } }] };
  });

  const result = await client.resolveChannel({ name: "Fixture Channel", channelId: "UC-pinned" });
  assert.equal(result.id, "UC-pinned");
  assert.equal(requests.length, 1);
});

test("one creator import reuses channel normalization across many playlist pages", async () => {
  const { APPROVED_YOUTUBE_CHANNELS, APPROVED_INDIVIDUAL_VIDEOS, YouTubeClient } = youtube;
  const threeBlue = APPROVED_YOUTUBE_CHANNELS.find(seed => seed.name === "3Blue1Brown");
  assert.ok(threeBlue?.channelId && threeBlue.playlistIds?.length);
  const targetSourceId = `playlist:${threeBlue.playlistIds[0]}`;
  const pageCount = 40;
  const pageRequests = [];
  const metadataRequests = [];
  const client = new YouTubeClient("fixture", async (resource, params) => {
    if (resource === "playlistItems") {
      const index = params.pageToken ? Number(params.pageToken) : 0;
      pageRequests.push(index);
      return {
        items: [{ contentDetails: { videoId: `video-${index}` } }],
        ...(index + 1 < pageCount ? { nextPageToken: String(index + 1) } : {})
      };
    }
    if (resource === "videos") {
      const ids = params.id.split(",");
      metadataRequests.push(...ids);
      return { items: ids.map(id => ({
        id,
        snippet: {
          channelId: threeBlue.channelId,
          channelTitle: "3Blue1Brown",
          title: `Documentary ${id}`,
          description: "A full-length mathematics explanation.",
          publishedAt: "2024-01-01T00:00:00Z",
          tags: []
        },
        contentDetails: { duration: "PT12M" },
        status: { privacyStatus: "public", embeddable: true }
      })) };
    }
    throw new Error(`Unexpected YouTube resource during a ready-channel import: ${resource}`);
  });

  const channels = [
    // A same-name stale row must not shadow the stable pinned identity.
    { id: "UC-shadow-3blue", name: threeBlue.name, videoCount: 0, approved: true },
    ...APPROVED_YOUTUBE_CHANNELS.map((seed, index) => ({
      id: seed.channelId ?? `UC-legacy-${index}`,
      name: seed.name,
      videoCount: 0,
      approved: true,
      approvedPlaylistIds: seed.playlistIds
    }))
  ];
  const sourceStates = {};
  for (const seed of APPROVED_YOUTUBE_CHANNELS) {
    const channel = channels.find(item => item.id === seed.channelId) ?? channels.find(item => item.name === seed.name);
    const ids = seed.playlistIds?.length ? seed.playlistIds.map(id => `playlist:${id}`) : [`channel:${channel.id}`];
    for (const sourceId of ids) sourceStates[sourceId] = {
      sourceId, label: sourceId, kind: sourceId.startsWith("playlist:") ? "playlist" : "uploads",
      status: "ready", lastSuccessfulSyncAt: new Date().toISOString()
    };
  }
  for (const seed of APPROVED_INDIVIDUAL_VIDEOS) {
    const sourceId = `individual:${seed.videoId ?? seed.title}`;
    sourceStates[sourceId] = { sourceId, label: seed.title, kind: "individual", status: "ready", lastSuccessfulSyncAt: new Date().toISOString() };
  }
  // Retry one approved playlist while all other sources remain fresh.
  sourceStates[targetSourceId].status = "error";
  const secondaryPlaylistSource = `playlist:${threeBlue.playlistIds[1]}`;
  const legacyVideos = Array.from({ length: 75 }, (_, index) => ({
    id: `legacy-video-${index}`,
    channelId: "UC-legacy-3blue",
    channelName: "3Blue1Brown",
    title: `Legacy documentary ${index}`,
    description: "A saved video from the other approved playlist.",
    tags: [],
    publishedAt: "2023-01-01T00:00:00Z",
    durationSeconds: 600,
    durationLabel: "10:00",
    embedAvailable: true,
    topics: ["Science"],
    approved: true,
    sourceIds: [targetSourceId, secondaryPlaylistSource]
  }));

  const originalToLocaleLowerCase = String.prototype.toLocaleLowerCase;
  let exactCreatorNormalizations = 0;
  String.prototype.toLocaleLowerCase = function (...args) {
    if (String(this) === "3Blue1Brown") exactCreatorNormalizations += 1;
    return originalToLocaleLowerCase.apply(this, args);
  };
  try {
    const result = await client.syncApprovedCatalog(channels, undefined, undefined, { sourceStates, existingVideos: legacyVideos });
    assert.equal(result.incomplete, false);
    assert.equal(result.completedRefreshes.length, 1);
    assert.equal(result.completedRefreshes[0].sourceId, targetSourceId);
    assert.equal(pageRequests.length, pageCount);
    assert.deepEqual(pageRequests, Array.from({ length: pageCount }, (_, index) => index));
    assert.equal(metadataRequests.length, pageCount);
    assert.equal(result.videos.length, pageCount + legacyVideos.length);
    assert.equal(exactCreatorNormalizations, 1, "legacy repeated names normalize once; current records with pinned IDs need no name comparison");
  } finally {
    String.prototype.toLocaleLowerCase = originalToLocaleLowerCase;
  }
});
