import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compareReports } from './prompt-evaluation/compare.mjs';
import { formatComparison } from './prompt-evaluation/report.mjs';
const args=process.argv.slice(2);
const flag=name=>{const i=args.indexOf(name);return i<0 ? undefined : args[i+1];};
const hash=paths=>createHash('sha256').update(paths.map(p=>readFileSync(new URL(p,import.meta.url))).map(b=>b.toString()).join('\n')).digest('hex');
if (args.includes('--compare')) {
  const [a,b]=args.slice(args.indexOf('--compare')+1);
  if (!a || !b) throw new Error('Usage: --compare baseline.json candidate.json');
  const baseline=JSON.parse(readFileSync(a)),candidate=JSON.parse(readFileSync(b));
  const result=compareReports(baseline,candidate);
  console.log(formatComparison(baseline,candidate,result));
  console.log(JSON.stringify(result,null,2));
  process.exit(result.accepted ? 0 : 1);
}
const temp=mkdtempSync(join(tmpdir(),'lm-prompt-eval-'));
try {
  const capture=join(temp,'cases.json');
  const result=spawnSync(process.execPath,['--test','--test-name-pattern=^prompt evaluation:',new URL('./test-generation.mjs',import.meta.url).pathname],
    {env:{...process.env,PROMPT_EVALUATION_REPORT:capture},encoding:'utf8'});
  if (result.status!==0) process.stderr.write(result.stdout+result.stderr);
  const cases=JSON.parse(readFileSync(capture));
  const fixtures=JSON.parse(readFileSync(new URL('./prompt-evaluation/fixtures.json',import.meta.url)));
  if (cases.length!==fixtures.length) throw new Error('Evaluation did not run every fixed case.');
  const report={version:1,mode:'deterministic-replay',
    suiteHash:hash(['./prompt-evaluation/fixtures.json','./prompt-evaluation/cases.mjs','./prompt-evaluation/card-metrics.mjs','./prompt-evaluation/recovery-cases.mjs','./test-generation.mjs']),
    promptHash:hash(['../lib/gemini.ts','../lib/prompts.ts','../lib/prompt-instructions.json','../lib/difficulty-policy.json','../lib/fact-angle-policy.json','../lib/evidence-dates.ts','../lib/evidence-date-patterns.json']),cases};
  const output=flag('--output');
  if (output) writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  if (args.includes('--capture')) console.table(cases.map(c=>({case:c.id,success:c.taskSuccess,sentenceCounts:c.cardTotal ? `${c.sentenceCountValid}/${c.cardTotal} @ ${c.expectedSentences}` : 'N/A',sentenceCitations:c.sentenceTotal ? `${c.sentenceCited}/${c.sentenceTotal}` : 'N/A',citations:c.citationTotal ? `${c.citationValid}/${c.citationTotal}` : 'N/A',duplicates:c.duplicateRate,outputBytes:c.outputBytes,promptBytes:c.promptBytes,calls:c.geminiCalls})));
  const baseline=flag('--baseline') || new URL('./prompt-evaluation/baseline.json',import.meta.url);
  if (!args.includes('--capture')) {
    const previous=JSON.parse(readFileSync(baseline));
    const comparison=compareReports(previous,report);
    console.log(formatComparison(previous,report,comparison));
    if (!comparison.accepted) process.exitCode=1;
  }
  if (result.status!==0) process.exitCode=1;
} finally {rmSync(temp,{recursive:true,force:true});}
