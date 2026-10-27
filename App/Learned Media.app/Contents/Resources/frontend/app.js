(function () {
  "use strict";

  const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
  const shared = window.LEARNED_MEDIA_SHARED;
  const DEFAULT_SETTINGS = shared.DEFAULT_SETTINGS;
  const TOPIC_CATALOG_VERSION = shared.TOPIC_CATALOG_VERSION;
  const REQUIRED_WORKING_MODELS = 2;
  const PRIMARY_GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const ALLOWED_GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
  const factDownloads = window.LEARNED_MEDIA_FACT_DOWNLOADS;
  let downloadMode = "pdf-single", downloadTask = null, downloadStatus = "", downloadJobToken = 0, downloadCollection = "all";
  const TOPICS = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  const difficultyEngine = window.LEARNED_MEDIA_DIFFICULTY;
  const DIFFICULTY_LABELS = difficultyEngine.DIFFICULTY_LABELS;
  const PERSISTENCE_VERSION = 2;
  const LOCAL_WORKSPACE_KEY = "learned-media-native-workspace";
  const sourceSpotlight = window.LEARNED_MEDIA_SOURCE_SPOTLIGHT;
  const cardReveal = window.LEARNED_MEDIA_CARD_REVEAL;
  const cardExplanations = window.LEARNED_MEDIA_CARD_EXPLANATIONS;
  const cardGlossary = window.LEARNED_MEDIA_CARD_GLOSSARY;
  const factNovelty = window.LEARNED_MEDIA_FACT_NOVELTY;
  const batchReplay = window.LEARNED_MEDIA_BATCH_REPLAY;
  let factNoveltyIndex = null;
  let factNoveltyIndexSource = null;
  let legacyYoutubeRecencyPreferences = Object.assign({}, window.LEARNED_MEDIA_YOUTUBE.DEFAULT_RECENCY_PREFERENCES || {});
  const cardChronology = window.LEARNED_MEDIA_CARD_CHRONOLOGY;
  const cardLocations = window.LEARNED_MEDIA_CARD_LOCATIONS;
  const cardFollowUps = window.LEARNED_MEDIA_CARD_FOLLOW_UPS;
  const topicDetours = window.LEARNED_MEDIA_TOPIC_DETOURS;
  const factAngleOptions = window.LEARNED_MEDIA_FACT_ANGLES || [];
  const sourceSpotlightStates = new Map();
  const sourceSpotlightRequests = new Map();
  let adaptationRequest = null;
  let glossaryRequest = null;
  let focusedSpotlightTrigger = null;
  let focusedSpotlightContext = null;
  let focusedDifficultyCardId = null;
  let focusDifficultyMenuAfterRender = false;
  let focusedMoreCardId = null;
  let focusMoreMenuAfterRender = false;
  let focusedLearnCardId = null;
  let focusLearnMenuAfterRender = false;
  let focusedGlossaryHeadingCardId = null;
  let focusedGlossaryTriggerCardId = null;
  let focusedChronologyHeadingCardId = null;
  let focusedChronologyTriggerCardId = null;
  let focusedLocationHeadingCardId = null;
  let focusedLocationTriggerCardId = null;
  const nativeLocationLoads = new Map();
  let nativeCountryOutlines = null;
  const BEST_SELLING_BOOK_ORDER = [
    "A Tale of Two Cities", "The Little Prince", "The Alchemist", "Harry Potter and the Philosopher's Stone", "And Then There Were None", "Dream of the Red Chamber", "The Hobbit", "Alice's Adventures in Wonderland",
    "She: A History of Adventure", "The Da Vinci Code", "Harry Potter and the Chamber of Secrets", "The Catcher in the Rye", "Sophie's World", "The Bridges of Madison County", "One Hundred Years of Solitude", "Lolita", "Heidi", "The Common Sense Book of Baby and Child Care", "Anne of Green Gables", "Black Beauty", "The Name of the Rose", "The Eagle Has Landed", "Watership Down", "The Hite Report", "Charlotte's Web", "The Ginger Man", "The Purpose Driven Life",
    "The Tale of Peter Rabbit", "Jonathan Livingston Seagull", "The Very Hungry Caterpillar", "A Message to Garcia", "To Kill a Mockingbird", "Flowers in the Attic", "Cosmos", "Angels & Demons", "How to Win Friends and Influence People", "Alcoholics Anonymous", "Fear of Flying", "How the Steel Was Tempered", "War and Peace", "The Adventures of Pinocchio", "The Diary of Anne Frank", "Your Erroneous Zones", "The Thorn Birds", "Kane and Abel", "The Kite Runner", "Valley of the Dolls", "The Great Gatsby", "Gone with the Wind", "Rebecca", "The Revolt of Mamie Stover", "The Girl with the Dragon Tattoo", "The Lost Symbol", "The Hunger Games", "James and the Giant Peach", "Ben-Hur: A Tale of the Christ", "The Young Guard", "Who Moved My Cheese?",
    "A Brief History of Time", "Paul and Virginia", "Lust for Life", "The Wind in the Willows", "The 7 Habits of Highly Effective People", "Totto-Chan: The Little Girl at the Window", "Sapiens: A Brief History of Humankind", "Virgin Soil Upturned", "The Celestine Prophecy", "The Fault in Our Stars", "The Girl on the Train", "The Shack", "Uncle Styopa", "The Godfather", "Love Story", "Catching Fire", "Mockingjay", "Kitchen", "Andromeda Nebula", "Gone Girl", "The Bermuda Triangle", "Things Fall Apart", "Wolf Totem", "The Happy Hooker: My Own Story", "Jaws", "Love You Forever", "The Women's Room", "What to Expect When You're Expecting", "Adventures of Huckleberry Finn", "The Secret Diary of Adrian Mole, Aged 13¾", "Pride and Prejudice", "Kon-Tiki: Across the Pacific in a Raft", "The Good Soldier Švejk", "Where the Wild Things Are", "The Power of Positive Thinking", "The Secret", "Dune", "Charlie and the Chocolate Factory", "The Naked Ape", "Kokoro",
    "Where the Crawdads Sing", "Follow Your Heart", "Matilda", "The Book Thief", "The Horse Whisperer", "Goodnight Moon", "The Neverending Story", "All the Light We Cannot See", "Fifty Shades of Grey", "The Outsiders", "Guess How Much I Love You", "Shōgun", "The Poky Little Puppy", "The Pillars of the Earth", "Perfume", "The Grapes of Wrath"
  ];
  function bookSortKey(value) {
    const label = String(value || "").replace(/\s*\([^)]*\)/g, "").replace(/^Paul et Virginie$/i, "Paul and Virginia");
    return label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function sortBooksBySales(children) {
    const ranks = new Map(BEST_SELLING_BOOK_ORDER.map(function (title, index) { return [bookSortKey(title), index]; }));
    return (children || []).map(function (child, index) { return { child: child, index: index, rank: ranks.has(bookSortKey(child)) ? ranks.get(bookSortKey(child)) : BEST_SELLING_BOOK_ORDER.length }; }).sort(function (a, b) { return a.rank - b.rank || a.index - b.index; }).map(function (item) { return item.child; });
  }
  const KNOWN_DEMO_IDS = new Set(["demo-dodecahedron", "demo-antikythera", "demo-blue-hole", "demo-wasp", "demo-concrete", "demo-jellyfish", "demo-mouse", "demo-whistle", "roman-dodecahedron", "mouse-wood", "roman-concrete", "venus-day", "blue-banana", "antarctic-dry-valleys", "mantis-shrimp", "paper-clip", "honey-never-spoils", "fermi-paradox", "antikythera-mechanism", "quipu", "tyrian-purple", "mechanical-turk", "harvard-mark-ii-bug", "oklo-reactor", "lake-vostok", "axolotl-regeneration", "ada-lovelace-notes", "sagittarius-b2-alcohol", "brinicle", "volcanic-lightning"]);
  const state = {
    workspaceId: "local-workspace",
    workspaceName: "Local Workspace",
    workspaces: [],
    renameWorkspaceId: null,
    renameWorkspaceDraft: "",
    renameWorkspaceError: "",
    factMemory: [],
    batchAccepted: 0,
    keyEditEpoch: 0,
    view: "feed",
    started: false,
    topics: makeTopics(),
    settings: Object.assign({}, DEFAULT_SETTINGS),
    revealGradually: false,
    cards: [],
    profile: {},
    query: "",
    semanticSearchTerms: [],
    topicQuery: "",
    customTopic: "",
    key: "",
    geminiStatus: "not-configured",
    modelChecks: ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; }),
    modelChecking: false,
    youtubeKey: "",
    youtubeStatus: "not-configured",
    youtubeProgress: { phase: "idle", completedChannels: 0, totalChannels: window.LEARNED_MEDIA_YOUTUBE ? window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length : 58, importedVideos: 0, completedSources: 0, totalSources: 0 },
    youtubeError: "",
    youtube: { channels: [], videos: [], savedIds: [], history: [], playbackPositions: {}, searchText: "", smartIds: null, smartReasons: {}, smartRan: false, topic: "All", tab: "discover", selectedChannelId: null, selectedVideoId: null, discoverIds: [], order: "newest", incomplete: false, catalogVersion: shared.youtube.YOUTUBE_CATALOG_VERSION, sourceStates: {}, lastSyncAt: null },
    account: null,
    cloudOwnerId: null,
    cloudSyncReady: false,
    syncStatus: "signed-out",
    syncError: "",
    toast: "",
    confirmation: null,
    loading: false,
    loadingCard: null,
    questionLoading: null,
    rabbitHole: null,
    adaptationLoading: null,
    adaptationErrorByCard: {},
    glossaryLoading: null,
    glossaryErrorByCard: {},
    difficultyMenuCardId: null,
    learnMenuCardId: null,
    moreMenuCardId: null,
    errorByCard: {},
    generationError: "",
    pendingSlots: 7,
    topicDetour: null,
    youtubeSearchPhase: "idle",
    youtubeSearchError: "",
    connectionToken: 0,
    generationRequestToken: 0,
    activeGenerationSentenceLength: 3,
    lastCompletedBatchSetup: null,
    repeatBatchPreview: null,
    repeatMenuOpen: false,
    activeGenerationSlotIds: []
  };
  const youtubeProgressStore = shared.youtube.createYouTubeProgressStore(state.youtubeProgress);
  youtubeProgressStore.subscribe(updateNativeYouTubeProgressNotices);
  const youtubeFilteredListMemo = shared.youtube.createYouTubeListMemo();
  const youtubePartitionMemo = shared.youtube.createYouTubeListMemo();
  let nativeKeyEditing = false;
  let nativeCredentialOwner = null;
  let nativeKeySyncError = "";
  let nativeAccountRestored = false;
  let nativeCheckedRestoredKey = "";
  function checkRestoredNativeKey(key) {
    if (!nativeAccountRestored || !key || state.key !== key || nativeCheckedRestoredKey === key) return;
    nativeCheckedRestoredKey = key;
    testKey();
  }
  const nativeCredentials = new window.LearnedMediaCredentials.AccountCredentials({
    read: function (owner, provider) { return bridge("credentialRead", { owner: owner, provider: provider }).then(function (value) { return value || undefined; }); },
    write: function (owner, provider, entry) { return bridge("credentialWrite", { owner: owner, provider: provider, entry: entry }); },
    load: function (owner) { return bridge("accountKeysLoad", { owner: owner }); },
    save: function (owner, provider, value) { return bridge("accountKeySave", { owner: owner, provider: provider, value: value }); },
    changed: function (keys) {
      const restored = !nativeKeyEditing && keys.gemini && keys.gemini !== state.key;
      if (state.key !== keys.gemini) {
        if (activeFactBatch) { clearFactAngleBatch(); state.topicDetour = null; }
        cancelCardAdaptation();
        cancelCardGlossary();
        for (const entry of learningTasks.values()) entry.task?.cancel?.();
        learningTasks.clear();
        state.keyEditEpoch += 1; generationToken += 1;
        state.loadingCard = null; state.questionLoading = null; state.modelChecking = false;
        if (activeGenerationTask) activeGenerationTask.cancel?.();
        activeGenerationTask = null; state.loading = false;
        nativeCheckedRestoredKey = "";
        state.key = keys.gemini; state.geminiStatus = "not-configured";
        state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; });
        clearSessionSearchCaches(); state.connectionToken += 1; state.generationRequestToken += 1;
      }
      if (state.youtubeKey !== keys.youtube) { invalidateNativeYouTubeSync(); state.youtubeKey = keys.youtube; state.youtubeStatus = "not-configured"; state.youtubeError = ""; state.connectionToken += 1; clearNativeYouTubeProgress(); }
      bridge("useKeys", keys).then(function () { if (restored) checkRestoredNativeKey(keys.gemini); }).catch(function () {});
      if (!nativeKeyEditing) render();
    },
    status: function (status, message) {
      const previousError = nativeKeySyncError;
      nativeKeySyncError = message || "";
      if (status === "error" && state.account) { state.syncStatus = "error"; state.syncError = nativeKeySyncError; }
      else if (status === "synced" && state.cloudSyncReady && previousError && state.syncError === previousError) { state.syncStatus = "synced"; state.syncError = ""; }
      if (!nativeKeyEditing) render();
    }
  });
  function editNativeCredential(provider, value) {
    nativeKeyEditing = true;
    nativeCredentials.edit(provider, value);
    nativeKeyEditing = false;
  }

  function normalizeSentenceLength(value) {
    const number = Number(value);
    return [1, 2, 3, 4, 6, 8, 10].includes(number) ? number : 3;
  }
  function countSentences(text) {
    return (String(text || "").trim().match(/[.!?](?=(?:["'”’»)]|\s|$))/g) || []).length;
  }
  function hasExactSentenceCount(text, expected) {
    return countSentences(text) === normalizeSentenceLength(expected);
  }
  function factFingerprint(item) {
    function normalized(value) { return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    return normalized((item.claim || item.title || "") + " " + (item.body || ""));
  }
  function claimMemoryFingerprint(item) {
    return String(item.claim || item.title || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function memoryEvidence(item) {
    const sources = item.sources || [];
    return (item.evidence || []).map(function (entry) {
      if (typeof entry === "string") return { quote: entry };
      const source = sources[Number(entry.sourceIndex)] || {};
      return {
        quote: entry.quote || "",
        section: entry.section || "",
        sourceIndex: Number.isInteger(entry.sourceIndex) ? entry.sourceIndex : undefined,
        url: source.canonicalUrl || source.url || ""
      };
    }).filter(function (entry) { return entry.quote; });
  }
  function normalizeMemory(item) {
    const evidence = memoryEvidence(item);
    const sourceUrls = item.sourceUrls || (item.sources || []).map(function (source) { return source.canonicalUrl || source.url; }).filter(Boolean);
    const evidenceKeys = item.evidenceKeys || evidence.map(function (entry) {
      return [entry.url || "", entry.section || "", entry.quote || ""].join("|").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();
    });
    const evidenceSections = item.evidenceSections || evidence.map(function (entry) { return entry.section; }).filter(Boolean);
    const normalized = Object.assign({}, item, {
      fingerprint: item.fingerprint || factFingerprint(item),
      claimFingerprint: item.claimFingerprint || claimMemoryFingerprint(item),
      sourceUrls: sourceUrls,
      evidence: evidence.map(function(entry){return entry.quote;}),
      evidenceKeys: evidenceKeys,
      evidenceSections: evidenceSections
    });
    delete normalized.sources;
    return normalized;
  }
  const app = document.getElementById("app");
  const pending = new Map();
  let requestID = 0;
  let generationToken = 0;
  let activeGenerationTask = null;
  let activeGenerationDetourId = null;
  let selectedFactAngle = "varied";
  let activeFactBatch = null;
  let repeatMenuTriggerFocus = false;
  let focusRepeatFirstAfterRender = false;
  let suppressTopicDetourScroll = false;
  let topicDetourProgressFrame = 0;
  let pendingTopicDetourAnchor = null;
  let topicDetourCompletionNotice = "";
  let topicDetourCompletionTimer = null;
  let topicTreeScrollTop = 0;
  let mainScrollTop = 0;
  let focusedTopicId = null;
  let focusedFieldId = null;
  let focusedSelection = null;
  let focusedQuestionCardId = null;
  let focusedQuestionSelection = null;
  let dismissedFollowUpQuestionKey = "";
  let saveInFlight = false;
  let cloudSaveTimer = null;
  let cloudSyncToken = 0;
  let cloudSaveRevision = 0;
  let cloudUploads = createCloudUploadQueue();
  let trackedFactMemory = null;
  let factMemoryById = new Map();
  let changedFactMemoryIds = new Set();
  const sentFactMemories = new Map();
  const archivedFactCards = new WeakMap();
  let queuedWorkspaceState = null;
  let stopYoutubePlayback = null;
  let playerIdentity = "", playerShell = null, playerFrame = null, playerEndedIdentity = "";
  let videoLoadObserver = null;
  let setupCustomizeOpen = false;
  let feedCustomizeOpen = false;
  let topicSearchExpansionSuppressed = false;
  const topicSearchExpansionOverrides = new Map();
  let youtubeSyncActive = false;
  let youtubeSyncToken = 0;
  let youtubeSearchToken = 0;
  let searchInterpretToken = 0;
  let searchInterpretTimer = null;
  let searchInterpretRequest = null;
  let youtubeSearchRequests = [];
  let imageHydrationEpoch = 0;
  let imageHydrationActive = false;
  const imageHydrationQueue = [];
  const imageHydrationQueued = new Set();
  const imageHydrationRequests = new Map();
  const semanticSearchCache = createSessionCache(100, 30 * 60 * 1000);
  const youtubeSmartSearchCache = createSessionCache(100, 30 * 60 * 1000);
  const learningResponseCache = createSessionCache(100, 30 * 60 * 1000);
  const NATURAL_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "how", "i", "in", "into", "is", "it", "of", "on", "or", "the", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with"]);

  function makeTopics() { return shared.createCatalogTopics(); }
  function factAngleOption(id) { return factAngleOptions.find(function (option) { return option.id === id; }) || factAngleOptions[0] || { id: "varied", label: "Varied", description: "Keep the usual mix of distinct, specific facts.", instruction: "Use the existing varied selection of distinct, specific facts." }; }
  function clearFactAngleBatch() { activeFactBatch = null; selectedFactAngle = "varied"; state.activeGenerationSlotIds = []; }
  function endFactAngleBatch() { clearFactAngleBatch(); }
  function buildTopicNode(seed, parentPath, depth, rootIndex) {
    const label = String(typeof seed === "string" ? seed : titleCaseCatalogLabel(seed.label)).replace(/\s+/g, " ").trim();
    if (!label) return null;
    const path = parentPath.concat(label);
    const children = typeof seed === "string" ? undefined : (seed.children || []).map(function (child) { return buildTopicNode(child, path, depth + 1, rootIndex); }).filter(Boolean);
    return { id: "topic-" + path.map(slug).join("--"), label: label, aliases: typeof seed === "string" ? undefined : seed.aliases, selected: false, expanded: false, weight: 10, children: children };
  }
  function titleCaseCatalogLabel(label) {
    const small = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
    const normalized = String(label).replace(/\s+/g, " ").trim();
    const scientificName = normalized.match(/^([A-Z][a-z]+) ([a-z][a-z-]+)(?:\s|$)/);
    if (scientificName && ["Ardipithecus", "Australopithecus", "Homo", "Kenyanthropus", "Orrorin", "Paranthropus", "Sahelanthropus"].indexOf(scientificName[1]) >= 0) return normalized;
    const words = normalized.split(/(\s+)/);
    const indexes = words.map(function (word, index) { return /^\s+$/.test(word) ? -1 : index; }).filter(function (index) { return index >= 0; });
    const first = indexes[0]; const last = indexes[indexes.length - 1];
    return words.map(function (word, index) {
      if (!word.trim()) return word;
      if (/^[A-Z0-9][A-Z0-9.+/#-]*$/.test(word) || /[a-z].*[A-Z]/.test(word)) return word;
      const lower = word.toLowerCase();
      if (index === first || index === last) return lower.charAt(0).toUpperCase() + lower.slice(1);
      if (small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join("");
  }
  function slug(value) {
    return String(value).toLowerCase().trim()
      .replace(/c\+\+/g, "c-plus-plus")
      .replace(/c#/g, "c-sharp")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "topic";
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function icon(name, size) {
    const paths = {
      compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
      sparkles: '<path d="m12 3-1.2 4.2L7 8.5l3.8 1.3L12 14l1.2-4.2L17 8.5l-3.8-1.3L12 3Z"/><path d="m19 14-.6 2.1-1.9.9 1.9.9.6 2.1 1.9-.9 1.9.9-.6-2.1.6-2.1-1.9.9-1.9-.9Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      chevronDown: '<path d="m6 9 6 6 6-6"/>',
      chevronRight: '<path d="m9 18 6-6-6-6"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2"/>',
      shield: '<path d="M12 3 5 6v5c0 4.5 2.8 8.1 7 10 4.2-1.9 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
      settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m4.9 4.9 1.5 1.5m11.2-1.5-1.5 1.5M4 12H2m20 0h-2M4.9 19.1l1.5-1.5m11.2 1.5 1.5-1.5M12 4V2m0 20v-2"/>',
      home: '<path d="m3 11 9-8 9 8v9H3v-9Z"/><path d="M9 20v-6h6v6"/>',
      bookmark: '<path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-3-6 3V4Z"/>',
      heart: '<path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.6 4.6 0 0 1 12 6.1a4.6 4.6 0 0 1 8.8 2.7Z"/>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
      external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
      more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      login: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
      reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
      trash: '<path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14"/>',
      smartphone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.2.8-1.5 1.2-1.5 2.5M12 17h.01"/>',
      message: '<path d="M4 5h16v11H8l-4 4V5Z"/>'
      ,panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>'
    };
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || "") + "</svg>";
  }
  function node(tag, attributes) {
    const element = document.createElement(tag);
    const attrs = attributes || {};
    Object.keys(attrs).forEach(function (key) {
      const value = attrs[key];
      if (value === null || value === undefined || (value === false && !key.startsWith("aria"))) return;
      if (key === "className") element.className = value;
      else if (key === "text") element.textContent = normalizeUiCopy(value);
      else if (key === "html") element.innerHTML = value;
      else if (key === "onClick") element.addEventListener("click", value);
      else if (key === "onInput") element.addEventListener("input", value);
      else if (key === "onFocus") element.addEventListener("focus", value);
      else if (key === "onFocusCapture") element.addEventListener("focusin", value);
      else if (key === "onBlur") element.addEventListener("blur", value);
      else if (key === "onChange") element.addEventListener("change", value);
      else if (key === "onKeydown") element.addEventListener("keydown", value);
      else if (key === "disabled") element.disabled = Boolean(value);
      else if (key === "value") element.value = value;
      else if (key === "checked") element.checked = Boolean(value);
      else if (key === "ariaSelected") element.setAttribute("aria-selected", String(Boolean(value)));
      else if (key === "ariaLabel") element.setAttribute("aria-label", value);
      else if (key === "ariaExpanded") element.setAttribute("aria-expanded", String(Boolean(value)));
      else if (key === "ariaControls") element.setAttribute("aria-controls", value);
      else if (key === "ariaPressed") element.setAttribute("aria-pressed", String(Boolean(value)));
      else if (key === "dataset") Object.keys(value).forEach(function (dataKey) { element.dataset[dataKey] = value[dataKey]; });
      else element.setAttribute(key, value);
    });
    for (let index = 2; index < arguments.length; index += 1) {
      const child = arguments[index];
      if (child === null || child === undefined || child === false) continue;
      element.appendChild(typeof child === "string" ? document.createTextNode(normalizeUiCopy(child)) : child);
    }
    return element;
  }
  function svg(name, size) {
    return node("span", { className: "icon", html: icon(name, size) });
  }
  const PERIOD_FREE_UI_COPY = new Set([
    "The metadata supports this search.",
    "Try another phrase, topic, or channel. Search stays inside the approved collection.",
    "A calmer way to find something good.",
    "Discover approved creators, search their imported catalogs, and watch without leaving your workspace.",
    "Paste your own YouTube Data API key in Settings. The catalog stays limited to approved creators and videos.",
    "Pick the subjects you want to see; you can change them anytime",
    "New choices shape the next batch.",
    "Choose at least one topic from the checklist to begin.",
    "Add your API key in Settings for the next batch",
    "One small idea at a time. Every card has a place to look next.",
    "Keep going.",
    "Make the feed feel like yours.",
    "Settings stay calm, clear, and close to the experience they shape.",
    "Use Gemini for fresh facts, Learn more, and questions.",
    "Your key is remembered in this Mac’s Keychain and privately synced when you sign in with Google. Remove also clears it from your account.",
    "Create or copy one in Google AI Studio, then paste it here.",
    "Use your own YouTube Data API key for the approved video library.",
    "Your YouTube key is remembered in this Mac’s Keychain and privately synced when you sign in with Google.",
    "Website keys may be restricted to the GitHub Pages site. The Mac app needs a key that permits native requests. Google will report restriction failures clearly.",
    "Google sign-in keeps your account ready on this Mac.",
    "Google sign-in is wired to the Learned Media Supabase project. Enable Google in its Auth provider settings to use it.",
    "Choose the atmosphere you want to return to.",
    "Clear the slate.",
    "Feed reset is gentle. These controls affect the rest of your saved workspace.",
    "Your Gemini credential is stored in this Mac’s Keychain. Learning data stays on this Mac until you clear it.",
    "Keep the ideas that made you pause.",
    "Nothing here yet."
  ]);
  function normalizeUiCopy(value) {
    if (typeof value !== "string" || !value.endsWith(".")) return value;
    if (PERIOD_FREE_UI_COPY.has(value) || /^Your (saved|likes|history) discoveries\.$/.test(value) || /^As you explore, your (saved|likes|history) facts will appear here\.$/.test(value) || /^\d+ topics in your mix, sourced from Wikipedia and shaped by your curiosity\.$/.test(value)) return value.slice(0, -1);
    return value;
  }
  function createSessionCache(maxEntries, ttlMs) {
    return new window.LEARNED_MEDIA_CACHE.SessionCache(maxEntries, ttlMs);
  }
  function scopedCacheKey(secret, parts) {
    const text = String(secret || "") + "\u0000" + JSON.stringify(parts);
    let left = 2166136261, right = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) { left = Math.imul(left ^ text.charCodeAt(index), 16777619); right = Math.imul(right ^ text.charCodeAt(index), 2246822519); }
    return (left >>> 0).toString(16) + (right >>> 0).toString(16);
  }
  function clearSessionSearchCaches() {
    semanticSearchCache.clear(); youtubeSmartSearchCache.clear(); learningResponseCache.clear();
    cancelPendingSemanticSearch(); topicResultCache.clear(); topicAttempt = "";
  }
  function bridge(action, payload) {
    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.native) {
      return Promise.reject(new Error("The native application bridge is unavailable."));
    }
    const id = "r" + (++requestID);
    const task = new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject, workspace:state.workspaceId,epoch:generationToken,keyEpoch:state.keyEditEpoch });
      window.webkit.messageHandlers.native.postMessage({ id: id, action: action, payload: payload || {} });
    });
    task.cancel = function () { if (pending.has(id)) bridge("cancelRequest", { taskId: id }).catch(function () {}); };
    return task;
  }
  window.__learnedMediaNativeRequest = bridge;
  window.__nativeResolve = function (message) {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.ok) item.resolve(message.result);
    else item.reject(new Error(message.error || "The request failed."));
  };
  window.__nativeEvent = function (message) {
    if (message && message.type === "exportProgress" && message.token === downloadJobToken) { downloadStatus = message.message; render(); return; }
    if (!message || (message.token !== undefined && message.type === "modelCheck" && message.token !== state.connectionToken)) return;
    if (message.type === "generationStatus" && message.token === state.generationRequestToken) {
      mergeGeminiModelOutcomes(message.modelOutcomes || []);
      if (message.status) state.geminiStatus = message.status;
      render();
      return;
    }
    if (message.type === "operationStatus") {
      const owner=pending.get(message.requestId);
      if(!owner || owner.workspace!==state.workspaceId || owner.epoch!==generationToken || owner.keyEpoch!==state.keyEditEpoch)return;
      mergeGeminiModelOutcomes(message.modelOutcomes || []);
      if (message.status) state.geminiStatus = message.status;
      render();
      return;
    }
    if (message.type === "modelCheck" && state.modelChecking) {
      const check = message.check;
      if (check && check.model) {
        const next = state.modelChecks.filter(function (item) { return item.model !== check.model; });
        next.push(check);
        next.sort(function (left, right) { return ALLOWED_GEMINI_MODELS.indexOf(left.model) - ALLOWED_GEMINI_MODELS.indexOf(right.model); });
        state.modelChecks = next;
      }
      if (Number(message.readyCount) >= REQUIRED_WORKING_MODELS) state.geminiStatus = "connected";
      render();
      return;
    }
    if (message.type === "generationCard" && message.token === state.generationRequestToken && state.started) {
      const raw = message.card;
      const assignment = message.detourId && Number.isInteger(message.detourSlot) ? { id: message.detourId, slot: message.detourSlot } : undefined;
      if (!acceptNewFact(raw, state.activeGenerationSentenceLength, assignment, message.slotId, message.slot)) return;
      saveState();
      render();
      if (assignment) requestAnimationFrame(function () {
        if (state.topicDetour && state.topicDetour.id === assignment.id) checkNativeTopicDetourProgress();
      });
    }
  };
  function flatTopics(nodes, parentPath) { return shared.flattenTopics(nodes || state.topics, parentPath || []); }
  function findTopic(id) { return shared.findTopicById(state.topics, id); }
  function selectedTopics() { return shared.selectedLeafTopics(state.topics).map(function(topic){return {path:topic.path,weight:topic.weight};}); }
  function selectionState(topic) { return shared.selectionState(topic); }
  function setBranchSelected(topic, selected) { return Object.assign({}, topic, {selected:selected,children:topic.children && topic.children.map(function(child){return setBranchSelected(child,selected);})}); }
  function toggleTopicSelection(id) { state.topics = shared.toggleTopicSelection(state.topics,id); }
  function selectedSummary() { return shared.summarizeSelection(state.topics); }
  function selectedCount() { return shared.selectedLeafCount(state.topics); }
  function weightedTopicPaths(limit) { return shared.selectWeightedTopicPaths(state.topics,limit || 10).map(function(topic){return Object.assign({},topic,{difficulty:difficultyEngine.getTopicLearningProfile(state.profile,topic.path,state.settings.obscurity).targetDifficulty});}); }
  function updateTopicById(nodes,id,update) { return shared.updateTopicTreeById(nodes,id,update); }
  function removeTopicById(nodes,id) { return shared.removeTopicTree(nodes,id); }
  function migrateTopics(saved,collapseInitial,migrateLegacyRootWeights) { return shared.migrateTopicTree(saved,collapseInitial,migrateLegacyRootWeights); }
  function difficultyLabel(value) { return DIFFICULTY_LABELS[Math.max(1, Math.min(10, Number(value) || 5))]; }
  function wikiURL(title) { return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/\s+/g, "_")); }
  function clearTopicDetourCompletionNotice() {
    if (topicDetourCompletionTimer !== null) window.clearTimeout(topicDetourCompletionTimer);
    topicDetourCompletionTimer = null;
    topicDetourCompletionNotice = "";
  }
  function showToast(message) {
    state.toast = message || "";
    render();
    if (message) window.setTimeout(function () { if (state.toast === message) { state.toast = ""; render(); } }, 4200);
  }
  function requestConfirmation(title, message, confirmLabel, action) {
    state.confirmation = { title: title, message: message, confirmLabel: confirmLabel, action: action };
    render();
  }
  function closeConfirmation() {
    if (!state.confirmation) return;
    state.confirmation = null;
    render();
  }
  function confirmPendingAction() {
    const request = state.confirmation;
    state.confirmation = null;
    render();
    if (request && request.action) request.action();
  }
  function youtubeActivity(workspace) {
    const source = workspace || state.youtube;
    return { savedIds: source.savedIds || [], history: source.history || [], playbackPositions: source.playbackPositions || {}, searchText: source.searchText || "", smartIds: source.smartIds || null, smartReasons: source.smartReasons || {}, smartRan: Boolean(source.smartRan), topic: source.topic || "All", tab: source.tab || "discover", selectedChannelId: source.selectedChannelId || null, selectedVideoId: source.selectedVideoId || null, discoverIds: source.discoverIds || [], order: source.order || "newest", prioritizeRecentByChannel: Object.assign({}, window.LEARNED_MEDIA_YOUTUBE.DEFAULT_RECENCY_PREFERENCES || {}, source.prioritizeRecentByChannel || {}) };
  }
  function applyYoutubeActivity(activity, legacyPreferences) {
    const source = activity || {};
    const mapped = Object.assign({}, source, {
      topic: source.selectedTopic || source.topic || "All",
      tab: source.activeTab || source.tab || "discover",
      order: source.channelOrder || source.order || "newest",
      savedIds: source.savedIds || [], history: source.history || [], playbackPositions: source.playbackPositions || {},
      searchText: source.searchText || "", smartIds: source.smartIds || null, smartReasons: source.smartReasons || {}, smartRan: Boolean(source.smartRan),
      selectedChannelId: source.selectedChannelId || null, selectedVideoId: source.selectedVideoId || null, discoverIds: source.discoverIds || [],
      prioritizeRecentByChannel: Object.assign({}, window.LEARNED_MEDIA_YOUTUBE.DEFAULT_RECENCY_PREFERENCES || {}, legacyYoutubeRecencyPreferences, legacyPreferences || {}, source.prioritizeRecentByChannel || {})
    });
    state.youtube = Object.assign({}, state.youtube, mapped);
  }
  function mergeNativePlaybackCheckpoints(records, ownerID, savedCheckpoints) {
    return (records || []).map(function(record){
      const workspaceID=String(record.id||"");
      const originalState=record.state||{};
      const legacy=originalState.youtube&&typeof originalState.youtube==="object"?originalState.youtube:{};
      const canonical=originalState.youtubeActivity&&typeof originalState.youtubeActivity==="object"?originalState.youtubeActivity:{};
      const activity=shared.youtube.mergeYouTubeActivity(legacy,canonical);
      const key=ownerID+"\u0000"+workspaceID;
      const persisted=savedCheckpoints&&savedCheckpoints[workspaceID];
      const live=youtubeLivePlaybackCheckpoints.get(key);
      const checkpoint=live&&(!persisted||Number(live.updatedAt)>=Number(persisted.updatedAt))?live:persisted;
      if(!Object.keys(activity).length&&!checkpoint)return record;
      if(checkpoint&&typeof checkpoint.videoID==="string"&&Number.isFinite(Number(checkpoint.seconds))&&Number(checkpoint.seconds)>=0&&Number(checkpoint.seconds)<=86400){
        activity.playbackPositions=Object.assign({},activity.playbackPositions||{},{[checkpoint.videoID]:Math.floor(Number(checkpoint.seconds))});
      }
      return Object.assign({},record,{state:Object.assign({},originalState,{youtubeActivity:activity})});
    });
  }
  function currentWorkspaceSnapshot() {
    return { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: new Date().toISOString(), topics: state.topics, settings: Object.assign({}, state.settings, { sentenceLength: normalizeSentenceLength(state.settings.sentenceLength) }), cards: state.cards, profile: state.profile, started: state.started, youtubeActivity: youtubeActivity(), lastCompletedBatchSetup: batchReplay.isBatchSetup(state.lastCompletedBatchSetup) ? state.lastCompletedBatchSetup : undefined };
  }
  function activeWorkspaceRecord() {
    const existing = state.workspaces.find(function (item) { return item.id === state.workspaceId; });
    if (existing) return existing;
    const now = new Date().toISOString();
    const created = { id: state.workspaceId, name: state.workspaceName, createdAt: now, updatedAt: now, state: currentWorkspaceSnapshot() };
    state.workspaces.push(created);
    return created;
  }
  function memoryOf(card) {
    return normalizeMemory({ id: card.id, title: card.title, hook: card.hook, body: card.body, claim: card.claim, topicPath: card.topicPath || [], sources: card.sources || [], evidence: card.evidence || [], known: Boolean(card.known || card.feedback === "heard") });
  }
  function archiveFacts(cards) {
    // Ordinary settings/activity saves need not re-archive unchanged cards.
    const changedCards = cards.filter(function (card) {
      const fields = [card.id, card.title, card.hook, card.body, card.claim, card.topicPath, card.sources, card.evidence, Boolean(card.known || card.feedback === "heard")];
      const previous = archivedFactCards.get(card);
      if (previous && fields.every(function (value, index) { return value === previous[index]; })) return false;
      archivedFactCards.set(card, fields);
      return true;
    });
    if (!changedCards.length) return;
    const previousHistory = state.factMemory;
    const map = new Map();
    // Preserve wording variants as separate historical records; only the same saved ID is an update.
    state.factMemory.forEach(function (item) { map.set(item.id || item.fingerprint, item); });
    const changedIds = new Set();
    changedCards.forEach(function (card) { const item = memoryOf(card); const key = item.id || item.fingerprint; const previous = map.get(key); item.known = item.known || Boolean(previous && previous.known); const merged = Object.assign({}, previous || {}, item); map.set(key, merged); changedIds.add(merged.id); });
    state.factMemory = Array.from(map.values());
    if (trackedFactMemory === previousHistory) {
      const retained = new Set(state.factMemory.map(function (item) { return item.id; }));
      factMemoryById.forEach(function (_, id) { if (!retained.has(id)) { factMemoryById.delete(id); changedFactMemoryIds.delete(id); } });
      state.factMemory.forEach(function (item) { if (changedIds.has(item.id)) { factMemoryById.set(item.id, item); changedFactMemoryIds.add(item.id); } });
      trackedFactMemory = state.factMemory;
    }
  }
  function repeatedFact(card) {
    if (!factNovelty || typeof factNovelty.FactNoveltyIndex !== "function") return false;
    if (factNoveltyIndexSource !== state.factMemory) {
      factNoveltyIndex = new factNovelty.FactNoveltyIndex(state.factMemory || []);
      factNoveltyIndexSource = state.factMemory;
    }
    const item = memoryOf(card);
    if (activeFactBatch && activeFactBatch.replayNoveltyIndex && activeFactBatch.replayNoveltyIndex.findDuplicate(item)) return true;
    return Boolean(factNoveltyIndex.findDuplicate(item));
  }
  function acceptNewFact(raw, expectedSentenceLength, detourAcceptance, suppliedSlotId, suppliedSlotIndex) {
    const batch = activeFactBatch;
    if (!batch || batch.workspaceId !== state.workspaceId || batch.accountId !== (state.account && state.account.id || null)) return false;
    const slotId = suppliedSlotId || batch.requestSlotIds && batch.requestSlotIds[suppliedSlotIndex];
    if (!slotId || !batch.requestSlotIds || batch.requestSlotIds.indexOf(slotId) < 0 || !batch.setup.slots.some(function (slot) { return slot.id === slotId; }) || batch.accepted[slotId] || Object.keys(batch.accepted).some(function (key) { return batch.accepted[key] === (raw && raw.id); })) return false;
    const source = batch.replay ? Object.assign({}, raw, { displayModeOverride: batch.setup.settings.displayMode }) : raw;
    if (!source || !source.id || !source.body || !hasExactSentenceCount(source.body, expectedSentenceLength === undefined ? batch.setup.settings.sentenceLength : expectedSentenceLength) || repeatedFact(source)) return false;
    const card = normalizeCard(source);
    const detour = detourAcceptance && state.topicDetour && state.topicDetour.id === detourAcceptance.id ? state.topicDetour : null;
    if (detour) {
      const acceptedDetour = topicDetours.acceptTopicDetourCard(detour, detourAcceptance.slot, card.id);
      if (acceptedDetour === detour) return false;
      if (!pendingTopicDetourAnchor) {
        const root = document.querySelector(".main-scroll");
        const rootTop = root && /auto|scroll/.test(getComputedStyle(root).overflowY) ? Math.max(0,root.getBoundingClientRect().top) : 0;
        const rootBottom = root && /auto|scroll/.test(getComputedStyle(root).overflowY) ? Math.min(window.innerHeight,root.getBoundingClientRect().bottom) : window.innerHeight;
        const visibleCard = root && Array.from(root.querySelectorAll("[data-card-id]")).find(function (element) { var bounds = element.getBoundingClientRect(); return bounds.bottom > rootTop && bounds.top < rootBottom; });
        if (visibleCard && visibleCard.dataset.cardId) pendingTopicDetourAnchor = { workspaceId: detour.workspaceId, cardId: visibleCard.dataset.cardId, top: visibleCard.getBoundingClientRect().top };
      }
      archiveFacts([card]);
      state.topicDetour = acceptedDetour;
      state.cards = topicDetours.orderTopicDetourCards(state.cards, state.topicDetour, card);
    } else { archiveFacts([card]); state.cards.push(card); }
    batch.accepted[slotId] = card.id;
    state.batchAccepted += 1;
    return true;
  }
  function saveState() {
    archiveFacts(state.cards);
    const snapshot = currentWorkspaceSnapshot();
    const record = activeWorkspaceRecord();
    record.name = state.workspaceName;
    record.updatedAt = snapshot.savedAt;
    record.state = snapshot;
    const envelope = { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: snapshot.savedAt, activeWorkspaceId: state.workspaceId, workspaces: state.workspaces.map(function(record){return Object.assign({},record,{state:Object.assign({},record.state,{topics:Array.isArray(record.state.topics)?shared.compactTopicPreferences(record.state.topics):record.state.topics})});}), factMemory: state.factMemory, account: state.account, cloudOwnerId: state.cloudOwnerId, theme: document.body.classList.contains("theme-dark") ? "dark" : "light" };
    if (!window.LEARNED_MEDIA_STORAGE.validateSnapshot(envelope, "native-store", "save")) { state.toast = "Workspace data failed validation. The last valid recovery copy was kept."; return; }
    queuedWorkspaceState = envelope;
    try { window.LEARNED_MEDIA_STORAGE.writeRecoverySnapshot(window.localStorage, LOCAL_WORKSPACE_KEY, LOCAL_WORKSPACE_KEY + "-backup", envelope, "native-store"); } catch (_) {}
    clearTimeout(workspaceSaveTimer);workspaceSaveTimer=setTimeout(flushWorkspaceSave,300);
    scheduleCloudSave();
  }
  let workspaceSaveTimer=null;
  function flushWorkspaceSave() {
    if (saveInFlight || !queuedWorkspaceState) return;
    const snapshot = queuedWorkspaceState;
    queuedWorkspaceState = null;
    saveInFlight = true;
    bridge("saveState", { state: snapshot }).catch(function (error) {
      state.toast = error.message || "Local workspace could not be saved.";
    }).then(function () {
      saveInFlight = false;
      if (queuedWorkspaceState) flushWorkspaceSave();
    });
  }
  function mergeWorkspaceRecords(local, remote) {
    const map = new Map((local || []).map(function (record) { return [record.id, record]; }));
    (remote || []).forEach(function (record) {
      const previous = map.get(record.id);
      if (!previous || String(record.updatedAt || "") > String(previous.updatedAt || "")) map.set(record.id, record);
    });
    return Array.from(map.values());
  }
  function mergeFactMemories(local, remote) {
    const map = new Map();
    (local || []).concat(remote || []).forEach(function (raw) {
      const item = normalizeMemory(raw);
      const key = item.fingerprint || item.id;
      const previous = map.get(key);
      map.set(key, Object.assign({}, previous || {}, item, { fingerprint: item.fingerprint || (previous && previous.fingerprint) || key, known: Boolean((previous && previous.known) || item.known) }));
    });
    return Array.from(map.values());
  }
  function emptyCloudWorkspace() {
    const now = new Date().toISOString();
    return { id: "local-workspace", name: "Local Workspace", createdAt: now, updatedAt: now, state: { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: now, topics: makeTopics(), settings: Object.assign({}, DEFAULT_SETTINGS), cards: [], profile: {}, started: false, youtubeActivity: youtubeActivity({ savedIds: [], history: [], playbackPositions: {}, searchText: "", smartIds: null, smartReasons: {}, smartRan: false, topic: "All", tab: "discover", selectedChannelId: null, selectedVideoId: null, discoverIds: [], order: "newest" }) } };
  }
  function createCloudUploadQueue() {
    return new window.LEARNED_MEDIA_SNAPSHOTS.LatestSnapshotQueue(async function (snapshot) {
      if (snapshot.token !== cloudSyncToken || !state.account || state.account.id !== snapshot.ownerId) throw new Error("Account changed. Cloud save was canceled.");
      if (!snapshot.payload) {
        // Materialize only when this snapshot is sent. Superseded waiting saves
        // never serialize the catalog or scan fact memory.
        if (trackedFactMemory !== state.factMemory) {
          factMemoryById = new Map(state.factMemory.map(function (item) { return [item.id, item]; }));
          changedFactMemoryIds = new Set(factMemoryById.keys());
          trackedFactMemory = state.factMemory;
        }
        const changedMemories = [];
        changedFactMemoryIds.forEach(function (id) {
          const value = factMemoryById.get(id);
          if (!value) { changedFactMemoryIds.delete(id); return; }
          const item = normalizeMemory(value), key = item.fingerprint || item.id, serialized = JSON.stringify(item);
          if (sentFactMemories.get(key) === serialized) { changedFactMemoryIds.delete(id); return; }
          changedMemories.push({ id: id, value: value, item: item, key: key, serialized: serialized });
        });
        snapshot.payload = JSON.stringify({ persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: new Date().toISOString(), activeWorkspaceId: state.workspaceId, workspaces: state.workspaces.map(function(record){ if(Array.isArray(record.state?.topics))return record;return Object.assign({},record,{state:Object.assign({},record.state,{topics:shared.restoreTopicPreferences(record.state?.topics)})}); }), factMemory: changedMemories.map(function (entry) { return entry.item; }), account: state.account, cloudOwnerId: state.cloudOwnerId, theme: document.body.classList.contains("theme-dark") ? "dark" : "light" });
        snapshot.changedMemories = changedMemories;
      }
      // Retain the exact payload for idempotent retries; edits cannot mutate it.
      const result = await bridge("cloudSave", { state: JSON.parse(snapshot.payload) });
      if (snapshot.token !== cloudSyncToken || state.account?.id !== snapshot.ownerId) return;
      if (result?.mergedRecords?.length) {
        result.mergedRecords.forEach(function (record) { window.LEARNED_MEDIA_STORAGE.assertSnapshot(record, "record", "import"); });
        let checkpoints = {};
        try {
          checkpoints = await bridge("loadYouTubePlaybackCheckpoints", { ownerID: snapshot.ownerId,
            workspaceIDs: result.mergedRecords.map(function (record) { return record.id; }) }) || {};
        } catch (_) {}
        if (snapshot.token !== cloudSyncToken || state.account?.id !== snapshot.ownerId) return;
        const previous = state.workspaces.find(function (record) { return record.id === state.workspaceId; });
        state.workspaces = mergeNativePlaybackCheckpoints(mergeWorkspaceRecords(state.workspaces, result.mergedRecords), snapshot.ownerId, checkpoints);
        const active = state.workspaces.find(function (record) { return record.id === state.workspaceId; });
        if (active && previous && active.updatedAt > previous.updatedAt) applyWorkspaceSnapshot(active, true);
        saveState();
        render();
      }
      snapshot.changedMemories.forEach(function (entry) {
        sentFactMemories.set(entry.key, entry.serialized);
        if (factMemoryById.get(entry.id) === entry.value) changedFactMemoryIds.delete(entry.id);
      });
    });
  }
  function scheduleCloudSave() {
    if (!state.account || !state.cloudSyncReady) return;
    if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
    const enqueueSave = function () {
      cloudSaveTimer = null;
      if (!state.account || !state.cloudSyncReady || state.cloudOwnerId !== state.account.id) return;
      const token = cloudSyncToken;
      const ownerId = state.account.id;
      const uploads = cloudUploads;
      const revision = ++cloudSaveRevision;
      state.syncStatus = "syncing";
      state.syncError = "";
      uploads.enqueue({ token: token, ownerId: ownerId }).then(function () {
        if (token !== cloudSyncToken || revision !== cloudSaveRevision || state.account?.id !== ownerId || uploads.hasUnacknowledged) return;
        state.syncStatus = nativeKeySyncError ? "error" : "synced";
        state.syncError = nativeKeySyncError;
        render();
      }).catch(function (error) {
        if (token !== cloudSyncToken || revision !== cloudSaveRevision || state.account?.id !== ownerId) return;
        state.syncStatus = navigator.onLine === false ? "offline" : "error";
        state.syncError = error.message || "Cloud sync could not save this Mac.";
        render();
      });
    };
    if (cloudUploads.isWriting) enqueueSave();
    else cloudSaveTimer = window.setTimeout(enqueueSave, 700);
  }
  async function syncCloudAccount() {
    if (!state.account || !state.account.id) return;
    const token = ++cloudSyncToken;
    cloudUploads = createCloudUploadQueue();
    state.cloudSyncReady = false;
    trackedFactMemory = null;
    sentFactMemories.clear();
    state.syncStatus = "syncing";
    state.syncError = "";
    render();
    try {
      const remote = await bridge("cloudLoad", {});
      if (token !== cloudSyncToken || !state.account) return;
      (remote.records || []).forEach(function (record) { window.LEARNED_MEDIA_STORAGE.assertSnapshot(record, "record", "import"); });
      (remote.factMemory || []).forEach(function (raw) { const item = normalizeMemory(raw); sentFactMemories.set(item.fingerprint || item.id, JSON.stringify(item)); });
      const ownerID=state.account.id;
      const checkpointWorkspaces=(state.workspaces||[]).concat(remote.records||[]);
      let checkpoints={};
      try{checkpoints=await bridge("loadYouTubePlaybackCheckpoints",{ownerID:ownerID,workspaceIDs:Array.from(new Set(checkpointWorkspaces.map(function(record){return String(record.id||"");}).filter(Boolean))).slice(0,250)})||{};}catch(_){checkpoints={};}
      if(token!==cloudSyncToken||!state.account||state.account.id!==ownerID)return;
      const compatible = !state.cloudOwnerId || state.cloudOwnerId === state.account.id;
      const localWorkspaces = compatible ? state.workspaces : [];
      const localMemory = compatible ? state.factMemory : [];
      state.workspaces = mergeNativePlaybackCheckpoints(mergeWorkspaceRecords(localWorkspaces, remote.records || []),ownerID,checkpoints);
      if (!state.workspaces.length) state.workspaces = [emptyCloudWorkspace()];
      state.factMemory = mergeFactMemories(localMemory, remote.factMemory || []);
      state.cloudOwnerId = state.account.id;
      const active = state.workspaces.find(function (record) { return record.id === state.workspaceId; }) || state.workspaces[0];
      applyWorkspaceSnapshot(active);
      state.workspaces = state.workspaces.map(function (record) { return record.id === active.id ? Object.assign({}, record, { state: currentWorkspaceSnapshot() }) : record; });
      state.cloudSyncReady = true;
      state.syncStatus = nativeKeySyncError ? "error" : "synced";
      state.syncError = nativeKeySyncError;
      saveState();
      render();
    } catch (error) {
      if (token !== cloudSyncToken) return;
      state.syncStatus = navigator.onLine === false ? "offline" : "error";
      state.syncError = error.message || "Cloud sync could not load this account.";
      render();
    }
  }
  function normalizeCard(card, index) {
    const first = card.sources && card.sources[0] ? card.sources[0] : { title: card.sourceTitle || "Wikipedia", url: card.sourceUrl || wikiURL(card.sourceTitle || card.title) };
    const storedSources = card.sources && card.sources.length ? card.sources : [first];
    const linkedSources = storedSources.map(function (source, sourceIndex) {
      const url = String(source.url || wikiURL(source.title || "Wikipedia"));
      const canonicalUrl = source.canonicalUrl || url.split("#")[0];
      const quote = (card.evidence || []).find(function (item) { return item.sourceIndex === sourceIndex; });
      return quote && quote.quote && url.indexOf("#:~:text=") < 0 ? Object.assign({}, source, { canonicalUrl: canonicalUrl, url: wikipediaEvidenceLink(canonicalUrl, quote.quote) }) : source;
    });
    const references = sourceSpotlight.normalizeSpotlightSources(linkedSources, card.evidence || [], 3);
    const image = card.image || (card.imageUrl ? { url: card.imageUrl, alt: card.title, sourceTitle: first.title, sourceUrl: first.url, filePageUrl: first.url, credit: "Wikipedia image" } : null);
    const hook = titleCaseCatalogLabel(String(card.hook || card.title || "A small fact worth keeping").trim().replace(/\.+$/, ""));
    const normalized = Object.assign({
      id: "card-" + Date.now() + "-" + index,
      title: "",
      hook: "",
      body: "",
      topicPath: [],
      difficulty: 5,
      sentenceCount: normalizeSentenceLength(card.sentenceCount),
      accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5],
      createdAt: new Date().toISOString()
    }, card, { sources: references.sources, evidence: references.evidence, image: image, hook: hook });
    if (card.displayModeOverride !== "text" && card.displayModeOverride !== "picture-text") normalized.displayModeOverride = undefined;
    const answerStructure = window.LEARNED_MEDIA_ANSWER_STRUCTURE;
    normalized.answerPresentation = answerStructure && answerStructure.normalizeSavedAnswerPresentation(card.answerPresentation);
    normalized.answerStructure = normalized.answerPresentation && normalized.answerPresentation.structure || (answerStructure && answerStructure.normalizeResolvedAnswerStructure(card.answerStructure));
    normalized.explanations = cardExplanations.normalizeCardExplanations(normalized);
    normalized.glossary = cardGlossary.normalizeCardGlossary(normalized);
    normalized.chronology = cardChronology.createSavedCardChronology(normalized.chronology, normalized) || cardChronology.normalizeSavedCardChronology(normalized);
    normalized.locations = cardLocations.createSavedCardLocations(normalized.locations, normalized);
    normalized.followUpQuestions = Array.isArray(card.followUpQuestions)
      ? cardFollowUps.createSavedFollowUpQuestions(card.followUpQuestions, normalized)
      : cardFollowUps.normalizeSavedFollowUpQuestions(card.followUpQuestions, normalized);
    normalized.learnMoreSources = Array.isArray(card.learnMoreSources) ? card.learnMoreSources : card.learnMore && !card.answer ? (card.answerSources || undefined) : undefined;
    return normalized;
  }
  function wikipediaEvidenceLink(url, quote) {
    const text = String(quote || "").replace(/^\[Section:[^\]]+\]\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (text.length < 30) return url;
    return url.split("#")[0] + "#:~:text=" + encodeURIComponent(text);
  }
  function externalLink(url, label, className) {
    const link = node("a", { className: className || "source-link", href: url, target: "_blank", rel: "noreferrer" }, label, svg("external", 11));
    link.addEventListener("click", function (event) {
      event.preventDefault();
      bridge("openURL", { url: url }).catch(function (error) { showToast(error.message); });
    });
    return link;
  }
  function nativeSpotlightKey(card) { return state.workspaceId + "\u0000" + card.id; }
  function storeNativeSpotlightState(key, value) {
    sourceSpotlightStates.delete(key);
    sourceSpotlightStates.set(key, value);
    while (sourceSpotlightStates.size > 500) sourceSpotlightStates.delete(sourceSpotlightStates.keys().next().value);
  }
  function nativeSpotlightPanelId(card, model, sentenceIndex) {
    return "source-spotlight-" + String(card.id).replace(/[^a-zA-Z0-9_-]/g, "-") + "-" + (model.mapped ? sentenceIndex : "whole");
  }
  function nativeSpotlightSentenceForSource(model, current, sourceIndex) {
    if (current && current.sentenceIndex >= 0 && model.groups[current.sentenceIndex] && model.groups[current.sentenceIndex].some(function (group) { return group.sourceIndex === sourceIndex; })) return current.sentenceIndex;
    const index = model.groups.findIndex(function (groups) { return groups.some(function (group) { return group.sourceIndex === sourceIndex; }); });
    return index >= 0 ? index : 0;
  }
  function handleNativeSpotlightEscape(event, card) {
    if (event.key !== "Escape" || !sourceSpotlightStates.has(nativeSpotlightKey(card))) return;
    event.preventDefault();
    closeNativeSpotlight(card);
  }
  function safeCardElementId(cardID) { return String(cardID || "card").replace(/[^a-zA-Z0-9_-]/g, "-"); }
  function closeDifficultyMenu(restoreFocus) {
    const cardID = state.difficultyMenuCardId;
    if (!cardID) return;
    state.difficultyMenuCardId = null;
    const picker = Array.from(document.querySelectorAll(".difficulty-picker")).find(function (element) { return element.dataset.difficultyCard === cardID; });
    if (picker) {
      const menu = picker.querySelector(".difficulty-menu");
      if (menu) menu.remove();
      const trigger = picker.querySelector(".difficulty-mark");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus && trigger) trigger.focus();
    } else if (restoreFocus) focusedDifficultyCardId = cardID;
  }
  function closeMoreMenu(restoreFocus) {
    const cardID = state.moreMenuCardId;
    if (!cardID) return;
    state.moreMenuCardId = null;
    const trigger = Array.from(document.querySelectorAll("[data-more-trigger-card]")).find(function (element) { return element.dataset.moreTriggerCard === cardID; });
    const wrapper = trigger && trigger.closest(".fact-more-menu");
    const menu = wrapper && wrapper.querySelector(".fact-more-popover");
    if (menu) menu.remove();
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
    } else if (restoreFocus) focusedMoreCardId = cardID;
  }
  function setRevealGraduallyPreference(enabled) {
    state.revealGradually = enabled === true;
    cardReveal.clearCardRevealProgress();
    bridge("saveRevealGraduallyPreference", { enabled: state.revealGradually }).catch(function () {});
  }
  function cancelCardAdaptation(cardID) {
    const active = adaptationRequest;
    if (!active || cardID && active.cardID !== cardID) return;
    adaptationRequest = null;
    active.request.cancel();
    state.adaptationLoading = null;
  }
  function cancelCardGlossary(cardID) {
    const active = glossaryRequest;
    if (!active || cardID && active.cardID !== cardID) return;
    glossaryRequest = null;
    active.request.cancel();
    state.glossaryLoading = null;
  }
  async function explainCardTerms(cardID) {
    const card = state.cards.find(function (item) { return item.id === cardID; });
    if (!card) return;
    const fingerprint = cardGlossary.cardGlossaryFingerprint(card);
    const saved = cardGlossary.normalizeCardGlossary(card);
    if (saved) { card.glossary = saved; return; }
    if (!state.key.trim()) return;
    const requestKey = state.workspaceId + "\u0000" + cardID + "\u0000" + fingerprint;
    if (glossaryRequest && glossaryRequest.key === requestKey) return;
    cancelCardGlossary();
    const workspaceID = state.workspaceId;
    const activeGeneration = generationToken;
    const request = bridge("learn", { action: "glossary", card: card });
    const active = { key: requestKey, cardID: cardID, workspaceID: workspaceID, request: request };
    glossaryRequest = active;
    state.glossaryLoading = cardID;
    state.glossaryErrorByCard[cardID] = "";
    render();
    try {
      const result = await request;
      if (glossaryRequest !== active || workspaceID !== state.workspaceId || activeGeneration !== generationToken) return;
      const currentCard = state.cards.find(function (item) { return item.id === cardID; });
      if (!currentCard || cardGlossary.cardGlossaryFingerprint(currentCard) !== fingerprint) return;
      const received = result.glossary || result;
      const normalized = cardGlossary.normalizeCardGlossary(Object.assign({}, currentCard, { glossary: Object.assign({}, received, { fingerprint: fingerprint }) }));
      if (!normalized) throw new Error("The glossary could not be checked against this fact and its sources.");
      mergeGeminiModelOutcomes(result.modelOutcomes || []);
      currentCard.glossary = normalized;
      saveState();
    } catch (error) {
      if (glossaryRequest !== active || workspaceID !== state.workspaceId || activeGeneration !== generationToken) return;
      state.glossaryErrorByCard[cardID] = error.message || "Gemini could not explain the terms in this fact.";
    } finally {
      if (glossaryRequest === active) {
        glossaryRequest = null;
        state.glossaryLoading = null;
        render();
      }
    }
  }
  function closeLearnMenu(restoreFocus) {
    const cardID = state.learnMenuCardId;
    if (!cardID) return;
    state.learnMenuCardId = null;
    const trigger = Array.from(document.querySelectorAll("[data-learn-trigger-card]")).find(function (element) { return element.dataset.learnTriggerCard === cardID; });
    const wrapper = trigger && trigger.closest(".learn-more-menu");
    const menu = wrapper && wrapper.querySelector(".learn-more-popover");
    if (menu) menu.remove();
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
    } else if (restoreFocus) focusedLearnCardId = cardID;
  }
  function openNativeGlossary(card) {
    closeLearnMenu(false);
    const fingerprint = cardGlossary.cardGlossaryFingerprint(card);
    cardGlossary.setCardGlossaryPanelOpen(state.workspaceId, card.id, fingerprint, true);
    focusedLearnCardId = null;
    focusLearnMenuAfterRender = false;
    focusedGlossaryHeadingCardId = card.id;
    const saved = cardGlossary.normalizeCardGlossary(card);
    if (saved) {
      card.glossary = saved;
      render();
      return;
    }
    if (!state.key.trim()) {
      render();
      return;
    }
    void explainCardTerms(card.id);
  }
  function closeNativeGlossary(card) {
    cardGlossary.setCardGlossaryPanelOpen(state.workspaceId, card.id, cardGlossary.cardGlossaryFingerprint(card), false);
    cancelCardGlossary(card.id);
    focusedGlossaryTriggerCardId = card.id;
    render();
  }
  function nativeChronologyFingerprint(card) { return cardChronology.cardChronologyFingerprint(card); }
  function nativeChronologyEvents(card) {
    const models = nativeCardRevealModel(card);
    const progress = cardReveal.getCardRevealProgress(state.workspaceId, card.id, models.revealModel);
    const graduallyRevealing = !progress?.complete && (Boolean(progress) || state.revealGradually);
    const visibleCount = graduallyRevealing ? progress?.visibleCount || 0 : models.revealModel.sentences.length;
    const bodyFullyVisible = !graduallyRevealing || visibleCount >= models.revealModel.sentences.length;
    return cardChronology.getCardChronologyEvents(card, visibleCount, bodyFullyVisible);
  }
  function nativeCardLocations(card) {
    const models = nativeCardRevealModel(card);
    const progress = cardReveal.getCardRevealProgress(state.workspaceId, card.id, models.revealModel);
    const graduallyRevealing = !progress?.complete && (Boolean(progress) || state.revealGradually);
    const visibleCount = graduallyRevealing ? progress?.visibleCount || 0 : models.revealModel.sentences.length;
    const bodyFullyVisible = !graduallyRevealing || visibleCount >= models.revealModel.sentences.length;
    return cardLocations.getVisibleCardLocations(card, visibleCount, bodyFullyVisible);
  }
  function nativeLocationFingerprint(card) { return cardLocations.cardLocationsFingerprint(card); }
  function nativeLocationPanelKey(card) { return state.workspaceId + "\u0000" + card.id + "\u0000" + nativeLocationFingerprint(card); }
  function cancelNativeLocationLoad(card) {
    const key = nativeLocationPanelKey(card), active = nativeLocationLoads.get(key);
    if (active && active.status === "loading") {
      if (active.coordinateTask && typeof active.coordinateTask.cancel === "function") active.coordinateTask.cancel();
      nativeLocationLoads.set(key, Object.assign({}, active, { status: "idle" }));
    }
  }
  function startNativeLocationLoad(card, places) {
    const key = nativeLocationPanelKey(card);
    const missing = places.filter(function (place) { return place.latitude === undefined || place.longitude === undefined; });
    const requestedKey = missing.map(function (place) { return place.articleTitle.toLowerCase(); }).sort().join("\u0000");
    const current = nativeLocationLoads.get(key);
    if (current && current.requestedKey === requestedKey && ["loading", "ready", "error"].includes(current.status)) return current;
    const operation = { status: "loading", requestedKey: requestedKey, attempt: current && current.attempt || 0 };
    nativeLocationLoads.set(key, operation);
    let coordinateTask = null;
    const outlineTask = cardLocations.loadCountryOutlines(function () { return bridge("countryOutlineData", {}); });
    if (requestedKey) coordinateTask = bridge("wikipediaCoordinates", { titles: missing.map(function (place) { return place.articleTitle; }) });
    operation.coordinateTask = coordinateTask;
    nativeLocationLoads.set(key, operation);
    const task = Promise.all([outlineTask, coordinateTask || Promise.resolve([])]).then(function (result) {
      nativeCountryOutlines = result[0];
      const locationResult = result[1] || [];
      const updates = locationResult.map(function (place) { return { articleTitle: place.requestedTitle || place.title, latitude: place.latitude, longitude: place.longitude, broad: place.broad }; });
      const nextSaved = cardLocations.attachVerifiedLocationCoordinates(card, updates);
      if (nextSaved) {
        const currentCard = state.cards.find(function (item) { return item.id === card.id; });
        if (currentCard && nativeLocationFingerprint(currentCard) === nextSaved.fingerprint && state.workspaceId + "\u0000" + card.id + "\u0000" + nextSaved.fingerprint === key) {
          state.cards = state.cards.map(function (item) { return item.id === card.id ? Object.assign({}, item, { locations: nextSaved }) : item; });
          saveState();
        }
      }
      if (nativeLocationLoads.get(key) === operation) nativeLocationLoads.set(key, Object.assign({}, operation, { status: "ready", coordinateTask: null }));
      render();
    }).catch(function (error) {
      if (nativeLocationLoads.get(key) !== operation) return;
      if (error && error.message === "Request canceled.") nativeLocationLoads.set(key, Object.assign({}, operation, { status: "idle", coordinateTask: null }));
      else nativeLocationLoads.set(key, Object.assign({}, operation, { status: "error", coordinateTask: null, error: error && error.message }));
      render();
    });
    operation.task = task;
    return operation;
  }
  function openNativeLocationMap(card) {
    const places = nativeCardLocations(card);
    if (!places.length) return;
    cardLocations.setCardLocationPanelOpen(state.workspaceId, card.id, nativeLocationFingerprint(card), true);
    focusedLocationHeadingCardId = card.id;
    render();
  }
  function closeNativeLocationMap(card) {
    cancelNativeLocationLoad(card);
    cardLocations.setCardLocationPanelOpen(state.workspaceId, card.id, nativeLocationFingerprint(card), false);
    focusedLocationTriggerCardId = card.id;
    render();
  }
  function openNativeChronology(card) {
    closeLearnMenu(false);
    cardChronology.setCardChronologyPanelOpen(state.workspaceId, card.id, nativeChronologyFingerprint(card), true);
    focusedLearnCardId = null;
    focusLearnMenuAfterRender = false;
    focusedChronologyHeadingCardId = card.id;
    render();
  }
  function closeNativeChronology(card) {
    cardChronology.setCardChronologyPanelOpen(state.workspaceId, card.id, nativeChronologyFingerprint(card), false);
    focusedChronologyTriggerCardId = card.id;
    render();
  }
  function handleLearnMenuKeydown(event) {
    const options = Array.from(event.currentTarget.querySelectorAll("[role='menuitem']"));
    const activeIndex = options.indexOf(document.activeElement);
    let nextIndex = null;
    if (event.key === "ArrowDown") nextIndex = (activeIndex + 1 + options.length) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (activeIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") { event.preventDefault(); closeLearnMenu(true); return; }
    if (nextIndex !== null) { event.preventDefault(); if (options[nextIndex]) options[nextIndex].focus(); }
  }
  function chooseCardExplanation(card, mode) {
    const validMode = mode === "simpler" || mode === "deeper" ? mode : undefined;
    cardExplanations.setCardExplanationSelection(state.workspaceId, card.id, validMode);
    state.difficultyMenuCardId = null;
    focusedDifficultyCardId = card.id;
    if (!validMode) cancelCardAdaptation(card.id);
    else if (card.explanations && card.explanations[validMode] && card.explanations[validMode].fingerprint === cardExplanations.cardExplanationFingerprint(card)) cancelCardAdaptation(card.id);
    else void adaptCardExplanation(card.id, validMode);
    render();
  }
  function handleDifficultyMenuKeydown(event, card) {
    const options = Array.from(event.currentTarget.querySelectorAll("[role='menuitemradio']"));
    const activeIndex = options.indexOf(document.activeElement);
    let nextIndex = null;
    if (event.key === "ArrowDown") nextIndex = (activeIndex + 1 + options.length) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (activeIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") { event.preventDefault(); closeDifficultyMenu(true); return; }
    if (nextIndex !== null) { event.preventDefault(); if (options[nextIndex]) options[nextIndex].focus(); }
  }
  function handleMoreMenuKeydown(event) {
    const options = Array.from(event.currentTarget.querySelectorAll("[role='menuitem']"));
    const activeIndex = options.indexOf(document.activeElement);
    let nextIndex = null;
    if (event.key === "ArrowDown") nextIndex = (activeIndex + 1 + options.length) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (activeIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") { event.preventDefault(); closeMoreMenu(true); return; }
    if (nextIndex !== null) { event.preventDefault(); if (options[nextIndex]) options[nextIndex].focus(); }
  }
  function runMoreCardAction(card, action) {
    state.moreMenuCardId = null;
    focusedMoreCardId = card.id;
    if (action === "download") { render(); exportFactsNative([card], true); return; }
    if (action === "reveal") cardReveal.startCardReveal(state.workspaceId, card.id, cardReveal.buildCardRevealModel(card.body, sourceSpotlight.buildSourceSpotlightModel(card).mapped ? sourceSpotlight.buildSourceSpotlightModel(card).sentences : undefined));
    else if (action === "more") { card.moreLike = true; card.liked = true; showToast("Your mix will lean a little closer to this thread."); saveState(); }
    else if (action === "topic-detour") { startTopicDetour(card); return; }
    else if (action === "less") { card.lessLike = true; showToast("We’ll keep this thread quieter for a while."); saveState(); }
    else {
      const label = (card.topicPath || []).slice(-1)[0];
      state.rabbitHole = label || null;
      state.view = "feed";
      showToast("Rabbit hole mode is following " + (label || "this topic") + ".");
    }
    render();
    if (action === "rabbit") { state.started = true; saveState(); generateBatch(generationToken,7); }
  }
  function recordNativeTopicDetourProgress(cardId, phase) {
    const detour = state.topicDetour;
    if (!detour || detour.workspaceId !== state.workspaceId) return;
    const result = topicDetours.markTopicDetourProgress(detour, cardId, phase);
    if (result.completed) {
      clearTopicDetourCompletionNotice();
      topicDetourCompletionNotice = (detour.topicPath[detour.topicPath.length - 1] || "Topic") + " · 3 of 3";
      topicDetourCompletionTimer = window.setTimeout(function () {
        topicDetourCompletionTimer = null;
        topicDetourCompletionNotice = "";
        render();
      }, 1400);
      state.topicDetour = null;
      state.pendingSlots = 7;
      render();
    } else if (result.detour !== detour) {
      state.topicDetour = result.detour;
      render();
    }
  }
  function measureTopicDetourCard(cardId) {
    const article = document.querySelector('article[data-card-id="' + CSS.escape(cardId) + '"]');
    const root = document.querySelector(".main-scroll");
    if (!article || !root || !state.topicDetour) return;
    const bounds = article.getBoundingClientRect();
    const rootBounds = /auto|scroll/.test(getComputedStyle(root).overflowY) ? root.getBoundingClientRect() : {top:0,bottom:window.innerHeight};
    const phase = bounds.bottom <= rootBounds.top ? "passed" : bounds.top < rootBounds.bottom && bounds.bottom > rootBounds.top ? bounds.bottom <= rootBounds.bottom ? "bottom" : "visible" : null;
    if (phase) recordNativeTopicDetourProgress(cardId, phase);
  }
  function checkNativeTopicDetourProgress() {
    if (suppressTopicDetourScroll || !state.topicDetour) return;
    const activeDetourId = state.topicDetour.id;
    const ids = state.topicDetour.slotCardIds.filter(Boolean);
    for (const id of ids) {
      measureTopicDetourCard(id);
      if (!state.topicDetour || state.topicDetour.id !== activeDetourId) return;
    }
  }
  function handleNativeTopicDetourScroll() {
    if (topicDetourProgressFrame) cancelAnimationFrame(topicDetourProgressFrame);
    topicDetourProgressFrame = requestAnimationFrame(function () {
      topicDetourProgressFrame = 0;
      checkNativeTopicDetourProgress();
    });
  }
  window.addEventListener("scroll",handleNativeTopicDetourScroll,{passive:true});
  async function adaptCardExplanation(cardID, mode) {
    if (mode !== "simpler" && mode !== "deeper") { cancelCardAdaptation(cardID); return; }
    const card = state.cards.find(function (item) { return item.id === cardID; });
    if (!card) return;
    if (!state.key.trim()) { cancelCardAdaptation(cardID); return; }
    const fingerprint = cardExplanations.cardExplanationFingerprint(card);
    const existing = card.explanations && card.explanations[mode];
    if (existing && existing.fingerprint === fingerprint && existing.text && existing.sources && existing.sources.length) return;
    const requestKey = state.workspaceId + "\u0000" + cardID + "\u0000" + mode + "\u0000" + fingerprint;
    if (adaptationRequest && adaptationRequest.key === requestKey) return;
    cancelCardAdaptation();
    const workspaceID = state.workspaceId;
    const activeGeneration = generationToken;
    const errorKey = cardID + ":adapt:" + mode;
    const request = bridge("learn", { action: "adapt", mode: mode, card: card });
    const active = { key: requestKey, cardID: cardID, mode: mode, workspaceID: workspaceID, request: request };
    adaptationRequest = active;
    state.adaptationLoading = cardID + ":" + mode;
    state.adaptationErrorByCard[errorKey] = "";
    render();
    try {
      const result = await request;
      if (adaptationRequest !== active || workspaceID !== state.workspaceId || activeGeneration !== generationToken || cardExplanations.getCardExplanationSelection(workspaceID, cardID) !== mode) return;
      const currentCard = state.cards.find(function (item) { return item.id === cardID; });
      if (!currentCard || cardExplanations.cardExplanationFingerprint(currentCard) !== fingerprint) return;
      if (!result.answer || !String(result.answer).trim() || !Array.isArray(result.citations) || !result.citations.length) throw new Error("Gemini could not support this alternate explanation with the card’s sources.");
      mergeGeminiModelOutcomes(result.modelOutcomes || []);
      currentCard.explanations = Object.assign({}, currentCard.explanations || {}, { [mode]: { text: String(result.answer).trim(), sources: result.citations, fingerprint: fingerprint } });
      saveState();
    } catch (error) {
      if (adaptationRequest !== active || workspaceID !== state.workspaceId || activeGeneration !== generationToken) return;
      state.adaptationErrorByCard[errorKey] = error.message || "Gemini could not adapt this explanation.";
    } finally {
      if (adaptationRequest === active) {
        adaptationRequest = null;
        state.adaptationLoading = null;
        render();
      }
    }
  }
  function nativeCancelSpotlightRequest(requestKey) {
    const request = sourceSpotlightRequests.get(requestKey);
    if (!request) return;
    request.task.cancel();
    sourceSpotlightRequests.delete(requestKey);
  }
  function nativeCancelSpotlightRequests(workspaceId, cardId, exceptSentence) {
    for (const [requestKey, request] of sourceSpotlightRequests) {
      if (request.workspaceId === workspaceId && request.cardId === cardId && request.sentenceIndex !== exceptSentence) nativeCancelSpotlightRequest(requestKey);
    }
  }
  function nativeUpdateSpotlightContext(card, sentenceIndex, contextKey, context) {
    const key = nativeSpotlightKey(card);
    const current = sourceSpotlightStates.get(key);
    if (!current || current.sentenceIndex !== sentenceIndex || !current.expandedEvidence.includes(contextKey)) return false;
    current.contexts[contextKey] = context;
    storeNativeSpotlightState(key, current);
    render();
    return true;
  }
  function nativeLoadSpotlightContext(card, sentenceIndex, evidence) {
    const contextKey = sourceSpotlight.sourceSpotlightContextKey(evidence.index);
    const key = nativeSpotlightKey(card);
    const current = sourceSpotlightStates.get(key);
    if (!current || current.sentenceIndex !== sentenceIndex || !current.expandedEvidence.includes(contextKey)) return;
    const stored = sourceSpotlight.locatePassageContext(card.sources[evidence.sourceIndex] && card.sources[evidence.sourceIndex].extract, evidence.quote, evidence.section);
    if (stored.status === "found" && stored.before && stored.after) {
      nativeUpdateSpotlightContext(card, sentenceIndex, contextKey, { status: "ready", before: stored.before, after: stored.after });
      return;
    }
    const requestKey = key + "\u0000" + sentenceIndex + "\u0000" + evidence.index;
    const existing = sourceSpotlightRequests.get(requestKey);
    if (existing) return;
    const source = card.sources[evidence.sourceIndex];
    if (!source) { nativeUpdateSpotlightContext(card, sentenceIndex, contextKey, { status: "unverified" }); return; }
    const task = bridge("wikipediaArticle", { title: source.title });
    const request = { task: task, workspaceId: state.workspaceId, cardId: card.id, sentenceIndex: sentenceIndex, evidenceIndex: evidence.index };
    sourceSpotlightRequests.set(requestKey, request);
    task.then(function (article) {
      const latest = sourceSpotlightStates.get(key);
      if (state.workspaceId !== request.workspaceId || !latest || latest.sentenceIndex !== sentenceIndex || !latest.expandedEvidence.includes(contextKey)) return;
      const context = sourceSpotlight.locatePassageContext(article && article.extract, evidence.quote, evidence.section);
      nativeUpdateSpotlightContext(card, sentenceIndex, contextKey, context.status === "found"
        ? { status: "ready", before: context.before, after: context.after }
        : { status: "unverified" });
    }).catch(function (error) {
      if (state.workspaceId !== request.workspaceId || error && /canceled/i.test(error.message || "")) return;
      nativeUpdateSpotlightContext(card, sentenceIndex, contextKey, { status: "error" });
    }).finally(function () { if (sourceSpotlightRequests.get(requestKey) === request) sourceSpotlightRequests.delete(requestKey); });
  }
  function openNativeSpotlight(card, sentenceIndex, triggerId) {
    const reveal = nativeCardRevealModel(card);
    const revealProgress = cardReveal.getCardRevealProgress(state.workspaceId, card.id, reveal.revealModel);
    const graduallyRevealing = !revealProgress?.complete && (Boolean(revealProgress) || state.revealGradually);
    if (graduallyRevealing && sentenceIndex >= (revealProgress?.visibleCount || 0)) cardReveal.revealCardThroughSentence(state.workspaceId, card.id, reveal.revealModel, sentenceIndex);
    const key = nativeSpotlightKey(card);
    const current = sourceSpotlightStates.get(key);
    nativeCancelSpotlightRequests(state.workspaceId, card.id, sentenceIndex);
    storeNativeSpotlightState(key, {
      sentenceIndex: sentenceIndex,
      triggerId: triggerId,
      expandedEvidence: current ? current.expandedEvidence : [],
      contexts: current ? current.contexts : {}
    });
    focusedSpotlightTrigger = { workspaceId: state.workspaceId, cardId: card.id, triggerId: triggerId };
    render();
  }
  function closeNativeSpotlight(card) {
    const key = nativeSpotlightKey(card);
    const current = sourceSpotlightStates.get(key);
    if (!current) return;
    focusedSpotlightTrigger = { workspaceId: state.workspaceId, cardId: card.id, triggerId: current.triggerId };
    for (const [requestKey, request] of sourceSpotlightRequests) if (request.workspaceId === state.workspaceId && request.cardId === card.id) nativeCancelSpotlightRequest(requestKey);
    sourceSpotlightStates.delete(key);
    render();
  }
  function toggleNativeSpotlightContext(card, sentenceIndex, evidence) {
    const key = nativeSpotlightKey(card);
    const current = sourceSpotlightStates.get(key);
    if (!current) return;
    const contextKey = sourceSpotlight.sourceSpotlightContextKey(evidence.index);
    const expanded = current.expandedEvidence.includes(contextKey);
    if (expanded) {
      const requestKey = key + "\u0000" + sentenceIndex + "\u0000" + evidence.index;
      nativeCancelSpotlightRequest(requestKey);
      current.expandedEvidence = current.expandedEvidence.filter(function (item) { return item !== contextKey; });
      current.contexts[contextKey] = { status: "idle" };
      storeNativeSpotlightState(key, current);
      render();
      return;
    }
    current.expandedEvidence = current.expandedEvidence.concat(contextKey);
    current.contexts[contextKey] = { status: "loading" };
    storeNativeSpotlightState(key, current);
    render();
    nativeLoadSpotlightContext(card, sentenceIndex, evidence);
  }
  function nativeSpotlightPanel(card, model, sentenceIndex, groups) {
    const current = sourceSpotlightStates.get(nativeSpotlightKey(card));
    const open = Boolean(current && current.sentenceIndex === sentenceIndex);
    const panel = node("span", { className: "source-spotlight-panel", id: nativeSpotlightPanelId(card, model, sentenceIndex), role: "region", ariaLabel: "Wikipedia source spotlight" });
    if (!open) { panel.hidden = true; return panel; }
    panel.appendChild(node("span", { className: "source-spotlight-heading" }, node("strong", { text: "Source spotlight" }), node("button", { className: "source-spotlight-close", ariaLabel: "Close source spotlight", onClick: function () { closeNativeSpotlight(card); } }, "Close")));
    groups.forEach(function (group) {
      const source = group.source;
      const groupNode = node("span", { className: "source-spotlight-group" });
      const external = externalLink(sourceSpotlight.canonicalWikipediaUrl(source), "", "source-external-link");
      external.setAttribute("aria-label", "Open " + source.title + " on Wikipedia");
      groupNode.appendChild(node("span", { className: "source-spotlight-source" }, node("strong", { text: source.title }), external));
      group.evidence.forEach(function (evidence) {
        const contextKey = sourceSpotlight.sourceSpotlightContextKey(evidence.index);
        const expanded = Boolean(current && current.expandedEvidence.includes(contextKey));
        const context = current && current.contexts[contextKey];
        const quote = evidence.quote;
        const sentence = model.mapped ? model.sentences[sentenceIndex] : "";
        const highlight = sourceSpotlight.longestSharedPhraseRange(quote, sentence, card.claim || "");
        const quoteWrap = node("span", { className: "source-spotlight-quote-wrap" });
        if (evidence.section) quoteWrap.appendChild(node("span", { className: "source-spotlight-section", text: evidence.section }));
        const quoteNode = node("span", { className: "source-spotlight-quote" });
        if (expanded && context && context.status === "ready" && context.before) quoteNode.appendChild(node("span", { className: "source-spotlight-context", text: context.before + " " }));
        quoteNode.appendChild(document.createTextNode("“"));
        if (highlight) {
          quoteNode.appendChild(document.createTextNode(quote.slice(0, highlight.start)));
          quoteNode.appendChild(node("mark", { text: quote.slice(highlight.start, highlight.end) }));
          quoteNode.appendChild(document.createTextNode(quote.slice(highlight.end)));
        } else quoteNode.appendChild(document.createTextNode(quote));
        quoteNode.appendChild(document.createTextNode("”"));
        if (expanded && context && context.status === "ready" && context.after) quoteNode.appendChild(node("span", { className: "source-spotlight-context", text: " " + context.after }));
        quoteWrap.appendChild(quoteNode);
        const controls = node("span", { className: "source-spotlight-context-actions" });
        const contextControlData = { spotlightContextCard: card.id, spotlightEvidence: String(evidence.index) };
        controls.appendChild(node("button", { type: "button", dataset: contextControlData, disabled: Boolean(context && context.status === "loading"), onClick: function () { toggleNativeSpotlightContext(card, sentenceIndex, evidence); } }, expanded ? "Hide context" : "Read around this passage"));
        if (expanded && context && context.status === "loading") controls.appendChild(node("span", { role: "status", text: "Loading nearby text…" }));
        if (expanded && context && context.status === "unverified") controls.appendChild(node("span", { className: "source-spotlight-note", text: "This article has changed, or this quotation could not be located unambiguously. The saved evidence above is unchanged." }));
        if (expanded && context && context.status === "error") controls.appendChild(node("span", { className: "source-spotlight-note", text: "Surrounding text could not be loaded. Your saved evidence is unchanged." }));
        if (expanded && context && (context.status === "error" || context.status === "unverified")) controls.appendChild(node("button", { type: "button", dataset: contextControlData, onClick: function () { const latest = sourceSpotlightStates.get(nativeSpotlightKey(card)); if (!latest) return; latest.contexts[contextKey] = { status: "loading" }; storeNativeSpotlightState(nativeSpotlightKey(card), latest); render(); nativeLoadSpotlightContext(card, sentenceIndex, evidence); } }, "Retry"));
        quoteWrap.appendChild(controls);
        groupNode.appendChild(quoteWrap);
      });
      panel.appendChild(groupNode);
    });
    panel.addEventListener("keydown", function (event) { if (event.key === "Escape") { event.preventDefault(); closeNativeSpotlight(card); } });
    return panel;
  }
  function nativeCardRevealModel(card) {
    const spotlightModel = sourceSpotlight.buildSourceSpotlightModel(card);
    return { spotlightModel: spotlightModel, revealModel: cardReveal.buildCardRevealModel(card.body || "", spotlightModel.mapped ? spotlightModel.sentences : undefined) };
  }
  function cardBody(card) {
    const revealModels = nativeCardRevealModel(card);
    const model = revealModels.spotlightModel;
    const revealModel = revealModels.revealModel;
    const revealProgress = cardReveal.getCardRevealProgress(state.workspaceId, card.id, revealModel);
    const graduallyRevealing = !revealProgress?.complete && (Boolean(revealProgress) || state.revealGradually);
    const visibleCount = graduallyRevealing ? revealProgress?.visibleCount || 0 : revealModel.sentences.length;
    const current = sourceSpotlightStates.get(nativeSpotlightKey(card));
    const body = node("p", { className: "fact-body" });
    const reading = node("div", { className: "card-reading-body" });
    if (model.mapped) {
      model.sentences.slice(0, visibleCount).forEach(function (sentence, sentenceIndex) {
        if (sentenceIndex) body.appendChild(document.createTextNode(" "));
        body.appendChild(document.createTextNode(sentence));
        const groups = model.groups[sentenceIndex] || [];
        if (!groups.length) return;
        const triggerId = "sentence-" + sentenceIndex;
        body.appendChild(node("button", { type: "button", className: "source-citation-marker", ariaLabel: "Open sources for sentence " + (sentenceIndex + 1), ariaExpanded: Boolean(current && current.sentenceIndex === sentenceIndex), ariaControls: nativeSpotlightPanelId(card, model, sentenceIndex), dataset: { spotlightCard: card.id, spotlightTrigger: triggerId }, onKeydown: function (event) { handleNativeSpotlightEscape(event, card); } }, String(sentenceIndex + 1)));
        const marker = body.lastChild;
        marker.addEventListener("click", function () { openNativeSpotlight(card, sentenceIndex, triggerId); });
        body.appendChild(nativeSpotlightPanel(card, model, sentenceIndex, groups));
      });
    } else {
      if (visibleCount > 0) body.appendChild(document.createTextNode(card.body || ""));
      const groups = model.groups[0] || [];
      if (visibleCount > 0 && groups.length) {
        body.appendChild(document.createTextNode(" "));
        const triggerId = "whole-body";
        body.appendChild(node("button", { type: "button", className: "source-citation-marker", ariaLabel: "Open saved sources for this fact", ariaExpanded: Boolean(current && current.sentenceIndex === 0), ariaControls: nativeSpotlightPanelId(card, model, 0), dataset: { spotlightCard: card.id, spotlightTrigger: triggerId }, text: "1", onClick: function () { openNativeSpotlight(card, 0, triggerId); }, onKeydown: function (event) { handleNativeSpotlightEscape(event, card); } }));
        body.appendChild(nativeSpotlightPanel(card, model, 0, groups));
      }
    }
    reading.appendChild(body);
    if (graduallyRevealing) {
      const controls = node("div", { className: "card-reveal-controls" });
      controls.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { cardReveal.revealNextCardSentence(state.workspaceId, card.id, revealModel); render(); } }, "Keep reading"));
      controls.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { cardReveal.showAllCardSentences(state.workspaceId, card.id, revealModel); render(); } }, "Show everything"));
      reading.appendChild(controls);
    }
    reading.appendChild(node("span", { className: "sr-only", "aria-live": "polite", "aria-atomic": "true", text: revealProgress && revealProgress.visibleCount > 0 ? "Revealed: " + (revealModel.sentences[revealProgress.visibleCount - 1] || "") : "" }));
    return reading;
  }
  function nativeGlossaryPanel(card) {
    const fingerprint = cardGlossary.cardGlossaryFingerprint(card);
    if (!cardGlossary.getCardGlossaryPanelOpen(state.workspaceId, card.id, fingerprint)) return null;
    const saved = cardGlossary.normalizeCardGlossary(card);
    const models = nativeCardRevealModel(card);
    const progress = cardReveal.getCardRevealProgress(state.workspaceId, card.id, models.revealModel);
    const graduallyRevealing = !progress?.complete && (Boolean(progress) || state.revealGradually);
    const visibleCount = graduallyRevealing ? progress?.visibleCount || 0 : models.revealModel.sentences.length;
    const visibleText = (card.hook || "") + " " + (card.title || "") + " " + (graduallyRevealing ? models.revealModel.sentences.slice(0, visibleCount).join(" ") : card.body || "");
    const visibleEntries = cardGlossary.getVisibleCardGlossaryEntries(saved, visibleText);
    const panelID = "card-glossary-" + safeCardElementId(card.id);
    const panel = node("section", { className: "learning-answer card-glossary", role: "region", ariaLabel: "Term glossary", ariaLabelledby: panelID, onKeydown: function (event) { if (event.key === "Escape") { event.preventDefault(); closeNativeGlossary(card); } } });
    const heading = node("div", { className: "card-explanation-heading" });
    heading.appendChild(node("span", { id: panelID, className: "answer-label", tabIndex: -1, dataset: { glossaryHeadingCard: card.id } }, svg("sparkles", 14), " Explain the terms"));
    heading.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { closeNativeGlossary(card); } }, "Close"));
    panel.appendChild(heading);
    if (state.glossaryLoading === card.id) {
      panel.appendChild(node("div", { className: "learning-loading", role: "status" }, node("span", { className: "loading-dot" }), " Finding the terms that may be unfamiliar…"));
    } else if (!state.key.trim() && !saved) {
      const settings = node("div", { className: "card-explanation-settings" }, node("span", { text: "Add a Gemini key to explain these terms." }));
      settings.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { state.view = "settings"; render(); } }, "Open Settings"));
      panel.appendChild(settings);
    } else if (saved && saved.entries.length === 0) {
      panel.appendChild(node("p", { className: "card-glossary-empty", text: "No difficult terms need explaining." }));
    } else if (saved && visibleEntries.length === 0) {
      panel.appendChild(node("p", { className: "card-glossary-empty", text: "Keep reading to reveal the terms explained later in this fact." }));
    } else if (saved) {
      const list = node("dl", { className: "card-glossary-list" });
      visibleEntries.forEach(function (entry) {
        const item = node("div", { className: "card-glossary-entry" });
        item.appendChild(node("dt", { text: entry.term }));
        item.appendChild(node("dd", { text: entry.definition }));
        const links = node("div", { className: "answer-sources" });
        entry.sourceIndexes.forEach(function (sourceIndex) {
          const source = saved.sources[sourceIndex];
          if (source) links.appendChild(externalLink(source.canonicalUrl || source.url, source.title));
        });
        item.appendChild(links);
        list.appendChild(item);
      });
      panel.appendChild(list);
    } else {
      const retry = node("div", { className: "card-explanation-settings" }, node("span", { text: state.glossaryErrorByCard[card.id] || "The glossary could not be created." }));
      retry.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { void explainCardTerms(card.id); } }, "Retry"));
      panel.appendChild(retry);
    }
    return panel;
  }
  function nativeChronologyPanel(card) {
    const events = nativeChronologyEvents(card);
    const fingerprint = nativeChronologyFingerprint(card);
    const isOpen = cardChronology.getCardChronologyPanelOpen(state.workspaceId, card.id, fingerprint);
    if (events.length < 2) {
      if (isOpen) {
        cardChronology.setCardChronologyPanelOpen(state.workspaceId, card.id, fingerprint, false);
        focusedChronologyTriggerCardId = card.id;
      }
      return null;
    }
    if (!isOpen) return null;
    const panelID = "card-chronology-" + safeCardElementId(card.id);
    const panel = node("section", { className: "learning-answer card-chronology", role: "region", ariaLabelledby: panelID, onKeydown: function (event) { if (event.key === "Escape") { event.preventDefault(); closeNativeChronology(card); } } });
    const heading = node("div", { className: "card-explanation-heading" });
    heading.appendChild(node("h4", { id: panelID, className: "answer-label", tabIndex: -1, dataset: { chronologyHeadingCard: card.id } }, "Dates in this fact"));
    heading.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { closeNativeChronology(card); } }, "Close"));
    panel.appendChild(heading);
    const list = node("ol", { className: "card-chronology-list " + (events.length > 4 ? "vertical" : "horizontal count-" + events.length) });
    events.forEach(function (event) {
      const item = node("li", { className: "card-chronology-event" });
      if (event.intervalBefore) item.appendChild(node("span", { className: "card-chronology-interval", text: event.intervalBefore }));
      item.appendChild(node("time", { className: "card-chronology-date", text: event.dateText }));
      item.appendChild(node("span", { className: "card-chronology-description", text: event.description }));
      list.appendChild(item);
    });
    panel.appendChild(list);
    return panel;
  }
  function nativePocketMapPanel(card) {
    const places = nativeCardLocations(card);
    const fingerprint = nativeLocationFingerprint(card);
    const isOpen = cardLocations.getCardLocationPanelOpen(state.workspaceId, card.id, fingerprint);
    if (!places.length) {
      if (isOpen) { cancelNativeLocationLoad(card); cardLocations.setCardLocationPanelOpen(state.workspaceId, card.id, fingerprint, false); focusedLocationTriggerCardId = card.id; }
      return null;
    }
    if (!isOpen) return null;
    const status = startNativeLocationLoad(card, places);
    const panelID = "card-location-" + safeCardElementId(card.id);
    const panel = node("section", { id: panelID, className: "learning-answer card-pocket-map", role: "region", ariaLabelledby: "card-location-heading-" + safeCardElementId(card.id), onKeydown: function (event) { if (event.key === "Escape") { event.preventDefault(); closeNativeLocationMap(card); } } });
    const heading = node("div", { className: "card-explanation-heading" });
    heading.appendChild(node("h4", { id: "card-location-heading-" + safeCardElementId(card.id), className: "answer-label", tabIndex: -1, dataset: { locationHeadingCard: card.id } }, "Locations in this fact"));
    heading.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { closeNativeLocationMap(card); } }, "Close"));
    panel.appendChild(heading);
    if (status.status === "loading") {
      panel.appendChild(node("div", { className: "learning-loading", role: "status" }, node("span", { className: "loading-dot" }), " Loading map details…"));
      return panel;
    }
    if (status.status === "error") {
      const note = node("div", { className: "card-location-note", role: "status" }, status.error || "Location details could not be loaded.");
      note.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { nativeLocationLoads.set(nativeLocationPanelKey(card), { status: "idle", attempt: (status.attempt || 0) + 1 }); render(); } }, "Retry"));
      panel.appendChild(note);
      return panel;
    }
    const located = places.filter(function (place) { return Number.isFinite(place.latitude) && Number.isFinite(place.longitude); }).map(function (place) { return Object.assign({}, place, { url: cardLocations.wikiArticleUrl(place.articleTitle) }); });
    if (nativeCountryOutlines && located.length) {
      const layout = cardLocations.layoutPocketMap(nativeCountryOutlines.countries, located);
      const map = node("div", { className: "card-pocket-map-canvas", role: "img", ariaLabel: "Outline map showing " + located.map(function (place) { return place.name; }).join(" and ") });
      const svgNS = "http://www.w3.org/2000/svg";
      const svgMap = document.createElementNS(svgNS, "svg");
      svgMap.setAttribute("viewBox", "0 0 " + layout.width + " " + layout.height);
      svgMap.setAttribute("aria-hidden", "true");
      svgMap.setAttribute("focusable", "false");
      const outlines = document.createElementNS(svgNS, "g");
      outlines.setAttribute("class", "card-pocket-map-outlines");
      layout.outlines.forEach(function (outline) { const path = document.createElementNS(svgNS, "path"); path.setAttribute("d", outline.d); if (outline.selected) path.setAttribute("class", "selected"); outlines.appendChild(path); });
      svgMap.appendChild(outlines);
      const pins = document.createElementNS(svgNS, "g");
      pins.setAttribute("class", "card-pocket-map-pins");
      layout.markers.forEach(function (marker) {
        const group = document.createElementNS(svgNS, "g"); group.setAttribute("transform", "translate(" + marker.x.toFixed(1) + " " + marker.y.toFixed(1) + ")");
        const circle = document.createElementNS(svgNS, "circle"); circle.setAttribute("r", "12"); group.appendChild(circle);
        const text = document.createElementNS(svgNS, "text"); text.setAttribute("text-anchor", "middle"); text.setAttribute("dominant-baseline", "central"); text.textContent = String(marker.number); group.appendChild(text);
        pins.appendChild(group);
      });
      svgMap.appendChild(pins); map.appendChild(svgMap); panel.appendChild(map);
    }
    const list = node("ol", { className: "card-pocket-map-places" });
    places.forEach(function (place, index) {
      const item = node("li", {});
      item.appendChild(node("span", { className: "card-pocket-map-number", ariaHidden: "true" }, String(index + 1)));
      const label = node("span", { className: "card-pocket-map-place-label" });
      label.appendChild(externalLink(cardLocations.wikiArticleUrl(place.articleTitle), place.name, "card-pocket-map-place-link"));
      if (place.broad) label.appendChild(node("small", { text: "Approximate center for orientation" }));
      else if (place.latitude === undefined) label.appendChild(node("small", { text: "Wikipedia has no verified primary coordinates for this title" }));
      item.appendChild(label); list.appendChild(item);
    });
    panel.appendChild(list);
    panel.appendChild(node("p", { className: "card-pocket-map-caption", text: "Present-day borders are shown for geographic orientation." }));
    return panel;
  }
  function sourceList(card, answer) {
    const isAnswer = answer === true;
    const isLearnMore = answer === "learnMore";
    const hasAnswerStyle = isAnswer || isLearnMore;
    const sources = (isLearnMore ? card.learnMoreSources : isAnswer ? card.answerSources : card.sources) || [];
    const list = node("div", { className: hasAnswerStyle ? "answer-sources" : "fact-sources" });
    list.appendChild(node("span", { text: hasAnswerStyle ? "Sources" : "Wikipedia sources" }));
    const links = node("div", { className: "source-links" });
    sources.slice(0, 3).forEach(function (source, sourceIndex) {
      if (hasAnswerStyle) { links.appendChild(externalLink(source.url || wikiURL(source.title), source.title || "Wikipedia")); return; }
      const sourceControl = node("span", { className: "source-link-controls" });
      const model = sourceSpotlight.buildSourceSpotlightModel(card);
      const hasEvidence = model.groups.some(function (groups) { return groups.some(function (group) { return group.sourceIndex === sourceIndex; }); });
      const current = sourceSpotlightStates.get(nativeSpotlightKey(card));
      const sentenceIndex = nativeSpotlightSentenceForSource(model, current, sourceIndex);
      const triggerId = "footer-source-" + sourceIndex;
      if (hasEvidence) {
        const titleButton = node("button", { type: "button", className: "source-spotlight-link", ariaExpanded: Boolean(current && current.sentenceIndex === sentenceIndex), ariaControls: nativeSpotlightPanelId(card, model, sentenceIndex), dataset: { spotlightCard: card.id, spotlightTrigger: triggerId }, text: source.title || "Wikipedia", onClick: function () { openNativeSpotlight(card, sentenceIndex, triggerId); }, onKeydown: function (event) { handleNativeSpotlightEscape(event, card); } });
        sourceControl.appendChild(titleButton);
      } else sourceControl.appendChild(node("span", { text: source.title || "Wikipedia" }));
      const external = externalLink(sourceSpotlight.canonicalWikipediaUrl(source), "", "source-external-link");
      external.setAttribute("aria-label", "Open " + (source.title || "Wikipedia") + " on Wikipedia");
      sourceControl.appendChild(external);
      links.appendChild(sourceControl);
    });
    list.appendChild(links);
    return list;
  }
  function youtubeDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }); }
  function youtubeURL(id) { return "https://www.youtube.com/watch?v=" + encodeURIComponent(id); }
  function youtubeOwnerID() { return state.account && state.account.id || state.cloudOwnerId || "local"; }
  function youtubePlayerIdentity(ownerID, workspaceID, videoID) { return [ownerID, workspaceID, videoID].join("\u0000"); }
  function youtubeSave(id) { const saved = state.youtube.savedIds.indexOf(id) >= 0; state.youtube.savedIds = saved ? state.youtube.savedIds.filter(function (item) { return item !== id; }) : state.youtube.savedIds.concat(id); saveState(); render(); }
  function youtubeOpenVideo(id) {
    playerEndedIdentity = "";
    if (!state.youtube.selectedVideoId) {
      const scroll = document.querySelector(".main-scroll");
      const scrollTop = scroll && /auto|scroll/.test(getComputedStyle(scroll).overflowY) ? scroll.scrollTop : window.scrollY;
      const rootTop = scroll && /auto|scroll/.test(getComputedStyle(scroll).overflowY) ? scroll.getBoundingClientRect().top : 0;
      const rootBottom = scroll && /auto|scroll/.test(getComputedStyle(scroll).overflowY) ? scroll.getBoundingClientRect().bottom : window.innerHeight;
      const anchor = Array.from(document.querySelectorAll("[data-video-id]")).find(function (element) {
        const rect = element.getBoundingClientRect();
        return rect.bottom > rootTop && rect.top < rootBottom;
      });
      youtubeBrowseReturn = { ownerID: youtubeOwnerID(), workspaceID: state.workspaceId, scrollTop: scrollTop, anchorVideoID: anchor && anchor.dataset.videoId || "", anchorOffset: anchor ? anchor.getBoundingClientRect().top - rootTop : 0 };
    }
    resetYoutubePlayerScroll = state.youtube.selectedVideoId !== id;
    state.youtube.selectedVideoId = id;
    state.youtube.history = [{ videoId: id, watchedAt: new Date().toISOString() }].concat(state.youtube.history.filter(function (item) { return item.videoId !== id; })).slice(0, 200);
    saveState(); render();
  }
  function youtubeOpenChannel(id) { cancelYoutubeSearch(); youtubeBrowseReturn = null; state.youtube.selectedChannelId = id; state.youtube.selectedVideoId = null; state.youtube.tab = "channels"; state.youtube.searchText = ""; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtube.smartRan = false; render(); }
  function youtubeVideoCard(video) {
    const card = node("article", { className: "video-card" });
    card.dataset.videoId = video.id;
    const main = node("button", { className: "video-card-main", ariaLabel: "Watch " + video.title, onClick: function () { youtubeOpenVideo(video.id); } });
    const thumbnail = node("div", { className: "video-thumbnail" });
    if (video.thumbnailUrl) { const image = node("img", { src: video.thumbnailUrl, alt: "", loading: "lazy", decoding: "async" }); thumbnail.appendChild(image); }
    else thumbnail.appendChild(node("span", {}, svg("image", 22)));
    thumbnail.appendChild(node("small", { text: video.durationLabel || "" }));
    main.appendChild(thumbnail);
    main.appendChild(node("div", { className: "video-card-copy" }, node("h3", { text: video.title }), node("p", { text: video.channelName }), node("time", { text: youtubeDate(video.publishedAt) })));
    card.appendChild(main);
    card.appendChild(node("button", { className: "video-save-button" + (state.youtube.savedIds.indexOf(video.id) >= 0 ? " saved" : ""), ariaLabel: state.youtube.savedIds.indexOf(video.id) >= 0 ? "Remove from saved videos" : "Save video", onClick: function () { youtubeSave(video.id); } }, svg("bookmark", 16)));
    const reason = state.youtube.smartReasons && state.youtube.smartReasons[video.id];
    if (reason) card.appendChild(node("details", { className: "video-match-reason" }, node("summary", { text: reason.relevance === "broader" ? "Broader recommendation" : "Why this matches" }), node("p", { text: reason.explanation || "The metadata supports this search." }), node("small", { text: (reason.support || []).join(" · ") })));
    return card;
  }
  function youtubeList(videos) {
    if (!videos.length) {
      const empty = state.youtube.tab === "saved"
        ? ["No saved videos yet", "Save a video from Discover or a channel and it will appear here.", "bookmark"]
        : state.youtube.tab === "history"
          ? ["No watch history yet", "Videos you open will appear here so you can pick up where you left off.", "history"]
          : state.youtube.smartRan
            ? ["No relevant approved videos found", "No match is supported by the approved catalog metadata. Try another phrase or remove a conflicting filter.", "search"]
            : state.youtube.searchText.trim()
              ? ["No videos match this search", "Try another phrase or adjust the topic and channel filters.", "search"]
              : ["No approved videos match that yet", "Try another phrase, topic, or channel. Search stays inside the approved collection.", "search"];
      return node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg(empty[2], 24)), node("h2", { text: empty[0] }), node("p", { text: empty[1] }));
    }
    const groups = youtubePartitionMemo([videos, state.youtube.smartReasons], function () { return shared.youtube.partitionYouTubeVideoResults(videos, state.youtube.smartReasons); });
    const strong = groups.strong, broader = groups.broader;
    function grid(items){const columns=window.innerWidth>900?3:window.innerWidth>620?2:1;if(items.length>24)return window.LEARNED_MEDIA_WINDOWED.create(items,{className:"video-grid",cacheKey:state.workspaceId+":videos:"+columns,columns:function(){return window.innerWidth>900?3:window.innerWidth>620?2:1;},estimatedHeight:window.innerWidth<=620?285:260,gap:13,key:function(video){return video.id;},render:youtubeVideoCard});const result=node("div",{className:"video-grid"});items.forEach(function(video){result.appendChild(youtubeVideoCard(video));});return result;}
    return node("div",{},strong.length ? grid(strong) : null,broader.length ? node("section",{ariaLabel:"Broader recommendations"},node("h3",{text:"Broader recommendations"}),grid(broader)) : null);
  }
  function youtubeImportNotice() {
    const progress = state.youtubeProgress || {};
    const sourceCount = progress.completedSources !== undefined ? (progress.completedSources || 0) + "/" + (progress.totalSources || 0) + " sources" : (progress.completedChannels || 0) + "/" + (progress.totalChannels || 58) + " channels";
    const notice = node("div", { className: "video-import-notice", role: "status" }, node("div", {}, node("strong", { text: progress.phase === "paused" ? "Import paused" : state.youtubeStatus === "refreshing" ? "Refreshing your approved library" : "Building your approved library" }), node("span", { dataset: { youtubeProgressCount: "true" }, text: sourceCount + " · " + (progress.importedVideos || 0).toLocaleString() + " videos imported" + (state.youtubeError ? " · " + state.youtubeError : "") })));
    notice.appendChild(node("button", { className: "ghost-button", onClick: progress.phase === "paused" ? function () { youtubeConnect(false); } : progress.phase === "complete" || progress.phase === "error" ? function () { youtubeConnect(true); } : function () { state.youtubeStatus = "paused"; invalidateNativeYouTubeSync(); publishNativeYouTubeProgress(Object.assign({}, state.youtubeProgress, { phase: "paused" })); state.connectionToken += 1; generationToken += 1; bridge("cancelAll", {}).catch(function () {}); render(); } }, progress.phase === "paused" ? "Resume" : progress.phase === "complete" || progress.phase === "error" ? "Retry" : "Pause"));
    return notice;
  }
  function updateNativeYouTubeProgressNotices() {
    const progress = youtubeProgressStore.getSnapshot();
    const sourceCount = progress.completedSources !== undefined ? (progress.completedSources || 0) + "/" + (progress.totalSources || 0) + " sources" : (progress.completedChannels || 0) + "/" + (progress.totalChannels || 58) + " channels";
    document.querySelectorAll("[data-youtube-progress-count]").forEach(function (element) {
      element.textContent = sourceCount + " · " + (progress.importedVideos || 0).toLocaleString() + " videos imported" + (state.youtubeError ? " · " + state.youtubeError : "");
    });
  }
  function publishNativeYouTubeProgress(progress) {
    state.youtubeProgress = Object.assign({}, progress);
    youtubeProgressStore.publish(state.youtubeProgress);
    if (progress.phase === "complete" || progress.phase === "error") render();
  }
  function invalidateNativeYouTubeSync() {
    youtubeSyncToken += 1;
    youtubeSyncActive = false;
  }
  function idleNativeYouTubeProgress() {
    return { phase: "idle", completedChannels: 0, totalChannels: window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 };
  }
  function clearNativeYouTubeProgress() {
    const progress = state.youtubeProgress || {};
    if (progress.phase === "idle" && progress.completedChannels === 0 && progress.totalChannels === window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length && progress.importedVideos === 0 && progress.completedSources === 0 && progress.totalSources === 0 && !progress.currentSource && !progress.error) return;
    publishNativeYouTubeProgress(idleNativeYouTubeProgress());
  }
  function youtubeConnect(force) {
    const key = state.youtubeKey.trim();
    if (!key) { state.view = "settings"; showToast("Paste your YouTube API key in Settings first."); return; }
    if (youtubeSyncActive) return;
    youtubeSyncActive = true;
    const syncToken = ++youtubeSyncToken;
    const token = ++state.connectionToken;
    state.youtubeStatus = state.youtube.videos.length ? "refreshing" : "connecting"; state.youtubeError = ""; publishNativeYouTubeProgress({ phase: "resolving", completedChannels: 0, totalChannels: window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 }); render();
    window.LEARNED_MEDIA_YOUTUBE.sync(key, state.youtube, function (progress) { if (token !== state.connectionToken) return; publishNativeYouTubeProgress(progress); }, Boolean(force), function () { return token === state.connectionToken; }).then(async function (result) {
      if (token !== state.connectionToken) return;
      await bridge("commitYouTubeImportCatalog", { catalog: Object.assign({}, state.youtube, { channels: result.channels, videos: result.videos, sourceStates: result.sourceStates, catalogVersion: shared.youtube.YOUTUBE_CATALOG_VERSION, incomplete: result.incomplete, lastSyncAt: result.incomplete ? state.youtube.lastSyncAt : result.lastSyncAt }), completedSources: result.completedCheckpointSources, completedRefreshes: result.completedRefreshes });
      if (token !== state.connectionToken) return;
      const available = {}; result.videos.forEach(function (video) { available[video.id] = true; }); const preserved = (state.youtube.discoverIds || []).filter(function (id) { return available[id]; });
      state.youtube = Object.assign({}, state.youtube, { channels: result.channels, videos: result.videos, sourceStates: result.sourceStates, catalogVersion: shared.youtube.YOUTUBE_CATALOG_VERSION, incomplete: result.incomplete, lastSyncAt: result.incomplete ? state.youtube.lastSyncAt : (result.lastSyncAt || new Date().toISOString()), discoverIds: preserved }); state.youtubeStatus = result.incomplete ? "error" : "connected"; state.youtubeError = result.progress.error || ""; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtube.smartRan = false; videoSearchIndex(Boolean(force)); if (!preserved.length) state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(discoveryVideos(), 24, [],state.youtube.prioritizeRecentByChannel).map(function (video) { return video.id; }); saveState(); render(); showToast(result.incomplete ? "YouTube connected, but some approved sources need a retry." : "YouTube connected. Your approved video library is ready.");
    }).catch(function (error) { if (token !== state.connectionToken) return; state.youtubeStatus = "error"; state.youtubeError = error.message || "YouTube import failed."; publishNativeYouTubeProgress(Object.assign({}, state.youtubeProgress, { phase: "error" })); showToast(state.youtubeError); }).finally(function () { if (syncToken === youtubeSyncToken) youtubeSyncActive = false; });
  }
  const videoSearch = window.LEARNED_MEDIA_VIDEO_SEARCH;
  const preparedVideoSearchCache = new videoSearch.PreparedVideoSearchCache(4);
  let youtubeSemanticWorker = null, youtubeSemanticWorkerFailed = false, youtubeIndexedVideos = null, youtubeIndexRevision = 0, youtubeWorkerRequest = 0, youtubeIndexPolicy = "";
  let youtubeById = new Map(), youtubeVideosByTopic = new Map([["All", []]]), youtubeVideosByChannel = new Map(), youtubeSearchController = null, youtubeSearchInFlightKey = "", youtubeSearchAutoKey = "";
  let youtubeBrowseReturn = null, restoreYoutubeBrowseScroll = false, resetYoutubePlayerScroll = false;
  const youtubeLivePlaybackCheckpoints = new Map();
  let youtubeSearchPlan = null, youtubeSearchHasMore = true, youtubeSearchPaging = false, youtubePagingController = null, youtubeBrowseOrder = "newest", youtubeSearchVisibleCount = 80;
  const youtubeWorkerPending = new Map();
  function localVideoReason(candidate) { return videoSearch.videoSearchReason(candidate.video, youtubeSearchPlan || videoSearch.makeLocalVideoPlan(state.youtube.searchText), candidate.score); }
  let youtubeWorkerPatchQueue = null;
  function videoSearchIndex(force) {
    const policy = JSON.stringify([videoSearch.VIDEO_SEMANTIC_VERSION, state.youtube.catalogVersion]);
    force = Boolean(force) || policy !== youtubeIndexPolicy;
    if (!force && youtubeIndexedVideos === state.youtube.videos) return;
    const hadIndex = youtubeIndexedVideos !== null;
    state.youtube.videos = window.LEARNED_MEDIA_VIDEO_METADATA.reuseUnchangedVideoRecords(youtubeIndexedVideos || [], state.youtube.videos);
    const changes = window.LEARNED_MEDIA_VIDEO_METADATA.diffVideoSearchMetadata(youtubeById, state.youtube.videos);
    youtubeIndexedVideos = state.youtube.videos;
    youtubeById = new Map(youtubeIndexedVideos.map(function(video){ return [video.id,video]; }));
    youtubeVideosByTopic = shared.youtube.createYouTubeTopicPools(youtubeIndexedVideos);
    youtubeVideosByChannel = shared.youtube.createYouTubeChannelPools(youtubeIndexedVideos);
    if (hadIndex && !changes.changed && !force) return;
    const baseRevision = youtubeIndexRevision;
    youtubeIndexPolicy = policy;
    youtubeIndexRevision++;
    preparedVideoSearchCache.clear();
    youtubeSmartSearchCache.clear();
    for (const pending of youtubeWorkerPending.values()) pending.reject(new Error("Video catalog changed during search."));
    youtubeWorkerPending.clear();
    let newWorker = false;
    if (!youtubeSemanticWorker && !youtubeSemanticWorkerFailed && typeof Worker !== "undefined") {
      try {
        youtubeSemanticWorker = new Worker("youtube-search.worker.js");
        newWorker = true;
        youtubeSemanticWorker.onmessage = function(event) { const reply=event.data; if (reply.type === "rebuild") { if (reply.revision === youtubeIndexRevision) videoSearchIndex(true); return; } const pending=youtubeWorkerPending.get(reply.requestId); if (!pending) return; youtubeWorkerPending.delete(reply.requestId); if(reply.revision!==youtubeIndexRevision) pending.reject(new Error("Video catalog changed during search.")); else pending.resolve(reply.candidates.flatMap(function(candidate){ const video=youtubeById.get(candidate.videoId); return video ? [Object.assign({},candidate,{video:video})] : []; })); };
        youtubeSemanticWorker.onerror = function() { if (youtubeWorkerPatchQueue) youtubeWorkerPatchQueue.clear(); youtubeWorkerPatchQueue=null; youtubeSemanticWorkerFailed=true; youtubeSemanticWorker.terminate(); youtubeSemanticWorker=null; for(const pending of youtubeWorkerPending.values()) pending.reject(new Error("Video search worker unavailable.")); youtubeWorkerPending.clear(); };
      } catch(_) { youtubeSemanticWorkerFailed=true; }
    }
    if(youtubeSemanticWorker) {
      if(newWorker || force) {
        if(youtubeWorkerPatchQueue) youtubeWorkerPatchQueue.clear();
        youtubeWorkerPatchQueue=null;
        youtubeSemanticWorker.postMessage({type:"initialize",videos:youtubeIndexedVideos.map(window.LEARNED_MEDIA_VIDEO_METADATA.toVideoSearchDocument),revision:youtubeIndexRevision});
      } else {
        if(!youtubeWorkerPatchQueue) {
          const worker=youtubeSemanticWorker;
          youtubeWorkerPatchQueue=window.LEARNED_MEDIA_VIDEO_METADATA.createVideoSearchPatchQueue(function(patch) {
            if(worker===youtubeSemanticWorker) worker.postMessage(Object.assign({type:"update"},patch,{upserts:patch.upserts.map(window.LEARNED_MEDIA_VIDEO_METADATA.toVideoSearchDocument)}));
          });
        }
        youtubeWorkerPatchQueue.enqueue({baseRevision:baseRevision,revision:youtubeIndexRevision,upserts:changes.upserts,removeIds:changes.removeIds,orderIds:changes.orderIds});
      }
    }
  }
  async function localVideoCandidates(plan, limit, signal, excluded) {
    videoSearchIndex();
    if(signal.aborted) throw new DOMException("Search canceled","AbortError");
    if(youtubeWorkerPatchQueue) youtubeWorkerPatchQueue.flush();
    if(youtubeSemanticWorker) {
      const requestId=++youtubeWorkerRequest;
      try { return await new Promise(function(resolve,reject){
        const abort=function(){ youtubeWorkerPending.delete(requestId); youtubeSemanticWorker && youtubeSemanticWorker.postMessage({type:"cancel"}); reject(new DOMException("Search canceled","AbortError")); };
        signal.addEventListener("abort",abort,{once:true});
        youtubeWorkerPending.set(requestId,{resolve:function(value){signal.removeEventListener("abort",abort);resolve(value);},reject:function(error){signal.removeEventListener("abort",abort);reject(error);}});
        youtubeSemanticWorker.postMessage({type:"search",requestId:requestId,revision:youtubeIndexRevision,plan:plan,topic:state.youtube.topic,channelId:state.youtube.selectedChannelId,limit:limit,excludedIds:excluded || [],viewKey:String(state.workspaceId)+":"+String(state.account && state.account.id || "local")});
      }); } catch(error){ if(signal.aborted || /catalog changed/.test(error.message)) throw error; }
    }
    const scope=String(state.workspaceId)+":"+String(state.account && state.account.id || "local");
    const prepared=preparedVideoSearchCache.get(plan,state.youtube.topic,state.youtube.selectedChannelId,youtubeIndexRevision,scope);
    const excludedIds=excluded && excluded.length ? new Set(excluded) : new Set();
    return videoSearch.searchPreparedSemanticVideosYielding(state.youtube.videos,prepared,limit,excludedIds,signal);
  }
  function changeVideoSearch(value) {
    if(videoSearch.normalizeVideoQuery(value)!==videoSearch.normalizeVideoQuery(state.youtube.searchText)) {
      cancelYoutubeSearch(); youtubeSearchAutoKey=""; youtubeSearchVisibleCount=80;
      if(!state.youtube.searchText.trim()) youtubeBrowseOrder=state.youtube.order;
      state.youtube.smartRan=false; state.youtube.smartIds=null; state.youtube.smartReasons={};
      state.youtube.order=value.trim() ? videoSearch.makeLocalVideoPlan(value).sort || "relevance" : youtubeBrowseOrder;
    }
    state.youtube.searchText=value; state.youtubeSearchError=""; render();
  }
  function cancelYoutubeSearchRequests() {
    youtubeSearchRequests.forEach(function (request) { if (request && typeof request.cancel === "function") request.cancel(); });
    youtubeSearchRequests = [];
  }
  function trackedYoutubeSearchBridge(action, payload) {
    const request = bridge(action, payload);
    youtubeSearchRequests.push(request);
    return request;
  }
  async function youtubeSmartSearch(automatic) {
    automatic = automatic === true;
    const query=state.youtube.searchText.trim(); if(!query) return;
    videoSearchIndex();
    const cacheKey=scopedCacheKey(state.key,["video-semantic",videoSearch.VIDEO_SEMANTIC_VERSION,youtubeIndexRevision,state.youtube.catalogVersion,state.youtube.topic,state.youtube.selectedChannelId,state.youtube.order,videoSearch.normalizeVideoQuery(query)]);
    if(youtubeSearchInFlightKey===cacheKey && youtubeSearchController) { return; }
    if(youtubeSearchController) youtubeSearchController.abort(); cancelYoutubeSearchRequests();
    const controller=new AbortController(), signal=controller.signal, token=++youtubeSearchToken, revision=youtubeIndexRevision;
    youtubeSearchController=controller; youtubeSearchInFlightKey=cacheKey;
    let plan=Object.assign({},videoSearch.makeLocalVideoPlan(query,state.youtube.channels,state.youtube.selectedChannelId),{sort:state.youtube.order});
    function publish(ids,reasons){ if(signal.aborted || revision!==youtubeIndexRevision) return; youtubeSearchPlan=plan; state.youtube.smartIds=ids; state.youtube.smartReasons=reasons; state.youtube.smartRan=true; youtubeSearchHasMore=ids.length===80; render(); }
    try {
      const cached=youtubeSmartSearchCache.get(cacheKey);
      if(cached && (automatic || cached.ids.length || cached.expanded || !state.key.trim() || state.geminiStatus!=="connected")){ plan=cached.plan; publish(cached.ids.slice(),cached.reasons); return; }
      let candidates=await localVideoCandidates(plan,80,signal);
      let ranked=candidates.map(function(candidate){return Object.assign({videoId:candidate.video.id},videoSearch.videoSearchReason(candidate.video,plan,candidate.score));});
      publish(candidates.map(function(candidate){return candidate.video.id;}),Object.fromEntries(ranked.map(function(match){return [match.videoId,match];})));
      const needs=videoSearch.shouldEnrichVideoSearch(query,plan,candidates);
      let optionalFailed=false;
      if(needs && state.key.trim() && state.geminiStatus==="connected") {
        await new Promise(function(resolve,reject){
          const done=function(){clearTimeout(timer);signal.removeEventListener("abort",abort);resolve();};
          const timer=setTimeout(done,1500), abort=function(){clearTimeout(timer);reject(new DOMException("Search canceled","AbortError"));};
          if(signal.aborted) abort(); else signal.addEventListener("abort",abort,{once:true});
        });
        if(signal.aborted) return;
        state.youtubeSmartLoading=true;state.youtubeSearchPhase="interpreting";render();
        try {
          const interpreted=await trackedYoutubeSearchBridge("videoSearch",{key:state.key.trim(),query:query,catalogVersion:revision});
          if(signal.aborted) return;
          mergeGeminiModelOutcomes(interpreted.modelOutcomes || []);
          plan=videoSearch.mergeVideoSearchPlans(plan,interpreted,state.youtube.channels,state.youtube.selectedChannelId);
          candidates=await localVideoCandidates(plan,80,signal);
          ranked=candidates.map(function(candidate){return Object.assign({videoId:candidate.video.id},videoSearch.videoSearchReason(candidate.video,plan,candidate.score));});
          if(!ranked.length && plan.conceptGroups && plan.conceptGroups.length){
            state.youtubeSearchPhase="checking";render();
            const uncertain=await localVideoCandidates(Object.assign({},plan,{include:[],conceptGroups:plan.conceptGroups.map(function(group){return Object.assign({},group,{required:false});})}),40,signal);
            if(uncertain.length){const checked=await trackedYoutubeSearchBridge("videoSearchRank",{key:state.key.trim(),query:query,catalogVersion:revision,plan:plan,candidates:uncertain});if(signal.aborted)return;mergeGeminiModelOutcomes(checked.modelOutcomes || []);ranked=(checked.results || []).flatMap(function(match){const candidate=uncertain.find(function(item){return item.video.id===match.videoId;});if(!candidate)return [];const reason=videoSearch.videoSearchReason(candidate.video,plan,candidate.score,match.support || []);return reason.support.length ? [reason] : [];});}
          }
        } catch(error){if(signal.aborted)return;optionalFailed=true;state.youtubeSearchError="Meaning-based expansion is unavailable. Local matches remain available.";}
      }
      if(signal.aborted || token!==youtubeSearchToken || revision!==youtubeIndexRevision)return;
      const accepted=ranked.filter(function(match){const video=youtubeById.get(match.videoId);return video && video.id.indexOf("demo-")!==0 && videoSearch.eligibleSemanticVideo(video,plan,state.youtube.topic,state.youtube.selectedChannelId);}).sort(function(a,b){return (b.localScore || 0)-(a.localScore || 0);});
      const ids=accepted.map(function(match){return match.videoId;}), reasons=Object.fromEntries(accepted.map(function(match){return [match.videoId,match];}));
      if(plan.sort && plan.sort!=="relevance") state.youtube.order=plan.sort;
      state.youtubeSearchPhase=optionalFailed ? "error" : "idle";
      publish(ids,reasons);
      if(!optionalFailed && (!needs || state.key.trim() && state.geminiStatus==="connected"))youtubeSmartSearchCache.set(cacheKey,{ids:ids,reasons:reasons,plan:plan,expanded:needs && Boolean(state.key.trim() && state.geminiStatus==="connected")});
      if(!automatic)showToast(ids.length+" relevant approved video"+(ids.length===1?"":"s")+" matched your search.");
    } catch(error){if(!signal.aborted){state.youtubeSearchPhase="error";state.youtubeSearchError=error.message || "Video search could not complete.";}}
    finally{if(youtubeSearchController===controller){youtubeSearchController=null;youtubeSearchInFlightKey="";state.youtubeSmartLoading=false;render();}if(token===youtubeSearchToken)youtubeSearchRequests=[];}
  }
  function cancelYoutubeSearch(){if(youtubePagingController)youtubePagingController.abort();if(youtubeSearchController)youtubeSearchController.abort();youtubeSearchController=null;youtubeSearchInFlightKey="";youtubeSearchToken++;cancelYoutubeSearchRequests();state.youtubeSmartLoading=false;state.youtubeSearchPhase="idle";}
  function automaticYoutubeSearch(){
    if(state.youtube.selectedVideoId){if(youtubeSearchController){cancelYoutubeSearch();youtubeSearchAutoKey="";}return;}
    if(state.view!=="videos" || !state.youtube.searchText.trim() || state.youtube.tab!=="discover" && !state.youtube.selectedChannelId){if(youtubeSearchController)cancelYoutubeSearch();return;}
    videoSearchIndex();
    const key=scopedCacheKey(state.key,[youtubeIndexRevision,state.youtube.topic,state.youtube.selectedChannelId,state.youtube.order,videoSearch.normalizeVideoQuery(state.youtube.searchText)]);
    if(youtubeSearchAutoKey===key)return;youtubeSearchAutoKey=key;void youtubeSmartSearch(true);
  }
  async function showMoreYoutube(){
    if(state.youtube.searchText.trim()){
      if(youtubeSearchPaging || !youtubeSearchPlan || !youtubeSearchHasMore)return;
      youtubeSearchPaging=true;const token=youtubeSearchToken,controller=new AbortController();youtubePagingController=controller;
      try{const next=await localVideoCandidates(youtubeSearchPlan,80,controller.signal,state.youtube.smartIds || []);if(token!==youtubeSearchToken)return;state.youtube.smartIds=(state.youtube.smartIds || []).concat(next.map(function(candidate){return candidate.video.id;}));next.forEach(function(candidate){state.youtube.smartReasons[candidate.video.id]=localVideoReason(candidate);});youtubeSearchVisibleCount+=80;youtubeSearchHasMore=next.length===80;render();}catch(error){if(!controller.signal.aborted)showToast("More search results are temporarily unavailable.");}finally{youtubeSearchPaging=false;youtubePagingController=null;}
    }else{const next=window.LEARNED_MEDIA_YOUTUBE.shuffle(discoveryVideos(),24,state.youtube.discoverIds,state.youtube.prioritizeRecentByChannel);state.youtube.discoverIds=state.youtube.discoverIds.concat(next.map(function(video){return video.id;}));render();}
  }
  function youtubeFilteredVideos(){
    videoSearchIndex();
    const tab=state.youtube.tab, query=state.youtube.searchText.trim();
    const key=[state.workspaceId,tab,youtubeIndexRevision];
    if(tab==="saved")key.push(state.youtube.savedIds);
    else if(tab==="history")key.push(state.youtube.history);
    else if(query)key.push(query,state.youtube.smartRan,state.youtube.smartIds,state.youtube.selectedChannelId,state.youtube.topic,state.youtube.order,state.youtube.prioritizeRecentByChannel);
    else if(state.youtube.selectedChannelId)key.push(state.youtube.selectedChannelId,state.youtube.topic,state.youtube.order,state.youtube.prioritizeRecentByChannel);
    else key.push(state.youtube.topic,state.youtube.discoverIds);
    return youtubeFilteredListMemo(key,function(){
      const all=state.youtube.videos || [];
      if(tab==="saved")return state.youtube.savedIds.map(function(id){return youtubeById.get(id);}).filter(Boolean);
      if(tab==="history")return state.youtube.history.map(function(item){return youtubeById.get(item.videoId);}).filter(Boolean);
      let matches;
      if(query)matches=state.youtube.smartRan ? (state.youtube.smartIds || []).map(function(id){return youtubeById.get(id);}).filter(Boolean) : [];
      else if(state.youtube.selectedChannelId)matches=window.LEARNED_MEDIA_YOUTUBE.filter(youtubeVideosByChannel.get(state.youtube.selectedChannelId)||[],"",state.youtube.topic,state.youtube.selectedChannelId);
      else return window.LEARNED_MEDIA_YOUTUBE.filter((state.youtube.discoverIds || []).map(function(id){return youtubeById.get(id);}).filter(Boolean),"",state.youtube.topic);
      if(state.youtube.selectedChannelId){if(state.youtube.order==="newest")matches.sort(function(a,b){return b.publishedAt.localeCompare(a.publishedAt);});else if(state.youtube.order==="oldest")matches.sort(function(a,b){return a.publishedAt.localeCompare(b.publishedAt);});else if(state.youtube.order==="random")matches=window.LEARNED_MEDIA_YOUTUBE.shuffle(matches,matches.length,[],state.youtube.prioritizeRecentByChannel);}
      return matches;
    });
  }
  function discoveryVideos(videos) {
    videoSearchIndex();
    const source = videos || state.youtube.videos;
    if (source === youtubeIndexedVideos) return youtubeVideosByTopic.get(state.youtube.topic) || [];
    return window.LEARNED_MEDIA_YOUTUBE.filter(source,"",state.youtube.topic);
  }
  function relatedVideosFor(video, identity) {
    if (playerEndedIdentity !== identity) return [];
    videoSearchIndex();
    const seen = new Set(), pool = [];
    (video.topics || []).forEach(function(topic) { (youtubeVideosByTopic.get(topic) || []).forEach(function(candidate) { if(candidate.id!==video.id && !seen.has(candidate.id)){seen.add(candidate.id);pool.push(candidate);} }); });
    return shared.youtube.relatedYouTubeVideos(pool,video,6,state.youtube.prioritizeRecentByChannel);
  }
  function youtubeBackToVideos() {
    restoreYoutubeBrowseScroll = Boolean(youtubeBrowseReturn && youtubeBrowseReturn.ownerID===youtubeOwnerID() && youtubeBrowseReturn.workspaceID===state.workspaceId);
    state.youtube.selectedVideoId=null;
    render();
  }
  function videoTabs() {
    const items=[["discover","Discover"],["channels","Channels"],["saved","Saved"],["history","History"]];
    const tabs=node("div",{className:"video-tabs",role:"tablist",ariaLabel:"Video views",onKeydown:function(event){
      const index=items.findIndex(function(item){return item[0]===state.youtube.tab;});let next;
      if(event.key==="ArrowRight")next=(index+1)%4;else if(event.key==="ArrowLeft")next=(index+3)%4;else if(event.key==="Home")next=0;else if(event.key==="End")next=3;else return;
      event.preventDefault();tabs.querySelectorAll("button")[next].click();
    }});
    items.forEach(function(item){tabs.appendChild(node("button",{className:state.youtube.tab===item[0]?"active":"",role:"tab",ariaSelected:state.youtube.tab===item[0],tabindex:state.youtube.tab===item[0]?0:-1,dataset:{videoTab:item[0]},onClick:function(){youtubeBrowseReturn=null;state.youtube.tab=item[0];state.youtube.selectedChannelId=null;state.youtube.selectedVideoId=null;saveState();render();requestAnimationFrame(function(){document.querySelector('[data-video-tab="'+item[0]+'"]')?.focus({preventScroll:true});});}},item[1],item[0]==="saved" && state.youtube.savedIds.length?node("small",{text:String(state.youtube.savedIds.length)}):null));});return tabs;
  }
  function youtubeDetail(video) {
    const section = node("section", { className: "content-view video-workspace" });
    section.appendChild(videoTabs());
    section.appendChild(node("button", { className: "text-button video-back-button", onClick: youtubeBackToVideos }, svg("chevronRight", 15), " Back to videos"));
    const ownerID = youtubeOwnerID();
    const ownerWorkspaceId = state.workspaceId;
    const identity = youtubePlayerIdentity(ownerID, ownerWorkspaceId, video.id);
    const reusePlayer = playerIdentity === identity && playerShell;
    const player = reusePlayer || node("div", { className: "video-player-shell" });
    let frame = reusePlayer ? playerFrame : null;
    if (!reusePlayer && video.embedAvailable) {
      const position = Number(state.youtube.playbackPositions[video.id] || 0);
      const start = position > 1 ? "&start=" + Math.floor(position) : "";
      frame = node("iframe", { title: video.title, src: "https://www.youtube.com/embed/" + encodeURIComponent(video.id) + "?enablejsapi=1&origin=https%3A%2F%2Fcom.learnedmedia.app&rel=0&playsinline=1" + start, allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share", allowFullscreen: "true", referrerpolicy: "strict-origin-when-cross-origin" });
      player.appendChild(frame);
    }
    else if (!reusePlayer) player.appendChild(node("div", { className: "video-unavailable" }, svg("external", 24), node("strong", { text: "Watch this one on YouTube" }), externalLink(youtubeURL(video.id), "Open video", "api-key-link")));
    const playerColumn = node("div", { className: "video-player-column" });
    playerColumn.appendChild(player);
    const heading = node("div", { className: "video-player-heading" });
    heading.appendChild(node("div", {}, node("span", { className: "eyebrow", text: "Now watching" }), node("h1", { text: video.title }), node("p", { text: video.channelName + " · " + youtubeDate(video.publishedAt) + " · " + video.durationLabel })));
    heading.appendChild(node("button", { className: "secondary-button", onClick: function () { youtubeSave(video.id); } }, svg("bookmark", 15), state.youtube.savedIds.indexOf(video.id) >= 0 ? " Saved" : " Save video"));
    playerColumn.appendChild(heading);
    playerColumn.appendChild(node("div", { className: "video-player-links" }, externalLink(youtubeURL(video.id), "Watch on YouTube", "ghost-button"), node("span", { text: (video.topics || []).join(" · ") })));
    section.appendChild(node("div", { className: "video-player-layout" }, playerColumn));
    const related = relatedVideosFor(video, identity);
    if (related.length) playerColumn.appendChild(node("section", { className: "video-related" }, node("div", { className: "section-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Up next to explore" }), node("h2", { text: "More like this" }))), youtubeList(related)));

    playerIdentity = identity; playerShell = player; playerFrame = frame;
    if (frame && !reusePlayer) {
      const playback = window.LEARNED_MEDIA_PLAYBACK.watchYouTubePlayback(frame, {
        initialSeconds: Number(state.youtube.playbackPositions[video.id] || 0),
        saveIntervalMs: 15000,
        onEnded:function(){if(state.workspaceId===ownerWorkspaceId && youtubeOwnerID()===ownerID && state.youtube.selectedVideoId===video.id){playerEndedIdentity=identity;render();}},
        onSave: function (second) {
          if (!Number.isFinite(second) || second < 0) return;
          const normalizedSecond = Math.floor(second);
          if (state.workspaceId !== ownerWorkspaceId || youtubeOwnerID() !== ownerID || state.youtube.selectedVideoId !== video.id) return;
          if (Math.floor(state.youtube.playbackPositions[video.id] || 0) !== normalizedSecond) state.youtube.playbackPositions[video.id] = normalizedSecond;
          youtubeLivePlaybackCheckpoints.set(ownerID+"\u0000"+ownerWorkspaceId,{videoID:video.id,seconds:normalizedSecond,updatedAt:Date.now()/1000});
          if(youtubeLivePlaybackCheckpoints.size>200)youtubeLivePlaybackCheckpoints.delete(youtubeLivePlaybackCheckpoints.keys().next().value);
          bridge("saveYouTubePlaybackCheckpoint", { ownerID: ownerID, workspaceID: ownerWorkspaceId, videoID: video.id, seconds: normalizedSecond }).catch(function() {});
        }
      });
      stopYoutubePlayback = function () { playback.stop(); stopYoutubePlayback = null; };
    }
    return section;
  }
  function videosView() {
    setTimeout(automaticYoutubeSearch,0);
    const section = node("section", { className: "content-view video-workspace" });
    if (state.youtube.selectedVideoId) { const selected = youtubeById.get(state.youtube.selectedVideoId); if (selected) return youtubeDetail(selected); }
    if (state.youtube.selectedChannelId) {
      section.appendChild(videoTabs());
      const channel = state.youtube.channels.find(function (item) { return item.id === state.youtube.selectedChannelId; });
      section.appendChild(node("button", { className: "text-button video-back-button", onClick: function () { cancelYoutubeSearch(); youtubeBrowseReturn = null; state.youtube.selectedChannelId = null; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; render(); } }, svg("chevronRight", 15), " All channels"));
      section.appendChild(node("div", { className: "view-heading video-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Channel catalog" }), node("h1", { text: channel ? channel.name : "Channel" }), node("p", { text: channel ? channel.videoCount.toLocaleString() + " imported videos from this approved channel" : "" }))));
      const controls = node("div", { className: "video-controls" });
      controls.appendChild(node("label", { className: "video-search" }, svg("search", 16), node("input", { id: "youtube-search", value: state.youtube.searchText, placeholder: "Search this channel", ariaLabel: "Search this channel", onKeydown: function(event){if(event.key==="Enter"){event.preventDefault();void youtubeSmartSearch(false);}}, onInput: function (event) { changeVideoSearch(event.target.value); } })));
      controls.appendChild(node("button", { className: "ghost-button", disabled: Boolean(state.youtubeSmartLoading) || !state.youtube.searchText.trim(), onClick: function(){void youtubeSmartSearch(false);} }, state.youtubeSmartLoading ? "Searching" : "Smart search"));
      controls.appendChild(node("select", { value: state.youtube.order, ariaLabel: "Sort channel videos", onChange: function (event) { state.youtube.order = event.target.value; saveState(); render(); } }, node("option", { value: "relevance", text: "Relevance" }), node("option", { value: "newest", text: "Newest" }), node("option", { value: "oldest", text: "Oldest" }), node("option", { value: "random", text: "Random" })));
      section.appendChild(controls);
      if (state.youtubeSmartLoading) section.appendChild(node("div", { className: "video-search-progress", role: "status" }, node("span", { text: state.youtubeSearchPhase === "interpreting" ? "Understanding your search" : state.youtubeSearchPhase === "expanding" ? "Looking more broadly" : "Checking matches" }), node("button", { className: "text-button", onClick: function(){cancelYoutubeSearch();render();} }, "Cancel")));
      if (state.youtubeSearchPhase === "error" && state.youtubeSearchError) section.appendChild(node("p", { className: "video-search-error", text: state.youtubeSearchError }));
      section.appendChild(youtubeList(youtubeFilteredVideos()));
      if (state.youtube.searchText.trim() && youtubeSearchHasMore) section.appendChild(node("div", { className: "video-show-more" }, node("button", { className: "small-load-button", disabled: youtubeSearchPaging || state.youtubeSmartLoading, onClick: showMoreYoutube }, "Show more matching videos")));
      return section;
    }
    const videoHeading = node("div", { className: "view-heading video-heading" });
    const videoHeadingCopy = node("div", {});
    videoHeadingCopy.appendChild(node("span", { className: "eyebrow", text: "Learned Media Videos" }));
    videoHeadingCopy.appendChild(node("h1", { text: state.youtube.tab === "saved" ? "Saved videos" : state.youtube.tab === "history" ? "Watch history" : "A calmer way to find something good." }));
    videoHeadingCopy.appendChild(node("p", { text: state.youtube.tab === "saved" ? "The videos you saved for another time." : state.youtube.tab === "history" ? "Videos you have opened in this workspace." : "Discover approved creators, search their imported catalogs, and watch without leaving your workspace." }));
    videoHeading.appendChild(videoHeadingCopy);
    if (state.youtube.tab === "discover") {
      const headingActions = node("div", { className: "video-heading-actions" });
      headingActions.appendChild(node("button", { className: "secondary-button", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: function () { youtubeConnect(true); } }, svg("reset", 15), " Refresh videos"));
      headingActions.appendChild(node("button", { className: "secondary-button", disabled: !state.youtube.videos.length, onClick: function () { state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(discoveryVideos(), 24, [],state.youtube.prioritizeRecentByChannel).map(function (video) { return video.id; }); state.youtube.tab = "discover"; saveState(); render(); } }, svg("reset", 15), " Shuffle"));
      headingActions.appendChild(node("button", { className: "primary-button small", disabled: !state.youtube.videos.length || Boolean(state.youtube.searchText.trim() && !youtubeSearchHasMore), onClick: showMoreYoutube }, svg("plus", 15), " Show more"));
      videoHeading.appendChild(headingActions);
    }
    section.appendChild(videoHeading);
    if ((state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing" || state.youtubeStatus === "error" || state.youtube.incomplete) && state.youtubeProgress.phase !== "idle") section.appendChild(youtubeImportNotice());
    section.appendChild(videoTabs());
    if (state.youtube.tab === "discover") { const controls = node("div", { className: "video-controls" }); controls.appendChild(node("label", { className: "video-search" }, svg("search", 16), node("input", { id: "youtube-search", value: state.youtube.searchText, placeholder: "Search approved videos", ariaLabel: "Search approved videos", onKeydown: function(event){if(event.key==="Enter"){event.preventDefault();void youtubeSmartSearch(false);}}, onInput: function (event) { changeVideoSearch(event.target.value); } }))); controls.appendChild(node("button", { className: "ghost-button", disabled: Boolean(state.youtubeSmartLoading) || !state.youtube.searchText.trim(), onClick: function(){void youtubeSmartSearch(false);} }, state.youtubeSmartLoading ? "Searching" : "Smart search")); if (state.youtubeSmartLoading) controls.appendChild(node("button", { className: "text-button", onClick: function(){cancelYoutubeSearch();render();} }, "Cancel")); section.appendChild(controls); if (state.youtubeSearchPhase === "error" && state.youtubeSearchError) section.appendChild(node("p", { className: "video-search-error", text: state.youtubeSearchError })); const filters = node("div", { className: "video-topic-filters" }); ["All"].concat(window.LEARNED_MEDIA_YOUTUBE.TOPICS).forEach(function (topic) { filters.appendChild(node("button", { className: state.youtube.topic === topic ? "active" : "", onClick: function () { if (state.youtubeSmartLoading) cancelYoutubeSearch(); state.youtube.topic = topic; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtubeSearchError = ""; state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(discoveryVideos(), 24, [],state.youtube.prioritizeRecentByChannel).map(function (video) { return video.id; }); render(); } }, topic === "All" ? "All topics" : topic)); }); section.appendChild(filters); }
    if (state.youtube.tab === "channels") { if (state.youtube.channels.length) { const channels = node("div", { className: "channel-grid" }); state.youtube.channels.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (channel) { channels.appendChild(node("button", { className: "channel-card", onClick: function () { youtubeOpenChannel(channel.id); } }, channel.thumbnailUrl ? node("img", { src: channel.thumbnailUrl, alt: "" }) : node("span", { className: "channel-avatar", text: channel.name.slice(0, 1) }), node("span", {}, node("strong", { text: channel.name }), node("small", { text: channel.videoCount.toLocaleString() + " videos" })), svg("chevronRight", 17))); }); section.appendChild(channels); } else section.appendChild(node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg("image", 24)), node("h2", { text: "Connect YouTube to start discovering" }), node("p", { text: "Paste your own YouTube Data API key in Settings. The catalog stays limited to approved creators and videos." }), node("button", { className: "primary-button", onClick: function () { state.view = "settings"; render(); } }, "Open video settings"))); }
    else if (state.youtube.videos.length || state.youtube.tab === "saved" || state.youtube.tab === "history") section.appendChild(youtubeList(youtubeFilteredVideos()));
    else section.appendChild(node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg("image", 24)), node("h2", { text: "Connect YouTube to start discovering" }), node("p", { text: "Paste your own YouTube Data API key in Settings. The catalog stays limited to approved creators and videos." }), node("button", { className: "primary-button", onClick: function () { state.view = "settings"; render(); } }, "Open video settings")));
    if(state.youtube.tab === "discover" && state.youtube.videos.length){
      const sentinel=node("div",{className:"video-load-sentinel","aria-hidden":"true"});section.appendChild(sentinel);
      requestAnimationFrame(function(){if(!sentinel.isConnected || typeof IntersectionObserver === "undefined")return;const owner=state.workspaceId;videoLoadObserver=new IntersectionObserver(function(entries){if(owner!==state.workspaceId || !sentinel.isConnected)return;if(entries.some(function(entry){return entry.isIntersecting;}) && !youtubeSearchPaging && !state.youtubeSmartLoading){if(state.youtube.searchText.trim()){if(youtubeSearchHasMore)showMoreYoutube();}else if(youtubeFilteredVideos().length<discoveryVideos().length)showMoreYoutube();}},{root:/auto|scroll/.test(getComputedStyle(document.querySelector(".main-scroll")).overflowY)?document.querySelector(".main-scroll"):null,rootMargin:"500px"});videoLoadObserver.observe(sentinel);});
    }
    return section;
  }
  function searchText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function searchScore(query, text) {
    const wanted = searchText(query); const haystack = searchText(text);
    if (!wanted || !haystack) return 0;
    if (haystack.indexOf(wanted) >= 0) return 100;
    const tokens = wanted.split(" ").filter(function (word) { return word.length > 1; });
    const words = haystack.split(" "); let matched = 0; let score = 0;
    tokens.forEach(function (token) {
      let best = 0;
      words.forEach(function (word) {
        if (token === word) best = Math.max(best, 20);
        else if (word.indexOf(token) === 0 || token.indexOf(word) === 0) best = Math.max(best, 13);
        else if (token.length >= 4 && word.length >= 4) {
          let previous = Array.from({ length: word.length + 1 }, function (_, index) { return index; });
          for (let row = 1; row <= token.length; row += 1) { const current = [row]; for (let column = 1; column <= word.length; column += 1) current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (token[row - 1] === word[column - 1] ? 0 : 1)); previous = current; }
          if (previous[word.length] <= (token.length >= 8 ? 2 : 1)) best = Math.max(best, 7);
        }
      });
      if (best) { matched += 1; score += best; }
    });
    return matched && matched / tokens.length >= (tokens.length > 1 ? 0.5 : 1) ? score + (matched === tokens.length ? 12 : 0) : 0;
  }
  function topicMatches(topic, query) {
    if (!query) return true;
    return topicTreeVisible.has(topic.id);
  }
  function topicRow(topic, depth, query, shallow) {
    if (query && !topicMatches(topic, query)) return null;
    const hasChildren = Boolean(topic.children && topic.children.length);
    const selection = selectionState(topic);
    const searchExpanded = Boolean(query && topicTreeAncestors.has(topic.id));
    const searchOverride = topicSearchExpansionOverrides.get(topic.id);
    const childrenVisible = hasChildren && (query ? searchOverride === undefined ? (!topicSearchExpansionSuppressed && (topic.expanded || searchExpanded)) : searchOverride : topic.expanded);
    const branchWrap = node("div", { className: "topic-branch" });
    const row = node("div", { className: "topic-row" + (depth === 0 ? " root-row" : "") + (!hasChildren ? " leaf-row" : "") + (topic.custom ? " custom-row" : "") + " selection-" + selection, dataset: { topicId: topic.id }, onClick: function (event) { if (event.target.closest && event.target.closest("button")) return; toggleTopicSelection(topic.id); saveState(); render(); } });
    row.style.paddingLeft = Math.min(depth, 5) * 20 + 4 + "px";
    row.appendChild(node("button", { className: "topic-expand", disabled: !hasChildren, ariaLabel: (childrenVisible ? "Hide" : "Show") + " subtopics for " + topic.label, ariaExpanded: hasChildren ? childrenVisible : undefined, dataset: { topicId: topic.id }, onClick: function () { if (!hasChildren) return; setTopicBranchExpanded(topic, query, !childrenVisible); } }, hasChildren ? svg(childrenVisible ? "chevronDown" : "chevronRight", 15) : null));
    row.appendChild(node("button", { className: "topic-check" + (selection === "selected" ? " checked" : "") + (selection === "mixed" ? " mixed" : ""), ariaLabel: (selection === "selected" ? "Deselect " : "Select ") + topic.label, ariaPressed: selection === "selected", dataset: { topicId: topic.id }, onClick: function () { toggleTopicSelection(topic.id); saveState(); render(); } }, selection === "selected" ? svg("check", 14) : selection === "mixed" ? node("span", { className: "topic-check-dash" }) : null));
    const nameWrap = node("div", { className: "topic-name-wrap" + (selection === "none" ? " unselected" : "") });
    nameWrap.appendChild(node("span", { className: "topic-name" + (selection === "selected" ? " selected" : ""), text: topic.label }));
    if (hasChildren) nameWrap.appendChild(node("button", { className: "topic-subtopics-toggle", ariaExpanded: childrenVisible, dataset: { topicId: topic.id }, onClick: function () { setTopicBranchExpanded(topic, query, !childrenVisible); } }, childrenVisible ? "Hide Subtopics" : "Show Subtopics"));
    row.appendChild(nameWrap);
    if (topic.custom) {
      const customActions = node("span", { className: "custom-topic-actions" });
      customActions.appendChild(node("span", { className: "custom-mark", text: "Custom" }));
      customActions.appendChild(node("button", { className: "topic-remove", ariaLabel: "Delete custom topic " + topic.label, title: "Delete custom topic", onClick: function () { removeCustomTopic(topic.id); } }, svg("trash", 13)));
      row.appendChild(customActions);
    }
    const weight = node("div", { className: "topic-weight" + (selection === "none" ? " disabled" : "") });
    weight.appendChild(node("button", { disabled: selection === "none", ariaLabel: "Lower " + topic.label + " weight", dataset: { topicId: topic.id }, onClick: function () { state.topics = updateTopicById(state.topics,topic.id,function(current){return Object.assign({},current,{weight:Math.max(5,current.weight-5)});}); saveState(); render(); } }, svg("minus", 12)));
    weight.appendChild(node("span", { className: "topic-weight-value", text: topic.weight }));
    weight.appendChild(node("button", { disabled: selection === "none", ariaLabel: "Raise " + topic.label + " weight", dataset: { topicId: topic.id }, onClick: function () { state.topics = updateTopicById(state.topics,topic.id,function(current){return Object.assign({},current,{weight:Math.min(100,current.weight+5)});}); saveState(); render(); } }, svg("plus", 12)));
    row.appendChild(weight);
    branchWrap.appendChild(row);
    if (childrenVisible && !shallow) {
      const children = node("div", { className: "topic-children" });
      children.style.setProperty("--guide-left", Math.min(depth + 1, 5) * 20 + 28 + "px");
      topic.children.forEach(function (child) { const childRow = topicRow(child, depth + 1, query); if (childRow) children.appendChild(childRow); });
      branchWrap.appendChild(children);
    }
    return branchWrap;
  }
  function setTopicBranchExpanded(topic, query, expanded) {
    if (query) topicSearchExpansionOverrides.set(topic.id, Boolean(expanded));
    else state.topics = updateTopicById(state.topics,topic.id,function(current){return Object.assign({},current,{expanded:Boolean(expanded)});});
    saveState();
    render();
  }
  function topicTree() {
    const picker = node("div", { className: "topic-tree-picker" });
    const actions = node("div", { className: "topic-tree-actions" });
    actions.appendChild(node("button", { className: "topic-tree-collapse-button", ariaLabel: "Collapse all topic branches", onClick: function () { topicSearchExpansionSuppressed = true; topicSearchExpansionOverrides.clear(); state.topics = collapseTopicBranches(state.topics); saveState(); render(); } }, "Collapse all"));
    picker.appendChild(actions);
    const tree = node("div", { className: "topic-tree", role: "tree", ariaLabel: "Topic browser" });
    const query = state.topicQuery.trim();
    if(query)scheduleTopicSearch(query);
    const visible=[];
    function visit(nodes,depth){for(const topic of nodes){if(query && !topicMatches(topic,query))continue;visible.push({topic:topic,depth:depth});const expanded=topic.children?.length && (query ? topicSearchExpansionOverrides.has(topic.id) ? topicSearchExpansionOverrides.get(topic.id) : !topicSearchExpansionSuppressed && topicTreeAncestors.has(topic.id) : topic.expanded);if(expanded)visit(topic.children,depth+1);}}
    visit(state.topics,0);
    if(visible.length>40)tree.appendChild(window.LEARNED_MEDIA_WINDOWED.create(visible,{className:"native-topic-window",cacheKey:state.workspaceId+":topics",estimatedHeight:66,gap:0,key:function(item){return item.topic.id;},render:function(item){return topicRow(item.topic,item.depth,query,true);}}));
    else visible.forEach(function(item){tree.appendChild(topicRow(item.topic,item.depth,query,true));});
    picker.appendChild(tree);
    return picker;
  }
  function collapseTopicBranches(topics) { return shared.collapseTopicBranches(topics); }
  function cancelWorkspaceOperations() {
    if (youtubeSyncActive || state.youtubeProgress.phase !== "idle") {
      invalidateNativeYouTubeSync();
      state.youtubeStatus = state.youtube.incomplete ? "error" : state.youtube.videos.length ? "connected" : "not-configured";
      state.youtubeError = "";
      publishNativeYouTubeProgress(idleNativeYouTubeProgress());
    }
    for(const entry of learningTasks.values())entry.task?.cancel?.();learningTasks.clear();
    clearTopicDetourCompletionNotice();
    state.repeatBatchPreview = null;
    state.repeatMenuOpen = false;
    if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
    activeGenerationTask = null;
    activeGenerationDetourId = null;
    clearFactAngleBatch();
    state.topicDetour = null;
    cancelCardAdaptation();
    cancelCardGlossary();
    focusedLocationHeadingCardId = null;
    focusedLocationTriggerCardId = null;
    const workspacePrefix = state.workspaceId + "\u0000";
    nativeLocationLoads.forEach(function (request, key) {
      if (!key.startsWith(workspacePrefix) || request.status !== "loading") return;
      if (request.coordinateTask && typeof request.coordinateTask.cancel === "function") request.coordinateTask.cancel();
      nativeLocationLoads.set(key, Object.assign({}, request, { status: "idle", coordinateTask: null }));
    });
    closeLearnMenu(false);
    closeDifficultyMenu(false);
    generationToken += 1;
    state.connectionToken += 1;
    state.generationRequestToken += 1;
    cancelYoutubeSearch();
    youtubeSearchAutoKey = "";
    cancelPendingSemanticSearch();
    state.loading = false;
    state.loadingCard = null; state.questionLoading = null;
    state.adaptationLoading = null;
    state.youtubeSmartLoading = false;
    if (stopYoutubePlayback) stopYoutubePlayback();
    cancelImageHydrations();
    for (const [requestKey, request] of sourceSpotlightRequests) {
      if (request.workspaceId === state.workspaceId) nativeCancelSpotlightRequest(requestKey);
    }
    cancelNativeDownload();
    bridge("cancelAll", {}).catch(function () {});
  }
  function applyWorkspaceSnapshot(record, preserveReadingState) {
    const snapshot = record.state || record;
    if (!preserveReadingState) {
      clearFactAngleBatch();
      clearTopicDetourCompletionNotice();
      questionDrafts.clear();questionStructures.clear();questionStructureRevisions.clear();questionInstructionPreferences.clear();questionInstructionRevisions.clear();answerOptionsOpenKey="";
    }
    state.workspaceId = record.id || "local-workspace";
    state.lastCompletedBatchSetup = batchReplay.isBatchSetup(snapshot.lastCompletedBatchSetup) ? snapshot.lastCompletedBatchSetup : null;
    if (!preserveReadingState) {
      state.repeatBatchPreview = null;
      state.repeatMenuOpen = false;
      state.topicDetour = null;
      state.rabbitHole = null;
    }
    state.workspaceName = record.name || "Local Workspace";
    const catalogVersion = Number(snapshot.catalogVersion || snapshot.topicCatalogVersion || 0);
    state.topics = shared.restoreTopicPreferences(snapshot.topics,catalogVersion < 11) || migrateTopics(snapshot.topics || makeTopics(), catalogVersion < 11, catalogVersion < 11);
    topicResetEpoch++;
    state.settings = Object.assign({}, DEFAULT_SETTINGS, snapshot.settings || {}, { sentenceLength: normalizeSentenceLength(snapshot.settings && snapshot.settings.sentenceLength) });
    state.cards = (snapshot.cards || []).filter(function (card) { return !KNOWN_DEMO_IDS.has(card.id); }).map(normalizeCard).filter(function (card) { return card.id && card.title && card.body && card.topicPath && card.topicPath.length && card.sources && card.sources.length; });
    state.profile = difficultyEngine.normalizeLearningProfile(snapshot.profile || snapshot.learningProfile || {}, state.settings.obscurity);
    state.started = Boolean((snapshot.started ?? snapshot.feedStarted) && state.cards.length);
    applyYoutubeActivity(snapshot.youtubeActivity || snapshot.youtube, snapshot.youtube && snapshot.youtube.prioritizeRecentByChannel);
  }
  function workspaceMenu() {
    const menu = node("div", { className: "workspace-menu", role: "menu" });
    menu.appendChild(node("span", { className: "workspace-menu-label", text: "All workspaces" }));
    state.workspaces.forEach(function (workspace, index) {
      const row = node("div", { className: "workspace-menu-row" });
      if (state.renameWorkspaceId === workspace.id) {
        const form = node("form", { className: "workspace-rename-form" });
        const input = node("input", {
          type: "text",
          maxLength: "48",
          value: state.renameWorkspaceDraft,
          ariaLabel: "Rename " + workspace.name,
          "aria-invalid": state.renameWorkspaceError ? "true" : null,
          onInput: function (event) {
            state.renameWorkspaceDraft = event.currentTarget.value;
            state.renameWorkspaceError = "";
            event.currentTarget.removeAttribute("aria-invalid");
            const error = form.querySelector(".workspace-rename-error");
            if (error) error.textContent = "";
          },
          onKeydown: function (event) {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancelWorkspaceRename(menu);
            }
          }
        });
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          commitWorkspaceRename(workspace.id, menu);
        });
        form.appendChild(input);
        form.appendChild(node("span", { className: "workspace-rename-error", role: "status", "aria-live": "polite", text: state.renameWorkspaceError }));
        const renameActions = node("div", { className: "workspace-rename-actions" });
        renameActions.appendChild(node("button", { type: "submit" }, "Save"));
        renameActions.appendChild(node("button", { type: "button", onClick: function () { cancelWorkspaceRename(menu); } }, "Cancel"));
        form.appendChild(renameActions);
        row.appendChild(form);
      } else {
        row.appendChild(node("button", { role: "menuitem", className: workspace.id === state.workspaceId ? "active" : "", onClick: function () { switchWorkspace(workspace.id); } }, workspace.name));
        const actions = node("div", { className: "workspace-menu-row-actions" });
        actions.appendChild(node("button", { type: "button", disabled: index === 0, ariaLabel: "Move " + workspace.name + " up", onClick: function () { moveWorkspace(workspace.id, "up"); } }, "↑"));
        actions.appendChild(node("button", { type: "button", disabled: index === state.workspaces.length - 1, ariaLabel: "Move " + workspace.name + " down", onClick: function () { moveWorkspace(workspace.id, "down"); } }, "↓"));
        actions.appendChild(node("button", { type: "button", ariaLabel: "Rename " + workspace.name, onClick: function (event) { beginWorkspaceRename(workspace.id, event.currentTarget.closest(".workspace-menu")); } }, "Rename"));
        actions.appendChild(node("button", { type: "button", ariaLabel: "Delete " + workspace.name, onClick: function () { deleteWorkspace(workspace.id); } }, "Delete"));
        row.appendChild(actions);
      }
      menu.appendChild(row);
    });
    const actions = node("div", { className: "workspace-menu-actions" });
    actions.appendChild(node("button", { type: "button", onClick: createWorkspace }, "Create workspace"));
    menu.appendChild(actions);
    return menu;
  }
  function nextLocalWorkspaceName() {
    const highestNumber = state.workspaces.reduce(function (highest, workspace) {
      const match = workspace.name.trim().match(/^Local Workspace\s+(\d+)$/i);
      const number = match ? Number(match[1]) : 1;
      return Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
    }, 1);
    return "Local Workspace " + (highestNumber + 1);
  }
  function clearWorkspaceRename() {
    state.renameWorkspaceId = null;
    state.renameWorkspaceDraft = "";
    state.renameWorkspaceError = "";
  }
  function replaceWorkspaceMenu(menu) {
    if (menu && menu.isConnected) menu.replaceWith(workspaceMenu());
  }
  function beginWorkspaceRename(id, menu) {
    const target = state.workspaces.find(function (workspace) { return workspace.id === id; });
    if (!target) return;
    state.renameWorkspaceId = id;
    state.renameWorkspaceDraft = target.name;
    state.renameWorkspaceError = "";
    replaceWorkspaceMenu(menu);
    const input = document.querySelector(".workspace-menu .workspace-rename-form input");
    if (input) { input.focus(); input.select(); }
  }
  function cancelWorkspaceRename(menu) {
    clearWorkspaceRename();
    replaceWorkspaceMenu(menu);
  }
  function commitWorkspaceRename(id, menu) {
    const nextName = state.renameWorkspaceDraft.trim();
    const input = menu && menu.querySelector(".workspace-rename-form input");
    const error = menu && menu.querySelector(".workspace-rename-error");
    const target = state.workspaces.find(function (workspace) { return workspace.id === id; });
    let message = "";
    if (!nextName) message = "Enter a workspace name.";
    else if (state.workspaces.some(function (workspace) { return workspace.id !== id && workspace.name.toLowerCase() === nextName.toLowerCase(); })) message = "A workspace with that name already exists.";
    if (message) {
      state.renameWorkspaceError = message;
      if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); }
      if (error) error.textContent = message;
      return;
    }
    if (!target) return;
    if (!renameWorkspace(id, nextName)) {
      state.renameWorkspaceError = "This workspace name is unavailable.";
      if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); }
      if (error) error.textContent = state.renameWorkspaceError;
      return;
    }
    clearWorkspaceRename();
    replaceWorkspaceMenu(menu);
  }
  function switchWorkspace(id) {
    if (id === state.workspaceId) return;
    const target = state.workspaces.find(function (workspace) { return workspace.id === id; });
    if (!target) return;
    cancelWorkspaceOperations();
    saveState();
    applyWorkspaceSnapshot(target);
    state.query = "";
    state.topicQuery = "";
    state.customTopic = "";
    state.generationError = "";
    state.errorByCard = {};
    state.view = "feed";
    saveState();
    render();
  }
  function createWorkspace() {
    clearWorkspaceRename();
    const name = nextLocalWorkspaceName();
    cancelWorkspaceOperations();
    saveState();
    const now = new Date().toISOString();
    const id = "workspace-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const snapshot = { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: now, topics: makeTopics(), settings: Object.assign({}, DEFAULT_SETTINGS, { obscurity: 5 }), cards: [], profile: {}, started: false, youtubeActivity: youtubeActivity({ savedIds: [], history: [], playbackPositions: {}, searchText: "", smartIds: null, smartReasons: {}, smartRan: false, topic: "All", tab: "discover", selectedChannelId: null, selectedVideoId: null, discoverIds: [], order: "newest" }) };
    const record = { id: id, name: name, createdAt: now, updatedAt: now, state: snapshot };
    state.workspaces.push(record);
    applyWorkspaceSnapshot(record);
    state.view = "feed";
    state.query = "";
    state.topicQuery = "";
    state.youtube = Object.assign({}, state.youtube, { savedIds: [], history: [], playbackPositions: {}, searchText: "", smartIds: null, smartReasons: {}, smartRan: false, topic: "All", tab: "discover", selectedChannelId: null, selectedVideoId: null, discoverIds: [], order: "newest" });
    saveState();
    render();
    showToast(name + " created.");
  }
  function renameWorkspace(targetId, requestedName) {
    const target = state.workspaces.find(function (workspace) { return workspace.id === targetId; });
    const trimmed = String(requestedName || "").trim();
    if (!target || !trimmed) return false;
    if (state.workspaces.some(function (workspace) { return workspace.id !== target.id && workspace.name.toLowerCase() === trimmed.toLowerCase(); })) return false;
    target.name = trimmed;
    target.updatedAt = new Date().toISOString();
    if (target.id === state.workspaceId) state.workspaceName = trimmed;
    saveState();
    if (target.id === state.workspaceId) {
      const accountName = document.querySelector(".profile-copy strong");
      if (accountName) accountName.textContent = trimmed;
    }
    return true;
  }
  function moveWorkspace(id, direction) {
    const index = state.workspaces.findIndex(function (workspace) { return workspace.id === id; });
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= state.workspaces.length) return;
    const moved = state.workspaces[index]; state.workspaces[index] = state.workspaces[nextIndex]; state.workspaces[nextIndex] = moved;
    saveState();
    render();
  }
  function performDeleteWorkspace(id) {
    const index = state.workspaces.findIndex(function (workspace) { return workspace.id === id; });
    if (index < 0) return;
    const target = state.workspaces[index];
    if (state.workspaces.length <= 1) return showToast("Keep at least one workspace so your local data always has a home.");
    if (id === state.workspaceId) {
      cancelWorkspaceOperations();
      const replacement = state.workspaces[index === 0 ? 1 : index - 1];
      state.workspaces.splice(index, 1);
      applyWorkspaceSnapshot(replacement);
      state.view = "feed"; state.query = ""; state.topicQuery = ""; state.customTopic = ""; state.generationError = ""; state.errorByCard = {};
    } else state.workspaces.splice(index, 1);
    saveState();
    render();
    showToast(target.name + " deleted.");
  }
  function deleteWorkspace(id) {
    if (state.workspaces.length <= 1) return showToast("Keep at least one workspace so your local data always has a home.");
    const target = state.workspaces.find(function (workspace) { return workspace.id === id; });
    if (!target) return;
    requestConfirmation("Delete workspace “" + target.name + "”?", "Its cards and local history will be removed from this Mac.", "Confirm", function () { performDeleteWorkspace(id); });
  }
  const topicSemantic = window.LEARNED_MEDIA_TOPIC_SEARCH;
  const topicResultCache = createSessionCache(100, 30 * 60 * 1000);
  let topicWorker = null, topicWorkerReady = false, topicIndex = null, topicRevision = 0, topicJob = 0, topicActiveKey = "", topicAttempt = "";
  let topicCatalogSignature = "", topicRebuildKey = "", topicResetEpoch = 0, topicCustomRecords = new Map(), topicBuiltinIds = [];
  let topicTreeVisible = new Set(), topicTreeAncestors = new Set();
  function rebuildTopicWorker() {
      if (!topicWorker) return;
      topicWorkerReady = false;
      topicActiveKey = "";
      const builtins = topicSemantic.topicSearchRecords(state.topics.filter(t => !t.custom));
      topicBuiltinIds = builtins.map(t => t.id);
      topicWorker.postMessage({ type: "initialize", topics: builtins.concat(Array.from(topicCustomRecords.values())), customIds: Array.from(topicCustomRecords.keys()), revision: topicRevision });
  }
  function ensureTopicIndex() {
      const custom = topicSemantic.topicSearchRecords(state.topics.filter(t => t.custom));
      const rebuildKey = JSON.stringify([TOPIC_CATALOG_VERSION, topicSemantic.TOPIC_SEARCH_VERSION, state.workspaceId, topicResetEpoch]);
      const signature = JSON.stringify([rebuildKey, custom]);
      if (signature === topicCatalogSignature) return;
      const baseRevision = topicRevision, revision = ++topicRevision, full = rebuildKey !== topicRebuildKey;
      const changes = topicSemantic.diffTopicSearchRecords(topicCustomRecords, custom);
      topicCatalogSignature = signature;
      topicRebuildKey = rebuildKey;
      topicCustomRecords = new Map(custom.map(t => [t.id, t]));
      topicJob++;
      topicActiveKey = "";
      topicWorkerReady = false;
      topicResultCache.clear();
      topicAttempt = "";
      if (full) topicIndex = null;
      else if (topicIndex) topicSemantic.updateTopicSuggestionIndex(topicIndex, changes.upserts, changes.removeIds, changes.orderIds ? topicBuiltinIds.concat(changes.orderIds) : undefined);
      let newWorker = false;
      if (!topicWorker) {
          try {
              const worker = new Worker("topic-search.worker.js");
              topicWorker = worker;
              newWorker = true;
              worker.onmessage = function (event) {
                  const r = event.data;
                  if (worker !== topicWorker || r.revision !== topicRevision) return;
                  if (r.type === "rebuild") { rebuildTopicWorker(); return; }
                  if (r.type === "ready") {
                      topicWorkerReady = true;
                      topicActiveKey = "";
                      scheduleTopicSearch(state.query || state.topicQuery);
                  } else if (r.id === topicJob) {
                      topicResultCache.set(r.key, r);
                      publishTopicSearch(r.query, r);
                  }
              };
              worker.onerror = function () {
                  worker.terminate();
                  if (worker !== topicWorker) return;
                  topicWorker = null;
                  topicWorkerReady = false;
                  topicActiveKey = "";
                  scheduleTopicSearch(state.query || state.topicQuery);
              };
          } catch (_) { topicWorker = null; }
      }
      if (topicWorker) {
          if (full || newWorker) rebuildTopicWorker();
          else topicWorker.postMessage({ type: "update", baseRevision, revision, ...changes });
      }
  }
  function topicCacheKey(query, plan) { return JSON.stringify([topicRevision, topicSemantic.TOPIC_SEARCH_VERSION, normalizeNaturalSearchText(query), plan || []]); }
  function publishTopicSearch(query, result) {
      if (normalizeNaturalSearchText(query) !== normalizeNaturalSearchText(state.query || state.topicQuery))
          return;
      if (state.topicQuery) {
          topicTreeVisible = new Set(result.visibleIds);
          topicTreeAncestors = new Set(result.matchingDescendants);
          render();
      }
      else {
          const wrap = document.querySelector(".global-search-wrap");
          if (wrap)
              renderGlobalSearchPopover(wrap);
      }
      requestSemanticSearch(query, result);
  }
  function scheduleTopicSearch(query) {
      ensureTopicIndex();
      const text = String(query || "").trim();
      if (!text)
          return;
      const scope = scopedCacheKey(state.key, [topicRevision, topicSemantic.TOPIC_SEARCH_VERSION, normalizeNaturalSearchText(text)]);
      const plan = semanticSearchCache.get(scope);
      const key = topicCacheKey(text, plan);
      const cached = topicResultCache.get(key);
      if (cached) {
          if (state.topicQuery) {
              topicTreeVisible = new Set(cached.visibleIds);
              topicTreeAncestors = new Set(cached.matchingDescendants);
          }
          requestSemanticSearch(text, cached);
          return;
      }
      if (key === topicActiveKey)
          return;
      topicActiveKey = key;
      const id = ++topicJob;
      if (topicWorker) {
          if (topicWorkerReady)
              topicWorker.postMessage({ type: "search", id, key, query: text, plan, revision: topicRevision });
      }
      else {
          if (!topicIndex) {
              const builtins = topicSemantic.topicSearchRecords(state.topics.filter(t => !t.custom));
              topicBuiltinIds = builtins.map(t => t.id);
              topicIndex = topicSemantic.createTopicSuggestionIndex(builtins.concat(Array.from(topicCustomRecords.values())));
          }
          topicSemantic.searchTopicIndexYielding(topicIndex, text, plan || [], () => id === topicJob).then(result => { if (result) {
              topicResultCache.set(key, result);
              publishTopicSearch(text, result);
          } });
      }
  }
  function globalSearchResults(query) {
      ensureTopicIndex();
      scheduleTopicSearch(query);
      const plan = semanticSearchCache.get(scopedCacheKey(state.key, [topicRevision, topicSemantic.TOPIC_SEARCH_VERSION, normalizeNaturalSearchText(query)]));
      const result = topicResultCache.get(topicCacheKey(query, plan));
      return result ? result.suggestions : [];
  }
  function renderGlobalSearchPopover(searchWrap) {
      const previous = searchWrap.querySelector(".search-popover");
      if (previous)
          previous.remove();
      const results = globalSearchResults(state.query);
      if (!results.length)
          return;
      const popover = node("div", { className: "search-popover" });
      for (const group of ["keyword", "related", "broader", "explore"]) {
          const entries = results.filter(r => r.group === group);
          if (!entries.length)
              continue;
          popover.appendChild(node("span", { className: "search-group-label", text: group === "keyword" ? "Keyword matches" : group === "related" ? "Related topics" : group === "broader" ? "Broader recommendations" : "Explore more" }));
          for (const entry of entries)
              popover.appendChild(node("button", { type: "button", title: [entry.explanation].concat(entry.support || []).join("\n"), ariaLabel: entry.path.join(" → "), onClick: function () { const selected = findTopic(entry.id); if (selected && selectionState(selected) !== "selected") toggleTopicSelection(selected.id); state.view = "feed"; state.started = false; state.topicQuery = entry.label; state.query = ""; topicSearchExpansionSuppressed = false; topicSearchExpansionOverrides.clear(); scheduleTopicSearch(state.topicQuery); saveState(); render(); } }, node("span", { text: entry.path.join(" → ") }), svg("arrow", 14)));
      }
      searchWrap.appendChild(popover);
  }
  function normalizeNaturalSearchText(value) { return topicSemantic ? topicSemantic.localTopicPlan && String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9\u0080-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim() : searchText(value); }
  function cancelPendingSemanticSearch() { if (searchInterpretRequest)
      topicAttempt = ""; if (searchInterpretTimer)
      clearTimeout(searchInterpretTimer); searchInterpretTimer = null; if (searchInterpretRequest && searchInterpretRequest.cancel)
      searchInterpretRequest.cancel(); searchInterpretRequest = null; searchInterpretToken++; topicJob++; topicActiveKey = ""; }
  function requestSemanticSearch(query, result) {
      const text = String(query || "").trim();
      const key = scopedCacheKey(state.key, [topicRevision, topicSemantic.TOPIC_SEARCH_VERSION, normalizeNaturalSearchText(text)]);
      if (!text || !result || !topicSemantic.shouldEnrichTopics(text, result.completeCoverage) || !state.key.trim() || state.geminiStatus !== "connected" || semanticSearchCache.get(key) || topicAttempt === key)
          return;
      if (searchInterpretTimer)
          clearTimeout(searchInterpretTimer);
      const token = searchInterpretToken;
      searchInterpretTimer = setTimeout(function () {
          topicAttempt = key;
          searchInterpretTimer = null;
          const request = bridge("searchInterpret", { key: state.key, query: text, catalogVersion: TOPIC_CATALOG_VERSION });
          searchInterpretRequest = request;
          request.then(result => { if (token !== searchInterpretToken)
              return; const plan = topicSemantic.validateTopicPlan(result.plan || result); semanticSearchCache.set(key, plan); topicActiveKey = ""; scheduleTopicSearch(text); }).catch(() => { }).finally(() => { if (searchInterpretRequest === request)
              searchInterpretRequest = null; });
      }, 1500);
  }
  function installPopoverDismiss() {
    if (window.__learnedMediaPopoverDismiss) return;
    window.__learnedMediaPopoverDismiss = true;
    document.addEventListener("pointerdown", function (event) {
      const target = event.target;
      if (state.repeatMenuOpen && !(target && target.closest && target.closest(".repeat-batch-control"))) {
        state.repeatMenuOpen = false;
        state.repeatBatchPreview = null;
        render();
      }
      if (state.difficultyMenuCardId && !(target && target.closest && target.closest(".difficulty-picker"))) closeDifficultyMenu(false);
      if (state.moreMenuCardId && !(target && target.closest && target.closest(".fact-more-menu"))) closeMoreMenu(false);
      if (state.learnMenuCardId && !(target && target.closest && target.closest(".learn-more-menu"))) closeLearnMenu(false);
      if (target && target.closest && (target.closest(".workspace-switcher") || target.closest(".global-search-wrap"))) return;
      clearWorkspaceRename();
      document.querySelectorAll(".workspace-menu, .search-popover").forEach(function (popover) { popover.remove(); });
    });
    document.addEventListener("focusin", function (event) {
      const target = event.target;
      if (state.moreMenuCardId) {
        const moreMenu = target && target.closest && target.closest(".fact-more-menu");
        if (!moreMenu || moreMenu.dataset.moreCard !== state.moreMenuCardId) closeMoreMenu(false);
      }
      if (state.learnMenuCardId) {
        const learnMenu = target && target.closest && target.closest(".learn-more-menu");
        if (!learnMenu || learnMenu.dataset.learnCard !== state.learnMenuCardId) closeLearnMenu(false);
      }
      if (!state.difficultyMenuCardId) return;
      const picker = target && target.closest && target.closest(".difficulty-picker");
      if (!picker || picker.dataset.difficultyCard !== state.difficultyMenuCardId) closeDifficultyMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (state.repeatMenuOpen) {
        event.preventDefault();
        state.repeatMenuOpen = false;
        state.repeatBatchPreview = null;
        repeatMenuTriggerFocus = true;
        render();
        return;
      }
      if (state.moreMenuCardId) {
        event.preventDefault();
        closeMoreMenu(true);
        return;
      }
      if (state.learnMenuCardId) {
        event.preventDefault();
        closeLearnMenu(true);
        return;
      }
      if (state.difficultyMenuCardId) {
        event.preventDefault();
        closeDifficultyMenu(true);
        return;
      }
      if (state.confirmation) {
        closeConfirmation();
        return;
      }
      if (!event.defaultPrevented) {
        const focusedCard = event.target && event.target.closest && event.target.closest(".fact-card");
        const locationHeading = focusedCard && focusedCard.querySelector("[data-location-heading-card]");
        const locationCard = locationHeading && state.cards.find(function (card) { return card.id === locationHeading.dataset.locationHeadingCard; });
        if (locationCard) {
          event.preventDefault();
          closeNativeLocationMap(locationCard);
          return;
        }
        const chronologyHeading = focusedCard && focusedCard.querySelector("[data-chronology-heading-card]");
        const chronologyCard = chronologyHeading && state.cards.find(function (card) { return card.id === chronologyHeading.dataset.chronologyHeadingCard; });
        if (chronologyCard) {
          event.preventDefault();
          closeNativeChronology(chronologyCard);
          return;
        }
        const glossaryHeading = focusedCard && focusedCard.querySelector("[data-glossary-heading-card]");
        const glossaryCard = glossaryHeading && state.cards.find(function (card) { return card.id === glossaryHeading.dataset.glossaryHeadingCard; });
        if (glossaryCard) {
          event.preventDefault();
          closeNativeGlossary(glossaryCard);
          return;
        }
      }
      document.querySelectorAll(".workspace-menu, .search-popover").forEach(function (popover) { popover.remove(); });
      clearWorkspaceRename();
      const active = document.activeElement;
      if (active && active.matches && active.matches(".workspace-rename-form input") && active.blur) active.blur();
    });
  }
  function navigation() {
    installPopoverDismiss();
    const items = [["feed", "Feed", "home"], ["explore", "Explore", "compass"], ["videos", "Videos", "image"], ["saved", "Saved", "bookmark"], ["likes", "Likes", "heart"], ["history", "History", "history"], ["settings", "Settings", "settings"]];
    const header = node("header", { className: "top-navigation" });
    header.appendChild(node("button", { className: "nav-brand", ariaLabel: "Learned Media home", onClick: function () { state.view = "feed"; render(); } }, node("span", { className: "brand-mark", text: "LM" }), node("span", { className: "brand-wordmark" }, node("strong", { text: "Learned Media" }))));
    const links = node("nav", { className: "top-nav-links", ariaLabel: "Primary navigation" });
    items.forEach(function (item) { links.appendChild(node("button", { className: "top-nav-link" + (state.view === item[0] ? " active" : ""), ariaLabel: item[1], "aria-current": state.view === item[0] ? "page" : undefined, onClick: function () { state.view = item[0]; render(); } }, svg(item[2], 16), node("span", { text: item[1] }))); });
    header.appendChild(links);
    const searchWrap = node("div", { className: "top-nav-search" });
    const search = node("div", { className: "global-search-wrap" });
    search.appendChild(svg("search", 17));
    search.appendChild(node("input", { id: "global-search", value: state.query, placeholder: "Search topics", ariaLabel: "Search topics", onFocus: function () { const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); } renderGlobalSearchPopover(search); }, onInput: function (event) { cancelPendingSemanticSearch(); state.query = event.target.value; state.topicQuery = state.query; const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); } render(); } }));
    searchWrap.appendChild(search);
    header.appendChild(searchWrap);
    const accountName = state.workspaceName;
    const account = node("div", { className: "top-nav-account" });
    if (state.cards.length || state.loading) account.appendChild(node("button", { className: "nav-reset", onClick: resetFeed }, svg("reset", 15), " Reset feed"));
    const switcher = node("div", { className: "workspace-switcher" });
    const profile = node("button", { className: "profile-chip", ariaExpanded: false, onClick: function () { const searchPopover = search.querySelector(".search-popover"); if (searchPopover) searchPopover.remove(); const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); profile.setAttribute("aria-expanded","false"); } else { switcher.appendChild(workspaceMenu()); profile.setAttribute("aria-expanded","true"); } } }, node("span", { className: "profile-avatar" }, svg("panel", 16)), node("span", { className: "profile-copy" }, node("strong", { text: accountName }), node("small", { text: state.workspaces.length + " " + (state.workspaces.length === 1 ? "workspace" : "workspaces") })), svg("chevronDown", 15));
    switcher.appendChild(profile); account.appendChild(switcher); header.appendChild(account);
    renderGlobalSearchPopover(search);
    return header;
  }
  function customTopicForm(className) {
    const form = node("div", { className: className || "custom-topic-form" });
    const input = node("input", { id: "custom-topic", value: state.customTopic, placeholder: "Add a custom topic", ariaLabel: "Custom topic", onInput: function (event) { state.customTopic = event.target.value; }, onKeydown: function (event) { if (event.key === "Enter") addCustomTopic(); } });
    form.appendChild(input);
    form.appendChild(node("button", { className: "icon-button filled", ariaLabel: "Add custom topic", onClick: addCustomTopic }, svg("plus", 17)));
    return form;
  }
  function topicPanel(setup) {
    const aside = node("aside", { className: (setup ? "setup-topics-panel" : "feed-topics-panel") + " surface-panel" });
    if (!setup && (state.cards.length || state.loading)) aside.appendChild(node("button", { className: "topic-sidebar-reset", onClick: resetFeed }, svg("reset", 14), " Reset feed"));
    const details = node(setup ? "div" : "details", { className: setup ? "setup-topics-details setup-topics-static" : "topics-details" });
    if (setup) {
      details.appendChild(node("div", { className: "setup-topics-heading" }, node("span", { text: "Choose your topics" }), node("div", { className: "setup-topic-heading-actions" }, node("strong", { text: selectedCount() + " selected" }), node("button", { className: "text-button topic-reset-button", onClick: resetTopics }, "Reset"))));
    } else {
      details.open = true;
      details.appendChild(node("summary", {}, node("span", {}, "Your topics")));
      details.appendChild(node("strong", { className: "topic-selected-count", text: selectedCount() + " selected" }));
    }
    if (setup) details.appendChild(node("p", { className: "setup-topic-help", text: "Pick the subjects you want to see; you can change them anytime" }));
    else details.appendChild(node("div", { className: "feed-topic-copy", text: "New choices shape the next batch." }));
    details.appendChild(node("p", { className: "topic-selection-summary", text: selectedSummary(), ariaLive: "polite" }));
    const difficulty = node("label", { className: "topic-difficulty-control", for: setup ? "setup-difficulty" : "feed-difficulty" });
    difficulty.appendChild(node("span", { className: "control-label" }, node("span", { text: "Fact Difficulty" }), node("strong", { text: state.settings.obscurity + "/10 · " + difficultyLabel(state.settings.obscurity) })));
    difficulty.appendChild(node("input", { id: setup ? "setup-difficulty" : "feed-difficulty", type: "range", min: "1", max: "10", step: "1", value: state.settings.obscurity, onInput: function (event) { const next = Number(event.target.value); state.settings.obscurity = next; state.profile = difficultyEngine.resetTopicLearningProfiles(state.profile, next); saveState(); render(); } }));
    difficulty.appendChild(node("span", { className: "range-ends" }, node("span", { text: "A Little Hard" }), node("span", { text: "Impossible" })));
    details.appendChild(difficulty);
    details.appendChild(node("div", { className: "topic-list-search" }, svg("search", 14), node("input", { id: "topic-search", value: state.topicQuery, placeholder: "Search topics", ariaLabel: "Search topics", onInput: function (event) { cancelPendingSemanticSearch(); state.topicQuery = event.target.value; state.query = ""; topicSearchExpansionSuppressed = false; topicSearchExpansionOverrides.clear(); scheduleTopicSearch(state.topicQuery); render(); } })));
    details.appendChild(topicTree());
    details.appendChild(customTopicForm(setup ? "custom-topic-form" : "feed-custom-topic"));
    details.appendChild(feedCustomize(setup));
    aside.appendChild(details);
    return aside;
  }
  function changeGlobalDisplayMode(mode) {
    if (state.settings.displayMode === mode) return;
    state.settings.displayMode = mode;
    state.cards = state.cards.map(function (card) {
      if (!card.displayModeOverride) return card;
      const copy = Object.assign({}, card);
      delete copy.displayModeOverride;
      return copy;
    });
    cancelImageHydrations();
    if (mode === "picture-text") hydrateCardImages(state.cards, generationToken);
    saveState();
    render();
  }
  function feedCustomize(setup) {
    const details = node("details", { className: setup ? "setup-customize" : "feed-customize" });
    details.open = setup ? setupCustomizeOpen : feedCustomizeOpen;
    details.addEventListener("toggle", function () {
      if (setup) setupCustomizeOpen = details.open;
      else feedCustomizeOpen = details.open;
    });
    details.appendChild(node("summary", {}, node("span", {}, svg("sliders", 16), " Customize Your Feed", svg("chevronDown", 15))));
    const body = node("div", { className: "setup-customize-body" });
    body.appendChild(node("span", { className: "control-label", text: "Display style" }));
    const display = node("div", { className: "feed-display-options" });
    display.appendChild(node("button", { className: state.settings.displayMode === "picture-text" ? "selected" : "", onClick: function () { changeGlobalDisplayMode("picture-text"); } }, "Image + text"));
    display.appendChild(node("button", { className: state.settings.displayMode === "text" ? "selected" : "", onClick: function () { changeGlobalDisplayMode("text"); } }, "Text only"));
    body.appendChild(display);
    body.appendChild(node("span", { className: "control-label", text: "Description length (sentences):" }));
    const lengths = node("div", { className: "feed-length-options", role: "group", ariaLabel: "Description length in sentences" });
    [1, 2, 3, 4, 6, 8, 10].forEach(function (length) {
      lengths.appendChild(node("button", { className: state.settings.sentenceLength === length ? "selected" : "", ariaPressed: state.settings.sentenceLength === length, disabled: state.settings.sentenceLength === length, onClick: function () {
        if (state.settings.sentenceLength === length) return;
        state.settings.sentenceLength = length;
        saveState();
        render();
      } }, String(length)));
    });
    body.appendChild(lengths);
    const activeAngle = activeFactBatch ? activeFactBatch.angle : selectedFactAngle;
    const angleOption = factAngleOption(activeAngle);
    const angleControl = node("div", { className: "fact-angle-control" });
    const angleId = setup ? "setup-fact-angle" : "feed-fact-angle";
    angleControl.appendChild(node("label", { className: "control-label", "for": angleId, text: "Fact angle" }));
    const angleSelect = node("select", { id: angleId, ariaLabel: "Fact angle", disabled: Boolean(activeFactBatch), onChange: function (event) {
      if (activeFactBatch) return;
      const next = factAngleOptions.find(function (option) { return option.id === event.currentTarget.value; });
      if (!next) return;
      selectedFactAngle = next.id;
      const description = angleControl.querySelector(".fact-angle-description");
      if (description) description.textContent = next.description;
    } });
    factAngleOptions.forEach(function (option) { angleSelect.appendChild(node("option", { value: option.id, text: option.label })); });
    angleSelect.value = activeAngle;
    angleControl.appendChild(angleSelect);
    angleControl.appendChild(node("span", { id: angleId + "-description", className: "fact-angle-description", text: angleOption.description }));
    angleControl.appendChild(node("span", { id: angleId + "-note", className: "fact-angle-note", text: "Applies to your next batch, including retries." }));
    angleSelect.setAttribute("aria-describedby", angleId + "-description " + angleId + "-note");
    body.appendChild(angleControl);
    body.appendChild(node("button", { className: "feed-surprise-toggle" + (state.settings.surpriseMe ? " selected" : ""), onClick: function () { state.settings.surpriseMe = !state.settings.surpriseMe; saveState(); render(); } }, svg("sparkles", 14), " Surprise Me ", node("span", { text: state.settings.surpriseMe ? "On" : "Off" })));
    details.appendChild(body);
    return details;
  }
  function startPanel() {
    const hasSelection = selectedCount() > 0;
    const canStart = state.geminiStatus === "connected";
    const panel = node("section", { className: "setup-start-panel surface-panel" });
    panel.appendChild(node("div", { className: "start-panel-copy" }, node("span", { className: "eyebrow", text: "Your next feed" }), node("h1", { text: "Ready for a surprise?" }), node("p", { text: hasSelection ? selectedCount() + " topics in your mix, sourced from Wikipedia and shaped by your curiosity." : "Choose at least one topic from the checklist to begin." })));
    panel.appendChild(node("div", { className: "start-orbit" }, svg("sparkles", 24), node("span", { text: "Every card has a source" })));
    panel.appendChild(node("button", { className: "start-button", disabled: !hasSelection || !canStart, onClick: startFeed }, node("span", { text: !hasSelection ? "Choose a topic first" : canStart ? "Start learning" : "Connect Gemini first" }), svg("arrow", 21)));
    panel.appendChild(node("p", { className: "panel-footnote" }, svg(hasSelection ? "shield" : "help", 13), " ", hasSelection ? "Your mix stays yours." : "Select a topic to unlock your feed."));
    if (!canStart) {
      const keyCallout = node("div", { className: "setup-key-callout" }, node("div", { className: "setup-key-callout-icon" }, svg("key", 16)), node("div", {}, node("strong", { text: "Gemini isn’t connected" }), node("span", { text: "Add or connect your API key in Settings to start learning" })));
      keyCallout.appendChild(node("button", { className: "text-button", onClick: function () { state.view = "settings"; render(); } }, "Open Settings ", svg("arrow", 14)));
      panel.appendChild(keyCallout);
    }
    panel.appendChild(feedCustomize(true));
    return panel;
  }
  function setupView() {
    const layout = node("section", { className: "setup-layout" });
    layout.appendChild(topicPanel(true));
    layout.appendChild(startPanel());
    return node("div", { className: "setup-stack" }, layout);
  }
  function imageBlock(card) {
    if ((card.displayModeOverride || state.settings.displayMode) === "text") return null;
    const image = card.image && card.image.url;
    const wrap = node("div", { className: "fact-image " + (image ? "has-image" : "no-image") });
    if (image) {
      const picture = node("img", { src: image, alt: card.image.alt || card.title, loading:"lazy", decoding:"async" });
      picture.addEventListener("error", function () { wrap.classList.remove("has-image"); wrap.classList.add("no-image"); picture.remove(); wrap.insertBefore(node("div", { className: "image-unavailable" }, svg("image", 25), node("span", { text: "Image unavailable" })), wrap.firstChild); });
      wrap.appendChild(picture);
      wrap.appendChild(node("span", { className: "fact-image-label", text: (card.topicPath || ["Wikipedia"])[0] }));
      if (card.image.filePageUrl || card.image.sourceUrl) wrap.appendChild(externalLink(card.image.filePageUrl || card.image.sourceUrl, "Wikipedia image", "image-credit"));
    } else {
      wrap.appendChild(node("div", { className: "image-unavailable" }, svg("image", 25), node("span", { text: "Image unavailable" })));
    }
    return wrap;
  }
  const questionDrafts=new Map();
  const questionStructures=new Map();
  const questionStructureRevisions=new Map();
  const questionInstructionPreferences=new Map();
  const questionInstructionRevisions=new Map();
  let answerOptionsOpenKey="";
  function questionDraftKey(card){return state.workspaceId+"\u0000"+card.id;}
  function setQuestionStructure(key,value){
    const next=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerStructure(value),current=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerStructure(questionStructures.get(key));
    if(current===next)return;
    questionStructures.set(key,next);questionStructureRevisions.set(key,(questionStructureRevisions.get(key)||0)+1);
  }
  function questionInstructionPreference(key){return questionInstructionPreferences.get(key)==="settings"?"settings":"written";}
  function setQuestionInstructionPreference(key,value){
    const next=value==="settings"?"settings":"written";
    if(questionInstructionPreference(key)===next)return;
    questionInstructionPreferences.set(key,next);questionInstructionRevisions.set(key,(questionInstructionRevisions.get(key)||0)+1);
  }
  document.addEventListener("pointerdown",function(event){if(answerOptionsOpenKey && !(event.target && event.target.closest && event.target.closest(".answer-options-control"))){answerOptionsOpenKey="";document.querySelectorAll(".answer-options-menu").forEach(function(menu){menu.remove();});document.querySelectorAll(".answer-options-trigger").forEach(function(trigger){trigger.setAttribute("aria-expanded","false");});}});
  function questionArea(card) {
    const box = node("div", { className: "question-box" });
    const row = node("div", { className: "question-row" });
    const draftKey=questionDraftKey(card),selectedStructure=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerStructure(questionStructures.get(draftKey)),instructionPreference=questionInstructionPreference(draftKey),instructionRevision=questionInstructionRevisions.get(draftKey)||0;
    const followUpQuestions = cardFollowUps.getCardFollowUpQuestions(card);
    const followUpKey = state.workspaceId + "\u0000" + card.id + "\u0000" + cardFollowUps.followUpQuestionFingerprint(card);
    let suggestions = null;
    if (followUpQuestions.length) {
      suggestions = node("div", { className: "question-suggestions", role: "group", ariaLabel: "Suggested questions", dataset: { questionSuggestions: card.id }, onKeydown: function (event) {
        if (event.key === "Escape") {
          event.preventDefault();
          dismissedFollowUpQuestionKey = followUpKey;
          suggestions.hidden = true;
          input.focus();
        }
      } });
      followUpQuestions.forEach(function (question) {
        suggestions.appendChild(node("button", { type: "button", className: "question-suggestion", dataset: { cardId: card.id, questionSuggestion: "true" }, onClick: function () {
          questionDrafts.set(draftKey,question);
          setQuestionInstructionPreference(draftKey,"written");
          input.value = question;
          dismissedFollowUpQuestionKey = followUpKey;
          suggestions.hidden = true;
          focusedQuestionCardId = card.id;
          input.focus();
          input.setSelectionRange(question.length, question.length);
        } }, question));
      });
    }
    const input = node("input", { value: questionDrafts.has(draftKey) ? questionDrafts.get(draftKey) : card.question || "", placeholder: "Ask a question about this fact", ariaLabel: "Ask a question about " + card.title, dataset: { cardId: card.id }, onFocus: function () {
      if (focusedQuestionCardId !== card.id) {
        focusedQuestionCardId = card.id;
        dismissedFollowUpQuestionKey = "";
        if (suggestions) suggestions.hidden = Boolean(input.value.trim());
      }
    }, onBlur: function (event) {
      if (!box.contains(event.relatedTarget)) {
        focusedQuestionCardId = null;
        dismissedFollowUpQuestionKey = "";
        if (suggestions) suggestions.hidden = true;
      }
    }, onInput: function (event) {
      const priorQuestion=questionDrafts.has(draftKey)?questionDrafts.get(draftKey):(card.question||"");
      questionDrafts.set(draftKey,event.target.value);
      if(priorQuestion!==event.target.value)setQuestionInstructionPreference(draftKey,"written");
      if (suggestions) {
        if (!event.target.value.trim()) dismissedFollowUpQuestionKey = "";
        suggestions.hidden = Boolean(event.target.value.trim()) || focusedQuestionCardId !== card.id || dismissedFollowUpQuestionKey === followUpKey;
      }
    }, onKeydown: function (event) {
      if (event.key === "Escape" && suggestions && !suggestions.hidden) {
        event.preventDefault();
        dismissedFollowUpQuestionKey = followUpKey;
        suggestions.hidden = true;
      } else if (event.key === "Enter" && input.value.trim()) {
        event.preventDefault();
        askQuestion(card.id, input.value);
      }
    } });
    row.appendChild(input);
    const optionWrap=node("div",{className:"answer-options-control"});
    const optionID="answer-options-"+safeCardElementId(card.id),isOpen=answerOptionsOpenKey===draftKey;
    const optionTrigger=node("button",{type:"button",className:"answer-options-trigger"+(isOpen?" selected":""),"aria-haspopup":"menu",ariaExpanded:isOpen,ariaControls:optionID,id:optionID+"-trigger",onClick:function(){answerOptionsOpenKey=isOpen?"":draftKey;render();}},"Answer options ",svg("chevronDown",12));
    optionWrap.appendChild(optionTrigger);
    if(isOpen){
      const restoreTrigger=function(){requestAnimationFrame(function(){const trigger=document.getElementById(optionID+"-trigger");if(trigger)trigger.focus();});};
      const menu=node("div",{className:"answer-options-menu",id:optionID,role:"menu",ariaLabel:"Answer options",onKeydown:function(event){const items=Array.from(menu.querySelectorAll("[role='menuitemcheckbox'],[role='menuitemradio']")),index=items.indexOf(document.activeElement);let next;if(event.key==="ArrowDown")next=(index+1)%items.length;else if(event.key==="ArrowUp")next=(index-1+items.length)%items.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=items.length-1;else if(event.key==="Escape"){event.preventDefault();answerOptionsOpenKey="";render();restoreTrigger();return;}if(next!==undefined){event.preventDefault();items[next].focus();}}});
      menu.appendChild(node("button",{type:"button",role:"menuitemcheckbox",ariaChecked:Boolean(card.questionDetailed),onClick:function(){card.questionDetailed=!card.questionDetailed;answerOptionsOpenKey="";saveState();render();restoreTrigger();}},node("span",{text:"More Details"}),node("span",{className:"answer-option-check",text:card.questionDetailed?"✓":""})));
      menu.appendChild(node("span",{className:"answer-options-divider",role:"separator"}));
      window.LEARNED_MEDIA_ANSWER_STRUCTURE.ANSWER_STRUCTURES.forEach(function(option){menu.appendChild(node("button",{type:"button",role:"menuitemradio",ariaChecked:selectedStructure===option.value,onClick:function(){setQuestionStructure(draftKey,option.value);answerOptionsOpenKey="";render();restoreTrigger();}},node("span",{text:option.label}),node("span",{className:"answer-option-check",text:selectedStructure===option.value?"✓":""})));});
      optionWrap.appendChild(menu);
      requestAnimationFrame(function(){const selected=menu.querySelector("[role='menuitemradio'][aria-checked='true']")||menu.querySelector("button");if(selected)selected.focus();});
    }
    row.appendChild(optionWrap);
    row.appendChild(node("button", { className: "question-send", ariaLabel: "Send question", onClick: function () { askQuestion(card.id, input.value); } }, svg("arrow", 16)));
    box.appendChild(row);
    if(selectedStructure!=="automatic")box.appendChild(node("div",{className:"answer-structure-chip",ariaLive:"polite"},node("span",{text:window.LEARNED_MEDIA_ANSWER_STRUCTURE.answerStructureLabel(selectedStructure)}),node("button",{type:"button",ariaLabel:"Remove "+window.LEARNED_MEDIA_ANSWER_STRUCTURE.answerStructureLabel(selectedStructure)+" answer structure",onClick:function(){setQuestionStructure(draftKey,"automatic");render();requestAnimationFrame(function(){const field=document.querySelector(".question-row input[data-card-id='"+CSS.escape(card.id)+"']");if(field)field.focus();});}},"×")));
    const instructionResolution=window.LEARNED_MEDIA_ANSWER_STRUCTURE.resolveQuestionInstructions(questionDrafts.has(draftKey)?questionDrafts.get(draftKey):(card.question||""),Boolean(card.questionDetailed),selectedStructure,instructionPreference);
    if(instructionResolution.conflict)box.appendChild(node("div",{className:"question-instruction-notice",ariaLive:"polite"},node("span",{text:instructionPreference==="settings"?"For this answer: normal settings":"For this answer: "+instructionResolution.conflictLabel}),node("button",{type:"button",onClick:function(){setQuestionInstructionPreference(draftKey,instructionPreference==="settings"?"written":"settings");render();requestAnimationFrame(function(){const field=document.querySelector(".question-row input[data-card-id='"+CSS.escape(card.id)+"']");if(field)field.focus();});}},instructionPreference==="settings"?"Use written instruction":"Use normal settings")));
    if (suggestions) {
      suggestions.hidden = Boolean(input.value.trim()) || focusedQuestionCardId !== card.id || dismissedFollowUpQuestionKey === followUpKey;
      box.appendChild(suggestions);
    }
    box.addEventListener("focusout", function (event) {
      if (!box.contains(event.relatedTarget)) {
        focusedQuestionCardId = null;
        dismissedFollowUpQuestionKey = "";
        if (suggestions) suggestions.hidden = true;
      }
    });
    if (card.answer) {
      const answer=node("div",{className:"learning-answer question-answer"});
      const presentation=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeSavedAnswerPresentation(card.answerPresentation),resolved=card.answerStructure||presentation&&presentation.structure;
      const label=resolved==="ordered-steps"?"Ordered steps":resolved==="side-by-side-comparison"?"Side-by-side comparison":resolved==="short-explanation"?"Short explanation":card.answerDetailed?"Detailed answer":"Answer";
      answer.appendChild(node("span",{className:"answer-label"},svg("message",14)," ",label));
      if(presentation){
        answer.appendChild(node("p",{text:presentation.directAnswer}));
        if(presentation.structure==="ordered-steps"){const list=node("ol",{className:"answer-steps"});(presentation.steps||[]).forEach(function(step){list.appendChild(node("li",{text:step}));});answer.appendChild(list);}
        else if(presentation.structure==="side-by-side-comparison"){
          const list=node("dl",{className:"answer-comparison"});(presentation.comparisonRows||[]).forEach(function(item){const line=node("div",{className:"answer-comparison-row"});line.appendChild(node("dt",{text:item.property}));line.appendChild(node("dd",{},node("span",{className:"comparison-subject",text:presentation.comparisonSubjects[0]}),node("span",{text:item.values[0]})));line.appendChild(node("dd",{},node("span",{className:"comparison-subject",text:presentation.comparisonSubjects[1]}),node("span",{text:item.values[1]})));list.appendChild(line);});answer.appendChild(list);
        } else (presentation.paragraphs||[]).forEach(function(paragraph){answer.appendChild(node("p",{text:paragraph}));});
        if(presentation.fallbackReason)answer.appendChild(node("p",{className:"answer-format-note",text:presentation.fallbackReason}));
      } else answer.appendChild(node("p",{text:card.answer}));
      answer.appendChild(sourceList(card,true));box.appendChild(answer);
    }
    if (learningTasks.has(state.workspaceId+":"+card.id+":question")) box.appendChild(node("div", { className: "learning-loading" }, node("span", { className: "loading-dot" }), " Gemini is reading the cited Wikipedia pages"));
    return box;
  }
  function cardElement(card) {
    const article = node("article", { className: "fact-card accent-" + (card.accent || "blue") + (card.feedback ? " feedback-" + card.feedback : ""), dataset: { cardId: card.id }, onFocusCapture: function () { recordNativeTopicDetourProgress(card.id, "focus"); measureTopicDetourCard(card.id); } });
    const image = imageBlock(card);
    if (image) article.appendChild(image);
    const content = node("div", { className: "fact-content" });
    const meta = node("div", { className: "fact-meta" });
    const crumbs = node("div", { className: "fact-breadcrumbs" });
    (card.topicPath || []).forEach(function (topic) { crumbs.appendChild(node("span", { text: topic })); });
    const locationRow = node("div", { className: "fact-location-row" });
    locationRow.appendChild(crumbs);
    const cardPlaces = nativeCardLocations(card);
    const locationFingerprint = nativeLocationFingerprint(card);
    const locationPanelOpen = cardLocations.getCardLocationPanelOpen(state.workspaceId, card.id, locationFingerprint);
    if (cardPlaces.length) locationRow.appendChild(node("button", { type: "button", className: "card-location-trigger", ariaExpanded: locationPanelOpen, ariaControls: "card-location-" + safeCardElementId(card.id), dataset: { locationTriggerCard: card.id }, onClick: function () { locationPanelOpen ? closeNativeLocationMap(card) : openNativeLocationMap(card); } }, "See the location"));
    meta.appendChild(locationRow);
    const explanationMode = cardExplanations.getCardExplanationSelection(state.workspaceId, card.id);
    const explanation = explanationMode && card.explanations && card.explanations[explanationMode];
    const picker = node("div", { className: "difficulty-picker", dataset: { difficultyCard: card.id } });
    const menuID = "difficulty-menu-" + safeCardElementId(card.id);
    picker.appendChild(node("button", { type: "button", className: "difficulty-mark", ariaLabel: "Difficulty " + (card.difficulty || 5) + " of 10 · " + difficultyLabel(card.difficulty || 5) + ". Change this card’s explanation.", "aria-haspopup": "menu", ariaExpanded: state.difficultyMenuCardId === card.id, ariaControls: menuID, dataset: { difficultyTriggerCard: card.id }, onClick: function () {
      const open = state.difficultyMenuCardId !== card.id;
      state.difficultyMenuCardId = open ? card.id : null;
      focusedDifficultyCardId = card.id;
      focusDifficultyMenuAfterRender = open;
      render();
    } }, "Difficulty " + (card.difficulty || 5) + " · " + difficultyLabel(card.difficulty || 5)));
    if (state.difficultyMenuCardId === card.id) {
      const menu = node("div", { id: menuID, className: "difficulty-menu", role: "menu", ariaLabel: "Explanation difficulty", onKeydown: function (event) { handleDifficultyMenuKeydown(event, card); } });
      [["simpler", "Simpler"], [undefined, "Original"], ["deeper", "Deeper"]].forEach(function (option) {
        const mode = option[0];
        const selected = explanationMode === mode;
        menu.appendChild(node("button", { type: "button", role: "menuitemradio", "aria-checked": String(selected), className: selected ? "selected" : "", dataset: { difficultyCard: card.id }, onClick: function () { chooseCardExplanation(card, mode); } }, option[1]));
      });
      picker.appendChild(menu);
    }
    meta.appendChild(picker);
    content.appendChild(meta);
    content.appendChild(node("p", { className: "fact-hook", text: card.hook }));
    content.appendChild(node("h3", { tabIndex: -1, dataset: { locationTitleCard: card.id }, text: card.title }));
    content.appendChild(cardBody(card));
    const pocketMapPanel = nativePocketMapPanel(card);
    if (pocketMapPanel) content.appendChild(pocketMapPanel);
    const chronologyPanel = nativeChronologyPanel(card);
    if (chronologyPanel) content.appendChild(chronologyPanel);
    const glossaryPanel = nativeGlossaryPanel(card);
    if (glossaryPanel) content.appendChild(glossaryPanel);
    if (explanationMode) {
      const currentFingerprint = cardExplanations.cardExplanationFingerprint(card);
      const savedExplanation = explanation && explanation.fingerprint === currentFingerprint && explanation.text && explanation.sources && explanation.sources.length ? explanation : null;
      const panel = node("div", { className: "learning-answer card-explanation", "aria-live": "polite" });
      const heading = node("div", { className: "card-explanation-heading" }, node("span", { className: "answer-label" }, svg("sparkles", 14), " ", explanationMode === "simpler" ? "Simpler explanation" : "Deeper explanation"));
      heading.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { chooseCardExplanation(card, undefined); } }, "Return to original"));
      panel.appendChild(heading);
      if (savedExplanation) {
        panel.appendChild(node("p", { text: savedExplanation.text }));
        const citations = node("div", { className: "answer-sources" });
        savedExplanation.sources.forEach(function (source, sourceIndex) {
          citations.appendChild(externalLink(source.canonicalUrl || source.url, source.title, "card-explanation-source-" + sourceIndex));
        });
        panel.appendChild(citations);
      } else if (state.adaptationLoading === card.id + ":" + explanationMode) {
        panel.appendChild(node("div", { className: "learning-loading", role: "status" }, node("span", { className: "loading-dot" }), " Writing a " + explanationMode + " version from this card’s sources…"));
      } else if (!state.key.trim()) {
        const settings = node("div", { className: "card-explanation-settings" }, node("span", { text: "Add a Gemini key to create this explanation." }));
        settings.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { state.view = "settings"; render(); } }, "Open Settings"));
        panel.appendChild(settings);
      } else {
        const settings = node("div", { className: "card-explanation-settings" }, node("span", { text: state.adaptationErrorByCard[card.id + ":adapt:" + explanationMode] || "This explanation could not be created." }));
        settings.appendChild(node("button", { type: "button", className: "text-button", onClick: function () { void adaptCardExplanation(card.id, explanationMode); } }, "Retry"));
        panel.appendChild(settings);
      }
      content.appendChild(panel);
    }
    content.appendChild(sourceList(card, false));
    if (card.learnMore) {
      const learnMorePanel = node("div", { className: "learning-answer learn-more-answer" }, node("span", { className: "answer-label" }, svg("sparkles", 14), " Learn more"), node("p", { text: card.learnMore }));
      if (card.learnMoreSources && card.learnMoreSources.length) learnMorePanel.appendChild(sourceList(card, "learnMore"));
      content.appendChild(learnMorePanel);
    }
    if (state.errorByCard[card.id]) content.appendChild(node("p", { className: "learning-error", text: state.errorByCard[card.id] }));
    content.appendChild(questionArea(card));
    article.appendChild(content);
    const actions = node("div", { className: "fact-actions" });
    const learnMenu = node("div", { className: "learn-more-menu", dataset: { learnCard: card.id } });
    const learnMenuID = "learn-more-menu-" + safeCardElementId(card.id);
    learnMenu.appendChild(node("button", { type: "button", className: "learn-more-button", disabled: Boolean(card.learnMore || learningTasks.has(state.workspaceId+":"+card.id+":learn")), onClick: function () { learnMore(card.id); } }, svg("sparkles", 16), node("span", { text: learningTasks.has(state.workspaceId+":"+card.id+":learn") ? "Reading" : card.learnMore ? "Learned" : "Learn more" })));
    if(state.errorByCard[card.id+":learn"])content.appendChild(node("p",{className:"learning-error",role:"alert",text:state.errorByCard[card.id+":learn"]}));
    learnMenu.appendChild(node("button", { type: "button", className: "learn-more-menu-trigger", ariaLabel: "More learning tools", ariaHaspopup: "menu", ariaExpanded: state.learnMenuCardId === card.id, ariaControls: learnMenuID, dataset: { learnTriggerCard: card.id }, onClick: function () {
      const open = state.learnMenuCardId !== card.id;
      state.learnMenuCardId = open ? card.id : null;
      focusedLearnCardId = card.id;
      focusLearnMenuAfterRender = open;
      render();
    } }, svg("chevronDown", 14)));
    if (state.learnMenuCardId === card.id) {
      const menu = node("div", { id: learnMenuID, className: "learn-more-popover", role: "menu", ariaLabel: "Learning tools", onKeydown: handleLearnMenuKeydown });
      if (nativeChronologyEvents(card).length >= 2) menu.appendChild(node("button", { type: "button", role: "menuitem", dataset: { learnMenuCard: card.id }, onClick: function () { openNativeChronology(card); } }, svg("sparkles", 14), " ", "View dates"));
      menu.appendChild(node("button", { type: "button", role: "menuitem", dataset: { learnMenuCard: card.id }, onClick: function () { openNativeGlossary(card); } }, svg("sparkles", 14), " ", "Explain the terms"));
      learnMenu.appendChild(menu);
    }
    actions.appendChild(learnMenu);
    actions.appendChild(node("button", { className: "feedback-button heard" + (card.feedback === "heard" ? " selected" : ""), onClick: function () { recordFeedback(card.id, "heard"); } }, svg("check", 15), node("span", { text: "Heard" })));
    actions.appendChild(node("button", { className: "feedback-button unknown" + (card.feedback === "unknown" ? " selected" : ""), onClick: function () { recordFeedback(card.id, "unknown"); } }, svg("help", 15), node("span", { text: "Unknown" })));
    actions.appendChild(node("button", { className: card.liked ? "active-like" : "", onClick: function () { toggleCard(card.id, "liked"); } }, svg("heart", 16), node("span", { text: "Like" })));
    actions.appendChild(node("button", { className: card.saved ? "active-save" : "", onClick: function () { toggleCard(card.id, "saved"); } }, svg("bookmark", 16), node("span", { text: "Save" })));
    const moreMenu = node("div", { className: "fact-more-menu", dataset: { moreCard: card.id } });
    const moreMenuID = "fact-more-" + safeCardElementId(card.id);
    moreMenu.appendChild(node("button", { type: "button", className: "fact-more-trigger overflow-action", ariaLabel: "More actions", "aria-haspopup": "menu", ariaExpanded: state.moreMenuCardId === card.id, ariaControls: moreMenuID, dataset: { moreTriggerCard: card.id }, onClick: function () {
      const open = state.moreMenuCardId !== card.id;
      state.moreMenuCardId = open ? card.id : null;
      focusedMoreCardId = card.id;
      focusMoreMenuAfterRender = open;
      render();
    } }, svg("more", 17)));
    if (state.moreMenuCardId === card.id) {
      const menu = node("div", { id: moreMenuID, className: "fact-more-popover", role: "menu", ariaLabel: "More fact actions", onKeydown: handleMoreMenuKeydown });
      [["reveal", "Reveal gradually", "sparkles"], ["topic-detour", "Three more from this topic", "sparkles"], ["rabbit", "Start rabbit hole", "arrow"], ["less", "Show fewer like this", "minus"], ["download", "Download card (" + factDownloads.downloadFormat(downloadMode).toUpperCase() + ")", "bookmark"]].forEach(function (option) {
        menu.appendChild(node("button", { type: "button", role: "menuitem", disabled: option[0] === "download" && Boolean(downloadTask), dataset: { moreMenuCard: card.id }, onClick: function () { runMoreCardAction(card, option[0]); } }, svg(option[2], 15), " ", option[1]));
      });
      moreMenu.appendChild(menu);
    }
    actions.appendChild(moreMenu);
    article.appendChild(actions);
    return article;
  }
  function feedView() {
    const layout = node("div", { className: "feed-layout" });
    layout.appendChild(topicPanel(false));
    const column = node("section", { className: "feed-content-column" });
    const toolbar = node("div", { className: "feed-toolbar" }, node("div", { className: "active-topics" }, node("span", { className: "toolbar-label", text: "Your feed" }), node("span", { className: "topic-chip selected-chip", text: selectedTopics().map(function (topic) { return topic.path.join(" / "); }).join(" · ") || "Your selected topics" })));
    toolbar.appendChild(node("button", { className: "ghost-button", disabled: !state.cards.length || Boolean(downloadTask), onClick: function () { exportFactsNative(state.cards, false); } }, "Download session"));
    toolbar.appendChild(repeatBatchControl());
    toolbar.appendChild(nativeDownloadFeedback());
    if (state.topicDetour || topicDetourCompletionNotice) {
      const detour = state.topicDetour;
      const status = detour ? detour.slotCardIds.some(function (id) { return !id; }) ? "Preparing three cards" : (detour.topicPath[detour.topicPath.length - 1] || "Topic") + " · " + Math.max(1, detour.furthestReached + 1) + " of 3" : topicDetourCompletionNotice;
      toolbar.appendChild(node("div", { className: "topic-detour-status", role: "status", "aria-live": "polite" }, node("span", { text: status }), detour ? node("button", { type: "button", onClick: endTopicDetour }, "End early") : null));
    }
    column.appendChild(toolbar);
    const feedCards = state.cards;
    column.appendChild(node("div", { className: "feed-intro" }, node("div", {}, node("h1", { text: "Keep going." }), node("p", { text: "One small idea at a time. Every card has a place to look next." })), node("span", { className: "feed-count", text: feedCards.length + " cards in this session" })));
    const list = node("div", { className: "fact-feed" });
    let visibleCards=searchedCards("feed");
    if(state.topicDetour && state.query){const pinned=new Set([state.topicDetour.sourceCardId].concat(state.topicDetour.slotCardIds));const matches=new Set(visibleCards.map(function(card){return card.id;}));visibleCards=feedCards.filter(function(card){return pinned.has(card.id)||matches.has(card.id);});}
    if(visibleCards.length>20)list.appendChild(window.LEARNED_MEDIA_WINDOWED.create(visibleCards,{className:"native-card-window",cacheKey:state.workspaceId+":cards",estimatedHeight:650,gap:16,pinnedKey:focusedQuestionCardId || focusedMoreCardId || focusedLearnCardId,key:function(card){return card.id;},render:cardElement}));
    else visibleCards.forEach(function(card){list.appendChild(cardElement(card));});
    if (state.loading) list.appendChild(node("div", { className: "feed-progress", role: "status" }, node("span", { className: "loading-dot" }), state.topicDetour && activeGenerationDetourId === state.topicDetour.id ? " Gemini is building your topic detour" : " Gemini is building the next facts"));
    if (!state.topicDetour && !state.loading && !state.generationError && state.started) list.appendChild(node("div", { className: "feed-bottom-actions" }, node("button", { type: "button", className: "small-load-button", disabled: state.loading, onClick: function (event) { event.preventDefault(); generateBatch(generationToken, 7); } }, "Generate 7 more")));
    column.appendChild(list);
    layout.appendChild(column);
    if (state.generationError && !state.loading) {
      list.appendChild(node("div", { className: "feed-error", role: "alert" }, svg("help", 17), node("div", {}, node("strong", { text: "Generation paused" }), node("span", { text: state.generationError })), node("button", { type: "button", className: "secondary-button", disabled: state.loading, onClick: function (event) { event.preventDefault(); retryFactBatch(); } }, "Retry missing facts"), node("button", { type: "button", className: "text-button", disabled: state.loading || !activeFactBatch, onClick: function (event) { event.preventDefault(); endFactBatch(); } }, "End this batch")));
    }
    return node("div", { className: "feed-workspace" }, state.toast ? node("div", { className: "feed-toast" }, svg("check", 15), " ", state.toast) : null, layout);
  }
  function repeatBatchDisabledReason() {
    if (state.loading || activeFactBatch || state.topicDetour) return "Finish or end the current batch or topic detour before repeating.";
    if (!batchReplay.isBatchSetup(state.lastCompletedBatchSetup)) return "Complete a full batch to save its setup here.";
    return "";
  }
  function repeatBatchControl() {
    const root = node("div", { className: "repeat-batch-control" });
    const disabledReason = repeatBatchDisabledReason();
    root.appendChild(node("button", { type: "button", className: "toolbar-icon-button repeat-batch-trigger", ariaLabel: "Feed controls", "aria-haspopup": "dialog", ariaExpanded: state.repeatMenuOpen, onClick: function () {
      state.repeatMenuOpen = !state.repeatMenuOpen;
      if (state.repeatMenuOpen) focusRepeatFirstAfterRender = true;
      else { state.repeatBatchPreview = null; repeatMenuTriggerFocus = true; }
      render();
    } }, svg("more", 16)));
    if (!state.repeatMenuOpen) return root;
    const panel = node("div", { className: "repeat-batch-popover", role: "dialog", ariaLabel: "Feed controls" });
    const preview = state.repeatBatchPreview;
    if (!preview) {
      const setup = batchReplay.isBatchSetup(state.lastCompletedBatchSetup) ? state.lastCompletedBatchSetup : null;
      panel.appendChild(node("button", { type: "button", className: "repeat-batch-menu-action", disabled: !setup || Boolean(disabledReason), title: disabledReason || undefined, onClick: function () {
        if (!setup || disabledReason) return;
        state.repeatBatchPreview = batchReplay.cloneBatchSetupForRepeat(setup, "preview-" + Date.now());
        focusRepeatFirstAfterRender = true;
        render();
      } }, node("strong", { text: "Repeat this batch’s setup" }), node("span", { text: setup ? "Use its original topics and settings with fresh facts." : "Complete a full batch to save its setup here." })));
      if (disabledReason) panel.appendChild(node("p", { className: "repeat-batch-note", role: "status", text: disabledReason }));
    } else {
      const summary = batchReplay.summarizeBatchSetup(preview);
      const list = node("ul");
      summary.topics.forEach(function (topic) { list.appendChild(node("li", {}, node("span", { text: topic.path }), node("b", { text: "×" + topic.count + " · L" + topic.difficulty }))); });
      const previewContent = node("div", { className: "repeat-batch-preview", ariaLive: "polite" }, node("strong", { text: "Fresh facts · " + summary.count + " cards" }), list,
        node("p", {}, node("b", { text: "Difficulty targets: " }), summary.difficulty),
        node("p", {}, node("b", { text: "Length: " }), summary.sentenceLength + " sentences · ", node("b", { text: "Pictures: " }), summary.displayMode === "picture-text" ? "On" : "Off"),
        node("p", {}, node("b", { text: "Fact angle: " }), factAngleOption(summary.factAngle).label, " · ", node("b", { text: "Surprise Me: " }), summary.surpriseMe ? "On" : "Off"));
      if (summary.rabbitHole) previewContent.appendChild(node("p", {}, node("b", { text: "Rabbit hole: " }), summary.rabbitHole));
      previewContent.appendChild(node("span", { className: "repeat-batch-hint", text: "Your current settings stay unchanged." }));
      panel.appendChild(previewContent);
      panel.appendChild(node("div", { className: "repeat-batch-preview-actions" },
        node("button", { type: "button", className: "primary-button small", disabled: Boolean(disabledReason), title: disabledReason || undefined, dataset: { repeatGenerate: "true" }, onClick: function () { const captured = state.repeatBatchPreview; if (!captured || disabledReason) return; state.repeatMenuOpen = false; void generateBatch(generationToken, captured.slots.length, undefined, captured); } }, "Generate fresh facts"),
        node("button", { type: "button", className: "text-button", onClick: function () { state.repeatBatchPreview = null; repeatMenuTriggerFocus = true; render(); } }, "Use current setup")));
    }
    root.appendChild(panel);
    return root;
  }
  function settingsView() {
    const section = node("section", { className: "content-view settings-view" });
    section.appendChild(node("div", { className: "view-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Your workspace" }), node("h1", { text: "Make the feed feel like yours." }), node("p", { text: "Settings stay calm, clear, and close to the experience they shape." })), node("div", { className: "settings-avatar" }, svg("panel", 18))));
    const grid = node("div", { className: "settings-grid" });
    const main = node("div", { className: "settings-main" });
    const gemini = node("section", { className: "settings-card gemini-settings-card" });
    gemini.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon blue" }, svg("key", 19)), node("div", {}, node("h2", { text: "Gemini API key" }), node("p", { text: "Use Gemini for fresh facts, Learn more, and questions." })), node("span", { className: "status-dot " + state.geminiStatus, text: statusLabel() })));
    gemini.appendChild(node("label", { className: "field-label", text: "Paste your API key here" }));
    const keyRow = node("div", { className: "key-input-row" });
    keyRow.appendChild(node("input", { id: "gemini-key", type: "password", value: state.key, placeholder: "Paste your API key here", autocomplete: "new-password", onInput: function (event) { if (activeFactBatch) { clearFactAngleBatch(); state.topicDetour = null; } cancelCardAdaptation(); cancelCardGlossary(); state.adaptationLoading = null; closeDifficultyMenu(false); state.keyEditEpoch += 1; state.key = event.target.value; clearSessionSearchCaches(); state.loadingCard = null; state.questionLoading = null; state.modelChecking = false; state.geminiStatus = "not-configured"; state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; }); state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); editNativeCredential("gemini", state.key); }, onKeydown: function (event) { if (event.key === "Enter") testKey(); } }));
    const keyActions = node("div", { className: "key-actions" });
    keyActions.appendChild(node("button", { className: "primary-button small", disabled: state.geminiStatus === "testing", onClick: testKey }, svg("sparkles", 15), state.geminiStatus === "testing" ? " Connecting" : " Connect Gemini"));
    keyActions.appendChild(node("button", { className: "ghost-button", onClick: function () { if (activeFactBatch) { clearFactAngleBatch(); state.topicDetour = null; } cancelCardAdaptation(); cancelCardGlossary(); state.adaptationLoading = null; closeDifficultyMenu(false); state.key = ""; clearSessionSearchCaches(); state.loadingCard = null; state.questionLoading = null; state.modelChecking = false; state.geminiStatus = "not-configured"; state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; }); state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); editNativeCredential("gemini", ""); showToast("Remembered key removed."); } }, "Remove"));
    keyRow.appendChild(keyActions);
    gemini.appendChild(keyRow);
    gemini.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your key is remembered in this Mac’s Keychain and privately synced when you sign in with Google. Remove also clears it from your account." })));
    if (state.toast) gemini.appendChild(node("p", { className: "settings-feedback", text: state.toast }));
    const checkedPrimaryCount = state.modelChecks.filter(function (model) { return PRIMARY_GEMINI_MODELS.indexOf(model.model) >= 0 && model.status !== "unchecked"; }).length;
    const workingPrimaryCount = new Set(state.modelChecks.filter(function (model) { return PRIMARY_GEMINI_MODELS.indexOf(model.model) >= 0 && model.status === "working"; }).map(function (model) { return model.resolvedModel || model.model; })).size;
    const modelHeading = node("div", { className: "model-check-heading" }, node("div", {}, node("strong", { text: "Available Gemini models" }), node("span", { text: checkedPrimaryCount ? checkedPrimaryCount + " primary models checked · " + workingPrimaryCount + "/2 ready · unchecked models are automatic fallbacks" : state.modelChecks.length ? "Both primary models must pass · unchecked models are automatic fallbacks" : "Connect to check available models" })));
    modelHeading.appendChild(node("button", { className: "ghost-button", disabled: state.modelChecking || !state.key.trim(), onClick: testKey }, state.modelChecking ? "Checking" : "Check connection"));
    gemini.appendChild(modelHeading);
    if (state.modelChecks.length) {
      const modelList = node("div", { className: "model-check-list", ariaLive: "polite" });
      state.modelChecks.forEach(function (model) {
        let detail = model.status === "unchecked" ? PRIMARY_GEMINI_MODELS.indexOf(model.model) >= 0 ? "Primary · not checked" : "Automatic fallback · tested if needed" : model.status === "working" ? (model.resolvedModel && model.resolvedModel !== model.model ? "Ready · resolves to " + model.resolvedModel : "Ready for generation") : model.error || "Unavailable";
        if (model.status === "cooldown" && model.retryAt) detail += " · retry after " + new Date(model.retryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        modelList.appendChild(node("div", { className: "model-check-row" }, node("span", { className: "model-status-dot " + model.status, ariaLabel: model.status }), node("div", {}, node("strong", { text: model.model }), node("small", { text: detail })), node("span", { className: "model-check-meta", text: (model.latencyMs ? model.latencyMs + " ms" : "—") + "\n" + (model.checkedAt ? new Date(model.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked") })));
      });
      gemini.appendChild(modelList);
    }
    gemini.appendChild(node("div", { className: "api-key-guide" }, node("div", { className: "api-key-guide-icon" }, svg("sparkles", 16)), node("div", { className: "api-key-guide-copy" }, node("strong", { text: "Need a key?" }), node("p", { text: "Create or copy one in Google AI Studio, then paste it here." })), externalLink(AI_STUDIO_URL, "Open AI Studio", "api-key-link")));
    main.appendChild(gemini);
    const youtube = node("section", { className: "settings-card youtube-settings-card" });
    youtube.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon blue" }, svg("image", 19)), node("div", {}, node("h2", { text: "YouTube Videos" }), node("p", { text: "Use your own YouTube Data API key for the approved video library." })), node("span", { className: "status-dot " + (state.youtubeStatus === "connected" || state.youtubeStatus === "refreshing" ? "connected" : state.youtubeStatus === "error" ? "unavailable" : ""), text: state.youtubeStatus === "connecting" ? "Connecting" : state.youtubeStatus === "refreshing" ? "Refreshing" : state.youtubeStatus === "connected" ? "Connected" : state.youtubeStatus === "error" ? "Needs attention" : "Not configured" })));
    youtube.appendChild(node("label", { className: "field-label", text: "Paste your YouTube API key here" }));
    const youtubeRow = node("div", { className: "key-input-row" });
    youtubeRow.appendChild(node("input", { id: "youtube-key", type: "password", value: state.youtubeKey, placeholder: "Paste your YouTube API key here", autocomplete: "new-password", onInput: function (event) { state.keyEditEpoch += 1; invalidateNativeYouTubeSync(); state.youtubeKey = event.target.value; editNativeCredential("youtube", state.youtubeKey); state.youtubeStatus = "not-configured"; state.youtubeError = ""; state.connectionToken += 1; clearNativeYouTubeProgress(); bridge("cancelAll", {}).catch(function () {}); render(); }, onKeydown: function (event) { if (event.key === "Enter") youtubeConnect(); } }));
    const youtubeActions = node("div", { className: "key-actions" });
    youtubeActions.appendChild(node("button", { className: "primary-button small", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: youtubeConnect }, state.youtubeStatus === "connecting" ? " Connecting" : state.youtubeStatus === "refreshing" ? " Refreshing" : " Connect YouTube"));
    youtubeActions.appendChild(node("button", { className: "ghost-button", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: function () { youtubeConnect(true); } }, "Refresh videos"));
    youtubeActions.appendChild(node("button", { className: "ghost-button", onClick: function () { state.keyEditEpoch += 1; invalidateNativeYouTubeSync(); state.youtubeKey = ""; editNativeCredential("youtube", ""); state.youtubeStatus = "not-configured"; state.youtubeError = ""; state.connectionToken += 1; clearNativeYouTubeProgress(); bridge("cancelAll", {}).catch(function () {}); showToast("Remembered YouTube key removed."); } }, "Remove key"));
    youtubeRow.appendChild(youtubeActions); youtube.appendChild(youtubeRow);
    youtube.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your YouTube key is remembered in this Mac’s Keychain and privately synced when you sign in with Google." })));
    const guideCopy = node("div", { className: "api-key-guide-copy" }, node("strong", { text: "Need a YouTube key?" }), node("p", { html: "1. <a href=\"https://console.cloud.google.com/projectcreate\" target=\"_blank\">Create or select a Google Cloud project</a><br>2. <a href=\"https://console.cloud.google.com/apis/library/youtube.googleapis.com\" target=\"_blank\">Enable YouTube Data API v3</a><br>3. Open <a href=\"https://console.cloud.google.com/apis/credentials\" target=\"_blank\">Credentials</a> → Create credentials → API key and restrict it to YouTube Data API v3<br>4. Copy the key into Learned Media and connect" }));
    guideCopy.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", function (event) { event.preventDefault(); bridge("openURL", { url: link.href }).catch(function (error) { showToast(error.message); }); }); });
    youtube.appendChild(node("div", { className: "api-key-guide youtube-guide" }, node("div", { className: "api-key-guide-icon" }, svg("image", 16)), guideCopy));
    youtube.appendChild(node("p", { className: "youtube-restriction-note", text: "Website keys may be restricted to the GitHub Pages site. The Mac app needs a key that permits native requests. Google will report restriction failures clearly." }));
    if (state.youtube.lastSyncAt) youtube.appendChild(node("p", { className: "youtube-restriction-note", text: "Last refresh: " + new Date(state.youtube.lastSyncAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }));
    if (state.youtubeProgress.phase !== "idle") youtube.appendChild(youtubeImportNotice());
    main.appendChild(youtube);
    const exports = node("section", { className: "settings-card export-settings-card" });
    exports.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon lilac" }, svg("bookmark", 19)), node("div", {}, node("h2", { text: "Download Facts" }), node("p", { text: "Save this workspace with its topic paths and Wikipedia sources." }))));
    const exportRow = node("div", { className: "export-controls" });
    const exportSelect = node("select", { id: "native-export-collection", value: downloadCollection, onChange: function (event) { downloadCollection = event.target.value; render(); } });
    exportSelect.appendChild(node("option", { value: "all", text: "All cards (" + state.cards.length + ")" }));
    exportSelect.appendChild(node("option", { value: "saved", text: "Saved Facts (" + state.cards.filter(function (c) { return c.saved; }).length + ")" }));
    exportSelect.value = downloadCollection;
    exportRow.appendChild(node("label", { htmlFor: "native-export-collection", className: "field-label", text: "Collection" })); exportRow.appendChild(exportSelect);
    const modeSelect = node("select", { id: "native-download-mode", onChange: function (event) { downloadMode = factDownloads.normalizeDownloadMode(event.target.value); bridge("saveDownloadPreference", { mode: downloadMode }).catch(function () {}); render(); } });
    factDownloads.DOWNLOAD_MODES.forEach(function (mode) { modeSelect.appendChild(node("option", { value: mode.id, text: mode.label })); }); modeSelect.value = downloadMode;
    exportRow.appendChild(node("label", { htmlFor: "native-download-mode", className: "field-label", text: "Download format" })); exportRow.appendChild(modeSelect);
    const selected = downloadCollection === "saved" ? state.cards.filter(function (c) { return c.saved; }) : state.cards;
    exportRow.appendChild(node("button", { className: "secondary-button", disabled: !selected.length || Boolean(downloadTask), onClick: function () { exportFactsNative(selected, false); } }, "Download cards"));
    exports.appendChild(exportRow); exports.appendChild(nativeDownloadFeedback()); main.appendChild(exports);
    const accountCard = node("section", { className: "settings-card" });
    accountCard.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon lilac" }, svg("user", 19)), node("div", {}, node("h2", { text: "Account" }), node("p", { text: "Google sign-in keeps your account ready on this Mac." }))));
    const syncLabel = state.syncStatus === "syncing" ? "Syncing your workspace" : state.syncStatus === "offline" ? "Offline; local changes are safe" : state.syncStatus === "error" ? "Sync needs attention" : "Synced to your Google account";
    const accountRow = node("div", { className: "account-row" }, node("div", { className: "account-avatar", text: state.account ? (state.account.name || "G").slice(0, 1).toUpperCase() : "L" }), node("div", {}, node("strong", { text: state.account ? state.account.name : "Local workspace" }), node("span", { text: state.account ? syncLabel : "Not signed in · saved locally" })));
    accountRow.appendChild(node("button", { className: "secondary-button", onClick: state.account ? signOut : signIn }, svg("login", 15), state.account ? " Sign out" : " Continue with Google"));
    accountCard.appendChild(accountRow);
    if (state.syncError) accountCard.appendChild(node("p", { className: "settings-feedback", text: state.syncError }));
    if (!state.account) accountCard.appendChild(node("p", { className: "settings-feedback", text: "Google sign-in is wired to the Learned Media Supabase project. Enable Google in its Auth provider settings to use it." }));
    main.appendChild(accountCard);
    const appearance = node("section", { className: "settings-card" });
    appearance.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon mint" }, svg("sun", 19)), node("div", {}, node("h2", { text: "Appearance" }), node("p", { text: "Choose the atmosphere you want to return to." }))));
    const themes = node("div", { className: "theme-switcher" });
    themes.appendChild(node("button", { className: document.body.classList.contains("theme-dark") ? "" : "selected", onClick: function () { document.body.classList.remove("theme-dark"); saveState(); render(); } }, svg("sun", 16), " Light"));
    themes.appendChild(node("button", { className: document.body.classList.contains("theme-dark") ? "selected" : "", onClick: function () { document.body.classList.add("theme-dark"); saveState(); render(); } }, svg("moon", 16), " Dark"));
    appearance.appendChild(themes);
    const revealPreference = node("label", { className: "reveal-preference-row" }, node("span", {}, node("strong", { text: "Reveal gradually" }), node("small", { text: "Start each fact with its hook and title, then reveal one sentence at a time. This preference applies on this Mac." })));
    const revealToggle = node("input", { type: "checkbox", checked: state.revealGradually, ariaLabel: "Reveal fact cards gradually" });
    revealToggle.addEventListener("change", function () { setRevealGraduallyPreference(revealToggle.checked); render(); });
    revealPreference.appendChild(revealToggle);
    appearance.appendChild(revealPreference);
    main.appendChild(appearance);
    grid.appendChild(main);
    const side = node("aside", { className: "settings-side" });
    const danger = node("section", { className: "danger-card" }, node("span", { className: "eyebrow", text: "Advanced" }), node("h2", { text: "Clear the slate." }), node("p", { text: "Feed reset is gentle. These controls affect the rest of your saved workspace." }));
    danger.appendChild(node("button", { className: "ghost-button full", onClick: resetAll }, svg("reset", 15), " Reset all preferences"));
    danger.appendChild(node("button", { className: "danger-button full", onClick: deleteData }, svg("reset", 15), " Delete learning data"));
    side.appendChild(danger);
    side.appendChild(node("section", { className: "settings-help mobile-use-help" }, svg("smartphone", 17), node("div", {}, node("strong", { text: "Use Learned Media on mobile" }), node("p", { text: "Open the site in Safari or Chrome on your iPhone. In Safari, tap Share → Add to Home Screen to keep it beside your other apps. The layout adapts to narrow screens without horizontal scrolling." }))));
    side.appendChild(node("section", { className: "settings-help" }, svg("help", 17), node("div", {}, node("strong", { text: "Privacy by default" }), node("p", { text: "Gemini and YouTube credentials are remembered in this Mac’s Keychain and sync privately with your signed-in account. The imported YouTube catalog stays on this Mac." }))));
    grid.appendChild(side);
    section.appendChild(grid);
    return section;
  }
  function chooseExploreTopic(label) {
    state.view="feed";state.started=false;
    if(label === "Custom topic"){render();requestAnimationFrame(function(){document.getElementById("custom-topic")?.focus();});return;}
    const target=flatTopics().find(function(topic){return topic.label === label;});
    if(target && selectionState(target)!=="selected")toggleTopicSelection(target.id);
    state.topicQuery=label;saveState();render();
  }
  function exploreView() {
    const section=node("section",{className:"content-view explore-view"});
    section.appendChild(node("div",{className:"view-heading"},node("div",{},node("span",{className:"eyebrow",text:"Explore the edges"}),node("h1",{text:"Find a thread worth following"}),node("p",{text:"Start with a broad idea, then keep narrowing until it feels like yours"})),node("button",{className:"secondary-button",onClick:function(){chooseExploreTopic("Custom topic");}},svg("plus",16)," Add custom topic")));
    const grid=node("div",{className:"explore-grid"});
    shared.EXPLORE_CATEGORIES.forEach(function(category){const topics=node("div",{className:"explore-topics"});category.topics.forEach(function(label){topics.appendChild(node("button",{onClick:function(){chooseExploreTopic(label);}},label,svg("arrow",13)));});grid.appendChild(node("article",{className:"explore-card "+category.tone},node("div",{className:"explore-card-top"},node("span",{className:"explore-symbol"},svg(category.label==="Science"?"flask":category.label==="History"?"history":category.label==="Geography"?"compass":"sparkles",18)),svg("arrow",18)),node("h2",{text:category.label}),node("p",{text:category.description}),topics));});section.appendChild(grid);return section;
  }
  let nativeCardWorker=null,nativeCardRevision=0,nativeCardJob=0,nativeCardSearchKey="",nativeCardResultKey="",nativeCardResultIds=[],nativeCardEligibilityRevision=0,nativeCardActiveEligibility=null;
  const nativeIndexedCards=new Map(),nativeCardEligibilityScopes=new Map();
  function sameCardIds(left,right){if(left===right)return true;if(left.length!==right.length)return false;for(let index=0;index<left.length;index++)if(left[index]!==right[index])return false;return true;}
  function cardSearchCollection(kind){
    const scope=JSON.stringify([state.account&&state.account.id||"local",state.workspaceId,kind]);
    let snapshot=nativeCardEligibilityScopes.get(scope);
    if(snapshot&&snapshot.source===state.cards){nativeCardEligibilityScopes.delete(scope);nativeCardEligibilityScopes.set(scope,snapshot);return snapshot;}
    const cards=kind==="saved"?state.cards.filter(function(card){return card.saved;}):kind==="likes"?state.cards.filter(function(card){return card.liked;}):state.cards;
    const ids=cards.map(function(card){return card.id;}),changed=!snapshot||!sameCardIds(snapshot.ids,ids);
    snapshot={source:state.cards,cards:cards,ids:changed?ids:snapshot.ids,revision:changed?++nativeCardEligibilityRevision:snapshot.revision,scope:scope};
    nativeCardEligibilityScopes.delete(scope);nativeCardEligibilityScopes.set(scope,snapshot);
    while(nativeCardEligibilityScopes.size>12)nativeCardEligibilityScopes.delete(nativeCardEligibilityScopes.keys().next().value);
    return snapshot;
  }
  function searchedCards(kind){
    const eligibility=cardSearchCollection(kind),cards=eligibility.cards,query=shared.search.normalizeSearchText(state.query);
    if(!query){if(nativeCardSearchKey){nativeCardSearchKey="";nativeCardJob++;nativeCardWorker?.postMessage?.({type:"cancel",requestId:nativeCardJob});}return cards;}
    const upserts=[],removeIds=[],live=new Set(state.cards.map(function(card){return card.id;}));
    for(const card of state.cards){const text=shared.cards.cardSearchText(card);if(nativeIndexedCards.get(card.id)!==text){nativeIndexedCards.set(card.id,text);upserts.push({id:card.id,text:text});}}
    for(const id of nativeIndexedCards.keys())if(!live.has(id)){nativeIndexedCards.delete(id);removeIds.push(id);}
    if(upserts.length || removeIds.length)nativeCardRevision++;
    if(nativeCardWorker===null && typeof Worker!=="undefined"){
      try{
        nativeCardWorker=new Worker("card-search.worker.js");
        nativeCardWorker.onmessage=function(event){
          const result=event.data;
          if(result.type==="eligibility-stale" && result.requestId===nativeCardJob){nativeCardActiveEligibility=null;nativeCardSearchKey="";render();return;}
          if(result.type==="results" && result.requestId===nativeCardJob && result.revision===nativeCardRevision && result.viewKey===nativeCardSearchKey && result.eligibilityScope===nativeCardActiveEligibility?.scope && result.eligibilityRevision===nativeCardActiveEligibility?.revision){nativeCardResultKey=nativeCardSearchKey;nativeCardResultIds=result.ids;render();}
        };
        nativeCardWorker.onerror=function(){nativeCardWorker.terminate();nativeCardWorker=false;nativeCardSearchKey="";nativeCardActiveEligibility=null;render();};
        nativeCardWorker.postMessage({type:"initialize",revision:nativeCardRevision,documents:Array.from(nativeIndexedCards,function(entry){return {id:entry[0],text:entry[1]};})});
        nativeCardActiveEligibility=null;
      }catch{nativeCardWorker=false;}
    }else if(nativeCardWorker && (upserts.length || removeIds.length))nativeCardWorker.postMessage({type:"update",revision:nativeCardRevision,upserts:upserts,removeIds:removeIds});
    if(nativeCardWorker&&(!nativeCardActiveEligibility||nativeCardActiveEligibility.scope!==eligibility.scope||nativeCardActiveEligibility.revision!==eligibility.revision)){
      nativeCardWorker.postMessage({type:"register-eligibility",revision:nativeCardRevision,eligibilityScope:eligibility.scope,eligibilityRevision:eligibility.revision,ids:eligibility.ids});
      nativeCardActiveEligibility={scope:eligibility.scope,revision:eligibility.revision};
    }
    const key=JSON.stringify([state.account&&state.account.id||"local",state.workspaceId,kind,nativeCardRevision,query,eligibility.revision]);
    if(key!==nativeCardSearchKey){
      nativeCardSearchKey=key;const id=++nativeCardJob;
      if(nativeCardWorker)nativeCardWorker.postMessage({type:"search",requestId:id,revision:nativeCardRevision,query:state.query,eligibilityScope:eligibility.scope,eligibilityRevision:eligibility.revision,viewKey:key});
      else (async function(){const result=[];for(let index=0;index<cards.length;index++){if(id!==nativeCardJob)return;const card=cards[index],score=shared.search.searchScoreNormalized(query,shared.search.normalizeSearchText(nativeIndexedCards.get(card.id)||""));if(score>0)result.push({id:card.id,index:index,score:score});if(index%100===99)await new Promise(function(resolve){setTimeout(resolve,0);});}if(id===nativeCardJob){result.sort(function(a,b){return b.score-a.score || a.index-b.index;});nativeCardResultIds=result.map(function(item){return item.id;});nativeCardResultKey=key;render();}})();
    }
    if(nativeCardResultKey!==key)return [];
    const byId=new Map(cards.map(function(card){return [card.id,card];}));return nativeCardResultIds.map(function(id){return byId.get(id);}).filter(Boolean);
  }
  function collectionView(kind) {
    const cards = searchedCards(kind);
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    const section = node("section", { className: "content-view" });
    section.appendChild(node("div", { className: "view-heading" }, node("div", {}, node("span", { className: "eyebrow", text: label }), node("h1", { text: "Your " + label.toLowerCase() + " discoveries." }), node("p", { text: "Keep the ideas that made you pause." }))));
    section.appendChild(nativeDownloadFeedback());
    if (cards.length) {
      const feed = node("div", { className: "collection-feed" });
      if(cards.length>20)feed.appendChild(window.LEARNED_MEDIA_WINDOWED.create(cards,{className:"native-card-window",cacheKey:state.workspaceId+":cards",estimatedHeight:650,gap:16,pinnedKey:focusedQuestionCardId || focusedMoreCardId || focusedLearnCardId,key:function(card){return card.id;},render:cardElement}));else cards.forEach(function (card) { feed.appendChild(cardElement(card)); });
      section.appendChild(feed);
    } else {
      section.appendChild(node("div", { className: "empty-collection" }, node("div", { className: "empty-orbit" }, svg(kind === "saved" ? "bookmark" : kind === "likes" ? "heart" : "history", 25)), node("h2", { text: "Nothing here yet." }), node("p", { text: "As you explore, your " + label.toLowerCase() + " facts will appear here." })));
    }
    return section;
  }
  function cancelNativeDownload() {
    if (downloadTask) downloadTask.cancel(); downloadTask = null; downloadJobToken += 1; downloadStatus = "Download canceled.";
  }
  function nativeDownloadFeedback() {
    const element = node("div", { className: "download-feedback", role: "status", ariaLive: "polite" }, downloadStatus);
    if (downloadTask) element.appendChild(node("button", { className: "ghost-button", onClick: function () { cancelNativeDownload(); render(); } }, "Cancel download"));
    return element;
  }
  function exportFactsNative(input, individual) {
    if (downloadTask || !input.length) return;
    const facts = factDownloads.snapshotDownloadCards(input), date = new Date().toISOString(), naming = factDownloads.prepareDownloadNames(downloadMode, facts, factDownloads.activeDownloadTags(state.topics), individual), token = ++downloadJobToken;
    const files = naming.folder ? facts.map(function (card, index) { return { name: naming.entries[index], text: factDownloads.exportText(state.workspaceName, date, [card]), facts: [card] }; }) : [{ name: naming.entries[0], text: factDownloads.exportText(state.workspaceName, date, facts), facts: facts }];
    const cardCount = facts.length;
    downloadStatus = "Preparing " + naming.filename + " · " + cardCount + " card" + (cardCount === 1 ? "" : "s") + "…";
    downloadTask = bridge("exportFacts", { format: naming.format, folder: naming.folder, filename: naming.filename, files: files, token: token }); render();
    downloadTask.then(function (result) { if (token !== downloadJobToken) return; const savedName = result.filename || naming.filename, savedCount = Number.isFinite(result.cardCount) ? result.cardCount : cardCount, format = result.format || naming.format, omitted = Number(result.omittedImages) || 0; downloadStatus = result.canceled ? "Download canceled." : "Saved " + savedName + " · " + savedCount + " card" + (savedCount === 1 ? "" : "s") + " · " + factDownloads.downloadContentsSummary(format, omitted) + "."; }).catch(function (error) { if (token === downloadJobToken) downloadStatus = error.message === "Request canceled." || error.message === "Download canceled." ? "Download canceled." : error.message || "Download failed."; }).finally(function () { if (token === downloadJobToken) { downloadTask = null; render(); } });
  }

  function confirmationOverlay() {
    const request = state.confirmation;
    if (!request) return null;
    return node("div", { className: "confirmation-backdrop", role: "presentation", onClick: function (event) { if (event.target === event.currentTarget) closeConfirmation(); } },
      node("section", { className: "confirmation-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "native-confirmation-title", "aria-describedby": "native-confirmation-message", onClick: function (event) { event.stopPropagation(); } },
        node("span", { className: "eyebrow", text: "Please confirm" }),
        node("h2", { id: "native-confirmation-title", text: request.title }),
        node("p", { id: "native-confirmation-message", text: request.message }),
        node("div", { className: "confirmation-actions" },
          node("button", { type: "button", className: "ghost-button", onClick: closeConfirmation }, "Cancel"),
          node("button", { type: "button", className: "danger-button", autofocus: true, onClick: confirmPendingAction }, request.confirmLabel)
        )
      )
    );
  }
  function render() {
    if(state.view !== "videos" && youtubeSearchController) cancelYoutubeSearch();
    if(state.view === "videos") videoSearchIndex();
    const keepPlayer = state.view === "videos" && state.youtube.selectedVideoId && playerIdentity === youtubePlayerIdentity(youtubeOwnerID(), state.workspaceId, state.youtube.selectedVideoId) && playerShell && playerShell.isConnected;
    if (keepPlayer) {
      const heading = document.querySelector(".video-player-heading button");
      if(heading) heading.replaceChildren(svg("bookmark",15),state.youtube.savedIds.includes(state.youtube.selectedVideoId) ? " Saved" : " Save video");
      const tabs=document.querySelector(".video-tabs");if(tabs)tabs.replaceWith(videoTabs());
      const column=document.querySelector(".video-player-column");
      if(playerEndedIdentity===playerIdentity && column && !column.querySelector(".video-related")){
        const current=youtubeById.get(state.youtube.selectedVideoId);
        const related=current && relatedVideosFor(current,playerIdentity);
        if(related && related.length)column.appendChild(node("section",{className:"video-related"},node("h2",{text:"More like this"}),youtubeList(related)));
      }
      return;
    }
    if (stopYoutubePlayback) stopYoutubePlayback();
    playerIdentity="";playerShell=null;playerFrame=null;playerEndedIdentity="";
    if(videoLoadObserver){videoLoadObserver.disconnect();videoLoadObserver=null;}
    const currentTopicTree = document.querySelector(".topic-tree");
    if (currentTopicTree) topicTreeScrollTop = currentTopicTree.scrollTop;
      const currentMainScroll = document.querySelector(".main-scroll");
    if (currentMainScroll) mainScrollTop = /auto|scroll/.test(getComputedStyle(currentMainScroll).overflowY) ? currentMainScroll.scrollTop : window.scrollY;
    if (resetYoutubePlayerScroll) { mainScrollTop = 0; resetYoutubePlayerScroll = false; }
      if(restoreYoutubeBrowseScroll){
        const origin=youtubeBrowseReturn;
        if(origin && origin.ownerID===youtubeOwnerID() && origin.workspaceID===state.workspaceId)mainScrollTop=origin.scrollTop;
        else youtubeBrowseReturn=null;
        restoreYoutubeBrowseScroll=false;
      }
    const activeElement = document.activeElement;
    const restoreRepeatTrigger = repeatMenuTriggerFocus;
    repeatMenuTriggerFocus = false;
    const focusRepeatFirst = focusRepeatFirstAfterRender;
    focusRepeatFirstAfterRender = false;
    if (activeElement && activeElement.dataset && activeElement.dataset.spotlightCard && activeElement.dataset.spotlightTrigger) {
      focusedSpotlightTrigger = { workspaceId: state.workspaceId, cardId: activeElement.dataset.spotlightCard, triggerId: activeElement.dataset.spotlightTrigger };
    }
    if (activeElement && activeElement.dataset && activeElement.dataset.spotlightContextCard && activeElement.dataset.spotlightEvidence) {
      focusedSpotlightContext = { workspaceId: state.workspaceId, cardId: activeElement.dataset.spotlightContextCard, evidenceIndex: activeElement.dataset.spotlightEvidence };
    }
    if (activeElement && activeElement.dataset && activeElement.dataset.topicId) focusedTopicId = activeElement.dataset.topicId;
    if (activeElement && activeElement.dataset && activeElement.dataset.difficultyCard) focusedDifficultyCardId = activeElement.dataset.difficultyCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.moreTriggerCard) focusedMoreCardId = activeElement.dataset.moreTriggerCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.moreMenuCard) focusedMoreCardId = activeElement.dataset.moreMenuCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.learnTriggerCard) focusedLearnCardId = activeElement.dataset.learnTriggerCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.learnMenuCard) focusedLearnCardId = activeElement.dataset.learnMenuCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.chronologyHeadingCard) focusedChronologyHeadingCardId = activeElement.dataset.chronologyHeadingCard;
    if (activeElement && activeElement.dataset && activeElement.dataset.locationHeadingCard) focusedLocationHeadingCardId = activeElement.dataset.locationHeadingCard;
    const activeField = activeElement && ["gemini-key", "youtube-key", "youtube-search", "global-search", "topic-search"].includes(activeElement.id) ? activeElement : null;
    if (activeField) { focusedFieldId = activeField.id; focusedSelection = typeof activeField.selectionStart === "number" ? [activeField.selectionStart, activeField.selectionEnd] : null; }
    else if (activeElement && activeElement !== document.body) { focusedFieldId = null; focusedSelection = null; }
    focusedQuestionCardId = activeElement && activeElement.dataset ? activeElement.dataset.cardId || null : null;
    focusedQuestionSelection = focusedQuestionCardId && typeof activeElement.selectionStart === "number" ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    suppressTopicDetourScroll = true;
    document.body.classList.add("native-shell");
    app.replaceChildren();
    app.appendChild(navigation());
    const main = node("main", { className: "main-column" });
    const scroll = node("div", { className: "main-scroll" });
    scroll.addEventListener("scroll", handleNativeTopicDetourScroll, { passive: true });
    scroll.appendChild(state.view === "settings" ? settingsView() : state.view === "videos" ? videosView() : state.view === "explore" ? exploreView() : state.view === "feed" && !state.started ? setupView() : state.view === "feed" ? feedView() : collectionView(state.view));
    scroll.appendChild(node("button", { type: "button", className: "go-to-top", onClick: function () { window.scrollTo({ top: 0, behavior: "smooth" }); const target = document.querySelector(".main-scroll"); if (target) target.scrollTo({ top: 0, behavior: "smooth" }); } }, "Go to top"));
    main.appendChild(scroll);
    app.appendChild(main);
    const confirmation = confirmationOverlay();
    if (confirmation) app.appendChild(confirmation);
    const restoreSpotlightTrigger = focusedSpotlightTrigger;
    focusedSpotlightTrigger = null;
    const restoreSpotlightContext = focusedSpotlightContext;
    focusedSpotlightContext = null;
    const restoreDifficultyCardId = focusedDifficultyCardId;
    focusedDifficultyCardId = null;
    const focusMenuAfterRender = focusDifficultyMenuAfterRender;
    focusDifficultyMenuAfterRender = false;
    const restoreMoreCardId = focusedMoreCardId;
    focusedMoreCardId = null;
    const focusMoreMenu = focusMoreMenuAfterRender;
    focusMoreMenuAfterRender = false;
    const restoreLearnCardId = focusedLearnCardId;
    focusedLearnCardId = null;
    const focusLearnMenu = focusLearnMenuAfterRender;
    focusLearnMenuAfterRender = false;
    const restoreGlossaryHeadingCardId = focusedGlossaryHeadingCardId;
    focusedGlossaryHeadingCardId = null;
    const restoreGlossaryTriggerCardId = focusedGlossaryTriggerCardId;
    focusedGlossaryTriggerCardId = null;
    const restoreChronologyHeadingCardId = focusedChronologyHeadingCardId;
    focusedChronologyHeadingCardId = null;
    const restoreChronologyTriggerCardId = focusedChronologyTriggerCardId;
    focusedChronologyTriggerCardId = null;
    const restoreLocationHeadingCardId = focusedLocationHeadingCardId;
    focusedLocationHeadingCardId = null;
    const restoreLocationTriggerCardId = focusedLocationTriggerCardId;
    focusedLocationTriggerCardId = null;
    window.requestAnimationFrame(function () {
      const nextTopicTree = document.querySelector(".topic-tree");
      if (nextTopicTree) nextTopicTree.scrollTop = topicTreeScrollTop;
      const nextMainScroll = document.querySelector(".main-scroll");
      if (nextMainScroll) { if(/auto|scroll/.test(getComputedStyle(nextMainScroll).overflowY)) nextMainScroll.scrollTop = mainScrollTop; else window.scrollTo(0,mainScrollTop); }
      if(youtubeBrowseReturn && !state.youtube.selectedVideoId && state.view==="videos" && youtubeBrowseReturn.ownerID===youtubeOwnerID() && youtubeBrowseReturn.workspaceID===state.workspaceId){
        const origin=youtubeBrowseReturn;
        const root=nextMainScroll&&/auto|scroll/.test(getComputedStyle(nextMainScroll).overflowY)?nextMainScroll:null;
        const rootTop=root?root.getBoundingClientRect().top:0;
        const rootBottom=root?root.getBoundingClientRect().bottom:window.innerHeight;
        const anchor=origin.anchorVideoID&&Array.from(document.querySelectorAll("[data-video-id]")).find(function(element){return element.dataset.videoId===origin.anchorVideoID;});
        if(anchor){const rect=anchor.getBoundingClientRect();if(rect.bottom>rootTop&&rect.top<rootBottom){const delta=rect.top-rootTop-origin.anchorOffset;if(root)root.scrollTop+=delta;else window.scrollBy(0,delta);}}
        youtubeBrowseReturn=null;
      }
      const detourAnchor = pendingTopicDetourAnchor;
      pendingTopicDetourAnchor = null;
      if (detourAnchor && detourAnchor.workspaceId === state.workspaceId && nextMainScroll) {
        const anchor = Array.from(nextMainScroll.querySelectorAll("[data-card-id]")).find(function (element) { return element.dataset.cardId === detourAnchor.cardId; });
        if (anchor) { const delta=anchor.getBoundingClientRect().top-detourAnchor.top;if(/auto|scroll/.test(getComputedStyle(nextMainScroll).overflowY))nextMainScroll.scrollTop+=delta;else window.scrollBy(0,delta); }
      }
      if (focusedTopicId) {
        const focusTarget = Array.from(document.querySelectorAll("[data-topic-id]")).find(function (element) { return element.dataset.topicId === focusedTopicId; });
        if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
      }
      if (focusedFieldId) {
        const field = document.getElementById(focusedFieldId);
        if (field) {
          field.focus();
          if (focusedSelection && typeof field.setSelectionRange === "function") field.setSelectionRange(focusedSelection[0], focusedSelection[1]);
        }
      }
      if (focusedQuestionCardId) {
        const questionField = document.querySelector('input[data-card-id="' + CSS.escape(focusedQuestionCardId) + '"]');
        if (questionField) {
          questionField.focus();
          if (focusedQuestionSelection && typeof questionField.setSelectionRange === "function") questionField.setSelectionRange(focusedQuestionSelection[0], focusedQuestionSelection[1]);
        }
      }
      if (restoreSpotlightTrigger && restoreSpotlightTrigger.workspaceId === state.workspaceId) {
        const trigger = Array.from(document.querySelectorAll("[data-spotlight-card][data-spotlight-trigger]")).find(function (element) {
          return element.dataset.spotlightCard === restoreSpotlightTrigger.cardId && element.dataset.spotlightTrigger === restoreSpotlightTrigger.triggerId;
        });
        if (trigger) trigger.focus();
      }
      if (restoreSpotlightContext && restoreSpotlightContext.workspaceId === state.workspaceId) {
        const control = Array.from(document.querySelectorAll("[data-spotlight-context-card][data-spotlight-evidence]")).find(function (element) {
          return element.dataset.spotlightContextCard === restoreSpotlightContext.cardId && element.dataset.spotlightEvidence === restoreSpotlightContext.evidenceIndex;
        });
        if (control) control.focus();
      }
      if (restoreDifficultyCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-difficulty-trigger-card]")).find(function (element) { return element.dataset.difficultyTriggerCard === restoreDifficultyCardId; });
        if (trigger) {
          if (focusMenuAfterRender && state.difficultyMenuCardId === restoreDifficultyCardId) {
            const picker = trigger.closest(".difficulty-picker");
            const items = picker ? Array.from(picker.querySelectorAll("[role='menuitemradio']")) : [];
            (items.find(function (item) { return item.getAttribute("aria-checked") === "true"; }) || items[0] || trigger).focus();
          } else trigger.focus();
        }
      }
      if (restoreMoreCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-more-trigger-card]")).find(function (element) { return element.dataset.moreTriggerCard === restoreMoreCardId; });
        if (trigger) {
          if (focusMoreMenu && state.moreMenuCardId === restoreMoreCardId) {
            const menu = trigger.closest(".fact-more-menu");
            const item = menu && menu.querySelector("[role='menuitem']");
            (item || trigger).focus();
          } else trigger.focus();
        }
      }
      if (restoreLearnCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-learn-trigger-card]")).find(function (element) { return element.dataset.learnTriggerCard === restoreLearnCardId; });
        if (trigger) {
          if (focusLearnMenu && state.learnMenuCardId === restoreLearnCardId) {
            const wrapper = trigger.closest(".learn-more-menu");
            const item = wrapper && wrapper.querySelector("[role='menuitem']");
            (item || trigger).focus();
          } else trigger.focus();
        }
      }
      if (restoreGlossaryHeadingCardId) {
        const heading = Array.from(document.querySelectorAll("[data-glossary-heading-card]")).find(function (element) { return element.dataset.glossaryHeadingCard === restoreGlossaryHeadingCardId; });
        if (heading) heading.focus();
      }
      if (restoreGlossaryTriggerCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-learn-trigger-card]")).find(function (element) { return element.dataset.learnTriggerCard === restoreGlossaryTriggerCardId; });
        if (trigger) trigger.focus();
      }
      if (restoreChronologyHeadingCardId) {
        const heading = Array.from(document.querySelectorAll("[data-chronology-heading-card]")).find(function (element) { return element.dataset.chronologyHeadingCard === restoreChronologyHeadingCardId; });
        if (heading) heading.focus();
      }
      if (restoreChronologyTriggerCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-learn-trigger-card]")).find(function (element) { return element.dataset.learnTriggerCard === restoreChronologyTriggerCardId; });
        if (trigger) trigger.focus();
      }
      if (restoreLocationHeadingCardId) {
        const heading = Array.from(document.querySelectorAll("[data-location-heading-card]")).find(function (element) { return element.dataset.locationHeadingCard === restoreLocationHeadingCardId; });
        if (heading) heading.focus();
      }
      if (restoreLocationTriggerCardId) {
        const trigger = Array.from(document.querySelectorAll("[data-location-trigger-card]")).find(function (element) { return element.dataset.locationTriggerCard === restoreLocationTriggerCardId; });
        if (trigger) trigger.focus();
        else {
          const title = Array.from(document.querySelectorAll("[data-location-title-card]"))
            .find(function (element) { return element.dataset.locationTitleCard === restoreLocationTriggerCardId; });
          if (title) title.focus();
        }
      }
      if (restoreRepeatTrigger) {
        const trigger = document.querySelector(".repeat-batch-trigger");
        if (trigger) trigger.focus();
      } else if (focusRepeatFirst && state.repeatMenuOpen) {
        const target = state.repeatBatchPreview ? document.querySelector("[data-repeat-generate]") : document.querySelector(".repeat-batch-menu-action");
        if (target && !target.disabled) target.focus();
      }
      suppressTopicDetourScroll = false;
    });
  }
  function statusLabel() {
    return { "not-configured": "Not configured", testing: "Testing", connected: "Connected", invalid: "Invalid key", "rate-limited": "Rate limited", unavailable: "Gemini unavailable" }[state.geminiStatus] || "Not configured";
  }
  async function hydrate() {
    try {
      const nativeSaved = await bridge("loadState", {});
      try { downloadMode = factDownloads.normalizeDownloadMode(await bridge("loadDownloadPreference", {})); } catch (_) {}
      try { state.revealGradually = (await bridge("loadRevealGraduallyPreference", {})) === true; }
      catch (_) { state.revealGradually = false; }
      let localSaved = null, localBackup = null;
      try {
        localSaved = window.LEARNED_MEDIA_STORAGE.parseSnapshot(window.localStorage.getItem(LOCAL_WORKSPACE_KEY), "native-store", "read");
        localBackup = window.LEARNED_MEDIA_STORAGE.parseSnapshot(window.localStorage.getItem(LOCAL_WORKSPACE_KEY + "-backup"), "native-store", "read");
      } catch (_) {}
      const candidates = [nativeSaved, localSaved, localBackup].filter(function (saved) {
        return saved && window.LEARNED_MEDIA_STORAGE.validateSnapshot(saved, "native-store", "read");
      });
      candidates.sort(function (left, right) { return String(right.savedAt || "").localeCompare(String(left.savedAt || "")); });
      const parsed = candidates[0];
      if (parsed) {
        state.factMemory = (parsed.factMemory || []).map(normalizeMemory);
        state.cloudOwnerId = parsed.cloudOwnerId || (parsed.account && parsed.account.id) || null;
        (parsed.workspaces || []).forEach(function (record) { archiveFacts((record.state || {}).cards || []); });
        if (Array.isArray(parsed.workspaces) && parsed.workspaces.length) {
          state.workspaces = parsed.workspaces;
          const active = state.workspaces.find(function (workspace) { return workspace.id === parsed.activeWorkspaceId; }) || state.workspaces[0];
          applyWorkspaceSnapshot(active);
        } else {
          const legacy = { id: "local-workspace", name: "Local Workspace", createdAt: parsed.savedAt || new Date().toISOString(), updatedAt: parsed.savedAt || new Date().toISOString(), state: { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: Number(parsed.catalogVersion || 0), savedAt: parsed.savedAt, topics: parsed.topics, settings: parsed.settings, cards: parsed.cards, profile: parsed.profile, started: parsed.started, youtubeActivity: parsed.youtube } };
          state.workspaces = [legacy];
          applyWorkspaceSnapshot(legacy);
        }
        if (parsed.account) { state.account = parsed.account; state.syncStatus = "syncing"; }
        document.body.classList.toggle("theme-dark", parsed.theme === "dark");
      } else {
        state.workspaces = [{ id: state.workspaceId, name: state.workspaceName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state: currentWorkspaceSnapshot() }];
      }
      await nativeCredentials.switchAccount(null);
      try { state.account = await bridge("currentAccount", {}); }
      catch (error) { if (state.account) { state.syncStatus = "error"; state.syncError = error.message; } }
      if (state.account && state.account.id) {
        nativeCredentialOwner = state.account.id;
        await nativeCredentials.switchAccount(state.account.id);
      }
      nativeAccountRestored = true;
      checkRestoredNativeKey(state.key);
      const checkpointOwner=youtubeOwnerID();
      const checkpointWorkspaceIDs=(state.workspaces||[]).map(function(record){return String(record.id||"");}).filter(Boolean).slice(0,250);
      try{
        const checkpoints=await bridge("loadYouTubePlaybackCheckpoints",{ownerID:checkpointOwner,workspaceIDs:checkpointWorkspaceIDs})||{};
        if(checkpointOwner===youtubeOwnerID()){
          state.workspaces=mergeNativePlaybackCheckpoints(state.workspaces,checkpointOwner,checkpoints);
          const active=state.workspaces.find(function(workspace){return workspace.id===state.workspaceId;});
          if(active)applyWorkspaceSnapshot(active);
        }
      }catch(_){/* The selected recovery snapshot remains usable when checkpoint storage is unavailable. */}
      const catalog = await bridge("loadVideoCatalog", {});
      if (catalog && catalog.videos) {
        const activeRecord = state.workspaces.find(function (workspace) { return workspace.id === state.workspaceId; });
        const activity = activeRecord && activeRecord.state && (activeRecord.state.youtubeActivity || activeRecord.state.youtube) || youtubeActivity();
        legacyYoutubeRecencyPreferences = Object.assign({}, window.LEARNED_MEDIA_YOUTUBE.DEFAULT_RECENCY_PREFERENCES || {}, catalog.prioritizeRecentByChannel || {});
        state.youtube = Object.assign({}, state.youtube, catalog, { catalogVersion: shared.youtube.YOUTUBE_CATALOG_VERSION, sourceStates: Object.assign({}, catalog.sourceStates || {}) });
        state.youtube.videos = window.LEARNED_MEDIA_YOUTUBE.filter(state.youtube.videos || [], "", "All");
        applyYoutubeActivity(activity, legacyYoutubeRecencyPreferences);
        if (state.youtube.videos.length && !state.youtube.discoverIds.length) {
          state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(discoveryVideos(), 24, [],state.youtube.prioritizeRecentByChannel).map(function (video) { return video.id; });
          saveState();
        }
      }
      if (state.youtubeKey.trim() && state.youtube.videos.length) {
        state.youtubeStatus = "connected";
        if (await bridge("hasYouTubeImportPages", {})) youtubeConnect(false);
      }
      else if (state.youtubeKey.trim()) youtubeConnect(false);
      if (state.account && state.account.id) await syncCloudAccount();
    } catch (error) {
      state.toast = error.message;
    }
    render();
  }
  function addCustomTopic() {
    const label = state.customTopic.trim();
    if (!label) return;
    const existing = flatTopics();
    const normalizedLabel = topicSemantic.normalizeCustomTopicLabel(label);
    if (existing.some(function (topic) { return topicSemantic.normalizeCustomTopicLabel(topic.label) === normalizedLabel; })) { state.toast = "That topic is already in your mix."; render(); return; }
    const id = topicSemantic.createCustomTopicId(label, existing.map(function (topic) { return topic.id; }));
    state.topics = state.topics.concat([{ id: id, label: label, selected: true, expanded: false, weight: 10, custom: true }]);
    state.customTopic = "";
    saveState();
    render();
  }
  function removeCustomTopic(id) {
    const topic = findTopic(id);
    if (!topic || !topic.custom) return;
    state.topics = removeTopicById(state.topics, id);
    state.customTopic = "";
    saveState();
    showToast(topic.label + " removed from your topic tree.");
    render();
  }
  function beginTopicDetourGeneration(detour) {
    if (!detour || !state.topicDetour || state.topicDetour.id !== detour.id) return;
    const slotIndexes = topicDetours.missingTopicDetourSlots(detour);
    if (!slotIndexes.length) return;
    const request = { id: detour.id, topicPath: detour.topicPath.slice(), slotIndexes: slotIndexes };
    state.topicDetour = Object.assign({}, detour, { phase: "generating" });
    state.pendingSlots = slotIndexes.length;
    state.generationError = "";
    render();
    generateBatch(generationToken, slotIndexes.length, request);
  }
  function startTopicDetour(card) {
    if (!card || !Array.isArray(card.topicPath) || !card.topicPath.length) return;
    clearTopicDetourCompletionNotice();
    state.moreMenuCardId = null;
    focusedMoreCardId = card.id;
    if (!state.key.trim() || state.geminiStatus !== "connected") {
      state.view = "settings";
      showToast("Connect Gemini in Settings before creating three topic cards.");
      return;
    }
    const next = topicDetours.createTopicDetour(state.workspaceId, card.id, card.topicPath);
    if (state.loading && activeGenerationDetourId) {
      if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
      generationToken += 1;
      state.generationRequestToken += 1;
      activeGenerationTask = null;
      activeGenerationDetourId = null;
      state.loading = false;
      if (activeFactBatch && activeFactBatch.key === "detour:" + state.topicDetour.id) endFactAngleBatch();
    } else if (activeFactBatch && activeFactBatch.key === "feed") {
      state.topicDetour = Object.assign({}, next, { phase: "queued" });
      state.view = "feed";
      state.started = true;
      state.generationError = "";
      render();
      return;
    } else if (activeFactBatch && activeFactBatch.key.indexOf("detour:") === 0) {
      endFactAngleBatch();
    }
    state.topicDetour = next;
    state.view = "feed";
    state.started = true;
    state.generationError = "";
    render();
    if (!state.loading) beginTopicDetourGeneration(next);
  }
  function endTopicDetour() {
    const detour = state.topicDetour;
    if (!detour) return;
    if (state.loading && activeGenerationDetourId === detour.id) {
      if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
      generationToken += 1;
      state.generationRequestToken += 1;
      activeGenerationTask = null;
      activeGenerationDetourId = null;
      state.loading = false;
    }
    if (activeFactBatch && activeFactBatch.key === "detour:" + detour.id) endFactAngleBatch();
    state.topicDetour = null;
    state.pendingSlots = 7;
    state.generationError = "";
    render();
  }
  function endFactBatch() {
    if (state.loading || !activeFactBatch) return;
    const active = activeFactBatch;
    endFactAngleBatch();
    state.pendingSlots = 7;
    state.generationError = "";
    if (active.key.indexOf("detour:") === 0 && state.topicDetour && state.topicDetour.id === active.key.slice("detour:".length)) state.topicDetour = null;
    const queued = state.topicDetour;
    render();
    if (queued && queued.phase === "queued" && queued.workspaceId === state.workspaceId) window.queueMicrotask(function () {
      if (state.topicDetour && state.topicDetour.id === queued.id && !state.loading) beginTopicDetourGeneration(state.topicDetour);
    });
  }
  function retryFactBatch() {
    state.generationError = "";
    if (activeFactBatch && activeFactBatch.key === "feed") {
      generateBatch(generationToken, state.pendingSlots);
      return;
    }
    if (state.topicDetour && state.topicDetour.phase !== "queued") {
      beginTopicDetourGeneration(state.topicDetour);
      return;
    }
    generateBatch(generationToken, state.pendingSlots);
  }
  function startFeed() {
    if (!selectedCount()) return showToast("Choose at least one topic before starting.");
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.view = "settings"; return showToast("Add your Gemini API key in Settings and connect it before starting."); }
    clearTopicDetourCompletionNotice();
    const wasStarted = state.started;
    state.started = true;
    if (!wasStarted) state.cards = [];
    state.pendingSlots = 7;
    state.topicDetour = null;
    state.generationError = "";
    generationToken += 1;
    state.generationRequestToken += 1;
    saveState();
    render();
    generateBatch(generationToken, 7);
  }
  function resetFeed() {
    clearTopicDetourCompletionNotice();
    cancelCardGlossary();
    generationToken += 1;
    state.generationRequestToken += 1;
    if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
    activeGenerationTask = null;
    activeGenerationDetourId = null;
    state.topicDetour = null;
    state.repeatBatchPreview = null;
    state.repeatMenuOpen = false;
    clearFactAngleBatch();
    bridge("cancelAll", {}).catch(function () {});
    state.started = false;
    state.rabbitHole = null;
    state.cards = [];
    state.pendingSlots = 7;
    state.profile = {};
    state.loading = false;
    state.loadingCard = null; state.questionLoading = null;
    state.generationError = "";
    state.topics = shared.clearTopicSelections(state.topics);
    saveState();
    render();
    showToast("Feed reset. Choose a topic and press Start again.");
    mainScrollTop = 0;
    window.requestAnimationFrame(function () { window.scrollTo({ top: 0, behavior: "smooth" }); const target = document.querySelector(".main-scroll"); if (target) target.scrollTo({ top: 0, behavior: "smooth" }); });
  }
  function resetTopics() {
    state.topics = shared.clearTopicSelections(state.topics);
    state.pendingSlots = 7;
    state.generationError = "";
    saveState();
    render();
    showToast("Topics reset. Choose a topic to start again.");
  }
  function performResetAll() {
    cancelWorkspaceOperations();
    cancelNativeDownload(); downloadMode = "pdf-single"; bridge("saveDownloadPreference", { mode: downloadMode }).catch(function () {});
    clearTopicDetourCompletionNotice();
    cancelCardGlossary();
    generationToken += 1;
    state.generationRequestToken += 1;
    if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
    activeGenerationTask = null;
    activeGenerationDetourId = null;
    state.topicDetour = null;
    bridge("cancelAll", {}).catch(function () {});
    document.body.classList.remove("theme-dark");
    state.topics = makeTopics();
    topicResetEpoch++;
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    setRevealGraduallyPreference(false);
    state.cards = [];
    state.profile = {};
    state.started = false;
    state.generationError = "";
    state.view = "feed";
    saveState();
    render();
  }
  function resetAll() {
    requestConfirmation("Reset all preferences?", "Your topic mix, feed, and learning preferences will return to their starting values.", "Confirm", performResetAll);
  }
  function performDeleteData() {
    cancelWorkspaceOperations();
    state.topics = shared.clearTopicSelections(state.topics);
    clearTopicDetourCompletionNotice();
    cancelCardGlossary();
    generationToken += 1;
    state.generationRequestToken += 1;
    if (activeGenerationTask && typeof activeGenerationTask.cancel === "function") activeGenerationTask.cancel();
    activeGenerationTask = null;
    activeGenerationDetourId = null;
    state.topicDetour = null;
    bridge("cancelAll", {}).catch(function () {});
    state.cards = [];
    state.profile = {};
    state.started = false;
    state.generationError = "";
    saveState();
    render();
    showToast("Learning data cleared.");
  }
  function deleteData() {
    requestConfirmation("Delete learning data?", "Saved facts, likes, history, and the current feed will be removed from this workspace.", "Confirm", performDeleteData);
  }
  function cancelImageHydrations() {
    imageHydrationEpoch += 1;
    imageHydrationQueue.length = 0;
    imageHydrationQueued.clear();
    imageHydrationRequests.forEach(function (request) { if (request && typeof request.cancel === "function") request.cancel(); });
    imageHydrationRequests.clear();
  }
  function hydrateCardImages(cards, token) {
    const epoch = imageHydrationEpoch;
    (cards || []).filter(function (card) { return (card.displayModeOverride || state.settings.displayMode) === "picture-text"; }).forEach(function (card) {
      if (!card || !card.id || card.image || !(card.sources || []).length || imageHydrationQueued.has(card.id) || imageHydrationRequests.has(card.id)) return;
      imageHydrationQueued.add(card.id);
      imageHydrationQueue.push({ card: card, token: token, epoch: epoch, workspaceId: state.workspaceId });
    });
    void drainImageHydrationQueue();
  }
  async function drainImageHydrationQueue() {
    if (imageHydrationActive) return;
    imageHydrationActive = true;
    try {
      while (imageHydrationQueue.length) {
        const job = imageHydrationQueue.shift();
        imageHydrationQueued.delete(job.card.id);
        if (job.epoch !== imageHydrationEpoch || job.token !== generationToken || job.workspaceId !== state.workspaceId || (job.card.displayModeOverride || state.settings.displayMode) === "text") continue;
        const card = state.cards.find(function (item) { return item.id === job.card.id; });
        if (!card || card.image || !(card.sources || []).length) continue;
        const request = bridge("resolveFactImage", { cardId: card.id, source: card.sources[0] });
        imageHydrationRequests.set(card.id, request);
        try {
          const result = await request;
          if (job.epoch !== imageHydrationEpoch || job.token !== generationToken || job.workspaceId !== state.workspaceId || (job.card.displayModeOverride || state.settings.displayMode) === "text" || !result || !result.image) continue;
          const current = state.cards.find(function (item) { return item.id === result.cardId; });
          if (!current) continue;
          current.image = result.image;
          saveState();
          var scrollTop = window.scrollY;
          render();
          window.scrollTo(0, scrollTop);
        } catch (_) {
          // Images are optional and do not affect the completed text cards.
        } finally {
          if (imageHydrationRequests.get(card.id) === request) imageHydrationRequests.delete(card.id);
        }
      }
    } finally {
      imageHydrationActive = false;
      if (imageHydrationQueue.length) void drainImageHydrationQueue();
    }
  }
  function completeActiveFactBatch() {
    const batch = activeFactBatch;
    if (!batch || batch.workspaceId !== state.workspaceId || batch.accountId !== (state.account && state.account.id || null)) return false;
    if (batchReplay.missingBatchSetupSlots(batch.setup, Object.keys(batch.accepted)).length) return false;
    const acceptedIds = new Set(Object.values(batch.accepted));
    const acceptedCards = batch.setup.slots.map(function (slot) { return state.cards.find(function (card) { return card.id === batch.accepted[slot.id]; }); }).filter(Boolean);
    if (acceptedCards.length !== batch.setup.slots.length || acceptedIds.size !== batch.setup.slots.length) return false;
    const signatures = factNovelty.factNoveltySignatures(acceptedCards.map(memoryOf)).slice(0, 10);
    state.lastCompletedBatchSetup = Object.assign({}, batch.setup, { novelty: signatures });
    clearFactAngleBatch();
    return true;
  }
  async function generateBatch(token, requestedCount, detourRequest, replaySetup) {
    if (state.loading) return;
    if (!detourRequest && !replaySetup && !activeFactBatch && !selectedCount()) return;
    const activeToken = token || generationToken;
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.generationError = "Connect Gemini in Settings before generating facts."; state.loading = false; state.view = "settings"; render(); return; }
    const accountId = state.account && state.account.id || null;
    const batchKey = detourRequest ? "detour:" + detourRequest.id : "feed";
    let batch = activeFactBatch;
    let replay = false;
    let setup;
    if (batch) {
      if (batch.workspaceId !== state.workspaceId || batch.accountId !== accountId || batch.key !== batchKey) { state.generationError = "Finish or end the current batch before starting another one."; render(); return; }
      setup = batch.setup;
      replay = batch.replay;
    } else if (replaySetup) {
      if (!batchReplay.isBatchSetup(replaySetup)) { state.generationError = "The saved batch setup could not be verified."; render(); return; }
      replay = true;
      setup = batchReplay.cloneBatchSetupForRepeat(replaySetup, "repeat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      batch = { workspaceId: state.workspaceId, accountId: accountId, key: batchKey, setup: setup, accepted: {}, replay: true, replayNoveltyIndex: setup.novelty && setup.novelty.length ? new factNovelty.FactNoveltyIndex(setup.novelty) : null };
      activeFactBatch = batch;
      selectedFactAngle = "varied";
      state.repeatBatchPreview = null;
      state.repeatMenuOpen = false;
    } else {
      const count = Math.max(1, Math.min(10, Number(requestedCount) || 7));
      let assignments;
      if (detourRequest) {
        const indexes = detourRequest.slotIndexes || [];
        if (indexes.length !== 3 || new Set(indexes).size !== 3 || indexes.some(function (slot) { return !Number.isInteger(slot) || slot < 0 || slot > 2; })) { state.generationError = "This topic detour could not be restored safely. Please start it again."; render(); return; }
        assignments = indexes.map(function () { return { path: detourRequest.topicPath.slice(), weight: 10, difficulty: difficultyEngine.getTopicLearningProfile(state.profile, detourRequest.topicPath, state.settings.obscurity).targetDifficulty }; });
      } else assignments = weightedTopicPaths(count);
      if (!assignments.length) { state.generationError = "Choose at least one topic before generating more facts."; render(); return; }
      setup = batchReplay.createBatchSetup({ id: batchKey + "-" + Date.now(), slots: assignments.map(function (slot) { return { topicPath: slot.path, difficulty: slot.difficulty }; }), settings: Object.assign({}, state.settings, { sentenceLength: normalizeSentenceLength(state.settings.sentenceLength) }), factAngle: selectedFactAngle, rabbitHole: detourRequest ? null : state.rabbitHole });
      batch = { workspaceId: state.workspaceId, accountId: accountId, key: batchKey, setup: setup, accepted: {}, replay: false, replayNoveltyIndex: null };
      activeFactBatch = batch;
      selectedFactAngle = "varied";
    }
    const angleLabel = factAngleOption(setup.factAngle).label;
    const withAngle = function (message) { return angleLabel + " · " + message; };
    const completedSlotIds = Object.keys(batch.accepted);
    const remainingSlots = batchReplay.missingBatchSetupSlots(setup, completedSlotIds);
    const requestSlots = detourRequest ? detourRequest.slotIndexes.map(function (index) { return setup.slots[index]; }).filter(function (slot) { return slot && !batch.accepted[slot.id]; }) : remainingSlots;
    if (!requestSlots.length) { completeActiveFactBatch(); state.pendingSlots = 7; saveState(); render(); return; }
    const assignedTopics = requestSlots.map(function (slot) { return { path: slot.topicPath.slice(), weight: 10, difficulty: slot.difficulty, slotId: slot.id }; });
    if (!batchReplay.validBatchSlotAssignments(setup, assignedTopics)) { state.generationError = withAngle("The saved batch assignments could not be verified. End this batch and start again."); state.pendingSlots = requestSlots.length; render(); return; }
    batch.requestSlotIds = requestSlots.map(function (slot) { return slot.id; });
    state.activeGenerationSlotIds = batch.requestSlotIds.slice();
    state.loading = true;
    state.generationError = "";
    activeGenerationDetourId = detourRequest ? detourRequest.id : null;
    const existingCardIds = new Set(state.cards.map(function (card) { return card.id; }));
    const generationSentenceLength = normalizeSentenceLength(setup.settings.sentenceLength);
    state.activeGenerationSentenceLength = generationSentenceLength;
    state.batchAccepted = 0;
    state.pendingSlots = requestSlots.length;
    render();
    try {
      const generationSettings = Object.assign({}, setup.settings, { sentenceLength: generationSentenceLength });
      const avoid = (state.factMemory || []).concat(setup.novelty || []);
      const task = bridge("generate", { topics: assignedTopics, rabbitHole: setup.rabbitHole, requestedCount: requestSlots.length, settings: generationSettings, avoid: avoid, factAngle: setup.factAngle, token: state.generationRequestToken, detourId: detourRequest && detourRequest.id, detourSlots: detourRequest && detourRequest.slotIndexes });
      activeGenerationTask = task;
      const result = await task;
      if (activeToken !== generationToken || state.workspaceId !== batch.workspaceId || (state.account && state.account.id || null) !== batch.accountId || activeFactBatch !== batch) return;
      mergeGeminiModelOutcomes(result.modelOutcomes);
      if (result.modelStatus) state.geminiStatus = result.modelStatus;
      const mappedSlots = new Map((result.slotMappings || []).map(function (mapping) { return [mapping.cardId, mapping.slotId]; }));
      (result.cards || []).forEach(function (card, index) {
        if (Object.values(batch.accepted).indexOf(card.id) >= 0) return;
        const slotId = mappedSlots.get(card.id) || batch.requestSlotIds[index];
        const slotIndex = setup.slots.findIndex(function (slot) { return slot.id === slotId; });
        const detourSlot = detourRequest && detourRequest.slotIndexes.indexOf(slotIndex) >= 0 ? slotIndex : undefined;
        acceptNewFact(card, generationSentenceLength, detourRequest && Number.isInteger(detourSlot) ? { id: detourRequest.id, slot: detourSlot } : undefined, slotId, index);
      });
      const missing = batchReplay.missingBatchSetupSlots(setup, Object.keys(batch.accepted));
      if (missing.length) {
        state.pendingSlots = missing.length;
        state.generationError = withAngle(result.retryGuidance || (setup.slots.length - missing.length) + " of " + setup.slots.length + " facts completed. Retry to fill the missing slots.");
      } else {
        state.pendingSlots = 7;
        state.generationError = "";
        completeActiveFactBatch();
      }
    } catch (error) {
      if (activeToken !== generationToken || activeFactBatch !== batch) return;
      state.pendingSlots = batchReplay.missingBatchSetupSlots(setup, Object.keys(batch.accepted)).length || requestSlots.length;
      state.generationError = withAngle(error.message || "Could not generate a new batch.");
      showToast(state.generationError);
    } finally {
      if (activeToken === generationToken && state.workspaceId === batch.workspaceId && (state.account && state.account.id || null) === batch.accountId) {
        hydrateCardImages(state.cards.filter(function (card) { return !existingCardIds.has(card.id); }), activeToken);
        activeGenerationTask = null;
        activeGenerationDetourId = null;
        state.activeGenerationSlotIds = [];
        state.loading = false;
        saveState();
        render();
        const queued = state.topicDetour;
        if (!activeFactBatch && !detourRequest && queued && queued.phase === "queued" && queued.workspaceId === state.workspaceId) beginTopicDetourGeneration(queued);
      }
    }
  }
  function mergeGeminiModelOutcomes(outcomes) {
    const values = outcomes || [];
    values.forEach(function (outcome) {
      if (!outcome || !outcome.model) return;
      const previous = state.modelChecks.find(function (model) { return model.model === outcome.model; });
      const nextCheck = { model: outcome.model, status: outcome.status === "success" ? "working" : outcome.status, latencyMs: outcome.latencyMs, checkedAt: new Date().toISOString() };
      if (outcome.resolvedModel || previous && previous.resolvedModel) nextCheck.resolvedModel = outcome.resolvedModel || previous.resolvedModel;
      if (outcome.error) nextCheck.error = outcome.error;
      if (outcome.retryAt) nextCheck.retryAt = outcome.retryAt;
      state.modelChecks = state.modelChecks.filter(function (model) { return model.model !== outcome.model; });
      state.modelChecks.push(nextCheck);
    });
    state.modelChecks.sort(function (left, right) { return ALLOWED_GEMINI_MODELS.indexOf(left.model) - ALLOWED_GEMINI_MODELS.indexOf(right.model); });
    if (values.some(function (outcome) { return outcome && outcome.status === "success"; })) state.geminiStatus = "connected";
  }
  async function testKey() {
    const keyAtStart = state.key.trim();
    if (!keyAtStart) return showToast("Paste your Gemini API key first.");
    state.geminiStatus = "testing";
    state.modelChecking = true;
    state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; });
    state.connectionToken += 1;
    const connectionToken = state.connectionToken;
    render();
    try {
      const result = await bridge("testGemini", { key: keyAtStart, token: connectionToken });
      if (state.key.trim() !== keyAtStart || state.connectionToken !== connectionToken) return;
      state.geminiStatus = result.status || "unavailable";
      state.modelChecks = result.models || [];
      showToast(result.message || "Gemini could not verify this key.");
    } catch (error) {
      if (state.key.trim() !== keyAtStart || state.connectionToken !== connectionToken) return;
      state.geminiStatus = "unavailable";
      state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; });
      showToast(error.message);
    }
    if (state.key.trim() === keyAtStart && state.connectionToken === connectionToken) {
      state.modelChecking = false;
      render();
    }
  }
  const learningTasks=new Map();
  function learningIdentity(card){return [state.workspaceId,generationToken,state.keyEditEpoch,cardExplanations.cardExplanationFingerprint(card)].join(":");}
  function learningIsCurrent(card,identity){return state.cards.includes(card) && learningIdentity(card)===identity;}
  async function runCardLearning(card,action,question,requestedStructure,requestedStructureRevision,requestedInstructionPreference,requestedInstructionRevision){
    const operationKey=state.workspaceId+":"+card.id+":"+action;
    if(learningTasks.has(operationKey))return;
    const identity=learningIdentity(card),detailed=Boolean(card.questionDetailed),structure=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerStructure(requestedStructure),structureRevision=requestedStructureRevision===undefined?(questionStructureRevisions.get(questionDraftKey(card))||0):requestedStructureRevision,instructionPreference=action==="question"?(requestedInstructionPreference==="settings"?"settings":"written"):"written",instructionRevision=requestedInstructionRevision===undefined?(questionInstructionRevisions.get(questionDraftKey(card))||0):requestedInstructionRevision,questionResolution=action==="question"?window.LEARNED_MEDIA_ANSWER_STRUCTURE.resolveQuestionInstructions(question||"",detailed,structure,instructionPreference):null,history=(card.questionHistory||[]).slice(),answerDetailed=questionResolution?questionResolution.effectiveDetailed:(structure==="short-explanation"?false:detailed),normalizedQuestion=String(question||"").normalize("NFC").replace(/\s+/g," ").trim().toLowerCase();
    const errorKey=action==="learn"?card.id+":learn":card.id;
    const resolutionIdentity=questionResolution?{effectiveDetailed:questionResolution.effectiveDetailed,effectiveStructure:questionResolution.effectiveStructure,preference:questionResolution.preference,directive:questionResolution.directive}:null;
    const cacheKey=scopedCacheKey(state.key,[action,card.topicPath,card.hook,card.title,card.body,card.claim,(card.sources||[]).map(function(source){return [source.canonicalUrl||source.url,source.extract||""];}),action==="question"?normalizedQuestion:"",action==="question"?detailed:false,action==="question"?structure:"",action==="question"?"answer-structure-v1":"",action==="question"?"question-instruction-override-v1":"",action==="question"?instructionPreference:"",action==="question"?resolutionIdentity:null,action==="question"?history:[]]);
    const cached=learningResponseCache.get(cacheKey);
    state[action==="learn"?"loadingCard":"questionLoading"]=card.id;state.errorByCard[errorKey]="";
    const entry={identity:identity,task:null};learningTasks.set(operationKey,entry);render();
    try{
      let result=cached;
      if(!result){entry.task=bridge("learn",{action:action,card:card,question:question,detailed:detailed,structure:structure,instructionPreference:instructionPreference,history:history});result=await entry.task;}
      if(!learningIsCurrent(card,identity) || learningTasks.get(operationKey)!==entry)return;
      mergeGeminiModelOutcomes(result.modelOutcomes||[]);
      if(action==="learn"){card.learnMore=result.answer;card.learnMoreSources=result.citations||[];}
      else{
        const savedPresentation=window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeSavedAnswerPresentation(result.presentation);
        const normalizedAnswer=savedPresentation?{answer:result.answer,presentation:savedPresentation,structure:savedPresentation.structure}:window.LEARNED_MEDIA_ANSWER_STRUCTURE.normalizeAnswerResponse(result,questionResolution?questionResolution.effectiveStructure:structure);
        if(!normalizedAnswer)throw new Error("Gemini returned an answer that could not be safely presented.");
        result=Object.assign({},result,{answer:normalizedAnswer.answer,presentation:normalizedAnswer.presentation,structure:normalizedAnswer.structure});
        card.question=question;card.answer=result.answer;card.answerDetailed=answerDetailed;card.answerStructure=result.structure;card.answerPresentation=result.presentation;card.answerSources=result.citations||[];card.questionHistory=history.concat([{role:"user",content:question},{role:"assistant",content:result.answer}]);
        const draftKey=questionDraftKey(card);if(window.LEARNED_MEDIA_ANSWER_STRUCTURE.shouldResetSubmittedAnswerStructure(questionStructures.get(draftKey),structure,questionStructureRevisions.get(draftKey)||0,structureRevision)){questionStructures.delete(draftKey);questionStructureRevisions.set(draftKey,structureRevision+1);}const currentQuestion=questionDrafts.has(draftKey)?String(questionDrafts.get(draftKey)||""):String(card.question||"");if(action==="question"&&instructionPreference!=="written"&&currentQuestion.trim()===String(question||"").trim()&&(questionInstructionRevisions.get(draftKey)||0)===instructionRevision){questionInstructionPreferences.set(draftKey,"written");questionInstructionRevisions.set(draftKey,instructionRevision+1);}
      }
      if(!cached)learningResponseCache.set(cacheKey,{answer:result.answer,citations:result.citations||[],presentation:result.presentation,structure:result.structure});
      saveState();
    }catch(error){if(learningIsCurrent(card,identity))state.errorByCard[errorKey]=error.message;}
    finally{if(learningTasks.get(operationKey)===entry){learningTasks.delete(operationKey);if(learningIsCurrent(card,identity)){const field=action==="learn"?"loadingCard":"questionLoading";if(state[field]===card.id)state[field]=null;render();}}}
  }
  function learnMore(id){const card=state.cards.find(function(item){return item.id===id;});if(card && !card.learnMore)return runCardLearning(card,"learn");}
  function askQuestion(id,value){const card=state.cards.find(function(item){return item.id===id;}),question=String(value||"").trim();if(card && question){const draftKey=questionDraftKey(card);return runCardLearning(card,"question",question,questionStructures.get(draftKey),questionStructureRevisions.get(draftKey)||0,questionInstructionPreference(draftKey),questionInstructionRevisions.get(draftKey)||0);}}
  function toggleCard(id, property) {
    const card = state.cards.find(function (item) { return item.id === id; });
    if (!card) return;
    card[property] = !card[property];
    saveState();
    render();
  }
  function recordFeedback(id, kind) {
    const card = state.cards.find(function (item) { return item.id === id; });
    if (!card || card.feedback === kind) return;
    const topicPath = card.topicPath || ["this topic"];
    const topic = topicPath.slice(-1)[0];
    const result = difficultyEngine.recordTopicFeedback(state.profile, topicPath, kind, state.settings.obscurity, id, card.feedback);
    card.feedback = kind;
    card.known = kind === "heard";
    state.profile = result.profile;
    showToast(kind === "unknown" ? "New discovery noted — " + topic + " stays at difficulty " + result.targetDifficulty + "/10."
      : result.adjusted ? "Heard — " + topic + " is moving to difficulty " + result.targetDifficulty + "/10."
      : "Heard noted — repeated familiar facts can raise " + topic + " within two levels of your selection.");
    saveState();
    render();
  }
  async function signIn() {
    try {
      const result = await bridge("signIn", {});
      if (state.account?.id !== result.account?.id) { cancelWorkspaceOperations(); cancelNativeDownload(); clearFactAngleBatch(); state.repeatBatchPreview = null; state.repeatMenuOpen = false; questionDrafts.clear(); questionStructures.clear(); questionStructureRevisions.clear(); questionInstructionPreferences.clear(); questionInstructionRevisions.clear(); answerOptionsOpenKey=""; }
      const previousOwner = state.cloudOwnerId;
      state.account = result.account;
      nativeAccountRestored = false;
      nativeCredentialOwner = state.account.id;
      await nativeCredentials.switchAccount(state.account.id);
      nativeAccountRestored = true;
      checkRestoredNativeKey(state.key);
      state.cloudOwnerId = previousOwner && previousOwner !== result.account?.id ? "account-switch" : previousOwner;
      state.cloudSyncReady = false;
      state.syncStatus = "syncing";
      state.syncError = "";
      saveState();
      render();
      await syncCloudAccount();
      showToast("Signed in with Google. Your local workspaces are being merged safely.");
    } catch (error) {
      state.syncStatus = "error";
      state.syncError = error.message || "Google sign-in could not complete.";
      render();
      showToast(error.message);
    }
  }
  async function signOut() {
    cancelNativeDownload();
    questionDrafts.clear();questionStructures.clear();questionStructureRevisions.clear();questionInstructionPreferences.clear();questionInstructionRevisions.clear();answerOptionsOpenKey="";
    try {
      cancelWorkspaceOperations();
      cloudSyncToken += 1;
      cloudUploads = createCloudUploadQueue();
      if (cloudSaveTimer) { window.clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
      await bridge("signOut", {});
      state.account = null;
      state.repeatBatchPreview = null;
      state.repeatMenuOpen = false;
      nativeAccountRestored = false;
      nativeCredentialOwner = null;
      await nativeCredentials.switchAccount(null);
      nativeAccountRestored = true;
      state.cloudSyncReady = false;
      state.syncStatus = "signed-out";
      state.syncError = "";
      saveState();
      render();
      showToast("Signed out. Your local workspace is still available.");
    } catch (error) {
      state.syncStatus = "error";
      state.syncError = error.message || "Could not sign out.";
      render();
      showToast(error.message);
    }
  }
  function refreshYouTubeIfDue() {
    if (!state.youtubeKey.trim() || state.youtubeStatus === "not-configured" || state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing" || document.visibilityState === "hidden") return;
    const lastSync = state.youtube.lastSyncAt ? new Date(state.youtube.lastSyncAt).getTime() : 0;
    if (!lastSync || Date.now() - lastSync >= 24 * 60 * 60 * 1000) youtubeConnect(false);
  }
  window.setInterval(refreshYouTubeIfDue, 60 * 60 * 1000);
  document.addEventListener("visibilitychange", refreshYouTubeIfDue);
  function refreshAccountKeys() {
    if (state.account && state.account.id === nativeCredentialOwner && document.visibilityState !== "hidden") void nativeCredentials.refresh({ automatic: true });
    if (cloudUploads.hasUnacknowledged && document.visibilityState !== "hidden") scheduleCloudSave();
  }
  window.addEventListener("online", refreshAccountKeys);
  window.addEventListener("focus", refreshAccountKeys);
  document.addEventListener("visibilitychange", refreshAccountKeys);
  hydrate();
})();
