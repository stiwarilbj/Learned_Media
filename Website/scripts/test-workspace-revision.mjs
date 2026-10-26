import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

if (!globalThis.crypto?.subtle) globalThis.crypto = require("node:crypto").webcrypto;

const { canonicalRecord } = require("../lib/cloud-records.ts");
const {
  serializeWorkspaceRecord,
  workspaceRevisionId,
  workspaceRevisionIdFromSerialization,
  workspaceRevisionRowByteLength
} = require("../lib/workspace-revision.ts");

const legacyFixtures = [
  {
    userId: "ABCDEF-123",
    record: {
      id: "ws-1",
      name: "Research",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-10-26T12:00:00.000Z",
      state: {
        persistenceVersion: 2,
        topicCatalogVersion: 7,
        topics: [{ id: "α", weight: 0.75 }],
        settings: { theme: "dark", nested: { z: 1, a: "é" } },
        cards: [{ id: "c1", title: "A fact — déjà vu", body: "One." }]
      }
    },
    revisionId: "1b6ec0dc-3cfc-8f88-9eb3-b2edb2dd7282"
  },
  {
    userId: "User@Example.COM",
    record: {
      state: { youtubeActivity: { selectedTopic: "All", activeTab: "discover" }, cards: [], settings: {}, topics: [] },
      updatedAt: "2025-05-06",
      createdAt: "2024-01-01",
      name: "🌎",
      id: "legacy"
    },
    revisionId: "1648e8db-1f63-8446-b460-02652785120e"
  }
];

async function legacyRevisionId(userId, record) {
  const input = JSON.stringify(["workspace-revision-v1", userId.toLowerCase(), record], (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
  });
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

test("canonical serialized workspace bytes preserve legacy revision IDs", async () => {
  for (const fixture of legacyFixtures) {
    const canonical = canonicalRecord(fixture.record);
    assert.equal(await legacyRevisionId(fixture.userId, canonical), fixture.revisionId, "fixture pins the pre-change algorithm");

    const serialization = serializeWorkspaceRecord(canonical);
    const expectedJson = JSON.stringify(canonical, (_key, value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    });
    assert.equal(new TextDecoder().decode(serialization.bytes), expectedJson);
    assert.deepEqual(serialization.bytes, new TextEncoder().encode(expectedJson));
    assert.equal(await workspaceRevisionIdFromSerialization(fixture.userId, serialization), fixture.revisionId);
    assert.equal(await workspaceRevisionId(fixture.userId, canonical), fixture.revisionId);
  }
});

test("canonical bytes are independent of object insertion order", () => {
  const first = { id: "stable", name: "N", createdAt: "a", updatedAt: "b", state: { settings: { z: 2, a: 1 } } };
  const reordered = { state: { settings: { a: 1, z: 2 } }, updatedAt: "b", createdAt: "a", name: "N", id: "stable" };
  assert.deepEqual(serializeWorkspaceRecord(first).bytes, serializeWorkspaceRecord(reordered).bytes);
});

test("revision row byte sizing reuses record bytes and matches JSON encoding", () => {
  const record = canonicalRecord(legacyFixtures[0].record);
  const serialization = serializeWorkspaceRecord(record);
  const row = {
    revision_id: legacyFixtures[0].revisionId,
    user_id: legacyFixtures[0].userId,
    workspace_id: record.id,
    modified_at: record.updatedAt,
    record
  };
  const expectedBytes = new TextEncoder().encode(JSON.stringify(row)).byteLength;
  assert.equal(workspaceRevisionRowByteLength(row, serialization), expectedBytes);
});
