"use client";

import { EXPLORE_CATEGORIES } from "@/lib/demo-data";
import { Icon } from "./icons";

type ExploreViewProps = { onChoose: (topic: string) => void };

export function ExploreView({ onChoose }: ExploreViewProps) {
  return (
    <section className="content-view explore-view">
      <div className="view-heading"><div><span className="eyebrow">Explore the edges</span><h1>Find a thread worth following.</h1><p>Start with a broad idea, then keep narrowing until it feels like yours.</p></div><button type="button" className="secondary-button" onClick={() => onChoose("Custom topic")}><Icon name="plus" size={16} /> Add custom topic</button></div>
      <div className="explore-grid">
        {EXPLORE_CATEGORIES.map((category) => (
          <article className={`explore-card ${category.tone}`} key={category.label}>
            <div className="explore-card-top"><span className="explore-symbol"><Icon name={category.label === "Science" ? "flask" : category.label === "History" ? "history" : category.label === "Geography" ? "compass" : "sparkles"} size={18} /></span><Icon name="arrow" size={18} /></div>
            <h2>{category.label}</h2><p>{category.description}</p>
            <div className="explore-topics">{category.topics.map((topic) => <button type="button" key={topic} onClick={() => onChoose(topic)}>{topic}<Icon name="arrow" size={13} /></button>)}</div>
          </article>
        ))}
      </div>
      <div className="explore-callout"><div className="callout-icon"><Icon name="sparkles" size={18} /></div><div><strong>Want something more specific?</strong><p>Add a custom topic like “Formula 1 engineering” or “forgotten 20th-century patents.”</p></div><button type="button" className="text-button" onClick={() => onChoose("Custom topic")}>Make one <Icon name="arrow" size={15} /></button></div>
    </section>
  );
}
