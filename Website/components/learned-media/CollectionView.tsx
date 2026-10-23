"use client";

import { useCallback } from "react";
import type { CardExplanationMode, DisplayMode, FactCard as FactCardType, FactCardAction, SavedCardLocations } from "@/lib/types";
import { FactCard } from "./FactCard";
import { VirtualizedRows } from "./VirtualizedRows";

type CollectionViewProps = {
  kind: "saved" | "likes" | "history";
  workspaceId: string;
  cards: FactCardType[];
  displayMode: DisplayMode;
  revealGradually: boolean;
  learnLoading: string | null;
  questionLoading: string | null;
  questionDrafts: Record<string, { text?: string; detailed?: boolean }>;
  learningErrors: Record<string, string | undefined>;
  adaptationLoading: string | null;
  glossaryLoading: string | null;
  hasGeminiKey: boolean;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean) => void;
  onQuestionDraft: (id: string, value: string) => void;
  onQuestionDetailed: (id: string, value: boolean) => void;
  onAdaptExplanation: (id: string, mode?: CardExplanationMode) => void;
  onExplainTerms: (id: string) => void;
  onCancelGlossary: (id: string) => void;
  onLocationsResolved: (id: string, locations: SavedCardLocations) => void;
  onOpenSettings: () => void;
};

const copy = {
  saved: { eyebrow: "Your shelf", title: "Saved for later", body: "Keep the facts that deserve a second look close by" },
  likes: { eyebrow: "Your signals", title: "The ideas that pulled you in", body: "Likes help Learned Media understand the kind of strange you enjoy" },
  history: { eyebrow: "Your trail", title: "Everything you’ve wandered through", body: "Your history keeps the feed from repeating itself" }
};

const cardRowKey = (card: FactCardType) => card.id;

export function CollectionView({ kind, workspaceId, cards, displayMode, revealGradually, learnLoading, questionLoading, questionDrafts, learningErrors, adaptationLoading, glossaryLoading, hasGeminiKey, onAction, onLearnMore, onAskQuestion, onQuestionDraft, onQuestionDetailed, onAdaptExplanation, onExplainTerms, onCancelGlossary, onLocationsResolved, onOpenSettings }: CollectionViewProps) {
  const text = copy[kind];
  const renderCard = useCallback((card: FactCardType) => <FactCard card={card} workspaceId={workspaceId} displayMode={displayMode} revealGradually={revealGradually} learnLoading={learnLoading === card.id} questionLoading={questionLoading === card.id} learnError={learningErrors[`${card.id}:learn`]} questionError={learningErrors[card.id]} questionDraft={questionDrafts[card.id]?.text} questionDetailed={questionDrafts[card.id]?.detailed} adaptationLoading={adaptationLoading === `${card.id}:simpler` || adaptationLoading === `${card.id}:deeper`} glossaryLoading={glossaryLoading === card.id} adaptationErrors={learningErrors} hasGeminiKey={hasGeminiKey} onAction={onAction} onLearnMore={onLearnMore} onAskQuestion={onAskQuestion} onQuestionDraft={onQuestionDraft} onQuestionDetailed={onQuestionDetailed} onAdaptExplanation={onAdaptExplanation} onExplainTerms={onExplainTerms} onCancelGlossary={onCancelGlossary} onLocationsResolved={onLocationsResolved} onOpenSettings={onOpenSettings} />, [adaptationLoading, displayMode, glossaryLoading, hasGeminiKey, learnLoading, learningErrors, onAction, onAdaptExplanation, onAskQuestion, onCancelGlossary, onExplainTerms, onLearnMore, onLocationsResolved, onOpenSettings, onQuestionDetailed, onQuestionDraft, questionDrafts, questionLoading, revealGradually, workspaceId]);
  return <section className="content-view collection-view"><div className="view-heading"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.body}</p></div><span className="collection-count">{cards.length} {cards.length === 1 ? "fact" : "facts"}</span></div>{cards.length ? <div className="collection-feed"><VirtualizedRows items={cards} columns={1} estimatedHeight={660} gap={18} className="fact-cards-window" getKey={cardRowKey} renderItem={renderCard} /></div> : <div className="empty-collection"><div className="empty-orbit">✦</div><h2>Nothing here yet</h2><p>As you scroll, the things you save and love will gather here</p></div>}</section>;
}
