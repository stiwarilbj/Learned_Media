import { readFileSync } from "node:fs";
import { writeFileSync } from "./generated-output.mjs";
import ts from "typescript";

const source = new URL("../lib/card-image-cache.ts", import.meta.url);
const target = new URL("../../App/Resources/frontend/card-image-cache.js", import.meta.url);
const compiled = ts.transpileModule(readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

writeFileSync(target,
  "// Generated from Website/lib/card-image-cache.ts. Run node Website/scripts/build-native-card-image-cache.mjs.\n" +
  "(function(scope){ const exports = {};\n" + compiled +
  "\nscope.LEARNED_MEDIA_CARD_IMAGE_CACHE = Object.assign(exports, { cache: exports.decodedCardImageCache }); })(globalThis);\n"
);
