"use client";

import { useEffect, useState } from "react";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/recommendations";
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
  onSettingsChange: (next: Partial<FeedSettings>) => void;
  onStart: () => void;
  onOpenSettings: () => void;
};

const modeCopy: Array<{ id: DisplayMode; label: string; icon: "list" | "lightbulb" }> = [
  { id: "picture-text", label: "Image + text", icon: "list" },
  { id: "text", label: "Text only", icon: "lightbulb" }
];

export function SetupWorkspace({ topics, query, settings, customTopic, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onWeightTopic, onSettingsChange, onStart, onOpenSettings }: SetupWorkspaceProps) {
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
            <summary><span><Icon name="check" size={17} /> Choose your topics</span><strong>{selectedCount} selected</strong></summary>
            <p className="setup-topic-help">Pick the subjects you want to see. You can change them anytime.</p>
            <p className="topic-selection-summary" aria-live="polite">{selectionSummary}</p>
            <div className="topic-toolbar">
              <div className="topic-search-note"><Icon name="search" size={16} /><span>{query ? `Filtering for “${query}”` : "Search the topic checklist"}</span></div>
              <button type="button" className="text-button" onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={15} /> {settings.surpriseMe ? "Surprise me is on" : "Surprise me is off"}</button>
            </div>
            <TopicTree nodes={topics} query={query} onToggle={onToggleTopic} onExpand={onExpandTopic} onWeight={onWeightTopic} />
            <div className="custom-topic-form">
              <div><strong>Add a custom topic</strong><span>Make the feed as specific as you are.</span></div>
              <div className="custom-topic-input-wrap"><input value={customTopic} onChange={(event) => onCustomTopicChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddCustomTopic()} placeholder="Formula 1 engineering" aria-label="Custom topic" /><button type="button" className="icon-button filled" onClick={onAddCustomTopic} aria-label="Add custom topic"><Icon name="plus" size={17} /></button></div>
            </div>
          </details>
        </aside>

        <section className="setup-start-panel surface-panel">
          <div className="start-panel-copy"><span className="eyebrow">Your next feed</span><h1>Ready to learn something unexpected?</h1><p>{hasSelection ? `${selectedCount} topic${selectedCount === 1 ? "" : "s"} in your mix, sourced from Wikipedia and shaped by your curiosity.` : "Choose at least one topic from the checklist to begin."}</p></div>
          <div className="start-orbit"><Icon name="sparkles" size={24} /><span>Every card has a source</span></div>
          <button type="button" className="start-button" onClick={onStart} disabled={!hasSelection}><span>{hasSelection ? "Start learning" : "Choose a topic first"}</span><Icon name="arrow" size={21} /></button>
          <p className="panel-footnote"><Icon name={hasSelection ? "shield" : "help"} size={13} /> {hasSelection ? "Your mix stays yours." : "Select a topic to unlock your feed."}</p>

          <div className="setup-key-callout">
            <div className="setup-key-callout-icon"><Icon name="key" size={16} /></div>
            <div><strong>Want Gemini-generated facts?</strong><span>Add your API key in Settings to personalize the next batch.</span></div>
            <button type="button" className="text-button" onClick={onOpenSettings}>Add key <Icon name="arrow" size={14} /></button>
          </div>

          <details className="setup-customize">
            <summary><span><Icon name="sliders" size={16} /> Customize your feed</span><Icon name="chevronDown" size={15} /></summary>
            <div className="setup-customize-body">
              <label className="control-label" htmlFor="obscurity"><span>Fact difficulty</span><span>{difficulty}/10 · {DIFFICULTY_LABELS[difficulty]}</span></label>
              <input id="obscurity" type="range" min="1" max="10" step="1" value={settings.obscurity} onChange={(event) => onSettingsChange({ obscurity: Number(event.target.value) })} />
              <div className="range-ends"><span>Approachable</span><span>Obscure</span></div>
              <span className="control-label">Display style</span>
              <div className="option-grid two">{modeCopy.map((mode) => <button type="button" key={mode.id} className={`option-card ${settings.displayMode === mode.id ? "selected" : ""}`} onClick={() => onSettingsChange({ displayMode: mode.id })}><Icon name={mode.icon} size={16} /><span>{mode.label}</span></button>)}</div>
              <span className="control-label">Description length</span>
              <div className="length-options">{[1, 2, 3, 4].map((length) => <button type="button" key={length} className={settings.sentenceLength === length ? "selected" : ""} onClick={() => onSettingsChange({ sentenceLength: length as FeedSettings["sentenceLength"] })}>{length}</button>)}</div>
              <button type="button" className={`setup-surprise ${settings.surpriseMe ? "selected" : ""}`} onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={14} /> Surprise Me <span>{settings.surpriseMe ? "On" : "Off"}</span></button>
            </div>
          </details>

          <div className="setup-preview-note"><span>Example</span><strong>A Roman object still has no agreed purpose</strong><small>Roman dodecahedra · Ancient History · Wikipedia</small></div>
        </section>
      </section>
    </div>
  );
}
