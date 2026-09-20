"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollectionView } from "@/components/learned-media/CollectionView";
import { ExploreView } from "@/components/learned-media/ExploreView";
import { FeedView } from "@/components/learned-media/FeedView";
import { Navigation } from "@/components/learned-media/Navigation";
import { SettingsView } from "@/components/learned-media/SettingsView";
import { VideoWorkspace } from "@/components/learned-media/VideoWorkspace";
import { SetupWorkspace } from "@/components/learned-media/SetupWorkspace";
import { createDefaultTopics, DEFAULT_SETTINGS } from "@/lib/demo-data";
import { generateGeminiFacts, generateLearningResponse, interpretVideoSearch, rankVideoSearchCandidates, testGeminiKey, type RankedVideoSearchResult, type VideoSearchPlan } from "@/lib/gemini";
import { clearTopicSelections, flattenTopics, migrateTopicTree, selectedLeafCount, selectWeightedTopicPaths, toggleTopicSelection, updateTopicTree } from "@/lib/topic-tree";
import { TOPIC_CATALOG_VERSION, titleCaseTopicLabel } from "@/lib/topic-catalog";
import { DEFAULT_DIFFICULTY, migrateLegacyDifficulty, normalizeDifficulty, recordTopicFeedback } from "@/lib/recommendations";
import { rankSearchResults } from "@/lib/search";
import { isGitHubPagesRuntime } from "@/lib/runtime";
import { APPROVED_YOUTUBE_CHANNELS, DEFAULT_YOUTUBE_WORKSPACE, YouTubeClient, filterYouTubeVideos, loadYouTubeWorkspace, relatedYouTubeVideos, saveYouTubeWorkspace, searchYouTubeCandidates, selectRandomVideos, type YouTubeImportProgress, type YouTubeSearchCandidate, type YouTubeTopic, type YouTubeVideo, type YouTubeWorkspaceState } from "@/lib/youtube";
import type { FactCard, FactCardAction, FeedSettings, GeminiModelCheck, GeminiStatus, LearningMessage, LearningProfile, TopicNode, View, WikipediaSource } from "@/lib/types";

const STORAGE_KEY = "learned-media-state";
const STORAGE_BACKUP_KEY = "learned-media-state-backup";
const LEGACY_STORAGE_KEY = "learned-media-demo-state";
const THEME_MIGRATION_KEY = "learned-media-light-theme-v1";
const TEN_LEVEL_DIFFICULTY_MIGRATION_KEY = "learned-media-ten-level-difficulty-v1";
const PERSISTENCE_VERSION = 1;
const KNOWN_DEMO_IDS = new Set([
  "roman-dodecahedron", "mouse-wood", "roman-concrete", "venus-day", "blue-banana", "antarctic-dry-valleys", "mantis-shrimp", "paper-clip", "honey-never-spoils", "fermi-paradox", "antikythera-mechanism", "quipu", "tyrian-purple", "mechanical-turk", "harvard-mark-ii-bug", "oklo-reactor", "lake-vostok", "axolotl-regeneration", "ada-lovelace-notes", "sagittarius-b2-alcohol", "brinicle", "volcanic-lightning",
  "demo-dodecahedron", "demo-antikythera", "demo-blue-hole", "demo-wasp", "demo-concrete", "demo-jellyfish", "demo-mouse", "demo-whistle"
]);

type PersistedState = {
  persistenceVersion?: number;
  savedAt?: string;
  topics: TopicNode[];
  settings: FeedSettings;
  cards: FactCard[];
  learningProfile: LearningProfile;
  feedStarted: boolean;
  theme: "light" | "dark";
  topicCatalogVersion?: number;
};

function readWorkspaceState() {
  for (const key of [STORAGE_KEY, STORAGE_BACKUP_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const value = window.localStorage.getItem(key);
      if (value) return JSON.parse(value) as Partial<PersistedState>;
    } catch {
      // Try the next local snapshot instead of losing the workspace.
    }
  }
  return null;
}

function writeWorkspaceState(state: PersistedState) {
  const snapshot = JSON.stringify({ ...state, persistenceVersion: PERSISTENCE_VERSION, savedAt: new Date().toISOString() });
  try {
    const previous = window.localStorage.getItem(STORAGE_KEY);
    if (previous) window.localStorage.setItem(STORAGE_BACKUP_KEY, previous);
    window.localStorage.setItem(STORAGE_KEY, snapshot);
  } catch {
    // Local persistence is best effort; a browser quota error must not interrupt reading.
  }
}

async function readNdjson(response: Response, onMessage: (message: Record<string, any>) => void) {
  if (!response.body) {
    onMessage(await response.json() as Record<string, any>);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onMessage(JSON.parse(line) as Record<string, any>);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) onMessage(JSON.parse(buffer) as Record<string, any>);
}

function uniqueSources(sources: WikipediaSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.title || !source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).slice(0, 3);
}

function uniqueCards(cards: FactCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (!card.id || seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function appendUniqueCards(current: FactCard[], next: FactCard[]) {
  return uniqueCards([...current, ...next]);
}

function normalizeHook(value: string) {
  const clean = value.replace(/[.!?]+/g, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 12).join(" ");
  return titleCaseTopicLabel(clean);
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeFact(raw: Partial<FactCard> & { sourceTitle?: string; sourceUrl?: string }, index: number, legacyDifficulty = false): FactCard {
  const sourceTitle = raw.sourceTitle ?? raw.topicPath?.at(-1) ?? "Wikipedia";
  const sourceUrl = raw.sourceUrl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(sourceTitle.replace(/\s+/g, "_"))}`;
  const body = raw.body?.trim() ?? "";
  const sources = uniqueSources(raw.sources?.length ? raw.sources : [{ title: sourceTitle, url: sourceUrl }]);
  const rawDifficulty = legacyDifficulty ? migrateLegacyDifficulty(raw.difficulty ?? raw.obscurity) : raw.difficulty ?? raw.obscurity;
  const difficulty = normalizeDifficulty(rawDifficulty, DEFAULT_DIFFICULTY);
  return {
    id: raw.id ?? `generated-${Date.now()}-${index}`,
    title: raw.title?.trim() ?? "",
    hook: normalizeHook(raw.hook?.trim() || body.split(/[.!?]/)[0]?.split(" ").slice(0, 10).join(" ") || ""),
    body,
    topicPath: raw.topicPath?.length ? raw.topicPath : ["Surprise topic"],
    sources: sources.length ? sources : [{ title: sourceTitle, url: sourceUrl }],
    image: raw.image?.url.startsWith("/") ? undefined : raw.image,
    difficulty,
    obscurity: difficulty,
    accent: raw.accent ?? ["blue", "lilac", "mint", "sand", "coral"][index % 5] as FactCard["accent"],
    feedback: raw.feedback ?? (raw.known ? "heard" : undefined),
    known: raw.known,
    surprise: raw.surprise,
    createdAt: raw.createdAt ?? "Just now",
    learnMore: raw.learnMore,
    question: raw.question,
    answer: raw.answer,
    answerDetailed: raw.answerDetailed,
    answerSources: raw.answerSources ? uniqueSources(raw.answerSources) : undefined,
    questionHistory: raw.questionHistory,
    provenance: raw.provenance
  };
}

function migrateLearningProfile(profile: LearningProfile): LearningProfile {
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, { ...value, targetDifficulty: migrateLegacyDifficulty(value.targetDifficulty) }])) as LearningProfile;
}

export default function HomePage() {
  const [view, setView] = useState<View>("feed");
  const [topics, setTopics] = useState<TopicNode[]>(createDefaultTopics);
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_SETTINGS);
  const [cards, setCards] = useState<FactCard[]>([]);
  const [learningProfile, setLearningProfile] = useState<LearningProfile>({});
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [pendingSlots, setPendingSlots] = useState(10);
  const [feedStarted, setFeedStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [rabbitHole, setRabbitHole] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [apiKey, setApiKey] = useState("");
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus>("not-configured");
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [modelChecks, setModelChecks] = useState<GeminiModelCheck[]>([]);
  const [modelChecking, setModelChecking] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [learnLoading, setLearnLoading] = useState<string | null>(null);
  const [questionLoading, setQuestionLoading] = useState<string | null>(null);
  const [learningErrors, setLearningErrors] = useState<Record<string, string | undefined>>({});
  const [youtubeKey, setYoutubeKey] = useState("");
  const [youtubeStatus, setYoutubeStatus] = useState<"not-configured" | "connecting" | "refreshing" | "connected" | "error">("not-configured");
  const [youtubeProgress, setYoutubeProgress] = useState<YouTubeImportProgress>({ phase: "idle", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0 });
  const [youtubeWorkspace, setYoutubeWorkspace] = useState<YouTubeWorkspaceState>(DEFAULT_YOUTUBE_WORKSPACE);
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<YouTubeVideo[]>([]);
  const [youtubeSmartSearchLoading, setYoutubeSmartSearchLoading] = useState(false);
  const [youtubeSmartSearchRan, setYoutubeSmartSearchRan] = useState(false);
  const [youtubeSearchPhase, setYoutubeSearchPhase] = useState<"idle" | "interpreting" | "checking" | "expanding" | "error">("idle");
  const [youtubeSearchReasons, setYoutubeSearchReasons] = useState<Record<string, RankedVideoSearchResult>>({});
  const [youtubeError, setYoutubeError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const requestGeneration = useRef(0);
  const generationAbortController = useRef<AbortController | null>(null);
  const connectionAbortController = useRef<AbortController | null>(null);
  const learningAbortController = useRef<AbortController | null>(null);
  const questionAbortController = useRef<AbortController | null>(null);
  const youtubeAbortController = useRef<AbortController | null>(null);
  const youtubeSearchAbortController = useRef<AbortController | null>(null);
  const youtubeSearchCache = useRef(new Map<string, { results: YouTubeVideo[]; reasons: Record<string, RankedVideoSearchResult> }>());
  const apiKeyRef = useRef("");
  const sessionIdRef = useRef("browser-" + Math.random().toString(36).slice(2));
  const persistedStateRef = useRef<PersistedState | null>(null);
  const youtubeWorkspaceRef = useRef<YouTubeWorkspaceState>(DEFAULT_YOUTUBE_WORKSPACE);

  const cancelGeneration = useCallback(() => {
    generationAbortController.current?.abort();
    generationAbortController.current = null;
    setLoading(false);
  }, []);

  useEffect(() => () => {
    generationAbortController.current?.abort();
    connectionAbortController.current?.abort();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
  }, []);

  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  useEffect(() => { youtubeWorkspaceRef.current = youtubeWorkspace; }, [youtubeWorkspace]);

  useEffect(() => {
    let active = true;
    void loadYouTubeWorkspace().then((workspace) => {
      if (!active) return;
      youtubeWorkspaceRef.current = workspace;
      setYoutubeWorkspace(workspace);
      if (workspace.videos.length) setYoutubeStatus("connected");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated) void saveYouTubeWorkspace(youtubeWorkspace);
  }, [hydrated, youtubeWorkspace]);

  useEffect(() => {
    try {
      const parsed = readWorkspaceState();
      if (parsed) {
        const migrateTenLevelDifficulty = window.localStorage.getItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY) !== "1";
        const restoredTopics = parsed.topics ? migrateTopicTree(parsed.topics, (parsed.topicCatalogVersion ?? 0) < TOPIC_CATALOG_VERSION) : createDefaultTopics();
        const restoredSettings: FeedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed.settings,
          displayMode: parsed.settings?.displayMode === "text" ? "text" : "picture-text"
        };
        if (migrateTenLevelDifficulty) restoredSettings.obscurity = migrateLegacyDifficulty(parsed.settings?.obscurity);
        const realCards = (parsed.cards ?? []).filter((card) => !KNOWN_DEMO_IDS.has(card.id));
        const restoredCards = uniqueCards(realCards.map((card, index) => normalizeFact(card, index, migrateTenLevelDifficulty)).filter((card) => card.title.trim() && card.body.trim() && card.hook.trim() && card.topicPath.length && card.sources.length));
        const restoredProfile = parsed.learningProfile ? (migrateTenLevelDifficulty ? migrateLearningProfile(parsed.learningProfile) : parsed.learningProfile) : {};
        const restoredTheme = window.localStorage.getItem(THEME_MIGRATION_KEY) === "1" && parsed.theme ? parsed.theme : "light";
        const restoredState: PersistedState = {
          persistenceVersion: PERSISTENCE_VERSION,
          savedAt: parsed.savedAt,
          topics: restoredTopics,
          settings: restoredSettings,
          cards: restoredCards,
          learningProfile: restoredProfile,
          feedStarted: Boolean(parsed.feedStarted && restoredCards.length),
          theme: restoredTheme
        };
        persistedStateRef.current = restoredState;
        setTopics(restoredTopics);
        setSettings(restoredSettings);
        setCards(restoredCards);
        setLearningProfile(restoredProfile);
        setFeedStarted(restoredState.feedStarted);
        setTheme(restoredTheme);
      }
      if (window.localStorage.getItem(THEME_MIGRATION_KEY) !== "1") {
        setTheme("light");
        window.localStorage.setItem(THEME_MIGRATION_KEY, "1");
      }
      if (window.localStorage.getItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY) !== "1") window.localStorage.setItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY, "1");
    } catch {
      // A corrupt local cache should never prevent the app from loading.
    }
    setHydrated(true);
    if (isGitHubPagesRuntime()) {
      setSupabaseConfigured(false);
      return;
    }
    void fetch("/api/status").then((response) => response.json()).then((data: { supabaseConfigured?: boolean }) => {
      setSupabaseConfigured(Boolean(data.supabaseConfigured));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics, settings, cards, learningProfile, feedStarted, theme };
    persistedStateRef.current = state;
    writeWorkspaceState(state);
  }, [cards, feedStarted, hydrated, learningProfile, settings, theme, topics]);

  useEffect(() => {
    if (!hydrated) return;
    const flushWorkspace = () => {
      if (persistedStateRef.current) writeWorkspaceState(persistedStateRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushWorkspace();
    };
    window.addEventListener("pagehide", flushWorkspace);
    window.addEventListener("beforeunload", flushWorkspace);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushWorkspace);
      window.removeEventListener("beforeunload", flushWorkspace);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedCount = useMemo(() => selectedLeafCount(topics), [topics]);
  const allTopicResults = useMemo(() => flattenTopics(topics), [topics]);

  const updateSettings = useCallback((next: Partial<FeedSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
    if (next.obscurity !== undefined) {
      const difficulty = normalizeDifficulty(next.obscurity);
      setLearningProfile((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, unknownStreak: 0, targetDifficulty: difficulty }])) as LearningProfile);
    }
  }, []);

  const handleToggleTopic = useCallback((id: string) => {
    setFeedHasMore(true);
    setTopics((current) => toggleTopicSelection(current, id));
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
    setFeedHasMore(true);
    setCustomTopic("");
    setToast(`${label} added to your topic tree.`);
  }, [customTopic, topics]);

  const startFeed = useCallback(async (rabbitHoleOverride?: string | null, requestedCount = pendingSlots) => {
    if (loading) return;
    if (!selectedCount) {
      setToast("Choose at least one topic before generating more facts.");
      return;
    }
    if (!apiKey.trim() || geminiStatus !== "connected") {
      setToast("Add your Gemini API key in Settings and connect it before starting.");
      setView("settings");
      return;
    }
    generationAbortController.current?.abort();
    const controller = new AbortController();
    const requestId = requestGeneration.current;
    generationAbortController.current = controller;
    setView("feed");
    setFeedStarted(true);
    setLoading(true);
    setToast("");
    setGenerationError("");
    const activeRabbitHole = rabbitHoleOverride ?? rabbitHole;
    const count = Math.max(1, Math.min(10, Math.round(requestedCount || 10)));
    const receivedIds = new Set<string>();
    let finalPayload: { cards?: Partial<FactCard>[]; partial?: boolean; retryGuidance?: string } | undefined;
    let streamError = "";
    try {
      if (isGitHubPagesRuntime()) {
        const result = await generateGeminiFacts({
          apiKey: apiKey.trim(),
          sessionId: sessionIdRef.current,
          topicPaths: selectWeightedTopicPaths(topics, count),
          requestedCount: count,
          settings,
          learningProfile,
          rabbitHole: activeRabbitHole,
          avoid: cards.map((card) => card.title),
          signal: controller.signal,
          onProgress: (event) => {
            if (event.type !== "card") return;
            const card = normalizeFact(event.card, receivedIds.size);
            receivedIds.add(card.id);
            setCards((current) => appendUniqueCards(current, [card]));
          }
        });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        setCards((current) => appendUniqueCards(current, result.cards.map((card, index) => normalizeFact(card, index))));
        if (!result.completedCount) {
          setFeedHasMore(false);
          setPendingSlots(count);
          setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
          setToast("No new complete facts arrived. Retry when you are ready.");
        } else if (result.partial) {
          setFeedHasMore(false);
          setPendingSlots(Math.max(1, count - result.completedCount));
          setGenerationError(result.retryGuidance ?? "Some fact slots failed. Retry to fill the remaining cards.");
          setToast(result.completedCount + " facts arrived. Retry to fill the remaining slots.");
        } else {
          setFeedHasMore(true);
          setPendingSlots(10);
          setGenerationError("");
        }
        return;
      }
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ topics: selectWeightedTopicPaths(topics, count), requestedCount: count, settings, learningProfile, rabbitHole: activeRabbitHole, avoid: cards.map((card) => card.title) }),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Gemini could not generate this batch. Check the key in Settings and try again.");
      }
      await readNdjson(response, (message) => {
        if (message.type === "progress") {
          const event = message.event as { type?: string; card?: Partial<FactCard> };
          if (event.type === "card" && event.card?.id && event.card.title && event.card.body && event.card.hook && event.card.topicPath?.length && event.card.sources?.length) {
            const card = normalizeFact(event.card, receivedIds.size);
            receivedIds.add(card.id);
            setCards((current) => appendUniqueCards(current, [card]));
          }
        } else if (message.type === "complete") {
          finalPayload = message as typeof finalPayload;
        } else if (message.type === "error") {
          streamError = String(message.error ?? "Gemini could not complete this batch.");
        }
      });
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      if (streamError) throw new Error(streamError);
      const generated = (finalPayload?.cards ?? []).filter((card) => Boolean(card.id && card.title?.trim() && card.body?.trim() && card.hook?.trim() && card.topicPath?.length && card.sources?.length)).map((card, index) => normalizeFact(card, index));
      generated.forEach((card) => receivedIds.add(card.id));
      setCards((current) => appendUniqueCards(current, generated));
      if (!receivedIds.size) {
        setFeedHasMore(false);
        setPendingSlots(count);
        setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
        setToast("No new complete facts arrived. Retry when you are ready.");
      } else if (finalPayload?.partial) {
        setFeedHasMore(false);
        setPendingSlots(Math.max(1, count - receivedIds.size));
        setGenerationError(finalPayload.retryGuidance ?? "Some fact slots failed. Retry to fill the remaining cards.");
        setToast(receivedIds.size + " facts arrived. Retry to fill the remaining slots.");
      } else {
        setFeedHasMore(true);
        setPendingSlots(10);
        setGenerationError("");
      }
    } catch (error) {
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      setFeedHasMore(false);
      setPendingSlots(count);
      const message = error instanceof Error ? error.message : "Gemini could not generate this batch. Check the key in Settings and try again.";
      setGenerationError(message);
      setToast(message);
    } finally {
      if (generationAbortController.current === controller) {
        generationAbortController.current = null;
        setLoading(false);
      }
    }
  }, [apiKey, cards, geminiStatus, learningProfile, loading, pendingSlots, rabbitHole, selectedCount, settings, topics]);

  const resetFeed = useCallback(() => {
    cancelGeneration();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    requestGeneration.current += 1;
    const blankTopics = clearTopicSelections(topics);
    setFeedStarted(false);
    setFeedHasMore(true);
    setPendingSlots(10);
    setCards([]);
    setLoading(false);
    setRabbitHole(null);
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setGenerationError("");
    setTopics(blankTopics);
    setView("feed");
    if (hydrated) {
      writeWorkspaceState({ persistenceVersion: PERSISTENCE_VERSION, topics: blankTopics, settings, cards: [], learningProfile, feedStarted: false, theme });
    }
    setToast("Feed reset. Nothing will generate until you press Start again.");
  }, [cancelGeneration, hydrated, learningProfile, settings, theme, topics]);

  const learnMore = useCallback(async (id: string) => {
    const card = cards.find((item) => item.id === id);
    if (!card || card.learnMore || learnLoading) return;
    const requestId = requestGeneration.current;
    const controller = new AbortController();
    learningAbortController.current?.abort();
    learningAbortController.current = controller;
    setLearnLoading(id);
    setLearningErrors((current) => ({ ...current, [`${id}:learn`]: undefined }));
    try {
      if (isGitHubPagesRuntime()) {
        const payload = await generateLearningResponse({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, action: "learn", card, signal: controller.signal });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: payload.answer } : item));
        return;
      }
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ action: "learn", card }),
        signal: controller.signal
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gemini could not expand this fact.");
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: payload.answer } : item));
    } catch (error) {
      if (!controller.signal.aborted && requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [`${id}:learn`]: error instanceof Error ? error.message : "Gemini could not expand this fact." }));
    } finally {
      if (learningAbortController.current === controller) {
        learningAbortController.current = null;
        if (requestGeneration.current === requestId) setLearnLoading(null);
      }
    }
  }, [apiKey, cards, learnLoading]);

  const askQuestion = useCallback(async (id: string, question: string, detailed: boolean) => {
    const card = cards.find((item) => item.id === id);
    if (!card || questionLoading) return;
    const requestId = requestGeneration.current;
    const controller = new AbortController();
    questionAbortController.current?.abort();
    questionAbortController.current = controller;
    const history: LearningMessage[] = card.questionHistory ?? [];
    setQuestionLoading(id);
    setLearningErrors((current) => ({ ...current, [id]: undefined }));
    try {
      if (isGitHubPagesRuntime()) {
        const payload = await generateLearningResponse({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, action: "question", card, question, detailed, history, signal: controller.signal });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        const nextHistory: LearningMessage[] = [...history, { role: "user", content: question }, { role: "assistant", content: payload.answer }];
        setCards((current) => current.map((item) => item.id === id ? { ...item, question, answer: payload.answer, answerDetailed: detailed, answerSources: payload.citations, questionHistory: nextHistory } : item));
        return;
      }
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ action: "question", card, question, detailed, history }),
        signal: controller.signal
      });
      const payload = await response.json() as { answer?: string; citations?: FactCard["sources"]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gemini could not answer this question.");
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      const nextHistory: LearningMessage[] = [...history, { role: "user", content: question }, { role: "assistant", content: payload.answer ?? "" }];
      setCards((current) => current.map((item) => item.id === id ? { ...item, question, answer: payload.answer, answerDetailed: detailed, answerSources: payload.citations, questionHistory: nextHistory } : item));
    } catch (error) {
      if (!controller.signal.aborted && requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Gemini could not answer this question." }));
    } finally {
      if (questionAbortController.current === controller) {
        questionAbortController.current = null;
        if (requestGeneration.current === requestId) setQuestionLoading(null);
      }
    }
  }, [apiKey, cards, questionLoading]);

  const handleCardAction = useCallback((id: string, action: FactCardAction) => {
    if (action === "rabbit") {
      const card = cards.find((item) => item.id === id);
      const nextTopic = card?.topicPath.at(-1) ?? "a nearby idea";
      setRabbitHole(nextTopic);
      setToast(`Rabbit hole mode is following ${nextTopic}.`);
      void startFeed(nextTopic);
      return;
    }
    if (action === "heard" || action === "unknown") {
      const card = cards.find((item) => item.id === id);
      if (!card || card.feedback === action) return;
      const result = recordTopicFeedback(learningProfile, card.topicPath, action, normalizeDifficulty(settings.obscurity));
      setLearningProfile(result.profile);
      setCards((current) => current.map((item) => item.id === id ? { ...item, feedback: action, known: action === "heard" } : item));
      const topic = card.topicPath.at(-1) ?? "this topic";
      if (action === "heard") {
        setToast(result.adjusted ? `Heard — ${topic} is moving to difficulty ${result.targetDifficulty}/10.` : result.targetDifficulty === 10 ? `Heard — ${topic} is already at the hardest level.` : `Heard — we’ll look for harder ${topic} facts next.`);
      } else {
        setToast(result.adjusted ? `Unknown streak reached ${result.threshold}; ${topic} is easing to difficulty ${result.targetDifficulty}/10.` : `Unknown noted — ${topic} will stay here until ${result.threshold} unknowns in a row.`);
      }
      return;
    }
    setCards((current) => current.map((card) => {
      if (card.id !== id) return card;
      if (action === "like") return { ...card, liked: !card.liked };
      if (action === "save") return { ...card, saved: !card.saved };
      if (action === "more") return { ...card, moreLike: true, liked: true };
      return { ...card, lessLike: true };
    }));
    if (action === "more") setToast("Your mix will lean a little closer to this thread.");
    if (action === "less") setToast("We’ll keep this thread quieter for a while.");
  }, [cards, learningProfile, settings.obscurity, startFeed]);

  const resetAllPreferences = useCallback(() => {
    if (!window.confirm("Reset all preferences and return to the default topic mix?")) return;
    cancelGeneration();
    requestGeneration.current += 1;
    setTopics(createDefaultTopics());
    setSettings(DEFAULT_SETTINGS);
    setCards([]);
    setFeedHasMore(true);
    setPendingSlots(10);
    setLearningProfile({});
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setGenerationError("");
    setRabbitHole(null);
    setGenerationError("");
    setTheme("light");
    setView("feed");
    setToast("Preferences restored to the starting mix.");
  }, [cancelGeneration]);

  const deleteLearningData = useCallback(() => {
    if (!window.confirm("Delete saved facts, likes, history, and current feed from this workspace?")) return;
    cancelGeneration();
    requestGeneration.current += 1;
    setCards([]);
    setFeedHasMore(true);
    setLearningProfile({});
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setTopics((current) => clearTopicSelections(current));
    setRabbitHole(null);
    setToast("Learning data cleared. Your topic library and Gemini key were kept.");
  }, [cancelGeneration]);

  const handleApiKeyChange = useCallback((value: string) => {
    apiKeyRef.current = value;
    connectionAbortController.current?.abort();
    generationAbortController.current?.abort();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
    youtubeSearchCache.current.clear();
    requestGeneration.current += 1;
    setApiKey(value);
    setGeminiStatus("not-configured");
    setModelChecks([]);
    setModelChecking(false);
    setLoading(false);
    setLearnLoading(null);
    setQuestionLoading(null);
    setGenerationError("");
  }, []);

  const testConnection = useCallback(async () => {
    const keyAtStart = apiKeyRef.current.trim();
    if (!keyAtStart) {
      setGeminiStatus("not-configured");
      setToast("Paste your Gemini API key first.");
      return;
    }
    connectionAbortController.current?.abort();
    const controller = new AbortController();
    connectionAbortController.current = controller;
    setModelChecking(true);
    setGeminiStatus("testing");
    try {
      if (isGitHubPagesRuntime()) {
        const result = await testGeminiKey(keyAtStart, controller.signal, sessionIdRef.current, (check, readyCount) => {
          setModelChecks((current) => {
            const next = [...current];
            const index = next.findIndex((item) => item?.model === check.model);
            if (index >= 0) next[index] = check;
            else next.push(check);
            return next;
          });
          if (readyCount >= 5) setGeminiStatus("connected");
        });
        if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
        setModelChecks(result.models);
        setGeminiStatus(result.status);
        setToast(result.status === "connected" ? "Gemini connected. At least five allowed models passed." : "Fewer than five allowed models passed. Fix the key or retry the checks.");
        return;
      }
      const response = await fetch("/api/test-connection", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", "x-gemini-api-key": keyAtStart, "x-learned-media-session": sessionIdRef.current }, signal: controller.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Gemini could not verify this key.");
      }
      let finalStatus: GeminiStatus | undefined;
      let finalModels: GeminiModelCheck[] | undefined;
      let streamError = "";
      await readNdjson(response, (message) => {
        if (message.type === "model") {
          const check = message.check as GeminiModelCheck;
          setModelChecks((current) => {
            const next = [...current];
            const index = next.findIndex((item) => item?.model === check.model);
            if (index >= 0) next[index] = check;
            else next.push(check);
            return next;
          });
          if (Number(message.readyCount) >= 5) setGeminiStatus("connected");
        } else if (message.type === "complete") {
          finalStatus = message.status as GeminiStatus;
          finalModels = message.models as GeminiModelCheck[];
        } else if (message.type === "error") {
          streamError = String(message.error ?? "Gemini could not verify this key.");
        }
      });
      if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
      if (streamError) throw new Error(streamError);
      if (finalModels) setModelChecks(finalModels);
      setGeminiStatus(finalStatus ?? "unavailable");
      setToast(finalStatus === "connected" ? "Gemini connected. At least five allowed models passed." : "Fewer than five allowed models passed. Fix the key or retry the checks.");
    } catch (error) {
      if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
      setGeminiStatus("unavailable");
      setModelChecks([]);
      setToast(error instanceof Error ? error.message : "Could not reach the Gemini connection check.");
    } finally {
      if (connectionAbortController.current === controller) {
        connectionAbortController.current = null;
        setModelChecking(false);
      }
    }
  }, []);

  const updateYouTubeWorkspace = useCallback((update: (current: YouTubeWorkspaceState) => YouTubeWorkspaceState) => {
    setYoutubeWorkspace((current) => {
      const next = update(current);
      youtubeWorkspaceRef.current = next;
      void saveYouTubeWorkspace(next);
      return next;
    });
  }, []);

  const connectYouTube = useCallback(async (force = false) => {
    const keyAtStart = youtubeKey.trim();
    if (!keyAtStart) {
      setYoutubeStatus("not-configured");
      setYoutubeError("Paste your YouTube API key first.");
      setToast("Paste your YouTube API key first.");
      setView("settings");
      return;
    }
    if (youtubeAbortController.current) return;
    const controller = new AbortController();
    youtubeAbortController.current = controller;
    setYoutubeStatus(youtubeWorkspaceRef.current.videos.length ? "refreshing" : "connecting");
    setYoutubeError("");
    setYoutubeProgress({ phase: "resolving", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0, completedSources: 0 });
    try {
      const client = new YouTubeClient(keyAtStart);
      const snapshot = youtubeWorkspaceRef.current;
      const result = await client.syncApprovedCatalog(snapshot.channels, controller.signal, (progress) => { if (!controller.signal.aborted && youtubeKey.trim() === keyAtStart) setYoutubeProgress(progress); }, { existingVideos: snapshot.videos, sourceStates: snapshot.sourceStates, force });
      if (controller.signal.aborted || youtubeKey.trim() !== keyAtStart) return;
      updateYouTubeWorkspace((current) => {
        const available = new Set(result.videos.map((video) => video.id));
        const preservedDiscoverIds = current.discoverIds.filter((id) => available.has(id));
        return { ...current, channels: result.channels, videos: result.videos, sourceStates: result.sourceStates, catalogVersion: 3, libraryIncomplete: result.incomplete, lastSyncAt: result.incomplete ? current.lastSyncAt : new Date().toISOString(), discoverIds: preservedDiscoverIds.length ? preservedDiscoverIds : selectRandomVideos(result.videos, 24).map((video) => video.id) };
      });
      youtubeSearchCache.current.clear();
      setYoutubeStatus(result.incomplete ? "error" : "connected");
      setYoutubeError(result.progress.error ?? "");
      setToast(result.incomplete ? "YouTube connected, but some approved channels still need a retry." : "YouTube connected. Your approved video library is ready.");
    } catch (error) {
      if (controller.signal.aborted || youtubeKey.trim() !== keyAtStart) return;
      const message = error instanceof Error ? error.message : "YouTube could not import the approved library.";
      setYoutubeStatus("error");
      setYoutubeError(message);
      setYoutubeProgress((current) => ({ ...current, phase: "error", error: message }));
      setToast(message);
    } finally {
      if (youtubeAbortController.current === controller) youtubeAbortController.current = null;
    }
  }, [updateYouTubeWorkspace, youtubeKey]);

  useEffect(() => {
    if (!youtubeKey.trim() || !["connected", "error"].includes(youtubeStatus)) return;
    const checkForDueSources = () => {
      if (document.visibilityState === "hidden" || youtubeAbortController.current) return;
      const lastSync = youtubeWorkspaceRef.current.lastSyncAt ? new Date(youtubeWorkspaceRef.current.lastSyncAt).getTime() : 0;
      if (!lastSync || Date.now() - lastSync >= 24 * 60 * 60 * 1000) void connectYouTube(false);
    };
    const timer = window.setInterval(checkForDueSources, 60 * 60 * 1000);
    document.addEventListener("visibilitychange", checkForDueSources);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", checkForDueSources); };
  }, [connectYouTube, youtubeKey, youtubeStatus]);

  const handleYouTubeKeyChange = useCallback((value: string) => {
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
    youtubeSearchCache.current.clear();
    setYoutubeKey(value);
    setYoutubeStatus("not-configured");
    setYoutubeError("");
    setYoutubeProgress({ phase: "idle", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0, completedSources: 0 });
  }, []);

  const removeYouTubeKey = useCallback(() => {
    handleYouTubeKeyChange("");
    setToast("YouTube session key removed. Your imported catalog remains local.");
  }, [handleYouTubeKeyChange]);

  const shuffleYouTube = useCallback(() => {
    const pool = filterYouTubeVideos(youtubeWorkspaceRef.current.videos, "", youtubeWorkspaceRef.current.selectedTopic);
    const ids = selectRandomVideos(pool, 24).map((video) => video.id);
    updateYouTubeWorkspace((current) => ({ ...current, activeTab: "discover", selectedVideoId: undefined, selectedChannelId: undefined, discoverIds: ids }));
  }, [updateYouTubeWorkspace]);

  const showMoreYouTube = useCallback(() => {
    const current = youtubeWorkspaceRef.current;
    const pool = filterYouTubeVideos(current.videos, "", current.selectedTopic);
    const next = selectRandomVideos(pool, 24, current.discoverIds);
    updateYouTubeWorkspace((workspace) => ({ ...workspace, activeTab: "discover", discoverIds: [...workspace.discoverIds, ...next.map((video) => video.id)] }));
  }, [updateYouTubeWorkspace]);

  const handleVideoSearch = useCallback((value: string) => {
    youtubeSearchAbortController.current?.abort();
    setYoutubeSearchResults([]);
    setYoutubeSearchReasons({});
    setYoutubeSmartSearchRan(false);
    setYoutubeSearchPhase("idle");
    setYoutubeError("");
    updateYouTubeWorkspace((current) => ({ ...current, searchText: value, selectedVideoId: undefined }));
  }, [updateYouTubeWorkspace]);

  const smartVideoSearch = useCallback(async () => {
    const queryText = youtubeWorkspaceRef.current.searchText.trim();
    if (!queryText) return;
    if (!apiKey.trim() || geminiStatus !== "connected") {
      setToast("Connect Gemini in Settings before using Smart search. Ordinary video search works without it.");
      setView("settings");
      return;
    }
    youtubeSearchAbortController.current?.abort();
    const controller = new AbortController();
    youtubeSearchAbortController.current = controller;
    setYoutubeSmartSearchLoading(true);
    setYoutubeSmartSearchRan(true);
    setYoutubeSearchPhase("interpreting");
    setYoutubeError("");
    setYoutubeSearchReasons({});
    try {
      const interpreted = await interpretVideoSearch({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: queryText, signal: controller.signal });
      if (controller.signal.aborted) return;
      const workspace = youtubeWorkspaceRef.current;
      const cacheKey = [queryText.toLocaleLowerCase(), workspace.selectedTopic, workspace.selectedChannelId ?? "all", workspace.catalogVersion].join("|");
      const cached = youtubeSearchCache.current.get(cacheKey);
      if (cached) {
        setYoutubeSearchResults(cached.results);
        setYoutubeSearchReasons(cached.reasons);
        setYoutubeSearchPhase("idle");
        setToast(`${cached.results.length} relevant approved video${cached.results.length === 1 ? "" : "s"} matched your search.`);
        return;
      }
      const namedChannel = interpreted.plan.channelId
        ? workspace.channels.find((channel) => channel.id === interpreted.plan.channelId)
        : interpreted.plan.channel
          ? workspace.channels.find((channel) => channel.name.toLocaleLowerCase().includes(interpreted.plan.channel!.toLocaleLowerCase()))
          : undefined;
      if ((interpreted.plan.channel || interpreted.plan.channelId) && !namedChannel) {
        setYoutubeSearchResults([]);
        setYoutubeSearchPhase("idle");
        setYoutubeSmartSearchLoading(false);
        setToast("That channel is not in the approved catalog.");
        return;
      }
      const plan: VideoSearchPlan = { ...interpreted.plan, terms: interpreted.plan.terms?.length || interpreted.plan.include?.length || interpreted.plan.conceptGroups?.length ? interpreted.plan.terms : [queryText], channelId: workspace.selectedChannelId ?? namedChannel?.id };
      setYoutubeSearchPhase("checking");
      const rankPass = async (candidates: YouTubeSearchCandidate[]) => {
        const chunks = Array.from({ length: Math.ceil(candidates.length / 40) }, (_, index) => candidates.slice(index * 40, index * 40 + 40));
        const ranked = await Promise.all(chunks.map((chunk) => rankVideoSearchCandidates({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: queryText, plan, candidates: chunk, signal: controller.signal })));
        return ranked.flatMap((batch) => batch.results);
      };
      const initialCandidates = searchYouTubeCandidates(workspace.videos, plan, workspace.selectedTopic, workspace.selectedChannelId, 80);
      let ranked = await rankPass(initialCandidates);
      if (ranked.length < 6 && !controller.signal.aborted) {
        setYoutubeSearchPhase("expanding");
        const expandedCandidates = searchYouTubeCandidates(workspace.videos, plan, workspace.selectedTopic, workspace.selectedChannelId, 80, initialCandidates.map(({ video }) => video.id), true);
        const expanded = await rankPass(expandedCandidates);
        const seen = new Set(ranked.map((match) => match.videoId));
        ranked = ranked.concat(expanded.filter((match) => !seen.has(match.videoId)));
      }
      if (controller.signal.aborted) return;
      const byId = new Map(workspace.videos.map((video) => [video.id, video]));
      const accepted = ranked.filter((match) => byId.has(match.videoId) && !match.videoId.startsWith("demo-"));
      const orderedMatches = [...accepted].sort((left, right) => (left.relevance === right.relevance ? 0 : left.relevance === "direct" ? -1 : 1));
      let orderedVideos = orderedMatches.map((match) => byId.get(match.videoId)).filter((video): video is YouTubeVideo => Boolean(video));
      if (plan.sort === "newest") orderedVideos = [...orderedVideos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      if (plan.sort === "oldest") orderedVideos = [...orderedVideos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
      if (plan.sort === "random") orderedVideos = selectRandomVideos(orderedVideos, orderedVideos.length);
      setYoutubeSearchResults(orderedVideos);
      setYoutubeSearchReasons(Object.fromEntries(accepted.map((match) => [match.videoId, match])));
      youtubeSearchCache.current.set(cacheKey, { results: orderedVideos, reasons: Object.fromEntries(accepted.map((match) => [match.videoId, match])) });
      setYoutubeSearchPhase("idle");
      setYoutubeStatus((current) => current === "not-configured" ? "connected" : current);
      setToast(`${orderedVideos.length} relevant approved video${orderedVideos.length === 1 ? "" : "s"} matched your search.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setYoutubeError(error instanceof Error ? error.message : "Smart video search could not complete.");
      setYoutubeSearchPhase("error");
      setToast(error instanceof Error ? error.message : "Smart video search could not complete.");
    } finally {
      if (youtubeSearchAbortController.current === controller) {
        youtubeSearchAbortController.current = null;
        setYoutubeSmartSearchLoading(false);
      }
    }
  }, [apiKey, geminiStatus, updateYouTubeWorkspace]);

  const cancelSmartVideoSearch = useCallback(() => {
    youtubeSearchAbortController.current?.abort();
    youtubeSearchAbortController.current = null;
    setYoutubeSmartSearchLoading(false);
    setYoutubeSearchPhase("idle");
  }, []);

  const openVideo = useCallback((id: string) => {
    updateYouTubeWorkspace((current) => {
      const history = [{ videoId: id, watchedAt: new Date().toISOString() }, ...current.history.filter((item) => item.videoId !== id)].slice(0, 200);
      return { ...current, selectedVideoId: id, selectedChannelId: undefined, history };
    });
  }, [updateYouTubeWorkspace]);

  const openChannel = useCallback((id: string) => {
    youtubeSearchAbortController.current?.abort();
    setYoutubeSearchResults([]);
    setYoutubeSearchReasons({});
    setYoutubeSmartSearchRan(false);
    setYoutubeSearchPhase("idle");
    updateYouTubeWorkspace((current) => ({ ...current, activeTab: "channels", selectedChannelId: id, selectedVideoId: undefined, searchText: "" }));
  }, [updateYouTubeWorkspace]);

  const saveVideo = useCallback((id: string) => {
    updateYouTubeWorkspace((current) => ({ ...current, savedIds: current.savedIds.includes(id) ? current.savedIds.filter((savedId) => savedId !== id) : [...current.savedIds, id] }));
  }, [updateYouTubeWorkspace]);

  const videoSearchResults = useMemo(() => {
    const workspace = youtubeWorkspace;
    if (workspace.searchText.trim()) return youtubeSmartSearchRan ? youtubeSearchResults : filterYouTubeVideos(workspace.videos, workspace.searchText, workspace.selectedTopic, workspace.selectedChannelId);
    const pool = filterYouTubeVideos(workspace.videos, "", workspace.selectedTopic);
    const byId = new Map(pool.map((video) => [video.id, video]));
    return workspace.discoverIds.map((id) => byId.get(id)).filter((video): video is YouTubeVideo => Boolean(video));
  }, [youtubeSearchResults, youtubeSmartSearchRan, youtubeWorkspace]);

  const filteredCards = useMemo(() => {
    if (!query.trim()) return cards;
    return rankSearchResults(query, cards, (card) => `${card.hook} ${card.title} ${card.body} ${card.topicPath.join(" ")} ${card.sources.map((source) => source.title).join(" ")}`);
  }, [cards, query]);

  const activeCollection = (kind: "saved" | "likes" | "history") => {
    const collection = kind === "saved" ? cards.filter((card) => card.saved) : kind === "likes" ? cards.filter((card) => card.liked) : cards;
    if (!query.trim()) return collection;
    return rankSearchResults(query, collection, (card) => `${card.hook} ${card.title} ${card.body} ${card.topicPath.join(" ")} ${card.sources.map((source) => source.title).join(" ")}`);
  };

  const renderMain = () => {
    if (view === "explore") return <ExploreView onChoose={(topic) => { if (topic === "Custom topic") { setView("feed"); setToast("Add a custom topic from your learning mix."); } else { setQuery(topic); setView("feed"); } }} />;
    if (view === "videos") return <VideoWorkspace workspace={youtubeWorkspace} youtubeStatus={youtubeStatus} progress={youtubeProgress} error={youtubeError} searchResults={videoSearchResults} searchReasons={youtubeSearchReasons} smartSearchLoading={youtubeSmartSearchLoading} searchPhase={youtubeSearchPhase} smartSearchRan={youtubeSmartSearchRan} onOpenSettings={() => setView("settings")} onTabChange={(tab) => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, activeTab: tab, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSearchChange={handleVideoSearch} onSmartSearch={() => void smartVideoSearch()} onCancelSearch={cancelSmartVideoSearch} onTopicChange={(topic) => { cancelSmartVideoSearch(); setYoutubeSearchResults([]); setYoutubeSearchReasons({}); setYoutubeSmartSearchRan(false); setYoutubeSearchPhase("idle"); updateYouTubeWorkspace((current) => ({ ...current, selectedTopic: topic, discoverIds: selectRandomVideos(filterYouTubeVideos(current.videos, "", topic), 24).map((video) => video.id) })); }} onShuffle={shuffleYouTube} onShowMore={showMoreYouTube} onRefreshVideos={() => void connectYouTube(true)} onOpenVideo={openVideo} onOpenChannel={openChannel} onBack={() => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSaveVideo={saveVideo} onPlaybackPosition={(id, seconds) => updateYouTubeWorkspace((current) => ({ ...current, playbackPositions: { ...current.playbackPositions, [id]: seconds } }))} onChannelOrder={(order) => updateYouTubeWorkspace((current) => ({ ...current, channelOrder: order }))} onPauseImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeImport={() => void connectYouTube()} onRetryImport={() => void connectYouTube()} />;
    if (view === "saved" || view === "likes" || view === "history") return <CollectionView kind={view} cards={activeCollection(view)} displayMode={settings.displayMode} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} />;
    if (view === "settings") return <SettingsView apiKey={apiKey} onApiKeyChange={handleApiKeyChange} status={geminiStatus} feedback={toast} modelChecks={modelChecks} modelChecking={modelChecking} onTestConnection={testConnection} onRemoveKey={() => { handleApiKeyChange(""); setToast("Session key removed."); }} theme={theme} onThemeChange={setTheme} onResetAll={resetAllPreferences} onDeleteLearningData={deleteLearningData} onGoogleSignIn={() => { if (supabaseConfigured) window.location.href = "/auth/sign-in"; else setToast("Add Supabase environment variables to enable Google sign-in."); }} youtubeKey={youtubeKey} youtubeStatus={youtubeStatus} youtubeProgress={youtubeProgress} youtubeLastSyncAt={youtubeWorkspace.lastSyncAt} onYoutubeKeyChange={handleYouTubeKeyChange} onConnectYoutube={() => void connectYouTube()} onRefreshYoutube={() => void connectYouTube(true)} onRemoveYoutubeKey={removeYouTubeKey} onPauseYoutubeImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeYoutubeImport={() => void connectYouTube()} onRetryYoutubeImport={() => void connectYouTube()} />;
    if (!feedStarted) return <SetupWorkspace topics={topics} query={query} settings={settings} customTopic={customTopic} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} onSettingsChange={updateSettings} onStart={() => void startFeed()} onOpenSettings={() => setView("settings")} canStart={geminiStatus === "connected"} />;
    return <FeedView cards={filteredCards} query={query} settings={settings} topics={topics} customTopic={customTopic} loading={loading} canLoadMore={feedHasMore && selectedCount > 0} generationError={generationError} rabbitHole={rabbitHole} toast={toast} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onReset={resetFeed} onRetry={() => void startFeed(null, pendingSlots)} onLoadMore={() => void startFeed(null, 10)} onSettingsChange={updateSettings} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} />;
  };

  const searchResults = query.trim() ? rankSearchResults(query, allTopicResults, (topic) => `${topic.path.join(" ")} ${topic.label}`, 6) : [];
  const searchCollection = view === "saved" ? cards.filter((card) => card.saved) : view === "likes" ? cards.filter((card) => card.liked) : cards;
  const factResults = query.trim() ? rankSearchResults(query, searchCollection, (card) => `${card.hook} ${card.title} ${card.body} ${card.topicPath.join(" ")} ${card.sources.map((source) => source.title).join(" ")}`, 6) : [];

  return (
    <div className={`app-frame theme-${theme}`}>
      <Navigation
        view={view}
        onNavigate={(nextView) => { setView(nextView); if (nextView !== "feed") setQuery(""); }}
        onReset={resetFeed}
        query={query}
        onQueryChange={setQuery}
        topicResults={searchResults}
        factResults={factResults}
        onChooseTopic={(label) => { setView("feed"); setQuery(label); }}
        onChooseFact={(title) => { setView("history"); setQuery(title); }}
      />
      <main className="main-column">
        <div className="main-scroll">{renderMain()}</div>
      </main>
    </div>
  );
}
