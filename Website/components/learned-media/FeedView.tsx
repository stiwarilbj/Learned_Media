"use client";

import { Fragment, useEffect, useState } from "react";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/recommendations";
import { SENTENCE_LENGTH_OPTIONS } from "@/lib/fact-quality";
import type { DisplayMode, FactCard as FactCardType, FactCardAction, FeedSettings, TopicNode } from "@/lib/types";
import { selectedLeafCount } from "@/lib/topic-tree";
import { FactCard } from "./FactCard";
import { Icon } from "./icons";
import { TopicTree } from "./TopicTree";

type FeedViewProps = {
  cards: FactCardType[];
  query?: string;
  settings: FeedSettings;
  topics: TopicNode[];
  customTopic: string;
  loading: boolean;
  canLoadMore: boolean;
  generationError: string;
  rabbitHole: string | null;
  toast?: string;
  learnLoading: string | null;
  questionLoading: string | null;
  learningErrors: Record<string, string | undefined>;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean) => void;
  onReset: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onSettingsChange: (next: Partial<FeedSettings>) => void;
  onCustomTopicChange: (value: string) => void;
  onAddCustomTopic: () => void;
  onToggleTopic: (id: string) => void;
  onExpandTopic: (id: string) => void;
  onWeightTopic: (id: string, delta: number) => void;
  onRemoveCustomTopic: (id: string) => void;
};

function SkeletonCard() {
  return <div className="skeleton-card"><div className="skeleton-media shimmer" /><div className="skeleton-line wide shimmer" /><div className="skeleton-line shimmer" /><div className="skeleton-line short shimmer" /></div>;
}

function TopicSidebar({ topics, query = "", customTopic, settings, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onWeightTopic, onRemoveCustomTopic, onSettingsChange }: Pick<FeedViewProps, "topics" | "query" | "customTopic" | "settings" | "onCustomTopicChange" | "onAddCustomTopic" | "onToggleTopic" | "onExpandTopic" | "onWeightTopic" | "onRemoveCustomTopic" | "onSettingsChange">) {
  const [topicsOpen, setTopicsOpen] = useState(true);
  useEffect(() => {
    setTopicsOpen(window.innerWidth > 820);
  }, []);
  const selectedCount = selectedLeafCount(topics);
  return (
    <aside className="feed-topics-panel surface-panel">
      <details className="topics-details" open={topicsOpen} onToggle={(event) => setTopicsOpen(event.currentTarget.open)}>
        <summary><span><Icon name="check" size={16} /> Your topics</span><strong>{selectedCount} selected</strong></summary>
        <div className="feed-topic-copy">Keep the checklist close while you read. New choices shape the next batch</div>
        <label className="topic-difficulty-control" htmlFor="feed-obscurity">
          <span className="control-label"><span>Fact Difficulty</span><strong>{normalizeDifficulty(settings.obscurity)}/10 · {DIFFICULTY_LABELS[normalizeDifficulty(settings.obscurity)]}</strong></span>
          <input id="feed-obscurity" className="feed-range" type="range" min="1" max="10" step="1" value={settings.obscurity} onChange={(event) => onSettingsChange({ obscurity: Number(event.target.value) })} />
          <span className="range-ends"><span>A Little Hard</span><span>Super Duper Hard</span></span>
        </label>
        <TopicTree nodes={topics} query={query} onToggle={onToggleTopic} onExpand={onExpandTopic} onWeight={onWeightTopic} onRemoveCustomTopic={onRemoveCustomTopic} />
        <div className="feed-custom-topic">
          <input value={customTopic} onChange={(event) => onCustomTopicChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddCustomTopic()} placeholder="Add a topic" aria-label="Add a custom topic" />
          <button type="button" onClick={onAddCustomTopic} aria-label="Add custom topic"><Icon name="plus" size={15} /></button>
        </div>
      </details>
      <details className="feed-customize">
        <summary><span><Icon name="sliders" size={16} /> Customize your feed</span><Icon name="chevronDown" size={15} /></summary>
        <div className="feed-customize-body">
          <span className="control-label">Display</span>
          <div className="feed-display-options">
            {(["picture-text", "text"] as DisplayMode[]).map((mode) => <button type="button" key={mode} className={settings.displayMode === mode ? "selected" : ""} onClick={() => onSettingsChange({ displayMode: mode })}>{mode === "picture-text" ? "Image + text" : "Text only"}</button>)}
          </div>
          <span className="control-label">Description length</span>
          <div className="feed-length-options" role="group" aria-label="Description length">
            {SENTENCE_LENGTH_OPTIONS.map((length) => <button type="button" key={length} className={settings.sentenceLength === length ? "selected" : ""} aria-pressed={settings.sentenceLength === length} disabled={settings.sentenceLength === length} onClick={() => onSettingsChange({ sentenceLength: length })}>{length}</button>)}
          </div>
          <p className="sentence-length-note">{settings.sentenceLength} specific sentence{settings.sentenceLength === 1 ? "" : "s"} per fact</p>
          <button type="button" className={`feed-surprise-toggle ${settings.surpriseMe ? "selected" : ""}`} onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={14} /> Surprise Me <span>{settings.surpriseMe ? "On" : "Off"}</span></button>
        </div>
      </details>
    </aside>
  );
}

export function FeedView({ cards, query = "", settings, topics, customTopic, loading, canLoadMore, generationError, rabbitHole, toast, learnLoading, questionLoading, learningErrors, onAction, onLearnMore, onAskQuestion, onReset, onRetry, onLoadMore, onSettingsChange, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onWeightTopic, onRemoveCustomTopic }: FeedViewProps) {
  return (
    <div className="feed-workspace">
      {rabbitHole && <div className="rabbit-banner"><div><Icon name="arrow" size={16} /><span>Rabbit Hole Mode <strong>→ {rabbitHole}</strong></span></div><button type="button" onClick={onReset}>Exit rabbit hole</button></div>}
      {toast && <div className="feed-toast"><Icon name="check" size={15} /> {toast}</div>}
      <div className="feed-layout">
          <TopicSidebar topics={topics} query={query} customTopic={customTopic} settings={settings} onCustomTopicChange={onCustomTopicChange} onAddCustomTopic={onAddCustomTopic} onToggleTopic={onToggleTopic} onExpandTopic={onExpandTopic} onWeightTopic={onWeightTopic} onRemoveCustomTopic={onRemoveCustomTopic} onSettingsChange={onSettingsChange} />
        <section className="feed-content-column">
          <div className="feed-toolbar">
            <div className="active-topics"><span className="toolbar-label">Your feed</span><span className="topic-chip selected-chip">{cards.length} discoveries</span></div>
            <button type="button" className="toolbar-reset" onClick={onReset}><Icon name="reset" size={15} /> Reset feed</button>
          </div>
          <div className="feed-intro"><div><h1>Keep going</h1><p>One small idea at a time. Every card has a place to look next</p></div><span className="feed-count">{cards.length} cards in this session</span></div>
          <div className="fact-feed">
            {cards.map((card, index) => <Fragment key={card.id}>
              {canLoadMore && index === Math.max(cards.length - 3, 0) && <div className="feed-load-more-nearby"><button type="button" className="small-load-button" onClick={onLoadMore} disabled={loading} aria-busy={loading}>Generate 10 more</button></div>}
              <FactCard card={card} displayMode={settings.displayMode} learnLoading={learnLoading === card.id} questionLoading={questionLoading === card.id} learnError={learningErrors[`${card.id}:learn`]} questionError={learningErrors[card.id]} onAction={onAction} onLearnMore={onLearnMore} onAskQuestion={onAskQuestion} />
            </Fragment>)}
            {loading && <div className="feed-progress" role="status" aria-live="polite"><span className="loading-dot" /> Gemini is building the next facts</div>}
            {generationError && <div className="feed-error" role="alert"><Icon name="help" size={17} /><div><strong>Generation paused</strong><span>{generationError}</span></div><button type="button" className="secondary-button" onClick={onRetry} disabled={loading} aria-busy={loading}>Retry missing facts</button></div>}
            {canLoadMore && <div className="feed-bottom-actions"><button type="button" className="small-load-button" onClick={onLoadMore} disabled={loading} aria-busy={loading}>Generate 10 more</button></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
