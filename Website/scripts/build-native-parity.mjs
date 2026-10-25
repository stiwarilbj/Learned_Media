import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { writeFileSync } from './generated-output.mjs';
const root = fileURLToPath(new URL('../lib/', import.meta.url));
const modules = new Map();
function bundle(name) {
  if (modules.has(name)) return;
  const filename = path.join(root, name + '.ts');
  const source = readFileSync(filename, 'utf8');
  modules.set(name, '');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  for (const match of code.matchAll(/require\("(.+?)"\)/g)) {
    if (!match[1].startsWith('.')) throw new Error('Unexpected shared runtime dependency: ' + match[1]);
    bundle(path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1])));
  }
  modules.set(name, code);
}
for (const name of ['topic-catalog','topic-tree','topic-preferences','demo-data','search','card-search-text']) bundle(name);
// Extract the pure YouTube policy verbatim, without storage/network services.
const youtubeSource = readFileSync(path.join(root, 'youtube.ts'), 'utf8');
const source = ts.createSourceFile('youtube.ts', youtubeSource, ts.ScriptTarget.Latest, true);
const names = new Set(['YOUTUBE_TOPICS','YOUTUBE_CATALOG_VERSION','APPROVED_YOUTUBE_CHANNELS','DEFAULT_YOUTUBE_RECENCY_PREFERENCES','mergeYouTubeRecencyPreferences','APPROVED_INDIVIDUAL_VIDEOS','APPROVED_3BLUE_PLAYLIST_SOURCE_IDS','normalized','hasExplicitShortMarker','isYouTubeShortMetadata','discoveryMetadata','selectRandomVideos','relatedYouTubeVideos','isApprovedYouTubeVideo','scheduleYouTubeProgressFrame','cancelYouTubeProgressFrame','createYouTubeProgressStore','createYouTubeListMemo','partitionYouTubeVideoResults']);
const statements = source.statements.filter(node => names.has(node.name?.text) || ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration=>names.has(declaration.name.getText(source))));
const pure = statements.map(node=>node.getText(source)).join('\n') + '\nexport {isYouTubeShortMetadata};';
modules.set('youtube-policy',ts.transpileModule(pure,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const definitions = [...modules].map(([name, code])=>JSON.stringify(name)+':function(module,exports,require){\n'+code+'\n}').join(',\n');
const output = `// Generated from the website's finalized catalogs and pure policies.\n(function(scope){const modules={${definitions}},cache={};function load(name){if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};modules[name](module,module.exports,function(relative){const parts=name.split('/');parts.pop();for(const part of relative.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}return load(parts.join('/'));});return module.exports;}scope.LEARNED_MEDIA_SHARED=Object.assign({},load('topic-catalog'),load('topic-tree'),load('topic-preferences'),load('demo-data'),{search:load('search'),cards:load('card-search-text'),youtube:load('youtube-policy')});})(globalThis);\n`;
writeFileSync(new URL('../../App/Resources/frontend/shared-policy.js',import.meta.url),output);
// The native card worker uses precisely the website ranking and cache protocol.
const searchCode = modules.get('search');
const cacheCode = ts.transpileModule(readFileSync(path.join(root,'session-cache.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const diagnosticsCode = ts.transpileModule(readFileSync(path.join(root,'performance-diagnostics.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const worker = ts.transpileModule(readFileSync(new URL('../workers/card-search.worker.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
writeFileSync(new URL('../../App/Resources/frontend/card-search.worker.js',import.meta.url),`// Generated card-search worker.\nconst search={},cache={},diagnostics={};(function(exports){${diagnosticsCode}})(diagnostics);(function(exports){${searchCode}})(search);(function(exports,require){${cacheCode}})(cache,()=>diagnostics);const exports={},require=name=>name.includes('session-cache')?cache:search;\n${worker}`);
