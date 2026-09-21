"use client";

import { useEffect, useState } from "react";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/recommendations";
import { SENTENCE_LENGTH_OPTIONS } from "@/lib/fact-quality";
import type { DisplayMode, FeedSettings, TopicNode } from "@/lib/types";
import { selectedLeafCount, summarizeSelection } from "@/lib/topic-tree";
import { Icon } from "./icons";
import { TopicTree } from "./TopicTree";

type SetupWorkspaceProps = {
  topics: TopicNode[];
  query: string;
  settings: FeedSettings;
  customTopic: string;
  onCustomTopicChange: (value: string) => void;
  onAddCustomTopic: () => void;
  onToggleTopic: (id: string) => void;
  onExpandTopic: (id: string) => void;
  onWeightTopic: (id: string, delta: number) => void;
  onRemoveCustomTopic: (id: string) => void;
  onSettingsChange: (next: Partial<FeedSettings>) => void;
  onStart: () => void;
  onOpenSettings: () => void;
  canStart: boolean;
  hasGeminiKey: boolean;
};

const modeCopy: Array<{ id: DisplayMode; label: string; icon: "list" | "lightbulb" }> = [
  { id: "picture-text", label: "Image + text", icon: "list" },
  { id: "text", label: "Text only", icon: "lightbulb" }
];

export function SetupWorkspace({ topics, query, settings, customTopic, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onWeightTopic, onRemoveCustomTopic, onSettingsChange, onStart, onOpenSettings, canStart, hasGeminiKey }: SetupWorkspaceProps) {
  const [topicsOpen, setTopicsOpen] = useState(true);
  useEffect(() => {
    setTopicsOpen(window.innerWidth > 820);
  }, []);
  const selectedCount = selectedLeafCount(topics);
  const hasSelection = selectedCount > 0;
  const selectionSummary = summarizeSelection(topics);
  const difficulty = normalizeDifficulty(settings.obscurity);
  return (
    <div className="setup-stack">
      <section className="setup-layout">
        <aside className="setup-topics-panel surface-panel">
          <details className="setup-topics-details" open={topicsOpen} onToggle={(event) => setTopicsOpen(event.currentTarget.open)}>
            <summary><span>Choose your topics</span></summary>
            <strong className="topic-selected-count">{selectedCount} selected</strong>
            <p className="setup-topic-help">Pick the subjects you want to see; you can change them anytime</p>
            <p className="topic-selection-summary" aria-live="polite">{selectionSummary}</p>
            <label className="topic-difficulty-control" htmlFor="obscurity">
              <span className="control-label"><span>Fact Difficulty</span><strong>{difficulty}/10 · {DIFFICULTY_LABELS[difficulty]}</strong></span>
              <input id="obscurity" type="range" min="1" max="10" step="1" value={settings.obscurity} onChange={(event) => onSettingsChange({ obscurity: Number(event.target.value) })} />
              <span className="range-ends"><span>A Little Hard</span><span>Super Duper Hard</span></span>
            </label>
            <div className="topic-toolbar">
              <div className="topic-search-note"><Icon name="search" size={16} /><span>{query ? `Filtering for “${query}”` : "Search the topic checklist"}</span></div>
              <button type="button" className="text-button" onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={15} /> {settings.surpriseMe ? "Surprise me is on" : "Surprise me is off"}</button>
            </div>
            <TopicTree nodes={topics} query={query} onToggle={onToggleTopic} onExpand={onExpandTopic} onWeight={onWeightTopic} onRemoveCustomTopic={onRemoveCustomTopic} />
            <div className="custom-topic-form">
              <div><strong>Add a custom topic</strong><span>Make the feed as specific as you are</span></div>
              <div className="custom-topic-input-wrap"><input value={customTopic} onChange={(event) => onCustomTopicChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddCustomTopic()} placeholder="Rajah Humabon" aria-label="Custom topic" /><button type="button" className="icon-button filled" onClick={onAddCustomTopic} aria-label="Add custom topic"><Icon name="plus" size={17} /></button></div>
            </div>
          </details>
        </aside>

        <section className="setup-start-panel surface-panel">
          <div className="start-panel-copy"><span className="eyebrow">Your next feed</span><h1>Ready for a surprise?</h1><p>{hasSelection ? `${selectedCount} topic${selectedCount === 1 ? "" : "s"} in your mix, sourced from Wikipedia and shaped by your curiosity` : "Choose at least one topic from the checklist to begin"}</p></div>
          <div className="start-orbit"><Icon name="sparkles" size={24} /><span>Every card has a source</span></div>
          <button type="button" className="start-button" onClick={onStart} disabled={!hasSelection || !canStart}><span>{!hasSelection ? "Choose a topic first" : canStart ? "Start learning" : "Connect Gemini first"}</span><Icon name="arrow" size={21} /></button>
          <p className="panel-footnote"><Icon name={hasSelection && canStart ? "shield" : "help"} size={13} /> {!hasSelection ? "Select a topic to unlock your feed" : canStart ? "Your mix stays yours" : "Connect at least three Gemini models in Settings to begin"}</p>

          {!hasGeminiKey && <div className="setup-key-callout">
            <div className="setup-key-callout-icon"><Icon name="key" size={16} /></div>
            <div><strong>Want Gemini-generated facts?</strong><span>Add your API key in Settings for the next batch</span></div>
            <button type="button" className="text-button" onClick={onOpenSettings}>Add key <Icon name="arrow" size={14} /></button>
          </div>}

          <details className="setup-customize">
            <summary><span><Icon name="sliders" size={16} /> Customize Your Feed</span><Icon name="chevronDown" size={15} /></summary>
            <div className="setup-customize-body">
              <span className="control-label">Display style</span>
              <div className="option-grid two">{modeCopy.map((mode) => <button type="button" key={mode.id} className={`option-card ${settings.displayMode === mode.id ? "selected" : ""}`} onClick={() => onSettingsChange({ displayMode: mode.id })}><Icon name={mode.icon} size={16} /><span>{mode.label}</span></button>)}</div>
              <span className="control-label">Description length (sentences):</span>
              <div className="feed-length-options" role="group" aria-label="Description length in sentences">
                {SENTENCE_LENGTH_OPTIONS.map((length) => <button type="button" key={length} className={settings.sentenceLength === length ? "selected" : ""} aria-pressed={settings.sentenceLength === length} disabled={settings.sentenceLength === length} onClick={() => onSettingsChange({ sentenceLength: length })}>{length}</button>)}
              </div>
              <button type="button" className={`setup-surprise ${settings.surpriseMe ? "selected" : ""}`} onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={14} /> Surprise Me <span>{settings.surpriseMe ? "On" : "Off"}</span></button>
              <p className="surprise-note">When on, the next batch can include a less predictable topic from your chosen mix.</p>
            </div>
          </details>

        </section>
      </section>
    </div>
  );
}
