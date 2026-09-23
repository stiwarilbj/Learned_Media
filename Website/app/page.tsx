"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CollectionView } from "@/components/learned-media/CollectionView";
import { ExploreView } from "@/components/learned-media/ExploreView";
import { FeedView } from "@/components/learned-media/FeedView";
import { Navigation } from "@/components/learned-media/Navigation";
import { Icon } from "@/components/learned-media/icons";
import { SettingsView } from "@/components/learned-media/SettingsView";
import { VideoWorkspace } from "@/components/learned-media/VideoWorkspace";
import { SetupWorkspace } from "@/components/learned-media/SetupWorkspace";
import { readRememberedKey, saveRememberedKey } from "@/lib/remembered-keys";
import { rememberFact, mergeFactMemory, isRepeatedFact, hasExactSentenceCount, normalizeSentenceLength, type FactMemory } from "@/lib/fact-quality";
import { createDefaultTopics, DEFAULT_SETTINGS } from "@/lib/demo-data";
import { ALLOWED_GEMINI_MODELS, generateGeminiFacts, generateLearningResponse, interpretNaturalSearch, interpretVideoSearch, rankVideoSearchCandidates, REQUIRED_WORKING_MODELS, testGeminiKey, type RankedVideoSearchResult, type VideoSearchPlan } from "@/lib/gemini";
import { clearTopicSelections, collapseTopicBranches, flattenTopics, migrateTopicTree, removeTopicTree, selectedLeafCount, selectWeightedTopicPaths, selectionState, toggleTopicSelection, updateTopicTree } from "@/lib/topic-tree";
import { TOPIC_CATALOG_VERSION, titleCaseTopicLabel } from "@/lib/topic-catalog";
import { DEFAULT_DIFFICULTY, migrateLegacyDifficulty, normalizeDifficulty, recordTopicFeedback } from "@/lib/recommendations";
import { normalizeSearchText, rankSearchResults } from "@/lib/search";
import { createTopicSuggestionIndex, suggestTopics } from "@/lib/topic-suggestions";
import { isGitHubPagesRuntime } from "@/lib/runtime";
import { accountWorkspaceBackup, makeWorkspaceId, nextLocalWorkspaceName, readWorkspaceStore, writeWorkspaceStore, type WorkspaceRecord, type WorkspaceStore, type WorkspaceSummary } from "@/lib/workspaces";
import { CLOUD_PUBLIC_KEY, CLOUD_URL, cloudClient, googleSignIn, WorkspaceCloudSync, type CloudAccount } from "@/lib/cloud-sync";
import { mergeRecords, type CloudRecord } from "@/lib/cloud-records";
import { APPROVED_YOUTUBE_CHANNELS, DEFAULT_YOUTUBE_WORKSPACE, YouTubeClient, filterYouTubeVideos, loadYouTubeWorkspace, relatedYouTubeVideos, saveYouTubeWorkspace, searchYouTubeCandidates, selectRandomVideos, type YouTubeImportProgress, type YouTubeSearchCandidate, type YouTubeTopic, type YouTubeVideo, type YouTubeWorkspaceState } from "@/lib/youtube";
import { wikipediaEvidenceLink } from "@/lib/wikipedia";
import type { FactCard, FactCardAction, FeedSettings, GeminiModelCheck, GeminiModelOutcome, GeminiStatus, LearningMessage, LearningProfile, TopicNode, View, WikipediaSource } from "@/lib/types";

const STORAGE_KEY = "learned-media-state";
const STORAGE_BACKUP_KEY = "learned-media-state-backup";
const LEGACY_STORAGE_KEY = "learned-media-demo-state";
const THEME_MIGRATION_KEY = "learned-media-light-theme-v1";
const TEN_LEVEL_DIFFICULTY_MIGRATION_KEY = "learned-media-ten-level-difficulty-v1";
const PERSISTENCE_VERSION = 2;
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
  youtubeActivity?: YouTubeWorkspaceActivity;
};

type YouTubeWorkspaceActivity = Pick<YouTubeWorkspaceState, "savedIds" | "history" | "playbackPositions" | "searchText" | "selectedTopic" | "activeTab" | "selectedChannelId" | "selectedVideoId" | "discoverIds" | "channelOrder">;

type AppWorkspaceRecord = WorkspaceRecord<PersistedState>;
type AppWorkspaceStore = WorkspaceStore<PersistedState>;
type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
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

function mergeGeminiModelOutcome(current: GeminiModelCheck[], outcome: GeminiModelOutcome) {
  const previous = current.find((model) => model.model === outcome.model);
  const nextCheck: GeminiModelCheck = {
    model: outcome.model,
    status: outcome.status === "success" ? "working" : outcome.status,
    latencyMs: outcome.latencyMs,
    checkedAt: new Date().toISOString(),
    ...(outcome.resolvedModel || previous?.resolvedModel ? { resolvedModel: outcome.resolvedModel ?? previous?.resolvedModel } : {}),
    ...(outcome.error ? { error: outcome.error } : {})
  };
  const next = current.filter((model) => model.model !== outcome.model);
  next.push(nextCheck);
  return next.sort((left, right) => ALLOWED_GEMINI_MODELS.indexOf(left.model as typeof ALLOWED_GEMINI_MODELS[number]) - ALLOWED_GEMINI_MODELS.indexOf(right.model as typeof ALLOWED_GEMINI_MODELS[number]));
}

function youtubeActivityOf(workspace: YouTubeWorkspaceState): YouTubeWorkspaceActivity {
  return {
    savedIds: workspace.savedIds,
    history: workspace.history,
    playbackPositions: workspace.playbackPositions,
    searchText: workspace.searchText,
    selectedTopic: workspace.selectedTopic,
    activeTab: workspace.activeTab,
    selectedChannelId: workspace.selectedChannelId,
    selectedVideoId: workspace.selectedVideoId,
    discoverIds: workspace.discoverIds,
    channelOrder: workspace.channelOrder
  };
}

function applyYouTubeActivity(workspace: YouTubeWorkspaceState, activity?: YouTubeWorkspaceActivity): YouTubeWorkspaceState {
  return activity ? { ...workspace, ...activity } : workspace;
}

function makeLocalWorkspace(state: PersistedState): AppWorkspaceRecord {
  const now = new Date().toISOString();
  return { id: "local-workspace", name: "Local Workspace", createdAt: now, updatedAt: now, state };
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
  const clean = value.replace(/[.]+$/, "").replace(/\s+/g, " ").trim();
  return titleCaseTopicLabel(clean);
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeFact(raw: Partial<FactCard> & { sourceTitle?: string; sourceUrl?: string }, index: number, legacyDifficulty = false): FactCard {
  const sourceTitle = raw.sourceTitle ?? raw.topicPath?.at(-1) ?? "Wikipedia";
  const sourceUrl = raw.sourceUrl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(sourceTitle.replace(/\s+/g, "_"))}`;
  const body = raw.body?.trim() ?? "";
  const storedSources = raw.sources?.length ? raw.sources : [{ title: sourceTitle, url: sourceUrl }];
  const linkedSources = storedSources.map((source, sourceIndex) => {
    const canonicalUrl = source.canonicalUrl ?? source.url.split("#", 1)[0];
    const quote = raw.evidence?.find((item) => item.sourceIndex === sourceIndex)?.quote;
    return quote && !source.url.includes("#:~:text=") ? { ...source, canonicalUrl, url: wikipediaEvidenceLink(canonicalUrl, quote) } : source;
  });
  const sources = uniqueSources(linkedSources);
  const rawDifficulty = legacyDifficulty ? migrateLegacyDifficulty(raw.difficulty ?? raw.obscurity) : raw.difficulty ?? raw.obscurity;
  const difficulty = normalizeDifficulty(rawDifficulty, DEFAULT_DIFFICULTY);
  return {
    id: raw.id ?? `generated-${Date.now()}-${index}`,
    title: raw.title?.trim() ?? "",
    hook: normalizeHook(raw.hook?.trim() || body.split(/[.!?]/)[0]?.split(" ").slice(0, 10).join(" ") || ""),
    body,
    sentenceCount: normalizeSentenceLength(raw.sentenceCount ?? body.match(/[.!?](?=(?:["'”’»)]|\s|$))/g)?.length),
    claim: raw.claim,
    evidence: raw.evidence,
    liked: raw.liked,
    saved: raw.saved,
    moreLike: raw.moreLike,
    lessLike: raw.lessLike,
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
  const [workspaceId, setWorkspaceId] = useState("local-workspace");
  const [workspaceName, setWorkspaceName] = useState("Local Workspace");
  const [workspaceSummaries, setWorkspaceSummaries] = useState<WorkspaceSummary[]>([{ id: "local-workspace", name: "Local Workspace", createdAt: "", updatedAt: "" }]);
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
  const [semanticSearch, setSemanticSearch] = useState<{ query: string; terms: string[] }>({ query: "", terms: [] });
  const [customTopic, setCustomTopic] = useState("");
  const [rabbitHole, setRabbitHole] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [apiKey, setApiKey] = useState("");
  const [keysHydrated, setKeysHydrated] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus>("not-configured");
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [syncStatus, setSyncStatus] = useState<"signed-out" | "syncing" | "synced" | "offline" | "error">("signed-out");
  const [syncError, setSyncError] = useState("");
  const [modelChecks, setModelChecks] = useState<GeminiModelCheck[]>(() => ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" })));
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
  const [showGoToTop, setShowGoToTop] = useState(false);
  const requestGeneration = useRef(0);
  const generationAbortController = useRef<AbortController | null>(null);
  const connectionAbortController = useRef<AbortController | null>(null);
  const learningAbortController = useRef<AbortController | null>(null);
  const questionAbortController = useRef<AbortController | null>(null);
  const youtubeAbortController = useRef<AbortController | null>(null);
  const youtubeSearchAbortController = useRef<AbortController | null>(null);
  const globalSearchAbortController = useRef<AbortController | null>(null);
  const youtubeSearchCache = useRef(new Map<string, { results: YouTubeVideo[]; reasons: Record<string, RankedVideoSearchResult> }>());
  const youtubeCatalogLoadedRef = useRef(false);
  const apiKeyRef = useRef("");
  const sessionIdRef = useRef("browser-" + Math.random().toString(36).slice(2));
  const persistedStateRef = useRef<PersistedState | null>(null);
  const youtubeWorkspaceRef = useRef<YouTubeWorkspaceState>(DEFAULT_YOUTUBE_WORKSPACE);
  const workspaceStoreRef = useRef<AppWorkspaceStore | null>(null);
  const workspaceIdRef = useRef("local-workspace");
  const workspaceNameRef = useRef("Local Workspace");
  const workspaceEpochRef = useRef(0);
  const keyEditEpoch = useRef(0);
  const factMemoryRef = useRef<FactMemory[]>([]);
  const cloudSyncRef = useRef<WorkspaceCloudSync | null>(null);
  const cloudAbortController = useRef<AbortController | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudEpoch = useRef(0);
  const cloudUserId = useRef<string | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  // This history is used only on this device. It is never supplied to Gemini.
  const archiveFacts = useCallback((incoming: FactCard[]) => {
    factMemoryRef.current = mergeFactMemory(factMemoryRef.current, incoming.map(rememberFact));
    if (workspaceStoreRef.current) workspaceStoreRef.current.factMemory = factMemoryRef.current;
  }, []);
  const acceptFact = useCallback((card: FactCard) => {
    if (!hasExactSentenceCount(card.body, settings.sentenceLength)) return false;
    const next = rememberFact(card);
    if (factMemoryRef.current.some(old => isRepeatedFact(next, old))) return false;
    archiveFacts([card]);
    setCards(current => appendUniqueCards(current, [card]));
    return true;
  }, [archiveFacts, settings.sentenceLength]);

  const cancelGeneration = useCallback(() => {
    generationAbortController.current?.abort();
    generationAbortController.current = null;
    setLoading(false);
  }, []);

  const cancelWorkspaceRequests = useCallback(() => {
    generationAbortController.current?.abort();
    connectionAbortController.current?.abort();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
    globalSearchAbortController.current?.abort();
    cloudAbortController.current?.abort();
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = null;
    requestGeneration.current += 1;
    workspaceEpochRef.current += 1;
    setLoading(false);
    setLearnLoading(null);
    setQuestionLoading(null);
    setYoutubeSmartSearchLoading(false);
  }, []);

  const scheduleCloudSave = useCallback(() => {
    if (!hydrated || !cloudSyncRef.current || !workspaceStoreRef.current || !cloudUserId.current) return;
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = window.setTimeout(() => {
      cloudSaveTimer.current = null;
      const sync = cloudSyncRef.current;
      const store = workspaceStoreRef.current;
      const userId = cloudUserId.current;
      if (!sync || !store || !userId || store.ownerId !== userId) return;
      const epoch = cloudEpoch.current;
      const controller = new AbortController();
      cloudAbortController.current?.abort();
      cloudAbortController.current = controller;
      setSyncStatus("syncing");
      void sync.save(store, controller.signal).then(() => {
        if (cloudEpoch.current === epoch && cloudUserId.current === userId) { setSyncStatus("synced"); setSyncError(""); }
      }).catch((error) => {
        if (controller.signal.aborted || cloudEpoch.current !== epoch) return;
        setSyncStatus(navigator.onLine === false ? "offline" : "error");
        setSyncError(error instanceof Error ? error.message : "Cloud sync could not save this workspace.");
      });
    }, 650);
  }, [hydrated]);

  const makeCurrentSnapshot = useCallback((): PersistedState => ({
    persistenceVersion: PERSISTENCE_VERSION,
    topicCatalogVersion: TOPIC_CATALOG_VERSION,
    savedAt: new Date().toISOString(),
    topics,
    settings,
    cards,
    learningProfile,
    feedStarted,
    theme,
    youtubeActivity: youtubeActivityOf(youtubeWorkspaceRef.current)
  }), [cards, feedStarted, learningProfile, settings, theme, topics]);

  const saveWorkspaceRecordNow = useCallback(async (id: string, name: string, snapshot: PersistedState) => {
    const store = workspaceStoreRef.current;
    if (!store) return;
    const index = store.records.findIndex((record) => record.id === id);
    const now = new Date().toISOString();
    const record: AppWorkspaceRecord = { id, name, createdAt: index >= 0 ? store.records[index].createdAt : now, updatedAt: now, state: snapshot };
    if (index >= 0) store.records[index] = record;
    else store.records.push(record);
    store.activeId = id;
    try {
      await writeWorkspaceStore(store);
    } catch {
      setToast("Your workspace could not be saved. A local recovery copy was kept.");
    }
  }, []);

  const switchWorkspace = useCallback(async (targetId: string) => {
    if (targetId === workspaceIdRef.current || !workspaceStoreRef.current) return;
    cancelWorkspaceRequests();
    const currentId = workspaceIdRef.current;
    const currentName = workspaceNameRef.current;
    await saveWorkspaceRecordNow(currentId, currentName, makeCurrentSnapshot());
    const target = workspaceStoreRef.current.records.find((record) => record.id === targetId);
    if (!target) return;
    workspaceStoreRef.current.activeId = target.id;
    workspaceIdRef.current = target.id;
    workspaceNameRef.current = target.name;
    setWorkspaceId(target.id);
    setWorkspaceName(target.name);
    const restoredTopics = migrateTopicTree(target.state.topics, false, (target.state.topicCatalogVersion ?? 0) < TOPIC_CATALOG_VERSION);
    setTopics(restoredTopics);
    setSettings({ ...DEFAULT_SETTINGS, ...target.state.settings, sentenceLength: normalizeSentenceLength(target.state.settings?.sentenceLength) });
    const restoredCards = uniqueCards((target.state.cards ?? []).map((card, index) => normalizeFact(card, index)).filter((card) => card.title && card.body));
    setCards(restoredCards);
    setLearningProfile(target.state.learningProfile ?? {});
    setFeedStarted(Boolean(target.state.feedStarted && restoredCards.length));
    setFeedHasMore(true);
    setPendingSlots(10);
    setQuery("");
    setCustomTopic("");
    setRabbitHole(null);
    setGenerationError("");
    setLearningErrors({});
    setView("feed");
    setYoutubeWorkspace((current) => applyYouTubeActivity(current, target.state.youtubeActivity));
    persistedStateRef.current = target.state;
    await writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("The workspace changed, but the active workspace could not be saved."));
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, saveWorkspaceRecordNow]);

  const createWorkspace = useCallback(async () => {
    if (!workspaceStoreRef.current) return;
    const requestedName = nextLocalWorkspaceName(workspaceStoreRef.current.records);
    cancelWorkspaceRequests();
    await saveWorkspaceRecordNow(workspaceIdRef.current, workspaceNameRef.current, makeCurrentSnapshot());
    const now = new Date().toISOString();
    const record: AppWorkspaceRecord = { id: makeWorkspaceId(), name: requestedName, createdAt: now, updatedAt: now, state: { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: createDefaultTopics(), settings: { ...DEFAULT_SETTINGS, obscurity: 5 }, cards: [], learningProfile: {}, feedStarted: false, theme } };
    workspaceStoreRef.current.records.push(record);
    workspaceStoreRef.current.activeId = record.id;
    workspaceIdRef.current = record.id;
    workspaceNameRef.current = record.name;
    setWorkspaceId(record.id);
    setWorkspaceName(record.name);
    setWorkspaceSummaries(workspaceStoreRef.current.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
    setTopics(record.state.topics);
    setSettings(record.state.settings);
    setCards([]);
    setLearningProfile({});
    setFeedStarted(false);
    setFeedHasMore(true);
    setPendingSlots(10);
    setQuery("");
    setView("feed");
    setYoutubeWorkspace((current) => ({ ...current, savedIds: [], history: [], playbackPositions: {}, searchText: "", selectedTopic: "All", activeTab: "discover", selectedChannelId: undefined, selectedVideoId: undefined, discoverIds: [], channelOrder: "newest" }));
    await writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("The new workspace could not be saved. A local recovery copy was kept."));
    setToast(`${record.name} created.`);
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, saveWorkspaceRecordNow, theme]);

  const renameWorkspace = useCallback((targetId: string, requestedName: string) => {
    const target = workspaceStoreRef.current?.records.find((record) => record.id === targetId);
    if (!target || !workspaceStoreRef.current) return false;
    const nextName = requestedName.trim();
    if (!nextName) {
      setToast("Enter a workspace name.");
      return false;
    }
    if (nextName.toLocaleLowerCase() === target.name.toLocaleLowerCase()) return true;
    if (workspaceStoreRef.current.records.some((record) => record.id !== targetId && record.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
      setToast("A workspace with that name already exists.");
      return false;
    }
    target.name = nextName;
    target.updatedAt = new Date().toISOString();
    if (targetId === workspaceIdRef.current) {
      workspaceNameRef.current = nextName;
      setWorkspaceName(nextName);
    }
    setWorkspaceSummaries(workspaceStoreRef.current.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
    void writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("The new name could not be saved."));
    return true;
  }, []);

  const moveWorkspace = useCallback((targetId: string, direction: "up" | "down") => {
    const store = workspaceStoreRef.current;
    if (!store) return;
    const index = store.records.findIndex((record) => record.id === targetId);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= store.records.length) return;
    [store.records[index], store.records[nextIndex]] = [store.records[nextIndex], store.records[index]];
    setWorkspaceSummaries(store.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
    void writeWorkspaceStore(store).catch(() => setToast("The workspace order could not be saved."));
  }, []);

  const performDeleteWorkspace = useCallback(async (targetId: string) => {
    const store = workspaceStoreRef.current;
    if (!store) return;
    const index = store.records.findIndex((record) => record.id === targetId);
    if (index < 0) return;
    const target = store.records[index];
    if (store.records.length <= 1) {
      setToast("Keep at least one workspace so your local data always has a home.");
      return;
    }
    if (targetId === workspaceIdRef.current) {
      cancelWorkspaceRequests();
      await saveWorkspaceRecordNow(workspaceIdRef.current, workspaceNameRef.current, makeCurrentSnapshot());
    }
    store.records.splice(index, 1);
    const replacement = store.records.find((record) => record.id === store.activeId) ?? store.records[0];
    store.activeId = replacement.id;
    if (targetId === workspaceIdRef.current) {
      workspaceIdRef.current = replacement.id;
      workspaceNameRef.current = replacement.name;
      setWorkspaceId(replacement.id);
      setWorkspaceName(replacement.name);
      setTopics(migrateTopicTree(replacement.state.topics, false, (replacement.state.topicCatalogVersion ?? 0) < TOPIC_CATALOG_VERSION));
      setSettings({ ...DEFAULT_SETTINGS, ...replacement.state.settings, sentenceLength: normalizeSentenceLength(replacement.state.settings?.sentenceLength) });
      const replacementCards = uniqueCards((replacement.state.cards ?? []).map((card, cardIndex) => normalizeFact(card, cardIndex)).filter((card) => card.title && card.body));
      setCards(replacementCards);
      setLearningProfile(replacement.state.learningProfile ?? {});
      setFeedStarted(Boolean(replacement.state.feedStarted && replacementCards.length));
      setFeedHasMore(true);
      setPendingSlots(10);
      setQuery("");
      setCustomTopic("");
      setRabbitHole(null);
      setGenerationError("");
      setLearningErrors({});
      setView("feed");
      setYoutubeWorkspace((current) => applyYouTubeActivity(current, replacement.state.youtubeActivity));
      persistedStateRef.current = replacement.state;
    }
    setWorkspaceSummaries(store.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
    await writeWorkspaceStore(store).catch(() => setToast("The workspace was removed locally, but the new order could not be saved."));
    setToast(`${target.name} deleted.`);
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, saveWorkspaceRecordNow]);

  const requestDeleteWorkspace = useCallback((targetId: string) => {
    const store = workspaceStoreRef.current;
    if (!store) return;
    if (store.records.length <= 1) {
      setToast("Keep at least one workspace so your local data always has a home.");
      return;
    }
    const target = store.records.find((record) => record.id === targetId);
    if (!target) return;
    setConfirmation({
      title: `Delete workspace “${target.name}”?`,
      message: "Its cards and local history will be removed from this device.",
      confirmLabel: "Confirm",
      action: () => performDeleteWorkspace(targetId)
    });
  }, [performDeleteWorkspace]);

  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  const confirmPendingAction = useCallback(() => {
    const action = confirmation?.action;
    setConfirmation(null);
    if (action) void action();
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeConfirmation();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeConfirmation, confirmation]);

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
      const activeRecord = workspaceStoreRef.current?.records.find((record) => record.id === workspaceIdRef.current);
      const restored = applyYouTubeActivity(workspace, activeRecord?.state.youtubeActivity);
      youtubeWorkspaceRef.current = restored;
      youtubeCatalogLoadedRef.current = true;
      setYoutubeWorkspace(restored);
      if (restored.videos.length) setYoutubeStatus("connected");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated) void saveYouTubeWorkspace(youtubeWorkspace);
  }, [hydrated, youtubeWorkspace]);

  useEffect(() => {
    if (!hydrated || !workspaceStoreRef.current || !persistedStateRef.current) return;
    const record = workspaceStoreRef.current.records.find((item) => item.id === workspaceIdRef.current);
    if (!record) return;
    record.state = { ...record.state, youtubeActivity: youtubeActivityOf(youtubeWorkspace), savedAt: new Date().toISOString() };
    void writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("Your video activity could not be saved. A local recovery copy was kept."));
    scheduleCloudSave();
  }, [hydrated, scheduleCloudSave, youtubeWorkspace]);

  useEffect(() => {
    let active = true;
    const normalizeSavedState = (parsed: Partial<PersistedState> | null, collapseInitial: boolean): PersistedState => {
      const restoredTopics = parsed?.topics ? migrateTopicTree(parsed.topics, collapseInitial, (parsed?.topicCatalogVersion ?? 0) < 11) : createDefaultTopics();
      const restoredSettings: FeedSettings = { ...DEFAULT_SETTINGS, ...parsed?.settings, displayMode: parsed?.settings?.displayMode === "text" ? "text" : "picture-text" };
      restoredSettings.sentenceLength = normalizeSentenceLength(parsed?.settings?.sentenceLength);
      const realCards = (parsed?.cards ?? []).filter((card) => !KNOWN_DEMO_IDS.has(card.id));
      const restoredCards = uniqueCards(realCards.map((card, index) => normalizeFact(card, index)).filter((card) => card.title.trim() && card.body.trim() && card.hook.trim() && card.topicPath.length && card.sources.length));
      const restoredProfile = parsed?.learningProfile ? (parsed.learningProfile) : {};
      const restoredTheme = parsed?.theme === "dark" ? "dark" : "light";
      return { persistenceVersion: PERSISTENCE_VERSION, savedAt: parsed?.savedAt, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: restoredTopics, settings: restoredSettings, cards: restoredCards, learningProfile: restoredProfile, feedStarted: Boolean(parsed?.feedStarted && restoredCards.length), theme: restoredTheme, youtubeActivity: parsed?.youtubeActivity };
    };
    const restore = async () => {
      let legacy: Partial<PersistedState> | null = null;
      try { legacy = readWorkspaceState(); } catch { legacy = null; }
      const shouldMigrate = typeof window !== "undefined" && window.localStorage.getItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY) !== "1";
      const legacyState = normalizeSavedState(legacy, shouldMigrate || (legacy?.topicCatalogVersion ?? 0) < 11);
      const fallback: AppWorkspaceStore = { version: 1, activeId: "local-workspace", records: [makeLocalWorkspace(legacyState)], theme: legacyState.theme };
      const loaded = await readWorkspaceStore<PersistedState>(fallback);
      if (!active) return;
      const store = loaded ?? fallback;
      if (!store.records.length) store.records = fallback.records;
      const activeRecord = store.records.find((record) => record.id === store.activeId) ?? store.records[0];
      factMemoryRef.current = mergeFactMemory(store.factMemory ?? [], store.records.flatMap(record => (record.state.cards ?? []).map(rememberFact)));
      store.factMemory = factMemoryRef.current;
      workspaceStoreRef.current = store;
      workspaceIdRef.current = activeRecord.id;
      workspaceNameRef.current = activeRecord.name;
      setWorkspaceId(activeRecord.id);
      setWorkspaceName(activeRecord.name);
      setWorkspaceSummaries(store.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
      const restored = normalizeSavedState(activeRecord.state, shouldMigrate || (activeRecord.state.topicCatalogVersion ?? 0) < 11);
      persistedStateRef.current = restored;
      setTopics(restored.topics);
      setSettings(restored.settings);
      setCards(restored.cards);
      setLearningProfile(restored.learningProfile);
      setFeedStarted(restored.feedStarted);
      const sharedTheme = store.theme ?? restored.theme;
      store.theme = sharedTheme;
      setTheme(sharedTheme);
      if (shouldMigrate) window.localStorage.setItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY, "1");
      if (window.localStorage.getItem(THEME_MIGRATION_KEY) !== "1") window.localStorage.setItem(THEME_MIGRATION_KEY, "1");
      await writeWorkspaceStore(store).catch(() => undefined);
      setHydrated(true);
      const epoch = keyEditEpoch.current;
      void Promise.all([readRememberedKey("gemini"), readRememberedKey("youtube")]).then(([gemini, youtube]) => { if (!active) return; setKeysHydrated(true); if (keyEditEpoch.current !== epoch) return; apiKeyRef.current = gemini; setApiKey(gemini); setYoutubeKey(youtube); }).catch(() => { if (!active) return; setKeysHydrated(true); setToast("Remembered keys could not be restored. Your workspaces are still available."); });
    };
    void restore();
    setSupabaseConfigured(Boolean(CLOUD_URL && CLOUD_PUBLIC_KEY));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const auth = cloudClient().auth;
    const loadAccount = async (session: { user: CloudAccount } | null) => {
      const user = session?.user;
      if (!user) {
        cloudEpoch.current += 1;
        cloudAbortController.current?.abort();
        cloudSyncRef.current = null;
        cloudUserId.current = null;
        setAccount(null);
        setSyncStatus("signed-out");
        setSyncError("");
        return;
      }
      if (!active || cloudUserId.current === user.id && cloudSyncRef.current) return;
      const epoch = ++cloudEpoch.current;
      cloudAbortController.current?.abort();
      const controller = new AbortController();
      cloudAbortController.current = controller;
      cloudUserId.current = user.id;
      cloudSyncRef.current = new WorkspaceCloudSync(user.id);
      setAccount(user);
      setSyncStatus("syncing");
      setSyncError("");
      try {
        const currentStore = workspaceStoreRef.current;
        const compatible = Boolean(currentStore && (!currentStore.ownerId || currentStore.ownerId === user.id));
        if (currentStore) {
          try {
            await accountWorkspaceBackup(currentStore.ownerId ?? user.id, structuredClone(currentStore));
          } catch {
            // A recovery-copy failure must not prevent an otherwise valid cloud login.
            setToast("A local recovery copy could not be updated; cloud sync will continue.");
          }
        }
        const remote = await cloudSyncRef.current.load(controller.signal);
        if (!active || controller.signal.aborted || cloudEpoch.current !== epoch) return;
        const localStore = compatible ? currentStore : null;
        const localRecords = (localStore?.records ?? []) as unknown as CloudRecord[];
        const mergedRecords = mergeRecords(localRecords, remote.records);
        const fallbackState: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: createDefaultTopics(), settings: DEFAULT_SETTINGS, cards: [], learningProfile: {}, feedStarted: false, theme: theme };
        const records = mergedRecords.length ? mergedRecords as AppWorkspaceRecord[] : [makeLocalWorkspace(fallbackState)];
        const preferredId = localStore?.activeId && records.some((record) => record.id === localStore.activeId) ? localStore.activeId : records[0].id;
        const mergedStore: AppWorkspaceStore = { version: 1, ownerId: user.id, activeId: preferredId, records, theme: localStore?.theme ?? records[0].state.theme ?? theme, factMemory: mergeFactMemory(compatible ? (localStore?.factMemory ?? []) : [], remote.factMemory) };
        workspaceStoreRef.current = mergedStore;
        factMemoryRef.current = mergedStore.factMemory ?? [];
        const target = records.find((record) => record.id === preferredId) ?? records[0];
        workspaceIdRef.current = target.id;
        workspaceNameRef.current = target.name;
        setWorkspaceId(target.id);
        setWorkspaceName(target.name);
        setWorkspaceSummaries(records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
        setTopics(migrateTopicTree(target.state.topics ?? createDefaultTopics(), false, (target.state.topicCatalogVersion ?? 0) < TOPIC_CATALOG_VERSION));
        setSettings({ ...DEFAULT_SETTINGS, ...target.state.settings, sentenceLength: normalizeSentenceLength(target.state.settings?.sentenceLength) });
        const targetCards = uniqueCards((target.state.cards ?? []).map((card, index) => normalizeFact(card, index)).filter((card) => card.title && card.body));
        setCards(targetCards);
        setLearningProfile(target.state.learningProfile ?? {});
        setFeedStarted(Boolean(target.state.feedStarted && targetCards.length));
        setTheme(mergedStore.theme ?? "light");
        persistedStateRef.current = target.state;
        await writeWorkspaceStore(mergedStore);
        setSyncStatus("synced");
        scheduleCloudSave();
      } catch (error) {
        if (!active || controller.signal.aborted || cloudEpoch.current !== epoch) return;
        setSyncStatus(navigator.onLine === false ? "offline" : "error");
        setSyncError(error instanceof Error ? error.message : "Cloud sync could not load your account.");
      }
    };
    void auth.getSession().then(({ data }) => loadAccount(data.session as { user: CloudAccount } | null));
    const { data: listener } = auth.onAuthStateChange((_event, session) => { void loadAccount(session as { user: CloudAccount } | null); });
    return () => { active = false; listener.subscription.unsubscribe(); cloudAbortController.current?.abort(); };
  }, [hydrated, scheduleCloudSave]);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics, settings, cards, learningProfile, feedStarted, theme, youtubeActivity: youtubeActivityOf(youtubeWorkspaceRef.current) };
    persistedStateRef.current = state;
    writeWorkspaceState(state);
    const currentStore = workspaceStoreRef.current;
    if (currentStore) {
      const index = currentStore.records.findIndex((record) => record.id === workspaceIdRef.current);
      const now = new Date().toISOString();
      const record: AppWorkspaceRecord = { id: workspaceIdRef.current, name: workspaceNameRef.current, createdAt: index >= 0 ? currentStore.records[index].createdAt : now, updatedAt: now, state };
      if (index >= 0) currentStore.records[index] = record;
      else currentStore.records.push(record);
      currentStore.activeId = workspaceIdRef.current;
      currentStore.theme = theme;
      archiveFacts(cards);
      currentStore.factMemory = factMemoryRef.current;
      setWorkspaceSummaries(currentStore.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
      void writeWorkspaceStore(currentStore).catch(() => setToast("Your workspace could not be saved. A local recovery copy was kept."));
      scheduleCloudSave();
    }
  }, [cards, feedStarted, hydrated, learningProfile, scheduleCloudSave, settings, theme, topics]);

  useEffect(() => {
    if (!hydrated) return;
    const flushWorkspace = () => {
      const state = persistedStateRef.current;
      const store = workspaceStoreRef.current;
      if (!state || !store) return;
      const snapshot = { ...state, savedAt: new Date().toISOString() };
      const record = store.records.find((item) => item.id === workspaceIdRef.current);
      if (record) {
        record.state = snapshot;
        record.updatedAt = snapshot.savedAt ?? record.updatedAt;
      }
      store.activeId = workspaceIdRef.current;
      store.theme = theme;
      writeWorkspaceState(snapshot);
      // writeWorkspaceStore writes localStorage before opening IndexedDB, so
      // the recovery copy survives a pagehide even when the transaction cannot
      // finish before the browser closes the document.
      try { window.localStorage.setItem("learned-media-all-workspaces", JSON.stringify(store)); } catch { /* Recovery is best effort. */ }
      void writeWorkspaceStore(store).catch(() => undefined);
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
  }, [hydrated, theme]);

  useEffect(() => {
    const element = mainScrollRef.current;
    const update = () => setShowGoToTop(window.scrollY > 420 || Boolean(element && element.scrollTop > 420));
    update();
    window.addEventListener("scroll", update, { passive: true });
    element?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      element?.removeEventListener("scroll", update);
    };
  }, [hydrated, view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    globalSearchAbortController.current?.abort();
    const text = query.trim();
    if (!text || !apiKey.trim() || geminiStatus !== "connected") {
      setSemanticSearch({ query: text, terms: [] });
      return;
    }
    const controller = new AbortController();
    globalSearchAbortController.current = controller;
    const timer = window.setTimeout(() => {
      void interpretNaturalSearch({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: text, signal: controller.signal }).then((result) => {
        if (!controller.signal.aborted && globalSearchAbortController.current === controller) setSemanticSearch({ query: text, terms: result.terms });
      }).catch(() => {
        if (!controller.signal.aborted && globalSearchAbortController.current === controller) setSemanticSearch({ query: text, terms: [] });
      });
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (globalSearchAbortController.current === controller) globalSearchAbortController.current = null;
    };
  }, [apiKey, geminiStatus, query]);

  const selectedCount = useMemo(() => selectedLeafCount(topics), [topics]);
  const allTopicResults = useMemo(() => flattenTopics(topics), [topics]);
  const topicSuggestionIndex = useMemo(() => createTopicSuggestionIndex(allTopicResults), [allTopicResults]);

  const updateSettings = useCallback((next: Partial<FeedSettings>) => {
    const nextSentenceLength = next.sentenceLength === undefined ? settings.sentenceLength : normalizeSentenceLength(next.sentenceLength);
    setSettings((current) => ({ ...current, ...next, sentenceLength: nextSentenceLength }));
    if (next.obscurity !== undefined) {
      const difficulty = normalizeDifficulty(next.obscurity);
      setLearningProfile((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, unknownStreak: 0, targetDifficulty: difficulty }])) as LearningProfile);
    }
  }, [settings.sentenceLength]);

  const handleGoogleSignIn = useCallback(() => {
    if (!supabaseConfigured) {
      setSyncStatus("error");
      setSyncError("Cloud sync is not configured for this build. Your workspace remains saved locally.");
      return;
    }
    void googleSignIn().catch((error) => {
      const message = error instanceof Error ? error.message : "Google sign-in could not start.";
      setSyncStatus("error");
      setSyncError(message);
      setToast(message);
    });
  }, [supabaseConfigured]);

  const handleGoogleSignOut = useCallback(() => {
    cloudEpoch.current += 1;
    cloudAbortController.current?.abort();
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = null;
    cloudSyncRef.current = null;
    cloudUserId.current = null;
    void cloudClient().auth.signOut().then(({ error }) => {
      if (error) throw error;
      setAccount(null);
      setSyncStatus("signed-out");
      setSyncError("");
      setToast("Signed out. Your local workspace is still available.");
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Could not sign out.";
      setSyncStatus("error");
      setSyncError(message);
      setToast(message);
    });
  }, []);

  const handleToggleTopic = useCallback((id: string) => {
    setFeedHasMore(true);
    setTopics((current) => toggleTopicSelection(current, id));
  }, []);

  const handleExpandTopic = useCallback((id: string) => {
    setTopics((current) => updateTopicTree(current, id, (node) => ({ ...node, expanded: !node.expanded })));
  }, []);

  const handleCollapseTopics = useCallback(() => {
    setTopics((current) => collapseTopicBranches(current));
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

  const removeCustomTopic = useCallback((id: string) => {
    const topic = flattenTopics(topics).find((candidate) => candidate.id === id);
    if (!topic?.custom) return;
    setTopics((current) => removeTopicTree(current, id));
    setFeedHasMore(true);
    setToast(`${topic.label} removed from your topic tree.`);
  }, [topics]);

  const startFeed = useCallback(async (rabbitHoleOverride?: string | null, requestedCount = pendingSlots) => {
    if (loading || generationAbortController.current) return;
    if (!selectedCount) {
      setToast("Choose at least one topic before generating more facts.");
      return;
    }
    if (!apiKey.trim() || geminiStatus !== "connected") {
      setToast("Add your Gemini API key in Settings and connect it before starting.");
      setView("settings");
      return;
    }
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
          avoid: [],
          signal: controller.signal,
          onProgress: (event) => {
            if (controller.signal.aborted || requestGeneration.current !== requestId) return;
            if (event.type === "model") {
              setModelChecks((current) => mergeGeminiModelOutcome(current, event.outcome));
              return;
            }
            if (event.type !== "card") return;
            const card = normalizeFact(event.card, receivedIds.size);
            if (acceptFact(card)) receivedIds.add(card.id);
          }
        });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        result.cards.forEach((card, index) => { const normalized = normalizeFact(card, index); if (!receivedIds.has(normalized.id) && acceptFact(normalized)) receivedIds.add(normalized.id); });
        if (!result.completedCount) {
          setFeedHasMore(false);
          setPendingSlots(count);
          setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
          setToast("No new complete facts arrived. Retry when you are ready.");
        } else if (result.partial || receivedIds.size < count) {
          setFeedHasMore(false);
          setPendingSlots(Math.max(1, count - receivedIds.size));
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
        body: JSON.stringify({ topics: selectWeightedTopicPaths(topics, count), requestedCount: count, settings, learningProfile, rabbitHole: activeRabbitHole, avoid: [] }),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Gemini could not generate this batch. Check the key in Settings and try again.");
      }
      await readNdjson(response, (message) => {
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        if (message.type === "progress") {
          const event = message.event as { type?: string; card?: Partial<FactCard>; outcome?: GeminiModelOutcome };
          if (event.type === "model" && event.outcome) setModelChecks((current) => mergeGeminiModelOutcome(current, event.outcome!));
          if (event.type === "card" && event.card?.id && event.card.title && event.card.body && event.card.hook && event.card.topicPath?.length && event.card.sources?.length) {
            const card = normalizeFact(event.card, receivedIds.size);
            if (acceptFact(card)) receivedIds.add(card.id);
          }
        } else if (message.type === "complete") {
          finalPayload = message as typeof finalPayload;
          const modelOutcomes = (message.modelOutcomes as GeminiModelOutcome[] | undefined) ?? [];
          if (modelOutcomes.length) setModelChecks((current) => modelOutcomes.reduce(mergeGeminiModelOutcome, current));
        } else if (message.type === "error") {
          streamError = String(message.error ?? "Gemini could not complete this batch.");
        }
      });
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      if (streamError) throw new Error(streamError);
      const generated = (finalPayload?.cards ?? []).filter((card) => Boolean(card.id && card.title?.trim() && card.body?.trim() && card.hook?.trim() && card.topicPath?.length && card.sources?.length)).map((card, index) => normalizeFact(card, index));
      generated.forEach((card) => { if (!receivedIds.has(card.id) && acceptFact(card)) receivedIds.add(card.id); });
      if (!receivedIds.size) {
        setFeedHasMore(false);
        setPendingSlots(count);
        setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
        setToast("No new complete facts arrived. Retry when you are ready.");
      } else if (finalPayload?.partial || receivedIds.size < count) {
        setFeedHasMore(false);
        setPendingSlots(Math.max(1, count - receivedIds.size));
        setGenerationError(finalPayload?.retryGuidance ?? "Some fact slots failed. Retry to fill the remaining cards.");
        setToast(receivedIds.size + " facts arrived. Retry to fill the remaining slots.");
      } else {
        setFeedHasMore(true);
        setPendingSlots(10);
        setGenerationError("");
      }
    } catch (error) {
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      setFeedHasMore(false);
      setPendingSlots(Math.max(1, count - receivedIds.size));
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
    archiveFacts(cards);
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
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [cancelGeneration, hydrated, learningProfile, settings, theme, topics]);

  const resetTopics = useCallback(() => {
    const blankTopics = clearTopicSelections(topics);
    setTopics(blankTopics);
    setFeedHasMore(true);
    setPendingSlots(10);
    setRabbitHole(null);
    setGenerationError("");
    setToast("Topics reset. Choose a topic to start again.");
  }, [topics]);

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

  const performResetAllPreferences = useCallback(() => {
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

  const resetAllPreferences = useCallback(() => {
    setConfirmation({
      title: "Reset all preferences?",
      message: "Your topic mix, feed, and learning preferences will return to their starting values.",
      confirmLabel: "Confirm",
      action: performResetAllPreferences
    });
  }, [performResetAllPreferences]);

  const performDeleteLearningData = useCallback(() => {
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

  const deleteLearningData = useCallback(() => {
    setConfirmation({
      title: "Delete learning data?",
      message: "Saved facts, likes, history, and the current feed will be removed from this workspace. Your topic library and Gemini key will stay.",
      confirmLabel: "Confirm",
      action: performDeleteLearningData
    });
  }, [performDeleteLearningData]);

  const handleApiKeyChange = useCallback((value: string) => {
    keyEditEpoch.current += 1;
    void saveRememberedKey("gemini", value).catch(() => setToast("This key could not be remembered on this device."));
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
    setModelChecks(ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" })));
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
    setModelChecks(ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" })));
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
          if (readyCount >= REQUIRED_WORKING_MODELS) setGeminiStatus("connected");
        });
        if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
        setModelChecks(result.models);
        setGeminiStatus(result.status);
        setToast(result.status === "connected" ? "Gemini connected. At least three allowed models passed." : "Fewer than three allowed models passed. Fix the key or retry the checks.");
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
          if (Number(message.readyCount) >= REQUIRED_WORKING_MODELS) setGeminiStatus("connected");
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
      setToast(finalStatus === "connected" ? "Gemini connected. At least three allowed models passed." : "Fewer than three allowed models passed. Fix the key or retry the checks.");
    } catch (error) {
      if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
      setGeminiStatus("unavailable");
      setModelChecks(ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" })));
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
    if (!hydrated || !youtubeCatalogLoadedRef.current || !youtubeKey.trim() || youtubeStatus !== "not-configured") return;
    if (youtubeWorkspace.videos.length) {
      setYoutubeStatus("connected");
      return;
    }
    void connectYouTube(false);
  }, [connectYouTube, hydrated, youtubeKey, youtubeStatus, youtubeWorkspace]);

  useEffect(() => {
    if (!hydrated || !youtubeWorkspace.videos.length || youtubeWorkspace.discoverIds.length) return;
    const pool = filterYouTubeVideos(youtubeWorkspace.videos, "", youtubeWorkspace.selectedTopic);
    const ids = selectRandomVideos(pool, 24).map((video) => video.id);
    if (ids.length) updateYouTubeWorkspace((current) => current.discoverIds.length ? current : { ...current, discoverIds: ids });
  }, [hydrated, updateYouTubeWorkspace, youtubeWorkspace]);

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
    keyEditEpoch.current += 1;
    void saveRememberedKey("youtube", value).catch(() => setToast("This key could not be remembered on this device."));
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
    youtubeSearchCache.current.clear();
    setYoutubeKey(value);
    setYoutubeStatus("not-configured");
    setYoutubeError("");
    setYoutubeProgress({ phase: "idle", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0, completedSources: 0 });
  }, []);

  const removeYouTubeKey = useCallback(() => {
    keyEditEpoch.current += 1;
    void saveRememberedKey("youtube", "").catch(() => setToast("The remembered YouTube key could not be removed."));
    handleYouTubeKeyChange("");
    setToast("Remembered YouTube key removed. Your imported catalog remains local.");
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
    setYoutubeSmartSearchRan(false);
    setYoutubeSearchResults([]);
    setYoutubeSearchPhase("interpreting");
    setYoutubeError("");
    setYoutubeSearchReasons({});
    try {
      const workspaceBeforeInterpretation = youtubeWorkspaceRef.current;
      const cacheKey = [queryText.toLocaleLowerCase().replace(/\s+/g, " "), workspaceBeforeInterpretation.selectedTopic, workspaceBeforeInterpretation.selectedChannelId ?? "all", workspaceBeforeInterpretation.catalogVersion].join("|");
      const cached = youtubeSearchCache.current.get(cacheKey);
      if (cached) {
        setYoutubeSearchResults(cached.results);
        setYoutubeSearchReasons(cached.reasons);
        setYoutubeSmartSearchRan(true);
        setYoutubeSearchPhase("idle");
        setToast(`${cached.results.length} relevant approved video${cached.results.length === 1 ? "" : "s"} matched your search.`);
        return;
      }
      const interpreted = await interpretVideoSearch({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: queryText, signal: controller.signal });
      if (controller.signal.aborted) return;
      const workspace = youtubeWorkspaceRef.current;
      const namedChannel = interpreted.plan.channelId
        ? workspace.channels.find((channel) => channel.id === interpreted.plan.channelId)
        : interpreted.plan.channel
          ? workspace.channels.find((channel) => channel.name.toLocaleLowerCase().includes(interpreted.plan.channel!.toLocaleLowerCase()))
          : undefined;
      if ((interpreted.plan.channel || interpreted.plan.channelId) && !namedChannel) {
        setYoutubeSearchResults([]);
        setYoutubeSmartSearchRan(false);
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
      const candidateScores = new Map(initialCandidates.map((candidate) => [candidate.video.id, candidate.score]));
      let ranked = await rankPass(initialCandidates);
      if (ranked.length < 6 && !controller.signal.aborted) {
        setYoutubeSearchPhase("expanding");
        const expandedCandidates = searchYouTubeCandidates(workspace.videos, plan, workspace.selectedTopic, workspace.selectedChannelId, 80, initialCandidates.map(({ video }) => video.id), true);
        expandedCandidates.forEach((candidate) => candidateScores.set(candidate.video.id, candidate.score));
        const expanded = await rankPass(expandedCandidates);
        const seen = new Set(ranked.map((match) => match.videoId));
        ranked = ranked.concat(expanded.filter((match) => !seen.has(match.videoId)));
      }
      if (controller.signal.aborted) return;
      const byId = new Map(workspace.videos.map((video) => [video.id, video]));
      const accepted = ranked.filter((match) => byId.has(match.videoId) && !match.videoId.startsWith("demo-"));
      const orderedMatches = [...accepted].sort((left, right) => {
        if (left.relevance !== right.relevance) return left.relevance === "direct" ? -1 : 1;
        return (candidateScores.get(right.videoId) ?? right.localScore) - (candidateScores.get(left.videoId) ?? left.localScore) || right.support.length - left.support.length;
      });
      let orderedVideos = orderedMatches.map((match) => byId.get(match.videoId)).filter((video): video is YouTubeVideo => Boolean(video));
      if (plan.sort === "newest") orderedVideos = [...orderedVideos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      if (plan.sort === "oldest") orderedVideos = [...orderedVideos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
      if (plan.sort === "random") orderedVideos = selectRandomVideos(orderedVideos, orderedVideos.length);
      setYoutubeSearchResults(orderedVideos);
      setYoutubeSearchReasons(Object.fromEntries(accepted.map((match) => [match.videoId, match])));
      youtubeSearchCache.current.set(cacheKey, { results: orderedVideos, reasons: Object.fromEntries(accepted.map((match) => [match.videoId, match])) });
      setYoutubeSmartSearchRan(true);
      setYoutubeSearchPhase("idle");
      setYoutubeStatus((current) => current === "not-configured" ? "connected" : current);
      setToast(`${orderedVideos.length} relevant approved video${orderedVideos.length === 1 ? "" : "s"} matched your search.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setYoutubeSmartSearchRan(false);
      setYoutubeSearchResults([]);
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
    setYoutubeSmartSearchRan(false);
    setYoutubeSearchResults([]);
    setYoutubeSearchReasons({});
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
    const recommendationIds = workspace.discoverIds.length ? workspace.discoverIds : pool.slice(0, 24).map((video) => video.id);
    return recommendationIds.map((id) => byId.get(id)).filter((video): video is YouTubeVideo => Boolean(video));
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

  const chooseExploreTopic = useCallback((requestedTopic: string) => {
    if (requestedTopic === "Custom topic") {
      setFeedStarted(false);
      setQuery("");
      setView("feed");
      setToast("Add a custom topic from setup to start exploring.");
      return;
    }

    const normalizedTopic = normalizeSearchText(requestedTopic);
    const catalogTopics = flattenTopics(topics);
    const exactMatch = catalogTopics.find((topic) => (
      normalizeSearchText(topic.label) === normalizedTopic
      || topic.aliases?.some((alias) => normalizeSearchText(alias) === normalizedTopic)
    ));
    const directSuggestion = exactMatch
      ? undefined
      : suggestTopics(topicSuggestionIndex, requestedTopic).find((suggestion) => suggestion.group === "keyword");
    const selectedTopic = exactMatch ?? catalogTopics.find((topic) => topic.id === directSuggestion?.id);
    const label = selectedTopic?.label ?? titleCaseTopicLabel(requestedTopic);

    if (selectedTopic) {
      setTopics((current) => {
        const topic = flattenTopics(current).find((candidate) => candidate.id === selectedTopic.id);
        return !topic || selectionState(topic) === "selected" ? current : toggleTopicSelection(current, topic.id);
      });
    } else {
      const id = `custom-${slugify(label)}`;
      setTopics((current) => {
        const existing = flattenTopics(current).find((topic) => topic.id === id);
        if (existing) return selectionState(existing) === "selected" ? current : toggleTopicSelection(current, id);
        return [...current, { id, label, selected: true, expanded: false, weight: 10, custom: true }];
      });
    }

    setFeedHasMore(true);
    setFeedStarted(false);
    setQuery(label);
    setView("feed");
    setToast(`Ready to explore ${label}. Start learning when you're ready.`);
  }, [topicSuggestionIndex, topics]);

  const renderMain = () => {
    if (view === "explore") return <ExploreView onChoose={chooseExploreTopic} />;
    if (view === "videos") return <VideoWorkspace workspace={youtubeWorkspace} youtubeStatus={youtubeStatus} progress={youtubeProgress} error={youtubeError} searchResults={videoSearchResults} searchReasons={youtubeSearchReasons} smartSearchLoading={youtubeSmartSearchLoading} searchPhase={youtubeSearchPhase} smartSearchRan={youtubeSmartSearchRan} onOpenSettings={() => setView("settings")} onTabChange={(tab) => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, activeTab: tab, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSearchChange={handleVideoSearch} onSmartSearch={() => void smartVideoSearch()} onCancelSearch={cancelSmartVideoSearch} onTopicChange={(topic) => { cancelSmartVideoSearch(); setYoutubeSearchResults([]); setYoutubeSearchReasons({}); setYoutubeSmartSearchRan(false); setYoutubeSearchPhase("idle"); updateYouTubeWorkspace((current) => ({ ...current, selectedTopic: topic, discoverIds: selectRandomVideos(filterYouTubeVideos(current.videos, "", topic), 24).map((video) => video.id) })); }} onShuffle={shuffleYouTube} onShowMore={showMoreYouTube} onRefreshVideos={() => void connectYouTube(true)} onOpenVideo={openVideo} onOpenChannel={openChannel} onBack={() => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSaveVideo={saveVideo} onPlaybackPosition={(id, seconds) => updateYouTubeWorkspace((current) => ({ ...current, playbackPositions: { ...current.playbackPositions, [id]: seconds } }))} onChannelOrder={(order) => updateYouTubeWorkspace((current) => ({ ...current, channelOrder: order }))} onPauseImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeImport={() => void connectYouTube()} onRetryImport={() => void connectYouTube()} />;
    if (view === "saved" || view === "likes" || view === "history") return <CollectionView kind={view} cards={activeCollection(view)} displayMode={settings.displayMode} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} />;
    if (view === "settings") return <SettingsView apiKey={apiKey} onApiKeyChange={handleApiKeyChange} status={geminiStatus} feedback={toast} modelChecks={modelChecks} modelChecking={modelChecking} onTestConnection={testConnection} onRemoveKey={() => { handleApiKeyChange(""); setToast("Remembered key removed."); }} theme={theme} onThemeChange={setTheme} onResetAll={resetAllPreferences} onDeleteLearningData={deleteLearningData} onGoogleSignIn={handleGoogleSignIn} onGoogleSignOut={handleGoogleSignOut} account={account} syncStatus={syncStatus} syncError={syncError} youtubeKey={youtubeKey} youtubeStatus={youtubeStatus} youtubeProgress={youtubeProgress} youtubeLastSyncAt={youtubeWorkspace.lastSyncAt} onYoutubeKeyChange={handleYouTubeKeyChange} onConnectYoutube={() => void connectYouTube()} onRefreshYoutube={() => void connectYouTube(true)} onRemoveYoutubeKey={removeYouTubeKey} onPauseYoutubeImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeYoutubeImport={() => void connectYouTube()} onRetryYoutubeImport={() => void connectYouTube()} workspaceName={workspaceName} cards={cards} />;
    if (!feedStarted) return <SetupWorkspace topics={topics} query={query} onQueryChange={setQuery} settings={settings} customTopic={customTopic} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onCollapseTopics={handleCollapseTopics} onWeightTopic={handleWeightTopic} onRemoveCustomTopic={removeCustomTopic} onSettingsChange={updateSettings} onResetTopics={resetTopics} onStart={() => void startFeed()} onOpenSettings={() => setView("settings")} canStart={geminiStatus === "connected"} hasGeminiKey={!keysHydrated || Boolean(apiKey.trim())} />;
    return <FeedView cards={filteredCards} showReset={cards.length > 0 || loading} query={query} settings={settings} topics={topics} customTopic={customTopic} loading={loading} canLoadMore={feedHasMore && selectedCount > 0} generationError={generationError} rabbitHole={rabbitHole} toast={toast} learnLoading={learnLoading} questionLoading={questionLoading} learningErrors={learningErrors} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onReset={resetFeed} onRetry={() => void startFeed(null, pendingSlots)} onLoadMore={() => void startFeed(null, 10)} onSettingsChange={updateSettings} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onCollapseTopics={handleCollapseTopics} onWeightTopic={handleWeightTopic} onRemoveCustomTopic={removeCustomTopic} />;
  };

  const topicSuggestions = useMemo(
    () => suggestTopics(topicSuggestionIndex, query, semanticSearch.query === query.trim() ? semanticSearch.terms : []),
    [topicSuggestionIndex, query, semanticSearch]
  );

  return (
    <div
      className={`app-frame theme-${theme}`}
      onPointerDownCapture={() => { document.documentElement.dataset.inputModality = "pointer"; }}
      onKeyDownCapture={() => { document.documentElement.dataset.inputModality = "keyboard"; }}
    >
      <Navigation
        view={view}
        onNavigate={(nextView) => { setView(nextView); if (nextView !== "feed") setQuery(""); }}
        onReset={resetFeed}
        showReset={cards.length > 0 || loading}
        query={query}
        onQueryChange={setQuery}
        topicSuggestions={topicSuggestions}
        onChooseTopic={(label) => { setView("feed"); setFeedStarted(false); setQuery(label); }}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        workspaces={workspaceSummaries}
        onSwitchWorkspace={(id) => void switchWorkspace(id)}
        onCreateWorkspace={() => void createWorkspace()}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={requestDeleteWorkspace}
        onMoveWorkspace={moveWorkspace}
      />
      <main className="main-column">
        <div className="main-scroll" ref={mainScrollRef}>
          {keysHydrated && !apiKey.trim() && view !== "settings" && <button type="button" className="mobile-api-key-notice" onClick={() => { setView("settings"); window.scrollTo({ top: 0, behavior: "smooth" }); mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="mobile-api-key-notice-icon"><Icon name="key" size={15} /></span>
            <span className="mobile-api-key-notice-copy"><strong>Gemini API key not connected</strong><small>Tap to add one in Settings</small></span>
            <Icon name="arrow" size={16} />
          </button>}
          {renderMain()}
          {showGoToTop && <button type="button" className="go-to-top" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}>Go to top</button>}
        </div>
      </main>
      {confirmation && <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmation(); }}>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" onMouseDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Please confirm</span>
          <h2 id="confirmation-title">{confirmation.title}</h2>
          <p id="confirmation-message">{confirmation.message}</p>
          <div className="confirmation-actions">
            <button type="button" className="ghost-button" onClick={closeConfirmation}>Cancel</button>
            <button type="button" className="danger-button" onClick={confirmPendingAction} autoFocus>{confirmation.confirmLabel}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
