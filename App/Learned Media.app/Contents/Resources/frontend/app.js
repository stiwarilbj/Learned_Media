(function () {
  "use strict";

  const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
  const DEFAULT_SETTINGS = {
    obscurity: 5,
    displayMode: "picture-text",
    sentenceLength: 3,
    surpriseMe: false
  };
  const TOPIC_CATALOG_VERSION = 23;
  const REQUIRED_WORKING_MODELS = 3;
  const ALLOWED_GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
  const TOPICS = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  const DIFFICULTY_LABELS = ["", "A Little Hard", "Easy", "Moderate", "Challenging", "Decently Hard", "Hard", "Very Hard", "Extremely Hard", "Nearly Impossible", "Impossible"];
  const PERSISTENCE_VERSION = 2;
  const LOCAL_WORKSPACE_KEY = "learned-media-native-workspace";
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
    youtube: { channels: [], videos: [], savedIds: [], history: [], playbackPositions: {}, searchText: "", smartIds: null, smartReasons: {}, smartRan: false, topic: "All", tab: "discover", selectedChannelId: null, selectedVideoId: null, discoverIds: [], order: "newest", incomplete: false, catalogVersion: 4, sourceStates: {}, lastSyncAt: null },
    account: null,
    cloudOwnerId: null,
    cloudSyncReady: false,
    syncStatus: "signed-out",
    syncError: "",
    toast: "",
    confirmation: null,
    loading: false,
    loadingCard: null,
    errorByCard: {},
    generationError: "",
    pendingSlots: 10,
    youtubeSearchPhase: "idle",
    youtubeSearchError: "",
    connectionToken: 0,
    generationRequestToken: 0,
    activeGenerationSentenceLength: 3
  };
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
      evidence: evidence,
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
  let topicTreeScrollTop = 0;
  let mainScrollTop = 0;
  let focusedTopicId = null;
  let focusedFieldId = null;
  let focusedSelection = null;
  let focusedQuestionCardId = null;
  let focusedQuestionSelection = null;
  let saveInFlight = false;
  let cloudSaveTimer = null;
  let cloudSaveInFlight = false;
  let cloudSaveQueued = false;
  let cloudSyncToken = 0;
  let queuedWorkspaceState = null;
  let stopYoutubePlayback = null;
  let setupCustomizeOpen = false;
  let feedCustomizeOpen = false;
  let topicSearchExpansionSuppressed = false;
  let youtubeSyncActive = false;
  let youtubeSearchToken = 0;
  let searchInterpretToken = 0;
  let searchInterpretTimer = null;

  function makeTopics() {
    const tree = TOPICS.map(function (topic, index) { return buildTopicNode(topic, [], 0, index); }).filter(Boolean);
    function english(topic) {
      const original = topic.label;
      const replacements = { "Paul et Virginie": "Paul and Virginia", "Rokusei Senjutsu (Six-Star Astrology) Tells Your Fortune": "Six-Star Astrology Tells Your Fortune", "六星占術によるあなたの運命 (Rokusei Senjutsu: Six-Star Astrology Tells Your Fortune)": "Six-Star Astrology Tells Your Fortune", "六星占術によるあなたの運命": "Six-Star Astrology Tells Your Fortune" };
      topic.label = (replacements[original] || original).replace(/\s*\([^)]*\)/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E’‘–—]/g, "").replace(/\s+/g, " ").trim();
      if (topic.label !== original) topic.aliases = Array.from(new Set((topic.aliases || []).concat(original)));
      topic.children = (topic.children || []).map(function (child) { english(child); return child; }).filter(function (child) { return Boolean(child.label); });
    }
    const literature = tree.find(function (topic) { return topic.label === "Literature"; });
    if (literature) {
      english(literature);
      const books = (literature.children || []).find(function (topic) { return topic.label === "Books"; });
      if (books) {
        literature.children = [books].concat(literature.children.filter(function (topic) { return topic !== books; }));
        const list = (books.children || []).find(function (topic) { return topic.label === "Books from Your List"; });
        if (list) {
          list.children = sortBooksBySales(list.children);
          books.children = [list].concat(books.children.filter(function (topic) { return topic !== list; }));
        }
      }
    }
    return tree;
  }
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
      if (value === null || value === undefined || value === false) return;
      if (key === "className") element.className = value;
      else if (key === "text") element.textContent = normalizeUiCopy(value);
      else if (key === "html") element.innerHTML = value;
      else if (key === "onClick") element.addEventListener("click", value);
      else if (key === "onInput") element.addEventListener("input", value);
      else if (key === "onChange") element.addEventListener("change", value);
      else if (key === "onKeydown") element.addEventListener("keydown", value);
      else if (key === "disabled") element.disabled = Boolean(value);
      else if (key === "value") element.value = value;
      else if (key === "checked") element.checked = Boolean(value);
      else if (key === "ariaLabel") element.setAttribute("aria-label", value);
      else if (key === "ariaExpanded") element.setAttribute("aria-expanded", String(Boolean(value)));
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
    "Your key is remembered in this Mac’s Keychain, separate from workspaces, and sent only when Gemini is requested.",
    "Create or copy one in Google AI Studio, then paste it here.",
    "Use your own YouTube Data API key for the approved video library.",
    "Your YouTube key is remembered in this Mac’s Keychain, separate from workspaces, and never synced to your account.",
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
  function bridge(action, payload) {
    if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.native) {
      return Promise.reject(new Error("The native application bridge is unavailable."));
    }
    const id = "r" + (++requestID);
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      window.webkit.messageHandlers.native.postMessage({ id: id, action: action, payload: payload || {} });
    });
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
    if (!message || (message.token !== undefined && message.type === "modelCheck" && message.token !== state.connectionToken)) return;
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
      if (!acceptNewFact(raw, state.activeGenerationSentenceLength)) return;
      saveState();
      render();
    }
  };
  function flatTopics(nodes, parentPath) {
    const list = nodes || state.topics;
    const prefix = parentPath || [];
    return list.reduce(function (all, topic) {
      const path = prefix.concat(topic.label);
      return all.concat([Object.assign({}, topic, { path: path })], topic.children ? flatTopics(topic.children, path) : []);
    }, []);
  }
  function findTopic(id) { return flatTopics().find(function (topic) { return topic.id === id; }); }
  function selectedTopics() {
    return flatTopics().filter(function (topic) { return !topic.children || !topic.children.length; }).filter(function (topic) { return topic.selected; }).map(function (topic) { return { path: topic.path, weight: topic.weight }; });
  }
  function leafStats(topic) {
    if (!topic.children || !topic.children.length) return { selected: topic.selected ? 1 : 0, total: 1 };
    return topic.children.reduce(function (stats, child) { const next = leafStats(child); return { selected: stats.selected + next.selected, total: stats.total + next.total }; }, { selected: 0, total: 0 });
  }
  function selectionState(topic) {
    const stats = leafStats(topic);
    return stats.selected === 0 ? "none" : stats.selected === stats.total ? "selected" : "mixed";
  }
  function setBranchSelected(topic, selected) {
    return Object.assign({}, topic, { selected: selected, children: topic.children && topic.children.map(function (child) { return setBranchSelected(child, selected); }) });
  }
  function syncParentSelection(topic) {
    const next = topic.children ? Object.assign({}, topic, { children: topic.children.map(syncParentSelection) }) : topic;
    return Object.assign({}, next, { selected: selectionState(next) === "selected" });
  }
  function toggleTopicSelection(id) {
    function visit(list) {
      return list.map(function (topic) {
        if (topic.id === id) return setBranchSelected(topic, selectionState(topic) !== "selected");
        return topic.children ? Object.assign({}, topic, { children: visit(topic.children) }) : topic;
      }).map(syncParentSelection);
    }
    state.topics = visit(state.topics);
  }
  function selectedSummary() {
    const roots = state.topics.filter(function (topic) { return selectionState(topic) === "selected"; }).map(function (topic) { return topic.label; });
    const leaves = selectedTopics().map(function (topic) { return topic.path.join(" / "); });
    const visible = roots.length ? roots : leaves;
    if (!visible.length) return "No topics selected";
    return visible.slice(0, 3).join(" · ") + (visible.length > 3 ? " +" + (visible.length - 3) + " more" : "");
  }
  function selectedCount() { return selectedTopics().length; }
  function weightedTopicPaths(limit) {
    const pool = selectedTopics().map(function (topic) {
      const pathWeight = topic.path.reduce(function (total, label, index) {
        const parent = flatTopics().find(function (candidate) { return candidate.path.slice(0, index + 1).join("\u0000") === topic.path.slice(0, index + 1).join("\u0000"); });
        return total * ((parent ? parent.weight : 10) / 10);
      }, 10);
      return { path: topic.path, weight: Math.max(1, Math.round(pathWeight)), difficulty: (state.profile[topic.path.join(" / ")] || {}).targetDifficulty || state.settings.obscurity };
    });
    const result = [];
    while (pool.length && result.length < (limit || 10)) {
      const total = pool.reduce(function (sum, item) { return sum + item.weight; }, 0);
      let cursor = Math.random() * total;
      let index = pool.findIndex(function (item) { cursor -= item.weight; return cursor <= 0; });
      if (index < 0) index = pool.length - 1;
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }
  function updateTopicById(nodes, id, update) {
    return nodes.map(function (topic) { return topic.id === id ? update(topic) : topic.children ? Object.assign({}, topic, { children: updateTopicById(topic.children, id, update) }) : topic; });
  }
  function removeTopicById(nodes, id) {
    return nodes.filter(function (topic) { return topic.id !== id; }).map(function (topic) { return topic.children ? Object.assign({}, topic, { children: removeTopicById(topic.children, id) }) : topic; });
  }
  function migrateTopics(saved, collapseInitial, migrateLegacyRootWeights) {
    if (!Array.isArray(saved) || !saved.length) return makeTopics();
    let next = makeTopics();
    const fresh = flatTopics(next);
    const byId = new Map(fresh.map(function (topic) { return [topic.id, topic]; }));
    const byPath = new Map(fresh.map(function (topic) { return [topic.path.join("\u0000").toLowerCase(), topic]; }));
    const byLabel = new Map();
    const byAlias = new Map();
    fresh.forEach(function (topic) { const key = topic.label.toLowerCase(); byLabel.set(key, (byLabel.get(key) || []).concat(topic)); });
    fresh.forEach(function (topic) { (topic.aliases || []).forEach(function (alias) { const key = alias.toLowerCase(); byAlias.set(key, (byAlias.get(key) || []).concat(topic)); }); });
    const selectedIds = [];
    const legacySeriesParents = new Map();
    const customs = new Map();
    function resolveMigratedPath(pathParts) {
      var key = pathParts.join("\u0000").toLowerCase();
      return byPath.get(key) || fresh.find(function (topic) { return topic.path.slice(-pathParts.length).join("\u0000").toLowerCase() === key; });
    }
    function oldFlat(nodes, parentPath) {
      const prefix = parentPath || [];
      return nodes.reduce(function (all, topic) {
        const path = prefix.concat(topic.label);
        return all.concat([Object.assign({}, topic, { path })], topic.children ? oldFlat(topic.children, path) : []);
      }, []);
    }
    oldFlat(saved).forEach(function (oldTopic) {
      const oldPathKey = oldTopic.path.join("\u0000").toLowerCase();
      const migratedPath = window.LEARNED_MEDIA_POLITICAL_AUDIT && window.LEARNED_MEDIA_POLITICAL_AUDIT.migrations && window.LEARNED_MEDIA_POLITICAL_AUDIT.migrations[oldPathKey];
      const labelMigratedPath = window.LEARNED_MEDIA_POLITICAL_AUDIT && window.LEARNED_MEDIA_POLITICAL_AUDIT.labelMigrations && window.LEARNED_MEDIA_POLITICAL_AUDIT.labelMigrations[oldTopic.label.toLowerCase()];
      const target = ((migratedPath || labelMigratedPath) ? resolveMigratedPath(migratedPath || labelMigratedPath) : null) || byId.get(oldTopic.id) || byPath.get(oldPathKey)
        || ((byLabel.get(oldTopic.label.toLowerCase()) || []).length === 1 ? byLabel.get(oldTopic.label.toLowerCase())[0] : null)
        || ((byAlias.get(oldTopic.label.toLowerCase()) || []).length === 1 ? byAlias.get(oldTopic.label.toLowerCase())[0] : null);
      if (target) {
        const isLegacyBuiltInRoot = Boolean(migrateLegacyRootWeights && oldTopic.path.length === 1 && [30, 25, 20, 25].indexOf(oldTopic.weight == null ? 10 : oldTopic.weight) >= 0);
        next = updateTopicById(next, target.id, function (topic) { return Object.assign({}, topic, { weight: isLegacyBuiltInRoot ? 10 : (oldTopic.weight || topic.weight), expanded: collapseInitial ? false : oldTopic.expanded }); });
        if (oldTopic.selected) selectedIds.push(target.id);
      } else {
        if (oldTopic.path.length > 3 && oldTopic.path[0] === "Literature" && oldTopic.path[1] === "Best-Selling Book Series") {
          const parentPath = oldTopic.path.slice(0, 3).join("\u0000").toLowerCase();
          if (!legacySeriesParents.has(parentPath)) legacySeriesParents.set(parentPath, { selected: Boolean(oldTopic.selected), weight: oldTopic.weight });
        }
        if (migratedPath) return;
        if (!(oldTopic.custom || oldTopic.selected)) return;
        const key = oldTopic.label.toLowerCase();
        if (!customs.has(key)) customs.set(key, { id: "custom-" + slug(oldTopic.label), label: oldTopic.label, selected: Boolean(oldTopic.selected), expanded: false, weight: oldTopic.weight || 10, custom: true });
      }
    });
    legacySeriesParents.forEach(function (legacy, path) {
      const parent = byPath.get(path);
      if (!parent) return;
      next = updateTopicById(next, parent.id, function (topic) { return Object.assign({}, topic, { selected: legacy.selected || topic.selected, weight: legacy.weight || topic.weight }); });
      if (legacy.selected) selectedIds.push(parent.id);
    });
    selectedIds.forEach(function (id) { next = updateTopicById(next, id, function (topic) { return setBranchSelected(topic, true); }); });
    return next.concat(Array.from(customs.values()));
  }
  function difficultyLabel(value) { return DIFFICULTY_LABELS[Math.max(1, Math.min(10, Number(value) || 5))]; }
  function wikiURL(title) { return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/\s+/g, "_")); }
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
    return { savedIds: source.savedIds || [], history: source.history || [], playbackPositions: source.playbackPositions || {}, searchText: source.searchText || "", smartIds: source.smartIds || null, smartReasons: source.smartReasons || {}, smartRan: Boolean(source.smartRan), topic: source.topic || "All", tab: source.tab || "discover", selectedChannelId: source.selectedChannelId || null, selectedVideoId: source.selectedVideoId || null, discoverIds: source.discoverIds || [], order: source.order || "newest" };
  }
  function applyYoutubeActivity(activity) {
    if (!activity) return;
    const mapped = Object.assign({}, activity, { topic: activity.topic || activity.selectedTopic || "All", tab: activity.tab || activity.activeTab || "discover", order: activity.order || activity.channelOrder || "newest" });
    state.youtube = Object.assign({}, state.youtube, mapped, { savedIds: mapped.savedIds || [], history: mapped.history || [], playbackPositions: mapped.playbackPositions || {} });
  }
  function currentWorkspaceSnapshot() {
    return { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: new Date().toISOString(), topics: state.topics, settings: Object.assign({}, state.settings, { sentenceLength: normalizeSentenceLength(state.settings.sentenceLength) }), cards: state.cards, profile: state.profile, started: state.started, youtubeActivity: youtubeActivity() };
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
    const map = new Map();
    state.factMemory.forEach(function (item) { const normalized = normalizeMemory(item); const key = normalized.fingerprint || normalized.id; map.set(key, normalized); });
    cards.forEach(function (card) { const item = memoryOf(card); const key = item.fingerprint || item.id; const previous = map.get(key); item.known = item.known || Boolean(previous && previous.known); map.set(key, Object.assign({}, previous || {}, item)); });
    state.factMemory = Array.from(map.values());
  }
  function repeatedFact(card) {
    function normalized(text) { return String(text || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    const stop = new Set("a an the of in on at to for from by with and or but is was were are be been this that it its as his her their had has have who which they he she into through about also one two three".split(" "));
    function words(text) { return new Set(normalized(text).split(" ").filter(function (word) { return word.length > 2 && !stop.has(word); })); }
    function overlap(a,b) { return Array.from(a).filter(function (word) { return b.has(word); }).length / Math.max(1,Math.min(a.size,b.size)); }
    const item = memoryOf(card);
    return state.factMemory.some(function (old) {
      if (old.id === item.id || normalized(old.title) === normalized(item.title) || normalized(old.body) === normalized(item.body)) return true;
      if (item.fingerprint && old.fingerprint && item.fingerprint === old.fingerprint) return true;
      if (item.claim && old.claim && normalized(item.claim) === normalized(old.claim)) return true;
      if (item.evidence.some(function (quote) { return (old.evidence || []).some(function (other) { return normalized(quote) === normalized(other); }); })) return true;
      return overlap(words(item.body),words(old.body)) >= .78 && (overlap(words(item.title),words(old.title)) >= .5 || item.sourceUrls.some(function (url) { return (old.sourceUrls || []).indexOf(url) >= 0; }));
    });
  }
  function acceptNewFact(raw, expectedSentenceLength) {
    if (!raw || !raw.id || !raw.body || !hasExactSentenceCount(raw.body, expectedSentenceLength === undefined ? state.settings.sentenceLength : expectedSentenceLength) || repeatedFact(raw)) return false;
    const card = normalizeCard(raw);
    archiveFacts([card]);
    state.cards.push(card);
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
    const envelope = { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: snapshot.savedAt, activeWorkspaceId: state.workspaceId, workspaces: state.workspaces, factMemory: state.factMemory, account: state.account, cloudOwnerId: state.cloudOwnerId, theme: document.body.classList.contains("theme-dark") ? "dark" : "light" };
    queuedWorkspaceState = envelope;
    try { window.localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(envelope)); } catch (_) {}
    bridge("saveVideoCatalog", { catalog: state.youtube }).catch(function () {});
    flushWorkspaceSave();
    scheduleCloudSave();
  }
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
  function scheduleCloudSave() {
    if (!state.account || !state.cloudSyncReady) return;
    if (cloudSaveInFlight) { cloudSaveQueued = true; return; }
    if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = window.setTimeout(function () {
      cloudSaveTimer = null;
      if (cloudSaveInFlight || !state.account || !state.cloudSyncReady) return;
      const token = cloudSyncToken;
      cloudSaveInFlight = true;
      state.syncStatus = "syncing";
      state.syncError = "";
      bridge("cloudSave", { state: { persistenceVersion: PERSISTENCE_VERSION, catalogVersion: TOPIC_CATALOG_VERSION, savedAt: new Date().toISOString(), activeWorkspaceId: state.workspaceId, workspaces: state.workspaces, factMemory: state.factMemory, account: state.account, cloudOwnerId: state.cloudOwnerId, theme: document.body.classList.contains("theme-dark") ? "dark" : "light" } }).then(function () {
        if (token !== cloudSyncToken) return;
        state.syncStatus = "synced";
        state.syncError = "";
        render();
      }).catch(function (error) {
        if (token !== cloudSyncToken) return;
        state.syncStatus = navigator.onLine === false ? "offline" : "error";
        state.syncError = error.message || "Cloud sync could not save this Mac.";
        render();
      }).then(function () {
        cloudSaveInFlight = false;
        if (cloudSaveQueued) { cloudSaveQueued = false; scheduleCloudSave(); }
      });
    }, 700);
  }
  async function syncCloudAccount() {
    if (!state.account || !state.account.id) return;
    const token = ++cloudSyncToken;
    state.cloudSyncReady = false;
    state.syncStatus = "syncing";
    state.syncError = "";
    render();
    try {
      const remote = await bridge("cloudLoad", {});
      if (token !== cloudSyncToken || !state.account) return;
      const compatible = !state.cloudOwnerId || state.cloudOwnerId === state.account.id;
      const localWorkspaces = compatible ? state.workspaces : [];
      const localMemory = compatible ? state.factMemory : [];
      state.workspaces = mergeWorkspaceRecords(localWorkspaces, remote.records || []);
      if (!state.workspaces.length) state.workspaces = [emptyCloudWorkspace()];
      state.factMemory = mergeFactMemories(localMemory, remote.factMemory || []);
      state.cloudOwnerId = state.account.id;
      const active = state.workspaces.find(function (record) { return record.id === state.workspaceId; }) || state.workspaces[0];
      applyWorkspaceSnapshot(active);
      state.workspaces = state.workspaces.map(function (record) { return record.id === active.id ? Object.assign({}, record, { state: currentWorkspaceSnapshot() }) : record; });
      state.cloudSyncReady = true;
      state.syncStatus = "synced";
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
    const sources = storedSources.map(function (source, sourceIndex) {
      const url = String(source.url || wikiURL(source.title || "Wikipedia"));
      const canonicalUrl = source.canonicalUrl || url.split("#")[0];
      const quote = (card.evidence || []).find(function (item) { return item.sourceIndex === sourceIndex; });
      return quote && quote.quote && url.indexOf("#:~:text=") < 0 ? Object.assign({}, source, { canonicalUrl: canonicalUrl, url: wikipediaEvidenceLink(canonicalUrl, quote.quote) }) : source;
    }).slice(0, 3);
    const image = card.image || (card.imageUrl ? { url: card.imageUrl, alt: card.title, sourceTitle: first.title, sourceUrl: first.url, filePageUrl: first.url, credit: "Wikipedia image" } : null);
    const hook = titleCaseCatalogLabel(String(card.hook || card.title || "A small fact worth keeping").trim().replace(/\.+$/, ""));
    return Object.assign({
      id: "card-" + Date.now() + "-" + index,
      title: "",
      hook: "",
      body: "",
      topicPath: [],
      difficulty: 5,
      sentenceCount: normalizeSentenceLength(card.sentenceCount),
      accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5],
      createdAt: new Date().toISOString()
    }, card, { sources: sources, image: image, hook: hook });
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
  function sourceList(card, answer) {
    const sources = (answer ? card.answerSources : card.sources) || [];
    const list = node("div", { className: answer ? "answer-sources" : "fact-sources" });
    list.appendChild(node("span", { text: answer ? "Sources" : "Wikipedia sources" }));
    const links = node("div", { className: "source-links" });
    sources.slice(0, 3).forEach(function (source) { links.appendChild(externalLink(source.url || wikiURL(source.title), source.title || "Wikipedia")); });
    list.appendChild(links);
    return list;
  }
  function youtubeDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }); }
  function youtubeURL(id) { return "https://www.youtube.com/watch?v=" + encodeURIComponent(id); }
  function youtubeSave(id) { const saved = state.youtube.savedIds.indexOf(id) >= 0; state.youtube.savedIds = saved ? state.youtube.savedIds.filter(function (item) { return item !== id; }) : state.youtube.savedIds.concat(id); saveState(); render(); }
  function youtubeOpenVideo(id) {
    state.youtube.selectedVideoId = id; state.youtube.selectedChannelId = null;
    state.youtube.history = [{ videoId: id, watchedAt: new Date().toISOString() }].concat(state.youtube.history.filter(function (item) { return item.videoId !== id; })).slice(0, 200);
    saveState(); render();
  }
  function youtubeOpenChannel(id) { youtubeSearchToken += 1; state.youtube.selectedChannelId = id; state.youtube.selectedVideoId = null; state.youtube.tab = "channels"; state.youtube.searchText = ""; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtube.smartRan = false; render(); }
  function youtubeVideoCard(video) {
    const card = node("article", { className: "video-card" });
    const main = node("button", { className: "video-card-main", ariaLabel: "Watch " + video.title, onClick: function () { youtubeOpenVideo(video.id); } });
    const thumbnail = node("div", { className: "video-thumbnail" });
    if (video.thumbnailUrl) { const image = node("img", { src: video.thumbnailUrl, alt: "", loading: "lazy" }); thumbnail.appendChild(image); }
    else thumbnail.appendChild(node("span", {}, svg("image", 22)));
    thumbnail.appendChild(node("small", { text: video.durationLabel || "" }));
    main.appendChild(thumbnail);
    main.appendChild(node("div", { className: "video-card-copy" }, node("h3", { text: video.title }), node("p", { text: video.channelName }), node("time", { text: youtubeDate(video.publishedAt) })));
    card.appendChild(main);
    card.appendChild(node("button", { className: "video-save-button" + (state.youtube.savedIds.indexOf(video.id) >= 0 ? " saved" : ""), ariaLabel: state.youtube.savedIds.indexOf(video.id) >= 0 ? "Remove from saved videos" : "Save video", onClick: function () { youtubeSave(video.id); } }, svg("bookmark", 16)));
    const reason = state.youtube.smartReasons && state.youtube.smartReasons[video.id];
    if (reason) card.appendChild(node("details", { className: "video-match-reason" }, node("summary", { text: "Why this matches" }), node("p", { text: reason.explanation || "The metadata supports this search." }), node("small", { text: (reason.support || []).join(" · ") })));
    return card;
  }
  function youtubeList(videos) {
    if (!videos.length) return node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg("search", 24)), node("h2", { text: "No approved videos match that yet" }), node("p", { text: "Try another phrase, topic, or channel. Search stays inside the approved collection." }));
    const grid = node("div", { className: "video-grid" }); videos.forEach(function (video) { grid.appendChild(youtubeVideoCard(video)); }); return grid;
  }
  function youtubeImportNotice() {
    const progress = state.youtubeProgress || {};
    const sourceCount = progress.completedSources !== undefined ? (progress.completedSources || 0) + "/" + (progress.totalSources || 0) + " sources" : (progress.completedChannels || 0) + "/" + (progress.totalChannels || 58) + " channels";
    const notice = node("div", { className: "video-import-notice", role: "status" }, node("div", {}, node("strong", { text: progress.phase === "paused" ? "Import paused" : state.youtubeStatus === "refreshing" ? "Refreshing your approved library" : "Building your approved library" }), node("span", { text: sourceCount + " · " + (progress.importedVideos || 0).toLocaleString() + " videos imported" + (state.youtubeError ? " · " + state.youtubeError : "") })));
    notice.appendChild(node("button", { className: "ghost-button", onClick: progress.phase === "paused" ? function () { youtubeConnect(false); } : progress.phase === "complete" || progress.phase === "error" ? function () { youtubeConnect(true); } : function () { state.youtubeStatus = "paused"; state.youtubeProgress.phase = "paused"; generationToken += 1; bridge("cancelAll", {}).catch(function () {}); render(); } }, progress.phase === "paused" ? "Resume" : progress.phase === "complete" || progress.phase === "error" ? "Retry" : "Pause"));
    return notice;
  }
  function youtubeConnect(force) {
    const key = state.youtubeKey.trim();
    if (!key) { state.view = "settings"; showToast("Paste your YouTube API key in Settings first."); return; }
    if (youtubeSyncActive) return;
    youtubeSyncActive = true;
    const token = ++state.connectionToken;
    state.youtubeStatus = state.youtube.videos.length ? "refreshing" : "connecting"; state.youtubeError = ""; state.youtubeProgress = { phase: "resolving", completedChannels: 0, totalChannels: window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 }; render();
    window.LEARNED_MEDIA_YOUTUBE.sync(key, state.youtube, function (progress) { if (token !== state.connectionToken) return; state.youtubeProgress = progress; render(); }, Boolean(force)).then(function (result) {
      if (token !== state.connectionToken) return;
      const available = {}; result.videos.forEach(function (video) { available[video.id] = true; }); const preserved = (state.youtube.discoverIds || []).filter(function (id) { return available[id]; });
      state.youtube = Object.assign({}, state.youtube, { channels: result.channels, videos: result.videos, sourceStates: result.sourceStates, catalogVersion: 3, incomplete: result.incomplete, lastSyncAt: result.incomplete ? state.youtube.lastSyncAt : (result.lastSyncAt || new Date().toISOString()), discoverIds: preserved.length ? preserved : window.LEARNED_MEDIA_YOUTUBE.shuffle(result.videos, 24, []).map(function (video) { return video.id; }) }); state.youtubeStatus = result.incomplete ? "error" : "connected"; state.youtubeError = result.progress.error || ""; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtube.smartRan = false; saveState(); render(); showToast(result.incomplete ? "YouTube connected, but some approved sources need a retry." : "YouTube connected. Your approved video library is ready.");
    }).catch(function (error) { if (token !== state.connectionToken) return; state.youtubeStatus = "error"; state.youtubeProgress.phase = "error"; state.youtubeError = error.message || "YouTube import failed."; render(); showToast(state.youtubeError); }).finally(function () { youtubeSyncActive = false; });
  }
  async function youtubeSmartSearch() {
    const query = state.youtube.searchText.trim();
    if (!query) return;
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.view = "settings"; showToast("Connect Gemini in Settings before using Smart search. Ordinary video search works without it."); return; }
    const token = ++youtubeSearchToken;
    state.youtubeSmartLoading = true; state.youtubeSearchPhase = "interpreting"; state.youtubeSearchError = ""; state.youtube.smartRan = true; state.youtube.smartIds = []; state.youtube.smartReasons = {}; render();
    try {
      const plan = await bridge("videoSearch", { key: state.key.trim(), query: query });
      if (token !== youtubeSearchToken) return;
      const namedChannel = plan.channelId ? state.youtube.channels.find(function (channel) { return channel.id === plan.channelId; }) : plan.channel ? state.youtube.channels.find(function (channel) { return channel.name.toLowerCase().includes(String(plan.channel).toLowerCase()); }) : null;
      if ((plan.channel || plan.channelId) && !namedChannel) { state.youtube.smartIds = []; state.youtube.smartReasons = {}; state.youtubeSearchPhase = "idle"; state.youtubeSearchError = "That channel is not in the approved catalog."; state.youtubeSmartLoading = false; showToast(state.youtubeSearchError); render(); return; }
      const effectivePlan = Object.assign({}, plan, { terms: plan.terms && plan.terms.length || plan.include && plan.include.length || plan.conceptGroups && plan.conceptGroups.length ? plan.terms : [query], channelId: state.youtube.selectedChannelId || (namedChannel && namedChannel.id) || undefined });
      state.youtubeSearchPhase = "checking"; render();
      async function rankPass(candidates) {
        const chunks = []; for (let index = 0; index < candidates.length; index += 40) chunks.push(candidates.slice(index, index + 40));
        const ranked = await Promise.all(chunks.map(function (chunk) { return bridge("videoSearchRank", { key: state.key.trim(), query: query, plan: effectivePlan, candidates: chunk.map(function (item) { return { video: item.video, score: item.score, matchedFields: item.matchedFields, supportingText: item.supportingText }; }) }); }));
        return ranked.reduce(function (all, batch) { return all.concat(batch.results || []); }, []);
      }
      const initial = window.LEARNED_MEDIA_YOUTUBE.searchCandidates(state.youtube.videos, effectivePlan, state.youtube.topic, state.youtube.selectedChannelId, 80, [], false);
      let ranked = await rankPass(initial);
      if (ranked.length < 6 && token === youtubeSearchToken) {
        state.youtubeSearchPhase = "expanding"; render();
        const expanded = window.LEARNED_MEDIA_YOUTUBE.searchCandidates(state.youtube.videos, effectivePlan, state.youtube.topic, state.youtube.selectedChannelId, 80, initial.map(function (item) { return item.video.id; }), true);
        const more = await rankPass(expanded); const seen = {}; ranked.forEach(function (item) { seen[item.videoId] = true; }); ranked = ranked.concat(more.filter(function (item) { return !seen[item.videoId]; }));
      }
      if (token !== youtubeSearchToken) return;
      const byId = {}; state.youtube.videos.forEach(function (video) { byId[video.id] = video; }); const valid = ranked.filter(function (item) { return byId[item.videoId] && item.videoId.indexOf("demo-") !== 0; }).sort(function (a, b) { return a.relevance === b.relevance ? 0 : a.relevance === "direct" ? -1 : 1; }); let ids = valid.map(function (item) { return item.videoId; });
      if (plan.sort === "newest") ids.sort(function (a, b) { return byId[b].publishedAt.localeCompare(byId[a].publishedAt); });
      if (plan.sort === "oldest") ids.sort(function (a, b) { return byId[a].publishedAt.localeCompare(byId[b].publishedAt); });
      if (plan.sort === "random") ids = window.LEARNED_MEDIA_YOUTUBE.shuffle(ids.map(function (id) { return byId[id]; }), ids.length, []).map(function (video) { return video.id; });
      const reasons = {}; valid.forEach(function (item) { reasons[item.videoId] = item; }); state.youtube.smartIds = ids; state.youtube.smartReasons = reasons; state.youtube.smartRan = true; state.youtubeSearchPhase = "idle"; saveState(); showToast(ids.length + " relevant approved video" + (ids.length === 1 ? "" : "s") + " matched your search.");
    } catch (error) { if (token === youtubeSearchToken) { state.youtubeSearchPhase = "error"; state.youtubeSearchError = error.message || "Smart video search could not complete."; showToast(state.youtubeSearchError); } }
    if (token === youtubeSearchToken) { state.youtubeSmartLoading = false; render(); }
  }
  function cancelYoutubeSearch() { youtubeSearchToken += 1; state.youtubeSmartLoading = false; state.youtubeSearchPhase = "idle"; state.youtubeSearchError = ""; bridge("cancelAll", {}).catch(function () {}); render(); }
  function youtubeFilteredVideos() {
    const all = state.youtube.videos || [];
    if (state.youtube.tab === "saved") return all.filter(function (video) { return state.youtube.savedIds.indexOf(video.id) >= 0; });
    if (state.youtube.tab === "history") return state.youtube.history.map(function (item) { return all.find(function (video) { return video.id === item.videoId; }); }).filter(Boolean);
    if (state.youtube.selectedChannelId && !state.youtube.smartRan) return window.LEARNED_MEDIA_YOUTUBE.filter(all, state.youtube.searchText, state.youtube.topic, state.youtube.selectedChannelId).sort(function (a, b) { return state.youtube.order === "oldest" ? a.publishedAt.localeCompare(b.publishedAt) : state.youtube.order === "random" ? Math.random() - .5 : b.publishedAt.localeCompare(a.publishedAt); });
    if (state.youtube.smartRan && Array.isArray(state.youtube.smartIds)) return state.youtube.smartIds.map(function (id) { return all.find(function (video) { return video.id === id; }); }).filter(Boolean);
    if (state.youtube.searchText) return window.LEARNED_MEDIA_YOUTUBE.filter(all, state.youtube.searchText, state.youtube.topic);
    const byId = {}; all.forEach(function (video) { byId[video.id] = video; });
    const recommendationIds = (state.youtube.discoverIds || []).length ? state.youtube.discoverIds : window.LEARNED_MEDIA_YOUTUBE.filter(all, "", state.youtube.topic).slice(0, 24).map(function (video) { return video.id; });
    return recommendationIds.map(function (id) { return byId[id]; }).filter(Boolean);
  }
  function youtubeDetail(video) {
    const section = node("section", { className: "content-view video-workspace" });
    section.appendChild(node("button", { className: "text-button video-back-button", onClick: function () { state.youtube.selectedVideoId = null; render(); } }, svg("chevronRight", 15), " Back to videos"));
    const player = node("div", { className: "video-player-shell" });
    let frame = null;
    if (video.embedAvailable) {
      const position = Number(state.youtube.playbackPositions[video.id] || 0);
      const start = position > 1 ? "&start=" + Math.floor(position) : "";
      frame = node("iframe", { title: video.title, src: "https://www.youtube.com/embed/" + encodeURIComponent(video.id) + "?enablejsapi=1&origin=https%3A%2F%2Fcom.learnedmedia.app&rel=0&playsinline=1" + start, allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share", allowFullscreen: "true", referrerpolicy: "strict-origin-when-cross-origin" });
      player.appendChild(frame);
    }
    else player.appendChild(node("div", { className: "video-unavailable" }, svg("external", 24), node("strong", { text: "Watch this one on YouTube" }), externalLink(youtubeURL(video.id), "Open video", "api-key-link")));
    const playerColumn = node("div", { className: "video-player-column" });
    playerColumn.appendChild(player);
    const heading = node("div", { className: "video-player-heading" });
    heading.appendChild(node("div", {}, node("span", { className: "eyebrow", text: "Now watching" }), node("h1", { text: video.title }), node("p", { text: video.channelName + " · " + youtubeDate(video.publishedAt) + " · " + video.durationLabel })));
    heading.appendChild(node("button", { className: "secondary-button", onClick: function () { youtubeSave(video.id); } }, svg("bookmark", 15), state.youtube.savedIds.indexOf(video.id) >= 0 ? " Saved" : " Save video"));
    playerColumn.appendChild(heading);
    playerColumn.appendChild(node("div", { className: "video-player-links" }, externalLink(youtubeURL(video.id), "Watch on YouTube", "ghost-button"), node("span", { text: (video.topics || []).join(" · ") })));
    section.appendChild(node("div", { className: "video-player-layout" }, playerColumn));
    const related = (state.youtube.videos || []).filter(function (item) { return item.id !== video.id && (item.topics || []).some(function (topic) { return (video.topics || []).indexOf(topic) >= 0; }); }).slice(0, 6);
    if (related.length) playerColumn.appendChild(node("section", { className: "video-related" }, node("div", { className: "section-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Up next to explore" }), node("h2", { text: "More like this" }))), youtubeList(related)));
    if (frame) {
      let lastSaved = 0;
      const onMessage = function (event) {
        if (!String(event.origin).includes("youtube.com")) return;
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          const seconds = data && data.event === "infoDelivery" && data.info && Number(data.info.currentTime);
          if (Number.isFinite(seconds) && seconds >= 0) {
            state.youtube.playbackPositions[video.id] = seconds;
            if (Date.now() - lastSaved > 15000) { lastSaved = Date.now(); saveState(); }
          }
        } catch (_) {}
      };
      const requestPosition = function () { if (frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: "command", func: "getCurrentTime", args: [] }), "https://www.youtube.com"); };
      window.addEventListener("message", onMessage);
      const timer = window.setInterval(requestPosition, 5000);
      stopYoutubePlayback = function () { window.removeEventListener("message", onMessage); window.clearInterval(timer); stopYoutubePlayback = null; };
      requestPosition();
    }
    return section;
  }
  function videosView() {
    const section = node("section", { className: "content-view video-workspace" });
    if (state.youtube.selectedVideoId) { const selected = state.youtube.videos.find(function (video) { return video.id === state.youtube.selectedVideoId; }); if (selected) return youtubeDetail(selected); }
    if (state.youtube.selectedChannelId) { const channel = state.youtube.channels.find(function (item) { return item.id === state.youtube.selectedChannelId; }); section.appendChild(node("button", { className: "text-button video-back-button", onClick: function () { state.youtube.selectedChannelId = null; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; render(); } }, svg("chevronRight", 15), " All channels")); section.appendChild(node("div", { className: "view-heading video-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Channel catalog" }), node("h1", { text: channel ? channel.name : "Channel" }), node("p", { text: channel ? channel.videoCount.toLocaleString() + " imported videos from this approved channel" : "" })))); const controls = node("div", { className: "video-controls" }); controls.appendChild(node("label", { className: "video-search" }, svg("search", 16), node("input", { value: state.youtube.searchText, placeholder: "Search this channel", ariaLabel: "Search this channel", onInput: function (event) { state.youtube.searchText = event.target.value; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtubeSearchError = ""; render(); } }))); controls.appendChild(node("button", { className: "ghost-button", disabled: Boolean(state.youtubeSmartLoading) || !state.youtube.searchText.trim(), onClick: youtubeSmartSearch }, state.youtubeSmartLoading ? "Searching" : "Smart search")); controls.appendChild(node("select", { value: state.youtube.order, ariaLabel: "Sort channel videos", onChange: function (event) { state.youtube.order = event.target.value; render(); } }, node("option", { value: "newest", text: "Newest" }), node("option", { value: "oldest", text: "Oldest" }), node("option", { value: "random", text: "Random" }))); section.appendChild(controls); if (state.youtubeSmartLoading) section.appendChild(node("div", { className: "video-search-progress", role: "status" }, node("span", { text: state.youtubeSearchPhase === "interpreting" ? "Understanding your search" : state.youtubeSearchPhase === "expanding" ? "Looking more broadly" : "Checking matches" }), node("button", { className: "text-button", onClick: cancelYoutubeSearch }, "Cancel"))); if (state.youtubeSearchPhase === "error" && state.youtubeSearchError) section.appendChild(node("p", { className: "video-search-error", text: state.youtubeSearchError })); section.appendChild(youtubeList(youtubeFilteredVideos())); return section; }
    section.appendChild(node("div", { className: "view-heading video-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Learned Media Videos" }), node("h1", { text: state.youtube.tab === "saved" ? "Saved videos" : state.youtube.tab === "history" ? "Watch history" : "A calmer way to find something good." }), node("p", { text: "Discover approved creators, search their imported catalogs, and watch without leaving your workspace." })), node("div", { className: "video-heading-actions" }, node("button", { className: "secondary-button", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: function () { youtubeConnect(true); } }, svg("reset", 15), " Refresh videos"), node("button", { className: "secondary-button", disabled: !state.youtube.videos.length, onClick: function () { state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(state.youtube.videos, 24, []).map(function (video) { return video.id; }); state.youtube.tab = "discover"; render(); } }, svg("reset", 15), " Shuffle"), node("button", { className: "primary-button small", disabled: !state.youtube.videos.length, onClick: function () { const next = window.LEARNED_MEDIA_YOUTUBE.shuffle(state.youtube.videos, 24, state.youtube.discoverIds); state.youtube.discoverIds = state.youtube.discoverIds.concat(next.map(function (video) { return video.id; })); render(); } }, svg("plus", 15), " Show more"))));
    if ((state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing" || state.youtubeStatus === "error" || state.youtube.incomplete) && state.youtubeProgress.phase !== "idle") section.appendChild(youtubeImportNotice());
    const tabs = node("div", { className: "video-tabs", role: "tablist" }); [["discover", "Discover"], ["channels", "Channels"], ["saved", "Saved"], ["history", "History"]].forEach(function (item) { tabs.appendChild(node("button", { className: state.youtube.tab === item[0] ? "active" : "", role: "tab", ariaSelected: state.youtube.tab === item[0], onClick: function () { state.youtube.tab = item[0]; state.youtube.selectedChannelId = null; state.youtube.selectedVideoId = null; render(); } }, item[1], item[0] === "saved" && state.youtube.savedIds.length ? " " + state.youtube.savedIds.length : "")); }); section.appendChild(tabs);
    if (state.youtube.tab === "discover") { const controls = node("div", { className: "video-controls" }); controls.appendChild(node("label", { className: "video-search" }, svg("search", 16), node("input", { value: state.youtube.searchText, placeholder: "Search approved videos", ariaLabel: "Search approved videos", onInput: function (event) { state.youtube.searchText = event.target.value; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtubeSearchError = ""; render(); } }))); controls.appendChild(node("button", { className: "ghost-button", disabled: Boolean(state.youtubeSmartLoading) || !state.youtube.searchText.trim(), onClick: youtubeSmartSearch }, state.youtubeSmartLoading ? "Searching" : "Smart search")); if (state.youtubeSmartLoading) controls.appendChild(node("button", { className: "text-button", onClick: cancelYoutubeSearch }, "Cancel")); section.appendChild(controls); if (state.youtubeSearchPhase === "error" && state.youtubeSearchError) section.appendChild(node("p", { className: "video-search-error", text: state.youtubeSearchError })); const filters = node("div", { className: "video-topic-filters" }); ["All"].concat(window.LEARNED_MEDIA_YOUTUBE.TOPICS).forEach(function (topic) { filters.appendChild(node("button", { className: state.youtube.topic === topic ? "active" : "", onClick: function () { state.youtube.topic = topic; state.youtube.smartRan = false; state.youtube.smartIds = null; state.youtube.smartReasons = {}; state.youtubeSearchError = ""; state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(state.youtube.videos, 24, []).map(function (video) { return video.id; }); render(); } }, topic === "All" ? "All topics" : topic)); }); section.appendChild(filters); }
    if (state.youtube.tab === "channels") { if (state.youtube.channels.length) { const channels = node("div", { className: "channel-grid" }); state.youtube.channels.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (channel) { channels.appendChild(node("button", { className: "channel-card", onClick: function () { youtubeOpenChannel(channel.id); } }, channel.thumbnailUrl ? node("img", { src: channel.thumbnailUrl, alt: "" }) : node("span", { className: "channel-avatar", text: channel.name.slice(0, 1) }), node("span", {}, node("strong", { text: channel.name }), node("small", { text: channel.videoCount.toLocaleString() + " videos" })), svg("chevronRight", 17))); }); section.appendChild(channels); } else section.appendChild(node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg("image", 24)), node("h2", { text: "Connect YouTube to start discovering" }), node("p", { text: "Paste your own YouTube Data API key in Settings. The catalog stays limited to approved creators and videos." }), node("button", { className: "primary-button", onClick: function () { state.view = "settings"; render(); } }, "Open video settings"))); }
    else if (state.youtube.videos.length) section.appendChild(youtubeList(youtubeFilteredVideos()));
    else section.appendChild(node("div", { className: "video-empty" }, node("div", { className: "empty-orbit" }, svg("image", 24)), node("h2", { text: "Connect YouTube to start discovering" }), node("p", { text: "Paste your own YouTube Data API key in Settings. The catalog stays limited to approved creators and videos." }), node("button", { className: "primary-button", onClick: function () { state.view = "settings"; render(); } }, "Open video settings")));
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
    return searchScore(query, topic.label + " " + (topic.aliases || []).join(" ")) > 0 || Boolean(topic.children && topic.children.some(function (child) { return topicMatches(child, query); }));
  }
  function topicRow(topic, depth, query) {
    if (query && !topicMatches(topic, query)) return null;
    const hasChildren = Boolean(topic.children && topic.children.length);
    const selection = selectionState(topic);
    const searchExpanded = Boolean(query && topic.children && topic.children.some(function (child) { return topicMatches(child, query); }));
    const childrenVisible = hasChildren && (topic.expanded || (searchExpanded && !topicSearchExpansionSuppressed));
    const branchWrap = node("div", { className: "topic-branch" });
    const row = node("div", { className: "topic-row" + (depth === 0 ? " root-row" : "") + (!hasChildren ? " leaf-row" : "") + (topic.custom ? " custom-row" : "") + " selection-" + selection, dataset: { topicId: topic.id }, onClick: function (event) { if (event.target.closest && event.target.closest("button")) return; toggleTopicSelection(topic.id); saveState(); render(); } });
    row.style.paddingLeft = Math.min(depth, 5) * 20 + 4 + "px";
    row.appendChild(node("button", { className: "topic-expand", disabled: !hasChildren, ariaLabel: (childrenVisible ? "Hide" : "Show") + " subtopics for " + topic.label, ariaExpanded: hasChildren ? childrenVisible : undefined, dataset: { topicId: topic.id }, onClick: function () { if (!hasChildren) return; topic.expanded = !topic.expanded; saveState(); render(); } }, hasChildren ? svg(childrenVisible ? "chevronDown" : "chevronRight", 15) : null));
    row.appendChild(node("button", { className: "topic-check" + (selection === "selected" ? " checked" : "") + (selection === "mixed" ? " mixed" : ""), ariaLabel: (selection === "selected" ? "Deselect " : "Select ") + topic.label, ariaPressed: selection === "selected", dataset: { topicId: topic.id }, onClick: function () { toggleTopicSelection(topic.id); saveState(); render(); } }, selection === "selected" ? svg("check", 14) : selection === "mixed" ? node("span", { className: "topic-check-dash" }) : null));
    const nameWrap = node("div", { className: "topic-name-wrap" + (selection === "none" ? " unselected" : "") });
    nameWrap.appendChild(node("span", { className: "topic-name" + (selection === "selected" ? " selected" : ""), text: topic.label }));
    if (hasChildren) nameWrap.appendChild(node("button", { className: "topic-subtopics-toggle", ariaExpanded: childrenVisible, dataset: { topicId: topic.id }, onClick: function () { topic.expanded = !topic.expanded; saveState(); render(); } }, childrenVisible ? "Hide Subtopics" : "Show Subtopics"));
    row.appendChild(nameWrap);
    if (topic.custom) {
      const customActions = node("span", { className: "custom-topic-actions" });
      customActions.appendChild(node("span", { className: "custom-mark", text: "Custom" }));
      customActions.appendChild(node("button", { className: "topic-remove", ariaLabel: "Delete custom topic " + topic.label, title: "Delete custom topic", onClick: function () { removeCustomTopic(topic.id); } }, svg("trash", 13)));
      row.appendChild(customActions);
    }
    const weight = node("div", { className: "topic-weight" + (selection === "none" ? " disabled" : "") });
    weight.appendChild(node("button", { disabled: selection === "none", ariaLabel: "Lower " + topic.label + " weight", dataset: { topicId: topic.id }, onClick: function () { topic.weight = Math.max(5, topic.weight - 5); saveState(); render(); } }, svg("minus", 12)));
    weight.appendChild(node("span", { className: "topic-weight-value", text: topic.weight }));
    weight.appendChild(node("button", { disabled: selection === "none", ariaLabel: "Raise " + topic.label + " weight", dataset: { topicId: topic.id }, onClick: function () { topic.weight = Math.min(100, topic.weight + 5); saveState(); render(); } }, svg("plus", 12)));
    row.appendChild(weight);
    branchWrap.appendChild(row);
    if (childrenVisible) {
      const children = node("div", { className: "topic-children" });
      children.style.setProperty("--guide-left", Math.min(depth + 1, 5) * 20 + 28 + "px");
      topic.children.forEach(function (child) { const childRow = topicRow(child, depth + 1, query); if (childRow) children.appendChild(childRow); });
      branchWrap.appendChild(children);
    }
    return branchWrap;
  }
  function topicTree() {
    const picker = node("div", { className: "topic-tree-picker" });
    const actions = node("div", { className: "topic-tree-actions" });
    actions.appendChild(node("button", { className: "topic-tree-collapse-button", ariaLabel: "Collapse all topic branches", onClick: function () { topicSearchExpansionSuppressed = true; state.topics = collapseTopicBranches(state.topics); saveState(); render(); } }, "Collapse all"));
    picker.appendChild(actions);
    const tree = node("div", { className: "topic-tree", role: "tree", ariaLabel: "Topic browser" });
    const query = state.topicQuery.trim();
    state.topics.forEach(function (topic) { const row = topicRow(topic, 0, query); if (row) tree.appendChild(row); });
    picker.appendChild(tree);
    return picker;
  }
  function collapseTopicBranches(topics) {
    return topics.map(function (topic) {
      const collapsed = Object.assign({}, topic, { expanded: false });
      if (topic.children) collapsed.children = collapseTopicBranches(topic.children);
      return collapsed;
    });
  }
  function cancelWorkspaceOperations() {
    generationToken += 1;
    state.connectionToken += 1;
    state.generationRequestToken += 1;
    youtubeSearchToken += 1;
    state.loading = false;
    state.loadingCard = null;
    state.youtubeSmartLoading = false;
    cloudSyncToken += 1;
    cloudSaveQueued = false;
    if (cloudSaveTimer) { window.clearTimeout(cloudSaveTimer); cloudSaveTimer = null; }
    if (stopYoutubePlayback) stopYoutubePlayback();
    bridge("cancelAll", {}).catch(function () {});
  }
  function applyWorkspaceSnapshot(record) {
    const snapshot = record.state || record;
    state.workspaceId = record.id || "local-workspace";
    state.workspaceName = record.name || "Local Workspace";
    const catalogVersion = Number(snapshot.catalogVersion || snapshot.topicCatalogVersion || 0);
    state.topics = migrateTopics(snapshot.topics || makeTopics(), catalogVersion < 11, catalogVersion < 11);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, snapshot.settings || {}, { sentenceLength: normalizeSentenceLength(snapshot.settings && snapshot.settings.sentenceLength) });
    state.cards = (snapshot.cards || []).filter(function (card) { return !KNOWN_DEMO_IDS.has(card.id); }).map(normalizeCard).filter(function (card) { return card.id && card.title && card.body && card.topicPath && card.topicPath.length && card.sources && card.sources.length; });
    state.profile = snapshot.profile || snapshot.learningProfile || {};
    state.started = Boolean((snapshot.started ?? snapshot.feedStarted) && state.cards.length);
    applyYoutubeActivity(snapshot.youtubeActivity || snapshot.youtube);
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
  function naturalSearchVariants(query) {
    const normalized = searchText(query);
    const groups = [
      ["politician", "politics", "government", "congress", "legislation", "lawmakers"],
      ["behind the scenes", "inner workings", "process", "tactics", "strategy"],
      ["movie", "film", "cinema"],
      ["tv", "television", "show", "series"],
      ["music", "songs", "singers", "artists"],
      ["sport", "sports", "athletics", "league", "players"],
      ["science", "scientist", "research", "experiment"]
    ];
    return groups.filter(function (group) { return group.some(function (term) { return normalized.indexOf(term) >= 0 || term.indexOf(normalized) >= 0; }); }).flatMap(function (group) { return group; });
  }
  function globalSearchEntries() {
    const topics = flatTopics().map(function (topic) { return { kind: "topic", id: topic.id, label: topic.path.join(" → "), topic: topic, text: topic.path.join(" ") + " " + topic.label + " " + (topic.aliases || []).join(" ") }; });
    const facts = state.cards.map(function (card) { return { kind: "fact", id: card.id, label: card.title, card: card, text: [card.hook, card.title, card.body, (card.topicPath || []).join(" "), (card.sources || []).map(function (source) { return source.title; }).join(" ")].join(" ") }; });
    return topics.concat(facts);
  }
  function globalSearchResults(query) {
    const text = String(query || "").trim();
    if (!text) return [];
    const entries = globalSearchEntries();
    const direct = entries.map(function (entry, index) { return { entry: entry, index: index, score: searchScore(text, entry.text) }; }).filter(function (item) { return item.score > 0; }).sort(function (left, right) { return right.score - left.score || left.index - right.index; }).slice(0, 10);
    const directIDs = new Set(direct.map(function (item) { return item.entry.kind + ":" + item.entry.id; }));
    const variants = [text].concat(state.semanticSearchTerms || [], naturalSearchVariants(text));
    const related = entries.map(function (entry, index) { return { entry: entry, index: index, score: Math.max.apply(Math, variants.map(function (variant) { return searchScore(variant, entry.text); })) }; }).filter(function (item) { return item.score > 0 && !directIDs.has(item.entry.kind + ":" + item.entry.id); }).sort(function (left, right) { return right.score - left.score || left.index - right.index; }).slice(0, 90);
    return direct.concat(related).map(function (item) { return item.entry; });
  }
  function renderGlobalSearchPopover(searchWrap) {
    const previous = searchWrap.querySelector(".search-popover");
    if (previous) previous.remove();
    const results = globalSearchResults(state.query);
    if (!results.length) return;
    const popover = node("div", { className: "search-popover" });
    const topics = results.filter(function (entry) { return entry.kind === "topic"; });
    const facts = results.filter(function (entry) { return entry.kind === "fact"; });
    function appendGroup(label, entries) {
      if (!entries.length) return;
      popover.appendChild(node("span", { className: "search-group-label", text: label }));
      entries.forEach(function (entry) {
        popover.appendChild(node("button", { type: "button", onClick: function () {
          if (entry.kind === "topic") {
            state.view = "feed";
            state.started = false;
            state.topicQuery = entry.topic.label;
            state.query = "";
          } else {
            state.view = "history";
            state.query = entry.card.title;
          }
          render();
        } }, node("span", { text: entry.label }), svg("arrow", 14)));
      });
    }
    appendGroup("Topics", topics);
    appendGroup("Facts", facts);
    searchWrap.appendChild(popover);
  }
  function requestSemanticSearch(query, searchWrap) {
    searchInterpretToken += 1;
    const token = searchInterpretToken;
    if (searchInterpretTimer) window.clearTimeout(searchInterpretTimer);
    state.semanticSearchTerms = [];
    if (!String(query || "").trim() || !state.key.trim() || state.geminiStatus !== "connected") return;
    searchInterpretTimer = window.setTimeout(function () {
      bridge("searchInterpret", { key: state.key, query: String(query).trim() }).then(function (result) {
        if (token !== searchInterpretToken) return;
        state.semanticSearchTerms = Array.from(new Set((result.terms || []).filter(function (term) { return typeof term === "string" && term.trim(); }).map(function (term) { return term.trim(); }))).slice(0, 24);
        renderGlobalSearchPopover(searchWrap);
      }).catch(function () {
        if (token === searchInterpretToken) renderGlobalSearchPopover(searchWrap);
      });
    }, 280);
  }
  function installPopoverDismiss() {
    if (window.__learnedMediaPopoverDismiss) return;
    window.__learnedMediaPopoverDismiss = true;
    document.addEventListener("pointerdown", function (event) {
      const target = event.target;
      if (target && target.closest && (target.closest(".workspace-switcher") || target.closest(".global-search-wrap"))) return;
      clearWorkspaceRename();
      document.querySelectorAll(".workspace-menu, .search-popover").forEach(function (popover) { popover.remove(); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (state.confirmation) {
        closeConfirmation();
        return;
      }
      document.querySelectorAll(".workspace-menu, .search-popover").forEach(function (popover) { popover.remove(); });
      clearWorkspaceRename();
      const active = document.activeElement;
      if (active && active.matches && active.matches(".workspace-rename-form input") && active.blur) active.blur();
    });
  }
  function navigation() {
    installPopoverDismiss();
    const items = [["feed", "Feed", "home"], ["videos", "Videos", "image"], ["saved", "Saved", "bookmark"], ["likes", "Likes", "heart"], ["history", "History", "history"], ["settings", "Settings", "settings"]];
    const header = node("header", { className: "top-navigation" });
    header.appendChild(node("button", { className: "nav-brand", ariaLabel: "Learned Media home", onClick: function () { state.view = "feed"; render(); } }, node("span", { className: "brand-mark", text: "LM" }), node("span", { className: "brand-wordmark" }, node("strong", { text: "Learned Media" }))));
    const links = node("nav", { className: "top-nav-links", ariaLabel: "Primary navigation" });
    items.forEach(function (item) { links.appendChild(node("button", { className: "top-nav-link" + (state.view === item[0] ? " active" : ""), onClick: function () { state.view = item[0]; render(); } }, svg(item[2], 16), node("span", { text: item[1] }))); });
    header.appendChild(links);
    const searchWrap = node("div", { className: "top-nav-search" });
    const search = node("div", { className: "global-search-wrap" });
    search.appendChild(svg("search", 17));
    search.appendChild(node("input", { id: "global-search", value: state.query, placeholder: "Search topics or facts", ariaLabel: "Search topics or facts", onFocus: function () { const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); } renderGlobalSearchPopover(search); }, onInput: function (event) { state.query = event.target.value; const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); } document.querySelectorAll(".fact-card").forEach(function (card) { card.style.display = !state.query || searchScore(state.query, card.textContent) ? "" : "none"; }); renderGlobalSearchPopover(search); requestSemanticSearch(state.query, search); } }));
    searchWrap.appendChild(search);
    header.appendChild(searchWrap);
    const accountName = state.workspaceName;
    const account = node("div", { className: "top-nav-account" });
    if (state.cards.length || state.loading) account.appendChild(node("button", { className: "nav-reset", onClick: resetFeed }, svg("reset", 15), " Reset feed"));
    const switcher = node("div", { className: "workspace-switcher" });
    const profile = node("button", { className: "profile-chip", ariaExpanded: false, onClick: function () { const searchPopover = search.querySelector(".search-popover"); if (searchPopover) searchPopover.remove(); const menu = switcher.querySelector(".workspace-menu"); if (menu) { clearWorkspaceRename(); menu.remove(); } else switcher.appendChild(workspaceMenu()); } }, node("span", { className: "profile-avatar" }, svg("panel", 16)), node("span", { className: "profile-copy" }, node("strong", { text: accountName }), node("small", { text: state.workspaces.length + " " + (state.workspaces.length === 1 ? "workspace" : "workspaces") })), svg("chevronDown", 15));
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
    difficulty.appendChild(node("input", { id: setup ? "setup-difficulty" : "feed-difficulty", type: "range", min: "1", max: "10", step: "1", value: state.settings.obscurity, onInput: function (event) { const next = Number(event.target.value); state.settings.obscurity = next; Object.keys(state.profile).forEach(function (key) { state.profile[key].unknownStreak = 0; state.profile[key].targetDifficulty = next; }); saveState(); render(); } }));
    difficulty.appendChild(node("span", { className: "range-ends" }, node("span", { text: "A Little Hard" }), node("span", { text: "Impossible" })));
    details.appendChild(difficulty);
    details.appendChild(node("div", { className: "topic-list-search" }, svg("search", 14), node("input", { value: state.topicQuery, placeholder: "Search topics", ariaLabel: "Search topics", onInput: function (event) { state.topicQuery = event.target.value; topicSearchExpansionSuppressed = false; render(); } })));
    details.appendChild(topicTree());
    details.appendChild(customTopicForm(setup ? "custom-topic-form" : "feed-custom-topic"));
    details.appendChild(feedCustomize(setup));
    aside.appendChild(details);
    return aside;
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
    display.appendChild(node("button", { className: state.settings.displayMode === "picture-text" ? "selected" : "", onClick: function () { state.settings.displayMode = "picture-text"; saveState(); render(); } }, "Image + text"));
    display.appendChild(node("button", { className: state.settings.displayMode === "text" ? "selected" : "", onClick: function () { state.settings.displayMode = "text"; saveState(); render(); } }, "Text only"));
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
    if (state.settings.displayMode === "text") return null;
    const image = card.image && card.image.url;
    const wrap = node("div", { className: "fact-image " + (image ? "has-image" : "no-image") });
    if (image) {
      const picture = node("img", { src: image, alt: card.image.alt || card.title });
      picture.addEventListener("error", function () { wrap.classList.remove("has-image"); wrap.classList.add("no-image"); picture.remove(); wrap.insertBefore(node("div", { className: "image-unavailable" }, svg("image", 25), node("span", { text: "Image unavailable" })), wrap.firstChild); });
      wrap.appendChild(picture);
      wrap.appendChild(node("span", { className: "fact-image-label", text: (card.topicPath || ["Wikipedia"])[0] }));
      if (card.image.filePageUrl || card.image.sourceUrl) wrap.appendChild(externalLink(card.image.filePageUrl || card.image.sourceUrl, "Wikipedia image", "image-credit"));
    } else {
      wrap.appendChild(node("div", { className: "image-unavailable" }, svg("image", 25), node("span", { text: "Image unavailable" })));
    }
    return wrap;
  }
  function questionArea(card) {
    const box = node("div", { className: "question-box" });
    const row = node("div", { className: "question-row" });
    const input = node("input", { value: card.question || "", placeholder: "Ask a question about this fact", ariaLabel: "Ask a question about this fact", dataset: { cardId: card.id }, onInput: function (event) { card.question = event.target.value; } });
    row.appendChild(input);
    row.appendChild(node("button", { className: "details-toggle" + (card.answerDetailed ? " selected" : ""), onClick: function () { card.answerDetailed = !card.answerDetailed; render(); } }, "More Details"));
    row.appendChild(node("button", { className: "question-send", ariaLabel: "Send question", onClick: function () { askQuestion(card.id, input.value); } }, svg("arrow", 16)));
    box.appendChild(row);
    if (card.answer) box.appendChild(node("div", { className: "learning-answer question-answer" }, node("span", { className: "answer-label" }, svg("message", 14), " ", card.answerDetailed ? "Detailed answer" : "Answer"), node("p", { text: card.answer }), sourceList(card, true)));
    if (state.loadingCard === card.id) box.appendChild(node("div", { className: "learning-loading" }, node("span", { className: "loading-dot" }), " Gemini is reading the cited Wikipedia pages"));
    return box;
  }
  function cardElement(card) {
    const article = node("article", { className: "fact-card accent-" + (card.accent || "blue") + (card.feedback ? " feedback-" + card.feedback : "") });
    const image = imageBlock(card);
    if (image) article.appendChild(image);
    const content = node("div", { className: "fact-content" });
    const meta = node("div", { className: "fact-meta" });
    const crumbs = node("div", { className: "fact-breadcrumbs" });
    (card.topicPath || []).forEach(function (topic) { crumbs.appendChild(node("span", { text: topic })); });
    meta.appendChild(crumbs);
    meta.appendChild(node("span", { className: "difficulty-mark", text: "Difficulty " + (card.difficulty || 5) + " · " + difficultyLabel(card.difficulty || 5) }));
    content.appendChild(meta);
    content.appendChild(node("p", { className: "fact-hook", text: card.hook }));
    content.appendChild(node("h3", { text: card.title }));
    content.appendChild(node("p", { className: "fact-body", text: card.body }));
    content.appendChild(sourceList(card, false));
    if (card.learnMore) content.appendChild(node("div", { className: "learning-answer learn-more-answer" }, node("span", { className: "answer-label" }, svg("sparkles", 14), " Learn more"), node("p", { text: card.learnMore })));
    if (state.errorByCard[card.id]) content.appendChild(node("p", { className: "learning-error", text: state.errorByCard[card.id] }));
    content.appendChild(questionArea(card));
    article.appendChild(content);
    const actions = node("div", { className: "fact-actions" });
    actions.appendChild(node("button", { className: "learn-more-button", disabled: Boolean(card.learnMore || state.loadingCard === card.id), onClick: function () { learnMore(card.id); } }, svg("sparkles", 16), node("span", { text: state.loadingCard === card.id ? "Reading" : card.learnMore ? "Learned" : "Learn more" })));
    actions.appendChild(node("button", { className: "feedback-button heard" + (card.feedback === "heard" ? " selected" : ""), onClick: function () { recordFeedback(card.id, "heard"); } }, svg("check", 15), node("span", { text: "Heard" })));
    actions.appendChild(node("button", { className: "feedback-button unknown" + (card.feedback === "unknown" ? " selected" : ""), onClick: function () { recordFeedback(card.id, "unknown"); } }, svg("help", 15), node("span", { text: "Unknown" })));
    actions.appendChild(node("button", { className: card.liked ? "active-like" : "", onClick: function () { toggleCard(card.id, "liked"); } }, svg("heart", 16), node("span", { text: "Like" })));
    actions.appendChild(node("button", { className: card.saved ? "active-save" : "", onClick: function () { toggleCard(card.id, "saved"); } }, svg("bookmark", 16), node("span", { text: "Save" })));
    actions.appendChild(node("button", { className: "overflow-action", ariaLabel: "More actions", onClick: function () { showToast("More like this will shape a future batch."); } }, svg("more", 17)));
    article.appendChild(actions);
    return article;
  }
  function feedView() {
    const layout = node("div", { className: "feed-layout" });
    layout.appendChild(topicPanel(false));
    const column = node("section", { className: "feed-content-column" });
    column.appendChild(node("div", { className: "feed-toolbar" }, node("div", { className: "active-topics" }, node("span", { className: "toolbar-label", text: "Your feed" }), node("span", { className: "topic-chip selected-chip", text: selectedTopics().map(function (topic) { return topic.path.join(" / "); }).join(" · ") || "Your selected topics" }))));
    const feedCards = state.cards;
    column.appendChild(node("div", { className: "feed-intro" }, node("div", {}, node("h1", { text: "Keep going." }), node("p", { text: "One small idea at a time. Every card has a place to look next." })), node("span", { className: "feed-count", text: feedCards.length + " cards in this session" })));
    const list = node("div", { className: "fact-feed" });
    feedCards.forEach(function (card, index) {
      if (state.query && !(card.title + " " + card.body).toLowerCase().includes(state.query)) return;
      if (!state.loading && !state.generationError && index === Math.max(feedCards.length - 3, 0)) list.appendChild(node("div", { className: "feed-load-more-nearby" }, node("button", { type: "button", className: "small-load-button", disabled: state.loading, onClick: function (event) { event.preventDefault(); generateBatch(generationToken, 10); } }, "Generate 10 more")));
      list.appendChild(cardElement(card));
    });
    if (state.loading) list.appendChild(node("div", { className: "feed-progress", role: "status" }, node("span", { className: "loading-dot" }), " Gemini is building the next facts"));
    if (!state.loading && !state.generationError && state.started) list.appendChild(node("div", { className: "feed-bottom-actions" }, node("button", { type: "button", className: "small-load-button", disabled: state.loading, onClick: function (event) { event.preventDefault(); generateBatch(generationToken, 10); } }, "Generate 10 more")));
    column.appendChild(list);
    layout.appendChild(column);
    if (state.generationError && !state.loading) {
      list.appendChild(node("div", { className: "feed-error", role: "alert" }, svg("help", 17), node("div", {}, node("strong", { text: "Generation paused" }), node("span", { text: state.generationError })), node("button", { type: "button", className: "secondary-button", disabled: state.loading, onClick: function (event) { event.preventDefault(); state.generationError = ""; generateBatch(generationToken, state.pendingSlots); } }, "Retry missing facts")));
    }
    return node("div", { className: "feed-workspace" }, state.toast ? node("div", { className: "feed-toast" }, svg("check", 15), " ", state.toast) : null, layout);
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
    keyRow.appendChild(node("input", { id: "gemini-key", type: "password", value: state.key, placeholder: "Paste your API key here", autocomplete: "new-password", onInput: function (event) { state.keyEditEpoch += 1; state.key = event.target.value; state.geminiStatus = "not-configured"; state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; }); state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); bridge("setGeminiKey", { key: state.key }).catch(function () {}); }, onKeydown: function (event) { if (event.key === "Enter") testKey(); } }));
    const keyActions = node("div", { className: "key-actions" });
    keyActions.appendChild(node("button", { className: "primary-button small", disabled: state.geminiStatus === "testing", onClick: testKey }, svg("sparkles", 15), state.geminiStatus === "testing" ? " Connecting" : " Connect Gemini"));
    keyActions.appendChild(node("button", { className: "ghost-button", onClick: function () { state.key = ""; state.geminiStatus = "not-configured"; state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; }); state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); bridge("setGeminiKey", { key: "" }).catch(function () {}); showToast("Remembered key removed."); } }, "Remove"));
    keyRow.appendChild(keyActions);
    gemini.appendChild(keyRow);
    gemini.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your key is remembered in this Mac’s Keychain, separate from workspaces, and sent only when Gemini is requested." })));
    if (state.toast) gemini.appendChild(node("p", { className: "settings-feedback", text: state.toast }));
    const workingModels = {};
    const checkedModels = state.modelChecks.filter(function (model) { return model.status !== "unchecked"; });
    state.modelChecks.forEach(function (model) { if (model.status === "working") workingModels[model.resolvedModel || model.model] = true; });
    const modelHeading = node("div", { className: "model-check-heading" }, node("div", {}, node("strong", { text: "Available Gemini models" }), node("span", { text: checkedModels.length ? Object.keys(workingModels).length + " ready of " + checkedModels.length + " checked" : state.modelChecks.length ? "Not checked yet" : "Connect to check available models" })));
    modelHeading.appendChild(node("button", { className: "ghost-button", disabled: state.modelChecking || !state.key.trim(), onClick: testKey }, state.modelChecking ? "Checking" : "Check connection"));
    gemini.appendChild(modelHeading);
    if (state.modelChecks.length) {
      const modelList = node("div", { className: "model-check-list", ariaLive: "polite" });
      state.modelChecks.forEach(function (model) { modelList.appendChild(node("div", { className: "model-check-row" }, node("span", { className: "model-status-dot " + model.status, ariaLabel: model.status }), node("div", {}, node("strong", { text: model.model }), node("small", { text: model.status === "unchecked" ? "Not checked" : model.status === "working" ? (model.resolvedModel && model.resolvedModel !== model.model ? "Ready · resolves to " + model.resolvedModel : "Ready for generation") : model.error || "Unavailable" })), node("span", { className: "model-check-meta", text: (model.latencyMs ? model.latencyMs + " ms" : "—") + "\n" + (model.checkedAt ? new Date(model.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked") }))); });
      gemini.appendChild(modelList);
    }
    gemini.appendChild(node("div", { className: "api-key-guide" }, node("div", { className: "api-key-guide-icon" }, svg("sparkles", 16)), node("div", { className: "api-key-guide-copy" }, node("strong", { text: "Need a key?" }), node("p", { text: "Create or copy one in Google AI Studio, then paste it here." })), externalLink(AI_STUDIO_URL, "Open AI Studio", "api-key-link")));
    main.appendChild(gemini);
    const youtube = node("section", { className: "settings-card youtube-settings-card" });
    youtube.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon blue" }, svg("image", 19)), node("div", {}, node("h2", { text: "YouTube Videos" }), node("p", { text: "Use your own YouTube Data API key for the approved video library." })), node("span", { className: "status-dot " + (state.youtubeStatus === "connected" || state.youtubeStatus === "refreshing" ? "connected" : state.youtubeStatus === "error" ? "unavailable" : ""), text: state.youtubeStatus === "connecting" ? "Connecting" : state.youtubeStatus === "refreshing" ? "Refreshing" : state.youtubeStatus === "connected" ? "Connected" : state.youtubeStatus === "error" ? "Needs attention" : "Not configured" })));
    youtube.appendChild(node("label", { className: "field-label", text: "Paste your YouTube API key here" }));
    const youtubeRow = node("div", { className: "key-input-row" });
    youtubeRow.appendChild(node("input", { id: "youtube-key", type: "password", value: state.youtubeKey, placeholder: "Paste your YouTube API key here", autocomplete: "new-password", onInput: function (event) { state.keyEditEpoch += 1; state.youtubeKey = event.target.value; bridge("setYouTubeKey", { key: state.youtubeKey }).catch(function (error) { showToast(error.message); }); state.youtubeStatus = "not-configured"; state.youtubeError = ""; state.connectionToken += 1; state.youtubeProgress = { phase: "idle", completedChannels: 0, totalChannels: window.LEARNED_MEDIA_YOUTUBE.CHANNELS.length, importedVideos: 0, completedSources: 0, totalSources: 0 }; bridge("cancelAll", {}).catch(function () {}); render(); }, onKeydown: function (event) { if (event.key === "Enter") youtubeConnect(); } }));
    const youtubeActions = node("div", { className: "key-actions" });
    youtubeActions.appendChild(node("button", { className: "primary-button small", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: youtubeConnect }, state.youtubeStatus === "connecting" ? " Connecting" : state.youtubeStatus === "refreshing" ? " Refreshing" : " Connect YouTube"));
    youtubeActions.appendChild(node("button", { className: "ghost-button", disabled: state.youtubeStatus === "connecting" || state.youtubeStatus === "refreshing", onClick: function () { youtubeConnect(true); } }, "Refresh videos"));
    youtubeActions.appendChild(node("button", { className: "ghost-button", onClick: function () { state.keyEditEpoch += 1; state.youtubeKey = ""; bridge("setYouTubeKey", { key: "" }).catch(function (error) { showToast(error.message); }); state.youtubeStatus = "not-configured"; state.youtubeError = ""; state.connectionToken += 1; bridge("cancelAll", {}).catch(function () {}); showToast("Remembered YouTube key removed."); } }, "Remove key"));
    youtubeRow.appendChild(youtubeActions); youtube.appendChild(youtubeRow);
    youtube.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your YouTube key is remembered in this Mac’s Keychain, separate from workspaces, and never synced to your account." })));
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
    const exportSelect = node("select", { id: "native-export-collection" });
    exportSelect.appendChild(node("option", { value: "all", text: "Everything in this workspace (" + state.cards.length + ")" }));
    exportSelect.appendChild(node("option", { value: "saved", text: "Saved Facts (" + state.cards.filter(function (card) { return card.saved; }).length + ")" }));
    exportRow.appendChild(exportSelect);
    const exportButtons = node("div", { className: "export-buttons" });
    ["pdf", "txt", "docx"].forEach(function (format) { exportButtons.appendChild(node("button", { className: "secondary-button", disabled: !state.cards.length, onClick: function () { exportFactsNative(format, exportSelect.value); } }, format.toUpperCase())); });
    exportRow.appendChild(exportButtons); exports.appendChild(exportRow); exports.appendChild(node("p", { className: "export-size-note", text: "Everything includes all facts and sources; embedded images are compressed or omitted when needed to keep the download manageable." })); main.appendChild(exports);
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
    main.appendChild(appearance);
    grid.appendChild(main);
    const side = node("aside", { className: "settings-side" });
    const danger = node("section", { className: "danger-card" }, node("span", { className: "eyebrow", text: "Advanced" }), node("h2", { text: "Clear the slate." }), node("p", { text: "Feed reset is gentle. These controls affect the rest of your saved workspace." }));
    danger.appendChild(node("button", { className: "ghost-button full", onClick: resetAll }, svg("reset", 15), " Reset all preferences"));
    danger.appendChild(node("button", { className: "danger-button full", onClick: deleteData }, svg("reset", 15), " Delete learning data"));
    side.appendChild(danger);
    side.appendChild(node("section", { className: "settings-help mobile-use-help" }, svg("smartphone", 17), node("div", {}, node("strong", { text: "Use Learned Media on mobile" }), node("p", { text: "Open the site in Safari or Chrome on your iPhone. In Safari, tap Share → Add to Home Screen to keep it beside your other apps. The layout adapts to narrow screens without horizontal scrolling." }))));
    side.appendChild(node("section", { className: "settings-help" }, svg("help", 17), node("div", {}, node("strong", { text: "Privacy by default" }), node("p", { text: "Gemini and YouTube credentials stay in this Mac’s Keychain. When you sign in, workspace cards and learning history sync; credentials and the YouTube catalog never leave this Mac." }))));
    grid.appendChild(side);
    section.appendChild(grid);
    return section;
  }
  function collectionView(kind) {
    const cards = kind === "saved" ? state.cards.filter(function (card) { return card.saved; }) : kind === "likes" ? state.cards.filter(function (card) { return card.liked; }) : state.cards;
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    const section = node("section", { className: "content-view" });
    section.appendChild(node("div", { className: "view-heading" }, node("div", {}, node("span", { className: "eyebrow", text: label }), node("h1", { text: "Your " + label.toLowerCase() + " discoveries." }), node("p", { text: "Keep the ideas that made you pause." }))));
    if (cards.length) {
      const feed = node("div", { className: "collection-feed" });
      cards.forEach(function (card) { feed.appendChild(cardElement(card)); });
      section.appendChild(feed);
    } else {
      section.appendChild(node("div", { className: "empty-collection" }, node("div", { className: "empty-orbit" }, svg(kind === "saved" ? "bookmark" : kind === "likes" ? "heart" : "history", 25)), node("h2", { text: "Nothing here yet." }), node("p", { text: "As you explore, your " + label.toLowerCase() + " facts will appear here." })));
    }
    return section;
  }
  function exportFactsNative(format, collection) {
    const facts = (collection === "saved" ? state.cards.filter(function (card) { return card.saved; }) : state.cards).map(function (card) { return { id: card.id, hook: card.hook, title: card.title, body: card.body, topicPath: card.topicPath, sources: card.sources, image: card.image || null }; });
    if (!facts.length) return showToast("There are no facts in that collection yet.");
    bridge("exportFacts", { format: format, workspaceName: state.workspaceName, facts: facts }).then(function (result) { if (result && result.omittedImages) showToast("Export complete. Images were omitted for " + result.omittedImages + " fact" + (result.omittedImages === 1 ? "" : "s") + " to keep the download manageable; all text and sources were kept."); else showToast("Export complete."); }).catch(function (error) { showToast(error.message || "The facts could not be exported."); });
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
    if (stopYoutubePlayback) stopYoutubePlayback();
    const currentTopicTree = document.querySelector(".topic-tree");
    if (currentTopicTree) topicTreeScrollTop = currentTopicTree.scrollTop;
    const currentMainScroll = document.querySelector(".main-scroll");
    if (currentMainScroll) mainScrollTop = currentMainScroll.scrollTop;
    const activeElement = document.activeElement;
    if (activeElement && activeElement.dataset && activeElement.dataset.topicId) focusedTopicId = activeElement.dataset.topicId;
    focusedFieldId = activeElement && (activeElement.id === "gemini-key" || activeElement.id === "youtube-key") ? activeElement.id : null;
    focusedSelection = focusedFieldId && typeof activeElement.selectionStart === "number" ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    focusedQuestionCardId = activeElement && activeElement.dataset ? activeElement.dataset.cardId || null : null;
    focusedQuestionSelection = focusedQuestionCardId && typeof activeElement.selectionStart === "number" ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    document.body.classList.add("native-shell");
    app.replaceChildren();
    app.appendChild(navigation());
    const main = node("main", { className: "main-column" });
    const scroll = node("div", { className: "main-scroll" });
    scroll.appendChild(state.view === "settings" ? settingsView() : state.view === "videos" ? videosView() : state.view === "feed" && !state.started ? setupView() : state.view === "feed" ? feedView() : collectionView(state.view));
    scroll.appendChild(node("button", { type: "button", className: "go-to-top", onClick: function () { window.scrollTo({ top: 0, behavior: "smooth" }); const target = document.querySelector(".main-scroll"); if (target) target.scrollTo({ top: 0, behavior: "smooth" }); } }, "Go to top"));
    main.appendChild(scroll);
    app.appendChild(main);
    const confirmation = confirmationOverlay();
    if (confirmation) app.appendChild(confirmation);
    window.requestAnimationFrame(function () {
      const nextTopicTree = document.querySelector(".topic-tree");
      if (nextTopicTree) nextTopicTree.scrollTop = topicTreeScrollTop;
      const nextMainScroll = document.querySelector(".main-scroll");
      if (nextMainScroll) nextMainScroll.scrollTop = mainScrollTop;
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
        const questionField = document.querySelector('[data-card-id="' + CSS.escape(focusedQuestionCardId) + '"]');
        if (questionField) {
          questionField.focus();
          if (focusedQuestionSelection && typeof questionField.setSelectionRange === "function") questionField.setSelectionRange(focusedQuestionSelection[0], focusedQuestionSelection[1]);
        }
      }
    });
  }
  function statusLabel() {
    return { "not-configured": "Not configured", testing: "Testing", connected: "Connected", invalid: "Invalid key", "rate-limited": "Rate limited", unavailable: "Gemini unavailable" }[state.geminiStatus] || "Not configured";
  }
  async function hydrate() {
    try {
      const nativeSaved = await bridge("loadState", {});
      let localSaved = null;
      try { localSaved = window.localStorage.getItem(LOCAL_WORKSPACE_KEY); } catch (_) {}
      const candidates = [nativeSaved, localSaved].map(function (saved) {
        if (!saved) return null;
        try { return typeof saved === "string" ? JSON.parse(saved) : saved; } catch (_) { return null; }
      }).filter(Boolean);
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
      const epoch = state.keyEditEpoch;
      const keys = await bridge("loadKeys", {});
      if (epoch === state.keyEditEpoch) { state.key = keys.gemini || ""; state.youtubeKey = keys.youtube || ""; }
      const catalog = await bridge("loadVideoCatalog", {});
      if (catalog && catalog.videos) {
        const activity = youtubeActivity();
        state.youtube = Object.assign({}, state.youtube, catalog, { catalogVersion: 3, sourceStates: Object.assign({}, catalog.sourceStates || {}) });
        state.youtube.videos = window.LEARNED_MEDIA_YOUTUBE.filter(state.youtube.videos || [], "", "All");
        applyYoutubeActivity(activity);
        if (state.youtube.videos.length && !state.youtube.discoverIds.length) {
          state.youtube.discoverIds = window.LEARNED_MEDIA_YOUTUBE.shuffle(state.youtube.videos, 24, []).map(function (video) { return video.id; });
          saveState();
        }
      }
      if (state.youtubeKey.trim() && state.youtube.videos.length) state.youtubeStatus = "connected";
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
    const id = "custom-" + slug(label);
    if (!findTopic(id)) state.topics.push({ id: id, label: label, selected: true, expanded: false, weight: 10, custom: true });
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
  function startFeed() {
    if (!selectedCount()) return showToast("Choose at least one topic before starting.");
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.view = "settings"; return showToast("Add your Gemini API key in Settings and connect it before starting."); }
    const wasStarted = state.started;
    state.started = true;
    if (!wasStarted) state.cards = [];
    state.pendingSlots = 10;
    state.generationError = "";
    generationToken += 1;
    state.generationRequestToken += 1;
    saveState();
    render();
    generateBatch(generationToken, 10);
  }
  function resetFeed() {
    generationToken += 1;
    state.generationRequestToken += 1;
    bridge("cancelAll", {}).catch(function () {});
    state.started = false;
    state.cards = [];
    state.pendingSlots = 10;
    state.profile = {};
    state.loading = false;
    state.loadingCard = null;
    state.generationError = "";
    function clear(nodes) { nodes.forEach(function (topic) { topic.selected = false; if (topic.children) clear(topic.children); }); }
    clear(state.topics);
    saveState();
    render();
    showToast("Feed reset. Choose a topic and press Start again.");
    mainScrollTop = 0;
    window.requestAnimationFrame(function () { window.scrollTo({ top: 0, behavior: "smooth" }); const target = document.querySelector(".main-scroll"); if (target) target.scrollTo({ top: 0, behavior: "smooth" }); });
  }
  function resetTopics() {
    state.topics.forEach(function clear(topic) {
      topic.selected = false;
      if (topic.children) topic.children.forEach(clear);
    });
    state.pendingSlots = 10;
    state.generationError = "";
    saveState();
    render();
    showToast("Topics reset. Choose a topic to start again.");
  }
  function performResetAll() {
    generationToken += 1;
    state.generationRequestToken += 1;
    bridge("cancelAll", {}).catch(function () {});
    state.topics = makeTopics();
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
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
    generationToken += 1;
    state.generationRequestToken += 1;
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
  async function generateBatch(token, requestedCount) {
    if (state.loading || !selectedCount()) return;
    const activeToken = token || generationToken;
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.generationError = "Connect Gemini in Settings before generating facts."; state.loading = false; render(); return; }
    state.loading = true;
    state.generationError = "";
    const count = Math.max(1, Math.min(10, Number(requestedCount) || 10));
    const generationSentenceLength = normalizeSentenceLength(state.settings.sentenceLength);
    state.activeGenerationSentenceLength = generationSentenceLength;
    state.batchAccepted = 0;
    render();
    try {
      const generationSettings = Object.assign({}, state.settings, { sentenceLength: generationSentenceLength });
      const result = await bridge("generate", { topics: weightedTopicPaths(count), requestedCount: count, settings: generationSettings, avoid: state.factMemory || [], token: state.generationRequestToken });
      if (activeToken !== generationToken) return;
      mergeGeminiModelOutcomes(result.modelOutcomes);
      (result.cards || []).forEach(function (card) { acceptNewFact(card, generationSentenceLength); });
      const completed = state.batchAccepted;
      state.pendingSlots = Math.max(0, count - completed);
      if (state.pendingSlots) { state.generationError = completed + " of " + count + " new facts completed. Unsupported or repeated facts were skipped. Retry to fill the missing slots."; }
      else state.pendingSlots = 10;
    } catch (error) {
      if (activeToken !== generationToken) return;
      state.pendingSlots = Math.max(1, count - state.batchAccepted);
      state.generationError = error.message || "Could not generate a new batch.";
      showToast(state.generationError);
    } finally {
      if (activeToken === generationToken) {
        state.loading = false;
        saveState();
        render();
      }
    }
  }
  function mergeGeminiModelOutcomes(outcomes) {
    (outcomes || []).forEach(function (outcome) {
      if (!outcome || !outcome.model) return;
      const previous = state.modelChecks.find(function (model) { return model.model === outcome.model; });
      const nextCheck = { model: outcome.model, status: outcome.status === "success" ? "working" : outcome.status, latencyMs: outcome.latencyMs, checkedAt: new Date().toISOString() };
      if (outcome.resolvedModel || previous && previous.resolvedModel) nextCheck.resolvedModel = outcome.resolvedModel || previous.resolvedModel;
      if (outcome.error) nextCheck.error = outcome.error;
      state.modelChecks = state.modelChecks.filter(function (model) { return model.model !== outcome.model; });
      state.modelChecks.push(nextCheck);
    });
    state.modelChecks.sort(function (left, right) { return ALLOWED_GEMINI_MODELS.indexOf(left.model) - ALLOWED_GEMINI_MODELS.indexOf(right.model); });
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
      if (state.key.trim() !== keyAtStart) return;
      state.geminiStatus = result.status || "unavailable";
      state.modelChecks = result.models || [];
      showToast(result.message || "Gemini could not verify this key.");
    } catch (error) {
      if (state.key.trim() !== keyAtStart) return;
      state.geminiStatus = "unavailable";
      state.modelChecks = ALLOWED_GEMINI_MODELS.map(function (model) { return { model: model, status: "unchecked" }; });
      showToast(error.message);
    }
    if (state.key.trim() === keyAtStart) {
      state.modelChecking = false;
      render();
    }
  }
  async function learnMore(id) {
    const card = state.cards.find(function (item) { return item.id === id; });
    if (!card || card.learnMore || state.loadingCard) return;
    const activeToken = generationToken;
    state.loadingCard = id;
    state.errorByCard[id] = "";
    render();
    try {
      const result = await bridge("learn", { action: "learn", card: card });
      if (activeToken === generationToken) {
        card.learnMore = result.answer;
        card.answerSources = result.citations || [];
      }
    } catch (error) {
      state.errorByCard[id] = error.message;
    }
    state.loadingCard = null;
    saveState();
    render();
  }
  async function askQuestion(id, value) {
    const card = state.cards.find(function (item) { return item.id === id; });
    const question = String(value || "").trim();
    if (!card || !question || state.loadingCard) return;
    const activeToken = generationToken;
    state.loadingCard = id;
    state.errorByCard[id] = "";
    render();
    try {
      const result = await bridge("learn", { action: "question", card: card, question: question, detailed: Boolean(card.answerDetailed), history: card.questionHistory || [] });
      if (activeToken === generationToken) {
        card.question = question;
        card.answer = result.answer;
        card.answerSources = result.citations || [];
        card.questionHistory = (card.questionHistory || []).concat([{ role: "user", content: question }, { role: "assistant", content: card.answer }]);
      }
    } catch (error) {
      state.errorByCard[id] = error.message;
    }
    state.loadingCard = null;
    saveState();
    render();
  }
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
    card.feedback = kind;
    card.known = kind === "heard";
    const topicPath = card.topicPath || ["this topic"];
    const topic = topicPath.slice(-1)[0];
    const profileKey = topicPath.map(function (part) { return String(part).toLowerCase(); }).join("::");
    const profile = state.profile[profileKey] || { heard: 0, unknown: 0, unknownStreak: 0, targetDifficulty: state.settings.obscurity };
    if (kind === "heard") {
      profile.heard += 1;
      profile.unknownStreak = 0;
      profile.targetDifficulty = Math.min(10, profile.targetDifficulty + 1);
      showToast("Heard — " + topic + " will get harder next.");
    } else {
      profile.unknown += 1;
      profile.unknownStreak += 1;
      const threshold = Math.max(10, Math.min(20, 10 + Math.floor(profile.targetDifficulty / 2)));
      if (profile.unknownStreak >= threshold) {
        profile.targetDifficulty = Math.max(1, profile.targetDifficulty - 1);
        profile.unknownStreak = 0;
        showToast("Unknown streak reached " + threshold + "; easing " + topic + " slightly.");
      } else showToast("Unknown noted — staying near difficulty " + profile.targetDifficulty + "/10.");
    }
    state.profile[profileKey] = profile;
    saveState();
    render();
  }
  async function signIn() {
    try {
      const result = await bridge("signIn", {});
      const previousOwner = state.cloudOwnerId;
      state.account = result.account;
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
    try {
      cancelWorkspaceOperations();
      await bridge("signOut", {});
      state.account = null;
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
  hydrate();
})();
