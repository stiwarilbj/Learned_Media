"use client";
import { DownloadSession } from "./CardDownloads";

import { useCallback, useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/recommendations";
import { SENTENCE_LENGTH_OPTIONS } from "@/lib/fact-quality";
import type { AnswerStructure, BatchSetup, CardExplanationMode, DisplayMode, FactCard as FactCardType, FactCardAction, FeedSettings, QuestionInstructionPreference, SavedCardLocations, TopicNode } from "@/lib/types";
import type { TopicSearchIndex } from "@/lib/topic-search-types";
import type { TopicDetour, TopicDetourProgress } from "@/lib/topic-detours";
import type { FactAngle } from "@/lib/fact-angle";
import { factAngleDefinition } from "@/lib/fact-angle";
import { summarizeBatchSetup } from "@/lib/batch-replay";
import { selectedLeafCount } from "@/lib/topic-tree";
import { FactCard } from "./FactCard";
import { FactAngleControl } from "./FactAngleControl";
import { Icon } from "./icons";
import { TopicTree } from "./TopicTree";
import { VirtualizedRows } from "./VirtualizedRows";

type FeedViewProps = {
  workspaceId: string;
  cards: FactCardType[];
  showReset: boolean;
  query?: string;
  catalogRevision: number;
  topicSearchIndex?: TopicSearchIndex;
  settings: FeedSettings;
  factAngle: FactAngle;
  factAngleLocked: boolean;
  lastCompletedBatchSetup: BatchSetup | null;
  repeatBatchPreview: BatchSetup | null;
  repeatDisabledReason?: string;
  revealGradually: boolean;
  topics: TopicNode[];
  customTopic: string;
  loading: boolean;
  canLoadMore: boolean;
  generationError: string;
  rabbitHole: string | null;
  topicDetour: TopicDetour | null;
  topicDetourStatusNotice?: string | null;
  toast?: string;
  learnLoading: string | null;
  questionLoading: string | null;
  questionDrafts: Record<string, { text?: string; detailed?: boolean; structure?: AnswerStructure; structureRevision?: number; instructionPreference?: QuestionInstructionPreference; instructionRevision?: number }>;
  learningErrors: Record<string, string | undefined>;
  adaptationLoading: string | null;
  glossaryLoading: string | null;
  hasGeminiKey: boolean;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean, structure: AnswerStructure, structureRevision: number, instructionPreference: QuestionInstructionPreference, instructionRevision: number) => void;
  onQuestionDraft: (id: string, value: string) => void;
  onQuestionDetailed: (id: string, value: boolean) => void;
  onQuestionStructure: (id: string, value: AnswerStructure) => void;
  onQuestionInstructionPreference: (id: string, value: QuestionInstructionPreference) => void;
  onAdaptExplanation: (id: string, mode?: CardExplanationMode) => void;
  onExplainTerms: (id: string) => void;
  onCancelGlossary: (id: string) => void;
  onLocationsResolved: (id: string, locations: SavedCardLocations) => void;
  onOpenSettings: () => void;
  onReset: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onThreeMore: (id: string) => void;
  onEndTopicDetour: () => void;
  onTopicDetourProgress: (id: string, progress: TopicDetourProgress) => void;
  onSettingsChange: (next: Partial<FeedSettings>) => void;
  onFactAngleChange: (angle: FactAngle) => void;
  onEndFactBatch: () => void;
  onPrepareRepeat: () => void;
  onCancelRepeat: () => void;
  onConfirmRepeat: (setup: BatchSetup) => void;
  onCustomTopicChange: (value: string) => void;
  onAddCustomTopic: () => void;
  onToggleTopic: (id: string) => void;
  onExpandTopic: (id: string) => void;
  onCollapseTopics: () => void;
  onWeightTopic: (id: string, delta: number) => void;
  onRemoveCustomTopic: (id: string) => void;
};

function SkeletonCard() {
  return <div className="skeleton-card"><div className="skeleton-media shimmer" /><div className="skeleton-line wide shimmer" /><div className="skeleton-line shimmer" /><div className="skeleton-line short shimmer" /></div>;
}

const cardRowKey = (card: FactCardType) => card.id;

function RepeatBatchControl({ setup, preview, disabledReason, onPrepare, onCancel, onConfirm }: {
  setup: BatchSetup | null;
  preview: BatchSetup | null;
  disabledReason?: string;
  onPrepare: () => void;
  onCancel: () => void;
  onConfirm: (setup: BatchSetup) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { if (preview) onCancel(); setOpen(false); } };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { if (preview) onCancel(); setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [onCancel, open, preview]);
  useEffect(() => {
    if (open && preview) generateRef.current?.focus();
  }, [open, preview]);
  const summary = preview ? summarizeBatchSetup(preview) : null;
  return <div className="repeat-batch-control" ref={rootRef}>
    <button ref={triggerRef} type="button" className="toolbar-icon-button repeat-batch-trigger" aria-label="Feed controls" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (open) { if (preview) onCancel(); setOpen(false); } else setOpen(true); }}><Icon name="more" size={16} /></button>
    {open && <div className="repeat-batch-popover" role="dialog" aria-label="Feed controls">
      {!preview ? <>
        <button type="button" className="repeat-batch-menu-action" disabled={!setup || Boolean(disabledReason)} title={disabledReason || (!setup ? "Complete a batch before repeating its setup." : undefined)} onClick={() => { if (!setup || disabledReason) return; onPrepare(); }}>
          <strong>Repeat this batch’s setup</strong><span>{setup ? "Use its original topics and settings with fresh facts." : "Complete a batch to save its setup here."}</span>
        </button>
        {disabledReason && <p className="repeat-batch-note" role="status">{disabledReason}</p>}
      </> : <>
        <div className="repeat-batch-preview" aria-live="polite">
          <strong>Fresh facts · {summary?.count} cards</strong>
          <ul>{summary?.topics.map(topic => <li key={`${topic.path}:${topic.difficulty}`}><span>{topic.path}</span><b>×{topic.count} · L{topic.difficulty}</b></li>)}</ul>
          <p><b>Difficulty targets:</b> {summary?.difficulty}</p>
          <p><b>Length:</b> {summary?.sentenceLength} sentences · <b>Pictures:</b> {summary?.displayMode === "picture-text" ? "On" : "Off"}</p>
          <p><b>Fact angle:</b> {factAngleDefinition(preview.factAngle).label} · <b>Surprise Me:</b> {summary?.surpriseMe ? "On" : "Off"}</p>
          {summary?.rabbitHole && <p><b>Rabbit hole:</b> {summary.rabbitHole}</p>}
          <span className="repeat-batch-hint">Your current settings stay unchanged.</span>
        </div>
        <div className="repeat-batch-preview-actions">
          <button ref={generateRef} type="button" className="primary-button small" disabled={Boolean(disabledReason)} title={disabledReason} onClick={() => { setOpen(false); onConfirm(preview); }}>Generate fresh facts</button>
          <button type="button" className="text-button" onClick={() => { onCancel(); triggerRef.current?.focus(); }}>Use current setup</button>
        </div>
      </>}
    </div>}
  </div>;
}

function TopicSidebar({ topics, query = "", catalogRevision, topicSearchIndex, customTopic, settings, factAngle, factAngleLocked, onFactAngleChange, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onCollapseTopics, onWeightTopic, onRemoveCustomTopic, onSettingsChange, onReset, showReset }: Pick<FeedViewProps, "topics" | "query" | "catalogRevision" | "topicSearchIndex" | "customTopic" | "settings" | "factAngle" | "factAngleLocked" | "onFactAngleChange" | "onCustomTopicChange" | "onAddCustomTopic" | "onToggleTopic" | "onExpandTopic" | "onCollapseTopics" | "onWeightTopic" | "onRemoveCustomTopic" | "onSettingsChange" | "onReset" | "showReset">) {
  const [topicsOpen, setTopicsOpen] = useState(true);
  useEffect(() => {
    setTopicsOpen(window.innerWidth > 820);
  }, []);
  const selectedCount = selectedLeafCount(topics);
  return (
    <aside className="feed-topics-panel surface-panel">
      {showReset && <button type="button" className="topic-sidebar-reset" onClick={onReset}><Icon name="reset" size={14} /> Reset feed</button>}
      <details className="topics-details" open={topicsOpen} onToggle={(event) => setTopicsOpen(event.currentTarget.open)}>
        <summary><span>Your topics</span><strong>{selectedCount} selected</strong></summary>
        <div className="feed-topic-copy">Keep the checklist close while you read. New choices shape the next batch</div>
        <label className="topic-difficulty-control" htmlFor="feed-obscurity">
          <span className="control-label"><span>Fact Difficulty</span><strong>{normalizeDifficulty(settings.obscurity)}/10 · {DIFFICULTY_LABELS[normalizeDifficulty(settings.obscurity)]}</strong></span>
          <input id="feed-obscurity" className="feed-range" type="range" min="1" max="10" step="1" value={settings.obscurity} onChange={(event) => onSettingsChange({ obscurity: Number(event.target.value) })} />
          <span className="range-ends"><span>A Little Hard</span><span>Impossible</span></span>
        </label>
        <TopicTree nodes={topics} query={query} catalogRevision={catalogRevision} searchIndex={topicSearchIndex} onToggle={onToggleTopic} onExpand={onExpandTopic} onCollapseAll={onCollapseTopics} onWeight={onWeightTopic} onRemoveCustomTopic={onRemoveCustomTopic} />
        <div className="feed-custom-topic">
          <input value={customTopic} onChange={(event) => onCustomTopicChange(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onAddCustomTopic()} placeholder="Add a topic" aria-label="Add a custom topic" />
          <button type="button" onClick={onAddCustomTopic} aria-label="Add custom topic"><Icon name="plus" size={15} /></button>
        </div>
      </details>
      <details className="feed-customize">
        <summary><span><Icon name="sliders" size={16} /> Customize Your Feed</span><Icon name="chevronDown" size={15} /></summary>
        <div className="feed-customize-body">
          <span className="control-label">Display</span>
          <div className="feed-display-options">
            {(["picture-text", "text"] as DisplayMode[]).map((mode) => <button type="button" key={mode} className={settings.displayMode === mode ? "selected" : ""} onClick={() => onSettingsChange({ displayMode: mode })}>{mode === "picture-text" ? "Image + text" : "Text only"}</button>)}
          </div>
          <span className="control-label">Description length (sentences):</span>
          <div className="feed-length-options" role="group" aria-label="Description length in sentences">
            {SENTENCE_LENGTH_OPTIONS.map((length) => <button type="button" key={length} className={settings.sentenceLength === length ? "selected" : ""} aria-pressed={settings.sentenceLength === length} disabled={settings.sentenceLength === length} onClick={() => onSettingsChange({ sentenceLength: length })}>{length}</button>)}
          </div>
          <FactAngleControl value={factAngle} onChange={onFactAngleChange} disabled={factAngleLocked} id="feed-fact-angle" />
          <button type="button" className={`feed-surprise-toggle ${settings.surpriseMe ? "selected" : ""}`} onClick={() => onSettingsChange({ surpriseMe: !settings.surpriseMe })}><Icon name="sparkles" size={14} /> Surprise Me <span>{settings.surpriseMe ? "On" : "Off"}</span></button>
        </div>
      </details>
    </aside>
  );
}

export function FeedView({ workspaceId, cards, showReset, query = "", catalogRevision, topicSearchIndex, settings, factAngle, factAngleLocked, lastCompletedBatchSetup, repeatBatchPreview, repeatDisabledReason, revealGradually, topics, customTopic, loading, canLoadMore, generationError, rabbitHole, topicDetour, topicDetourStatusNotice, toast, learnLoading, questionLoading, questionDrafts, learningErrors, adaptationLoading, glossaryLoading, hasGeminiKey, onAction, onLearnMore, onAskQuestion, onQuestionDraft, onQuestionDetailed, onQuestionStructure, onQuestionInstructionPreference, onAdaptExplanation, onExplainTerms, onCancelGlossary, onLocationsResolved, onOpenSettings, onReset, onRetry, onEndFactBatch, onPrepareRepeat, onCancelRepeat, onConfirmRepeat, onLoadMore, onThreeMore, onEndTopicDetour, onTopicDetourProgress, onSettingsChange, onFactAngleChange, onCustomTopicChange, onAddCustomTopic, onToggleTopic, onExpandTopic, onCollapseTopics, onWeightTopic, onRemoveCustomTopic }: FeedViewProps) {
  const handleViewportRangeChange = useCallback((start: number) => {
    const lastDetourCardId = topicDetour?.slotCardIds[2];
    if (!topicDetour || !lastDetourCardId) return;
    const lastDetourIndex = cards.findIndex(card => card.id === lastDetourCardId);
    if (lastDetourIndex >= 0 && lastDetourIndex < start) onTopicDetourProgress(lastDetourCardId, "passed");
  }, [cards, onTopicDetourProgress, topicDetour]);
  const renderCard = useCallback((card: FactCardType) => {
    const slot = topicDetour?.workspaceId === workspaceId ? topicDetour.slotCardIds.indexOf(card.id) : -1;
    return <FactCard card={card} workspaceId={workspaceId} displayMode={card.displayModeOverride ?? settings.displayMode} revealGradually={revealGradually} learnLoading={learnLoading === card.id} questionLoading={questionLoading === card.id} learnError={learningErrors[`${card.id}:learn`]} questionError={learningErrors[card.id]} questionDraft={questionDrafts[card.id]?.text} questionDetailed={questionDrafts[card.id]?.detailed} questionStructure={questionDrafts[card.id]?.structure} questionStructureRevision={questionDrafts[card.id]?.structureRevision} questionInstructionPreference={questionDrafts[card.id]?.instructionPreference} questionInstructionRevision={questionDrafts[card.id]?.instructionRevision} adaptationLoading={adaptationLoading === `${card.id}:simpler` || adaptationLoading === `${card.id}:deeper`} glossaryLoading={glossaryLoading === card.id} adaptationErrors={learningErrors} hasGeminiKey={hasGeminiKey} onAction={onAction} onLearnMore={onLearnMore} onAskQuestion={onAskQuestion} onQuestionDraft={onQuestionDraft} onQuestionDetailed={onQuestionDetailed} onQuestionStructure={onQuestionStructure} onQuestionInstructionPreference={onQuestionInstructionPreference} onAdaptExplanation={onAdaptExplanation} onExplainTerms={onExplainTerms} onCancelGlossary={onCancelGlossary} onLocationsResolved={onLocationsResolved} onOpenSettings={onOpenSettings} onThreeMore={onThreeMore} detourSlot={slot >= 0 ? slot : undefined} onDetourProgress={onTopicDetourProgress} />;
  }, [adaptationLoading, glossaryLoading, hasGeminiKey, learnLoading, learningErrors, onAction, onAdaptExplanation, onAskQuestion, onCancelGlossary, onExplainTerms, onLearnMore, onLocationsResolved, onOpenSettings, onQuestionDetailed, onQuestionDraft, onQuestionStructure, onQuestionInstructionPreference, onThreeMore, onTopicDetourProgress, questionDrafts, questionLoading, revealGradually, settings.displayMode, topicDetour, workspaceId]);
  return (
    <div className="feed-workspace">
      {rabbitHole && <div className="rabbit-banner"><div><Icon name="arrow" size={16} /><span>Rabbit Hole Mode <strong>→ {rabbitHole}</strong></span></div><button type="button" onClick={onReset}>Exit rabbit hole</button></div>}
      {toast && <div className="feed-toast"><Icon name="check" size={15} /> {toast}</div>}
      <div className="feed-layout">
          <TopicSidebar topics={topics} query={query} catalogRevision={catalogRevision} topicSearchIndex={topicSearchIndex} customTopic={customTopic} settings={settings} factAngle={factAngle} factAngleLocked={factAngleLocked} onFactAngleChange={onFactAngleChange} onCustomTopicChange={onCustomTopicChange} onAddCustomTopic={onAddCustomTopic} onToggleTopic={onToggleTopic} onExpandTopic={onExpandTopic} onCollapseTopics={onCollapseTopics} onWeightTopic={onWeightTopic} onRemoveCustomTopic={onRemoveCustomTopic} onSettingsChange={onSettingsChange} onReset={onReset} showReset={showReset} />
        <section className="feed-content-column">
          <div className="feed-toolbar">
            <div className="active-topics"><span className="toolbar-label">Your feed</span></div>
            <div className="feed-toolbar-actions"><DownloadSession /><RepeatBatchControl setup={lastCompletedBatchSetup} preview={repeatBatchPreview} disabledReason={repeatDisabledReason} onPrepare={onPrepareRepeat} onCancel={onCancelRepeat} onConfirm={onConfirmRepeat} /></div>
            {(topicDetour || topicDetourStatusNotice) && <div className="topic-detour-status" role="status" aria-live="polite"><span>{topicDetour ? topicDetour.slotCardIds.some(id => !id) ? "Preparing three cards" : `${topicDetour.topicPath.at(-1) ?? "Topic"} · ${Math.max(1, topicDetour.furthestReached + 1)} of 3` : topicDetourStatusNotice}</span>{topicDetour && <button type="button" onClick={onEndTopicDetour}>End early</button>}</div>}
          </div>
          <div className="feed-intro"><div><h1>Keep going</h1><p>One small idea at a time. Every card has a place to look next</p></div><span className="feed-count">{cards.length} cards in this session</span></div>
          <div className="fact-feed">
            <VirtualizedRows items={cards} columns={1} estimatedHeight={settings.displayMode === "text" ? 490 : 660} gap={18} className="fact-cards-window" getKey={cardRowKey} renderItem={renderCard} onViewportRangeChange={handleViewportRangeChange} />
            {loading && <div className="feed-progress" role="status" aria-live="polite"><span className="loading-dot" /> {topicDetour?.phase === "generating" ? "Gemini is building your topic detour" : "Gemini is building the next facts"}</div>}
            {generationError && <div className="feed-error" role="alert"><Icon name="help" size={17} /><div><strong>Generation paused</strong><span>{generationError}</span></div><button type="button" className="secondary-button" onClick={onRetry} disabled={loading} aria-busy={loading}>Retry missing facts</button><button type="button" className="text-button" onClick={onEndFactBatch} disabled={loading}>End this batch</button></div>}
            {canLoadMore && !topicDetour && <div className="feed-bottom-actions"><button type="button" className="small-load-button" onClick={onLoadMore} disabled={loading} aria-busy={loading}>Generate 7 more</button></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
