// Generated from Website/lib/video-semantic.ts. Run node Website/scripts/build-native-video-search.mjs.
(function(scope){ const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_SEMANTIC_VERSION = void 0;
exports.normalizeVideoQuery = normalizeVideoQuery;
exports.makeLocalVideoPlan = makeLocalVideoPlan;
exports.mergeVideoSearchPlans = mergeVideoSearchPlans;
exports.eligibleSemanticVideo = eligibleSemanticVideo;
exports.videoConceptCoverage = videoConceptCoverage;
exports.semanticCoverage = semanticCoverage;
exports.compareSemanticCandidates = compareSemanticCandidates;
exports.searchSemanticVideos = searchSemanticVideos;
exports.searchSemanticVideosYielding = searchSemanticVideosYielding;
exports.VIDEO_SEMANTIC_VERSION = 4;
// Only equivalent phrases belong in a required group. Neighbouring subjects are not synonyms.
const CONCEPTS = [
    ["gravitational lensing", "bending starlight", "light bending", "bending light", "light bends", "gravity bends light", "bent light"],
    ["black holes", "black hole"], ["population", "human population", "demography", "population growth", "number of people"],
    ["plate tectonics", "moving plates", "continental drift", "moving continents"],
    ["earthquake", "earthquakes", "ground shaking", "shaking ground", "seismic activity"],
    ["volcano", "volcanoes", "volcanic eruption", "erupting mountain"],
    ["climate change", "global warming", "changing climate", "climate crisis", "rising global temperatures"],
    ["evolution", "natural selection", "how species change"],
    ["extinction", "extinct", "animals disappearing", "species dying out"],
    ["mass extinction", "mass extinctions", "great dying"],
    ["migration", "immigration", "people moving between countries"],
    ["urbanization", "urbanisation", "growth of cities", "growing cities"],
    ["inflation", "rising prices", "prices rising", "money losing value"],
    ["inequality", "wealth gap", "income inequality", "gap between rich and poor"],
    ["supply chain", "supply chains", "global supply networks"],
    ["colonialism", "colonization", "colonisation", "colonial rule"],
    ["democracy", "democratic government", "rule by the people"],
    ["election", "elections", "electoral", "voting"],
    ["border", "borders", "national boundaries", "country boundaries"],
    ["artificial intelligence", "ai", "machine intelligence"],
    ["machine learning", "computers learning", "computer learning"],
    ["renewable energy", "renewable power", "clean energy"],
    ["solar energy", "solar power", "power from sunlight"],
    ["neuroscience", "brain science", "how the brain works"],
    ["quantum mechanics", "quantum physics"],
    ["astronomy", "study of stars"], ["extraterrestrial life", "alien life", "life beyond earth"],
    ["big bang", "birth of the universe", "origin of the universe"],
    ["space exploration", "exploring space", "space travel"],
    ["ancient dna", "ancient genetics"], ["fossil", "fossils", "fossilized", "fossilised"],
    ["epidemic", "epidemics", "disease outbreak", "disease outbreaks"],
    ["pandemic", "pandemics", "global disease outbreak"],
    ["world war ii", "world war 2", "second world war", "wwii", "ww2"],
    ["world war i", "world war 1", "first world war", "wwi", "ww1"],
    ["cold war", "us soviet rivalry"], ["literature", "literary"],
    ["mathematics", "math", "maths"], ["probability", "chance", "likelihood"],
    ["photosynthesis", "plants turning sunlight into energy"],
    ["ocean currents", "ocean circulation"], ["biodiversity", "diversity of life"],
    ["telescope", "telescopes"], ["internet", "world wide web"],
];
const STOP = new Set("a an the and or of to in on at for by from with about is are was were be been do does did how why what when where which who can could would should me show explain tell learn understand video videos youtube work works happen happens happening affect affects effect effects really please more some something".split(" "));
function normalizeVideoQuery(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
const equivalentTerms = new Map(CONCEPTS.flatMap((terms) => terms.map((term) => [normalizeVideoQuery(term), terms])));
const aliases = CONCEPTS.flatMap((terms, id) => terms.map((term) => ({ term: normalizeVideoQuery(term), id }))).sort((a, b) => b.term.length - a.term.length);
function contains(text, phrase) { return (` ${text} `).includes(` ${phrase} `); }
function meaningful(value) { return normalizeVideoQuery(value).split(" ").filter((word) => !STOP.has(word) && (word.length > 2 || word === "ai" || /^\d+$/.test(word))); }
function expand(term) { const normalized = normalizeVideoQuery(term); return equivalentTerms.get(normalized) || [term]; }
function groupsFor(value) {
    let remaining = normalizeVideoQuery(value);
    const groups = [];
    const seen = new Set();
    for (const alias of aliases)
        if (contains(remaining, alias.term)) {
            if (!seen.has(alias.id)) {
                groups.push({ label: CONCEPTS[alias.id][0], terms: CONCEPTS[alias.id], required: true });
                seen.add(alias.id);
            }
            remaining = (` ${remaining} `).split(` ${alias.term} `).join(" ").trim();
        }
    for (const word of meaningful(remaining))
        groups.push({ label: word, terms: [word], required: true });
    return groups;
}
function makeLocalVideoPlan(query, channels = [], selectedChannelId) {
    let core = query;
    const plan = { terms: [], exclude: [], conceptGroups: [], channelId: selectedChannelId, sort: "relevance" };
    core = core.replace(/\b(?:without|excluding|exclude|not about)\s+(.+?)(?=\s+(?:uploaded|posted|published|under|over|from|by|without|excluding|exclude|not about)\b|[,;]|$)/gi, (_, phrase) => { plan.exclude.push(phrase.trim()); return " "; });
    // Dates without an upload cue remain content concepts (e.g. Europe after 1800).
    core = core.replace(/\b(?:uploaded|posted|published|released)\s+(after|since|before|in)\s+(\d{4})(?:-(\d{2})-(\d{2}))?/gi, (_, intent, year, month, day) => {
        const date = `${year}-${month || "01"}-${day || "01"}`;
        if (!Number.isFinite(Date.parse(date)))
            return _;
        plan.dateIntent = "upload";
        if (intent.toLowerCase() === "before") {
            const before = new Date(Date.parse(date) - 1).toISOString();
            plan.maxDate = plan.maxDate && plan.maxDate < before ? plan.maxDate : before;
        }
        else {
            const after = intent.toLowerCase() === "after" ? (month ? new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10) : `${Number(year) + 1}-01-01`) : date;
            plan.minDate = plan.minDate && plan.minDate > after ? plan.minDate : after;
        }
        if (intent.toLowerCase() === "in") {
            const end = `${date}T23:59:59.999Z`;
            const through = month ? end : `${year}-12-31T23:59:59.999Z`;
            plan.maxDate = plan.maxDate && plan.maxDate < through ? plan.maxDate : through;
        }
        return " ";
    });
    core = core.replace(/\b(?:uploaded|posted|published)\s+(?:within|in|during)\s+the\s+(?:last|past)\s+(week|month|year)\b/gi, (_, unit) => { plan.dateIntent = "upload"; const since = new Date(Date.now() - ({ week: 7, month: 31, year: 366 }[unit.toLowerCase()] || 7) * 86400000).toISOString().slice(0, 10); plan.minDate = plan.minDate && plan.minDate > since ? plan.minDate : since; return " "; });
    core = core.replace(/\b(under|below|shorter than|less than|over|above|longer than|more than)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi, (_, direction, amount, unit) => {
        const seconds = Number(amount) * (/^(hour|hr)/i.test(unit) ? 3600 : /^(min)/i.test(unit) ? 60 : 1);
        if (/^(under|below|shorter|less)/i.test(direction))
            plan.maxDurationSeconds = Math.min(plan.maxDurationSeconds ?? Infinity, Math.max(0, Math.ceil(seconds) - 1));
        else
            plan.minDurationSeconds = Math.max(plan.minDurationSeconds ?? 0, Math.floor(seconds) + 1);
        return " ";
    });
    const namedChannel = channels.find((channel) => [channel.name, channel.handle || ""].filter(Boolean).some((name) => contains(normalizeVideoQuery(core), normalizeVideoQuery(name))));
    if (namedChannel && /\b(from|by|channel)\b|@/i.test(core)) {
        if (selectedChannelId && selectedChannelId !== namedChannel.id)
            plan.channelId = "__conflicting_channel__";
        else
            plan.channelId = namedChannel.id;
        for (const name of [namedChannel.name, namedChannel.handle || ""].filter(Boolean))
            core = core.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
        core = core.replace(/\b(from|by|channel)\b/gi, " ");
    }
    if (!namedChannel && /(?:\bchannel\s+|@)[\w.-]+/i.test(core))
        plan.channelId = "__unknown_channel__";
    core = core.replace(/\b(newest|latest|oldest|earliest|random)\b/gi, (sort) => { plan.sort = /newest|latest/i.test(sort) ? "newest" : /oldest|earliest/i.test(sort) ? "oldest" : "random"; return " "; });
    const clauseGroups = (value) => {
        const quoted = [];
        const unquoted = value.replace(/"([^"\n]+)"/g, (_, phrase) => { quoted.push({ label: phrase, terms: [phrase], required: true }); return " "; });
        return [...groupsFor(unquoted), ...quoted];
    };
    const orParts = core.split(/\bor\b(?=(?:[^"]*"[^"]*")*[^"]*$)/i);
    if (orParts.length > 1) {
        const clauses = orParts.map(clauseGroups).filter(groups => groups.length);
        plan.conceptGroups = clauses.flat();
        let offset = 0;
        plan.anyOf = clauses.map(groups => { const ids = groups.map((_, i) => offset + i); offset += groups.length; return ids; });
    }
    else
        plan.conceptGroups = clauseGroups(core);
    plan.terms = [meaningful(core).join(" ")].filter(Boolean);
    return plan;
}
function mergeVideoSearchPlans(local, interpreted, _channels, selectedChannelId) {
    // Only locally parsed constraints may admit or reject videos. Model output is ranking data.
    return {
        ...local,
        channelId: selectedChannelId && local.channelId && selectedChannelId !== local.channelId ? "__conflicting_channel__" : selectedChannelId ?? local.channelId,
        terms: interpreted.terms ?? local.terms,
        include: interpreted.include ?? local.include,
        alternatives: interpreted.alternatives,
        topicHints: interpreted.topics,
        // The original query owns AND/OR structure; enrichment cannot make ideas optional.
        anyOf: local.anyOf,
        conceptGroups: local.anyOf?.length
            ? (local.conceptGroups || []).map(group => enrichVideoGroup(group, interpreted.conceptGroups || []))
            : preserveVideoConcepts(local.conceptGroups || [], interpreted.conceptGroups?.length ? interpreted.conceptGroups : [
                ...(interpreted.terms?.length === 1 ? [{ label: "subject", terms: [...interpreted.terms], required: true }] : interpreted.terms?.length ? makeLocalVideoPlan(interpreted.terms.join(" and ")).conceptGroups || [] : local.conceptGroups || []),
                ...(interpreted.include || []).map(term => ({ label: term, terms: expand(term), required: true }))
            ])
    };
}
function sameVideoConcept(a, b) {
    const terms = new Set(a.terms.flatMap(expand).map(normalizeVideoQuery));
    return b.terms.flatMap(expand).some(term => terms.has(normalizeVideoQuery(term)));
}
function enrichVideoGroup(group, enriched) {
    const matches = enriched.filter(other => sameVideoConcept(group, other));
    return { ...group, required: true, terms: [...new Set([...group.terms, ...matches.flatMap(other => other.terms).filter(term => { const known = equivalentTerms.get(normalizeVideoQuery(term)); return !known || known.some(value => group.terms.flatMap(expand).map(normalizeVideoQuery).includes(normalizeVideoQuery(value))); })])], related: matches.flatMap(other => other.related || []) };
}
function preserveVideoConcepts(local, enriched) {
    const protectedGroups = local.filter(group => CONCEPTS.some(terms => terms[0] === group.label));
    return [
        ...enriched.filter(group => !protectedGroups.some(original => sameVideoConcept(original, group))).map(group => ({ ...group, required: true })),
        ...protectedGroups.map(group => enrichVideoGroup(group, enriched))
    ];
}
const index = new WeakMap();
const BOILERPLATE = /\b(subscribe|patreon|sponsor(?:ed)?|affiliate|merch|use code|follow (?:me|us)|support (?:me|us|the channel)|buy (?:my|our))\b/i;
function cleanDescription(value) { return value.split(/\n+|(?<=[.!?])\s+/).filter((part) => !BOILERPLATE.test(part)).join(" ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000); }
function fieldsFor(video) {
    const cached = index.get(video);
    if (cached)
        return cached;
    const fields = [["title", video.title], ["tags", (video.tags || []).join(", ")], ["description", cleanDescription(video.description || "")], ["topics", (video.topics || []).join(" ")]].map(([name, value]) => ({ name, value, text: normalizeVideoQuery(value), words: new Set(normalizeVideoQuery(value).split(" ")) }));
    index.set(video, fields);
    return fields;
}
function hasPrefix(words, word) { for (const candidate of words)
    if (candidate.length >= 5 && Math.abs(candidate.length - word.length) <= 2 && (candidate.startsWith(word) || word.startsWith(candidate)))
        return true; return false; }
function matchesTerm(term, field) {
    const text = normalizeVideoQuery(term);
    if (!text)
        return false;
    if (contains(field.text, text))
        return true;
    const words = meaningful(text);
    return words.length > 0 && words.every((word) => field.words.has(word) || (word.length >= 5 && hasPrefix(field.words, word)));
}
function passage(field, term) {
    const sentences = field.name === "description" ? field.value.split(/(?<=[.!?])\s+/) : [field.value];
    const matching = sentences.find((value) => matchesTerm(term, { ...field, text: normalizeVideoQuery(value), words: new Set(normalizeVideoQuery(value).split(" ")) }));
    const value = matching || field.value;
    const words = meaningful(term);
    const hit = value.toLowerCase().indexOf(words[0] || term.toLowerCase());
    const start = value.length > 320 && hit > 240 ? Math.max(0, hit - 80) : 0;
    return value.slice(start, start + 320);
}
function requiredGroups(plan) {
    if (plan.conceptGroups?.length)
        return [...plan.conceptGroups, ...(plan.include || []).filter((term) => !plan.conceptGroups.some((group) => group.terms.some((variant) => normalizeVideoQuery(variant) === normalizeVideoQuery(term)))).map((term) => ({ terms: expand(term), required: true }))];
    return [...(plan.terms || []).map(term => ({ terms: expand(term), required: true })), ...(plan.include || []).map((term) => ({ terms: expand(term), required: true }))];
}
function eligibleSemanticVideo(video, plan, topic = "All", selectedChannelId, excludedIds = new Set()) {
    if (!video.approved || excludedIds.has(video.id) || /#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(video.title) || /#shorts?\b/i.test(video.description || "") || (video.tags || []).some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalizeVideoQuery(tag))))
        return false;
    if ((video.channelId === "UCYO_jab_esuFRV4b17AJtAw" || normalizeVideoQuery(video.channelName) === "3blue1brown") && !video.special && !(video.sourceIds || []).some((id) => ["PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi", "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy"].includes(id.replace(/^playlist:/, ""))))
        return false;
    if (selectedChannelId && video.channelId !== selectedChannelId || plan.channelId && video.channelId !== plan.channelId)
        return false;
    if (topic !== "All" && !(video.topics || []).includes(topic))
        return false;
    if (plan.topics?.length && !(video.topics || []).some((topic) => plan.topics.some((value) => normalizeVideoQuery(value) === normalizeVideoQuery(topic))))
        return false;
    if (plan.minDate || plan.maxDate) {
        const uploaded = Date.parse(video.publishedAt);
        if (!Number.isFinite(uploaded) || plan.minDate && uploaded < Date.parse(plan.minDate) || plan.maxDate && uploaded > Date.parse(plan.maxDate))
            return false;
    }
    if ((plan.minDurationSeconds !== undefined || plan.maxDurationSeconds !== undefined) && !Number.isFinite(video.durationSeconds))
        return false;
    if (plan.minDurationSeconds !== undefined && video.durationSeconds < plan.minDurationSeconds || plan.maxDurationSeconds !== undefined && video.durationSeconds > plan.maxDurationSeconds)
        return false;
    const fields = fieldsFor(video);
    return !(plan.exclude || []).some((term) => expand(term).some((variant) => fields.some((field) => matchesTerm(variant, field))));
}
function coverageFor(groups, matchedConcepts, anyOf) {
    const matched = new Set(matchedConcepts);
    const required = groups.flatMap((group, i) => group.required !== false && group.terms.length ? [i] : []);
    const clauses = anyOf?.length ? anyOf.map(clause => [...clause.filter(i => groups[i]?.required !== false), ...required.filter(i => !anyOf.some(c => c.includes(i)))]) : [required];
    const missing = clauses.map(clause => clause.filter(i => !matched.has(i))).sort((a, b) => a.length - b.length)[0] || [];
    return { matchedConcepts, missingConcepts: missing, complete: !missing.length };
}
function videoConceptCoverage(video, plan) {
    const fields = fieldsFor(video), groups = requiredGroups(plan);
    const matched = groups.flatMap((group, i) => group.terms.flatMap(expand).some(term => fields.filter(field => field.name !== "topics").some(field => matchesTerm(term, field))) ? [i] : []);
    return coverageFor(groups, matched, plan.anyOf);
}
function semanticCoverage(video, plan) {
    return requiredGroups(plan).length > 0 && videoConceptCoverage(video, plan).complete;
}
function compareSemanticCandidates(a, b, sort) {
    if (sort === "newest")
        return b.video.publishedAt.localeCompare(a.video.publishedAt) || b.score - a.score;
    if (sort === "oldest")
        return a.video.publishedAt.localeCompare(b.video.publishedAt) || b.score - a.score;
    return b.score - a.score;
}
function searchSemanticVideos(videos, plan, topic = "All", channelId, limit = 80, excluded = []) {
    const excludedIds = new Set(excluded), groups = requiredGroups(plan).map((group) => ({ ...group, terms: [...new Set(group.terms.slice(0, 12).flatMap(expand))] }));
    const related = [...(plan.alternatives || []), ...groups.flatMap(group => group.related || [])].slice(0, 96);
    const results = [];
    for (const video of videos) {
        if (!eligibleSemanticVideo(video, plan, topic, channelId, excludedIds))
            continue;
        const fields = fieldsFor(video), evidence = [];
        const matchedConcepts = [];
        for (const [groupIndex, group] of groups.entries()) {
            const matches = group.terms.flatMap((term) => fields.filter((field) => field.name !== "topics" && matchesTerm(term, field)).map((field) => ({ field, term, score: field.name === "title" ? 20 : field.name === "tags" ? 12 : 8 })));
            matches.sort((a, b) => b.score - a.score);
            if (matches.length) {
                evidence.push(matches[0]);
                matchedConcepts.push(groupIndex);
            }
        }
        const filterOnly = !groups.length && Boolean(plan.channelId || channelId || topic !== "All" || plan.minDate || plan.maxDate || plan.minDurationSeconds !== undefined || plan.maxDurationSeconds !== undefined || plan.sort && plan.sort !== "relevance");
        const coverage = coverageFor(groups, matchedConcepts, plan.anyOf);
        if (!coverage.complete || !evidence.length && !filterOnly)
            continue;
        const title = fields[0].text;
        const exactTitle = (plan.terms || []).some((term) => contains(title, normalizeVideoQuery(term)));
        const relatedBonus = Math.min(3, related.filter(term => fields.some(field => matchesTerm(term, field))).length);
        const hint = (video.topics || []).some((topic) => (plan.topicHints || []).includes(topic));
        results.push({ video, coverage, score: 100 * evidence.length + evidence.reduce((sum, item) => sum + item.score, 0) + (exactTitle ? 10 : 0) + (hint ? 1 : 0) + relatedBonus, matchedFields: [...new Set(evidence.map((item) => item.field.name))], supportingText: [...new Set(evidence.map((item) => passage(item.field, item.term)))].slice(0, 3) });
    }
    return results.sort((a, b) => compareSemanticCandidates(a, b, plan.sort)).slice(0, Math.max(1, limit));
}
async function searchSemanticVideosYielding(videos, plan, topic = "All", channelId, limit = 80, excluded = [], signal) {
    const matches = [];
    for (let start = 0; start < videos.length; start += 160) {
        if (signal?.aborted)
            throw new DOMException("Search canceled", "AbortError");
        matches.push(...searchSemanticVideos(videos.slice(start, start + 160), plan, topic, channelId, limit, excluded));
        if (start + 160 < videos.length)
            await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (signal?.aborted)
        throw new DOMException("Search canceled", "AbortError");
    return matches.sort((a, b) => compareSemanticCandidates(a, b, plan.sort)).slice(0, limit);
}

scope.LEARNED_MEDIA_VIDEO_SEARCH = exports; })(globalThis);
