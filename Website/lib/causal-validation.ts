import policy from "./causal-policy.json";

type Relation = { kind: string; cause: string[]; effect: string[]; negative: boolean; uncertain: boolean; text: string; ambiguous: boolean; question: boolean };
const stop = new Set(policy.stop.split(" "));
const patterns = policy.patterns.map(item => ({ ...item, regex: new RegExp(item.pattern, "gi") }));
const uncertain = new RegExp(policy.uncertain, "i"), negative = new RegExp(policy.negative, "i");

function anchors(text: string) {
  return [...new Set((text.toLowerCase().match(/[a-z]+/g) ?? []).filter(word => !stop.has(word) && word.length > 2).map(word => {
    // Conservative inflection matching, not inferred synonyms or semantic entailment.
    let stem = word.replace(/(?:ing|ed|s)$/u, "");
    if (/(?:ing|ed)$/u.test(word)) stem = stem.replace(/([a-z])\1$/u, "$1");
    return stem.replace(/e$/u, "");
  }).filter(word => word.length > 2))];
}

function relations(text: string): Relation[] {
  const result: Relation[] = [];
  // Do not borrow actors, outcomes or certainty from another sentence/clause.
  for (const clause of text.slice(0, 16000).match(/[^.;!?\n]+[.;!?]?/gu) ?? []) {
    const matches = patterns.flatMap(pattern => [...clause.matchAll(pattern.regex)].map(match => ({ pattern, match })));
    for (const { pattern, match } of matches) {
      const left = anchors(clause.slice(0, match.index)), right = anchors(clause.slice(match.index + match[0].length));
      result.push({ kind: pattern.kind, cause: pattern.reverse ? right : left, effect: pattern.reverse ? left : right,
        negative: negative.test(clause), uncertain: uncertain.test(clause), text: clause.trim(), ambiguous: matches.length !== 1, question: clause.trim().endsWith("?") });
    }
  }
  return result;
}

function covers(required: string[], supplied: string[]) {
  const available = new Set(supplied);
  return required.length > 0 && required.slice(0, 2).every(word => available.has(word))
    && required.filter(word => available.has(word)).length / required.length >= 0.6;
}

/** Require an explicit relationship with matching direction, actors, outcome and certainty. */
export function unsupportedCausality(claim: string, passages: string[]): string[] {
  const requested = relations(claim);
  if (!requested.length) return [];
  const supplied = passages.flatMap(relations).filter(relation => !relation.ambiguous && !relation.question);
  return requested.filter(relation => relation.ambiguous || !supplied.some(source => source.kind === relation.kind
    && source.negative === relation.negative && (!source.uncertain || relation.uncertain)
    && covers(relation.cause, source.cause) && covers(relation.effect, source.effect))).map(relation => relation.text);
}
