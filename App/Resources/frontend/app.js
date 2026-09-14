(function () {
  "use strict";

  const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
  const DEFAULT_SETTINGS = {
    obscurity: 10,
    displayMode: "picture-text",
    sentenceLength: 2,
    surpriseMe: true
  };
  const TOPICS = [
    { id: "science", label: "Science", children: ["Physics", "Biology", "Chemistry", "Earth science"] },
    { id: "history", label: "History", children: ["Ancient History", "Medieval History", "Modern History", "Archaeology"] },
    { id: "technology", label: "Technology", children: ["Computing", "Engineering", "Inventions", "Materials"] },
    { id: "culture", label: "Culture", children: ["Art", "Music", "Language", "Food"] },
    { id: "nature", label: "Nature", children: ["Animals", "Plants", "Ocean", "Space"] }
  ];
  const DIFFICULTY_LABELS = ["", "Approachable", "Familiar", "Curious", "Uncommon", "Niche", "Obscure", "Deep cut", "Rare", "Very rare", "Deepest cut"];
  const DEMO_FACTS = [
    { id: "demo-dodecahedron", title: "Roman dodecahedra still have no agreed purpose", hook: "A Roman object with no agreed purpose", body: "Roman dodecahedra are hollow, twelve-sided objects with knobs at their corners. Archaeologists have found more than a hundred, but no surviving Roman text explains what they were used for.", topicPath: ["History", "Archaeology"], difficulty: 10, sourceTitle: "Roman dodecahedron", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Roman_dodecahedron.jpg?width=900" },
    { id: "demo-antikythera", title: "The Antikythera mechanism modeled the sky", hook: "A 2,000-year-old machine modeled the heavens", body: "The Antikythera mechanism used interlocking bronze gears to represent astronomical cycles and predict eclipses. Its design is far more mechanically sophisticated than most surviving devices from the ancient world.", topicPath: ["Science", "Physics"], difficulty: 9, sourceTitle: "Antikythera mechanism", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Antikythera_mechanism.jpg?width=900" },
    { id: "demo-blue-hole", title: "The Great Blue Hole is a flooded cave system", hook: "A blue circle hides an ancient cave system", body: "Belize’s Great Blue Hole formed when a limestone cave flooded as sea levels rose. Divers have found mineral formations deep inside that record earlier periods when the cave was dry.", topicPath: ["Nature", "Ocean"], difficulty: 8, sourceTitle: "Great Blue Hole", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Great_Blue_Hole.jpg?width=900" },
    { id: "demo-wasp", title: "Paper wasps can recognize individual faces", hook: "Some wasps remember the faces of rivals", body: "The northern paper wasp can learn to recognize individual wasps by their facial patterns. Researchers think this ability helps colonies manage repeated social encounters.", topicPath: ["Science", "Biology"], difficulty: 8, sourceTitle: "Polistes fuscatus", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Polistes_fuscatus.jpg?width=900" },
    { id: "demo-concrete", title: "Roman concrete can repair some of its own cracks", hook: "Ancient concrete carried tiny repair capsules", body: "Some Roman concrete contains lime clasts that can react with water when cracks form. That reaction may help seal fissures and helps explain why certain ancient marine structures remain intact.", topicPath: ["Technology", "Materials"], difficulty: 9, sourceTitle: "Roman concrete", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Roman_concrete.jpg?width=900" },
    { id: "demo-jellyfish", title: "One jellyfish can return to an earlier life stage", hook: "This jellyfish can rewind its own life cycle", body: "Turritopsis dohrnii can transform adult cells back into an earlier polyp stage after injury or stress. It can repeat the process, although it can still die from disease or predators.", topicPath: ["Nature", "Animals"], difficulty: 8, sourceTitle: "Turritopsis dohrnii", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Turritopsis_dohrnii.jpg?width=900" },
    { id: "demo-mouse", title: "The wooden prototype mouse was a simple block", hook: "The first computer mouse was a wooden block", body: "Douglas Engelbart’s early computer mouse prototype used a small wooden case and two wheels to measure movement. Its name came from the cable that looked like a tail.", topicPath: ["Technology", "Computing"], difficulty: 6, sourceTitle: "Computer mouse", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Computer_mouse.jpg?width=900" },
    { id: "demo-whistle", title: "Some languages use whistling for long-distance speech", hook: "A whistle can carry an entire spoken language", body: "Whistled languages encode features of spoken language into changes in pitch and rhythm. In mountainous or forested places, a whistle can travel farther than an ordinary voice.", topicPath: ["Culture", "Language"], difficulty: 7, sourceTitle: "Whistled language", imageUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Whistled_language.jpg?width=900" }
  ];
  const state = {
    view: "feed",
    started: false,
    topics: makeTopics(),
    settings: Object.assign({}, DEFAULT_SETTINGS),
    cards: [],
    profile: {},
    query: "",
    customTopic: "",
    key: "",
    geminiStatus: "not-configured",
    account: null,
    toast: "",
    loading: false,
    loadingCard: null,
    errorByCard: {}
  };
  const app = document.getElementById("app");
  const pending = new Map();
  let requestID = 0;
  let generationToken = 0;

  function makeTopics() {
    return TOPICS.map(function (topic) {
      return {
        id: topic.id,
        label: topic.label,
        selected: false,
        expanded: true,
        weight: 10,
        children: topic.children.map(function (label) {
          return { id: topic.id + "-" + slug(label), label: label, selected: false, expanded: false, weight: 10 };
        })
      };
    });
  }
  function slug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
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
  function flatTopics() {
    return state.topics.reduce(function (all, topic) { return all.concat([topic], topic.children || []); }, []);
  }
  function findTopic(id) { return flatTopics().find(function (topic) { return topic.id === id; }); }
  function selectedTopics() {
    return flatTopics().filter(function (topic) { return topic.selected; }).map(function (topic) { return { path: [topic.label], weight: topic.weight }; });
  }
  function selectedCount() { return flatTopics().filter(function (topic) { return topic.selected; }).length; }
  function difficultyLabel(value) { return DIFFICULTY_LABELS[Math.max(1, Math.min(10, Number(value) || 10))]; }
  function wikiURL(title) { return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/\s+/g, "_")); }
  function showToast(message) {
    state.toast = message || "";
    render();
    if (message) window.setTimeout(function () { if (state.toast === message) { state.toast = ""; render(); } }, 4200);
  }
  function saveState() {
    bridge("saveState", {
      state: {
        topics: state.topics,
        settings: state.settings,
        cards: state.cards,
        profile: state.profile,
        started: state.started,
        account: state.account,
        theme: document.body.classList.contains("theme-dark") ? "dark" : "light"
      }
    }).catch(function () {});
  }
  function normalizeCard(card, index) {
    const first = card.sources && card.sources[0] ? card.sources[0] : { title: card.sourceTitle || "Wikipedia", url: card.sourceUrl || wikiURL(card.sourceTitle || card.title) };
    const sources = (card.sources && card.sources.length ? card.sources : [first]).slice(0, 3);
    const image = card.image || (card.imageUrl ? { url: card.imageUrl, alt: card.title, sourceTitle: first.title, sourceUrl: first.url, filePageUrl: first.url, credit: "Wikipedia image" } : null);
    const hook = String(card.hook || card.title || "A small fact worth keeping").replace(/[.!?]+/g, "").split(/\s+/).slice(0, 12).join(" ");
    return Object.assign({
      id: "card-" + Date.now() + "-" + index,
      title: "A small fact worth keeping",
      hook: "A small fact worth keeping",
      body: "The explanation is still on its way.",
      topicPath: ["Surprise topic"],
      difficulty: 10,
      accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5],
      createdAt: "Just now"
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
  function topicRow(topic, child) {
    const row = node("div", { className: "topic-row" + (child ? "" : " root-row") });
    if (child) {
      row.style.paddingLeft = "24px";
      row.appendChild(node("span", { className: "topic-spacer" }));
    }
    else row.appendChild(node("button", { className: "topic-expand", ariaLabel: "Expand " + topic.label, onClick: function () { topic.expanded = !topic.expanded; render(); } }, svg(topic.expanded ? "chevronDown" : "chevronRight", 15)));
    row.appendChild(node("button", { className: "topic-check" + (topic.selected ? " checked" : ""), ariaLabel: "Select " + topic.label, onClick: function () { topic.selected = !topic.selected; saveState(); render(); } }, topic.selected ? svg("check", 14) : null));
    row.appendChild(node("span", { className: "topic-name" + (topic.selected ? " selected" : ""), text: topic.label }));
    const weight = node("div", { className: "topic-weight" });
    weight.appendChild(node("button", { ariaLabel: "Lower weight", onClick: function () { topic.weight = Math.max(5, topic.weight - 5); saveState(); render(); } }, svg("minus", 12)));
    weight.appendChild(node("span", { text: topic.weight }));
    weight.appendChild(node("button", { ariaLabel: "Raise weight", onClick: function () { topic.weight = Math.min(100, topic.weight + 5); saveState(); render(); } }, svg("plus", 12)));
    row.appendChild(weight);
    return row;
  }
  function topicTree() {
    const tree = node("div", { className: "topic-tree" });
    state.topics.forEach(function (topic) {
      tree.appendChild(topicRow(topic, false));
      if (!topic.children || !topic.expanded) return;
      const children = node("div", { className: "topic-children" });
      topic.children.forEach(function (child) { children.appendChild(topicRow(child, true)); });
      tree.appendChild(children);
    });
    return tree;
  }
  function navigation() {
    const items = [["feed", "Feed", "home"], ["saved", "Saved", "bookmark"], ["likes", "Likes", "heart"], ["history", "History", "history"], ["settings", "Settings", "settings"]];
    const header = node("header", { className: "top-navigation" });
    header.appendChild(node("button", { className: "nav-brand", ariaLabel: "Learned Media home", onClick: function () { state.view = "feed"; render(); } }, node("span", { className: "brand-mark", text: "LM" }), node("span", { className: "brand-wordmark" }, node("strong", { text: "Learned" }), node("small", { text: "Media" }))));
    const links = node("nav", { className: "top-nav-links", ariaLabel: "Primary navigation" });
    items.forEach(function (item) { links.appendChild(node("button", { className: "top-nav-link" + (state.view === item[0] ? " active" : ""), onClick: function () { state.view = item[0]; render(); } }, svg(item[2], 16), node("span", { text: item[1] }))); });
    header.appendChild(links);
    const accountName = state.account ? state.account.name || "Google learner" : "Sample learner";
    header.appendChild(node("div", { className: "top-nav-account" }, node("button", { className: "nav-reset", onClick: resetFeed }, svg("reset", 15), " Reset feed"), node("button", { className: "profile-chip", onClick: function () { state.view = "settings"; render(); } }, node("span", { className: "profile-avatar", text: accountName.slice(0, 1).toUpperCase() }), node("span", { className: "profile-copy" }, node("strong", { text: accountName }), node("small", { text: state.account ? "Google account" : "Local workspace" })), svg("chevronDown", 15))));
    return header;
  }
  function topbar() {
    const bar = node("header", { className: "topbar" });
    bar.appendChild(node("div", { className: "topbar-title" }, node("strong", { text: "Learned Media" }), node("span", { text: "Learn something every time you scroll." })));
    const searchWrap = node("div", { className: "global-search-wrap" });
    searchWrap.appendChild(svg("search", 17));
    searchWrap.appendChild(node("input", { id: "global-search", value: state.query, placeholder: "Search your feed…", ariaLabel: "Search your feed", onInput: function (event) { state.query = event.target.value.toLowerCase(); document.querySelectorAll(".fact-card").forEach(function (card) { card.style.display = !state.query || card.textContent.toLowerCase().includes(state.query) ? "" : "none"; }); } }));
    bar.appendChild(searchWrap);
    bar.appendChild(node("button", { className: "topbar-account", onClick: function () { state.view = "settings"; render(); } }, svg("settings", 16), " Settings"));
    return bar;
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
    body.appendChild(node("label", { className: "control-label" }, node("span", { text: "Fact difficulty" }), node("span", { text: state.settings.obscurity + "/10 · " + difficultyLabel(state.settings.obscurity) })));
    body.appendChild(node("input", { id: "difficulty", type: "range", min: "1", max: "10", value: state.settings.obscurity, onInput: function (event) { state.settings.obscurity = Number(event.target.value); saveState(); render(); } }));
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
    const panel = node("section", { className: "setup-start-panel surface-panel" });
    panel.appendChild(node("div", { className: "start-panel-copy" }, node("span", { className: "eyebrow", text: "Your next feed" }), node("h1", { text: "Ready to learn something unexpected?" }), node("p", { text: hasSelection ? selectedCount() + " topics in your mix, sourced from Wikipedia and shaped by your curiosity." : "Choose at least one topic from the checklist to begin." })));
    panel.appendChild(node("div", { className: "start-orbit" }, svg("sparkles", 24), node("span", { text: "Every card has a source" })));
    panel.appendChild(node("button", { className: "start-button", disabled: !hasSelection, onClick: startFeed }, node("span", { text: hasSelection ? "Start learning" : "Choose a topic first" }), svg("arrow", 21)));
    panel.appendChild(node("p", { className: "panel-footnote" }, svg(hasSelection ? "shield" : "help", 13), " ", hasSelection ? "Your mix stays yours." : "Select a topic to unlock your feed."));
    const keyCallout = node("div", { className: "setup-key-callout" }, node("div", { className: "setup-key-callout-icon" }, svg("key", 16)), node("div", {}, node("strong", { text: "Want Gemini-generated facts?" }), node("span", { text: "Add your API key in Settings to personalize the next batch." })));
    keyCallout.appendChild(node("button", { className: "text-button", onClick: function () { state.view = "settings"; render(); } }, "Add key ", svg("arrow", 14)));
    panel.appendChild(keyCallout);
    panel.appendChild(feedCustomize(true));
    panel.appendChild(node("div", { className: "setup-preview-note" }, node("span", { text: "Example" }), node("strong", { text: "A Roman object still has no agreed purpose" }), node("small", { text: "Roman dodecahedra · Ancient History · Wikipedia" })));
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
    const input = node("input", { value: card.question || "", placeholder: "Ask a question about this fact…", ariaLabel: "Ask a question about this fact", onInput: function (event) { card.question = event.target.value; } });
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
    state.cards.forEach(function (card) { if (!state.query || (card.title + " " + card.body).toLowerCase().includes(state.query)) list.appendChild(cardElement(card)); });
    if (state.loading) list.appendChild(node("div", { className: "skeleton-card" }, node("div", { className: "skeleton-media shimmer" }), node("div", { className: "skeleton-line wide shimmer" }), node("div", { className: "skeleton-line shimmer" })));
    column.appendChild(list);
    layout.appendChild(column);
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
    keyRow.appendChild(node("input", { id: "gemini-key", type: "password", value: state.key, placeholder: "Paste your API key here", autocomplete: "new-password", onInput: function (event) { state.key = event.target.value; bridge("setGeminiKey", { key: state.key }).catch(function () {}); }, onKeydown: function (event) { if (event.key === "Enter") testKey(); } }));
    const keyActions = node("div", { className: "key-actions" });
    keyActions.appendChild(node("button", { className: "primary-button small", disabled: state.geminiStatus === "testing", onClick: testKey }, svg("sparkles", 15), state.geminiStatus === "testing" ? " Connecting…" : " Connect Gemini"));
    keyActions.appendChild(node("button", { className: "ghost-button", onClick: function () { state.key = ""; state.geminiStatus = "not-configured"; bridge("setGeminiKey", { key: "" }).catch(function () {}); showToast("Session key removed."); } }, "Remove"));
    keyRow.appendChild(keyActions);
    gemini.appendChild(keyRow);
    gemini.appendChild(node("div", { className: "security-note" }, svg("shield", 16), node("span", { text: "Your key is held in memory for this session, sent only when Gemini is requested, and never saved to disk." })));
    if (state.toast) gemini.appendChild(node("p", { className: "settings-feedback", text: state.toast }));
    gemini.appendChild(node("div", { className: "api-key-guide" }, node("div", { className: "api-key-guide-icon" }, svg("sparkles", 16)), node("div", { className: "api-key-guide-copy" }, node("strong", { text: "Need a key?" }), node("p", { text: "Create or copy one in Google AI Studio, then paste it here." })), externalLink(AI_STUDIO_URL, "Open AI Studio", "api-key-link")));
    main.appendChild(gemini);
    const accountCard = node("section", { className: "settings-card" });
    accountCard.appendChild(node("div", { className: "settings-card-heading" }, node("div", { className: "settings-icon lilac" }, svg("user", 19)), node("div", {}, node("h2", { text: "Account" }), node("p", { text: "Google sign-in keeps your account ready on this Mac." }))));
    const accountRow = node("div", { className: "account-row" }, node("div", { className: "account-avatar", text: state.account ? (state.account.name || "G").slice(0, 1).toUpperCase() : "S" }), node("div", {}, node("strong", { text: state.account ? state.account.name : "Local workspace" }), node("span", { text: state.account ? state.account.email || "Google account" : "Not signed in" })));
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
    document.body.classList.add("native-shell");
    app.replaceChildren();
    app.appendChild(navigation());
    const main = node("main", { className: "main-column" });
    main.appendChild(topbar());
    const scroll = node("div", { className: "main-scroll" });
    scroll.appendChild(state.view === "settings" ? settingsView() : state.view === "feed" && !state.started ? setupView() : state.view === "feed" ? feedView() : collectionView(state.view));
    main.appendChild(scroll);
    app.appendChild(main);
  }
  function statusLabel() {
    return { "not-configured": "Not configured", testing: "Testing…", connected: "Connected", invalid: "Invalid key", "rate-limited": "Rate limited", unavailable: "Gemini unavailable" }[state.geminiStatus] || "Not configured";
  }
  async function hydrate() {
    try {
      const saved = await bridge("loadState", {});
      if (saved) {
        const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
        if (parsed.topics) state.topics = parsed.topics;
        if (parsed.settings) state.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings);
        if (parsed.cards) state.cards = parsed.cards.map(normalizeCard);
        if (parsed.profile) state.profile = parsed.profile;
        if (parsed.started) state.started = true;
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
    state.started = true;
    state.cards = [];
    generationToken += 1;
    saveState();
    render();
    generateBatch(generationToken);
  }
  function resetFeed() {
    generationToken += 1;
    state.started = false;
    state.cards = [];
    state.profile = {};
    state.loading = false;
    state.loadingCard = null;
    state.topics.forEach(function (topic) { topic.selected = false; (topic.children || []).forEach(function (child) { child.selected = false; }); });
    saveState();
    render();
    showToast("Feed reset. Choose a topic and press Start again.");
  }
  function resetAll() {
    if (!window.confirm("Reset all preferences and return to the default topic mix?")) return;
    generationToken += 1;
    state.topics = makeTopics();
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    state.cards = [];
    state.profile = {};
    state.started = false;
    state.view = "feed";
    saveState();
    render();
  }
  function deleteData() {
    if (!window.confirm("Delete saved facts, likes, history, and the current feed?")) return;
    generationToken += 1;
    state.cards = [];
    state.profile = {};
    state.started = false;
    saveState();
    render();
    showToast("Learning data cleared.");
  }
  function demoBatch() {
    const available = DEMO_FACTS.filter(function (fact) { return !state.cards.some(function (card) { return card.id === fact.id; }); });
    return available.sort(function () { return Math.random() - 0.5; }).slice(0, 10).map(normalizeCard);
  }
  function onScroll() {
    if (!state.loading && state.started && window.innerHeight + window.scrollY >= document.body.offsetHeight - 650) generateBatch(generationToken);
  }
  async function generateBatch(token) {
    if (state.loading || !selectedCount()) return;
    const activeToken = token || generationToken;
    state.loading = true;
    render();
    try {
      const result = await bridge("generate", { topics: selectedTopics(), settings: state.settings, avoid: state.cards.slice(-20).map(function (card) { return card.title; }) });
      if (activeToken !== generationToken) return;
      const fresh = (result.cards || []).map(normalizeCard).filter(function (card) { return !state.cards.some(function (existing) { return existing.id === card.id; }); });
      state.cards = state.cards.concat(fresh);
      if (!fresh.length) showToast("No new facts arrived. Try again in a moment.");
    } catch (error) {
      if (activeToken !== generationToken) return;
      const fresh = demoBatch();
      if (fresh.length) {
        state.cards = state.cards.concat(fresh);
        showToast(state.key ? error.message : "Starter facts loaded. Add your Gemini key for a larger mix.");
      } else showToast(error.message || "Could not generate a new batch.");
    } finally {
      if (activeToken === generationToken) {
        state.loading = false;
        saveState();
        render();
      }
    }
  }
  async function testKey() {
    if (!state.key.trim()) return showToast("Paste your Gemini API key first.");
    state.geminiStatus = "testing";
    render();
    try {
      const result = await bridge("testGemini", { key: state.key.trim() });
      state.geminiStatus = result.status || "unavailable";
      showToast(result.message || "Gemini could not verify this key.");
    } catch (error) {
      state.geminiStatus = "unavailable";
      showToast(error.message);
    }
    render();
  }
  async function learnMore(id) {
    const card = state.cards.find(function (item) { return item.id === id; });
    if (!card || card.learnMore || state.loadingCard) return;
    state.loadingCard = id;
    state.errorByCard[id] = "";
    render();
    try {
      const result = await bridge("learn", { action: "learn", card: card });
      card.learnMore = result.answer;
      card.answerSources = result.citations || [];
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
    state.loadingCard = id;
    state.errorByCard[id] = "";
    render();
    try {
      const result = await bridge("learn", { action: "question", card: card, question: question, detailed: Boolean(card.answerDetailed), history: card.questionHistory || [] });
      card.question = question;
      card.answer = result.answer;
      card.answerSources = result.citations || [];
      card.questionHistory = (card.questionHistory || []).concat([{ role: "user", content: question }, { role: "assistant", content: card.answer }]);
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
    const topic = (card.topicPath || ["this topic"]).slice(-1)[0];
    const profile = state.profile[topic] || { heard: 0, unknown: 0, unknownStreak: 0, targetDifficulty: state.settings.obscurity };
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
    state.profile[topic] = profile;
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
  window.addEventListener("scroll", onScroll, { passive: true });
  hydrate();
})();
