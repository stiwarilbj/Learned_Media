"use client";

import type { DisplayMode, FactCard as FactCardType, FactCardAction } from "@/lib/types";
import { FactCard } from "./FactCard";

type CollectionViewProps = {
  kind: "saved" | "likes" | "history";
  cards: FactCardType[];
  displayMode: DisplayMode;
  learnLoading: string | null;
  questionLoading: string | null;
  learningErrors: Record<string, string | undefined>;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean) => void;
};

const copy = {
  saved: { eyebrow: "Your shelf", title: "Saved for later", body: "Keep the facts that deserve a second look close by" },
  likes: { eyebrow: "Your signals", title: "The ideas that pulled you in", body: "Likes help Learned Media understand the kind of strange you enjoy" },
  history: { eyebrow: "Your trail", title: "Everything you’ve wandered through", body: "Your history keeps the feed from repeating itself" }
};

export function CollectionView({ kind, cards, displayMode, learnLoading, questionLoading, learningErrors, onAction, onLearnMore, onAskQuestion }: CollectionViewProps) {
  const text = copy[kind];
  return <section className="content-view collection-view"><div className="view-heading"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.body}</p></div><span className="collection-count">{cards.length} {cards.length === 1 ? "fact" : "facts"}</span></div>{cards.length ? <div className="collection-feed">{cards.map((card) => <FactCard key={card.id} card={card} displayMode={displayMode} learnLoading={learnLoading === card.id} questionLoading={questionLoading === card.id} learnError={learningErrors[`${card.id}:learn`]} questionError={learningErrors[card.id]} onAction={onAction} onLearnMore={onLearnMore} onAskQuestion={onAskQuestion} />)}</div> : <div className="empty-collection"><div className="empty-orbit">✦</div><h2>Nothing here yet</h2><p>As you scroll, the things you save and love will gather here</p></div>}</section>;
}
