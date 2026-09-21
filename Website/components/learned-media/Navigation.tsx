"use client";

import { useState } from "react";
import type { View } from "@/lib/types";
import type { FactCard } from "@/lib/types";
import { Icon, type IconName } from "./icons";
import type { WorkspaceSummary } from "@/lib/workspaces";

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
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  onSwitchWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onMoveWorkspace: (id: string, direction: "up" | "down") => void;
};

const items: Array<{ id: View; label: string; icon: IconName }> = [
  { id: "feed", label: "Feed", icon: "home" },
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "videos", label: "Videos", icon: "image" },
  { id: "saved", label: "Saved", icon: "bookmark" },
  { id: "likes", label: "Likes", icon: "heart" },
  { id: "history", label: "History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" }
];

export function Navigation({ view, onNavigate, onReset, query, onQueryChange, topicResults, factResults, onChooseTopic, onChooseFact, workspaceId, workspaceName, workspaces, onSwitchWorkspace, onCreateWorkspace, onRenameWorkspace, onDeleteWorkspace, onMoveWorkspace }: NavigationProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  return (
    <>
      <header className="top-navigation">
        <button type="button" className="nav-brand" onClick={() => onNavigate("feed")} aria-label="Learned Media home">
          <span className="brand-mark">LM</span>
          <span className="brand-wordmark"><strong>Learned Media</strong></span>
        </button>
        <nav className="top-nav-links" aria-label="Primary navigation">
          {items.map((item) => <button type="button" className={`top-nav-link ${view === item.id ? "active" : ""}`} key={item.id} onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon name={item.icon} size={16} strokeWidth={1.9} /><span>{item.label}</span></button>)}
        </nav>
        <div className="top-nav-search">
          <div className="global-search-wrap">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search topics or facts" aria-label="Search topics or facts" />
            {query && <button type="button" className="clear-search" onClick={() => onQueryChange("")} aria-label="Clear search"><Icon name="x" size={15} /></button>}
            {query && (topicResults.length > 0 || factResults.length > 0) && <div className="search-popover">
              {topicResults.length > 0 && <><span className="search-group-label">Topics</span>{topicResults.map((topic) => <button type="button" key={topic.id} onClick={() => onChooseTopic(topic.label)}><span>{topic.path.join(" → ")}</span><Icon name="arrow" size={14} /></button>)}</>}
              {factResults.length > 0 && <><span className="search-group-label">Facts</span>{factResults.map((card) => <button type="button" key={card.id} onClick={() => onChooseFact(card.title)}><span>{card.title}</span><Icon name="arrow" size={14} /></button>)}</>}
            </div>}
          </div>
        </div>
        <div className="top-nav-account"><button type="button" className="nav-reset" onClick={onReset}><Icon name="reset" size={15} /> Reset feed</button><div className="workspace-switcher"><button type="button" className="profile-chip" onClick={() => setWorkspaceOpen((open) => !open)} aria-expanded={workspaceOpen} aria-label="Open workspace manager"><span className="profile-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{workspaceName}</strong><small>{workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}</small></span><Icon name="chevronDown" size={15} /></button>{workspaceOpen && <div className="workspace-menu" role="menu"><span className="workspace-menu-label">All workspaces</span>{workspaces.map((workspace, index) => <div className="workspace-menu-row" key={workspace.id}><button type="button" role="menuitem" className={workspace.id === workspaceId ? "active" : ""} onClick={() => { onSwitchWorkspace(workspace.id); setWorkspaceOpen(false); }}>{workspace.name}</button><div className="workspace-menu-row-actions"><button type="button" onClick={() => onMoveWorkspace(workspace.id, "up")} disabled={index === 0} aria-label={`Move ${workspace.name} up`}>↑</button><button type="button" onClick={() => onMoveWorkspace(workspace.id, "down")} disabled={index === workspaces.length - 1} aria-label={`Move ${workspace.name} down`}>↓</button><button type="button" onClick={() => onRenameWorkspace(workspace.id)} aria-label={`Rename ${workspace.name}`}>Rename</button><button type="button" onClick={() => onDeleteWorkspace(workspace.id)} aria-label={`Delete ${workspace.name}`}>Delete</button></div></div>)}<div className="workspace-menu-actions"><button type="button" onClick={() => { onCreateWorkspace(); setWorkspaceOpen(false); }}>Create workspace</button></div></div>}</div></div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.filter((item) => item.id !== "likes").map((item) => <button type="button" key={item.id} className={`mobile-nav-link ${view === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon name={item.icon} size={19} strokeWidth={1.8} /><span>{item.label}</span></button>)}
      </nav>
    </>
  );
}
