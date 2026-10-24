"use client";

import dynamic from "next/dynamic";
import { CardDownloadsProvider } from "@/components/learned-media/CardDownloads";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { Navigation } from "@/components/learned-media/Navigation";
import { Icon } from "@/components/learned-media/icons";
import { readCredential, saveCredential } from "@/lib/remembered-keys";
import { AccountCredentials } from "@/lib/account-credentials";
import { LatestSnapshotQueue } from "@/lib/latest-snapshot-queue";
import { rememberFact, mergeFactMemory, hasExactSentenceCount, normalizeSentenceLength, type FactMemory } from "@/lib/fact-quality";
import { FactNoveltyIndex, factNoveltySignatures } from "@/lib/fact-novelty";
import { createDefaultTopics, DEFAULT_SETTINGS } from "@/lib/demo-data";
import { ALLOWED_GEMINI_MODELS, DEFAULT_CARD_GENERATION_COUNT, generateGeminiFacts, generateLearningResponse, geminiFailureDetails, interpretNaturalSearch, interpretVideoSearch, rankVideoSearchCandidates, testGeminiKey, type RankedVideoSearchResult, type VideoSearchPlan } from "@/lib/gemini";
import { clearTopicSelections, collapseTopicBranches, flattenTopics, migrateTopicTree, removeTopicTree, selectedLeafCount, selectWeightedTopicPaths, selectionState, toggleTopicSelection, updateTopicTree } from "@/lib/topic-tree";
import { findTopicById, TOPIC_CATALOG_VERSION, titleCaseTopicLabel } from "@/lib/topic-catalog";
import { DEFAULT_DIFFICULTY, getTopicLearningProfile, migrateLegacyDifficulty, normalizeDifficulty, normalizeLearningProfile, resetTopicLearningProfiles, recordTopicFeedback } from "@/lib/recommendations";
import { normalizeSearchText, rankSearchResults } from "@/lib/search";
import { requestCacheKey, requestCacheScope, SessionCache } from "@/lib/session-cache";
import { createCustomTopicId, normalizeCustomTopicLabel, createTopicSuggestionIndex, diffTopicSearchRecords, topicSearchRecords, suggestTopics, shouldEnrichTopics, TOPIC_SEARCH_VERSION, type TopicQueryPlan, type TopicSearchRecord } from "@/lib/topic-suggestions";
import { searchTopicsWithYieldingFallback } from "@/lib/topic-search-fallback";
import type { TopicSearchIndex, TopicSearchWorkerReply } from "@/lib/topic-search-types";
import { isGitHubPagesRuntime } from "@/lib/runtime";
import { accountWorkspaceBackup, makeWorkspaceId, nextLocalWorkspaceName, readWorkspaceStore, writeWorkspaceRecovery, writeWorkspaceStore as writeRawWorkspaceStore, type WorkspaceRecord, type WorkspaceStore, type WorkspaceSummary } from "@/lib/workspaces";
import { parseSnapshot, validateSnapshot, writeRecoverySnapshot } from "@/lib/snapshot-validation";
import { compactTopicPreferences, restoreTopicPreferences } from "@/lib/topic-preferences";
import { CLOUD_PUBLIC_KEY, CLOUD_URL, cloudClient, googleSignIn, loadAccountKeys, saveAccountKey, WorkspaceCloudSync, type CloudAccount } from "@/lib/cloud-sync";
import { mergeRecords, type CloudRecord } from "@/lib/cloud-records";
import { APPROVED_YOUTUBE_CHANNELS, DEFAULT_YOUTUBE_RECENCY_PREFERENCES, DEFAULT_YOUTUBE_WORKSPACE, YOUTUBE_CATALOG_VERSION, YouTubeClient, isApprovedYouTubeVideo, importCoordinatedYouTubeCatalog, hasPendingYouTubeImport, watchCommittedYouTubeCatalog, loadYouTubeActivity, loadYouTubeWorkspace, mergeYouTubeRecencyPreferences, saveYouTubeWorkspace, selectRandomVideos, type YouTubeActivityState, type YouTubeChannelRecord, type YouTubeImportProgress, type YouTubeSearchCandidate, type YouTubeTopic, type YouTubeVideo, type YouTubeWorkspaceState } from "@/lib/youtube";
import { shouldEnrichVideoSearch, videoSearchReason, makeLocalVideoPlan, mergeVideoSearchPlans, eligibleSemanticVideo, searchSemanticVideosYielding, VIDEO_SEMANTIC_VERSION } from "@/lib/video-semantic";
import { diffVideoSearchMetadata, reuseUnchangedVideoRecords, reuseUnchangedVideoRecordsYielding } from "@/lib/video-metadata";
import { resolveWikipediaImage, wikipediaEvidenceLink } from "@/lib/wikipedia";
import { normalizeSpotlightSources } from "@/lib/source-spotlight";
import { cardExplanationFingerprint, getCardExplanationSelection, normalizeCardExplanations } from "@/lib/card-explanations";
import { cardGlossaryFingerprint, normalizeCardGlossary } from "@/lib/card-glossary";
import { createSavedCardLocations, cardLocationsFingerprint } from "@/lib/card-locations";
import { createSavedCardChronology, normalizeSavedCardChronology } from "@/lib/card-chronology";
import { createSavedFollowUpQuestions, normalizeSavedFollowUpQuestions } from "@/lib/card-follow-ups";
import { clearCardRevealProgress } from "@/lib/card-reveal";
import { acceptTopicDetourCard, createTopicDetour, markTopicDetourProgress, missingTopicDetourSlots, orderTopicDetourCards, type TopicDetour, type TopicDetourProgress } from "@/lib/topic-detours";
import type { FactCard, FactCardAction, FeedSettings, GeminiModelCheck, GeminiModelOutcome, GeminiStatus, LearningMessage, LearningProfile, SavedCardGlossary, SavedCardLocations, TopicNode, View, WikipediaSource } from "@/lib/types";

const CollectionView = dynamic(() => import("@/components/learned-media/CollectionView").then((module) => module.CollectionView), { loading: () => null });
const ExploreView = dynamic(() => import("@/components/learned-media/ExploreView").then((module) => module.ExploreView), { loading: () => null });
const FeedView = dynamic(() => import("@/components/learned-media/FeedView").then((module) => module.FeedView), { loading: () => null });
const SettingsView = dynamic(() => import("@/components/learned-media/SettingsView").then((module) => module.SettingsView), { loading: () => null });
const VideoWorkspace = dynamic(() => import("@/components/learned-media/VideoWorkspace").then((module) => module.VideoWorkspace), { loading: () => null });
const SetupWorkspace = dynamic(() => import("@/components/learned-media/SetupWorkspace").then((module) => module.SetupWorkspace), { loading: () => null });

const STORAGE_KEY = "learned-media-state";
const STORAGE_BACKUP_KEY = "learned-media-state-backup";
const LEGACY_STORAGE_KEY = "learned-media-demo-state";
const PENDING_WORKSPACE_JOURNAL_KEY = "learned-media-pending-workspace-v1";
const THEME_MIGRATION_KEY = "learned-media-light-theme-v1";
const REVEAL_GRADUALLY_PREFERENCE_KEY = "learned-media-reveal-gradually-v1";
const TEN_LEVEL_DIFFICULTY_MIGRATION_KEY = "learned-media-ten-level-difficulty-v1";
const PERSISTENCE_VERSION = 3;
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
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

type YouTubeWorkspaceActivity = YouTubeActivityState;

type AppWorkspaceRecord = WorkspaceRecord<PersistedState>;
type AppWorkspaceStore = WorkspaceStore<PersistedState>;
type CardSearchWorkerReply = { type: "ready"; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey: string; ids: string[] };
type YouTubeSearchWorkerReply = { type: "ready"; revision: number } | { type: "rebuild"; revision: number } | { type: "stale"; requestId: number; revision: number } | { type: "results"; requestId: number; revision: number; query: string; viewKey?: string; candidates: Array<{ coverage?: YouTubeSearchCandidate["coverage"]; videoId: string; score: number; matchedFields: string[]; supportingText: string[] }> };
type YouTubeWorkerSearchRequest = { query: string; plan: VideoSearchPlan; topic: YouTubeTopic | "All"; channelId?: string; limit: number; excludedIds?: string[]; expanded?: boolean; viewKey?: string };
type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void | Promise<void>;
};

const compactStateCache = new WeakMap<PersistedState, PersistedState>();
const compactRecordCache = new WeakMap<AppWorkspaceRecord, AppWorkspaceRecord>();

function compactStateForLocalStorage(state: PersistedState) {
  const cached = compactStateCache.get(state);
  if (cached) return cached;
  const topics = Array.isArray(state.topics) ? compactTopicPreferences(state.topics) : state.topics;
  const compact = { ...state, persistenceVersion: PERSISTENCE_VERSION, topics };
  compactStateCache.set(state, compact as unknown as PersistedState);
  return compact;
}


function cardSearchText(card: FactCard) {
  return `${card.hook} ${card.title} ${card.body} ${card.topicPath.join(" ")} ${card.sources.map((source) => source.title).join(" ")}`;
}

function compactWorkspaceStoreForLocalStorage(store: AppWorkspaceStore): WorkspaceStore<PersistedState> {
  const compact: WorkspaceStore<PersistedState> = {
    ...store,
    records: store.records.map((record) => {
      const cached = compactRecordCache.get(record);
      const state = compactStateForLocalStorage(record.state) as unknown as PersistedState;
      if (cached?.state === state && cached.name === record.name && cached.updatedAt === record.updatedAt) return cached;
      const compact = { ...record, state };
      compactRecordCache.set(record, compact);
      return compact;
    })
  };
  return compact;
}

let localWorkspaceWriteRevision = 0;
let newestLocalSnapshot: AppWorkspaceStore | undefined;
type CloudJournalRevision = { ownerId: string; revision: number };
let cloudJournalRevision = 0;
let locallyAcknowledgedJournal: string | null = null;
const cloudStoreRevisions = new WeakMap<AppWorkspaceStore, CloudJournalRevision>();
const acknowledgedCloudRevisions = new Map<string, number>();

function clearAcknowledgedWorkspaceJournal(journal: string | null) {
  try {
    if (!journal || journal !== locallyAcknowledgedJournal || window.localStorage.getItem(PENDING_WORKSPACE_JOURNAL_KEY) !== journal) return;
    const cloud = (JSON.parse(journal) as { cloud?: CloudJournalRevision }).cloud;
    if (cloud && (acknowledgedCloudRevisions.get(cloud.ownerId) ?? 0) < cloud.revision) return;
    window.localStorage.removeItem(PENDING_WORKSPACE_JOURNAL_KEY);
    locallyAcknowledgedJournal = null;
  } catch { /* Keep the recovery journal if its acknowledgment cannot be verified. */ }
}

const localWorkspaceWrites = new LatestSnapshotQueue<{
  localSnapshot: AppWorkspaceStore; journal: string | null;
}>(async ({ localSnapshot, journal }) => {
  try {
    await writeRawWorkspaceStore(localSnapshot, { writeRecovery: false });
  } catch {
    // A delayed failure must not replace a newer pagehide recovery copy.
    await writeRawWorkspaceStore(newestLocalSnapshot ?? localSnapshot, { writeRecovery: true });
  }
  locallyAcknowledgedJournal = journal;
  // Older writes cannot erase a newer journal, even with equal timestamps.
  clearAcknowledgedWorkspaceJournal(journal);
});

function writeWorkspaceStore(store: AppWorkspaceStore, options: { recovery?: boolean } = {}) {
  if (!validateSnapshot(store, "store", "save")) return Promise.reject(new Error("Workspace data failed validation. The last valid recovery copy was kept."));
  const recovery = options.recovery ?? true;
  const localSnapshot = compactWorkspaceStoreForLocalStorage(store);
  if (!validateSnapshot(localSnapshot, "store", "save")) return Promise.reject(new Error("Workspace data failed validation. The last valid recovery copy was kept."));
  newestLocalSnapshot = localSnapshot;
  if (recovery) {
    // Page closure cannot wait for the active IndexedDB write to finish.
    try { writeWorkspaceRecovery(localSnapshot); } catch { /* Keep the journal and try IndexedDB. */ }
  }
  const revision = ++localWorkspaceWriteRevision;
  const activeRecord = localSnapshot.records.find((record) => record.id === localSnapshot.activeId);
  let journal: string | null = null;
  if (activeRecord) {
    journal = JSON.stringify({
      version: 1,
      revision,
      writeId: crypto.randomUUID(),
      cloud: cloudStoreRevisions.get(store),
      activeId: activeRecord.id,
      savedAt: activeRecord.state.savedAt ?? activeRecord.updatedAt,
      topics: activeRecord.state.topics,
      settings: activeRecord.state.settings,
      feedStarted: activeRecord.state.feedStarted,
      theme: activeRecord.state.theme
    });
    try { window.localStorage.setItem(PENDING_WORKSPACE_JOURNAL_KEY, journal); } catch { /* IndexedDB remains the normal persistence path. */ }
  }
  return localWorkspaceWrites.enqueue({ localSnapshot, journal });
}

function restorePendingWorkspaceJournal(store: AppWorkspaceStore, catalogTopics?: TopicNode[]): AppWorkspaceStore {
  try {
    const journal = parseSnapshot(window.localStorage.getItem(PENDING_WORKSPACE_JOURNAL_KEY), "journal", "read") as {
      revision?: number; activeId?: string; savedAt?: string; topics?: unknown; settings?: FeedSettings; feedStarted?: boolean; theme?: "light" | "dark";
    } | null;
    if (!journal?.activeId) return store;
    const record = store.records.find((item) => item.id === journal.activeId);
    if (!record) return store;
    const previousTime = Math.max(Date.parse(record.updatedAt || "") || 0, Date.parse(record.state.savedAt || "") || 0);
    if ((Date.parse(journal.savedAt || "") || 0) < previousTime) {
      // The stored snapshot is newer, but an upload may still be unacknowledged.
      // The next save replaces this journal and clears it after acknowledgment.
      return store;
    }
    const recoveredTopics = restoreTopicPreferences(journal.topics, false, catalogTopics);
    const recoveredState = {
      ...record.state,
      ...(recoveredTopics ? { topics: recoveredTopics } : {}),
      ...(journal.settings ? { settings: { ...record.state.settings, ...journal.settings } } : {}),
      ...(typeof journal.feedStarted === "boolean" ? { feedStarted: journal.feedStarted } : {}),
      ...(journal.theme ? { theme: journal.theme } : {}),
      savedAt: journal.savedAt
    };
    if (!validateSnapshot(recoveredState, "state", "read")) return store;
    record.state = recoveredState;
    record.updatedAt = journal.savedAt ?? record.updatedAt;
    store.activeId = record.id;
    if (journal.theme) store.theme = journal.theme;
    return store;
  } catch {
    return store;
  }
}

function readWorkspaceState() {
  for (const key of [STORAGE_KEY, STORAGE_BACKUP_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const value = window.localStorage.getItem(key);
      const parsed = parseSnapshot(value, "state", "read");
      if (parsed) return parsed as Partial<PersistedState>;
    } catch {
      // Try the next local snapshot instead of losing the workspace.
    }
  }
  return null;
}

function writeWorkspaceState(state: PersistedState) {
  try {
    const snapshot = { ...compactStateForLocalStorage(state), savedAt: new Date().toISOString() };
    writeRecoverySnapshot(window.localStorage, STORAGE_KEY, STORAGE_BACKUP_KEY, snapshot, "state");
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
    ...(outcome.error ? { error: outcome.error } : {}),
    ...(outcome.retryAt ? { retryAt: outcome.retryAt } : {})
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
    channelOrder: workspace.channelOrder,
    prioritizeRecentByChannel: workspace.prioritizeRecentByChannel
  };
}

function applyYouTubeActivity(workspace: YouTubeWorkspaceState, activity?: Partial<YouTubeWorkspaceActivity>): YouTubeWorkspaceState {
  const restored = { ...workspace, ...(activity ?? {}) };
  const videoIds = new Set(workspace.videos.map((video) => video.id));
  const channelIds = new Set(workspace.channels.map((channel) => channel.id));
  return {
    ...restored,
    savedIds: (activity?.savedIds ?? []).filter((id) => videoIds.has(id)),
    history: (activity?.history ?? []).filter((item) => videoIds.has(item.videoId)),
    playbackPositions: Object.fromEntries(Object.entries(activity?.playbackPositions ?? {}).filter(([id]) => videoIds.has(id))),
    searchText: activity?.searchText ?? "",
    selectedTopic: activity?.selectedTopic ?? "All",
    activeTab: activity?.activeTab ?? "discover",
    discoverIds: (activity?.discoverIds ?? []).filter((id) => videoIds.has(id)),
    channelOrder: activity?.channelOrder ?? DEFAULT_YOUTUBE_WORKSPACE.channelOrder,
    prioritizeRecentByChannel: mergeYouTubeRecencyPreferences(
      workspace.legacyPrioritizeRecentByChannel ?? {},
      activity?.prioritizeRecentByChannel ?? {}
    ),
    selectedVideoId: activity?.selectedVideoId && videoIds.has(activity.selectedVideoId) ? activity.selectedVideoId : undefined,
    selectedChannelId: activity?.selectedChannelId && channelIds.has(activity.selectedChannelId) ? activity.selectedChannelId : undefined,
  };
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
  const normalizedReferences = normalizeSpotlightSources(linkedSources, raw.evidence ?? [], 3);
  const sources = normalizedReferences.sources;
  const rawDifficulty = legacyDifficulty ? migrateLegacyDifficulty(raw.difficulty ?? raw.obscurity) : raw.difficulty ?? raw.obscurity;
  const difficulty = normalizeDifficulty(rawDifficulty, DEFAULT_DIFFICULTY);
  const normalized: FactCard = {
    id: raw.id ?? `generated-${Date.now()}-${index}`,
    title: raw.title?.trim() ?? "",
    hook: normalizeHook(raw.hook?.trim() || body.split(/[.!?]/)[0]?.split(" ").slice(0, 10).join(" ") || ""),
    body,
    sentences: Array.isArray(raw.sentences) ? raw.sentences.filter((sentence): sentence is string => typeof sentence === "string").map((sentence) => sentence.trim()).filter(Boolean) : undefined,
    sentenceCount: normalizeSentenceLength(raw.sentenceCount ?? body.match(/[.!?](?=(?:["'”’»)]|\s|$))/g)?.length),
    claim: raw.claim,
    evidence: normalizedReferences.evidence,
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
    explanations: raw.explanations,
    glossary: raw.glossary,
    chronology: raw.chronology,
    learnMore: raw.learnMore,
    learnMoreSources: raw.learnMoreSources ? uniqueSources(raw.learnMoreSources) : raw.learnMore && !raw.answer ? (raw.answerSources ? uniqueSources(raw.answerSources) : undefined) : undefined,
    question: raw.question,
    questionDetailed: raw.questionDetailed,
    answer: raw.answer,
    answerDetailed: raw.answerDetailed,
    answerSources: raw.answerSources ? uniqueSources(raw.answerSources) : undefined,
    questionHistory: raw.questionHistory,
    provenance: raw.provenance
  };
  normalized.explanations = normalizeCardExplanations(normalized);
  normalized.glossary = normalizeCardGlossary(normalized);
  normalized.chronology = createSavedCardChronology(raw.chronology, normalized) ?? normalizeSavedCardChronology(normalized);
  normalized.followUpQuestions = Array.isArray(raw.followUpQuestions)
    ? createSavedFollowUpQuestions(raw.followUpQuestions, normalized)
    : normalizeSavedFollowUpQuestions(raw.followUpQuestions, normalized);
  normalized.locations = createSavedCardLocations(raw.locations, normalized);
  return normalized;
}

function migrateLearningProfile(profile: LearningProfile): LearningProfile {
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, { ...value, targetDifficulty: migrateLegacyDifficulty(value.targetDifficulty) }])) as LearningProfile;
}

function normalizeSavedState(parsed: Partial<PersistedState> | null, collapseInitial: boolean, catalogTopics?: TopicNode[]): PersistedState {
  const storedTopics: unknown = parsed?.topics;
  const compactTopics = restoreTopicPreferences(storedTopics, collapseInitial, catalogTopics);
  const needsCatalogMigration = (parsed?.topicCatalogVersion ?? 0) < TOPIC_CATALOG_VERSION;
  const restoredTopics = Array.isArray(storedTopics)
    ? (needsCatalogMigration ? migrateTopicTree(storedTopics, collapseInitial, needsCatalogMigration) : storedTopics)
    : compactTopics
      ? (needsCatalogMigration ? migrateTopicTree(compactTopics, collapseInitial, needsCatalogMigration) : compactTopics)
      : createDefaultTopics();
  const restoredSettings: FeedSettings = { ...DEFAULT_SETTINGS, ...parsed?.settings, displayMode: parsed?.settings?.displayMode === "text" ? "text" : "picture-text" };
  restoredSettings.sentenceLength = normalizeSentenceLength(parsed?.settings?.sentenceLength);
  const realCards = (parsed?.cards ?? []).filter((card) => !KNOWN_DEMO_IDS.has(card.id));
  const restoredCards = uniqueCards(realCards.map((card, index) => normalizeFact(card, index)).filter((card) => card.title.trim() && card.body.trim() && card.hook.trim() && card.topicPath.length && card.sources.length));
  const restoredProfile = normalizeLearningProfile(parsed?.learningProfile ?? {}, normalizeDifficulty(restoredSettings.obscurity));
  const restoredTheme = parsed?.theme === "dark" ? "dark" : "light";
  return { persistenceVersion: PERSISTENCE_VERSION, savedAt: parsed?.savedAt, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: restoredTopics, settings: restoredSettings, cards: restoredCards, learningProfile: restoredProfile, feedStarted: Boolean(parsed?.feedStarted && restoredCards.length), theme: restoredTheme, youtubeActivity: parsed?.youtubeActivity };
}

function learningResponseCacheKey(sessionId: string, apiKey: string, action: "learn" | "question", card: FactCard, question = "", detailed = false, history: LearningMessage[] = []) {
  const identity = {
    id: card.id,
    title: card.title,
    hook: card.hook,
    body: card.body,
    topicPath: card.topicPath,
    claim: card.claim,
    sources: card.sources.map((source) => ({ title: source.title, url: source.canonicalUrl ?? source.url, extract: source.extract }))
  };
  return requestCacheKey(requestCacheScope(sessionId, apiKey), "learning-response", action, identity, question.trim(), detailed, history.slice(-6));
}

export default function HomePage() {
  const initialTopicCatalog = useRef<TopicNode[] | null>(null);
  const [workspaceId, setWorkspaceId] = useState("local-workspace");
  const [workspaceName, setWorkspaceName] = useState("Local Workspace");
  const [workspaceSummaries, setWorkspaceSummaries] = useState<WorkspaceSummary[]>([{ id: "local-workspace", name: "Local Workspace", createdAt: "", updatedAt: "" }]);
  const [view, setView] = useState<View>("feed");
  const [topics, setTopics] = useState<TopicNode[]>(() => {
    const catalog = createDefaultTopics();
    initialTopicCatalog.current = catalog;
    return catalog;
  });
  const pendingCustomTopicIds = useRef(new Set<string>());
  const pendingCustomTopicLabels = useRef(new Map<string, string>());
  const pendingCustomTopicWorkspace = useRef("local-workspace");
  const resetCustomTopicReservations = useCallback((nextWorkspaceId: string) => {
    pendingCustomTopicIds.current.clear();
    pendingCustomTopicLabels.current.clear();
    pendingCustomTopicWorkspace.current = nextWorkspaceId;
  }, []);
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_SETTINGS);
  const [cards, setCards] = useState<FactCard[]>([]);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, { text?: string; detailed?: boolean }>>({});
  const [learningProfile, setLearningProfileState] = useState<LearningProfile>({});
  const learningProfileRef = useRef(learningProfile);
  // Keep consecutive event handlers current even before React commits a render.
  const setLearningProfile = useCallback((update: SetStateAction<LearningProfile>) => {
    const next = typeof update === "function" ? update(learningProfileRef.current) : update;
    learningProfileRef.current = next;
    setLearningProfileState(next);
  }, []);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [pendingSlots, setPendingSlots] = useState(DEFAULT_CARD_GENERATION_COUNT);
  const [feedStarted, setFeedStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [semanticSearch, setSemanticSearch] = useState<{ query: string; terms: string[]; plan?: TopicQueryPlan }>({ query: "", terms: [] });
  const [customTopic, setCustomTopic] = useState("");
  const [rabbitHole, setRabbitHole] = useState<string | null>(null);
  const [topicDetour, setTopicDetourState] = useState<TopicDetour | null>(null);
  const [topicDetourStatusNotice, setTopicDetourStatusNotice] = useState<string | null>(null);
  const topicDetourRef = useRef<TopicDetour | null>(null);
  const topicDetourNoticeTimer = useRef<number | null>(null);
  const activeGenerationDetourId = useRef<string | null>(null);
  const startFeedRef = useRef<((rabbitHoleOverride?: string | null, requestedCount?: number, detourRequest?: { id: string; topicPath: string[]; slotIndexes: number[] }) => Promise<void>) | null>(null);
  const updateTopicDetour = useCallback((next: TopicDetour | null) => {
    if (next && topicDetourNoticeTimer.current !== null) {
      window.clearTimeout(topicDetourNoticeTimer.current);
      topicDetourNoticeTimer.current = null;
      setTopicDetourStatusNotice(null);
    }
    topicDetourRef.current = next;
    setTopicDetourState(next);
  }, []);
  const clearTopicDetourStatusNotice = useCallback(() => {
    if (topicDetourNoticeTimer.current !== null) window.clearTimeout(topicDetourNoticeTimer.current);
    topicDetourNoticeTimer.current = null;
    setTopicDetourStatusNotice(null);
  }, []);
  useEffect(() => {
    clearTopicDetourStatusNotice();
    return () => {
      if (topicDetourNoticeTimer.current !== null) window.clearTimeout(topicDetourNoticeTimer.current);
      topicDetourNoticeTimer.current = null;
    };
  }, [clearTopicDetourStatusNotice, workspaceId]);
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [apiKey, setApiKey] = useState("");
  const [keysHydrated, setKeysHydrated] = useState(false);
  const [authRestored, setAuthRestored] = useState(false);
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
  const [adaptationLoading, setAdaptationLoading] = useState<string | null>(null);
  const [glossaryLoading, setGlossaryLoading] = useState<string | null>(null);
  const [learningErrors, setLearningErrors] = useState<Record<string, string | undefined>>({});
  const [youtubeKey, setYoutubeKey] = useState("");
  const [youtubeStatus, setYoutubeStatus] = useState<"not-configured" | "connecting" | "refreshing" | "connected" | "error">("not-configured");
  const [youtubeProgress, setYoutubeProgress] = useState<YouTubeImportProgress>({ phase: "idle", completedChannels: 0, totalChannels: APPROVED_YOUTUBE_CHANNELS.length, importedVideos: 0 });
  const [youtubeWorkspace, setYoutubeWorkspace] = useState<YouTubeWorkspaceState>(DEFAULT_YOUTUBE_WORKSPACE);
  const youtubeIndexes = useMemo(() => {
    const videoById = new Map<string, YouTubeVideo>();
    const channelById = new Map<string, YouTubeChannelRecord>();
    const videosByChannel = new Map<string, YouTubeVideo[]>();
    const videosByTopic = new Map<YouTubeTopic | "All", YouTubeVideo[]>([["All", []]]);
    const catalogIsCurrent = youtubeWorkspace.catalogVersion >= YOUTUBE_CATALOG_VERSION;
    for (const channel of youtubeWorkspace.channels) channelById.set(channel.id, channel);
    for (const video of youtubeWorkspace.videos) {
      videoById.set(video.id, video);
      const channelVideos = videosByChannel.get(video.channelId) ?? [];
      channelVideos.push(video);
      videosByChannel.set(video.channelId, channelVideos);
      if (!catalogIsCurrent && !isApprovedYouTubeVideo(video)) continue;
      videosByTopic.get("All")!.push(video);
      for (const topic of video.topics) {
        const matches = videosByTopic.get(topic) ?? [];
        matches.push(video);
        videosByTopic.set(topic, matches);
      }
    }
    return { videoById, channelById, videosByChannel, videosByTopic };
  }, [youtubeWorkspace.catalogVersion, youtubeWorkspace.channels, youtubeWorkspace.videos]);
  const youtubeTopicPool = useCallback((topic: YouTubeTopic | "All") => youtubeIndexes.videosByTopic.get(topic) ?? [], [youtubeIndexes]);
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<YouTubeVideo[]>([]);
  const [youtubeSmartSearchLoading, setYoutubeSmartSearchLoading] = useState(false);
  const [youtubeSmartSearchRan, setYoutubeSmartSearchRan] = useState(false);
  const [youtubeSearchPhase, setYoutubeSearchPhase] = useState<"idle" | "interpreting" | "checking" | "expanding" | "error">("idle");
  const [youtubeSearchReasons, setYoutubeSearchReasons] = useState<Record<string, RankedVideoSearchResult>>({});
  const [youtubeError, setYoutubeError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [revealGradually, setRevealGradually] = useState(false);
  const setRevealGraduallyPreference = useCallback((enabled: boolean) => {
    const normalized = enabled === true;
    clearCardRevealProgress();
    setRevealGradually(normalized);
    try { window.localStorage.setItem(REVEAL_GRADUALLY_PREFERENCE_KEY, normalized ? "true" : "false"); } catch { /* The device preference remains usable for this session. */ }
  }, []);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const [topicWorkerReadyRevision, setTopicWorkerReadyRevision] = useState(-1);
  const [topicSearchReply, setTopicSearchReply] = useState<TopicSearchWorkerReply>({ type: "ready", catalogRevision: -1 });
  const [cardSearchWorkerReadyState, setCardSearchWorkerReadyState] = useState(false);
  const [cardSearchWorkerFailed, setCardSearchWorkerFailed] = useState(false);
  const [cardSearchIndexRevision, setCardSearchIndexRevision] = useState(0);
  const [cardSearchReply, setCardSearchReply] = useState<CardSearchWorkerReply | null>(null);
  const [youtubeSearchWorkerReadyState, setYoutubeSearchWorkerReadyState] = useState(false);
  const [youtubeSearchWorkerFailed, setYoutubeSearchWorkerFailed] = useState(false);
  const [youtubeSearchIndexRevision, setYoutubeSearchIndexRevision] = useState(0);
  const requestGeneration = useRef(0);
  const topicCatalogRevision = useRef(0);
  const topicCatalogReset = useRef(0);
  const catalogTopicListCache = useRef<{ revision: number; topics: Array<TopicNode & { path: string[] }> } | null>(null);
  const catalogSuggestionIndexCache = useRef<{ revision: number; index: ReturnType<typeof createTopicSuggestionIndex> } | null>(null);
  const topicSearchWorker = useRef<Worker | null>(null);
  const topicWorkerIndexed = useRef<{ revision: number; rebuildKey: string; records: Map<string, TopicSearchRecord> } | null>(null);
  const topicWorkerSnapshot = useRef({ revision: 0, rebuildKey: "", records: [] as TopicSearchRecord[] });
  const topicSearchRequestId = useRef(0);
  const topicSearchSignature = useRef("");
  const topicEnrichmentAttempt = useRef("");
  const cardSearchWorker = useRef<Worker | null>(null);
  const cardSearchWorkerReady = useRef(false);
  const cardSearchIndexedCards = useRef(new Map<string, { card: FactCard; text: string }>());
  const cardSearchRevision = useRef(0);
  const cardSearchRequestId = useRef(0);
  const cardSearchSignature = useRef("");
  const youtubeSearchWorker = useRef<Worker | null>(null);
  const youtubeSearchWorkerReady = useRef(false);
  const youtubeSearchWorkerReadyWaiters = useRef<Array<() => void>>([]);
  const youtubeSearchWorkerIndexedVideos = useRef<Map<string, YouTubeVideo> | null>(null);
  const youtubeSearchWorkerPendingVideos = useRef<YouTubeVideo[] | null>(null);
  const youtubeSearchWorkerNeedsRebuild = useRef(false);
  const youtubeSearchWorkerPolicy = useRef(`${YOUTUBE_CATALOG_VERSION}:${VIDEO_SEMANTIC_VERSION}`);
  const youtubeSearchWorkerRevision = useRef(0);
  const youtubeSearchRequestId = useRef(0);
  const youtubeSearchPending = useRef(new Map<number, { resolve: (reply: YouTubeSearchWorkerReply) => void; reject: (error: unknown) => void; signal: AbortSignal; onAbort: () => void }>());
  const currentQueryRef = useRef(query);
  currentQueryRef.current = query;
  const generationAbortController = useRef<AbortController | null>(null);
  const imageHydrationControllers = useRef(new Map<string, AbortController>());
  const imageHydrationQueue = useRef<Array<{ card: FactCard; requestId: number; workspaceId: string; epoch: number }>>([]);
  const imageHydrationEpoch = useRef(0);
  const imageHydrationActive = useRef(false);
  const connectionAbortController = useRef<AbortController | null>(null);
  const learningAbortController = useRef<AbortController | null>(null);
  const questionAbortController = useRef<AbortController | null>(null);
  const adaptationAbortController = useRef<{ key: string; controller: AbortController } | null>(null);
  const glossaryAbortController = useRef<{ key: string; controller: AbortController } | null>(null);
  const youtubeAbortController = useRef<AbortController | null>(null);
  const youtubeSearchAutomaticSignature = useRef("");
  const youtubeSearchActiveKey = useRef("");
  const youtubeSearchPlan = useRef<VideoSearchPlan | null>(null);
  const youtubeSearchMoreAbort = useRef<AbortController | null>(null);
  const youtubeSearchResultsRef = useRef<YouTubeVideo[]>([]);
  const youtubeBrowsingOrder = useRef<YouTubeWorkspaceState["channelOrder"]>("newest");
  const [youtubeSearchHasMore, setYoutubeSearchHasMore] = useState(true);
  const youtubeSearchAbortController = useRef<AbortController | null>(null);
  const globalSearchAbortController = useRef<AbortController | null>(null);
  const naturalSearchCache = useRef(new SessionCache<TopicQueryPlan>(100, SEARCH_CACHE_TTL_MS));
  const youtubeSearchCache = useRef(new SessionCache<{ results: YouTubeVideo[]; reasons: Record<string, RankedVideoSearchResult>; plan: VideoSearchPlan; expanded: boolean }>(100, SEARCH_CACHE_TTL_MS));
  const learningResponseCache = useRef(new SessionCache<{ answer: string; citations: WikipediaSource[] }>(100, SEARCH_CACHE_TTL_MS));
  const youtubeCatalogLoadedRef = useRef(false);
  const youtubeActivityLoadedWorkspaceRef = useRef<string | null>(null);
  const youtubeActivityEditEpoch = useRef(0);
  const apiKeyRef = useRef("");
  const youtubeKeyRef = useRef("");
  const credentialManager = useRef<AccountCredentials | null>(null);
  const credentialOwner = useRef<string | null>(null);
  const userEditingKey = useRef(false);
  const restoredGeminiKey = useRef("");
  const [keySyncStatus, setKeySyncStatus] = useState("local");
  const [keySyncError, setKeySyncError] = useState("");
  const sessionIdRef = useRef("browser-" + Math.random().toString(36).slice(2));
  const persistedStateRef = useRef<PersistedState | null>(null);
  const youtubeWorkspaceRef = useRef<YouTubeWorkspaceState>(DEFAULT_YOUTUBE_WORKSPACE);
  const workspaceStoreRef = useRef<AppWorkspaceStore | null>(null);
  const workspaceSaveTimer = useRef<number | null>(null);
  const youtubeActivitySaveTimers = useRef(new Map<string, number>());
  const youtubePlaybackFlushRef = useRef<(() => void) | null>(null);
  const workspaceIdRef = useRef("local-workspace");
  const workspaceNameRef = useRef("Local Workspace");
  const workspaceEpochRef = useRef(0);
  const keyEditEpoch = useRef(0);
  const factMemoryRef = useRef<FactMemory[]>([]);
  const factNoveltyIndexRef = useRef(new FactNoveltyIndex());
  const cloudSyncRef = useRef<WorkspaceCloudSync | null>(null);
  const cloudAbortController = useRef<AbortController | null>(null);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudEpoch = useRef(0);
  const cloudUserId = useRef<string | null>(null);
  const cloudLoaded = useRef(false);
  const cloudLoadingUser = useRef<string | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const pendingDetourScrollAnchor = useRef<{ workspaceId: string; cardId: string; top: number } | null>(null);
  const displayModeRef = useRef(settings.displayMode);
  const recordGeminiOutcomes = useCallback((outcomes: GeminiModelOutcome[], finalStatus?: GeminiStatus) => {
    if (outcomes.length) setModelChecks((current) => outcomes.reduce(mergeGeminiModelOutcome, current));
    const status = finalStatus ?? (outcomes.some((outcome) => outcome.status === "success") ? "connected" : outcomes.length ? outcomes.every((outcome) => outcome.status === "cooldown") ? "rate-limited" : "unavailable" : undefined);
    if (status) setGeminiStatus(status);
  }, []);
  const recordGeminiFailure = useCallback((error: unknown) => {
    const details = geminiFailureDetails(error);
    recordGeminiOutcomes(details.outcomes, details.status);
  }, [recordGeminiOutcomes]);
  // Full history stays local; generation receives compact signatures and a bounded list of relevant claims.
  const archiveFacts = useCallback((incoming: FactCard[]) => {
    const previous = factMemoryRef.current;
    const next = mergeFactMemory(previous, incoming.map(rememberFact));
    cloudSyncRef.current?.markFactMemoriesChanged(previous, next, new Set(incoming.map(card => card.id)));
    factMemoryRef.current = next;
    for (const card of incoming) factNoveltyIndexRef.current.add(rememberFact(card));
    if (workspaceStoreRef.current) workspaceStoreRef.current.factMemory = factMemoryRef.current;
  }, []);
  const acceptFact = useCallback((card: FactCard, detour?: { id: string; slot: number }) => {
    if (!hasExactSentenceCount(card.body, settings.sentenceLength)) return false;
    const next = rememberFact(card);
    if (factNoveltyIndexRef.current.findDuplicate(next)) return false;
    const activeDetour = detour && topicDetourRef.current?.id === detour.id ? topicDetourRef.current : null;
    if (activeDetour && detour) {
      const acceptedDetour = acceptTopicDetourCard(activeDetour, detour.slot, card.id);
      if (acceptedDetour === activeDetour) return false;
      if (!pendingDetourScrollAnchor.current) {
        const root = mainScrollRef.current;
        const rootTop = root?.getBoundingClientRect().top ?? 0;
        const rootBottom = root?.getBoundingClientRect().bottom ?? window.innerHeight;
        const visibleCard = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-fact-card-id]")).find(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.bottom > rootTop && bounds.top < rootBottom;
        }) : undefined;
        if (visibleCard?.dataset.factCardId) pendingDetourScrollAnchor.current = { workspaceId: activeDetour.workspaceId, cardId: visibleCard.dataset.factCardId, top: visibleCard.getBoundingClientRect().top };
      }
      archiveFacts([card]);
      updateTopicDetour(acceptedDetour);
      setCards(current => orderTopicDetourCards(current, acceptedDetour, card));
    } else {
      archiveFacts([card]);
      setCards(current => appendUniqueCards(current, [card]));
    }
    return true;
  }, [archiveFacts, settings.sentenceLength, updateTopicDetour]);

  useLayoutEffect(() => {
    const anchor = pendingDetourScrollAnchor.current;
    if (!anchor) return;
    pendingDetourScrollAnchor.current = null;
    if (anchor.workspaceId !== workspaceId) return;
    const root = mainScrollRef.current;
    const element = root?.querySelector<HTMLElement>(`[data-fact-card-id="${CSS.escape(anchor.cardId)}"]`);
    if (!root || !element) return;
    const delta = element.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) > 1) root.scrollTop += delta;
  }, [cards, workspaceId]);

  const enqueueImageHydration = useCallback((incoming: FactCard[], requestId: number, workspaceId: string) => {
    if (displayModeRef.current !== "picture-text") return;
    const epoch = imageHydrationEpoch.current;
    incoming.forEach(card => {
      if (!card.sources?.[0] || card.image || imageHydrationControllers.current.has(card.id) || imageHydrationQueue.current.some(job => job.card.id === card.id)) return;
      imageHydrationQueue.current.push({ card, requestId, workspaceId, epoch });
    });
    if (imageHydrationActive.current) return;
    imageHydrationActive.current = true;
    void (async () => {
      try {
        while (imageHydrationQueue.current.length) {
          const job = imageHydrationQueue.current.shift()!;
          if (job.epoch !== imageHydrationEpoch.current || job.requestId !== requestGeneration.current || job.workspaceId !== workspaceIdRef.current || displayModeRef.current !== "picture-text") continue;
          const controller = new AbortController();
          imageHydrationControllers.current.set(job.card.id, controller);
          try {
            const image = await resolveWikipediaImage(job.card.sources[0], controller.signal);
            if (!image || controller.signal.aborted || job.epoch !== imageHydrationEpoch.current || job.requestId !== requestGeneration.current || job.workspaceId !== workspaceIdRef.current || displayModeRef.current !== "picture-text") continue;
            setCards(current => current.some(item => item.id === job.card.id) ? current.map(item => item.id === job.card.id ? { ...item, image } : item) : current);
          } catch {
            // Images are optional and do not affect verified text cards.
          } finally {
            if (imageHydrationControllers.current.get(job.card.id) === controller) imageHydrationControllers.current.delete(job.card.id);
          }
        }
      } finally {
        imageHydrationActive.current = false;
        if (imageHydrationQueue.current.length) enqueueImageHydration([], requestGeneration.current, workspaceIdRef.current);
      }
    })();
  }, []);

  const cancelGeneration = useCallback(() => {
    generationAbortController.current?.abort();
    generationAbortController.current = null;
    activeGenerationDetourId.current = null;
    setLoading(false);
  }, []);

  const cancelWorkspaceRequests = useCallback(() => {
    youtubePlaybackFlushRef.current?.();
    generationAbortController.current?.abort();
    generationAbortController.current = null;
    activeGenerationDetourId.current = null;
    updateTopicDetour(null);
    connectionAbortController.current?.abort();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    adaptationAbortController.current?.controller.abort();
    adaptationAbortController.current = null;
    glossaryAbortController.current?.controller.abort();
    glossaryAbortController.current = null;
    setGlossaryLoading(null);
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
    globalSearchAbortController.current?.abort();
    imageHydrationControllers.current.forEach(controller => controller.abort());
    imageHydrationControllers.current.clear();
    imageHydrationEpoch.current += 1;
    imageHydrationQueue.current = [];
    requestGeneration.current += 1;
    workspaceEpochRef.current += 1;
    setLoading(false);
    setLearnLoading(null);
    setQuestionLoading(null);
    setAdaptationLoading(null);
    setYoutubeSmartSearchLoading(false);
  }, [updateTopicDetour]);

  const scheduleCloudSave = useCallback(() => {
    const currentStore = workspaceStoreRef.current;
    const currentUser = cloudUserId.current;
    if (!hydrated || !cloudSyncRef.current || !currentStore || !currentUser || !cloudLoaded.current || currentStore.ownerId !== currentUser) return;
    cloudStoreRevisions.set(currentStore, { ownerId: currentUser, revision: ++cloudJournalRevision });
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    const enqueueSave = () => {
      cloudSaveTimer.current = null;
      const sync = cloudSyncRef.current;
      const store = workspaceStoreRef.current;
      const userId = cloudUserId.current;
      if (!sync || !store || !userId || store.ownerId !== userId) return;
      const epoch = cloudEpoch.current;
      // This controller belongs to the account, not the current edit/workspace.
      const controller = cloudAbortController.current;
      if (!controller || controller.signal.aborted || !cloudLoaded.current) return;
      const receipt = cloudStoreRevisions.get(store);
      setSyncStatus("syncing");
      void sync.save(store, controller.signal).then(() => {
        if (cloudEpoch.current !== epoch || cloudUserId.current !== userId) return;
        if (receipt) {
          acknowledgedCloudRevisions.set(userId, Math.max(acknowledgedCloudRevisions.get(userId) ?? 0, receipt.revision));
          clearAcknowledgedWorkspaceJournal(locallyAcknowledgedJournal);
        }
        if (!sync.hasPendingUploads) { setSyncStatus("synced"); setSyncError(""); }
      }).catch((error) => {
        if (controller.signal.aborted || cloudEpoch.current !== epoch) return;
        setSyncStatus(navigator.onLine === false ? "offline" : "error");
        setSyncError(error instanceof Error ? error.message : "Cloud sync could not save this workspace.");
      });
    };
    // An active upload already provides batching time. Replace its pending
    // snapshot immediately so the next send cannot use a superseded revision.
    if (cloudSyncRef.current.isUploading) enqueueSave();
    else cloudSaveTimer.current = window.setTimeout(enqueueSave, 650);
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
    if (workspaceSaveTimer.current !== null) window.clearTimeout(workspaceSaveTimer.current);
    workspaceSaveTimer.current = null;
    const currentId = workspaceIdRef.current;
    const currentName = workspaceNameRef.current;
    await saveWorkspaceRecordNow(currentId, currentName, makeCurrentSnapshot());
    const target = workspaceStoreRef.current.records.find((record) => record.id === targetId);
    if (!target) return;
    workspaceStoreRef.current.activeId = target.id;
    resetCustomTopicReservations(target.id);
    workspaceIdRef.current = target.id;
    workspaceNameRef.current = target.name;
    setWorkspaceId(target.id);
    setWorkspaceName(target.name);
    const targetState = normalizeSavedState(target.state, false, initialTopicCatalog.current ?? undefined);
    target.state = targetState;
    setTopics(targetState.topics);
    topicCatalogReset.current += 1;
    topicCatalogRevision.current += 1;
    setSettings(targetState.settings);
    const restoredCards = targetState.cards;
    setCards(restoredCards);
    setQuestionDrafts({});
    setLearningProfile(targetState.learningProfile);
    setFeedStarted(targetState.feedStarted);
    setFeedHasMore(true);
    setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
    setQuery("");
    setCustomTopic("");
    setRabbitHole(null);
    setGenerationError("");
    setLearningErrors({});
    setView("feed");
    setYoutubeWorkspace((current) => applyYouTubeActivity(current, target.state.youtubeActivity));
    persistedStateRef.current = targetState;
    await writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("The workspace changed, but the active workspace could not be saved."));
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, resetCustomTopicReservations, saveWorkspaceRecordNow]);

  const createWorkspace = useCallback(async () => {
    if (!workspaceStoreRef.current) return;
    const requestedName = nextLocalWorkspaceName(workspaceStoreRef.current.records);
    cancelWorkspaceRequests();
    await saveWorkspaceRecordNow(workspaceIdRef.current, workspaceNameRef.current, makeCurrentSnapshot());
    if (workspaceSaveTimer.current !== null) window.clearTimeout(workspaceSaveTimer.current);
    workspaceSaveTimer.current = null;
    const now = new Date().toISOString();
    const record: AppWorkspaceRecord = { id: makeWorkspaceId(), name: requestedName, createdAt: now, updatedAt: now, state: { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: createDefaultTopics(), settings: { ...DEFAULT_SETTINGS, obscurity: 5 }, cards: [], learningProfile: {}, feedStarted: false, theme } };
    workspaceStoreRef.current.records.push(record);
    workspaceStoreRef.current.activeId = record.id;
    resetCustomTopicReservations(record.id);
    workspaceIdRef.current = record.id;
    workspaceNameRef.current = record.name;
    setWorkspaceId(record.id);
    setWorkspaceName(record.name);
    setWorkspaceSummaries(workspaceStoreRef.current.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
    setTopics(record.state.topics);
    topicCatalogReset.current += 1;
    topicCatalogRevision.current += 1;
    setSettings(record.state.settings);
    setCards([]);
    setQuestionDrafts({});
    setLearningProfile({});
    setFeedStarted(false);
    setFeedHasMore(true);
    setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
    setQuery("");
    setView("feed");
    setYoutubeWorkspace((current) => ({ ...current, savedIds: [], history: [], playbackPositions: {}, searchText: "", selectedTopic: "All", activeTab: "discover", selectedChannelId: undefined, selectedVideoId: undefined, discoverIds: [], channelOrder: "newest" }));
    await writeWorkspaceStore(workspaceStoreRef.current).catch(() => setToast("The new workspace could not be saved. A local recovery copy was kept."));
    setToast(`${record.name} created.`);
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, resetCustomTopicReservations, saveWorkspaceRecordNow, theme]);

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
      resetCustomTopicReservations(replacement.id);
      workspaceIdRef.current = replacement.id;
      workspaceNameRef.current = replacement.name;
      setWorkspaceId(replacement.id);
      setWorkspaceName(replacement.name);
      replacement.state = normalizeSavedState(replacement.state, false, initialTopicCatalog.current ?? undefined);
      setTopics(replacement.state.topics);
      topicCatalogReset.current += 1;
      topicCatalogRevision.current += 1;
      setSettings({ ...DEFAULT_SETTINGS, ...replacement.state.settings, sentenceLength: normalizeSentenceLength(replacement.state.settings?.sentenceLength) });
      const replacementCards = uniqueCards((replacement.state.cards ?? []).map((card, cardIndex) => normalizeFact(card, cardIndex)).filter((card) => card.title && card.body));
      setCards(replacementCards);
      setQuestionDrafts({});
      setLearningProfile(replacement.state.learningProfile ?? {});
      setFeedStarted(Boolean(replacement.state.feedStarted && replacementCards.length));
      setFeedHasMore(true);
      setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
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
  }, [cancelWorkspaceRequests, makeCurrentSnapshot, resetCustomTopicReservations, saveWorkspaceRecordNow]);

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
    adaptationAbortController.current?.controller.abort();
    glossaryAbortController.current?.controller.abort();
    youtubeAbortController.current?.abort();
    youtubeSearchAbortController.current?.abort();
  }, []);

  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  useEffect(() => { youtubeWorkspaceRef.current = youtubeWorkspace; }, [youtubeWorkspace]);

  useEffect(() => {
    if (!hydrated || (view !== "videos" && view !== "settings") || youtubeCatalogLoadedRef.current && youtubeActivityLoadedWorkspaceRef.current === workspaceId) return;
    const editEpoch = youtubeActivityEditEpoch.current;
    let active = true;
    const controller = new AbortController();
    const activeRecord = workspaceStoreRef.current?.records.find((record) => record.id === workspaceId);
    const fallback = activeRecord?.state.youtubeActivity;
    const restore = youtubeCatalogLoadedRef.current
      ? loadYouTubeActivity(workspaceId, fallback).then((activity) => applyYouTubeActivity(youtubeWorkspaceRef.current, activity ?? undefined))
      : loadYouTubeWorkspace(workspaceId, fallback, false, controller.signal);
    void restore.then((restored) => {
      if (!active || workspaceIdRef.current !== workspaceId) return;
      if (editEpoch !== youtubeActivityEditEpoch.current) restored = applyYouTubeActivity(restored, youtubeActivityOf(youtubeWorkspaceRef.current));
      youtubeWorkspaceRef.current = restored;
      youtubeCatalogLoadedRef.current = true;
      youtubeActivityLoadedWorkspaceRef.current = workspaceId;
      setYoutubeWorkspace(restored);
      if (restored.videos.length) setYoutubeStatus("connected");
    }).catch(() => { /* Canceled restoration keeps the current workspace intact. */ });
    return () => { active = false; controller.abort(); };
  }, [hydrated, view, workspaceId]);

  useEffect(() => {
    displayModeRef.current = settings.displayMode;
    if (settings.displayMode === "text") {
      imageHydrationEpoch.current += 1;
      imageHydrationQueue.current = [];
      imageHydrationControllers.current.forEach(controller => controller.abort());
      imageHydrationControllers.current.clear();
    }
  }, [settings.displayMode]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try { setRevealGradually(window.localStorage.getItem(REVEAL_GRADUALLY_PREFERENCE_KEY) === "true"); }
      catch { setRevealGradually(false); }
      const shouldMigrate = typeof window !== "undefined" && window.localStorage.getItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY) !== "1";
      let store = await readWorkspaceStore<PersistedState>(null);
      if (!active) return;
      let fallbackNormalized = false;
      if (!store) {
        let legacy: Partial<PersistedState> | null = null;
        try { legacy = readWorkspaceState(); } catch { legacy = null; }
        const legacyState = legacy
          ? normalizeSavedState(legacy, shouldMigrate || (legacy.topicCatalogVersion ?? 0) < 11, initialTopicCatalog.current ?? undefined)
          : { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: initialTopicCatalog.current ?? [], settings: DEFAULT_SETTINGS, cards: [], learningProfile: {}, feedStarted: false, theme: "light" as const };
        store = { version: 1, activeId: "local-workspace", records: [makeLocalWorkspace(legacyState)], theme: legacyState.theme };
        fallbackNormalized = true;
      }
      if (!store.records.length) {
        const topics = initialTopicCatalog.current ?? [];
        const emptyState: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics, settings: DEFAULT_SETTINGS, cards: [], learningProfile: {}, feedStarted: false, theme: "light" };
        store.records = [makeLocalWorkspace(emptyState)];
        store.activeId = store.records[0].id;
        fallbackNormalized = true;
      }
      const needsSnapshotMigration = store.records.some((record) => {
        const state = record.state as unknown as { persistenceVersion?: number; topics?: unknown };
        return Array.isArray(state.topics) || state.persistenceVersion !== PERSISTENCE_VERSION;
      });
      let hasPendingJournal = false;
      try { hasPendingJournal = Boolean(window.localStorage.getItem(PENDING_WORKSPACE_JOURNAL_KEY)); } catch { /* Workspace snapshots can still restore from IndexedDB. */ }
      store = restorePendingWorkspaceJournal(store, initialTopicCatalog.current ?? undefined);
      const activeRecord = store.records.find((record) => record.id === store.activeId) ?? store.records[0];
      factMemoryRef.current = mergeFactMemory(store.factMemory ?? [], store.records.flatMap(record => (record.state.cards ?? []).map(rememberFact)));
      factNoveltyIndexRef.current = new FactNoveltyIndex(factMemoryRef.current);
      store.factMemory = factMemoryRef.current;
      workspaceStoreRef.current = store;
      resetCustomTopicReservations(activeRecord.id);
      workspaceIdRef.current = activeRecord.id;
      workspaceNameRef.current = activeRecord.name;
      setWorkspaceId(activeRecord.id);
      setWorkspaceName(activeRecord.name);
      setWorkspaceSummaries(store.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
      const restored = fallbackNormalized ? activeRecord.state : normalizeSavedState(activeRecord.state, shouldMigrate || (activeRecord.state.topicCatalogVersion ?? 0) < 11, initialTopicCatalog.current ?? undefined);
      activeRecord.state = restored;
      persistedStateRef.current = restored;
      setTopics(restored.topics);
      topicCatalogReset.current += 1;
      topicCatalogRevision.current += 1;
      setSettings(restored.settings);
      setCards(restored.cards);
      setQuestionDrafts({});
      setLearningProfile(restored.learningProfile);
      setFeedStarted(restored.feedStarted);
      const sharedTheme = store.theme ?? restored.theme;
      store.theme = sharedTheme;
      setTheme(sharedTheme);
      if (shouldMigrate) window.localStorage.setItem(TEN_LEVEL_DIFFICULTY_MIGRATION_KEY, "1");
      if (window.localStorage.getItem(THEME_MIGRATION_KEY) !== "1") window.localStorage.setItem(THEME_MIGRATION_KEY, "1");
      if (needsSnapshotMigration || hasPendingJournal) {
        await writeWorkspaceStore(store, { recovery: needsSnapshotMigration }).catch(() => undefined);
      }
      setHydrated(true);

    };
    void restore();
    setSupabaseConfigured(Boolean(CLOUD_URL && CLOUD_PUBLIC_KEY));
    return () => { active = false; };
  }, [resetCustomTopicReservations]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== REVEAL_GRADUALLY_PREFERENCE_KEY) return;
      clearCardRevealProgress();
      setRevealGradually(event.newValue === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const manager = new AccountCredentials({
      read: (owner, provider) => readCredential(provider, owner),
      write: (owner, provider, entry) => saveCredential(provider, owner, entry),
      load: loadAccountKeys, save: saveAccountKey,
      status: (status, message) => { if (active) { setKeySyncStatus(status); setKeySyncError(message ?? ""); } },
      changed: (keys) => {
        if (!active) return;
        if (apiKeyRef.current !== keys.gemini) {
          connectionAbortController.current?.abort();
          generationAbortController.current?.abort();
          learningAbortController.current?.abort();
          questionAbortController.current?.abort();
          adaptationAbortController.current?.controller.abort();
          adaptationAbortController.current = null;
          glossaryAbortController.current?.controller.abort();
          glossaryAbortController.current = null;
          setGlossaryLoading(null);
          youtubeSearchAbortController.current?.abort();
          globalSearchAbortController.current?.abort();
          requestGeneration.current += 1;
          naturalSearchCache.current.clear(); youtubeSearchCache.current.clear(); learningResponseCache.current.clear();
          apiKeyRef.current = keys.gemini;
          setApiKey(keys.gemini);
          setGeminiStatus("not-configured");
          setModelChecks(ALLOWED_GEMINI_MODELS.map(model => ({ model, status: "unchecked" })));
          setModelChecking(false); setLoading(false); setLearnLoading(null); setQuestionLoading(null); setAdaptationLoading(null);
          restoredGeminiKey.current = userEditingKey.current ? "" : keys.gemini;
        }
        if (youtubeKeyRef.current !== keys.youtube) {
          youtubeAbortController.current?.abort();
          youtubeSearchAbortController.current?.abort();
          youtubeKeyRef.current = keys.youtube;
          setYoutubeKey(keys.youtube);
          setYoutubeStatus("not-configured"); setYoutubeError("");
        }
      }
    });
    credentialManager.current = manager;
    credentialOwner.current = null;
    void manager.switchAccount(null).then(() => { if (active) setKeysHydrated(true); });
    const refresh = () => { if (document.visibilityState !== "hidden") void manager.refresh({ automatic: true }); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; manager.dispose(); credentialManager.current = null;
      window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !keysHydrated) return;
    let active = true;
    const auth = cloudClient().auth;
    const loadAccount = async (session: { user: CloudAccount } | null) => {
      if (!active) return;
      const user = session?.user;
      const owner = user?.id ?? null;
      if (credentialOwner.current !== owner) {
        credentialOwner.current = owner;
        setAuthRestored(false);
        void credentialManager.current?.switchAccount(owner).then(() => { if (active && credentialOwner.current === owner) setAuthRestored(true); });
      } else {
        if (!owner) setAuthRestored(true);
        if (owner) void credentialManager.current?.refresh({ automatic: true });
      }
      if (!user) {
        cloudEpoch.current += 1;
        cloudAbortController.current?.abort();
        cloudSyncRef.current = null;
        cloudUserId.current = null;
        cloudLoadingUser.current = null;
        cloudLoaded.current = false;
        setAccount(null);
        setSyncStatus("signed-out");
        setSyncError("");
        return;
      }
      if (!active || cloudUserId.current === user.id && cloudSyncRef.current && cloudLoaded.current) return;
      if (cloudLoadingUser.current === user.id) return;
      cloudLoadingUser.current = user.id;
      cloudLoaded.current = false;
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
        const mergedRecords = mergeRecords(localRecords, remote.records).map((record) => ({
          ...record,
          state: normalizeSavedState(record.state as Partial<PersistedState>, false, initialTopicCatalog.current ?? undefined)
        }));
        const fallbackState: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics: createDefaultTopics(), settings: DEFAULT_SETTINGS, cards: [], learningProfile: {}, feedStarted: false, theme: theme };
        const records = mergedRecords.length ? mergedRecords as AppWorkspaceRecord[] : [makeLocalWorkspace(fallbackState)];
        const preferredId = localStore?.activeId && records.some((record) => record.id === localStore.activeId) ? localStore.activeId : records[0].id;
        const mergedStore: AppWorkspaceStore = { version: 1, ownerId: user.id, activeId: preferredId, records, theme: localStore?.theme ?? records[0].state.theme ?? theme, factMemory: mergeFactMemory(compatible ? (localStore?.factMemory ?? []) : [], remote.factMemory) };
        workspaceStoreRef.current = mergedStore;
        factMemoryRef.current = mergedStore.factMemory ?? [];
        factNoveltyIndexRef.current = new FactNoveltyIndex(factMemoryRef.current);
        const target = records.find((record) => record.id === preferredId) ?? records[0];
        resetCustomTopicReservations(target.id);
        workspaceIdRef.current = target.id;
        workspaceNameRef.current = target.name;
        setWorkspaceId(target.id);
        setWorkspaceName(target.name);
        setWorkspaceSummaries(records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
        const targetState = target.state;
        setTopics(targetState.topics);
        topicCatalogReset.current += 1;
        topicCatalogRevision.current += 1;
        setSettings(targetState.settings);
        const targetCards = targetState.cards;
        setCards(targetCards);
        setQuestionDrafts({});
        setLearningProfile(targetState.learningProfile);
        setFeedStarted(targetState.feedStarted);
        setTheme(mergedStore.theme ?? "light");
        persistedStateRef.current = targetState;
        await writeWorkspaceStore(mergedStore);
        if (!active || controller.signal.aborted || cloudEpoch.current !== epoch) return;
        setSyncStatus("synced");
        cloudLoaded.current = true;
        scheduleCloudSave();
      } catch (error) {
        if (!active || controller.signal.aborted || cloudEpoch.current !== epoch) return;
        setSyncStatus(navigator.onLine === false ? "offline" : "error");
        setSyncError(error instanceof Error ? error.message : "Cloud sync could not load your account.");
      } finally {
        if (cloudEpoch.current === epoch && cloudLoadingUser.current === user.id) cloudLoadingUser.current = null;
      }
    };
    let authRevision = 0;
    const { data: listener } = auth.onAuthStateChange((_event, session) => {
      const revision = ++authRevision;
      // Supabase holds its auth lock inside this callback. Defer API work.
      window.setTimeout(() => { if (active && revision === authRevision) void loadAccount(session); }, 0);
    });
    const revision = authRevision;
    void auth.getSession().then(({ data, error }) => {
      if (!active || revision !== authRevision) return;
      if (error) { setSyncStatus("error"); setSyncError("Your Google session could not be restored. Reconnect to retry."); return; }
      void loadAccount(data.session);
    });
    const retry = () => {
      const revision = authRevision;
      if (active && document.visibilityState !== "hidden") void auth.getSession().then(({ data, error }) => {
        if (active && !error && revision === authRevision) {
          void loadAccount(data.session);
          if (cloudLoaded.current && cloudSyncRef.current?.hasPendingUploads) scheduleCloudSave();
        }
      });
    };
    window.addEventListener("online", retry); window.addEventListener("focus", retry);
    return () => { active = false; listener.subscription.unsubscribe(); cloudAbortController.current?.abort(); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
  }, [hydrated, keysHydrated, resetCustomTopicReservations, scheduleCloudSave]);

  useEffect(() => {
    if (!hydrated) return;
    const state: PersistedState = { persistenceVersion: PERSISTENCE_VERSION, topicCatalogVersion: TOPIC_CATALOG_VERSION, topics, settings, cards, learningProfile, feedStarted, theme, youtubeActivity: youtubeActivityOf(youtubeWorkspaceRef.current) };
    persistedStateRef.current = state;
    const currentStore = workspaceStoreRef.current;
    if (currentStore) {
      const index = currentStore.records.findIndex((record) => record.id === workspaceIdRef.current);
      const now = new Date().toISOString();
      const record: AppWorkspaceRecord = { id: workspaceIdRef.current, name: workspaceNameRef.current, createdAt: index >= 0 ? currentStore.records[index].createdAt : now, updatedAt: now, state };
      if (index >= 0) currentStore.records[index] = record;
      else currentStore.records.push(record);
      currentStore.activeId = workspaceIdRef.current;
      currentStore.theme = theme;
      currentStore.factMemory = factMemoryRef.current;
      scheduleCloudSave();
      if (workspaceSaveTimer.current !== null) window.clearTimeout(workspaceSaveTimer.current);
      workspaceSaveTimer.current = window.setTimeout(() => {
        workspaceSaveTimer.current = null;
        void writeWorkspaceStore(currentStore, { recovery: false }).then(() => {
          setWorkspaceSummaries(currentStore.records.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt })));
        }).catch(() => setToast("Your workspace could not be saved. A local recovery copy was kept."));
      }, 300);
    }
  }, [cards, feedStarted, hydrated, learningProfile, scheduleCloudSave, settings, theme, topics]);

  useEffect(() => {
    if (!hydrated) return;
    const flushWorkspace = () => {
      youtubePlaybackFlushRef.current?.();
      const state = persistedStateRef.current;
      const store = workspaceStoreRef.current;
      if (!state || !store) return;
      const snapshot = { ...state, youtubeActivity: youtubeActivityOf(youtubeWorkspaceRef.current), savedAt: new Date().toISOString() };
      const record = store.records.find((item) => item.id === workspaceIdRef.current);
      if (record) {
        record.state = snapshot;
        record.updatedAt = snapshot.savedAt ?? record.updatedAt;
      }
      store.activeId = workspaceIdRef.current;
      store.theme = theme;
      scheduleCloudSave();
      const activityTimer = youtubeActivitySaveTimers.current.get(workspaceIdRef.current);
      if (activityTimer !== undefined) window.clearTimeout(activityTimer);
      youtubeActivitySaveTimers.current.delete(workspaceIdRef.current);
      void saveYouTubeWorkspace(youtubeWorkspaceRef.current, { activity: true, workspaceId: workspaceIdRef.current });
      writeWorkspaceState(snapshot);
      // writeWorkspaceStore writes localStorage before opening IndexedDB, so
      // the recovery copy survives a pagehide even when the transaction cannot
      // finish before the browser closes the document.
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
  }, [hydrated, scheduleCloudSave, theme]);

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

  const selectedCount = useMemo(() => selectedLeafCount(topics), [topics]);
  const catalogRevision = topicCatalogRevision.current;
  const getCatalogTopicList = useCallback(() => {
    if (catalogTopicListCache.current?.revision !== catalogRevision) catalogTopicListCache.current = { revision: catalogRevision, topics: flattenTopics(topics) };
    return catalogTopicListCache.current.topics;
  }, [catalogRevision, topics]);
  const getCatalogSuggestionIndex = useCallback(() => {
    if (catalogSuggestionIndexCache.current?.revision !== catalogRevision) {
      catalogSuggestionIndexCache.current = { revision: catalogRevision, index: createTopicSuggestionIndex(getCatalogTopicList()) };
    }
    return catalogSuggestionIndexCache.current.index;
  }, [catalogRevision, getCatalogTopicList]);
  const localTopicSuggestions = normalizeSearchText(topicSearchReply.query ?? "") === normalizeSearchText(query) && topicSearchReply.catalogRevision === catalogRevision
    ? topicSearchReply.suggestions ?? []
    : [];
  const catalogCustomTopics = useMemo(() => topicSearchRecords(topics.filter((topic) => topic.custom)), [catalogRevision]);
  const topicRebuildKey = `${TOPIC_CATALOG_VERSION}:${TOPIC_SEARCH_VERSION}:${workspaceId}:${topicCatalogReset.current}`;
  topicWorkerSnapshot.current = { revision: catalogRevision, rebuildKey: topicRebuildKey, records: catalogCustomTopics };
  const syncTopicSearchIndex = useCallback((force = false) => {
    const worker = topicSearchWorker.current;
    if (!worker) return;
    const snapshot = topicWorkerSnapshot.current, prior = topicWorkerIndexed.current;
    if (!force && prior?.revision === snapshot.revision && prior.rebuildKey === snapshot.rebuildKey) return;
    topicSearchSignature.current = "";
    setTopicWorkerReadyRevision(-1);
    if (force || !prior || prior.rebuildKey !== snapshot.rebuildKey) {
      worker.postMessage({ type: "initialize", customRecords: snapshot.records, catalogRevision: snapshot.revision });
    } else {
      const changes = diffTopicSearchRecords(prior.records, snapshot.records);
      worker.postMessage({ type: "update", baseRevision: prior.revision, catalogRevision: snapshot.revision, ...changes });
    }
    topicWorkerIndexed.current = { revision: snapshot.revision, rebuildKey: snapshot.rebuildKey, records: new Map(snapshot.records.map(topic => [topic.id, topic])) };
  }, []);
  const syncCardSearchIndex = useCallback((nextCards: FactCard[]) => {
    const worker = cardSearchWorker.current;
    if (!worker || !cardSearchWorkerReady.current) return;
    const indexed = cardSearchIndexedCards.current;
    const currentIds = new Set<string>();
    const upserts: Array<{ id: string; text: string }> = [];
    for (const card of nextCards) {
      currentIds.add(card.id);
      const text = cardSearchText(card);
      const prior = indexed.get(card.id);
      if (!prior || prior.card !== card && prior.text !== text) upserts.push({ id: card.id, text });
      indexed.set(card.id, { card, text });
    }
    const removeIds: string[] = [];
    for (const id of indexed.keys()) if (!currentIds.has(id)) { indexed.delete(id); removeIds.push(id); }
    if (!upserts.length && !removeIds.length) return;
    const revision = ++cardSearchRevision.current;
    worker.postMessage({ type: "update", revision, upserts, removeIds });
    setCardSearchIndexRevision(revision);
    cardSearchSignature.current = "";
  }, []);

  const syncYouTubeSearchIndex = useCallback((nextVideos: YouTubeVideo[], force = false) => {
    const policy = `${YOUTUBE_CATALOG_VERSION}:${VIDEO_SEMANTIC_VERSION}`;
    if (force || youtubeSearchWorkerPolicy.current !== policy) youtubeSearchWorkerNeedsRebuild.current = true;
    const worker = youtubeSearchWorker.current;
    if (!worker || !youtubeSearchWorkerReady.current) {
      youtubeSearchWorkerPendingVideos.current = nextVideos;
      return;
    }
    const indexed = youtubeSearchWorkerIndexedVideos.current;
    if (!indexed) return;
    const { upserts, removeIds, orderIds, changed } = diffVideoSearchMetadata(indexed, nextVideos);
    if (!changed && !youtubeSearchWorkerNeedsRebuild.current) return;
    youtubeSearchWorkerIndexedVideos.current = new Map(nextVideos.map(video => [video.id, video]));
    const baseRevision = youtubeSearchWorkerRevision.current;
    const revision = ++youtubeSearchWorkerRevision.current;
    if (youtubeSearchWorkerNeedsRebuild.current) {
      youtubeSearchWorkerNeedsRebuild.current = false;
      youtubeSearchWorkerPolicy.current = policy;
      youtubeSearchWorkerReady.current = false;
      for (const pending of youtubeSearchPending.current.values()) {
        pending.signal.removeEventListener("abort", pending.onAbort);
        pending.reject(new Error("Video catalog changed during search."));
      }
      youtubeSearchPending.current.clear();
      worker.postMessage({ type: "initialize", revision, videos: nextVideos });
    } else worker.postMessage({ type: "update", baseRevision, revision, upserts, removeIds, orderIds });
    setYoutubeSearchIndexRevision(revision);
  }, []);

  const requestYouTubeWorkerSearch = useCallback(async (request: YouTubeWorkerSearchRequest, signal: AbortSignal) => {
    const worker = youtubeSearchWorker.current;
    if (!worker) throw new Error("The local video search worker is unavailable.");
    if (!youtubeSearchWorkerReady.current) {
      await new Promise<void>((resolve, reject) => {
        const waiter = () => { signal.removeEventListener("abort", onAbort); resolve(); };
        const onAbort = () => {
          const index = youtubeSearchWorkerReadyWaiters.current.indexOf(waiter);
          if (index >= 0) youtubeSearchWorkerReadyWaiters.current.splice(index, 1);
          reject(new DOMException("Search canceled", "AbortError"));
        };
        if (signal.aborted) { onAbort(); return; }
        youtubeSearchWorkerReadyWaiters.current.push(waiter);
        signal.addEventListener("abort", onAbort, { once: true });
      });
    }
    if (signal.aborted) throw new DOMException("Search canceled", "AbortError");
    const currentWorker = youtubeSearchWorker.current;
    if (!currentWorker) throw new Error("The local video search worker is unavailable.");
    const requestId = ++youtubeSearchRequestId.current;
    return new Promise<YouTubeSearchWorkerReply>((resolve, reject) => {
      const onAbort = () => {
        youtubeSearchPending.current.delete(requestId);
        currentWorker.postMessage({ type: "cancel", requestId });
        reject(new DOMException("Search canceled", "AbortError"));
      };
      if (signal.aborted) { onAbort(); return; }
      youtubeSearchPending.current.set(requestId, { resolve, reject, signal, onAbort });
      signal.addEventListener("abort", onAbort, { once: true });
      currentWorker.postMessage({ type: "search", ...request, requestId, revision: youtubeSearchWorkerRevision.current });
    });
  }, []);

  useEffect(() => {
    if (!hydrated || !query.trim() || typeof Worker === "undefined" || cardSearchWorker.current) return;
    let worker: Worker;
    try { worker = new Worker(new URL("../workers/card-search.worker.ts", import.meta.url), { type: "module" }); }
    catch { setCardSearchWorkerFailed(true); return; }
    cardSearchWorker.current = worker;
    cardSearchSignature.current = "";
    const initialCards = cardsRef.current;
    cardSearchIndexedCards.current = new Map(initialCards.map((card) => [card.id, { card, text: cardSearchText(card) }]));
    worker.onmessage = (event: MessageEvent<CardSearchWorkerReply>) => {
      const reply = event.data;
      if (reply.type === "ready") {
        cardSearchWorkerReady.current = true;
        setCardSearchWorkerReadyState(true);
        syncCardSearchIndex(cardsRef.current);
      } else if (reply.requestId === cardSearchRequestId.current && reply.query.trim() === currentQueryRef.current.trim()) {
        setCardSearchReply(reply);
      }
    };
    worker.onerror = () => {
      worker.terminate();
      if (cardSearchWorker.current === worker) cardSearchWorker.current = null;
      cardSearchWorkerReady.current = false;
      setCardSearchWorkerReadyState(false);
      setCardSearchWorkerFailed(true);
      cardSearchSignature.current = "";
    };
    worker.postMessage({ type: "initialize", revision: cardSearchRevision.current, documents: initialCards.map((card) => ({ id: card.id, text: cardSearchText(card) })) });
  }, [hydrated, query, syncCardSearchIndex]);

  useEffect(() => {
    if (cardSearchWorkerReadyState) syncCardSearchIndex(cards);
  }, [cardSearchWorkerReadyState, cards, syncCardSearchIndex]);

  useEffect(() => {
    if (!hydrated || view !== "videos" || typeof Worker === "undefined" || youtubeSearchWorker.current) return;
    let worker: Worker;
    try { worker = new Worker(new URL("../workers/youtube-search.worker.ts", import.meta.url), { type: "module" }); }
    catch { setYoutubeSearchWorkerFailed(true); return; }
    youtubeSearchWorker.current = worker;
    youtubeSearchWorkerReady.current = false;
    const initialVideos = youtubeWorkspace.videos;
    youtubeSearchWorkerNeedsRebuild.current = false;
    youtubeSearchWorkerPolicy.current = `${YOUTUBE_CATALOG_VERSION}:${VIDEO_SEMANTIC_VERSION}`;
    youtubeSearchWorkerIndexedVideos.current = new Map(initialVideos.map((video) => [video.id, video]));
    worker.onmessage = (event: MessageEvent<YouTubeSearchWorkerReply>) => {
      const reply = event.data;
      if (reply.type === "rebuild") {
        if (reply.revision !== youtubeSearchWorkerRevision.current) return;
        youtubeSearchWorkerReady.current = true;
        syncYouTubeSearchIndex(youtubeWorkspaceRef.current.videos, true);
        return;
      }
      if (reply.type === "ready") {
        if (reply.revision !== youtubeSearchWorkerRevision.current) return;
        youtubeSearchWorkerReady.current = true;
        setYoutubeSearchWorkerReadyState(true);
        const pendingVideos = youtubeSearchWorkerPendingVideos.current;
        youtubeSearchWorkerPendingVideos.current = null;
        if (pendingVideos) syncYouTubeSearchIndex(pendingVideos);
        for (const waiter of youtubeSearchWorkerReadyWaiters.current.splice(0)) waiter();
        return;
      }
      const pending = youtubeSearchPending.current.get(reply.requestId);
      if (!pending) return;
      youtubeSearchPending.current.delete(reply.requestId);
      pending.signal.removeEventListener("abort", pending.onAbort);
      if (reply.type === "stale" || reply.type === "results" && reply.revision !== youtubeSearchWorkerRevision.current) pending.reject(new Error("Video catalog changed during search."));
      else pending.resolve(reply);
    };
    worker.onerror = () => {
      worker.terminate();
      if (youtubeSearchWorker.current === worker) youtubeSearchWorker.current = null;
      youtubeSearchWorkerReady.current = false;
      setYoutubeSearchWorkerReadyState(false);
      setYoutubeSearchWorkerFailed(true);
      for (const waiter of youtubeSearchWorkerReadyWaiters.current.splice(0)) waiter();
      for (const [requestId, pending] of youtubeSearchPending.current) {
        youtubeSearchPending.current.delete(requestId);
        pending.signal.removeEventListener("abort", pending.onAbort);
        pending.reject(new Error("Local video search stopped unexpectedly."));
      }
    };
    worker.postMessage({ type: "initialize", revision: youtubeSearchWorkerRevision.current, videos: initialVideos });
  }, [hydrated, view, syncYouTubeSearchIndex, youtubeWorkspace.videos]);

  useEffect(() => {
    if (youtubeSearchWorker.current) syncYouTubeSearchIndex(youtubeWorkspace.videos);
  }, [syncYouTubeSearchIndex, youtubeWorkspace.videos]);

  const topicTreeSearchIndex = useMemo<TopicSearchIndex | undefined>(() => {
    if (topicSearchReply.type !== "results" || normalizeSearchText(topicSearchReply.query ?? "") !== normalizeSearchText(query) || topicSearchReply.catalogRevision !== catalogRevision) {
      return query.trim() ? { query: query.trim(), catalogRevision, ready: false, visibleIds: new Set(), matchingDescendants: new Set(), directScores: new Map() } : undefined;
    }
    return {
      query: query.trim(),
      catalogRevision,
      ready: true,
      visibleIds: new Set(topicSearchReply.visibleIds ?? []),
      matchingDescendants: new Set(topicSearchReply.matchingDescendants ?? []),
      directScores: new Map(topicSearchReply.directScores ?? [])
    };
  }, [catalogRevision, query, topicSearchReply]);

  useEffect(() => {
    const text = query.trim();
    if (!hydrated || !text || topicSearchWorker.current) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (topicSearchWorker.current) return;
      const terms = normalizeSearchText(semanticSearch.query) === normalizeSearchText(text) ? semanticSearch.terms : [];
      void searchTopicsWithYieldingFallback(topics, text, normalizeSearchText(semanticSearch.query) === normalizeSearchText(text) ? semanticSearch.plan ?? terms : [], catalogRevision, () => active && topicCatalogRevision.current === catalogRevision && normalizeSearchText(currentQueryRef.current) === normalizeSearchText(text), topicRebuildKey).then((reply) => {
        if (reply && active && topicCatalogRevision.current === catalogRevision && normalizeSearchText(currentQueryRef.current) === normalizeSearchText(text)) setTopicSearchReply(reply);
      });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [catalogRevision, hydrated, query, semanticSearch, topicWorkerReadyRevision, topics, topicRebuildKey]);

  useEffect(() => {
    if (!hydrated || typeof Worker === "undefined") return;
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/topic-search.worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }
    topicSearchWorker.current = worker;
    topicWorkerIndexed.current = null;
    topicSearchSignature.current = "";
    worker.onmessage = (event: MessageEvent<TopicSearchWorkerReply>) => {
      const reply = event.data;
      if (reply.catalogRevision !== topicCatalogRevision.current) return;
      if (reply.type === "rebuild") syncTopicSearchIndex(true);
      else if (reply.type === "ready") setTopicWorkerReadyRevision(reply.catalogRevision);
      else if (reply.requestId === topicSearchRequestId.current && normalizeSearchText(reply.query ?? "") === normalizeSearchText(currentQueryRef.current)) setTopicSearchReply({ ...reply, query: currentQueryRef.current.trim() });
    };
    worker.onerror = () => {
      worker.terminate();
      if (topicSearchWorker.current === worker) topicSearchWorker.current = null;
      topicWorkerIndexed.current = null;
      // A distinct state value also starts the yielding fallback if initialization failed.
      setTopicWorkerReadyRevision(value => value === -1 ? -2 : -1);
    };
    syncTopicSearchIndex();
    return () => {
      worker.terminate();
      if (topicSearchWorker.current === worker) topicSearchWorker.current = null;
      topicWorkerIndexed.current = null;
    };
  }, [hydrated, syncTopicSearchIndex]);

  useEffect(() => {
    syncTopicSearchIndex();
  }, [catalogRevision, topicRebuildKey, syncTopicSearchIndex]);

  useEffect(() => {
    const worker = topicSearchWorker.current;
    const text = query.trim();
    if (!worker || topicWorkerReadyRevision !== catalogRevision) return;
    if (!text) {
      topicSearchSignature.current = "";
      worker.postMessage({ type: "cancel", requestId: ++topicSearchRequestId.current });
      return;
    }
    const semanticTerms = normalizeSearchText(semanticSearch.query) === normalizeSearchText(text) ? semanticSearch.terms : [];
    const plan = normalizeSearchText(semanticSearch.query) === normalizeSearchText(text) ? semanticSearch.plan : undefined;
    const signature = JSON.stringify([catalogRevision, normalizeSearchText(text), plan ?? semanticTerms.map(normalizeSearchText)]);
    if (topicSearchSignature.current === signature) return;
    topicSearchSignature.current = signature;
    const requestId = ++topicSearchRequestId.current;
    worker.postMessage({ type: "search", requestId, query: text, semanticTerms, plan, catalogRevision });
  }, [catalogRevision, query, semanticSearch, topicWorkerReadyRevision]);

  const topicEnrichmentKey = JSON.stringify([catalogRevision, normalizeSearchText(query), apiKey.trim()]);
  const topicCoverage = topicSearchReply.catalogRevision === catalogRevision && normalizeSearchText(topicSearchReply.query ?? "") === normalizeSearchText(query) ? topicSearchReply.completeCoverage : undefined;
  useEffect(() => {
    globalSearchAbortController.current?.abort();
    const text = query.trim();
    if (!text || !apiKey.trim() || geminiStatus !== "connected" || topicCoverage === undefined) return;
    const cacheKey = requestCacheKey(requestCacheScope(sessionIdRef.current, apiKey.trim()), "topic-search", TOPIC_SEARCH_VERSION, catalogRevision, normalizeSearchText(text));
    const cached = naturalSearchCache.current.get(cacheKey);
    if (cached) {
      setSemanticSearch(current => current.plan === cached && normalizeSearchText(current.query) === normalizeSearchText(text) ? current : { query: text, terms: [], plan: cached });
      return;
    }
    if (topicEnrichmentAttempt.current === topicEnrichmentKey || !shouldEnrichTopics(text, topicCoverage)) return;
    const controller = new AbortController();
    globalSearchAbortController.current = controller;
    let settled = false;
    const timer = window.setTimeout(() => {
      topicEnrichmentAttempt.current = topicEnrichmentKey;
      void interpretNaturalSearch({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: text, catalogVersion: `${TOPIC_CATALOG_VERSION}:${catalogRevision}:${TOPIC_SEARCH_VERSION}`, signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) {
          naturalSearchCache.current.set(cacheKey, result.plan);
          recordGeminiOutcomes(result.modelOutcomes);
          setSemanticSearch({ query: text, terms: [], plan: result.plan });
        }
      }).catch(error => { if (!controller.signal.aborted) recordGeminiFailure(error); }).finally(() => { settled = true; });
    }, 1500);
    return () => { window.clearTimeout(timer); controller.abort(); if (!settled && topicEnrichmentAttempt.current === topicEnrichmentKey) topicEnrichmentAttempt.current = ""; };
  }, [topicEnrichmentKey, topicCoverage, geminiStatus, recordGeminiFailure, recordGeminiOutcomes]);

  const updateSettings = useCallback((next: Partial<FeedSettings>) => {
    const nextSentenceLength = next.sentenceLength === undefined ? settings.sentenceLength : normalizeSentenceLength(next.sentenceLength);
    if (next.displayMode) {
      displayModeRef.current = next.displayMode;
      if (next.displayMode === "text") {
        imageHydrationEpoch.current += 1;
        imageHydrationQueue.current = [];
        imageHydrationControllers.current.forEach(controller => controller.abort());
        imageHydrationControllers.current.clear();
      } else if (next.displayMode === "picture-text") {
        enqueueImageHydration(cards, requestGeneration.current, workspaceIdRef.current);
      }
    }
    setSettings((current) => ({ ...current, ...next, sentenceLength: nextSentenceLength }));
    if (next.obscurity !== undefined) {
      const difficulty = normalizeDifficulty(next.obscurity);
      setLearningProfile((current) => resetTopicLearningProfiles(current, difficulty));
    }
  }, [cards, enqueueImageHydration, settings.sentenceLength]);

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
    void cloudClient().auth.signOut({ scope: "local" }).then(({ error }) => {
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

  useEffect(() => {
    const currentTopics = flattenTopics(topics);
    const currentIds = new Set(currentTopics.map((topic) => topic.id));
    const currentLabels = new Set(currentTopics.map((topic) => normalizeCustomTopicLabel(topic.label)));
    for (const id of pendingCustomTopicIds.current) if (currentIds.has(id)) pendingCustomTopicIds.current.delete(id);
    for (const [label, id] of pendingCustomTopicLabels.current) {
      if (currentLabels.has(label)) {
        pendingCustomTopicIds.current.delete(id);
        pendingCustomTopicLabels.current.delete(label);
      } else if (!pendingCustomTopicIds.current.has(id)) pendingCustomTopicLabels.current.delete(label);
    }
  }, [topics]);

  const queueCustomTopic = useCallback((rawLabel: string): boolean => {
    const label = rawLabel.trim();
    if (!label) return false;
    const reservationWorkspaceId = workspaceIdRef.current;
    if (pendingCustomTopicWorkspace.current !== reservationWorkspaceId) {
      pendingCustomTopicIds.current.clear();
      pendingCustomTopicLabels.current.clear();
      pendingCustomTopicWorkspace.current = reservationWorkspaceId;
    }
    const normalizedLabel = normalizeCustomTopicLabel(label);
    const existingTopics = flattenTopics(topics);
    if (existingTopics.some((topic) => normalizeCustomTopicLabel(topic.label) === normalizedLabel)
      || pendingCustomTopicLabels.current.has(normalizedLabel)) return false;

    const id = createCustomTopicId(label, [
      ...existingTopics.map((topic) => topic.id),
      ...pendingCustomTopicIds.current,
    ]);
    pendingCustomTopicIds.current.add(id);
    pendingCustomTopicLabels.current.set(normalizedLabel, id);
    setTopics((current) => {
      if (workspaceIdRef.current !== reservationWorkspaceId) return current;
      const currentTopics = flattenTopics(current);
      if (currentTopics.some((topic) => normalizeCustomTopicLabel(topic.label) === normalizedLabel)) return current;
      const currentIds = new Set(currentTopics.map((topic) => topic.id));
      const safeId = currentIds.has(id)
        ? createCustomTopicId(label, [...currentIds, ...pendingCustomTopicIds.current].filter((candidate) => candidate !== id))
        : id;
      return [...current, { id: safeId, label, selected: true, expanded: false, weight: 10, custom: true }];
    });
    topicCatalogRevision.current += 1;
    setFeedHasMore(true);
    return true;
  }, [topics]);

  const addCustomTopic = useCallback(() => {
    const label = customTopic.trim();
    if (!label) return;
    if (!queueCustomTopic(label)) {
      setToast("That topic is already in your mix.");
      return;
    }
    setCustomTopic("");
    setToast(`${label} added to your topic tree.`);
  }, [customTopic, queueCustomTopic]);

  const removeCustomTopic = useCallback((id: string) => {
    const topic = flattenTopics(topics).find((candidate) => candidate.id === id);
    if (!topic?.custom) return;
    setTopics((current) => removeTopicTree(current, id));
    topicCatalogRevision.current += 1;
    setFeedHasMore(true);
    setToast(`${topic.label} removed from your topic tree.`);
  }, [topics]);

  const startFeed = useCallback(async (rabbitHoleOverride?: string | null, requestedCount = pendingSlots, detourRequest?: { id: string; topicPath: string[]; slotIndexes: number[] }) => {
    if (generationAbortController.current) return;
    if (!detourRequest && !selectedCount) {
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
    const imageWorkspaceId = workspaceIdRef.current;
    generationAbortController.current = controller;
    activeGenerationDetourId.current = detourRequest?.id ?? null;
    if (detourRequest && topicDetourRef.current?.id === detourRequest.id) updateTopicDetour({ ...topicDetourRef.current, phase: "generating" });
    setView("feed");
    setFeedStarted(true);
    setLoading(true);
    setToast("");
    setGenerationError("");
    const activeRabbitHole = detourRequest ? null : rabbitHoleOverride !== undefined ? rabbitHoleOverride : rabbitHole;
    const count = Math.max(1, Math.min(10, Math.round(requestedCount || 10)));
    const detourSlots = detourRequest?.slotIndexes ?? [];
    const assignedTopics = detourRequest
      ? detourSlots.map(() => ({ path: [...detourRequest.topicPath], weight: 10, difficulty: getTopicLearningProfile(learningProfile, detourRequest.topicPath, normalizeDifficulty(settings.obscurity)).targetDifficulty }))
      : selectWeightedTopicPaths(topics, count);
    const receivedIds = new Set<string>();
    const receivedCards = new Map<string, FactCard>();
    const acceptGeneratedCard = (card: FactCard, eventSlot?: number) => {
      if (controller.signal.aborted || requestGeneration.current !== requestId) return false;
      let detourAcceptance: { id: string; slot: number } | undefined;
      if (detourRequest) {
        const activeDetour = topicDetourRef.current;
        if (!activeDetour || activeDetour.id !== detourRequest.id) return false;
        const fallbackSlot = Number.isInteger(eventSlot) ? undefined : detourSlots.find(slot => activeDetour.slotCardIds[slot] == null);
        const slot = Number.isInteger(eventSlot) ? detourSlots[eventSlot!] : fallbackSlot;
        if (slot === undefined || !detourSlots.includes(slot) || activeDetour.slotCardIds[slot] != null) return false;
        detourAcceptance = { id: detourRequest.id, slot };
      }
      if (!acceptFact(card, detourAcceptance)) return false;
      receivedIds.add(card.id);
      receivedCards.set(card.id, card);
      return true;
    };
    let finalPayload: { cards?: Partial<FactCard>[]; partial?: boolean; retryGuidance?: string } | undefined;
    let streamError = "";
    try {
      if (isGitHubPagesRuntime()) {
        const result = await generateGeminiFacts({
          apiKey: apiKey.trim(),
          sessionId: sessionIdRef.current,
          topicPaths: assignedTopics,
          requestedCount: count,
          settings,
          learningProfile,
          rabbitHole: activeRabbitHole,
          avoid: factNoveltySignatures(factMemoryRef.current),
          signal: controller.signal,
          onProgress: (event) => {
            if (controller.signal.aborted || requestGeneration.current !== requestId) return;
            if (event.type === "model") {
              setModelChecks((current) => mergeGeminiModelOutcome(current, event.outcome));
              if (event.outcome.status === "success") setGeminiStatus("connected");
              return;
            }
            if (event.type === "status") {
              setGeminiStatus(event.status);
              return;
            }
            if (event.type !== "card") return;
            const card = normalizeFact(event.card, receivedIds.size);
            acceptGeneratedCard(card, event.slot);
          }
        });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        result.cards.forEach((card, index) => { const normalized = normalizeFact(card, index); if (!receivedIds.has(normalized.id)) acceptGeneratedCard(normalized, index); });
        if (detourRequest) {
          const missing = topicDetourRef.current?.id === detourRequest.id ? missingTopicDetourSlots(topicDetourRef.current) : [];
          setFeedHasMore(missing.length === 0);
          setPendingSlots(missing.length || DEFAULT_CARD_GENERATION_COUNT);
          setGenerationError(missing.length ? result.retryGuidance ?? "Some topic cards could not be verified. Retry to fill the remaining facts." : "");
          return;
        }
        if (!receivedIds.size) {
          setFeedHasMore(false);
          setPendingSlots(count);
          setGenerationError("Gemini returned no new complete cards. Retry when you are ready.");
          setToast("No new complete facts arrived. Retry when you are ready.");
        } else if (result.partial || receivedIds.size < count) {
          setFeedHasMore(false);
          setPendingSlots(Math.max(1, count - receivedIds.size));
          setGenerationError(result.retryGuidance ?? "Some fact slots failed. Retry to fill the remaining cards.");
          setToast(receivedIds.size + " facts arrived. Retry to fill the remaining slots.");
        } else {
          setFeedHasMore(true);
          setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
          setGenerationError("");
        }
        return;
      }
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ topics: assignedTopics, requestedCount: count, settings, learningProfile, rabbitHole: activeRabbitHole, avoid: factNoveltySignatures(factMemoryRef.current) }),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Gemini could not generate this batch. Check the key in Settings and try again.");
      }
      await readNdjson(response, (message) => {
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        if (message.type === "progress") {
          const event = message.event as { type?: string; slot?: number; card?: Partial<FactCard>; outcome?: GeminiModelOutcome; status?: GeminiStatus };
          if (event.type === "model" && event.outcome) {
            setModelChecks((current) => mergeGeminiModelOutcome(current, event.outcome!));
            if (event.outcome.status === "success") setGeminiStatus("connected");
          }
          if (event.type === "status" && event.status) setGeminiStatus(event.status);
          if (event.type === "card" && event.card?.id && event.card.title && event.card.body && event.card.hook && event.card.topicPath?.length && event.card.sources?.length) {
            const card = normalizeFact(event.card, receivedIds.size);
            acceptGeneratedCard(card, event.slot);
          }
        } else if (message.type === "complete") {
          finalPayload = message as typeof finalPayload;
          const modelOutcomes = (message.modelOutcomes as GeminiModelOutcome[] | undefined) ?? [];
          if (modelOutcomes.length) {
            setModelChecks((current) => modelOutcomes.reduce(mergeGeminiModelOutcome, current));
            if (modelOutcomes.some((outcome) => outcome.status === "success")) setGeminiStatus("connected");
          }
        } else if (message.type === "error") {
          streamError = String(message.error ?? "Gemini could not complete this batch.");
        }
      });
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      if (streamError) throw new Error(streamError);
      const generated = (finalPayload?.cards ?? []).filter((card) => Boolean(card.id && card.title?.trim() && card.body?.trim() && card.hook?.trim() && card.topicPath?.length && card.sources?.length)).map((card, index) => normalizeFact(card, index));
      generated.forEach((card, index) => { if (!receivedIds.has(card.id)) acceptGeneratedCard(card, index); });
      if (detourRequest) {
        const missing = topicDetourRef.current?.id === detourRequest.id ? missingTopicDetourSlots(topicDetourRef.current) : [];
        setFeedHasMore(missing.length === 0);
        setPendingSlots(missing.length || DEFAULT_CARD_GENERATION_COUNT);
        setGenerationError(missing.length ? finalPayload?.retryGuidance ?? "Some topic cards could not be verified. Retry to fill the remaining facts." : "");
        return;
      }
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
        setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
        setGenerationError("");
      }
    } catch (error) {
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      setFeedHasMore(false);
      setPendingSlots(detourRequest && topicDetourRef.current?.id === detourRequest.id ? Math.max(1, missingTopicDetourSlots(topicDetourRef.current).length) : Math.max(1, count - receivedIds.size));
      const message = error instanceof Error ? error.message : "Gemini could not generate this batch. Check the key in Settings and try again.";
      setGenerationError(message);
      setToast(message);
    } finally {
      if (!controller.signal.aborted && requestGeneration.current === requestId && displayModeRef.current === "picture-text") enqueueImageHydration(Array.from(receivedCards.values()), requestId, imageWorkspaceId);
      if (generationAbortController.current === controller) {
        generationAbortController.current = null;
        activeGenerationDetourId.current = null;
        setLoading(false);
        const queued = topicDetourRef.current;
        if (!controller.signal.aborted && !detourRequest && queued?.phase === "queued" && queued.workspaceId === workspaceIdRef.current) {
          const slots = missingTopicDetourSlots(queued);
          const request = { id: queued.id, topicPath: [...queued.topicPath], slotIndexes: slots };
          updateTopicDetour({ ...queued, phase: "generating" });
          queueMicrotask(() => {
            if (topicDetourRef.current?.id === request.id && !generationAbortController.current) void startFeedRef.current?.(null, request.slotIndexes.length, request);
          });
        }
      }
    }
  }, [apiKey, enqueueImageHydration, geminiStatus, learningProfile, pendingSlots, rabbitHole, selectedCount, settings, topics, updateTopicDetour]);
  startFeedRef.current = startFeed;

  const startTopicDetour = useCallback((sourceCardId: string) => {
    const source = cardsRef.current.find(card => card.id === sourceCardId);
    if (!source?.topicPath.length) return;
    if (!apiKey.trim() || geminiStatus !== "connected") {
      setToast("Connect Gemini in Settings before creating three topic cards.");
      setView("settings");
      return;
    }
    const next = createTopicDetour(workspaceIdRef.current, source.id, source.topicPath);
    if (generationAbortController.current && activeGenerationDetourId.current) {
      requestGeneration.current += 1;
      generationAbortController.current.abort();
      generationAbortController.current = null;
      activeGenerationDetourId.current = null;
      setLoading(false);
    }
    updateTopicDetour(next);
    setRabbitHole(null);
    setView("feed");
    if (generationAbortController.current) return;
    const request = { id: next.id, topicPath: [...next.topicPath], slotIndexes: [0, 1, 2] };
    updateTopicDetour({ ...next, phase: "generating" });
    void startFeedRef.current?.(null, 3, request);
  }, [apiKey, geminiStatus, updateTopicDetour]);

  const endTopicDetour = useCallback(() => {
    const current = topicDetourRef.current;
    if (!current) return;
    if (generationAbortController.current && activeGenerationDetourId.current === current.id) {
      requestGeneration.current += 1;
      generationAbortController.current.abort();
      generationAbortController.current = null;
      activeGenerationDetourId.current = null;
      setLoading(false);
    }
    updateTopicDetour(null);
    setFeedHasMore(true);
    setGenerationError("");
  }, [updateTopicDetour]);

  const handleTopicDetourProgress = useCallback((cardId: string, progress: TopicDetourProgress) => {
    const current = topicDetourRef.current;
    if (!current || current.workspaceId !== workspaceIdRef.current) return;
    const result = markTopicDetourProgress(current, cardId, progress);
    if (result.completed) {
      const notice = `${current.topicPath.at(-1) ?? "Topic"} · 3 of 3`;
      if (topicDetourNoticeTimer.current !== null) window.clearTimeout(topicDetourNoticeTimer.current);
      setTopicDetourStatusNotice(notice);
      topicDetourNoticeTimer.current = window.setTimeout(() => {
        topicDetourNoticeTimer.current = null;
        setTopicDetourStatusNotice(null);
      }, 1400);
      updateTopicDetour(null);
      setFeedHasMore(true);
      return;
    }
    if (result.detour !== current) updateTopicDetour(result.detour);
  }, [updateTopicDetour]);

  const retryGeneration = useCallback(() => {
    const current = topicDetourRef.current;
    if (!current) { void startFeed(null, pendingSlots); return; }
    const slotIndexes = missingTopicDetourSlots(current);
    if (!slotIndexes.length) return;
    const request = { id: current.id, topicPath: [...current.topicPath], slotIndexes };
    updateTopicDetour({ ...current, phase: "generating" });
    void startFeedRef.current?.(null, slotIndexes.length, request);
  }, [pendingSlots, startFeed, updateTopicDetour]);

  const loadMoreGeneration = useCallback(() => {
    const current = topicDetourRef.current;
    if (current) {
      const slotIndexes = missingTopicDetourSlots(current);
      if (!slotIndexes.length) return;
      const request = { id: current.id, topicPath: [...current.topicPath], slotIndexes };
      updateTopicDetour({ ...current, phase: "generating" });
      void startFeedRef.current?.(null, slotIndexes.length, request);
      return;
    }
    void startFeed(null, DEFAULT_CARD_GENERATION_COUNT);
  }, [startFeed, updateTopicDetour]);

  const resetFeed = useCallback(() => {
    clearTopicDetourStatusNotice();
    archiveFacts(cards);
    cancelGeneration();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    adaptationAbortController.current?.controller.abort();
    adaptationAbortController.current = null;
    glossaryAbortController.current?.controller.abort();
    glossaryAbortController.current = null;
    setGlossaryLoading(null);
    requestGeneration.current += 1;
    const blankTopics = clearTopicSelections(topics);
    setFeedStarted(false);
    setFeedHasMore(true);
    setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
    setCards([]);
    setQuestionDrafts({});
    setLoading(false);
    setRabbitHole(null);
    updateTopicDetour(null);
    setLearnLoading(null);
    setQuestionLoading(null);
    setAdaptationLoading(null);
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
  }, [cancelGeneration, clearTopicDetourStatusNotice, hydrated, learningProfile, settings, theme, topics, updateTopicDetour]);

  const resetTopics = useCallback(() => {
    const blankTopics = clearTopicSelections(topics);
    setTopics(blankTopics);
    setFeedHasMore(true);
    setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
    setRabbitHole(null);
    setGenerationError("");
    setToast("Topics reset. Choose a topic to start again.");
  }, [topics]);

  const learnMore = useCallback(async (id: string) => {
    const card = cards.find((item) => item.id === id);
    if (!card || card.learnMore || learnLoading) return;
    const cacheKey = learningResponseCacheKey(sessionIdRef.current, apiKey.trim(), "learn", card);
    const cached = learningResponseCache.current.get(cacheKey);
    if (cached) {
      setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: cached.answer, learnMoreSources: cached.citations } : item));
      return;
    }
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
        recordGeminiOutcomes(payload.modelOutcomes);
        learningResponseCache.current.set(cacheKey, { answer: payload.answer, citations: payload.citations });
        setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: payload.answer, learnMoreSources: payload.citations } : item));
        return;
      }
      const response = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
        body: JSON.stringify({ action: "learn", card }),
        signal: controller.signal
      });
      const payload = await response.json() as { answer?: string; citations?: WikipediaSource[]; modelOutcomes?: GeminiModelOutcome[]; modelStatus?: GeminiStatus; error?: string };
      if (!response.ok) {
        recordGeminiOutcomes(payload.modelOutcomes ?? [], payload.modelStatus);
        throw new Error(payload.error ?? "Gemini could not expand this fact.");
      }
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      recordGeminiOutcomes(payload.modelOutcomes ?? []);
      learningResponseCache.current.set(cacheKey, { answer: payload.answer ?? "", citations: payload.citations ?? [] });
      setCards((current) => current.map((item) => item.id === id ? { ...item, learnMore: payload.answer, learnMoreSources: payload.citations } : item));
    } catch (error) {
      recordGeminiFailure(error);
      if (!controller.signal.aborted && requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [`${id}:learn`]: error instanceof Error ? error.message : "Gemini could not expand this fact." }));
    } finally {
      if (learningAbortController.current === controller) {
        learningAbortController.current = null;
        if (requestGeneration.current === requestId) setLearnLoading(null);
      }
    }
  }, [apiKey, cards, learnLoading, recordGeminiFailure, recordGeminiOutcomes]);

  const askQuestion = useCallback(async (id: string, question: string, detailed: boolean) => {
    const card = cards.find((item) => item.id === id);
    if (!card || questionLoading) return;
    const history: LearningMessage[] = card.questionHistory ?? [];
    const cacheKey = learningResponseCacheKey(sessionIdRef.current, apiKey.trim(), "question", card, question, detailed, history);
    const cached = learningResponseCache.current.get(cacheKey);
    if (cached) {
      const nextHistory: LearningMessage[] = [...history, { role: "user", content: question }, { role: "assistant", content: cached.answer }];
      setCards((current) => current.map((item) => item.id === id ? { ...item, question, answer: cached.answer, answerDetailed: detailed, answerSources: cached.citations, questionHistory: nextHistory } : item));
      return;
    }
    const requestId = requestGeneration.current;
    const controller = new AbortController();
    questionAbortController.current?.abort();
    questionAbortController.current = controller;
    setQuestionLoading(id);
    setLearningErrors((current) => ({ ...current, [id]: undefined }));
    try {
      if (isGitHubPagesRuntime()) {
        const payload = await generateLearningResponse({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, action: "question", card, question, detailed, history, signal: controller.signal });
        if (controller.signal.aborted || requestGeneration.current !== requestId) return;
        recordGeminiOutcomes(payload.modelOutcomes);
        learningResponseCache.current.set(cacheKey, { answer: payload.answer, citations: payload.citations });
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
      const payload = await response.json() as { answer?: string; citations?: FactCard["sources"]; modelOutcomes?: GeminiModelOutcome[]; modelStatus?: GeminiStatus; error?: string };
      if (!response.ok) {
        recordGeminiOutcomes(payload.modelOutcomes ?? [], payload.modelStatus);
        throw new Error(payload.error ?? "Gemini could not answer this question.");
      }
      if (controller.signal.aborted || requestGeneration.current !== requestId) return;
      recordGeminiOutcomes(payload.modelOutcomes ?? []);
      learningResponseCache.current.set(cacheKey, { answer: payload.answer ?? "", citations: payload.citations ?? [] });
      const nextHistory: LearningMessage[] = [...history, { role: "user", content: question }, { role: "assistant", content: payload.answer ?? "" }];
      setCards((current) => current.map((item) => item.id === id ? { ...item, question, answer: payload.answer, answerDetailed: detailed, answerSources: payload.citations, questionHistory: nextHistory } : item));
    } catch (error) {
      recordGeminiFailure(error);
      if (!controller.signal.aborted && requestGeneration.current === requestId) setLearningErrors((current) => ({ ...current, [id]: error instanceof Error ? error.message : "Gemini could not answer this question." }));
    } finally {
      if (questionAbortController.current === controller) {
        questionAbortController.current = null;
        if (requestGeneration.current === requestId) setQuestionLoading(null);
      }
    }
  }, [apiKey, cards, questionLoading, recordGeminiFailure, recordGeminiOutcomes]);

  const adaptCardExplanation = useCallback(async (id: string, mode?: "simpler" | "deeper") => {
    const active = adaptationAbortController.current;
    if (!mode) {
      if (active?.key.startsWith(`${id}:`)) {
        active.controller.abort();
        adaptationAbortController.current = null;
        setAdaptationLoading(null);
      }
      return;
    }
    const card = cards.find(item => item.id === id);
    if (!card) return;
    const fingerprint = cardExplanationFingerprint(card);
    const key = `${id}:${mode}:${fingerprint}`;
    if (active?.key === key) return;
    if (active) {
      active.controller.abort();
      adaptationAbortController.current = null;
      setAdaptationLoading(null);
    }
    if (card.explanations?.[mode]?.fingerprint === fingerprint || !apiKey.trim()) return;
    const controller = new AbortController();
    adaptationAbortController.current = { key, controller };
    const requestId = requestGeneration.current;
    const requestWorkspaceId = workspaceIdRef.current;
    const errorKey = `${id}:adapt:${mode}`;
    setAdaptationLoading(`${id}:${mode}`);
    setLearningErrors(current => ({ ...current, [errorKey]: undefined }));
    try {
      let payload: { answer?: string; citations?: WikipediaSource[]; modelOutcomes?: GeminiModelOutcome[]; modelStatus?: GeminiStatus; error?: string };
      if (isGitHubPagesRuntime()) {
        payload = await generateLearningResponse({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, action: "adapt", mode, card, signal: controller.signal });
      } else {
        const response = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
          body: JSON.stringify({ action: "adapt", mode, card }),
          signal: controller.signal
        });
        payload = await response.json();
        if (!response.ok) {
          recordGeminiOutcomes(payload.modelOutcomes ?? [], payload.modelStatus);
          throw new Error(payload.error ?? "Gemini could not adapt this explanation.");
        }
      }
      if (controller.signal.aborted || requestGeneration.current !== requestId || workspaceIdRef.current !== requestWorkspaceId || getCardExplanationSelection(requestWorkspaceId, id) !== mode || adaptationAbortController.current?.controller !== controller) return;
      if (!payload.answer?.trim() || !payload.citations?.length) throw new Error("Gemini could not support this alternate explanation with the card’s sources.");
      recordGeminiOutcomes(payload.modelOutcomes ?? []);
      const explanation = { text: payload.answer.trim(), sources: payload.citations, fingerprint };
      setCards(current => current.map(item => item.id === id ? { ...item, explanations: { ...item.explanations, [mode]: explanation } } : item));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      recordGeminiFailure(error);
      if (!controller.signal.aborted && requestGeneration.current === requestId) setLearningErrors(current => ({ ...current, [errorKey]: error instanceof Error ? error.message : "Gemini could not adapt this explanation." }));
    } finally {
      if (adaptationAbortController.current?.controller === controller) {
        adaptationAbortController.current = null;
        if (requestGeneration.current === requestId) setAdaptationLoading(null);
      }
    }
  }, [apiKey, cards, recordGeminiFailure, recordGeminiOutcomes]);

  const cancelCardGlossary = useCallback((id?: string) => {
    const active = glossaryAbortController.current;
    if (!active || id && !active.key.startsWith(`${workspaceIdRef.current}:${id}:`)) return;
    active.controller.abort();
    glossaryAbortController.current = null;
    setGlossaryLoading(null);
  }, []);

  const explainCardTerms = useCallback(async (id: string) => {
    const card = cards.find(item => item.id === id);
    if (!card) return;
    const fingerprint = cardGlossaryFingerprint(card);
    if (normalizeCardGlossary(card)) return;
    if (!apiKey.trim()) return;
    const workspaceAtStart = workspaceIdRef.current;
    const key = `${workspaceAtStart}:${id}:${fingerprint}`;
    if (glossaryAbortController.current?.key === key) return;
    cancelCardGlossary();
    const controller = new AbortController();
    glossaryAbortController.current = { key, controller };
    const requestId = requestGeneration.current;
    const errorKey = `${id}:glossary`;
    setGlossaryLoading(id);
    setLearningErrors(current => ({ ...current, [errorKey]: undefined }));
    try {
      let payload: { glossary?: SavedCardGlossary; modelOutcomes?: GeminiModelOutcome[]; modelStatus?: GeminiStatus; error?: string };
      if (isGitHubPagesRuntime()) {
        payload = await generateLearningResponse({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, action: "glossary", card, signal: controller.signal });
      } else {
        const response = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gemini-api-key": apiKey.trim(), "x-learned-media-session": sessionIdRef.current },
          body: JSON.stringify({ action: "glossary", card }),
          signal: controller.signal
        });
        payload = await response.json();
        if (!response.ok) {
          recordGeminiOutcomes(payload.modelOutcomes ?? [], payload.modelStatus);
          throw new Error(payload.error ?? "Gemini could not explain the terms in this fact.");
        }
      }
      if (controller.signal.aborted || requestGeneration.current !== requestId || workspaceIdRef.current !== workspaceAtStart || glossaryAbortController.current?.controller !== controller) return;
      const glossary = payload.glossary && normalizeCardGlossary({ ...card, glossary: payload.glossary });
      if (!glossary) throw new Error("The glossary could not be checked against this fact and its sources.");
      recordGeminiOutcomes(payload.modelOutcomes ?? []);
      setCards(current => current.map(item => item.id === id ? { ...item, glossary } : item));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      recordGeminiFailure(error);
      if (!controller.signal.aborted && requestGeneration.current === requestId && workspaceIdRef.current === workspaceAtStart) setLearningErrors(current => ({ ...current, [errorKey]: error instanceof Error ? error.message : "Gemini could not explain the terms in this fact." }));
    } finally {
      if (glossaryAbortController.current?.controller === controller) {
        glossaryAbortController.current = null;
        if (requestGeneration.current === requestId) setGlossaryLoading(null);
      }
    }
  }, [apiKey, cancelCardGlossary, cards, recordGeminiFailure, recordGeminiOutcomes]);

  const saveCardLocations = useCallback((id: string, locations: SavedCardLocations) => {
    setCards(current => current.map(item => item.id === id && cardLocationsFingerprint(item) === locations.fingerprint ? { ...item, locations } : item));
  }, []);

  const updateQuestionDraft = useCallback((id: string, text: string) => {
    setQuestionDrafts((current) => current[id]?.text === text ? current : { ...current, [id]: { ...current[id], text } });
  }, []);

  const updateQuestionDetailPreference = useCallback((id: string, detailed: boolean) => {
    setQuestionDrafts((current) => current[id]?.detailed === detailed ? current : { ...current, [id]: { ...current[id], detailed } });
  }, []);

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
      const card = cardsRef.current.find((item) => item.id === id);
      if (!card || card.feedback === action) return;
      const result = recordTopicFeedback(learningProfileRef.current, card.topicPath, action,
        normalizeDifficulty(settings.obscurity), id, card.feedback);
      setLearningProfile(result.profile);
      const updated = { ...card, feedback: action, known: action === "heard" };
      cardsRef.current = cardsRef.current.map(item => item.id === id ? updated : item);
      archiveFacts([updated]);
      setCards(current => current.map(item => item.id === id ? { ...item, feedback: action, known: action === "heard" } : item));
      const topic = card.topicPath.at(-1) ?? "this topic";
      setToast(action === "unknown" ? `New discovery noted — ${topic} stays at difficulty ${result.targetDifficulty}/10.`
        : result.adjusted ? `Heard — ${topic} is moving to difficulty ${result.targetDifficulty}/10.`
        : `Heard noted — repeated familiar facts can raise ${topic} within two levels of your selection.`);
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
  }, [archiveFacts, cards, settings.obscurity, setLearningProfile, startFeed]);

  const performResetAllPreferences = useCallback(() => {
    clearTopicDetourStatusNotice();
    cancelGeneration();
    requestGeneration.current += 1;
    setTopics(createDefaultTopics());
    topicCatalogReset.current += 1;
    topicCatalogRevision.current += 1;
    setSettings(DEFAULT_SETTINGS);
    setCards([]);
    setQuestionDrafts({});
    setFeedHasMore(true);
    setPendingSlots(DEFAULT_CARD_GENERATION_COUNT);
    setLearningProfile({});
    setLearnLoading(null);
    setQuestionLoading(null);
    adaptationAbortController.current?.controller.abort();
    adaptationAbortController.current = null;
    setAdaptationLoading(null);
    glossaryAbortController.current?.controller.abort();
    glossaryAbortController.current = null;
    setGlossaryLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setGenerationError("");
    setRabbitHole(null);
    updateTopicDetour(null);
    setGenerationError("");
    setTheme("light");
    setRevealGraduallyPreference(false);
    window.dispatchEvent(new Event("learned-media-reset-downloads"));
    setView("feed");
    setToast("Preferences restored to the starting mix.");
  }, [cancelGeneration, clearTopicDetourStatusNotice, setRevealGraduallyPreference, updateTopicDetour]);

  const resetAllPreferences = useCallback(() => {
    setConfirmation({
      title: "Reset all preferences?",
      message: "Your topic mix, feed, and learning preferences will return to their starting values.",
      confirmLabel: "Confirm",
      action: performResetAllPreferences
    });
  }, [performResetAllPreferences]);

  const performDeleteLearningData = useCallback(() => {
    clearTopicDetourStatusNotice();
    cancelGeneration();
    requestGeneration.current += 1;
    setCards([]);
    setQuestionDrafts({});
    setFeedHasMore(true);
    setLearningProfile({});
    setLearnLoading(null);
    setQuestionLoading(null);
    setLearningErrors({});
    setFeedStarted(false);
    setTopics((current) => clearTopicSelections(current));
    setRabbitHole(null);
    updateTopicDetour(null);
    setToast("Learning data cleared. Your topic library and Gemini key were kept.");
  }, [cancelGeneration, clearTopicDetourStatusNotice, updateTopicDetour]);

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
    userEditingKey.current = true;
    credentialManager.current?.edit("gemini", value);
    userEditingKey.current = false;
    apiKeyRef.current = value;
    connectionAbortController.current?.abort();
    generationAbortController.current?.abort();
    learningAbortController.current?.abort();
    questionAbortController.current?.abort();
    adaptationAbortController.current?.controller.abort();
    adaptationAbortController.current = null;
    glossaryAbortController.current?.controller.abort();
    glossaryAbortController.current = null;
    setGlossaryLoading(null);
    youtubeSearchAbortController.current?.abort();
    globalSearchAbortController.current?.abort();
    youtubeSearchCache.current.clear();
    naturalSearchCache.current.clear();
    learningResponseCache.current.clear();
    requestGeneration.current += 1;
    setApiKey(value);
    setGeminiStatus("not-configured");
    setModelChecks(ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" })));
    setModelChecking(false);
    setLoading(false);
    setLearnLoading(null);
    setQuestionLoading(null);
    setAdaptationLoading(null);
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
        const result = await testGeminiKey(keyAtStart, controller.signal, sessionIdRef.current, (check) => {
          setModelChecks((current) => {
            const next = [...current];
            const index = next.findIndex((item) => item?.model === check.model);
            if (index >= 0) next[index] = check;
            else next.push(check);
            return next;
          });
        });
        if (controller.signal.aborted || apiKeyRef.current.trim() !== keyAtStart) return;
        setModelChecks(result.models);
        setGeminiStatus(result.status);
        setToast(result.status === "connected" ? "Gemini connected. Both primary Flash Lite models passed; other models are automatic fallbacks." : "Both primary Flash Lite models must pass. Check their status and retry the connection.");
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
      setToast(finalStatus === "connected" ? "Gemini connected. Both primary Flash Lite models passed; other models are automatic fallbacks." : "Both primary Flash Lite models must pass. Check their status and retry the connection.");
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

  useEffect(() => {
    if (!keysHydrated || !authRestored || !restoredGeminiKey.current || restoredGeminiKey.current !== apiKey.trim()) return;
    restoredGeminiKey.current = "";
    void testConnection();
  }, [apiKey, keysHydrated, authRestored, testConnection]);

  const updateYouTubeWorkspace = useCallback((update: (current: YouTubeWorkspaceState) => YouTubeWorkspaceState, syncCloud = false, persistImmediately = false) => {
    const current = youtubeWorkspaceRef.current;
    let next = update(current);
    if (next.selectedVideoId !== current.selectedVideoId) {
      youtubePlaybackFlushRef.current?.();
      // A flush may have saved the previous video's latest position.
      if (youtubeWorkspaceRef.current !== current) next = update(youtubeWorkspaceRef.current);
    }
    if (next === youtubeWorkspaceRef.current) return;
    const videos = reuseUnchangedVideoRecords(youtubeWorkspaceRef.current.videos, next.videos);
    if (videos !== next.videos) next = { ...next, videos };
    youtubeActivityEditEpoch.current += 1;
    youtubeWorkspaceRef.current = next;
    setYoutubeWorkspace(next);
    const workspaceId = workspaceIdRef.current;
    const record = workspaceStoreRef.current?.records.find((item) => item.id === workspaceId);
    if (record) record.state = { ...record.state, youtubeActivity: youtubeActivityOf(next), savedAt: new Date().toISOString() };
    const existingTimer = youtubeActivitySaveTimers.current.get(workspaceId);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    youtubeActivitySaveTimers.current.delete(workspaceId);
    if (persistImmediately) void saveYouTubeWorkspace(next, { activity: true, workspaceId });
    else {
      youtubeActivitySaveTimers.current.set(workspaceId, window.setTimeout(() => {
        youtubeActivitySaveTimers.current.delete(workspaceId);
        void saveYouTubeWorkspace(next, { activity: true, workspaceId });
      }, 300));
    }
    if (syncCloud) scheduleCloudSave();
  }, [scheduleCloudSave]);

  useEffect(() => {
    if (!hydrated || (view !== "videos" && view !== "settings")) return;
    let active = true;
    let readEpoch = 0;
    let readController: AbortController | undefined;
    const unsubscribe = watchCommittedYouTubeCatalog(() => {
      const epoch = ++readEpoch;
      if (!youtubeCatalogLoadedRef.current || youtubeAbortController.current) return;
      readController?.abort();
      const controller = new AbortController();
      readController = controller;
      const targetWorkspace = workspaceIdRef.current;
      void loadYouTubeWorkspace(targetWorkspace, undefined, true, controller.signal).then(async (catalog) => {
        catalog.videos = await reuseUnchangedVideoRecordsYielding(youtubeWorkspaceRef.current.videos, catalog.videos, controller.signal);
        if (!active || epoch !== readEpoch || youtubeAbortController.current || workspaceIdRef.current !== targetWorkspace) return;
        updateYouTubeWorkspace((current) => {
          const available = new Set(catalog.videos.map(video => video.id));
          const discoverIds = current.discoverIds.filter(id => available.has(id));
          return { ...current, channels: catalog.channels, videos: catalog.videos, sourceStates: catalog.sourceStates,
            catalogVersion: catalog.catalogVersion, libraryIncomplete: catalog.libraryIncomplete, lastSyncAt: catalog.lastSyncAt,
            discoverIds: discoverIds.length ? discoverIds : selectRandomVideos(catalog.videos, 24, [], current.prioritizeRecentByChannel).map(video => video.id) };
        });
        youtubeSearchCache.current.clear();
        setYoutubeStatus(catalog.libraryIncomplete ? "error" : "connected");
        setYoutubeError("");
      }).catch(() => { /* Retain the current catalog if storage is temporarily unavailable. */ });
    });
    return () => { active = false; readController?.abort(); unsubscribe(); };
  }, [hydrated, view, workspaceId, updateYouTubeWorkspace]);

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
      const workspaceAtStart = workspaceIdRef.current;
      const result = await importCoordinatedYouTubeCatalog(keyAtStart, controller.signal,
        (progress) => { if (!controller.signal.aborted && youtubeKeyRef.current.trim() === keyAtStart) setYoutubeProgress(progress); },
        { force, workspaceId: workspaceAtStart });
      if (controller.signal.aborted || youtubeKeyRef.current.trim() !== keyAtStart || workspaceIdRef.current !== workspaceAtStart) return;
      const catalog = result.workspace;
      catalog.videos = await reuseUnchangedVideoRecordsYielding(youtubeWorkspaceRef.current.videos, catalog.videos, controller.signal);
      if (controller.signal.aborted || youtubeKeyRef.current.trim() !== keyAtStart || workspaceIdRef.current !== workspaceAtStart) return;
      updateYouTubeWorkspace((current) => {
        const available = new Set(catalog.videos.map((video) => video.id));
        const preservedDiscoverIds = current.discoverIds.filter((id) => available.has(id));
        return { ...current, channels: catalog.channels, videos: catalog.videos, sourceStates: catalog.sourceStates,
          catalogVersion: catalog.catalogVersion, libraryIncomplete: catalog.libraryIncomplete, lastSyncAt: catalog.lastSyncAt,
          discoverIds: preservedDiscoverIds.length ? preservedDiscoverIds : selectRandomVideos(catalog.videos, 24, [], current.prioritizeRecentByChannel).map((video) => video.id) };
      });
      if (force) syncYouTubeSearchIndex(catalog.videos, true);
      setYoutubeProgress((current) => ({ ...current, phase: "complete", completedChannels: catalog.channels.length,
        importedVideos: catalog.videos.length, currentSource: undefined, error: result.error }));
      youtubeSearchCache.current.clear();
      setYoutubeStatus(catalog.libraryIncomplete ? "error" : "connected");
      setYoutubeError(result.error ?? "");
      setToast(catalog.libraryIncomplete ? "YouTube connected, but some approved channels still need a retry." : "YouTube connected. Your approved video library is ready.");
    } catch (error) {
      if (controller.signal.aborted || youtubeKeyRef.current.trim() !== keyAtStart) return;
      const message = error instanceof Error ? error.message : "YouTube could not import the approved library.";
      setYoutubeStatus("error");
      setYoutubeError(message);
      setYoutubeProgress((current) => ({ ...current, phase: "error", error: message }));
      setToast(message);
    } finally {
      if (youtubeAbortController.current === controller) youtubeAbortController.current = null;
    }
  }, [updateYouTubeWorkspace, youtubeKey, syncYouTubeSearchIndex]);

  useEffect(() => {
    if (!hydrated || !youtubeCatalogLoadedRef.current || !youtubeKey.trim() || youtubeStatus !== "not-configured") return;
    if (youtubeWorkspace.catalogVersion < YOUTUBE_CATALOG_VERSION) {
      // Recheck the shared catalog before deciding whether an upgrade is needed.
      void connectYouTube(false);
      return;
    }
    if (youtubeWorkspace.videos.length) {
      let active = true;
      void hasPendingYouTubeImport().then((pending) => {
        if (!active) return;
        if (pending) void connectYouTube(false);
        else setYoutubeStatus("connected");
      }).catch(() => { if (active) setYoutubeStatus("connected"); });
      return () => { active = false; };
    }
    void connectYouTube(false);
  }, [connectYouTube, hydrated, youtubeKey, youtubeStatus, youtubeWorkspace.catalogVersion, youtubeWorkspace.videos.length]);

  useEffect(() => {
    if (!hydrated || !youtubeWorkspace.videos.length || youtubeWorkspace.discoverIds.length) return;
    const pool = youtubeTopicPool(youtubeWorkspace.selectedTopic);
    const ids = selectRandomVideos(pool, 24, [], youtubeWorkspace.prioritizeRecentByChannel).map((video) => video.id);
    if (ids.length) updateYouTubeWorkspace((current) => current.discoverIds.length ? current : { ...current, discoverIds: ids });
  }, [hydrated, updateYouTubeWorkspace, youtubeTopicPool, youtubeWorkspace.discoverIds.length, youtubeWorkspace.prioritizeRecentByChannel, youtubeWorkspace.selectedTopic, youtubeWorkspace.videos]);

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
    credentialManager.current?.edit("youtube", value);
    youtubeKeyRef.current = value;
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
    handleYouTubeKeyChange("");
    setToast("Remembered YouTube key removed. Your imported catalog remains local.");
  }, [handleYouTubeKeyChange]);

  const shuffleYouTube = useCallback(() => {
    const pool = youtubeTopicPool(youtubeWorkspaceRef.current.selectedTopic);
    const ids = selectRandomVideos(pool, 24, [], youtubeWorkspaceRef.current.prioritizeRecentByChannel).map((video) => video.id);
    updateYouTubeWorkspace((current) => ({ ...current, activeTab: "discover", selectedVideoId: undefined, selectedChannelId: undefined, discoverIds: ids }));
  }, [updateYouTubeWorkspace, youtubeTopicPool]);

  const showMoreYouTube = useCallback(() => {
    const current = youtubeWorkspaceRef.current;
    if (current.searchText.trim()) {
      if (youtubeSearchMoreAbort.current || !youtubeSearchPlan.current) return;
      const controller = new AbortController();
      youtubeSearchMoreAbort.current = controller;
      const revision = youtubeSearchWorkerRevision.current;
      const query = current.searchText.trim();
      const plan = youtubeSearchPlan.current;
      const existing = youtubeSearchResultsRef.current;
      const request = { query, plan, topic: current.selectedTopic, channelId: current.selectedChannelId, limit: 80, excludedIds: existing.map((video) => video.id) };
      const work = youtubeSearchWorker.current
        ? requestYouTubeWorkerSearch(request, controller.signal).then((reply) => reply.type === "results" ? reply.candidates.flatMap((candidate) => { const video = youtubeIndexes.videoById.get(candidate.videoId); return video ? [{ ...candidate, video }] : []; }) : [])
        : searchSemanticVideosYielding(current.videos, plan, current.selectedTopic, current.selectedChannelId, 80, request.excludedIds, controller.signal);
      void work.then((next) => {
        if (controller.signal.aborted || revision !== youtubeSearchWorkerRevision.current || query !== youtubeWorkspaceRef.current.searchText.trim()) return;
        const merged = [...existing, ...next.map((candidate) => candidate.video)];
        youtubeSearchResultsRef.current = merged;
        setYoutubeSearchResults(merged);
        setYoutubeSearchHasMore(next.length === 80);
        setYoutubeSearchReasons((reasons) => ({ ...reasons, ...Object.fromEntries(next.map((candidate) => [candidate.video.id, videoSearchReason(candidate.video, plan, candidate.score)])) }));
      }).catch(() => { /* Existing matches remain usable if pagination is canceled. */ }).finally(() => { if (youtubeSearchMoreAbort.current === controller) youtubeSearchMoreAbort.current = null; });
      return;
    }
    const next = selectRandomVideos(youtubeTopicPool(current.selectedTopic), 24, current.discoverIds, current.prioritizeRecentByChannel);
    if (next.length) updateYouTubeWorkspace((workspace) => ({ ...workspace, activeTab: "discover", discoverIds: [...workspace.discoverIds, ...next.map((video) => video.id)] }));
  }, [requestYouTubeWorkerSearch, updateYouTubeWorkspace, youtubeIndexes.videoById, youtubeTopicPool]);

  const setYouTubeRecentBias = useCallback((channelName: string, enabled: boolean) => {
    updateYouTubeWorkspace((current) => {
      const prioritizeRecentByChannel = { ...(current.prioritizeRecentByChannel ?? DEFAULT_YOUTUBE_RECENCY_PREFERENCES), [channelName]: enabled };
      const pool = youtubeTopicPool(current.selectedTopic);
      const count = Math.min(pool.length, Math.max(current.discoverIds.length, 24));
      const discoverIds = selectRandomVideos(pool, count, [], prioritizeRecentByChannel).map((video) => video.id);
      return { ...current, prioritizeRecentByChannel, discoverIds };
    });
  }, [updateYouTubeWorkspace, youtubeTopicPool]);

  const handleVideoSearch = useCallback((value: string) => {
    if (normalizeSearchText(value) !== normalizeSearchText(youtubeWorkspaceRef.current.searchText)) {
      youtubeSearchAbortController.current?.abort();
      youtubeSearchMoreAbort.current?.abort();
      youtubeSearchAutomaticSignature.current = "";
      youtubeSearchActiveKey.current = "";
      youtubeSearchPlan.current = null;
      youtubeSearchResultsRef.current = [];
      setYoutubeSearchResults([]);
      setYoutubeSearchReasons({});
      setYoutubeSmartSearchRan(false);
      setYoutubeSmartSearchLoading(false);
      setYoutubeSearchPhase("idle");
      setYoutubeSearchHasMore(true);
      setYoutubeError("");
      if (!youtubeWorkspaceRef.current.searchText.trim()) youtubeBrowsingOrder.current = youtubeWorkspaceRef.current.channelOrder;
    }
    updateYouTubeWorkspace((current) => ({ ...current, searchText: value, selectedVideoId: undefined, channelOrder: normalizeSearchText(value) === normalizeSearchText(current.searchText) ? current.channelOrder : value.trim() ? makeLocalVideoPlan(value).sort ?? "relevance" : youtubeBrowsingOrder.current }));
  }, [updateYouTubeWorkspace]);

  const smartVideoSearch = useCallback(async (automatic = false) => {
    const workspace = youtubeWorkspaceRef.current;
    const queryText = workspace.searchText.trim();
    if (!queryText) return;
    const revision = youtubeSearchWorkerRevision.current;
    const snapshot = JSON.stringify([revision, workspace.catalogVersion, workspace.selectedTopic, workspace.selectedChannelId ?? "all", workspace.channelOrder, normalizeSearchText(queryText)]);
    const cacheKey = requestCacheKey(requestCacheScope(sessionIdRef.current, apiKey.trim()), "semantic-video-search", VIDEO_SEMANTIC_VERSION, snapshot);
    // Enter, the button, and automatic search share one pending operation.
    if (youtubeSearchActiveKey.current === cacheKey && youtubeSearchAbortController.current) { return; }
    youtubeSearchAbortController.current?.abort();
    youtubeSearchMoreAbort.current?.abort();
    const controller = new AbortController();
    youtubeSearchAbortController.current = controller;
    youtubeSearchActiveKey.current = cacheKey;
    let plan: VideoSearchPlan = { ...makeLocalVideoPlan(queryText, workspace.channels, workspace.selectedChannelId), sort: workspace.channelOrder };
    const publish = (videos: YouTubeVideo[], reasons: Record<string, RankedVideoSearchResult>) => {
      if (controller.signal.aborted || revision !== youtubeSearchWorkerRevision.current) return;
      youtubeSearchPlan.current = plan;
      youtubeSearchResultsRef.current = videos;
      setYoutubeSearchResults(videos);
      setYoutubeSearchReasons(reasons);
      setYoutubeSmartSearchRan(true);
      setYoutubeSearchHasMore(videos.length === 80);
    };
    try {
      const cached = youtubeSearchCache.current.get(cacheKey);
      if (cached && (automatic || cached.results.length || cached.expanded || !apiKey.trim() || geminiStatus !== "connected")) { plan = cached.plan; publish(cached.results, cached.reasons); return; }
      const getCandidates = async (candidatePlan: VideoSearchPlan, limit = 80) => {
        try {
          const reply = await requestYouTubeWorkerSearch({ query: queryText, plan: candidatePlan, topic: workspace.selectedTopic, channelId: workspace.selectedChannelId, limit }, controller.signal);
          if (reply.type !== "results") return [];
          return reply.candidates.flatMap((candidate) => { const video = youtubeIndexes.videoById.get(candidate.videoId); return video ? [{ video, coverage: candidate.coverage, score: candidate.score, matchedFields: candidate.matchedFields, supportingText: candidate.supportingText }] : []; });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (revision !== youtubeSearchWorkerRevision.current) { controller.abort(); throw error; }
          return searchSemanticVideosYielding(workspace.videos, candidatePlan, workspace.selectedTopic, workspace.selectedChannelId, limit, [], controller.signal);
        }
      };
      const reason = (candidate: YouTubeSearchCandidate): RankedVideoSearchResult => videoSearchReason(candidate.video, plan, candidate.score);
      let candidates = await getCandidates(plan);
      let ranked = candidates.map(reason);
      publish(candidates.map((candidate) => candidate.video), Object.fromEntries(ranked.map((match) => [match.videoId, match])));
      const needsInterpretation = shouldEnrichVideoSearch(queryText, plan, candidates);
      let optionalFailed = false;
      if (needsInterpretation && apiKey.trim() && geminiStatus === "connected") {
        await new Promise<void>((resolve, reject) => {
          const done = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", abort); resolve(); };
          const timer = setTimeout(done, 1500);
          const abort = () => { clearTimeout(timer); reject(new DOMException("Search canceled", "AbortError")); };
          if (controller.signal.aborted) abort(); else controller.signal.addEventListener("abort", abort, { once: true });
        });
        if (controller.signal.aborted) return;
        setYoutubeSmartSearchLoading(true);
        setYoutubeSearchPhase("interpreting");
        try {
          const interpreted = await interpretVideoSearch({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: queryText, catalogVersion: `${VIDEO_SEMANTIC_VERSION}:${revision}:${workspace.catalogVersion}`, signal: controller.signal });
          if (controller.signal.aborted) return;
          recordGeminiOutcomes(interpreted.modelOutcomes);
          plan = mergeVideoSearchPlans(plan, interpreted.plan, workspace.channels, workspace.selectedChannelId);
          candidates = await getCandidates(plan);
          ranked = candidates.map(reason);
          if (!ranked.length && plan.conceptGroups?.length) {
            setYoutubeSearchPhase("checking");
            const uncertain = await getCandidates({ ...plan, include: [], conceptGroups: plan.conceptGroups.map((group) => ({ ...group, required: false })) }, 40);
            if (uncertain.length) {
              const checked = await rankVideoSearchCandidates({ apiKey: apiKey.trim(), sessionId: sessionIdRef.current, query: queryText, plan, candidates: uncertain, catalogVersion: `${revision}:${workspace.catalogVersion}`, signal: controller.signal });
              if (controller.signal.aborted) return;
              recordGeminiOutcomes(checked.modelOutcomes);
              ranked = checked.results;
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          recordGeminiFailure(error);
          optionalFailed = true;
          setYoutubeError("Meaning-based expansion is unavailable. Local matches remain available.");
        }
      }
      if (controller.signal.aborted || revision !== youtubeSearchWorkerRevision.current) return;
      const accepted = ranked.filter((match) => { const video = youtubeIndexes.videoById.get(match.videoId); return video && !video.id.startsWith("demo-") && eligibleSemanticVideo(video, plan, workspace.selectedTopic, workspace.selectedChannelId); });
      accepted.sort((left, right) => right.localScore - left.localScore);
      let videos = accepted.flatMap((match) => { const video = youtubeIndexes.videoById.get(match.videoId); return video ? [video] : []; });
      if (plan.sort === "newest") videos.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt));
      if (plan.sort === "oldest") videos.sort((a,b) => a.publishedAt.localeCompare(b.publishedAt));
      if (plan.sort === "random") videos = selectRandomVideos(videos, videos.length, [], workspace.prioritizeRecentByChannel);
      const reasons = Object.fromEntries(accepted.map((match) => [match.videoId, match]));
      publish(videos, reasons);
      if (!optionalFailed && (!needsInterpretation || apiKey.trim() && geminiStatus === "connected")) youtubeSearchCache.current.set(cacheKey, { results: videos, reasons, plan, expanded: needsInterpretation && Boolean(apiKey.trim() && geminiStatus === "connected") });
      setYoutubeSearchPhase(optionalFailed ? "error" : "idle");
      if (!automatic) setToast(`${videos.length} relevant approved video${videos.length === 1 ? "" : "s"} matched your search.`);
    } catch (error) {
      if (!controller.signal.aborted) { setYoutubeSearchPhase("error"); setYoutubeError(error instanceof Error ? error.message : "Video search could not complete."); }
    } finally {
      if (youtubeSearchAbortController.current === controller) { youtubeSearchAbortController.current = null; youtubeSearchActiveKey.current = ""; setYoutubeSmartSearchLoading(false); }
    }
  }, [apiKey, geminiStatus, recordGeminiFailure, recordGeminiOutcomes, requestYouTubeWorkerSearch, youtubeIndexes.videoById]);

  const cancelSmartVideoSearch = useCallback(() => {
    youtubeSearchAbortController.current?.abort();
    youtubeSearchAbortController.current = null;
    setYoutubeSmartSearchLoading(false);
    youtubeSearchMoreAbort.current?.abort();
    setYoutubeSearchPhase("idle");
  }, []);

  const openVideo = useCallback((id: string) => {
    updateYouTubeWorkspace((current) => {
      const history = [{ videoId: id, watchedAt: new Date().toISOString() }, ...current.history.filter((item) => item.videoId !== id)].slice(0, 200);
      return { ...current, selectedVideoId: id, selectedChannelId: undefined, history };
    }, true);
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

  const recordYouTubePlaybackPosition = useCallback((id: string, seconds: number, ownerWorkspaceId: string) => {
    if (ownerWorkspaceId !== workspaceIdRef.current || !Number.isFinite(seconds) || seconds < 0) return;
    const second = Math.floor(seconds);
    updateYouTubeWorkspace((current) => Math.floor(current.playbackPositions[id] ?? 0) === second ? current : { ...current, playbackPositions: { ...current.playbackPositions, [id]: second } }, false, true);
  }, [updateYouTubeWorkspace]);

  const deferredVideoSearchText = useDeferredValue(youtubeWorkspace.searchText);
  const youtubeSearchBaseKey = JSON.stringify([youtubeSearchIndexRevision, youtubeWorkspace.catalogVersion, youtubeWorkspace.selectedTopic, youtubeWorkspace.selectedChannelId ?? "all", youtubeWorkspace.channelOrder]);
  useEffect(() => {
    if (view !== "videos" || !hydrated || !deferredVideoSearchText.trim() || youtubeWorkspace.selectedVideoId || youtubeWorkspace.activeTab !== "discover" && !youtubeWorkspace.selectedChannelId) {
      youtubeSearchAbortController.current?.abort();
      youtubeSearchMoreAbort.current?.abort();
      youtubeSearchAutomaticSignature.current = "";
      return;
    }
    const signature = JSON.stringify([youtubeSearchBaseKey, normalizeSearchText(deferredVideoSearchText), requestCacheScope(sessionIdRef.current, apiKey.trim())]);
    if (youtubeSearchAutomaticSignature.current === signature) return;
    youtubeSearchAutomaticSignature.current = signature;
    void smartVideoSearch(true);
  }, [apiKey, deferredVideoSearchText, hydrated, smartVideoSearch, view, youtubeSearchBaseKey, youtubeWorkspace.activeTab, youtubeWorkspace.selectedChannelId, youtubeWorkspace.selectedVideoId]);

  useEffect(() => {
    const text = query.trim();
    if (!text || !hydrated || !cardSearchWorkerReadyState || (view !== "feed" && view !== "saved" && view !== "likes" && view !== "history")) {
      if (cardSearchSignature.current) {
        cardSearchSignature.current = "";
        if (cardSearchWorkerReady.current) cardSearchWorker.current?.postMessage({ type: "cancel", requestId: ++cardSearchRequestId.current });
      }
      return;
    }
    const eligibleCards = view === "saved" ? cards.filter((card) => card.saved) : view === "likes" ? cards.filter((card) => card.liked) : cards;
    const eligibleIds = eligibleCards.map((card) => card.id);
    const signature = JSON.stringify([cardSearchRevision.current, view, text, eligibleIds]);
    if (cardSearchSignature.current === signature) return;
    cardSearchSignature.current = signature;
    const requestId = ++cardSearchRequestId.current;
    cardSearchWorker.current?.postMessage({ type: "search", requestId, revision: cardSearchRevision.current, query: text, eligibleIds, viewKey: view });
  }, [cardSearchIndexRevision, cardSearchWorkerReadyState, cards, hydrated, query, view]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const collectionBase = useMemo(() => view === "saved" ? cards.filter((card) => card.saved) : view === "likes" ? cards.filter((card) => card.liked) : view === "history" ? cards : [], [cards, view]);
  const cardSearchResult = cardSearchReply?.type === "results" ? cardSearchReply : null;
  const matchingCardIds = cardSearchResult
    && cardSearchResult.revision === cardSearchIndexRevision
    && cardSearchResult.viewKey === view
    ? cardSearchResult.ids
    : null;
  const workerCanSearchCards = typeof Worker !== "undefined" && !cardSearchWorkerFailed;
  const videoSearchResults = useMemo(() => {
    if (deferredVideoSearchText.trim()) return youtubeSearchResults;
    return youtubeWorkspace.discoverIds.map((id) => youtubeIndexes.videoById.get(id)).filter((video): video is YouTubeVideo => Boolean(video));
  }, [deferredVideoSearchText, youtubeSearchResults, youtubeWorkspace.discoverIds, youtubeIndexes.videoById]);

  const filteredCards = useMemo(() => {
    if (!query.trim()) return cards;
    let matches: FactCard[];
    if (workerCanSearchCards) {
      const ids = matchingCardIds && cardSearchResult?.viewKey === "feed" ? matchingCardIds : null;
      matches = ids ? ids.map((id) => cardById.get(id)).filter((card): card is FactCard => Boolean(card)) : cards;
    } else {
      matches = rankSearchResults(query, cards, cardSearchText);
    }
    if (!topicDetour) return matches;
    const visibleDetourIds = new Set([topicDetour.sourceCardId, ...topicDetour.slotCardIds.filter((id): id is string => Boolean(id))]);
    return orderTopicDetourCards([...matches, ...cards.filter(card => visibleDetourIds.has(card.id))], topicDetour);
  }, [cardById, cardSearchReply, cards, matchingCardIds, query, topicDetour, workerCanSearchCards]);

  const collectionCards = useMemo(() => {
    if (view !== "saved" && view !== "likes" && view !== "history") return [];
    if (!query.trim()) return collectionBase;
    if (workerCanSearchCards) {
      const ids = matchingCardIds && cardSearchResult?.viewKey === view ? matchingCardIds : null;
      return ids ? ids.map((id) => cardById.get(id)).filter((card): card is FactCard => Boolean(card)) : collectionBase;
    }
    return rankSearchResults(query, collectionBase, cardSearchText);
  }, [cardById, cardSearchReply, collectionBase, matchingCardIds, query, view, workerCanSearchCards]);

  const chooseExploreTopic = useCallback((requestedTopic: string, requestedId?: string) => {
    if (requestedTopic === "Custom topic") {
      setFeedStarted(false);
      setQuery("");
      setView("feed");
      setToast("Add a custom topic from setup to start exploring.");
      return;
    }

    const normalizedTopic = normalizeSearchText(requestedTopic);
    let selectedTopic = requestedId ? findTopicById(topics, requestedId) : undefined;
    if (!selectedTopic) {
      const catalogTopics = getCatalogTopicList();
      const exactMatch = catalogTopics.find((topic) => (
        normalizeSearchText(topic.label) === normalizedTopic
        || topic.aliases?.some((alias) => normalizeSearchText(alias) === normalizedTopic)
      ));
      const directSuggestion = exactMatch
        ? undefined
        : suggestTopics(getCatalogSuggestionIndex(), requestedTopic).find((suggestion) => suggestion.group === "keyword");
      selectedTopic = exactMatch ?? catalogTopics.find((topic) => topic.id === directSuggestion?.id);
    }
    const label = selectedTopic?.label ?? titleCaseTopicLabel(requestedTopic);

    if (selectedTopic) {
      const selectedTopicId = selectedTopic.id;
      setTopics((current) => {
        const topic = findTopicById(current, selectedTopicId);
        return !topic || selectionState(topic) === "selected" ? current : toggleTopicSelection(current, selectedTopicId);
      });
    } else {
      const existingTopics = flattenTopics(topics);
      const existingLabel = existingTopics.find((topic) => normalizeCustomTopicLabel(topic.label) === normalizeCustomTopicLabel(label));
      if (existingLabel) {
        selectedTopic = existingLabel;
        setTopics((current) => {
          const topic = findTopicById(current, existingLabel.id);
          return !topic || selectionState(topic) === "selected" ? current : toggleTopicSelection(current, topic.id);
        });
      } else {
        queueCustomTopic(label);
      }
    }

    setFeedHasMore(true);
    setFeedStarted(false);
    setQuery(label);
    setView("feed");
    setToast(`Ready to explore ${label}. Start learning when you're ready.`);
  }, [getCatalogSuggestionIndex, getCatalogTopicList, catalogRevision, queueCustomTopic, topics]);

  const renderMain = () => {
    if (view === "explore") return <ExploreView onChoose={chooseExploreTopic} />;
      if (view === "videos") return <VideoWorkspace workspaceId={workspaceId} playbackFlushRef={youtubePlaybackFlushRef} workspace={youtubeWorkspace} videoById={youtubeIndexes.videoById} channelById={youtubeIndexes.channelById} videosByChannel={youtubeIndexes.videosByChannel} youtubeStatus={youtubeStatus} progress={youtubeProgress} error={youtubeError} searchResults={videoSearchResults} searchReasons={youtubeSearchReasons} smartSearchLoading={youtubeSmartSearchLoading} searchPhase={youtubeSearchPhase} smartSearchRan={youtubeSmartSearchRan} searchHasMore={youtubeSearchHasMore} onOpenSettings={() => setView("settings")} onTabChange={(tab) => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, activeTab: tab, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSearchChange={handleVideoSearch} onSmartSearch={() => void smartVideoSearch()} onCancelSearch={cancelSmartVideoSearch} onTopicChange={(topic) => { cancelSmartVideoSearch(); setYoutubeSearchResults([]); setYoutubeSearchReasons({}); setYoutubeSmartSearchRan(false); setYoutubeSearchPhase("idle"); updateYouTubeWorkspace((current) => ({ ...current, selectedTopic: topic, discoverIds: selectRandomVideos(youtubeTopicPool(topic), 24, [], current.prioritizeRecentByChannel).map((video) => video.id) })); }} onShuffle={shuffleYouTube} onShowMore={showMoreYouTube} onRefreshVideos={() => void connectYouTube(true)} onOpenVideo={openVideo} onOpenChannel={openChannel} onBack={() => { cancelSmartVideoSearch(); setYoutubeSmartSearchRan(false); setYoutubeSearchResults([]); updateYouTubeWorkspace((current) => ({ ...current, selectedChannelId: undefined, selectedVideoId: undefined, searchText: "" })); }} onSaveVideo={saveVideo} onPlaybackPosition={recordYouTubePlaybackPosition} onChannelOrder={(order) => updateYouTubeWorkspace((current) => ({ ...current, channelOrder: order }))} onPauseImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeImport={() => void connectYouTube()} onRetryImport={() => void connectYouTube()} />;
    if (view === "saved" || view === "likes" || view === "history") return <CollectionView kind={view} workspaceId={workspaceId} cards={collectionCards} displayMode={settings.displayMode} revealGradually={revealGradually} learnLoading={learnLoading} questionLoading={questionLoading} questionDrafts={questionDrafts} learningErrors={learningErrors} adaptationLoading={adaptationLoading} glossaryLoading={glossaryLoading} hasGeminiKey={Boolean(apiKey.trim())} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onQuestionDraft={updateQuestionDraft} onQuestionDetailed={updateQuestionDetailPreference} onAdaptExplanation={adaptCardExplanation} onExplainTerms={explainCardTerms} onCancelGlossary={cancelCardGlossary} onLocationsResolved={saveCardLocations} onOpenSettings={() => setView("settings")} onThreeMore={startTopicDetour} />;
    if (view === "settings") return <SettingsView apiKey={apiKey} onApiKeyChange={handleApiKeyChange} status={geminiStatus} feedback={toast} modelChecks={modelChecks} modelChecking={modelChecking} onTestConnection={testConnection} onRemoveKey={() => { handleApiKeyChange(""); setToast("Remembered key removed."); }} theme={theme} onThemeChange={setTheme} revealGradually={revealGradually} onRevealGraduallyChange={setRevealGraduallyPreference} onResetAll={resetAllPreferences} onDeleteLearningData={deleteLearningData} onGoogleSignIn={handleGoogleSignIn} onGoogleSignOut={handleGoogleSignOut} account={account} syncStatus={syncStatus === "synced" && keySyncStatus === "syncing" ? "syncing" : syncStatus === "synced" && keySyncStatus === "error" ? "error" : syncStatus} syncError={[syncError, keySyncError].filter(Boolean).join(" ")} youtubeKey={youtubeKey} youtubeStatus={youtubeStatus} youtubeProgress={youtubeProgress} youtubeLastSyncAt={youtubeWorkspace.lastSyncAt} prioritizeRecentByChannel={youtubeWorkspace.prioritizeRecentByChannel} onYoutubeKeyChange={handleYouTubeKeyChange} onYoutubeRecentBiasChange={setYouTubeRecentBias} onConnectYoutube={() => void connectYouTube()} onRefreshYoutube={() => void connectYouTube(true)} onRemoveYoutubeKey={removeYouTubeKey} onPauseYoutubeImport={() => { youtubeAbortController.current?.abort(); setYoutubeProgress((current) => ({ ...current, phase: "paused", paused: true })); }} onResumeYoutubeImport={() => void connectYouTube()} onRetryYoutubeImport={() => void connectYouTube()} workspaceName={workspaceName} cards={cards} />;
    if (!feedStarted) return <SetupWorkspace topics={topics} query={query} catalogRevision={catalogRevision} searchIndex={topicTreeSearchIndex} onQueryChange={setQuery} settings={settings} customTopic={customTopic} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onCollapseTopics={handleCollapseTopics} onWeightTopic={handleWeightTopic} onRemoveCustomTopic={removeCustomTopic} onSettingsChange={updateSettings} onResetTopics={resetTopics} onStart={() => void startFeed()} onOpenSettings={() => setView("settings")} canStart={geminiStatus === "connected"} hasGeminiKey={!keysHydrated || Boolean(apiKey.trim())} />;
    return <FeedView workspaceId={workspaceId} cards={filteredCards} showReset={cards.length > 0 || loading} query={query} catalogRevision={catalogRevision} topicSearchIndex={topicTreeSearchIndex} settings={settings} revealGradually={revealGradually} topics={topics} customTopic={customTopic} loading={loading} canLoadMore={feedHasMore && selectedCount > 0} generationError={generationError} rabbitHole={rabbitHole} topicDetour={topicDetour} topicDetourStatusNotice={topicDetourStatusNotice} toast={toast} learnLoading={learnLoading} questionLoading={questionLoading} questionDrafts={questionDrafts} learningErrors={learningErrors} adaptationLoading={adaptationLoading} glossaryLoading={glossaryLoading} hasGeminiKey={Boolean(apiKey.trim())} onAction={handleCardAction} onLearnMore={learnMore} onAskQuestion={askQuestion} onQuestionDraft={updateQuestionDraft} onQuestionDetailed={updateQuestionDetailPreference} onAdaptExplanation={adaptCardExplanation} onExplainTerms={explainCardTerms} onCancelGlossary={cancelCardGlossary} onLocationsResolved={saveCardLocations} onOpenSettings={() => setView("settings")} onReset={resetFeed} onRetry={retryGeneration} onLoadMore={loadMoreGeneration} onThreeMore={startTopicDetour} onEndTopicDetour={endTopicDetour} onTopicDetourProgress={handleTopicDetourProgress} onSettingsChange={updateSettings} onCustomTopicChange={setCustomTopic} onAddCustomTopic={addCustomTopic} onToggleTopic={handleToggleTopic} onExpandTopic={handleExpandTopic} onCollapseTopics={handleCollapseTopics} onWeightTopic={handleWeightTopic} onRemoveCustomTopic={removeCustomTopic} />;
  };

  const topicSuggestions = localTopicSuggestions;

  return (
    <CardDownloadsProvider workspaceId={workspaceId} accountId={account?.id} workspaceName={workspaceName} cards={cards} topics={topics}><div
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
        onChooseTopic={(label, id) => chooseExploreTopic(label, id)}
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
    </div></CardDownloadsProvider>
  );
}
