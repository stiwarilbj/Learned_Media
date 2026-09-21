import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(new URL("..", import.meta.url).pathname, "..");
const websiteRoot = path.join(repoRoot, "Website");

function loadWebsitePoliticalCatalog() {
  const typescript = require("typescript");
  const source = fs.readFileSync(path.join(websiteRoot, "lib/political-history-catalog.ts"), "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require, console });
  vm.runInContext(compiled, context, { filename: "political-history-catalog.ts" });
  return module.exports;
}

function loadNativeCatalog() {
  const window = {};
  const context = vm.createContext({ window, console });
  for (const file of ["App/Resources/frontend/topic-catalog.js", "App/Resources/frontend/political-history.js"]) {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, { filename: file });
  }
  return { catalog: window.LEARNED_MEDIA_TOPIC_CATALOG, audit: window.LEARNED_MEDIA_POLITICAL_AUDIT };
}

function normalize(seed) {
  if (typeof seed === "string") return { label: seed, aliases: [], children: [] };
  return {
    label: seed.label,
    aliases: [...(seed.aliases || [])].sort(),
    children: (seed.children || []).map(normalize)
  };
}

function flatten(node, pathParts = []) {
  if (typeof node === "string") node = { label: node, children: [], aliases: [] };
  const currentPath = [...pathParts, node.label];
  return [
    { node, path: currentPath },
    ...(node.children || []).flatMap((child) => flatten(child, currentPath))
  ];
}

function labelOf(seed) {
  return typeof seed === "string" ? seed : seed.label;
}

function firstDifference(left, right, pathParts = []) {
  if (typeof left !== typeof right) return { path: pathParts, left, right };
  if (left === null || right === null || typeof left !== "object") return left === right ? null : { path: pathParts, left, right };
  if (Array.isArray(left) !== Array.isArray(right)) return { path: pathParts, left, right };
  if (Array.isArray(left)) {
    if (left.length !== right.length) return { path: pathParts.concat("length"), left: left.length, right: right.length };
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstDifference(left[index], right[index], pathParts.concat(index));
      if (difference) return difference;
    }
    return null;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    const difference = firstDifference(left[key], right[key], pathParts.concat(key));
    if (difference) return difference;
  }
  return null;
}

function child(node, label) {
  const found = (node.children || []).find((candidate) => candidate.label === label);
  assert.ok(found, `Missing child: ${[node.label, label].join(" / ")}`);
  return found;
}

function findLabel(node, label) {
  return flatten(node).find(({ node: candidate }) => candidate.label === label)?.node;
}

function assertPoliticalCatalog(root, sourceName) {
  const political = root.label === "U.S. Political History" ? root : child(child(root, "History"), "U.S. Political History");
  const senate = child(political, "Senate");
  const house = child(political, "House");
  const notableSenators = child(senate, "Notable Senators");
  const notableHouse = child(house, "Notable House Members");
  const vicePresidents = child(political, "Vice Presidents");
  const congresses = child(child(political, "Congress"), "Congresses and Sessions");
  const speakerships = child(house, "Congresses During Each Speakership");
  const presidentialElections = child(child(political, "Elections"), "Presidential");
  const electionCycles = child(child(political, "Elections"), "Senate");
  const governors = child(political, "Governors");

  assert.equal(congresses.children.length, 119, `${sourceName}: expected the 1st through 119th Congress`);
  assert.equal(labelOf(congresses.children.at(-1)), "119th Congress (2025–2027)");
  assert.equal(speakerships.children.length, 119);
  assert.match(labelOf(speakerships.children[39]), /40th Congress.*Schuyler Colfax \/ Theodore Pomeroy/);
  assert.match(labelOf(speakerships.children[43]), /44th Congress.*Michael C\. Kerr \/ Samuel Randall/);
  assert.match(labelOf(speakerships.children[71]), /72nd Congress.*John Nance Garner/);
  assert.match(labelOf(speakerships.children[72]), /73rd Congress.*Henry T\. Rainey/);
  assert.match(labelOf(speakerships.children[73]), /74th Congress.*Joseph W\. Byrns \/ William B\. Bankhead/);
  assert.match(labelOf(speakerships.children[74]), /75th Congress.*William B\. Bankhead/);
  assert.match(labelOf(speakerships.children[75]), /76th Congress.*William B\. Bankhead \/ Sam Rayburn/);
  assert.match(labelOf(speakerships.children[86]), /87th Congress.*Sam Rayburn \/ John W\. McCormack/);
  assert.match(labelOf(speakerships.children[100]), /101st Congress.*Jim Wright \/ Thomas Foley/);
  assert.match(labelOf(speakerships.children[113]), /114th Congress.*John Boehner \/ Paul Ryan/);
  assert.match(labelOf(speakerships.children[117]), /118th Congress.*Kevin McCarthy \/ Mike Johnson/);
  assert.match(labelOf(speakerships.children[118]), /119th Congress.*Mike Johnson/);

  const vpLabels = vicePresidents.children.map(labelOf);
  assert.ok(vpLabels.includes("George Mifflin Dallas (1845–1849)"));
  assert.ok(vpLabels.includes("Theodore Roosevelt (1901)"));
  assert.ok(!vpLabels.includes("Theodore Roosevelt (1901–1909)"));
  assert.equal(labelOf(presidentialElections.children.at(-1)), "Presidential Election 2024");
  assert.equal(labelOf(electionCycles.children.at(-1)), "Senate Election Cycle 2024–2025");
  assert.equal(governors.children.length, 50);

  const senatorLabels = notableSenators.children.map(labelOf);
  const houseLabels = notableHouse.children.map(labelOf);
  for (const label of ["Birch Bayh", "Robert M. La Follette Jr.", "William E. Borah", "Edward M. Kennedy", "Daniel Patrick Moynihan"]) assert.ok(senatorLabels.includes(label), `${sourceName}: missing ${label}`);
  for (const label of ["Thaddeus Stevens", "John Lewis", "Constance Baker Motley", "Tip O'Neill"]) assert.ok(houseLabels.includes(label), `${sourceName}: missing ${label}`);
  for (const label of ["Thaddeus Stevens", "John Lewis", "Ronald Reagan", "Idaho William Borah", "Ted Kennedy", "Pat Moynihan"]) assert.ok(!senatorLabels.includes(label), `${sourceName}: misplaced/duplicate ${label}`);
  assert.ok(!houseLabels.includes("Robert La Follette Jr."));
  assert.equal(senatorLabels.filter((label) => label === "Edward M. Kennedy").length, 1);
  assert.equal(senatorLabels.filter((label) => label === "Daniel Patrick Moynihan").length, 1);
  assert.ok(notableSenators.children.find((seed) => labelOf(seed) === "William E. Borah").aliases.includes("Idaho William Borah"));
  assert.ok(notableHouse.children.find((seed) => labelOf(seed) === "Tip O'Neill").aliases.includes("Thomas P. O'Neill Jr."));

  const namedStories = child(child(senate, "Inner Workings"), "Named Legislative Stories").children.map(labelOf);
  assert.ok(namedStories.includes("Strom Thurmond's 1999 Stem-Cell Research Testimony"));
  assert.ok(namedStories.includes("Ted Kennedy and Strom Thurmond Co-Sponsor Stem-Cell Research Protections (2002)"));
  assert.ok(!namedStories.includes("Strom Thurmond's 1998 Stem-Cell Research Testimony"));
  return political;
}

const websiteExports = loadWebsitePoliticalCatalog();
const websitePolitical = websiteExports.buildUnitedStatesPoliticalHistory();
const nativeLoaded = loadNativeCatalog();
const nativeCatalog = nativeLoaded.catalog;
const nativeAudit = nativeLoaded.audit;
const nativePolitical = child(child(nativeCatalog.find((item) => item.label === "History"), "United States"), "U.S. Political History");

assertPoliticalCatalog(websitePolitical, "website");
assertPoliticalCatalog(nativePolitical, "native");
const websiteNormalized = normalize(websitePolitical);
const nativeNormalized = normalize(nativePolitical);
const parityDifference = firstDifference(websiteNormalized, nativeNormalized);
if (parityDifference) throw new Error(`First website/native catalog difference: ${JSON.stringify(parityDifference)}`);
assert.equal(JSON.stringify(websiteNormalized), JSON.stringify(nativeNormalized), "website/native political catalogs diverged");

const expectedMigrations = [
  ["History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Thaddeus Stevens"],
  ["History", "United States", "U.S. Political History", "Senate", "Famous Senators", "John Lewis"],
  ["History", "United States", "U.S. Political History", "Senate", "Famous Senators", "Ronald Reagan"],
  ["History", "United States", "U.S. Political History", "House", "Famous House Members", "Robert La Follette Jr."],
  ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Strom Thurmond's 1998 Stem-Cell Research Testimony"],
  ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy, Strom Thurmond, and Stem-Cell Research"],
  ["History", "United States", "U.S. Political History", "Senate", "Inner Workings", "Named Legislative Stories", "Ted Kennedy's 2006 Stem-Cell Research Floor Push"]
];
for (const oldPath of expectedMigrations) {
  const oldKey = oldPath.join("\0").toLowerCase();
  const migratedPath = websiteExports.POLITICAL_TOPIC_MIGRATIONS[oldKey];
  assert.ok(migratedPath, `No migration for ${oldPath.at(-1)}`);
}
assert.equal(websiteExports.POLITICAL_HISTORY_AUDIT_CORRECTIONS.length, 10);
assert.equal(Object.keys(websiteExports.POLITICAL_TOPIC_LABEL_MIGRATIONS).length, 3);
assert.equal(JSON.stringify(nativeAudit.migrations), JSON.stringify(websiteExports.POLITICAL_TOPIC_MIGRATIONS));
assert.equal(JSON.stringify(nativeAudit.labelMigrations), JSON.stringify(websiteExports.POLITICAL_TOPIC_LABEL_MIGRATIONS));
assert.equal(nativeAudit.corrections.length, websiteExports.POLITICAL_HISTORY_AUDIT_CORRECTIONS.length);

console.log("Political catalog validation passed: website/native parity, office placement, VP dates, Speaker mappings, governors, aliases, stories, and migrations.");
