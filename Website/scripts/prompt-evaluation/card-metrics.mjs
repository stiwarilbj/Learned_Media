// Independent of the production validator: count the published body and its per-sentence coverage.
export function validCitation(card, evidence) {
  const extract = card.sources?.[evidence.sourceIndex]?.extract;
  return typeof extract === 'string' && typeof evidence.quote === 'string' && evidence.quote.length > 0
    && typeof evidence.section === 'string' && evidence.section.length > 0
    && extract.includes(evidence.quote) && extract.includes(`[Section: ${evidence.section}]`);
}
export function measureCardCoverage(cards, expected) {
  const segmenter = new Intl.Segmenter('en', {granularity: 'sentence'});
  let sentenceCountValid = 0, sentenceTotal = 0, sentenceCited = 0;
  for (const card of cards) {
    const sentences = [...segmenter.segment(card.body)].map(part => part.segment.trim()).filter(Boolean);
    sentenceTotal += sentences.length;
    if (sentences.length === expected && card.sentenceCount === expected
      && sentences.every(text => /[.!?][”"']?$/.test(text))) sentenceCountValid++;
    for (let index = 0; index < sentences.length; index++) {
      const evidence = (card.evidence ?? []).filter(item => item.sentence === index);
      if (evidence.length && evidence.every(item => validCitation(card, item))) sentenceCited++;
    }
  }
  return {expectedSentences: expected, cardTotal: cards.length, sentenceCountValid, sentenceTotal, sentenceCited};
}
