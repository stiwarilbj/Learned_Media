"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { DIFFICULTY_LABELS } from "@/lib/recommendations";
import type { CardExplanationMode, DisplayMode, FactCard as FactCardType, FactCardAction } from "@/lib/types";
import { resolveWikipediaArticle } from "@/lib/wikipedia";
import { buildSourceSpotlightModel, canonicalWikipediaUrl, locatePassageContext, longestSharedPhraseRange, sourceSpotlightContextKey } from "@/lib/source-spotlight";
import { getSourceSpotlightState, setSourceSpotlightState, subscribeSourceSpotlight, updateSourceSpotlightState, type SpotlightContextState } from "@/lib/source-spotlight-state";
import { cardExplanationFingerprint, getCardExplanationSelection, setCardExplanationSelection, subscribeCardExplanationSelection } from "@/lib/card-explanations";
import { buildCardRevealModel, getCardRevealProgress, revealCardThroughSentence, revealNextCardSentence, showAllCardSentences, startCardReveal, subscribeCardRevealProgress } from "@/lib/card-reveal";
import { Icon } from "./icons";

type FactCardProps = {
  card: FactCardType;
  workspaceId: string;
  displayMode: DisplayMode;
  revealGradually: boolean;
  learnLoading?: boolean;
  questionLoading?: boolean;
  learnError?: string;
  questionError?: string;
  questionDraft?: string;
  questionDetailed?: boolean;
  adaptationLoading?: boolean;
  adaptationErrors: Record<string, string | undefined>;
  hasGeminiKey?: boolean;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean) => void;
  onQuestionDraft: (id: string, value: string) => void;
  onQuestionDetailed: (id: string, value: boolean) => void;
  onAdaptExplanation: (id: string, mode?: CardExplanationMode) => void;
  onOpenSettings: () => void;
};

function updateContext(workspaceId: string, cardId: string, sentenceIndex: number, contextKey: string, next: SpotlightContextState) {
  updateSourceSpotlightState(workspaceId, cardId, (current) => {
    if (!current || current.sentenceIndex !== sentenceIndex || !current.expandedEvidence.includes(contextKey)) return current;
    return { ...current, contexts: { ...current.contexts, [contextKey]: next } };
  });
}

function EvidenceContextLoader({ workspaceId, cardId, sentenceIndex, expanded, evidenceIndex, sourceTitle, storedExtract, quote, section, status }: {
  workspaceId: string;
  cardId: string;
  sentenceIndex: number;
  expanded: boolean;
  evidenceIndex: number;
  sourceTitle: string;
  storedExtract?: string;
  quote: string;
  section?: string;
  status?: SpotlightContextState;
}) {
  useEffect(() => {
    if (!expanded || status && status.status !== "idle") return;
    const controller = new AbortController();
    const contextKey = sourceSpotlightContextKey(evidenceIndex);
    updateContext(workspaceId, cardId, sentenceIndex, contextKey, { status: "loading" });
    const stored = locatePassageContext(storedExtract, quote, section);
    const enoughStoredContext = stored.status === "found" && stored.before && stored.after;
    const load = enoughStoredContext
      ? Promise.resolve(stored)
      : resolveWikipediaArticle(sourceTitle, controller.signal).then((article) => locatePassageContext(article?.extract, quote, section));
    load.then((context) => {
      if (controller.signal.aborted) return;
      updateContext(workspaceId, cardId, sentenceIndex, contextKey, context.status === "found"
        ? { status: "ready", before: context.before, after: context.after }
        : { status: "unverified" });
    }).catch(() => {
      if (controller.signal.aborted) return;
      updateContext(workspaceId, cardId, sentenceIndex, contextKey, { status: "error" });
    });
    return () => {
      controller.abort();
      updateSourceSpotlightState(workspaceId, cardId, (current) => {
        if (!current || current.sentenceIndex !== sentenceIndex || current.contexts[contextKey]?.status !== "loading") return current;
        return { ...current, contexts: { ...current.contexts, [contextKey]: { status: "idle" } } };
      });
    };
  }, [cardId, evidenceIndex, expanded, quote, section, sourceTitle, status?.status === "idle" ? status.attempt : undefined, storedExtract, sentenceIndex, workspaceId]);
  return null;
}

export const FactCard = memo(function FactCard({ card, workspaceId, displayMode, revealGradually, learnLoading, questionLoading, learnError, questionError, questionDraft, questionDetailed, adaptationLoading, adaptationErrors, hasGeminiKey, onAction, onLearnMore, onAskQuestion, onQuestionDraft, onQuestionDetailed, onAdaptExplanation, onOpenSettings }: FactCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [difficultyMenuOpen, setDifficultyMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const difficultyPickerRef = useRef<HTMLDivElement>(null);
  const difficultyTriggerRef = useRef<HTMLButtonElement>(null);
  const difficultyMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuItemsRef = useRef<HTMLDivElement>(null);
  const explanationMode = useSyncExternalStore(
    (listener) => subscribeCardExplanationSelection(workspaceId, card.id, listener),
    () => getCardExplanationSelection(workspaceId, card.id),
    () => undefined
  );
  const spotlight = useSyncExternalStore(
    (listener) => subscribeSourceSpotlight(workspaceId, card.id, listener),
    () => getSourceSpotlightState(workspaceId, card.id),
    () => undefined
  );
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const spotlightModel = useMemo(() => buildSourceSpotlightModel(card), [card]);
  const revealModel = useMemo(() => buildCardRevealModel(card.body, spotlightModel.mapped ? spotlightModel.sentences : undefined), [card.body, spotlightModel]);
  const revealProgress = useSyncExternalStore(
    (listener) => subscribeCardRevealProgress(workspaceId, card.id, listener),
    () => getCardRevealProgress(workspaceId, card.id, revealModel),
    () => undefined
  );
  const graduallyRevealing = !revealProgress?.complete && (Boolean(revealProgress) || revealGradually);
  const visibleSentenceCount = graduallyRevealing ? revealProgress?.visibleCount ?? 0 : revealModel.sentences.length;
  const question = questionDraft ?? card.question ?? "";
  const detailed = questionDetailed ?? Boolean(card.questionDetailed);
  const showImage = displayMode === "picture-text";
  const savedExplanation = explanationMode ? card.explanations?.[explanationMode] : undefined;
  const selectedExplanation = savedExplanation?.fingerprint === cardExplanationFingerprint(card) ? savedExplanation : undefined;
  const adaptationError = explanationMode ? adaptationErrors[`${card.id}:adapt:${explanationMode}`] : undefined;

  useEffect(() => {
    if (!difficultyMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!difficultyPickerRef.current?.contains(event.target as Node)) setDifficultyMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [difficultyMenuOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    moreMenuItemsRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!difficultyMenuOpen) return;
    const options = Array.from(difficultyMenuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']") ?? []);
    const selected = options.find((option) => option.getAttribute("aria-checked") === "true");
    (selected ?? options[0])?.focus();
  }, [difficultyMenuOpen]);

  function chooseExplanation(mode?: CardExplanationMode) {
    setCardExplanationSelection(workspaceId, card.id, mode);
    setDifficultyMenuOpen(false);
    requestAnimationFrame(() => difficultyTriggerRef.current?.focus());
    onAdaptExplanation(card.id, mode);
  }

  function handleDifficultyMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']"));
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + options.length) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      setDifficultyMenuOpen(false);
      difficultyTriggerRef.current?.focus();
      return;
    }
    if (nextIndex !== undefined) {
      event.preventDefault();
      options[nextIndex]?.focus();
    }
  }

  function closeMoreMenu(restoreFocus = false) {
    setMoreMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => moreTriggerRef.current?.focus());
  }

  function handleMoreMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']"));
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + options.length) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMoreMenu(true);
      return;
    }
    if (nextIndex !== undefined) {
      event.preventDefault();
      options[nextIndex]?.focus();
    }
  }

  function chooseMoreAction(action: "reveal" | FactCardAction) {
    closeMoreMenu(true);
    if (action === "reveal") startCardReveal(workspaceId, card.id, revealModel);
    else onAction(card.id, action);
  }

  function submitQuestion() {
    const clean = question.trim();
    if (!clean || questionLoading) return;
    onAskQuestion(card.id, clean, detailed);
  }

  function openSpotlight(sentenceIndex: number, triggerId: string) {
    if (graduallyRevealing && sentenceIndex >= visibleSentenceCount) {
      revealCardThroughSentence(workspaceId, card.id, revealModel, sentenceIndex);
    }
    const current = getSourceSpotlightState(workspaceId, card.id);
    setSourceSpotlightState(workspaceId, card.id, {
      sentenceIndex,
      triggerId,
      expandedEvidence: current?.expandedEvidence ?? [],
      contexts: current?.contexts ?? {}
    });
  }

  function closeSpotlight() {
    const triggerId = getSourceSpotlightState(workspaceId, card.id)?.triggerId;
    setSourceSpotlightState(workspaceId, card.id, undefined);
    requestAnimationFrame(() => triggerRefs.current.get(triggerId ?? "")?.focus());
  }

  function toggleContext(evidenceIndex: number) {
    const contextKey = sourceSpotlightContextKey(evidenceIndex);
    updateSourceSpotlightState(workspaceId, card.id, (current) => {
      if (!current) return current;
      const expanded = current.expandedEvidence.includes(contextKey);
      const expandedEvidence = expanded ? current.expandedEvidence.filter((key) => key !== contextKey) : [...current.expandedEvidence, contextKey];
      const contexts = expanded ? { ...current.contexts, [contextKey]: { status: "idle", attempt: (current.contexts[contextKey]?.status === "idle" ? current.contexts[contextKey].attempt ?? 0 : 0) + 1 } as SpotlightContextState } : current.contexts;
      return { ...current, expandedEvidence, contexts };
    });
  }

  function sourceSentenceIndex(sourceIndex: number) {
    if (spotlight && spotlight.sentenceIndex >= 0 && spotlightModel.groups[spotlight.sentenceIndex]?.some((group) => group.sourceIndex === sourceIndex)) return spotlight.sentenceIndex;
    const earliest = spotlightModel.groups.findIndex((groups) => groups.some((group) => group.sourceIndex === sourceIndex));
    return earliest >= 0 ? earliest : 0;
  }

  function spotlightPanel(sentenceIndex: number, groups: typeof spotlightModel.groups[number], id: string) {
    const isOpen = spotlight?.sentenceIndex === sentenceIndex;
    return (
      <span className="source-spotlight-panel" id={id} role="region" aria-label="Wikipedia source spotlight" hidden={!isOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeSpotlight(); } }}>
        {isOpen && <>
          <span className="source-spotlight-heading"><strong>Source spotlight</strong><button type="button" className="source-spotlight-close" onClick={closeSpotlight} aria-label="Close source spotlight">Close</button></span>
          {groups.map((group) => (
            <span className="source-spotlight-group" key={group.sourceIndex}>
              <span className="source-spotlight-source"><strong>{group.source.title}</strong><a href={canonicalWikipediaUrl(group.source)} target="_blank" rel="noreferrer" aria-label={`Open ${group.source.title} on Wikipedia`}><Icon name="external" size={12} /></a></span>
              {group.evidence.map((evidence) => {
                const contextKey = sourceSpotlightContextKey(evidence.index);
                const context = spotlight.contexts[contextKey];
                const expanded = spotlight.expandedEvidence.includes(contextKey);
                const quote = evidence.quote;
                const highlight = longestSharedPhraseRange(quote, spotlightModel.mapped ? spotlightModel.sentences[sentenceIndex] : "", spotlightModel.mapped ? "" : card.claim ?? "");
                return <Fragment key={evidence.index}>
                  <EvidenceContextLoader workspaceId={workspaceId} cardId={card.id} sentenceIndex={sentenceIndex} expanded={expanded} evidenceIndex={evidence.index} sourceTitle={group.source.title} storedExtract={group.source.extract} quote={quote} section={evidence.section} status={context} />
                  <span className="source-spotlight-quote-wrap">
                    {evidence.section && <span className="source-spotlight-section">{evidence.section}</span>}
                    <span className="source-spotlight-quote">
                      {expanded && context?.status === "ready" && context.before && <><span className="source-spotlight-context">{context.before} </span></>}
                      “{highlight ? <>{quote.slice(0, highlight.start)}<mark>{quote.slice(highlight.start, highlight.end)}</mark>{quote.slice(highlight.end)}</> : quote}”
                      {expanded && context?.status === "ready" && context.after && <><span className="source-spotlight-context"> {context.after}</span></>}
                    </span>
                    <span className="source-spotlight-context-actions">
                      <button type="button" onClick={() => toggleContext(evidence.index)} disabled={context?.status === "loading"}>{expanded ? "Hide context" : "Read around this passage"}</button>
                      {expanded && context?.status === "loading" && <span role="status">Loading nearby text…</span>}
                      {expanded && context?.status === "unverified" && <span className="source-spotlight-note">This article has changed, or this quotation could not be located unambiguously. The saved evidence above is unchanged.</span>}
                      {expanded && context?.status === "error" && <span className="source-spotlight-note">Surrounding text could not be loaded. Your saved evidence is unchanged.</span>}
                      {expanded && (context?.status === "error" || context?.status === "unverified") && <button type="button" onClick={() => updateSourceSpotlightState(workspaceId, card.id, (current) => current ? { ...current, contexts: { ...current.contexts, [contextKey]: { status: "idle", attempt: (current.contexts[contextKey]?.status === "idle" ? current.contexts[contextKey].attempt ?? 0 : 0) + 1 } } } : current)}>Retry</button>}
                    </span>
                  </span>
                </Fragment>;
              })}
            </span>
          ))}
        </>}
      </span>
    );
  }

  const activeSentence = spotlight?.sentenceIndex ?? -1;
  const bodyGroups = spotlightModel.groups;

  return (
    <article className={`fact-card accent-${card.accent} ${card.feedback ? `feedback-${card.feedback}` : ""}`}>
      {card.surprise && <div className="surprise-banner"><Icon name="sparkles" size={14} /> Surprise topic</div>}
      {showImage && (
        <div className={`fact-image ${card.image && !imageFailed ? "has-image" : "no-image"}`}>
          {card.image && !imageFailed ? (
            <img src={card.image.url} alt={card.image.alt} loading="lazy" decoding="async" width="960" height="540" onError={() => setImageFailed(true)} />
          ) : (
            <div className="image-unavailable"><Icon name="image" size={25} /><span>Image unavailable</span></div>
          )}
          <span className="fact-image-label">{card.topicPath[0]}</span>
          {card.image && !imageFailed && <a className="image-credit" href={card.image.filePageUrl ?? card.image.sourceUrl} target="_blank" rel="noreferrer">{card.image.credit ?? "Wikipedia image"}</a>}
        </div>
      )}
      <div className="fact-content">
        <div className="fact-meta">
          <div className="fact-breadcrumbs">{card.topicPath.map((topic) => <span key={topic}>{topic}</span>)}</div>
          <div className="difficulty-picker" ref={difficultyPickerRef} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDifficultyMenuOpen(false);
          }}>
            <button
              type="button"
              ref={difficultyTriggerRef}
              className={`difficulty-mark difficulty-${card.difficulty}`}
              aria-label={`Difficulty ${card.difficulty} of 10 · ${DIFFICULTY_LABELS[card.difficulty]}. Change this card’s explanation.`}
              aria-haspopup="menu"
              aria-expanded={difficultyMenuOpen}
              aria-controls={`difficulty-menu-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              onClick={() => setDifficultyMenuOpen((open) => !open)}
            >Difficulty {card.difficulty} · {DIFFICULTY_LABELS[card.difficulty]}</button>
            {difficultyMenuOpen && <div id={`difficulty-menu-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`} ref={difficultyMenuRef} className="difficulty-menu" role="menu" aria-label="Explanation difficulty" onKeyDown={handleDifficultyMenuKeyDown}>
              {([
                ["simpler", "Simpler"],
                [undefined, "Original"],
                ["deeper", "Deeper"]
              ] as const).map(([mode, label]) => <button type="button" key={label} role="menuitemradio" aria-checked={explanationMode === mode} className={explanationMode === mode ? "selected" : ""} onClick={() => chooseExplanation(mode)}>{label}</button>)}
            </div>}
          </div>
        </div>
        <p className="fact-hook">{card.hook}</p>
        <h3>{card.title}</h3>
        <div className="card-reading-body">
        <p className="fact-body">
          {spotlightModel.mapped ? spotlightModel.sentences.slice(0, visibleSentenceCount).map((sentence, sentenceIndex) => {
            const groups = bodyGroups[sentenceIndex] ?? [];
            const markerId = `sentence-${sentenceIndex}`;
            const panelId = `source-spotlight-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${sentenceIndex}`;
            return <Fragment key={sentenceIndex}>
              {sentenceIndex > 0 && " "}<span className="fact-sentence">{sentence}</span>
              {groups.length > 0 && <button type="button" className="source-citation-marker" ref={(element) => { if (element) triggerRefs.current.set(markerId, element); else triggerRefs.current.delete(markerId); }} data-source-spotlight-trigger="true" aria-label={`Open sources for sentence ${sentenceIndex + 1}`} aria-expanded={activeSentence === sentenceIndex} aria-controls={panelId} onKeyDown={(event) => { if (event.key === "Escape" && spotlight) { event.preventDefault(); closeSpotlight(); } }} onClick={() => openSpotlight(sentenceIndex, markerId)}>{sentenceIndex + 1}</button>}
              {groups.length > 0 && spotlightPanel(sentenceIndex, groups, panelId)}
            </Fragment>;
          }) : <>
            {visibleSentenceCount > 0 ? card.body : null}
            {visibleSentenceCount > 0 && bodyGroups[0]?.length > 0 && <>
              {" "}<button type="button" className="source-citation-marker" ref={(element) => { if (element) triggerRefs.current.set("whole-body", element); else triggerRefs.current.delete("whole-body"); }} data-source-spotlight-trigger="true" aria-label="Open saved sources for this fact" aria-expanded={activeSentence === 0} aria-controls={`source-spotlight-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-whole`} onKeyDown={(event) => { if (event.key === "Escape" && spotlight) { event.preventDefault(); closeSpotlight(); } }} onClick={() => openSpotlight(0, "whole-body")}>1</button>
              {spotlightPanel(0, bodyGroups[0], `source-spotlight-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-whole`)}
            </>}
          </>}
        </p>
        {graduallyRevealing && <div className="card-reveal-controls">
          <button type="button" className="text-button" onClick={() => revealNextCardSentence(workspaceId, card.id, revealModel)}>Keep reading</button>
          <button type="button" className="text-button" onClick={() => showAllCardSentences(workspaceId, card.id, revealModel)}>Show everything</button>
        </div>}
        <span className="sr-only" aria-live="polite" aria-atomic="true">{revealProgress && revealProgress.visibleCount > 0 ? `Revealed: ${revealModel.sentences[revealProgress.visibleCount - 1] ?? ""}` : ""}</span>
        </div>

        {explanationMode && <div className={`learning-answer card-explanation ${selectedExplanation ? `card-explanation-${explanationMode}` : ""}`} aria-live="polite">
          <div className="card-explanation-heading">
            <span className="answer-label"><Icon name="sparkles" size={14} /> {explanationMode === "simpler" ? "Simpler explanation" : "Deeper explanation"}</span>
            <button type="button" className="text-button" onClick={() => chooseExplanation(undefined)}>Return to original</button>
          </div>
          {selectedExplanation ? <>
            <p>{selectedExplanation.text}</p>
            <div className="answer-sources">{selectedExplanation.sources.map((source, index) => <a href={canonicalWikipediaUrl(source)} key={`${source.canonicalUrl ?? source.url}-${index}`} target="_blank" rel="noreferrer">{source.title}<Icon name="external" size={11} /></a>)}</div>
          </> : adaptationLoading ? <div className="learning-loading" role="status"><span className="loading-dot" /> Writing a {explanationMode} version from this card’s sources…</div>
            : !hasGeminiKey ? <div className="card-explanation-settings"><span>Add a Gemini key to create this explanation.</span><button type="button" className="text-button" onClick={onOpenSettings}>Open Settings</button></div>
              : <div className="card-explanation-settings"><span>{adaptationError || "This explanation could not be created."}</span><button type="button" className="text-button" onClick={() => onAdaptExplanation(card.id, explanationMode)}>Retry</button></div>}
        </div>}

        <div className="fact-sources">
          <span>Wikipedia sources</span>
          <div>
            {(card.sources ?? []).slice(0, 3).map((source, sourceIndex) => {
              const hasEvidence = bodyGroups.some((groups) => groups.some((group) => group.sourceIndex === sourceIndex));
              const sentenceIndex = sourceSentenceIndex(sourceIndex);
              const triggerId = `footer-source-${sourceIndex}`;
              const markerId = spotlightModel.mapped ? `source-spotlight-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${sentenceIndex}` : `source-spotlight-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-whole`;
              const active = hasEvidence && spotlight?.sentenceIndex === sentenceIndex;
              return <span className="source-link-controls" key={sourceIndex}>
              {hasEvidence ? <button type="button" className="source-spotlight-link" ref={(element) => { if (element) triggerRefs.current.set(triggerId, element); else triggerRefs.current.delete(triggerId); }} data-source-spotlight-trigger="true" aria-expanded={active} aria-controls={markerId} onKeyDown={(event) => { if (event.key === "Escape" && spotlight) { event.preventDefault(); closeSpotlight(); } }} onClick={() => openSpotlight(sentenceIndex, triggerId)}>{source.title}</button> : <span>{source.title}</span>}
                <a className="source-external-link" href={canonicalWikipediaUrl(source)} target="_blank" rel="noreferrer" aria-label={`Open ${source.title} on Wikipedia`}><Icon name="external" size={12} /></a>
              </span>;
            })}
          </div>
        </div>

        {card.learnMore && <div className="learning-answer learn-more-answer"><span className="answer-label"><Icon name="sparkles" size={14} /> Learn more</span><p>{card.learnMore}</p></div>}
        {learnError && <p className="learning-error">{learnError}</p>}

        <div className="question-box">
          <div className="question-row">
            <input
              value={question}
              onChange={(event) => onQuestionDraft(card.id, event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitQuestion()}
              placeholder="Ask a question about this fact"
              aria-label={`Ask a question about ${card.title}`}
            />
            <button type="button" className={`details-toggle ${detailed ? "selected" : ""}`} onClick={() => onQuestionDetailed(card.id, !detailed)} aria-pressed={detailed}>More Details</button>
            <button type="button" className="question-send" onClick={submitQuestion} disabled={!question.trim() || questionLoading} aria-label="Send question"><Icon name="arrow" size={16} /></button>
          </div>
          {card.answer && <div className="learning-answer question-answer"><span className="answer-label"><Icon name="message" size={14} /> {card.answerDetailed ? "Detailed answer" : "Answer"}</span><p>{card.answer}</p><div className="answer-sources">{card.answerSources?.map((source) => <a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="external" size={11} /></a>)}</div></div>}
          {questionLoading && <div className="learning-loading"><span className="loading-dot" /> Gemini is reading the cited Wikipedia pages</div>}
          {questionError && <p className="learning-error">{questionError}</p>}
        </div>
      </div>
      <div className="fact-actions">
        <button type="button" className="learn-more-button" onClick={() => onLearnMore(card.id)} disabled={learnLoading || Boolean(card.learnMore)}><Icon name="sparkles" size={16} /> <span>{learnLoading ? "Reading" : card.learnMore ? "Learned" : "Learn more"}</span></button>
        <button type="button" className={`feedback-button heard ${card.feedback === "heard" ? "selected" : ""}`} onClick={() => onAction(card.id, "heard")} aria-pressed={card.feedback === "heard"}><Icon name="check" size={15} /> <span>Heard</span></button>
        <button type="button" className={`feedback-button unknown ${card.feedback === "unknown" ? "selected" : ""}`} onClick={() => onAction(card.id, "unknown")} aria-pressed={card.feedback === "unknown"}><Icon name="help" size={15} /> <span>Unknown</span></button>
        <button type="button" className={card.liked ? "active-like" : ""} onClick={() => onAction(card.id, "like")} aria-label={card.liked ? "Unlike fact" : "Like fact"}><Icon name="heart" size={16} fill={card.liked ? "currentColor" : "none"} /> <span>Like</span></button>
        <button type="button" className={card.saved ? "active-save" : ""} onClick={() => onAction(card.id, "save")} aria-label={card.saved ? "Unsave fact" : "Save fact"}><Icon name="bookmark" size={16} fill={card.saved ? "currentColor" : "none"} /> <span>Save</span></button>
        <div className="fact-more-menu" ref={moreMenuRef}>
          <button type="button" ref={moreTriggerRef} className="fact-more-trigger" aria-label="More fact actions" aria-haspopup="menu" aria-expanded={moreMenuOpen} aria-controls={`fact-more-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`} onClick={() => setMoreMenuOpen((open) => !open)}><Icon name="more" size={17} /></button>
          {moreMenuOpen && <div className="fact-more-popover" id={`fact-more-${card.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`} ref={moreMenuItemsRef} role="menu" aria-label="More fact actions" onKeyDown={handleMoreMenuKeyDown}>
            <button type="button" role="menuitem" onClick={() => chooseMoreAction("reveal")}><Icon name="sparkles" size={15} /> Reveal gradually</button>
            <button type="button" role="menuitem" onClick={() => chooseMoreAction("more")}><Icon name="sparkles" size={15} /> More like this</button>
            <button type="button" role="menuitem" onClick={() => chooseMoreAction("rabbit")}><Icon name="arrow" size={15} /> Start rabbit hole</button>
            <button type="button" role="menuitem" onClick={() => chooseMoreAction("less")}><Icon name="minus" size={15} /> Show fewer like this</button>
          </div>}
        </div>
      </div>
    </article>
  );
});
