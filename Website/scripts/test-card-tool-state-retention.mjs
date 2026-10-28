import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const previousLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};

const retention = require("../lib/card-tool-state-retention.ts");
const locations = require("../lib/card-locations.ts");

test("closed map state stays warm for recent retained cards and expires outside the window", () => {
  retention.activateCardToolWorkspace("retention-a");
  const cards = Array.from({ length: retention.MAX_RECENT_CARD_TOOL_CARDS + 5 }, (_, index) => `retained-${index}`);
  retention.setCardToolWorkspaceCards("retention-a", cards);
  locations.setCardLocationPanelState("retention-a", cards[0], { fingerprint: "fp-0", status: "ready" });
  locations.setCardLocationPanelState("retention-a", cards.at(-1), { fingerprint: "fp-last", status: "error", attempt: 1 });

  retention.retainCardToolWindow("retention-a", [cards.at(-1)]);
  assert.equal(locations.getCardLocationPanelState("retention-a", cards.at(-1), "fp-last").status, "error");
  assert.equal(locations.getCardLocationPanelState("retention-a", cards[0], "fp-0").status, "idle");
  assert.equal(retention.cardToolRetentionSnapshot()?.retainedCardIds.size, 1);
});

test("workspace membership replacement immediately drops closed state for removed cards", () => {
  retention.setCardToolWorkspaceCards("retention-b", ["kept", "removed"]);
  locations.setCardLocationPanelState("retention-b", "removed", { fingerprint: "removed-fp", status: "ready" });
  retention.retainCardToolWindow("retention-b", ["removed"]);
  retention.setCardToolWorkspaceCards("retention-b", ["kept"]);
  assert.equal(locations.getCardLocationPanelState("retention-b", "removed", "removed-fp").status, "idle");
  assert.equal(retention.isCardToolCardRetained("retention-b", "removed"), false);
});

test("workspace switches prune closed state but preserve open maps until closed", () => {
  retention.setCardToolWorkspaceCards("retention-c", ["closed", "open"]);
  locations.setCardLocationPanelState("retention-c", "closed", { fingerprint: "closed-fp", status: "ready" });
  locations.setCardLocationPanelState("retention-c", "open", { fingerprint: "open-fp", status: "ready" });
  locations.setCardLocationPanelOpen("retention-c", "open", "open-fp", true);

  retention.setCardToolWorkspaceCards("retention-d", ["next-workspace-card"]);
  assert.equal(locations.getCardLocationPanelState("retention-c", "closed", "closed-fp").status, "idle");
  assert.equal(locations.getCardLocationPanelState("retention-c", "open", "open-fp").status, "ready");

  locations.setCardLocationPanelOpen("retention-c", "open", "open-fp", false);
  assert.equal(locations.getCardLocationPanelState("retention-c", "open", "open-fp").status, "idle");
});

test("the retained window is capped and duplicate IDs do not consume extra slots", () => {
  retention.setCardToolWorkspaceCards("retention-e", Array.from({ length: 500 }, (_, index) => `card-${index}`));
  const ids = Array.from({ length: 500 }, (_, index) => `card-${index}`);
  retention.retainCardToolWindow("retention-e", [...ids, ...ids]);
  assert.equal(retention.cardToolRetentionSnapshot()?.retainedCardIds.size, retention.MAX_RECENT_CARD_TOOL_CARDS);
  assert.equal(retention.isCardToolCardRetained("retention-e", "card-0"), false);
  assert.equal(retention.isCardToolCardRetained("retention-e", "card-499"), true);
});

test("generated Mac helpers retain open panels and prune closed panels with the same policy", () => {
  const scope = { console };
  scope.globalThis = scope;
  runInNewContext(readFileSync(new URL("../../App/Resources/frontend/card-tool-state-retention.js", import.meta.url), "utf8"), scope);
  runInNewContext(readFileSync(new URL("../../App/Resources/frontend/card-locations.js", import.meta.url), "utf8"), scope);
  const nativeRetention = scope.LEARNED_MEDIA_CARD_TOOL_RETENTION;
  const nativeLocations = scope.LEARNED_MEDIA_CARD_LOCATIONS;
  nativeRetention.setCardToolWorkspaceCards("native-a", ["keep", "closed", "open"]);
  nativeLocations.setCardLocationPanelState("native-a", "closed", { fingerprint: "closed-fp", status: "ready" });
  nativeLocations.setCardLocationPanelState("native-a", "open", { fingerprint: "open-fp", status: "ready" });
  nativeLocations.setCardLocationPanelOpen("native-a", "open", "open-fp", true);
  nativeRetention.retainCardToolWindow("native-a", ["keep"]);
  assert.equal(nativeLocations.getCardLocationPanelState("native-a", "closed", "closed-fp").status, "idle");
  assert.equal(nativeLocations.getCardLocationPanelState("native-a", "open", "open-fp").status, "ready");
});

process.on("exit", () => { Module._extensions[".ts"] = previousLoader; });
