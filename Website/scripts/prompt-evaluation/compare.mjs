/** Per-case gates avoid hiding regressions behind better aggregate scores. */
export function compareReports(baseline,candidate) {
  const errors=[];
  for (const report of [baseline,candidate]) {
    if (report.version!==1 || typeof report.mode!=='string' || !report.mode
      || ![report.suiteHash,report.promptHash].every(h=>typeof h==='string' && /^[a-f0-9]{64}$/.test(h))
      || !Array.isArray(report.cases)) return {accepted:false,improved:false,errors:['Invalid report identity or format.']};
    if (new Set(report.cases.map(c=>c.id)).size!==report.cases.length) errors.push('Duplicate case IDs.');
  }
  if (baseline.suiteHash!==candidate.suiteHash) errors.push('The fixed fixture set changed; results are not comparable.');
  if (baseline.mode!==candidate.mode) errors.push('Evaluation modes differ.');
  const rows=new Map(candidate.cases.map(c=>[c.id,c]));
  if (rows.size!==candidate.cases.length || rows.size!==baseline.cases.length) errors.push('Missing or duplicate cases.');
  let improved=false;
  for (const old of baseline.cases) {
    const next=rows.get(old.id);
    if (!next) {errors.push(`${old.id}: missing case`);continue;}
    const validity=r=>r.citationTotal ? r.citationValid/r.citationTotal : 1;
    for (const r of [old,next]) {
      if (typeof r.taskSuccess!=='boolean' || ['citationTotal','citationValid','duplicateRate','candidateDuplicateRate','outputBytes','promptBytes','geminiCalls'].some(k=>!Number.isFinite(r[k]) || r[k]<0)
        || r.citationValid>r.citationTotal || r.duplicateRate>1 || r.candidateDuplicateRate>1) errors.push(`${old.id}: invalid metrics`);
    }
    if (!next.taskSuccess) errors.push(`${old.id}: task failed`);
    if (validity(next)<validity(old)) errors.push(`${old.id}: citation validity regressed`);
    if (next.citationTotal<old.citationTotal) errors.push(`${old.id}: citation coverage decreased`);
    if (next.duplicateRate>old.duplicateRate) errors.push(`${old.id}: published duplicates increased`);
    if (next.candidateDuplicateRate>old.candidateDuplicateRate) errors.push(`${old.id}: candidate duplicates increased`);
    if (next.geminiCalls>old.geminiCalls) errors.push(`${old.id}: Gemini calls increased`);
    if (next.outputBytes>Math.ceil(old.outputBytes*1.1)) errors.push(`${old.id}: model output grew by more than 10%`);
    if (next.promptBytes>Math.ceil(old.promptBytes*1.1)) errors.push(`${old.id}: prompt grew by more than 10%`);
    improved ||= (!old.taskSuccess && next.taskSuccess) || validity(next)>validity(old) || next.duplicateRate<old.duplicateRate || next.candidateDuplicateRate<old.candidateDuplicateRate;
  }
  if (baseline.promptHash!==candidate.promptHash && !improved) errors.push('Changed prompts need a measured reliability improvement; passing unchanged replays alone is insufficient.');
  return {accepted:errors.length===0,improved,errors};
}
