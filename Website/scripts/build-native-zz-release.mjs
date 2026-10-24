import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from './generated-output.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const roots=['Website/app','Website/components','Website/lib','Website/workers','App/Resources/frontend','App/Sources'];
const hash=createHash('sha256');
function visit(relative){for(const entry of readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const name=relative+'/'+entry.name;if(entry.isDirectory())visit(name);else if(entry.isFile() && entry.name!=='release.json'){hash.update(name+'\0');hash.update(readFileSync(path.join(root,name)));}}}
roots.forEach(visit);
const catalog=readFileSync(path.join(root,'Website/lib/topic-catalog.ts'),'utf8').match(/TOPIC_CATALOG_VERSION\s*=\s*(\d+)/)[1];
const youtube=readFileSync(path.join(root,'Website/lib/youtube.ts'),'utf8').match(/YOUTUBE_CATALOG_VERSION\s*=\s*(\d+)/)[1];
const policies={
 difficulty:JSON.parse(readFileSync(path.join(root,'Website/lib/difficulty-policy.json'),'utf8')).version,
 topicSearch:Number(readFileSync(path.join(root,'Website/lib/topic-suggestions.ts'),'utf8').match(/TOPIC_SEARCH_VERSION\s*=\s*(\d+)/)[1]),
 videoSearch:Number(readFileSync(path.join(root,'Website/lib/video-semantic.ts'),'utf8').match(/VIDEO_SEMANTIC_VERSION\s*=\s*(\d+)/)[1]),
 evidence:readFileSync(path.join(root,'Website/lib/fact-quality.ts'),'utf8').match(/PASSAGE_VALIDATION_POLICY_VERSION\s*=\s*"([^"]+)"/)[1]
};
const value=JSON.stringify({schema:1,releaseId:hash.digest('hex'),catalogVersion:Number(catalog),youtubeCatalogVersion:Number(youtube),generationDefault:7,policies,sharedPolicy:'shared-policy.js',platforms:['web','macOS']},null,2)+'\n';
for(const target of ['Website/public/release.json','App/Resources/frontend/release.json'])writeFileSync(path.join(root,target),value);
