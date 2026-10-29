import { readFileSync } from "node:fs";
import { writeFileSync } from "./generated-output.mjs";
import ts from "typescript";

const compile = name => ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const output = `// Generated from Website/lib/youtube-search-index-storage.ts. Run node Website/scripts/build-native-video-index-storage.mjs.
(function(scope) {
  const database = {};
  (function(exports) { ${compile("indexed-db")} })(database);
  const pressure = {};
  (function(exports) { const require = name => name.includes("indexed-db") ? database : scope.LEARNED_MEDIA_BACKGROUND; ${compile("storage-pressure")} })(pressure);
  scope.LEARNED_MEDIA_STORAGE_PRESSURE = pressure;
  const require = name => name.includes("indexed-db") ? database : name.includes("storage-pressure") ? pressure : name.includes("background-work") ? scope.LEARNED_MEDIA_BACKGROUND : scope.LEARNED_MEDIA_VIDEO_SEARCH;
  const exports = {};
  ${compile("youtube-search-index-storage")}
  scope.LEARNED_MEDIA_VIDEO_INDEX_STORAGE = exports;
})(globalThis);
`;
writeFileSync(new URL("../../App/Resources/frontend/youtube-search-index-storage.js", import.meta.url), output);
