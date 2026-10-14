import {compareReports} from './compare.mjs';

const number=value=>Number.isFinite(value) ? value.toLocaleString('en-US') : 'N/A';
const success=value=>typeof value==='boolean' ? (value ? 'pass' : 'fail') : 'N/A';
const percent=value=>Number.isFinite(value) ? `${Number((value*100).toFixed(2))}%` : 'N/A';
const citations=row=>!row ? 'missing' : row.citationTotal===0 ? 'N/A (0/0)' : `${number(row.citationValid)}/${number(row.citationTotal)} (${percent(row.citationValid/row.citationTotal)})`;
const transition=(old,next,format=number)=>`${format(old)} → ${format(next)}`;

/** Presentation only: acceptance continues to come from the existing gates. */
export function formatComparison(baseline,candidate,result=compareReports(baseline,candidate)) {
  const oldRows=Array.isArray(baseline.cases) ? baseline.cases : [];
  const newRows=Array.isArray(candidate.cases) ? candidate.cases : [];
  const ids=[...new Set([...oldRows,...newRows].map(row=>row.id))];
  const lines=[`Acceptance: ${result.accepted ? 'ACCEPTED' : 'REJECTED'}; reliability improved: ${result.improved ? 'yes' : 'no'}`, 'Metrics: baseline → candidate'];
  for (const id of ids) {
    const old=oldRows.find(row=>row.id===id),next=newRows.find(row=>row.id===id);
    // A prompt-wide improvement requirement is decided across the complete suite.
    // Case decisions retain every metric and identity gate, without requiring
    // each unchanged case to independently demonstrate that global improvement.
    const paired=old && next ? compareReports({...baseline,cases:[old]},
      {...candidate,promptHash:baseline.promptHash,cases:[next]}) : {accepted:false};
    lines.push(`${id}: ${paired.accepted ? 'PASS' : 'REJECT'}`,
      `  success: ${transition(old?.taskSuccess,next?.taskSuccess,success)} | citations: ${citations(old)} → ${citations(next)} | duplicates: ${transition(old?.duplicateRate,next?.duplicateRate,percent)} | candidate duplicates: ${transition(old?.candidateDuplicateRate,next?.candidateDuplicateRate,percent)}`,
      `  output: ${transition(old?.outputBytes,next?.outputBytes)} bytes | prompt: ${transition(old?.promptBytes,next?.promptBytes)} bytes | calls: ${transition(old?.geminiCalls,next?.geminiCalls)}`);
    if (old?.cardTotal || next?.cardTotal) {
      const counts=row=>row ? `${number(row.sentenceCountValid)}/${number(row.cardTotal)} @ ${number(row.expectedSentences)}` : 'missing';
      const coverage=row=>row ? `${number(row.sentenceCited)}/${number(row.sentenceTotal)}` : 'missing';
      lines.push(`  sentence counts: ${counts(old)} → ${counts(next)} | cited sentences: ${coverage(old)} → ${coverage(next)}`);
    }
  }
  if (result.errors.length) lines.push('Rejection reasons:',...result.errors.map(error=>`  - ${error}`));
  return lines.join('\n');
}
