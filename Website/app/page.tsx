"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollectionView } from "@/components/learned-media/CollectionView";
import { ExploreView } from "@/components/learned-media/ExploreView";
import { FeedView } from "@/components/learned-media/FeedView";
import { Icon } from "@/components/learned-media/icons";
import { Navigation } from "@/components/learned-media/Navigation";
import { SettingsView } from "@/components/learned-media/SettingsView";
import { SetupWorkspace } from "@/components/learned-media/SetupWorkspace";
import { createDefaultTopics, DEFAULT_SETTINGS, DEMO_FACTS } from "@/lib/demo-data";
import { clearTopicSelections, flattenTopics, updateTopicTree } from "@/lib/topic-tree";
import type { FactCard, FeedSettings, GeminiStatus, LearningMessage, TopicNode, View } from "@/lib/types";

const STORAGE_KEY = "learned-media-demo-state";

type PersistedState = {
  topics: TopicNode[];
  settings: FeedSettings;
  cards: FactCard[];
  feedStarted: boolean;
  theme: "light" | "dark";
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeFact(raw: Partial<FactCard> & { sourceTitle?: string; sourceUrl?: string }, index: number): FactCard {
  const sourceTitle = raw.sourceTitle ?? raw.topicPath?.at(-1) ?? "Wikipedia";
  const sourceUrl = raw.sourceUrl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(sourceTitle.replace(/\s+/g, "_"))}`;
  const body = raw.body ?? "The feed found something interesting, but the explanation is still on its way.";
  return {
    id: raw.id ?? `generated-${Date.now()}-${index}`,
    title: raw.title ?? "A small fact worth keeping",
    hook: raw.hook?.replace(/[.!?]+/g, "").trim() || body.split(/[.!?]/)[0]?.split(" ").slice(0, 10).join(" ") || "A small fact worth keeping",
    body,
    topicPath: raw.topicPath?.length ? raw.topicPath : ["Surprise topic"],
    sources: raw.sources?.length ? raw.sources : [{ title: sourceTitle, url: sourceUrl }],
    image: raw.image?.url.startsWith("/") ? undefined : raw.image,
    obscurity: raw.obscurity ?? 4,
    accent: raw.accent ?? ["blue", "lilac", "mint", "sand", "coral"][index % 5] as FactCard["accent"],
    surprise: raw.surprise,
    createdAt: raw.createdAt ?? "Just now"
  };
}

export default function HomePage() {
  const [view, setView] = useState<View>("feed");
  const [topics, setTopics] = useState<TopicNode[]>(createDefaultTopics);
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_SETTINGS);
  const [cards, setCards] = useState<FactCard[]>([]);
  const [feedStarted, setFeedStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [rabbitHole, setRabbitHole] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [apiKey, setApiKey] = useState("");
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus>("not-configured");
  const [serverConfigured, setServerConfigured] = useState(false);
  const [learnLoading, setLearnLoading] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState<string | null>(null);
  const [learningErrors, setLearningErrors] = useState<Record<string, string | undefined>>({});
  const [hydrated, setHydrated] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PersistedState>;
        if (parsed.topics) setTopics(parsed.topics);
        if (parsed.settings) setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          displayMode: parsed.settings.displayMode === "text" ? "text" : "picture-text"
        });
        if (parsed.cards) setCards(parsed.cards.map((card, index) => normalizeFact(card, index)));
        if (typeof parsed.feedStarted === "boolean") setFeedStarted(parsed.feedStarted);
        if (parsed.theme) setTheme(parsed.theme);
      }
    } catch {
      // A corrupt demo cache should never prevent the app from loading.
    }
    setHydrated(true);
    void fetch("/api/status").then((response) => response.json()).then((data: { geminiConfigured?: boolean }) => {
      if (data.geminiConfigured) {
        setServerConfigured(true);
        setGeminiStatus("connected");
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { topics, settings, cards, feedStarted, theme };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [cards, feedStarted, hydrated, settings, theme, topics]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedTopicPaths = useMemo(() => flattenTopics(topics).filter((topic) => topic.selected).map((topic) => ({ path: topic.path, weight: topic.weight })), [topics]);
  const allTopicResults = useMemo(() => flattenTopics(topics), [topics]);

  const updateSettings = useCallback((next: Partial<FeedSettings>) => setSettings((current) => ({ ...current, ...next })), []);

  const handleToggleTopic = useCallback((id: string) => {
    setTopics((current) => updateTopicTree(current, id, (node) => ({ ...node, selected: !node.selected })));
  }, []);

  const handleExpandTopic = useCallback((id: string) => {
    setTopics((current) => updateTopicTree(current, id, (node) => ({ ...node, expanded: !node.expanded })));
  }, []);

  const handleWeightTopic = useCallback((id: string, delta: number) => {
    setTopics((current) => updateTopicTree(current, id, (node) => ({ ...node, weight: Math.max(5, Math.min(100, node.weight + delta)) })));
  }, []);

  const addCustomTopic = useCallback(() => {
    const label = customTopic.trim();
    if (!label) return;
    const id = `custom-${slugify(label)}`;
    if (flattenTopics(topics).some((topic) => topic.id === id)) {
      setToast("That topic is already in your mix.");
      return;
    }
    setTopics((current) => [...current, { id, label, selected: true, expanded: false, weight: 10, custom: true }]);
    setCustomTopic("");
    setToast(`${label} added to your topic tree.`);
  }, [customTopic, topics]);

  const startFeed = useCallback(async (rabbitHoleOverride?: string | null) => {
    if (loading) return;
    setView("feed");
    setFeedStarted(true);
    setLoading(true);
    setToast("");
    const activeRabbitHole = rabbitHoleOverride ?? rabbitHole;
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, topics: selectedTopicPaths, settings, rabbitHole: activeRabbitHole, avoid: cards.slice(-12).map((card) => card.title) })
      });
      if (!response.ok) throw new Error("generation failed");
      const payload = await response.json() as { cards?: Partial<FactCard>[]; demo?: boolean };
      const generated = (payload.cards ?? []).map(normalizeFact);
      setCards((current) => {
        const next = generated.length ? generated : DEMO_FACTS;
        return current.length ? [...current, ...next] : next;
      });
      if (payload.demo) setToast("Demo feed ready. Add your Gemini key in Settings to generate your own mix.");
    } catch {
      setCards((current) => current.length ? [...current, ...DEMO_FACTS] : DEMO_FACTS);
      setToast("Using a starter batch while Gemini is not connected.");
    } finally {
      setLoading(false);
    }
  }, [apiKey, cards, loading, rabbitHole, selectedTopicPaths, settings]);

  const resetFeed = useCallback(() => {
    requestGeneration.current += 1;
    const blankTopics = clearTopicSelections(topics);
    setFeedStarted(false);
    setCards([]);
    setLoading(false);
    setRabbitHole(null);
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setTopics(blankTopics);
    setView("feed");
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ topics: blankTopics, settings, cards: [], feedStarted: false, theme } satisfies PersistedState));
    }
    setToast("Feed reset. Nothing will generate until you press Start again.");
  }, [hydrated, settings, theme, topics]);

  const learnMore = useCallback(async (id: string) => {
    const card = cards.find((item) => item.id === id);
    if (!card || card.learnMore || learnLoading) return;
    const requestId = requestGeneration.current;
    setLearnLoading(id);
    setLearningErrors((current) => ({ ...current, [`${id}:learn`]: undefined }));
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, action: "learn", card })
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gemini could not expand this fact.");
      if (requestGeneration.current !== requestId) return;
      setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: payload.answer } : item));
    } catch (error) {
      if (requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [`${id}:learn`]: error instanceof Error ? error.message : "Gemini could not expand this fact." }));
    } finally {
      if (requestGeneration.current === requestId) setLearnLoading(null);
    }
  }, [apiKey, cards, learnLoading]);

  const askQuestion = useCallback(async (id: string, question: string, detailed: boolean) => {
    const card = cards.find((item) => item.id === id);
    if (!card || questionLoading) return;
    const requestId = requestGeneration.current;
    const history: LearningMessage[] = card.questionHistory ?? [];
    setQuestionLoading(id);
    setLearningErrors((current) => ({ ...current, [id]: undefined }));
    try {
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, action: "question", card, question, detailed, history })
      });
      const payload = await response.json() as { answer?: string; citations?: FactCard["sources"]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gemini could not answer this question.");
      if (requestGeneration.current !== requestId) return;
      const nextHistory: LearningMessage[] = [...history, { role: "user", content: question }, { role: "assistant", content: payload.answer ?? "" }];
      setCards((current) => current.map((item) => item.id === id ? { ...item, question, answer: payload.answer, answerSources: payload.citations, questionHistory: nextHistory } : item));
    } catch (error) {
      if (requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Gemini could not answer this question." }));
    } finally {
      if (requestGeneration.current === requestId) setQuestionLoading(null);
    }
  }, [apiKey, cards, questionLoading]);

  const handleCardAction = useCallback((id: string, action: "like" | "save" | "more" | "less" | "known" | "rabbit") => {
    if (action === "rabbit") {
      const card = cards.find((item) => item.id === id);
      const nextTopic = card?.topicPath.at(-1) ?? "a nearby idea";
      setRabbitHole(nextTopic);
      setToast(`Rabbit hole mode is following ${nextTopic}.`);
      void startFeed(nextTopic);
      return;
    }
    setCards((current) => current.map((card) => {
      if (card.id !== id) return card;
      if (action === "like") return { ...card, liked: !card.liked };
      if (action === "save") return { ...card, saved: !card.saved };
      if (action === "known") return { ...card, known: true };
      if (action === "more") return { ...card, moreLike: true, liked: true };
      return { ...card, lessLike: true };
    }));
    if (action === "known") setToast("Got it — we’ll steer away from close repeats.");
    if (action === "more") setToast("Your mix will lean a little closer to this thread.");
    if (action === "less") setToast("We’ll keep this thread quieter for a while.");
  }, [cards, startFeed]);

  const resetAllPreferences = useCallback(() => {
    if (!window.confirm("Reset all preferences and return to the default topic mix?")) return;
    setTopics(createDefaultTopics());
    setSettings(DEFAULT_SETTINGS);
    setCards([]);
    requestGeneration.current += 1;
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setRabbitHole(null);
    setTheme("light");
    setView("feed");
    setToast("Preferences restored to the starting mix.");
  }, []);

  const deleteLearningData = useCallback(() => {
    if (!window.confirm("Delete saved facts, likes, history, and current feed from this workspace?")) return;
    setCards([]);
    requestGeneration.current += 1;
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setTopics((current) => clearTopicSelections(current));
    setRabbitHole(null);
    setToast("Learning data cleared. Your topic library and Gemini key were kept.");
  }, []);

  const testConnection = useCallback(async () => {
    if (!apiKey.trim() && !serverConfigured) {
      setGeminiStatus("not-configured");
      setToast("Paste your Gemini API key first.");
      return;
    }
    setGeminiStatus("testing");
    try {
      const response = await fetch("/api/test-connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim() || undefined }) });
      const payload = await response.json() as { status?: GeminiStatus };
      setGeminiStatus(payload.status ?? (response.ok ? "connected" : "unavailable"));
      setToast(response.ok ? "Gemini connection verified." : "Gemini could not verify this key.");
    } catch {
      setGeminiStatus("unavailable");
      setToast("Could not reach the Gemini connection check.");
    }
  }, [apiKey, serverConfigured]);

  const filteredCards = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter((card) => `${card.hook} ${card.title} ${card.body} ${card.topicPath.join(" ")} ${card.sources.map((source) => source.title).join(" ")}`.toLowerCase().includes(term));
  }, [cards, query]);

  const activeCollection = (kind: "saved" | "likes" | "history") => {
    if (kind === "saved") return cards.filter((card) => card.saved);
    if (kind === "likes") return cards.filter((card) => card.liked);
    return cards;
  };

  const renderMain = () => {
    if (view === "explore") return <ExploreView onChoose={(topic) => { if (topic === "Custom topic") { setView("feed"); setToast("Add a custom topic from your learning mix."); } else { setQuery(topic); setView("feed"); } }} />;
    if (view === "saved" || view === "likes" || view === "history") return <CollectionView kind={view} cards={activeCollection(view)} displayMode={settings.displayMode} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} />;
    if (view === "settings") return <SettingsView apiKey={apiKey} onApiKeyChange={setApiKey} status={geminiStatus} serverConfigured={serverConfigured} onTestConnection={testConnection} onRemoveKey={() => { setApiKey(""); setGeminiStatus("not-configured"); setToast("Session key removed."); }} theme={theme} onThemeChange={setTheme} onResetAll={resetAllPreferences} onDeleteLearningData={deleteLearningData} onGoogleSignIn={() => { if (serverConfigured) window.location.href = "/auth/sign-in"; else setToast("Add Supabase environment variables to enable Google sign-in."); }} />;
    if (!feedStarted) return <SetupWorkspace topics={topics} query={query} settings={settings} customTopic={customTopic} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} onSettingsChange={updateSettings} onStart={() => void startFeed()} onOpenSettings={() => setView("settings")} />;
    return <FeedView cards={filteredCards} settings={settings} topics={topics} customTopic={customTopic} loading={loading} rabbitHole={rabbitHole} toast={toast} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onReset={resetFeed} onLoadMore={() => void startFeed()} onSettingsChange={updateSettings} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} />;
  };

  const searchResults = query.trim() ? allTopicResults.filter((topic) => topic.label.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : [];
  const factResults = query.trim() ? cards.filter((card) => `${card.hook} ${card.title} ${card.body} ${card.sources.map((source) => source.title).join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 3) : [];

  return (
    <div className={`app-frame theme-${theme}`}>
      <Navigation view={view} onNavigate={(nextView) => { setView(nextView); if (nextView !== "feed") setQuery(""); }} onReset={resetFeed} />
      <main className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">LM</div><span>Learned Media</span></div>
          <div className="topbar-title"><strong>Learned Media</strong><span>Learn something every time you scroll.</span></div>
          <div className="global-search-wrap">
            <Icon name="search" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics or facts..." aria-label="Search topics or facts" />
            {query && <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="x" size={15} /></button>}
            {query && (searchResults.length > 0 || factResults.length > 0) && <div className="search-popover"><span className="search-group-label">Topics</span>{searchResults.map((topic) => <button type="button" key={topic.id} onClick={() => { setView("feed"); setQuery(topic.label); }}><span>{topic.path.join(" → ")}</span><Icon name="arrow" size={14} /></button>)}{factResults.length > 0 && <><span className="search-group-label">Past facts</span>{factResults.map((card) => <button type="button" key={card.id} onClick={() => { setView("history"); setQuery(card.title); }}><span>{card.title}</span><Icon name="arrow" size={14} /></button>)}</>}</div>}
          </div>
          <button type="button" className="topbar-account" onClick={() => setView("settings")} aria-label="Open account settings"><span className="profile-avatar">S</span><Icon name="chevronDown" size={15} /></button>
        </header>
        <div className="main-scroll">{renderMain()}</div>
      </main>
    </div>
  );
}
