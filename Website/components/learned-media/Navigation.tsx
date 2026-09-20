"use client";

import type { View } from "@/lib/types";
import type { FactCard } from "@/lib/types";
import { Icon, type IconName } from "./icons";

type TopicSearchResult = { id: string; label: string; path: string[] };
type NavigationProps = {
  view: View;
  onNavigate: (view: View) => void;
  onReset: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  topicResults: TopicSearchResult[];
  factResults: Array<Pick<FactCard, "id" | "title">>;
  onChooseTopic: (label: string) => void;
  onChooseFact: (title: string) => void;
};

const items: Array<{ id: View; label: string; icon: IconName }> = [
  { id: "feed", label: "Feed", icon: "home" },
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "saved", label: "Saved", icon: "bookmark" },
  { id: "likes", label: "Likes", icon: "heart" },
  { id: "history", label: "History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" }
];

export function Navigation({ view, onNavigate, onReset, query, onQueryChange, topicResults, factResults, onChooseTopic, onChooseFact }: NavigationProps) {
  return (
    <>
      <header className="top-navigation">
        <button type="button" className="nav-brand" onClick={() => onNavigate("feed")} aria-label="Learned Media home">
          <span className="brand-mark">LM</span>
          <span className="brand-wordmark"><strong>Learned</strong><small>Media</small></span>
        </button>
        <nav className="top-nav-links" aria-label="Primary navigation">
          {items.map((item) => <button type="button" className={`top-nav-link ${view === item.id ? "active" : ""}`} key={item.id} onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon name={item.icon} size={16} strokeWidth={1.9} /><span>{item.label}</span></button>)}
        </nav>
        <div className="top-nav-search">
          <div className="global-search-wrap">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search topics or facts..." aria-label="Search topics or facts" />
            {query && <button type="button" className="clear-search" onClick={() => onQueryChange("")} aria-label="Clear search"><Icon name="x" size={15} /></button>}
            {query && (topicResults.length > 0 || factResults.length > 0) && <div className="search-popover">
              {topicResults.length > 0 && <><span className="search-group-label">Topics</span>{topicResults.map((topic) => <button type="button" key={topic.id} onClick={() => onChooseTopic(topic.label)}><span>{topic.path.join(" → ")}</span><Icon name="arrow" size={14} /></button>)}</>}
              {factResults.length > 0 && <><span className="search-group-label">Past facts</span>{factResults.map((card) => <button type="button" key={card.id} onClick={() => onChooseFact(card.title)}><span>{card.title}</span><Icon name="arrow" size={14} /></button>)}</>}
            </div>}
          </div>
        </div>
        <div className="top-nav-account"><button type="button" className="nav-reset" onClick={onReset}><Icon name="reset" size={15} /> Reset feed</button><button type="button" className="profile-chip" onClick={() => onNavigate("settings")}><span className="profile-avatar">L</span><span className="profile-copy"><strong>Local workspace</strong><small>Not signed in</small></span><Icon name="chevronDown" size={15} /></button></div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.filter((item) => item.id !== "likes").map((item) => <button type="button" key={item.id} className={`mobile-nav-link ${view === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon name={item.icon} size={19} strokeWidth={1.8} /><span>{item.label}</span></button>)}
      </nav>
    </>
  );
}
