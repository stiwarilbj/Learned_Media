import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { writeFileSync } from './generated-output.mjs';
const source = ts.transpileModule(readFileSync(new URL('../lib/worker-recovery.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync(new URL('../../App/Resources/frontend/worker-recovery.js', import.meta.url), '// Generated from Website/lib/worker-recovery.ts.\n(function(scope){ const exports = {};\n' + source + '\nscope.LEARNED_MEDIA_WORKER_RECOVERY = exports; })(globalThis);\n');
