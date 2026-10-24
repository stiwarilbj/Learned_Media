import type { FactCard } from './types';
/** Search original text even when gradual reveal or an alternative is visible. */
export function cardSearchText(card: FactCard) {
  return `${card.hook ?? ''} ${card.title} ${card.body} ${card.topicPath.join(' ')} ${card.sources.map(source => source.title).join(' ')}`;
}
