import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

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

const { PriorFactClaimSelector, preparePriorFactTopicQuery, selectPriorFactClaims } = require("../lib/fact-novelty.ts");

const records = [
  { id: "relief-act", title: "Relief kitchens", claim: "Ireland's 1847 Relief Act funded a network of soup kitchens.", body: "Inspectors recorded the network's operation.", topicPath: ["History", "Ireland"] },
  { id: "roads", title: "Roman roads", claim: "Roman roads connected distant provinces.", topicPath: ["History", "Rome"] },
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `ireland-${index}`,
    title: `Irish record ${index}`,
    claim: `A separate Irish museum record describes instrument ${index} in Dublin.`,
    body: "",
    topicPath: ["History", "Ireland"]
  }))
];
const topicPaths = [["History", "Ireland"], ["History", "Dublin"]];
const topics = topicPaths.map(preparePriorFactTopicQuery);
const selector = new PriorFactClaimSelector(records);

assert.deepEqual(selector.selectPrepared(topics), selectPriorFactClaims(records, topicPaths), "prepared topic queries preserve ranking, ties, and prompt caps");

const accepted = {
  id: "newly-accepted",
  title: "The Dublin float gauge",
  claim: "A sealed float gauge marked a tide change at the Dublin harbor museum.",
  body: "",
  topicPath: ["History", "Ireland"]
};
selector.add(accepted);
assert.deepEqual(selector.selectPrepared(topics), selectPriorFactClaims([...records, accepted], topicPaths), "newly accepted cards update the prepared history without re-normalizing earlier records");

const historyCount = records.length;
const withDuplicateMemory = new PriorFactClaimSelector(records);
withDuplicateMemory.add(records[0]);
withDuplicateMemory.add(accepted);
assert.deepEqual(
  withDuplicateMemory.selectPrepared(topics, 12, 2400, historyCount),
  selectPriorFactClaims(records, topicPaths),
  "the initial cached-evidence claim list can select the history prefix before duplicated working memory"
);
console.log("Generation context preparation checks passed.");
