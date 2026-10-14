import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
const source = new URL("../lib/video-semantic.ts", import.meta.url);
const target = new URL("../../App/Resources/frontend/video-semantic.js", import.meta.url);
const search = ts.transpileModule(readFileSync(new URL("../lib/search.ts", import.meta.url),"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = ts.transpileModule(readFileSync(source,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync(target, "// Generated from Website/lib/video-semantic.ts. Run node Website/scripts/build-native-video-search.mjs.\n(function(scope){ const search = {}; (function(exports){\n" + search + "\n})(search); const require = () => search; const exports = {};\n" + compiled + "\nscope.LEARNED_MEDIA_VIDEO_SEARCH = exports; })(globalThis);\n");
