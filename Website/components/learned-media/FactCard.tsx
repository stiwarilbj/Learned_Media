"use client";

import { useState } from "react";
import { DIFFICULTY_LABELS } from "@/lib/recommendations";
import type { DisplayMode, FactCard as FactCardType, FactCardAction } from "@/lib/types";
import { Icon } from "./icons";

type FactCardProps = {
  card: FactCardType;
  displayMode: DisplayMode;
  learnLoading?: boolean;
  questionLoading?: boolean;
  learnError?: string;
  questionError?: string;
  onAction: (id: string, action: FactCardAction) => void;
  onLearnMore: (id: string) => void;
  onAskQuestion: (id: string, question: string, detailed: boolean) => void;
};

export function FactCard({ card, displayMode, learnLoading, questionLoading, learnError, questionError, onAction, onLearnMore, onAskQuestion }: FactCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [question, setQuestion] = useState(card.question ?? "");
  const [detailed, setDetailed] = useState(false);
  const showImage = displayMode === "picture-text";

  function submitQuestion() {
    const clean = question.trim();
    if (!clean || questionLoading) return;
    onAskQuestion(card.id, clean, detailed);
  }

  return (
    <article className={`fact-card accent-${card.accent} ${card.feedback ? `feedback-${card.feedback}` : ""}`}>
      {card.surprise && <div className="surprise-banner"><Icon name="sparkles" size={14} /> Surprise topic</div>}
      {showImage && (
        <div className={`fact-image ${card.image && !imageFailed ? "has-image" : "no-image"}`}>
          {card.image && !imageFailed ? (
            <img src={card.image.url} alt={card.image.alt} loading="lazy" onError={() => setImageFailed(true)} />
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
          <span className={`difficulty-mark difficulty-${card.difficulty}`} aria-label={`Difficulty ${card.difficulty} of 10 · ${DIFFICULTY_LABELS[card.difficulty]}`}>Difficulty {card.difficulty} · {DIFFICULTY_LABELS[card.difficulty]}</span>
        </div>
        <p className="fact-hook">{card.hook}</p>
        <h3>{card.title}</h3>
        <p className="fact-body">{card.body}</p>

        <div className="fact-sources">
          <span>Wikipedia sources</span>
          <div>
            {(card.sources ?? []).slice(0, 3).map((source) => <a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.title}<Icon name="external" size={12} /></a>)}
          </div>
        </div>

        {card.learnMore && <div className="learning-answer learn-more-answer"><span className="answer-label"><Icon name="sparkles" size={14} /> Learn more</span><p>{card.learnMore}</p></div>}
        {learnError && <p className="learning-error">{learnError}</p>}

        <div className="question-box">
          <div className="question-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitQuestion()}
              placeholder="Ask a question about this fact"
              aria-label={`Ask a question about ${card.title}`}
            />
            <button type="button" className={`details-toggle ${detailed ? "selected" : ""}`} onClick={() => setDetailed((value) => !value)} aria-pressed={detailed}>More Details</button>
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
        <details className="fact-more-menu">
          <summary aria-label="More fact actions"><Icon name="more" size={17} /></summary>
          <div className="fact-more-popover">
            <button type="button" onClick={() => onAction(card.id, "more")}><Icon name="sparkles" size={15} /> More like this</button>
            <button type="button" onClick={() => onAction(card.id, "rabbit")}><Icon name="arrow" size={15} /> Start rabbit hole</button>
            <button type="button" onClick={() => onAction(card.id, "less")}><Icon name="minus" size={15} /> Show fewer like this</button>
          </div>
        </details>
      </div>
    </article>
  );
}
