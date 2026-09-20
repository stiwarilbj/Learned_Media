(function () {
  "use strict";

  const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
  const DEFAULT_SETTINGS = {
    obscurity: 10,
    displayMode: "picture-text",
    sentenceLength: 2,
    surpriseMe: true
  };
  const TOPIC_CATALOG_VERSION = 3;
  const ALLOWED_GEMINI_MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash-lite-preview", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const TOPICS = window.LEARNED_MEDIA_TOPIC_CATALOG || [];
  const DIFFICULTY_LABELS = ["", "Approachable", "Familiar", "Curious", "Uncommon", "Niche", "Obscure", "Deep cut", "Rare", "Very rare", "Deepest cut"];
  const PERSISTENCE_VERSION = 1;
  const LOCAL_WORKSPACE_KEY = "learned-media-native-workspace";
  const KNOWN_DEMO_IDS = new Set(["demo-dodecahedron", "demo-antikythera", "demo-blue-hole", "demo-wasp", "demo-concrete", "demo-jellyfish", "demo-mouse", "demo-whistle", "roman-dodecahedron", "mouse-wood", "roman-concrete", "venus-day", "blue-banana", "antarctic-dry-valleys", "mantis-shrimp", "paper-clip", "honey-never-spoils", "fermi-paradox", "antikythera-mechanism", "quipu", "tyrian-purple", "mechanical-turk", "harvard-mark-ii-bug", "oklo-reactor", "lake-vostok", "axolotl-regeneration", "ada-lovelace-notes", "sagittarius-b2-alcohol", "brinicle", "volcanic-lightning"]);
  const state = {
    view: "feed",
    started: false,
    topics: makeTopics(),
    settings: Object.assign({}, DEFAULT_SETTINGS),
    cards: [],
    profile: {},
    query: "",
    topicQuery: "",
    customTopic: "",
    key: "",
    geminiStatus: "not-configured",
    modelChecks: [],
    modelChecking: false,
    account: null,
    toast: "",
    loading: false,
    loadingCard: null,
    errorByCard: {},
    generationError: "",
    pendingSlots: 10,
    connectionToken: 0,
    generationRequestToken: 0
  };
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
  let queuedWorkspaceState = null;

  function makeTopics() {
    return TOPICS.map(function (topic, index) { return buildTopicNode(topic, [], 0, index); });
  }
  function buildTopicNode(seed, parentPath, depth, rootIndex) {
    const label = typeof seed === "string" ? seed : seed.label;
    const path = parentPath.concat(label);
    const children = typeof seed === "string" ? undefined : (seed.children || []).map(function (child) { return buildTopicNode(child, path, depth + 1, rootIndex); });
    return { id: "topic-" + path.map(slug).join("--"), label: label, selected: false, expanded: depth === 0, weight: depth === 0 ? [30, 25, 20, 25][rootIndex] || 10 : 10, children: children };
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
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      sliders: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.2.8-1.5 1.2-1.5 2.5M12 17h.01"/>',
      message: '<path d="M4 5h16v11H8l-4 4V5Z"/>'
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
      else if (key === "text") element.textContent = value;
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
      element.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return element;
  }
  function svg(name, size) {
    return node("span", { className: "icon", html: icon(name, size) });
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
      if (Number(message.readyCount) >= 5) state.geminiStatus = "connected";
      render();
      return;
    }
    if (message.type === "generationCard" && message.token === state.generationRequestToken && state.started) {
      const raw = message.card;
      if (!raw || !raw.id || state.cards.some(function (card) { return card.id === raw.id || card.title === raw.title; })) return;
      state.cards.push(normalizeCard(raw));
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
      return { path: topic.path, weight: Math.max(1, Math.round(pathWeight)) };
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
  function migrateTopics(saved) {
    if (!Array.isArray(saved) || !saved.length) return makeTopics();
    let next = makeTopics();
    const fresh = flatTopics(next);
    const byPath = new Map(fresh.map(function (topic) { return [topic.path.join("\u0000").toLowerCase(), topic]; }));
    const byLabel = new Map();
    fresh.forEach(function (topic) { const key = topic.label.toLowerCase(); byLabel.set(key, (byLabel.get(key) || []).concat(topic)); });
    const selectedIds = [];
    const customs = new Map();
    function oldFlat(nodes, parentPath) {
      const prefix = parentPath || [];
      return nodes.reduce(function (all, topic) {
        const path = prefix.concat(topic.label);
        return all.concat([Object.assign({}, topic, { path })], topic.children ? oldFlat(topic.children, path) : []);
      }, []);
    }
    oldFlat(saved).forEach(function (oldTopic) {
      const target = byPath.get(oldTopic.path.join("\u0000").toLowerCase()) || ((byLabel.get(oldTopic.label.toLowerCase()) || []).length === 1 ? byLabel.get(oldTopic.label.toLowerCase())[0] : null);
      if (target) {
        next = updateTopicById(next, target.id, function (topic) { return Object.assign({}, topic, { weight: oldTopic.weight || topic.weight, expanded: oldTopic.expanded }); });
        if (oldTopic.selected) selectedIds.push(target.id);
      } else if (oldTopic.custom || oldTopic.selected) {
        const key = oldTopic.label.toLowerCase();
        if (!customs.has(key)) customs.set(key, { id: "custom-" + slug(oldTopic.label), label: oldTopic.label, selected: Boolean(oldTopic.selected), expanded: false, weight: oldTopic.weight || 10, custom: true });
      }
    });
    selectedIds.forEach(function (id) { next = updateTopicById(next, id, function (topic) { return setBranchSelected(topic, true); }); });
    return next.concat(Array.from(customs.values()));
  }
  function difficultyLabel(value) { return DIFFICULTY_LABELS[Math.max(1, Math.min(10, Number(value) || 10))]; }
  function wikiURL(title) { return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/\s+/g, "_")); }
  function showToast(message) {
    state.toast = message || "";
    render();
    if (message) window.setTimeout(function () { if (state.toast === message) { state.toast = ""; render(); } }, 4200);
  }
  function saveState() {
    const snapshot = {
      persistenceVersion: PERSISTENCE_VERSION,
      catalogVersion: TOPIC_CATALOG_VERSION,
      savedAt: new Date().toISOString(),
      topics: state.topics,
      settings: state.settings,
      cards: state.cards,
      profile: state.profile,
      started: state.started,
      account: state.account,
      theme: document.body.classList.contains("theme-dark") ? "dark" : "light"
    };
    queuedWorkspaceState = snapshot;
    try { window.localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(snapshot)); } catch (_) {}
    flushWorkspaceSave();
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
  function normalizeCard(card, index) {
    const first = card.sources && card.sources[0] ? card.sources[0] : { title: card.sourceTitle || "Wikipedia", url: card.sourceUrl || wikiURL(card.sourceTitle || card.title) };
    const sources = (card.sources && card.sources.length ? card.sources : [first]).slice(0, 3);
    const image = card.image || (card.imageUrl ? { url: card.imageUrl, alt: card.title, sourceTitle: first.title, sourceUrl: first.url, filePageUrl: first.url, credit: "Wikipedia image" } : null);
    const hook = String(card.hook || card.title || "A small fact worth keeping").replace(/[.!?]+/g, "").split(/\s+/).slice(0, 12).join(" ").replace(/^(\s*[\"'“‘([{]*)([a-z])/, function (_, prefix, letter) { return prefix + letter.toUpperCase(); });
    return Object.assign({
      id: "card-" + Date.now() + "-" + index,
      title: "",
      hook: "",
      body: "",
      topicPath: [],
      difficulty: 10,
      accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5],
      createdAt: new Date().toISOString()
    }, card, { sources: sources, image: image, hook: hook });
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
  function topicMatches(topic, query) {
    if (!query) return true;
    const term = query.toLowerCase();
    return topic.label.toLowerCase().includes(term) || Boolean(topic.children && topic.children.some(function (child) { return topicMatches(child, query); }));
  }
  function topicRow(topic, depth, query) {
    if (query && !topicMatches(topic, query)) return null;
    const hasChildren = Boolean(topic.children && topic.children.length);
    const selection = selectionState(topic);
    const searchExpanded = Boolean(query && topic.children && topic.children.some(function (child) { return topicMatches(child, query); }));
    const childrenVisible = hasChildren && (topic.expanded || searchExpanded);
    const branchWrap = node("div", { className: "topic-branch" });
    const row = node("div", { className: "topic-row" + (depth === 0 ? " root-row" : "") + " selection-" + selection, dataset: { topicId: topic.id } });
    row.style.paddingLeft = Math.min(depth, 5) * 20 + 4 + "px";
    row.appendChild(node("button", { className: "topic-expand", disabled: !hasChildren, ariaLabel: (childrenVisible ? "Hide" : "Show") + " subtopics for " + topic.label, ariaExpanded: hasChildren ? childrenVisible : undefined, dataset: { topicId: topic.id }, onClick: function () { if (!hasChildren) return; topic.expanded = !topic.expanded; saveState(); render(); } }, hasChildren ? svg(childrenVisible ? "chevronDown" : "chevronRight", 15) : null));
    row.appendChild(node("button", { className: "topic-check" + (selection === "selected" ? " checked" : "") + (selection === "mixed" ? " mixed" : ""), ariaLabel: (selection === "selected" ? "Deselect " : "Select ") + topic.label, ariaPressed: selection === "selected", dataset: { topicId: topic.id }, onClick: function () { toggleTopicSelection(topic.id); saveState(); render(); } }, selection === "selected" ? svg("check", 14) : selection === "mixed" ? node("span", { className: "topic-check-dash" }) : null));
    const nameWrap = node("div", { className: "topic-name-wrap" + (selection === "none" ? " unselected" : "") });
    nameWrap.appendChild(node("span", { className: "topic-name" + (selection === "selected" ? " selected" : ""), text: topic.label }));
    if (hasChildren) nameWrap.appendChild(node("button", { className: "topic-subtopics-toggle", ariaExpanded: childrenVisible, dataset: { topicId: topic.id }, onClick: function () { topic.expanded = !topic.expanded; saveState(); render(); } }, childrenVisible ? "Hide subtopics" : "Show subtopics"));
    row.appendChild(nameWrap);
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
    const tree = node("div", { className: "topic-tree", role: "tree", ariaLabel: "Topic browser" });
    const query = state.topicQuery.trim();
    state.topics.forEach(function (topic) { const row = topicRow(topic, 0, query); if (row) tree.appendChild(row); });
    return tree;
  }
  function navigation() {
    const items = [["feed", "Feed", "home"], ["saved", "Saved", "bookmark"], ["likes", "Likes", "heart"], ["history", "History", "history"], ["settings", "Settings", "settings"]];
    const header = node("header", { className: "top-navigation" });
    header.appendChild(node("button", { className: "nav-brand", ariaLabel: "Learned Media home", onClick: function () { state.view = "feed"; render(); } }, node("span", { className: "brand-mark", text: "LM" }), node("span", { className: "brand-wordmark" }, node("strong", { text: "Learned" }), node("small", { text: "Media" }))));
    const links = node("nav", { className: "top-nav-links", ariaLabel: "Primary navigation" });
    items.forEach(function (item) { links.appendChild(node("button", { className: "top-nav-link" + (state.view === item[0] ? " active" : ""), onClick: function () { state.view = item[0]; render(); } }, svg(item[2], 16), node("span", { text: item[1] }))); });
    header.appendChild(links);
    const searchWrap = node("div", { className: "top-nav-search" });
    const search = node("div", { className: "global-search-wrap" });
    search.appendChild(svg("search", 17));
    search.appendChild(node("input", { id: "global-search", value: state.query, placeholder: "Search topics or facts...", ariaLabel: "Search topics or facts", onInput: function (event) { state.query = event.target.value.toLowerCase(); document.querySelectorAll(".fact-card").forEach(function (card) { card.style.display = !state.query || card.textContent.toLowerCase().includes(state.query) ? "" : "none"; }); } }));
    searchWrap.appendChild(search);
    header.appendChild(searchWrap);
    const accountName = state.account ? state.account.name || "Google learner" : "Local workspace";
    header.appendChild(node("div", { className: "top-nav-account" }, node("button", { className: "nav-reset", onClick: resetFeed }, svg("reset", 15), " Reset feed"), node("button", { className: "profile-chip", onClick: function () { state.view = "settings"; render(); } }, node("span", { className: "profile-avatar", text: accountName.slice(0, 1).toUpperCase() }), node("span", { className: "profile-copy" }, node("strong", { text: accountName }), node("small", { text: state.account ? "Google account" : "Not signed in" })), svg("chevronDown", 15))));
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
    const details = node("details", { className: setup ? "setup-topics-details" : "topics-details" });
    details.open = true;
    details.appendChild(node("summary", {}, node("span", {}, svg("check", 17), setup ? " Choose your topics" : " Your topics"), node("strong", { text: selectedCount() + " selected" })));
    if (setup) details.appendChild(node("p", { className: "setup-topic-help", text: "Pick the subjects you want to see. You can change them anytime." }));
    else details.appendChild(node("div", { className: "feed-topic-copy", text: "New choices shape the next batch." }));
    details.appendChild(node("p", { className: "topic-selection-summary", text: selectedSummary(), ariaLive: "polite" }));
    const difficulty = node("label", { className: "topic-difficulty-control", for: setup ? "setup-difficulty" : "feed-difficulty" });
    difficulty.appendChild(node("span", { className: "control-label" }, node("span", { text: "Fact Difficulty" }), node("strong", { text: state.settings.obscurity + "/10 · " + difficultyLabel(state.settings.obscurity) })));
    difficulty.appendChild(node("input", { id: setup ? "setup-difficulty" : "feed-difficulty", type: "range", min: "1", max: "10", step: "1", value: state.settings.obscurity, onInput: function (event) { const next = Number(event.target.value); state.settings.obscurity = next; Object.keys(state.profile).forEach(function (key) { state.profile[key].unknownStreak = 0; state.profile[key].targetDifficulty = next; }); saveState(); render(); } }));
    difficulty.appendChild(node("span", { className: "range-ends" }, node("span", { text: "Approachable" }), node("span", { text: "Obscure" })));
    details.appendChild(difficulty);
    details.appendChild(node("div", { className: "topic-list-search" }, svg("search", 14), node("input", { value: state.topicQuery, placeholder: "Search topics", ariaLabel: "Search topics", onInput: function (event) { state.topicQuery = event.target.value; render(); } })));
    details.appendChild(topicTree());
    details.appendChild(customTopicForm(setup ? "custom-topic-form" : "feed-custom-topic"));
    details.appendChild(feedCustomize(setup));
    aside.appendChild(details);
    return aside;
  }
  function feedCustomize(setup) {
    const details = node("details", { className: setup ? "setup-customize" : "feed-customize" });
    details.appendChild(node("summary", {}, node("span", {}, svg("sliders", 16), " Customize your feed", svg("chevronDown", 15))));
    const body = node("div", { className: "setup-customize-body" });
    body.appendChild(node("span", { className: "control-label", text: "Display style" }));
    const display = node("div", { className: "feed-display-options" });
    display.appendChild(node("button", { className: state.settings.displayMode === "picture-text" ? "selected" : "", onClick: function () { state.settings.displayMode = "picture-text"; saveState(); render(); } }, "Image + text"));
    display.appendChild(node("button", { className: state.settings.displayMode === "text" ? "selected" : "", onClick: function () { state.settings.displayMode = "text"; saveState(); render(); } }, "Text only"));
    body.appendChild(display);
    body.appendChild(node("button", { className: "feed-surprise-toggle" + (state.settings.surpriseMe ? " selected" : ""), onClick: function () { state.settings.surpriseMe = !state.settings.surpriseMe; saveState(); render(); } }, svg("sparkles", 14), " Surprise Me ", node("span", { text: state.settings.surpriseMe ? "On" : "Off" })));
    details.appendChild(body);
    return details;
  }
  function startPanel() {
    const hasSelection = selectedCount() > 0;
    const canStart = state.geminiStatus === "connected";
    const panel = node("section", { className: "setup-start-panel surface-panel" });
    panel.appendChild(node("div", { className: "start-panel-copy" }, node("span", { className: "eyebrow", text: "Your next feed" }), node("h1", { text: "Ready to learn something unexpected?" }), node("p", { text: hasSelection ? selectedCount() + " topics in your mix, sourced from Wikipedia and shaped by your curiosity." : "Choose at least one topic from the checklist to begin." })));
    panel.appendChild(node("div", { className: "start-orbit" }, svg("sparkles", 24), node("span", { text: "Every card has a source" })));
    panel.appendChild(node("button", { className: "start-button", disabled: !hasSelection || !canStart, onClick: startFeed }, node("span", { text: !hasSelection ? "Choose a topic first" : canStart ? "Start learning" : "Connect Gemini first" }), svg("arrow", 21)));
    panel.appendChild(node("p", { className: "panel-footnote" }, svg(hasSelection && canStart ? "shield" : "help", 13), " ", !hasSelection ? "Select a topic to unlock your feed." : canStart ? "Your mix stays yours." : "Connect at least five Gemini models in Settings to begin."));
    const keyCallout = node("div", { className: "setup-key-callout" }, node("div", { className: "setup-key-callout-icon" }, svg("key", 16)), node("div", {}, node("strong", { text: "Want Gemini-generated facts?" }), node("span", { text: "Add your API key in Settings to personalize the next batch." })));
    keyCallout.appendChild(node("button", { className: "text-button", onClick: function () { state.view = "settings"; render(); } }, "Add key ", svg("arrow", 14)));
    panel.appendChild(keyCallout);
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
    const input = node("input", { value: card.question || "", placeholder: "Ask a question about this fact…", ariaLabel: "Ask a question about this fact", dataset: { cardId: card.id }, onInput: function (event) { card.question = event.target.value; } });
    row.appendChild(input);
    row.appendChild(node("button", { className: "details-toggle" + (card.answerDetailed ? " selected" : ""), onClick: function () { card.answerDetailed = !card.answerDetailed; render(); } }, "More Details"));
    row.appendChild(node("button", { className: "question-send", ariaLabel: "Send question", onClick: function () { askQuestion(card.id, input.value); } }, svg("arrow", 16)));
    box.appendChild(row);
    if (card.answer) box.appendChild(node("div", { className: "learning-answer question-answer" }, node("span", { className: "answer-label" }, svg("message", 14), " ", card.answerDetailed ? "Detailed answer" : "Answer"), node("p", { text: card.answer }), sourceList(card, true)));
    if (state.loadingCard === card.id) box.appendChild(node("div", { className: "learning-loading" }, node("span", { className: "loading-dot" }), " Gemini is reading the cited Wikipedia pages…"));
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
    meta.appendChild(node("span", { className: "difficulty-mark", text: "Difficulty " + (card.difficulty || 10) + " · " + difficultyLabel(card.difficulty || 10) }));
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
    actions.appendChild(node("button", { className: "learn-more-button", disabled: Boolean(card.learnMore || state.loadingCard === card.id), onClick: function () { learnMore(card.id); } }, svg("sparkles", 16), node("span", { text: state.loadingCard === card.id ? "Reading…" : card.learnMore ? "Learned" : "Learn more" })));
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
    column.appendChild(node("div", { className: "feed-toolbar" }, node("div", { className: "active-topics" }, node("span", { className: "toolbar-label", text: "Your feed" }), node("span", { className: "topic-chip selected-chip", text: selectedTopics().map(function (topic) { return topic.path.join(" / "); }).join(" · ") || "Your selected topics" })), node("button", { className: "toolbar-reset", onClick: resetFeed }, svg("reset", 15), " Reset feed")));
    column.appendChild(node("div", { className: "feed-intro" }, node("div", {}, node("h1", { text: "Keep going." }), node("p", { text: "One small idea at a time. Every card has a place to look next." })), node("span", { className: "feed-count", text: state.cards.length + " cards in this session" })));
    const list = node("div", { className: "fact-feed" });
    state.cards.forEach(function (card, index) {
      if (state.query && !(card.title + " " + card.body).toLowerCase().includes(state.query)) return;
      if (!state.loading && !state.generationError && index === Math.max(state.cards.length - 3, 0)) list.appendChild(node("div", { className: "feed-load-more-nearby" }, node("button", { className: "small-load-button", onClick: function () { generateBatch(generationToken, 10); } }, "Generate 10 more")));
      list.appendChild(cardElement(card));
    });
    if (state.loading) list.appendChild(node("div", { className: "feed-progress", role: "status" }, node("span", { className: "loading-dot" }), " Gemini is building the next facts…"));
    if (!state.loading && !state.generationError && state.started) list.appendChild(node("div", { className: "feed-bottom-actions" }, node("button", { className: "small-load-button", onClick: function () { generateBatch(generationToken, 10); } }, "Generate 10 more")));
    column.appendChild(list);
    layout.appendChild(column);
    if (state.generationError && !state.loading) {
      list.appendChild(node("div", { className: "feed-error", role: "alert" }, svg("help", 17), node("div", {}, node("strong", { text: "Generation paused" }), node("span", { text: state.generationError })), node("button", { className: "secondary-button", onClick: function () { state.generationError = ""; generateBatch(generationToken, state.pendingSlots); } }, "Retry missing facts")));
    }
    return node("div", { className: "feed-workspace" }, state.toast ? node("div", { className: "feed-toast" }, svg("check", 15), " ", state.toast) : null, layout);
  }
  function settingsView() {
    const section = node("section", { className: "content-view settings-view" });
    section.appendChild(node("div", { className: "view-heading" }, node("div", {}, node("span", { className: "eyebrow", text: "Your workspace" }), node("h1", { text: "Make the feed feel like yours." }), node("p", { text: "Settings stay calm, clear, and close to the experience they shape." })), node("div", { className: "settings-avatar", text: state.account ? (state.account.name || "G").slice(0, 1).toUpperCase() : "S" })));
    const grid = node("div", { className: "settings-grid" });
    const main = node("div", { className: "settings-main" });
    const gemini = node("section", { className: "settings-card gemini-settings-card" });
    gemini.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon blue" }, svg("key", 19)), node("div", {}, node("h2", { text: "Gemini API key" }), node("p", { text: "Use Gemini for fresh facts, Learn more, and questions." })), node("span", { className: "status-dot " + state.geminiStatus, text: statusLabel() })));
    gemini.appendChild(node("label", { className: "field-label", text: "Paste your API key here" }));
    const keyRow = node("div", { className: "key-input-row" });
    keyRow.appendChild(node("input", { id: "gemini-key", type: "password", value: state.key, placeholder: "Paste your API key here", autocomplete: "new-password", onInput: function (event) { state.key = event.target.value; state.geminiStatus = "not-configured"; state.modelChecks = []; state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); bridge("setGeminiKey", { key: state.key }).catch(function () {}); }, onKeydown: function (event) { if (event.key === "Enter") testKey(); } }));
    const keyActions = node("div", { className: "key-actions" });
    keyActions.appendChild(node("button", { className: "primary-button small", disabled: state.geminiStatus === "testing", onClick: testKey }, svg("sparkles", 15), state.geminiStatus === "testing" ? " Connecting" : " Connect Gemini"));
    keyActions.appendChild(node("button", { className: "ghost-button", onClick: function () { state.key = ""; state.geminiStatus = "not-configured"; state.modelChecks = []; state.generationError = ""; generationToken += 1; state.connectionToken += 1; state.generationRequestToken += 1; bridge("cancelAll", {}).catch(function () {}); bridge("setGeminiKey", { key: "" }).catch(function () {}); showToast("Session key removed."); } }, "Remove"));
    keyRow.appendChild(keyActions);
    gemini.appendChild(keyRow);
    gemini.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your key is held in memory for this session, sent only when Gemini is requested, and never saved to disk." })));
    if (state.toast) gemini.appendChild(node("p", { className: "settings-feedback", text: state.toast }));
    const workingModels = {};
    state.modelChecks.forEach(function (model) { if (model.status === "working") workingModels[model.resolvedModel || model.model] = true; });
    const modelHeading = node("div", { className: "model-check-heading" }, node("div", {}, node("strong", { text: "Available Gemini models" }), node("span", { text: state.modelChecks.length ? Object.keys(workingModels).length + " ready of " + state.modelChecks.length + " checks" : "Connect to discover models" })));
    modelHeading.appendChild(node("button", { className: "ghost-button", disabled: state.modelChecking || !state.key.trim(), onClick: testKey }, state.modelChecking ? "Checking" : "Check all models"));
    gemini.appendChild(modelHeading);
    if (state.modelChecks.length) {
      const modelList = node("div", { className: "model-check-list", ariaLive: "polite" });
      state.modelChecks.forEach(function (model) { modelList.appendChild(node("div", { className: "model-check-row" }, node("span", { className: "model-status-dot " + model.status, ariaLabel: model.status }), node("div", {}, node("strong", { text: model.model }), node("small", { text: model.status === "working" ? (model.resolvedModel && model.resolvedModel !== model.model ? "Ready · resolves to " + model.resolvedModel : "Ready for generation") : model.error || "Unavailable" })), node("span", { className: "model-check-meta", text: (model.latencyMs ? model.latencyMs + " ms" : "—") + "\n" + (model.checkedAt ? new Date(model.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked") }))); });
      gemini.appendChild(modelList);
    }
    gemini.appendChild(node("div", { className: "api-key-guide" }, node("div", { className: "api-key-guide-icon" }, svg("sparkles", 16)), node("div", { className: "api-key-guide-copy" }, node("strong", { text: "Need a key?" }), node("p", { text: "Create or copy one in Google AI Studio, then paste it here." })), externalLink(AI_STUDIO_URL, "Open AI Studio", "api-key-link")));
    main.appendChild(gemini);
    const accountCard = node("section", { className: "settings-card" });
    accountCard.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon lilac" }, svg("user", 19)), node("div", {}, node("h2", { text: "Account" }), node("p", { text: "Google sign-in keeps your account ready on this Mac." }))));
    const accountRow = node("div", { className: "account-row" }, node("div", { className: "account-avatar", text: state.account ? (state.account.name || "G").slice(0, 1).toUpperCase() : "L" }), node("div", {}, node("strong", { text: state.account ? state.account.name : "Local workspace" }), node("span", { text: state.account ? state.account.email || "Google account" : "Not signed in" })));
    accountRow.appendChild(node("button", { className: "secondary-button", onClick: state.account ? signOut : signIn }, svg("login", 15), state.account ? " Sign out" : " Continue with Google"));
    accountCard.appendChild(accountRow);
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
    side.appendChild(node("section", { className: "settings-help" }, svg("help", 17), node("div", {}, node("strong", { text: "Privacy by default" }), node("p", { text: "Your Gemini credential is kept in memory only. Learning data stays on this Mac until you clear it." }))));
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
  function render() {
    const currentTopicTree = document.querySelector(".topic-tree");
    if (currentTopicTree) topicTreeScrollTop = currentTopicTree.scrollTop;
    const currentMainScroll = document.querySelector(".main-scroll");
    if (currentMainScroll) mainScrollTop = currentMainScroll.scrollTop;
    const activeElement = document.activeElement;
    if (activeElement && activeElement.dataset && activeElement.dataset.topicId) focusedTopicId = activeElement.dataset.topicId;
    focusedFieldId = activeElement && activeElement.id === "gemini-key" ? activeElement.id : null;
    focusedSelection = focusedFieldId && typeof activeElement.selectionStart === "number" ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    focusedQuestionCardId = activeElement && activeElement.dataset ? activeElement.dataset.cardId || null : null;
    focusedQuestionSelection = focusedQuestionCardId && typeof activeElement.selectionStart === "number" ? [activeElement.selectionStart, activeElement.selectionEnd] : null;
    document.body.classList.add("native-shell");
    app.replaceChildren();
    app.appendChild(navigation());
    const main = node("main", { className: "main-column" });
    const scroll = node("div", { className: "main-scroll" });
    scroll.appendChild(state.view === "settings" ? settingsView() : state.view === "feed" && !state.started ? setupView() : state.view === "feed" ? feedView() : collectionView(state.view));
    main.appendChild(scroll);
    app.appendChild(main);
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
        if (parsed.topics) state.topics = migrateTopics(parsed.topics);
        if (parsed.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings);
        if (parsed.cards) state.cards = parsed.cards.filter(function (card) { return !KNOWN_DEMO_IDS.has(card.id); }).map(normalizeCard).filter(function (card) { return card.id && card.title && card.body && card.topicPath && card.topicPath.length && card.sources && card.sources.length; });
        if (parsed.profile) state.profile = parsed.profile;
        if (parsed.started && state.cards.length) state.started = true;
        if (parsed.account) state.account = parsed.account;
        document.body.classList.toggle("theme-dark", parsed.theme === "dark");
      }
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
  }
  function resetAll() {
    if (!window.confirm("Reset all preferences and return to the default topic mix?")) return;
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
  function deleteData() {
    if (!window.confirm("Delete saved facts, likes, history, and the current feed?")) return;
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
  async function generateBatch(token, requestedCount) {
    if (state.loading || !selectedCount()) return;
    const activeToken = token || generationToken;
    if (!state.key.trim() || state.geminiStatus !== "connected") { state.generationError = "Connect Gemini in Settings before generating facts."; state.loading = false; render(); return; }
    state.loading = true;
    state.generationError = "";
    const count = Math.max(1, Math.min(10, Number(requestedCount) || 10));
    render();
    try {
      const result = await bridge("generate", { topics: weightedTopicPaths(count), requestedCount: count, settings: state.settings, avoid: state.cards.map(function (card) { return card.title; }), token: state.generationRequestToken });
      if (activeToken !== generationToken) return;
      const fresh = (result.cards || []).filter(function (card) { return card && card.id && card.title && card.body && card.hook && card.topicPath && card.topicPath.length && card.sources && card.sources.length; }).map(normalizeCard).filter(function (card) { return !state.cards.some(function (existing) { return existing.id === card.id; }); });
      state.cards = state.cards.concat(fresh);
      if (!fresh.length) { state.pendingSlots = count; state.generationError = "Gemini returned no complete new cards. Retry when you are ready."; showToast("No new complete facts arrived. Retry when you are ready."); }
      else if (result.partial) { state.pendingSlots = Math.max(1, count - fresh.length); state.generationError = result.retryGuidance || "Some work failed. Retry to fill the remaining batch."; showToast(fresh.length + " facts arrived. Retry to fill the remaining batch."); }
      else { state.pendingSlots = 10; }
    } catch (error) {
      if (activeToken !== generationToken) return;
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
  async function testKey() {
    const keyAtStart = state.key.trim();
    if (!keyAtStart) return showToast("Paste your Gemini API key first.");
    state.geminiStatus = "testing";
    state.modelChecking = true;
    state.modelChecks = [];
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
      state.modelChecks = [];
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
      state.account = result.account;
      saveState();
      render();
      showToast("Signed in with Google.");
    } catch (error) {
      showToast(error.message);
    }
  }
  async function signOut() {
    try {
      await bridge("signOut", {});
      state.account = null;
      saveState();
      render();
      showToast("Signed out.");
    } catch (error) {
      showToast(error.message);
    }
  }
  hydrate();
})();
