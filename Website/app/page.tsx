"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollectionView } from "@/components/learned-media/CollectionView";
import { ExploreView } from "@/components/learned-media/ExploreView";
import { FeedView } from "@/components/learned-media/FeedView";
import { Icon } from "@/components/learned-media/icons";
import { Navigation } from "@/components/learned-media/Navigation";
import { SettingsView } from "@/components/learned-media/SettingsView";
import { SetupWorkspace } from "@/components/learned-media/SetupWorkspace";
import { createDefaultTopics, DEFAULT_SETTINGS } from "@/lib/demo-data";
import { clearTopicSelections, flattenTopics, migrateTopicTree, selectedLeafCount, selectWeightedTopicPaths, toggleTopicSelection, updateTopicTree } from "@/lib/topic-tree";
import { DEFAULT_DIFFICULTY, migrateLegacyDifficulty, normalizeDifficulty, recordTopicFeedback } from "@/lib/recommendations";
import type { FactCard, FactCardAction, FeedSettings, GeminiModelCheck, GeminiStatus, LearningMessage, LearningProfile, TopicNode, View, WikipediaSource } from "@/lib/types";

const STORAGE_KEY = "learned-media-state";
const LEGACY_STORAGE_KEY = "learned-media-demo-state";
const THEME_MIGRATION_KEY = "learned-media-light-theme-v1";
const TEN_LEVEL_DIFFICULTY_MIGRATION_KEY = "learned-media-ten-level-difficulty-v1";
const KNOWN_DEMO_IDS = new Set([
  "roman-dodecahedron", "mouse-wood", "roman-concrete", "venus-day", "blue-banana", "antarctic-dry-valleys", "mantis-shrimp", "paper-clip", "honey-never-spoils", "fermi-paradox", "antikythera-mechanism", "quipu", "tyrian-purple", "mechanical-turk", "harvard-mark-ii-bug", "oklo-reactor", "lake-vostok", "axolotl-regeneration", "ada-lovelace-notes", "sagittarius-b2-alcohol", "brinicle", "volcanic-lightning",
  "demo-dodecahedron", "demo-antikythera", "demo-blue-hole", "demo-wasp", "demo-concrete", "demo-jellyfish", "demo-mouse", "demo-whistle"
]);

type PersistedState = {
  topics: TopicNode[];
  settings: FeedSettings;
  cards: FactCard[];
  learningProfile: LearningProfile;
  feedStarted: boolean;
  theme: "light" | "dark";
};

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
    hook: raw.hook?.replace(/[.!?]+/g, "").trim() || body.split(/[.!?]/)[0]?.split(" ").slice(0, 10).join(" ") || "",
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
  const [hydrated, setHydrated] = useState(false);
  const requestGeneration = useRef(0);
  const generationAbortController = useRef<AbortController | null>(null);
  const connectionAbortController = useRef<AbortController | null>(null);
  const learningAbortController = useRef<AbortController | null>(null);
  const questionAbortController = useRef<AbortController | null>(null);
  const apiKeyRef = useRef("");
  const sessionIdRef = useRef("browser-" + Math.random().toString(36).slice(2));

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
  }, []);

  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PersistedState>;
        const migrateTenLevelDifficulty = window.localStorage.getItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY) !== "1";
        if (parsed.topics) setTopics(migrateTopicTree(parsed.topics));
        if (parsed.settings) {
          const savedSettings: FeedSettings = {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            displayMode: parsed.settings.displayMode === "text" ? "text" : "picture-text"
          };
          if (migrateTenLevelDifficulty) savedSettings.obscurity = migrateLegacyDifficulty(parsed.settings.obscurity);
          setSettings(savedSettings);
        }
        const realCards = (parsed.cards ?? []).filter((card) => !KNOWN_DEMO_IDS.has(card.id));
        if (parsed.cards) {
          const migratedCards = realCards.map((card, index) => normalizeFact(card, index, migrateTenLevelDifficulty)).filter((card) => card.title.trim() && card.body.trim() && card.hook.trim() && card.topicPath.length && card.sources.length);
          setCards(uniqueCards(migratedCards));
        }
        if (parsed.learningProfile) setLearningProfile(migrateTenLevelDifficulty ? migrateLearningProfile(parsed.learningProfile) : parsed.learningProfile);
        if (typeof parsed.feedStarted === "boolean") setFeedStarted(Boolean(parsed.feedStarted && realCards.length));
        if (window.localStorage.getItem(THEME_MIGRATION_KEY) === "1" && parsed.theme) setTheme(parsed.theme);
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
    void fetch("/api/status").then((response) => response.json()).then((data: { supabaseConfigured?: boolean }) => {
      setSupabaseConfigured(Boolean(data.supabaseConfigured));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { topics, settings, cards, learningProfile, feedStarted, theme };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [cards, feedStarted, hydrated, learningProfile, settings, theme, topics]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedCount = useMemo(() => selectedLeafCount(topics), [topics]);
  const allTopicResults = useMemo(() => flattenTopics(topics), [topics]);

  const updateSettings = useCallback((next: Partial<FeedSettings>) => setSettings((current) => ({ ...current, ...next })), []);

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

  const startFeed = useCallback(async (rabbitHoleOverride?: string | null) => {
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
    const receivedIds = new Set<string>();
    let finalPayload: { cards?: Partial<FactCard>[]; partial?: boolean; retryGuidance?: string } | undefined;
    let streamError = "";
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ topics: selectWeightedTopicPaths(topics, 10), settings, learningProfile, rabbitHole: activeRabbitHole, avoid: cards.slice(-12).map((card) => card.title) }),
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
        setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
        setToast("No new complete facts arrived. Retry when you are ready.");
      } else if (finalPayload?.partial) {
        setFeedHasMore(false);
        setGenerationError(finalPayload.retryGuidance ?? "Some fact slots failed. Retry to fill the remaining cards.");
        setToast(receivedIds.size + " facts arrived. Retry to fill the remaining slots.");
      } else {
        setFeedHasMore(true);
        setGenerationError("");
      }
    } catch (error) {
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      setFeedHasMore(false);
      const message = error instanceof Error ? error.message : "Gemini could not generate this batch. Check the key in Settings and try again.";
      setGenerationError(message);
      setToast(message);
    } finally {
      if (generationAbortController.current === controller) {
        generationAbortController.current = null;
        setLoading(false);
      }
    }
  }, [apiKey, cards, geminiStatus, learningProfile, loading, rabbitHole, selectedCount, settings, topics]);

  const resetFeed = useCallback(() => {
    cancelGeneration();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    requestGeneration.current += 1;
    const blankTopics = clearTopicSelections(topics);
    setFeedStarted(false);
    setFeedHasMore(true);
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ topics: blankTopics, settings, cards: [], learningProfile, feedStarted: false, theme } satisfies PersistedState));
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
    if (view === "settings") return <SettingsView apiKey={apiKey} onApiKeyChange={handleApiKeyChange} status={geminiStatus} feedback={toast} modelChecks={modelChecks} modelChecking={modelChecking} onTestConnection={testConnection} onRemoveKey={() => { handleApiKeyChange(""); setToast("Session key removed."); }} theme={theme} onThemeChange={setTheme} onResetAll={resetAllPreferences} onDeleteLearningData={deleteLearningData} onGoogleSignIn={() => { if (supabaseConfigured) window.location.href = "/auth/sign-in"; else setToast("Add Supabase environment variables to enable Google sign-in."); }} />;
    if (!feedStarted) return <SetupWorkspace topics={topics} query={query} settings={settings} customTopic={customTopic} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} onSettingsChange={updateSettings} onStart={() => void startFeed()} onOpenSettings={() => setView("settings")} canStart={geminiStatus === "connected"} />;
    return <FeedView cards={filteredCards} settings={settings} topics={topics} customTopic={customTopic} loading={loading} canLoadMore={feedHasMore && selectedCount > 0} generationError={generationError} rabbitHole={rabbitHole} toast={toast} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onReset={resetFeed} onRetry={() => void startFeed()} onLoadMore={() => void startFeed()} onSettingsChange={updateSettings} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onWeightTopic={handleWeightTopic} />;
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
