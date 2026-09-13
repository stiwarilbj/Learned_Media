"use client";

import type { View } from "@/lib/types";
import { Icon, type IconName } from "./icons";

type NavigationProps = { view: View; onNavigate: (view: View) => void; onReset: () => void };

const items: Array<{ id: View; label: string; icon: IconName }> = [
  { id: "feed", label: "Feed", icon: "home" },
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "saved", label: "Saved", icon: "bookmark" },
  { id: "likes", label: "Likes", icon: "heart" },
  { id: "history", label: "History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" }
];

export function Navigation({ view, onNavigate, onReset }: NavigationProps) {
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
        <div className="top-nav-account"><button type="button" className="nav-reset" onClick={onReset}><Icon name="reset" size={15} /> Reset feed</button><button type="button" className="profile-chip" onClick={() => onNavigate("settings")}><span className="profile-avatar">S</span><span className="profile-copy"><strong>Sample learner</strong><small>Demo workspace</small></span><Icon name="chevronDown" size={15} /></button></div>
      </header>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.filter((item) => item.id !== "likes").map((item) => <button type="button" key={item.id} className={`mobile-nav-link ${view === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon name={item.icon} size={19} strokeWidth={1.8} /><span>{item.label}</span></button>)}
      </nav>
    </>
  );
}
