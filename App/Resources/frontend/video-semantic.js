// Generated from Website/lib/video-semantic.ts. Run node Website/scripts/build-native-video-search.mjs.
(function(scope){ const search = {}; (function(exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSearchText = normalizeSearchText;
exports.searchTextForms = searchTextForms;
exports.commonNameAliases = commonNameAliases;
exports.contextualSearchText = contextualSearchText;
exports.protectedSearchTerms = protectedSearchTerms;
exports.shouldExpandNaturalSearch = shouldExpandNaturalSearch;
exports.tokenizeSearchQuery = tokenizeSearchQuery;
exports.tokenizeSearchDocument = tokenizeSearchDocument;
exports.searchScoreNormalized = searchScoreNormalized;
exports.searchScore = searchScore;
exports.rankSearchResults = rankSearchResults;
/** Small, deterministic fuzzy matching helpers used by the local search UI. */
function foldSearchText(value, preserveHyphens = false) {
    const folded = value.replace(/[\u2010-\u2015\u2212]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`]/g, "").replace(preserveHyphens ? /[^a-z0-9\u0080-\uFFFF-]+/g : /[^a-z0-9\u0080-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();
    return folded;
}
function normalizeSearchText(value) { return foldSearchText(value); }
/** Retain the compound spelling as well as its spaced search equivalent. */
function searchTextForms(value) {
    return [...new Set([foldSearchText(value, true), normalizeSearchText(value)])];
}
// Alternate spellings are search metadata, never additional catalog nodes.
const NAME_VARIANTS = [
    ["Fyodor Dostoevsky", "Fyodor Dostoyevsky", "Dostoevsky", "Dostoyevsky"],
    ["J.R.R. Tolkien", "J. R. R. Tolkien", "JRR Tolkien", "Tolkien"]
];
const nameKey = (value) => normalizeSearchText(value).replace(/\s/g, "");
const nameVariants = new Map(NAME_VARIANTS.flatMap(variants => variants.map(name => [nameKey(name), variants])));
function commonNameAliases(label) {
    return (nameVariants.get(nameKey(label)) ?? []).filter(name => name !== label);
}
const SHORT_ALIASES = {
    us: { expansion: "united states", context: /\b(?:united states|american|presidents?|congress|senate|constitution|elections?|politics|political|history|government|states|federal)\b/ },
    ai: { expansion: "artificial intelligence", context: /\b(?:artificial|intelligence|machine|learning|neural|models?|robots?|robotics|generative|algorithms?|computers?|automation|chatbots?|tools|ethics)\b/ },
    it: { expansion: "information technology", context: /\b(?:information|technology|computers?|networks?|networking|software|hardware|cybersecurity|security|support|infrastructure|systems|services|jobs|careers|departments?)\b/ }
};
/** Case alone is not disambiguation: require nearby domain words, not pronoun syntax. */
function contextualSearchText(value) {
    const text = foldSearchText(value, true);
    return text.replace(/\b(?:us|ai|it)\b/g, (token, offset) => {
        const alias = SHORT_ALIASES[token];
        const before = normalizeSearchText(text.slice(0, offset)).split(" ").slice(-3).join(" ");
        const after = normalizeSearchText(text.slice(offset + token.length)).split(" ").slice(0, 3).join(" ");
        if (token === "us" && (/\b(?:tell|show|teach|help|give|let|ask|makes?|made) us$/.test(before + " us") || /^(?:about|how|why|what|when|where|who|to|with|the|a|an)\b/.test(after)))
            return "";
        if (token === "it" && (/\b(?:does|did|do|is|was|were|can|could|will|would|has|have|had) it$/.test(before + " it") || /^(?:is|was|does|did|can|will|would|has|seems|means|works)\b/.test(after)))
            return "";
        return alias.context.test(before + " " + after) ? alias.expansion : "";
    }).replace(/\s+/g, " ").trim();
}
const compoundCache = new Map();
/** Keep prefixes and short components together before stop-word filtering. */
function protectedSearchTerms(value) {
    const cached = compoundCache.get(value);
    if (cached)
        return cached;
    const original = foldSearchText(value, true);
    const spaced = normalizeSearchText(value);
    const compounds = [...original.matchAll(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/g)].map(match => normalizeSearchText(match[0]));
    const variants = [...spaced.matchAll(/\b(?:x ray|(?:non|post|pre|anti|pro|neo) [a-z0-9]+)\b/g)].map(match => match[0]);
    const terms = [...new Set([...compounds, ...variants])].sort((a, b) => b.length - a.length);
    if (compoundCache.size >= 500)
        compoundCache.delete(compoundCache.keys().next().value);
    compoundCache.set(value, terms);
    return terms;
}
const NATURAL_SEARCH_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "how", "i", "in", "into", "is", "it", "of", "on", "or", "the", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with", "explain", "find", "show", "tell", "please", "me", "learn", "understand", "video", "videos", "topics"]);
/** Coverage is authoritative: one complete match beats any number of weak recommendations. */
function shouldExpandNaturalSearch(query, completeCoverage = false) {
    if (completeCoverage)
        return false;
    const contentWords = normalizeSearchText(query).split(" ").filter(word => word.length > 1 && !NATURAL_SEARCH_STOP_WORDS.has(word));
    return contentWords.length >= 2;
}
function distance(left, right, maxDistance) {
    if (left === right)
        return 0;
    if (Math.abs(left.length - right.length) > maxDistance)
        return maxDistance + 1;
    if (left.length > right.length)
        [left, right] = [right, left];
    if (!left.length)
        return right.length;
    const infinity = maxDistance + 1;
    const width = right.length + 1;
    let previous = new Uint32Array(width);
    let current = new Uint32Array(width);
    previous.fill(infinity);
    previous[0] = 0;
    for (let column = 1; column <= Math.min(right.length, maxDistance); column += 1)
        previous[column] = column;
    for (let row = 1; row <= left.length; row += 1) {
        const firstColumn = Math.max(1, row - maxDistance);
        const lastColumn = Math.min(right.length, row + maxDistance);
        current[0] = row <= maxDistance ? row : infinity;
        if (firstColumn > 1)
            current[firstColumn - 1] = infinity;
        let rowMinimum = current[0];
        for (let column = firstColumn; column <= lastColumn; column += 1) {
            const value = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
            current[column] = Math.min(value, infinity);
            rowMinimum = Math.min(rowMinimum, current[column]);
        }
        if (lastColumn < right.length)
            current[lastColumn + 1] = infinity;
        if (rowMinimum > maxDistance)
            return infinity;
        [previous, current] = [current, previous];
    }
    return previous[right.length];
}
function tokenScore(queryToken, textToken) {
    if (queryToken === textToken)
        return 20;
    if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken))
        return 13;
    const limit = queryToken.length >= 8 ? 2 : 1;
    return queryToken.length >= 4 && textToken.length >= 4 && distance(queryToken, textToken, limit) <= limit ? 7 : 0;
}
/** Tokenize a normalized query once before scoring it against many documents. */
function tokenizeSearchQuery(normalizedQuery) {
    return normalizedQuery.split(" ").filter((token) => token.length > 1);
}
/** Cache document tokens alongside its normalized string when indexing it. */
function tokenizeSearchDocument(normalizedText) {
    return normalizedText.split(" ").filter(Boolean);
}
function searchScoreNormalized(normalizedQuery, normalizedText, preparedQueryTokens, preparedTextTokens) {
    if (!normalizedQuery || !normalizedText)
        return 0;
    if (normalizedText.includes(normalizedQuery))
        return 100 + normalizedQuery.length;
    const queryTokens = preparedQueryTokens ?? tokenizeSearchQuery(normalizedQuery);
    const textTokens = preparedTextTokens ?? tokenizeSearchDocument(normalizedText);
    if (!queryTokens.length)
        return 0;
    let score = 0;
    let matched = 0;
    queryTokens.forEach((queryToken) => {
        const best = Math.max(...textTokens.map((textToken) => tokenScore(queryToken, textToken)), 0);
        if (best > 0) {
            matched += 1;
            score += best;
        }
    });
    if (!matched)
        return 0;
    const coverage = matched / queryTokens.length;
    if (coverage < (queryTokens.length > 1 ? 0.5 : 1))
        return 0;
    return score * coverage + (matched === queryTokens.length ? 12 : 0);
}
function searchScore(query, text) {
    return searchScoreNormalized(normalizeSearchText(query), normalizeSearchText(text));
}
function rankSearchResults(query, items, getText, limit = items.length) {
    return items
        .map((item, index) => ({ item, index, score: searchScore(query, getText(item)) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .slice(0, limit)
        .map((entry) => entry.item);
}

})(search); const require = name => name.includes('background-work') ? scope.LEARNED_MEDIA_BACKGROUND : search; const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_SEARCH_MAX_CHUNK_SIZE = exports.SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE = exports.SEMANTIC_SEARCH_MIN_CHUNK_SIZE = exports.SEMANTIC_SEARCH_SLICE_BUDGET_MS = exports.PreparedVideoSearchCache = exports.VIDEO_SEARCH_INDEX_FORMAT = exports.VIDEO_SEMANTIC_VERSION = exports.MAX_VIDEO_SEARCH_RESULT_LIMIT = exports.VIDEO_SEARCH_TOPICS = void 0;
exports.isValidVideoSearchRequest = isValidVideoSearchRequest;
exports.videoSearchCatalogFingerprint = videoSearchCatalogFingerprint;
exports.serializeVideoSearchIndex = serializeVideoSearchIndex;
exports.restoreVideoSearchIndex = restoreVideoSearchIndex;
exports.validateVideoSearchCatalogUpdate = validateVideoSearchCatalogUpdate;
exports.indexVideoSearchMetadata = indexVideoSearchMetadata;
exports.normalizeVideoQuery = normalizeVideoQuery;
exports.makeLocalVideoPlan = makeLocalVideoPlan;
exports.mergeVideoSearchPlans = mergeVideoSearchPlans;
exports.prepareSemanticVideoSearch = prepareSemanticVideoSearch;
exports.eligibleSemanticVideo = eligibleSemanticVideo;
exports.videoConceptCoverage = videoConceptCoverage;
exports.semanticCoverage = semanticCoverage;
exports.compareSemanticCandidates = compareSemanticCandidates;
exports.insertBoundedRanked = insertBoundedRanked;
exports.nextSemanticSearchChunkSize = nextSemanticSearchChunkSize;
exports.searchPreparedSemanticVideos = searchPreparedSemanticVideos;
exports.searchSemanticVideos = searchSemanticVideos;
exports.searchSemanticVideosYielding = searchSemanticVideosYielding;
exports.searchPreparedSemanticVideosYielding = searchPreparedSemanticVideosYielding;
exports.videoSearchReason = videoSearchReason;
exports.shouldEnrichVideoSearch = shouldEnrichVideoSearch;
const search_1 = require("./search");
const background_work_1 = require("./background-work");
exports.VIDEO_SEARCH_TOPICS = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"];
exports.MAX_VIDEO_SEARCH_RESULT_LIMIT = 10_000;
const MAX_VIDEO_SEARCH_QUERY_LENGTH = 4_096;
const MAX_VIDEO_SEARCH_FILTER_TEXT_LENGTH = 512;
const MAX_VIDEO_SEARCH_FILTER_ITEMS = 256;
const MAX_VIDEO_SEARCH_EXCLUDED_IDS = 100_000;
const VIDEO_SEARCH_PLAN_FIELDS = new Set(["terms", "include", "alternatives", "exclude", "topics", "topicHints", "conceptGroups", "anyOf", "channel", "channelId", "dateIntent", "minDate", "maxDate", "minDurationSeconds", "maxDurationSeconds", "sort"]);
const VIDEO_SEARCH_LIST_FIELDS = ["terms", "include", "alternatives", "exclude", "topics", "topicHints"];
const VIDEO_SEARCH_CONCEPT_GROUP_FIELDS = new Set(["label", "terms", "related", "required"]);
const VIDEO_SEARCH_CHANNEL_FIELDS = ["channel", "channelId"];
const VIDEO_SEARCH_DATE_FIELDS = ["minDate", "maxDate"];
const VIDEO_SEARCH_DURATION_FIELDS = ["minDurationSeconds", "maxDurationSeconds"];
const VIDEO_SEARCH_DATE_INTENTS = new Set(["upload", "event", "either"]);
const VIDEO_SEARCH_SORTS = new Set(["relevance", "newest", "oldest", "random"]);
function isRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.prototype.toString.call(value) !== "[object Object]")
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function isBoundedString(value, maximum = MAX_VIDEO_SEARCH_FILTER_TEXT_LENGTH) {
    return typeof value === "string" && value.length <= maximum;
}
function isStringList(value, maximumItems = MAX_VIDEO_SEARCH_FILTER_ITEMS) {
    return Array.isArray(value) && value.length <= maximumItems && value.every(item => isBoundedString(item));
}
function isVideoSearchPlan(value) {
    if (!isRecord(value))
        return false;
    if (Object.keys(value).some(field => !VIDEO_SEARCH_PLAN_FIELDS.has(field)))
        return false;
    for (const field of VIDEO_SEARCH_LIST_FIELDS) {
        if (value[field] !== undefined && !isStringList(value[field]))
            return false;
    }
    if (value.conceptGroups !== undefined) {
        if (!Array.isArray(value.conceptGroups) || value.conceptGroups.length > 64)
            return false;
        for (const group of value.conceptGroups) {
            if (!isRecord(group) || Object.keys(group).some(field => !VIDEO_SEARCH_CONCEPT_GROUP_FIELDS.has(field))
                || !isStringList(group.terms, 64) || group.terms.length === 0
                || group.label !== undefined && !isBoundedString(group.label)
                || group.related !== undefined && !isStringList(group.related, 128)
                || group.required !== undefined && typeof group.required !== "boolean")
                return false;
        }
    }
    if (value.anyOf !== undefined) {
        const conceptGroupCount = Array.isArray(value.conceptGroups) ? value.conceptGroups.length : -1;
        if (!Array.isArray(value.anyOf) || value.anyOf.length > 64 || conceptGroupCount < 0)
            return false;
        for (const clause of value.anyOf) {
            if (!Array.isArray(clause) || clause.length === 0 || clause.length > 64
                || !clause.every(index => Number.isSafeInteger(index) && index >= 0 && index < conceptGroupCount))
                return false;
        }
    }
    for (const field of VIDEO_SEARCH_CHANNEL_FIELDS)
        if (value[field] !== undefined && !isBoundedString(value[field], 256))
            return false;
    if (value.dateIntent !== undefined && !VIDEO_SEARCH_DATE_INTENTS.has(value.dateIntent))
        return false;
    for (const field of VIDEO_SEARCH_DATE_FIELDS) {
        if (value[field] !== undefined && (!isBoundedString(value[field], 64) || !Number.isFinite(Date.parse(value[field]))))
            return false;
    }
    if (value.minDate && value.maxDate && Date.parse(value.minDate) > Date.parse(value.maxDate))
        return false;
    for (const field of VIDEO_SEARCH_DURATION_FIELDS) {
        if (value[field] !== undefined && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0))
            return false;
    }
    if (typeof value.minDurationSeconds === "number" && typeof value.maxDurationSeconds === "number" && value.minDurationSeconds > value.maxDurationSeconds)
        return false;
    if (value.sort !== undefined && !VIDEO_SEARCH_SORTS.has(value.sort))
        return false;
    return true;
}
/** Validate a worker search payload before it allocates filters or starts ranking. */
function isValidVideoSearchRequest(value) {
    if (!isRecord(value) || value.type !== "search"
        || !Number.isSafeInteger(value.requestId) || value.requestId < 0
        || !Number.isSafeInteger(value.revision) || value.revision < 0
        || !isBoundedString(value.query, MAX_VIDEO_SEARCH_QUERY_LENGTH)
        || !isVideoSearchPlan(value.plan)
        || value.topic !== "All" && !exports.VIDEO_SEARCH_TOPICS.includes(value.topic)
        || !Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > exports.MAX_VIDEO_SEARCH_RESULT_LIMIT
        || value.channelId !== undefined && !isBoundedString(value.channelId, 256)
        || value.excludedIds !== undefined && !isStringList(value.excludedIds, MAX_VIDEO_SEARCH_EXCLUDED_IDS)
        || value.expanded !== undefined && typeof value.expanded !== "boolean"
        || value.viewKey !== undefined && !isBoundedString(value.viewKey, 1_024))
        return false;
    return true;
}
exports.VIDEO_SEMANTIC_VERSION = 9;
exports.VIDEO_SEARCH_INDEX_FORMAT = 1;
async function searchIndexDigest(value) {
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
/** Bound temporary serialization while hashing every source field and its order. */
async function videoSearchCatalogFingerprint(videos, signal) {
    const parts = [];
    for (let start = 0; start < videos.length; start += 512) {
        const material = await (0, background_work_1.runBackgroundSlice)(() => JSON.stringify(videos.slice(start, start + 512).map(video => [
            video.id, video.channelId, video.channelName, video.title, video.description, video.tags, video.topics,
            video.publishedAt, video.durationSeconds, video.approved, video.special ?? null, video.sourceIds ?? null,
        ])), { priority: "background", canPause: true, signal });
        parts.push(await searchIndexDigest(material));
    }
    if (signal?.aborted)
        throw signal.reason;
    return searchIndexDigest(JSON.stringify([exports.VIDEO_SEARCH_INDEX_FORMAT, exports.VIDEO_SEMANTIC_VERSION, videos.length, parts]));
}
async function storedSearchIndexDigest(records, signal) {
    const parts = [];
    for (let start = 0; start < records.length; start += 512) {
        const material = await (0, background_work_1.runBackgroundSlice)(() => JSON.stringify(records.slice(start, start + 512)), { priority: "background", canPause: true, signal });
        parts.push(await searchIndexDigest(material));
    }
    if (signal?.aborted)
        throw signal.reason;
    return searchIndexDigest(JSON.stringify([exports.VIDEO_SEARCH_INDEX_FORMAT, exports.VIDEO_SEMANTIC_VERSION, records.length, parts]));
}
/** Store only reproducible search data, never a second copy of video records. */
async function serializeVideoSearchIndex(videos, fingerprint, signal) {
    const records = [];
    await (0, background_work_1.forEachBackground)(videos, video => {
        records.push({ id: video.id, normalizedChannelName: video.normalizedChannelName,
            fields: video.searchFields.map(({ name, text }) => ({ name, text })) });
    }, signal);
    return { format: exports.VIDEO_SEARCH_INDEX_FORMAT, policy: exports.VIDEO_SEMANTIC_VERSION, catalogFingerprint: fingerprint,
        savedAt: Date.now(), records, digest: await storedSearchIndexDigest(records, signal) };
}
/** All-or-nothing reuse: originals own membership, filters, order and provenance. */
async function restoreVideoSearchIndex(videos, value, fingerprint, signal) {
    if (!isRecord(value) || value.format !== exports.VIDEO_SEARCH_INDEX_FORMAT || value.policy !== exports.VIDEO_SEMANTIC_VERSION
        || value.catalogFingerprint !== fingerprint || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)
        || value.savedAt > Date.now() + 60_000 || Date.now() - value.savedAt > 7 * 24 * 60 * 60 * 1000
        || typeof value.digest !== "string" || !Array.isArray(value.records) || value.records.length !== videos.length)
        return;
    const records = value.records;
    let valid = true;
    await (0, background_work_1.forEachBackground)(records, (record, index) => {
        if (!isRecord(record) || record.id !== videos[index].id || typeof record.normalizedChannelName !== "string"
            || !Array.isArray(record.fields) || record.fields.length !== 4) {
            valid = false;
            return false;
        }
        const names = ["title", "tags", "description", "topics"];
        if (record.fields.some((field, index) => !isRecord(field) || field.name !== names[index]
            || typeof field.text !== "string")) {
            valid = false;
            return false;
        }
    }, signal);
    if (!valid || await storedSearchIndexDigest(records, signal) !== value.digest)
        return;
    const restored = new Map();
    await (0, background_work_1.forEachBackground)(videos, (video, index) => {
        const record = records[index];
        const values = searchFieldValues(video);
        restored.set(video.id, { ...video, normalizedChannelName: record.normalizedChannelName,
            specialPlaylistEligible: computeSpecialPlaylistEligibility(video, record.normalizedChannelName),
            searchFields: record.fields.map((field, index) => ({ ...field, value: values[index][1], words: new Set(field.text.split(" ")) })) });
    }, signal);
    return restored;
}
const RESTRICTED_PLAYLIST_CHANNEL_ID = "UCYO_jab_esuFRV4b17AJtAw";
const APPROVED_3BLUE_PLAYLIST_IDS = new Set([
    "PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi",
    "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy",
]);
function computeSpecialPlaylistEligibility(video, normalizedChannelName = normalizeVideoQuery(video.channelName)) {
    const restrictedChannel = video.channelId === RESTRICTED_PLAYLIST_CHANNEL_ID || normalizedChannelName === "3blue1brown";
    return !restrictedChannel || Boolean(video.special) || (video.sourceIds || []).some((id) => APPROVED_3BLUE_PLAYLIST_IDS.has(id.replace(/^playlist:/, "")));
}
/** Validate a whole worker update before touching its published catalog. */
function validateVideoSearchCatalogUpdate(revision, documents, removeIds = [], orderIds) {
    const strings = (value) => Array.isArray(value) && value.every(item => typeof item === "string");
    if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(documents) || !strings(removeIds) || (orderIds !== undefined && !strings(orderIds)))
        throw new Error("Invalid video catalog update.");
    for (const video of documents) {
        if (!video || typeof video.id !== "string" || !video.id.length
            || ![video.channelId, video.channelName, video.title, video.description, video.publishedAt].every(value => typeof value === "string")
            || !strings(video.tags) || !strings(video.topics) || typeof video.approved !== "boolean"
            || !Number.isFinite(video.durationSeconds) || video.durationSeconds < 0
            || (video.special !== undefined && typeof video.special !== "boolean")
            || (video.sourceIds !== undefined && !strings(video.sourceIds)))
            throw new Error("Invalid video search document.");
    }
}
/** Add worker-only eligibility metadata without changing or dropping provenance. */
function sameStringList(left, right) {
    const a = left || [], b = right || [];
    return a.length === b.length && a.every((value, index) => value === b[index]);
}
function sameSearchTextFields(previous, next) {
    return previous.title === next.title && previous.description === next.description
        && sameStringList(previous.tags, next.tags) && sameStringList(previous.topics, next.topics);
}
function indexVideoSearchMetadata(video, previous) {
    const normalizedChannelName = previous?.channelName === video.channelName
        ? previous.normalizedChannelName
        : normalizeVideoQuery(video.channelName);
    const searchFields = previous && sameSearchTextFields(previous, video) ? previous.searchFields : createSearchFields(video, previous?.searchFields);
    return { ...video, specialPlaylistEligible: computeSpecialPlaylistEligibility(video, normalizedChannelName), normalizedChannelName, searchFields };
}
function hasEligibleSpecialPlaylist(video) {
    return typeof video.specialPlaylistEligible === "boolean" ? video.specialPlaylistEligible : computeSpecialPlaylistEligibility(video);
}
function immutablePlan(plan) {
    const input = { ...plan };
    const snapshot = {
        ...input,
        terms: input.terms ? [...input.terms] : undefined,
        include: input.include ? [...input.include] : undefined,
        alternatives: input.alternatives ? [...input.alternatives] : undefined,
        exclude: input.exclude ? [...input.exclude] : undefined,
        topics: input.topics ? [...input.topics] : undefined,
        topicHints: input.topicHints ? [...input.topicHints] : undefined,
        conceptGroups: input.conceptGroups?.map(group => ({ ...group, terms: [...group.terms], related: group.related ? [...group.related] : undefined })),
        anyOf: input.anyOf?.map(clause => [...clause]),
    };
    for (const value of [snapshot.terms, snapshot.include, snapshot.alternatives, snapshot.exclude, snapshot.topics, snapshot.topicHints, snapshot.anyOf]) {
        if (value) {
            if (Array.isArray(value))
                for (const item of value)
                    if (Array.isArray(item))
                        Object.freeze(item);
            Object.freeze(value);
        }
    }
    for (const group of snapshot.conceptGroups ?? []) {
        Object.freeze(group.terms);
        if (group.related)
            Object.freeze(group.related);
        Object.freeze(group);
    }
    if (snapshot.conceptGroups)
        Object.freeze(snapshot.conceptGroups);
    return Object.freeze(snapshot);
}
function stableSearchKey(value) {
    if (Array.isArray(value))
        return `[${value.map(stableSearchKey).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableSearchKey(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "undefined";
}
/** A small per-search cache so chunking and pagination reuse the same compiled filters. */
class PreparedVideoSearchCache {
    maxEntries;
    entries = new Map();
    revision;
    scope;
    constructor(maxEntries = 4) {
        this.maxEntries = maxEntries;
    }
    get(plan, topic = "All", channelId, catalogRevision = 0, scope = "") {
        if (this.revision !== catalogRevision || this.scope !== scope) {
            this.entries.clear();
            this.revision = catalogRevision;
            this.scope = scope;
        }
        const key = stableSearchKey([exports.VIDEO_SEMANTIC_VERSION, catalogRevision, scope, plan, topic, channelId]);
        const cached = this.entries.get(key);
        if (cached) {
            this.entries.delete(key);
            this.entries.set(key, cached);
            return cached;
        }
        const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
        if (this.maxEntries > 0) {
            this.entries.set(key, prepared);
            while (this.entries.size > this.maxEntries)
                this.entries.delete(this.entries.keys().next().value);
        }
        return prepared;
    }
    clear() { this.entries.clear(); }
    get size() { return this.entries.size; }
}
exports.PreparedVideoSearchCache = PreparedVideoSearchCache;
// Only equivalent phrases belong in a required group. Neighbouring subjects are not synonyms.
const CONCEPTS = [
    ["united states", "usa", "american"], ["information technology", "computer technology"],
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
    ["artificial intelligence", "machine intelligence"],
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
function normalizeVideoQuery(value) { return String(value || "").replace(/[\u2010-\u2015\u2212]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
const equivalentTerms = new Map(CONCEPTS.flatMap((terms) => terms.map((term) => [normalizeVideoQuery(term), terms])));
const aliases = CONCEPTS.flatMap((terms, id) => terms.map((term) => ({ term: normalizeVideoQuery(term), id }))).sort((a, b) => b.term.length - a.term.length);
function contains(text, phrase) { return (` ${text} `).includes(` ${phrase} `); }
function meaningful(value) { return normalizeVideoQuery(value).split(" ").filter((word) => !STOP.has(word) && (word.length > 2 || word === "ai" || /^\d+$/.test(word))); }
function expand(term) { const normalized = normalizeVideoQuery(term); return equivalentTerms.get(normalized) || [term]; }
function groupsFor(value) {
    value = (0, search_1.contextualSearchText)(value);
    let remaining = normalizeVideoQuery(value);
    const groups = [];
    for (const term of (0, search_1.protectedSearchTerms)(value)) {
        groups.push({ label: term, terms: [term], required: true });
        remaining = (` ${remaining} `).split(` ${term} `).join(" ").trim();
    }
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
const BOILERPLATE = /\b(subscribe|patreon|sponsor(?:ed)?|affiliate|merch|use code|follow (?:me|us)|support (?:me|us|the channel)|buy (?:my|our)|(?:our|my|this) (?:other )?channel|check out (?:our|my)|channel advertisement)\b/i;
function cleanDescription(value) { return value.split(/\n+|(?<=[.!?])\s+/).filter((part) => !BOILERPLATE.test(part)).join(" ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000); }
function searchFieldValues(video) {
    return [["title", video.title], ["tags", (video.tags || []).join(", ")], ["description", cleanDescription(video.description || "")], ["topics", (video.topics || []).join(" ")]];
}
function createSearchFields(video, previousFields) {
    const previousByName = new Map(previousFields?.map((field) => [field.name, field]));
    return searchFieldValues(video)
        .map(([name, value]) => {
        const previous = previousByName.get(name);
        if (previous?.value === value)
            return previous;
        const text = (0, search_1.searchTextForms)((0, search_1.contextualSearchText)(value)).join(" ");
        return { name, value, text, words: new Set(text.split(" ")) };
    });
}
function fieldsFor(video) {
    if (video.searchFields)
        return video.searchFields;
    const cached = index.get(video);
    if (cached)
        return cached;
    const fields = createSearchFields(video);
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
    const words = (0, search_1.protectedSearchTerms)(term).includes(text) ? text.split(" ") : meaningful(text);
    return words.length > 0 && words.every((word) => field.words.has(word) || (word.length >= 5 && hasPrefix(field.words, word)));
}
function passage(field, term) {
    const sentences = field.name === "description" ? field.value.split(/(?<=[.!?])\s+/) : [field.value];
    const matching = sentences.find((value) => matchesTerm(term, { ...field, text: (0, search_1.searchTextForms)((0, search_1.contextualSearchText)(value)).join(" "), words: new Set((0, search_1.searchTextForms)((0, search_1.contextualSearchText)(value)).join(" ").split(" ")) }));
    const value = matching || field.value;
    const words = meaningful(term);
    const hit = value.toLowerCase().indexOf(words[0] || term.toLowerCase());
    const start = value.length > 320 && hit > 240 ? Math.max(0, hit - 80) : 0;
    return value.slice(start, start + 320);
}
// Connection evidence stays inside one short passage, or the title and opening passage.
const nearbyIndex = new WeakMap();
function localField(name, value) {
    const text = (0, search_1.searchTextForms)((0, search_1.contextualSearchText)(value)).join(" ");
    return { name, value, text, words: new Set(text.split(" ")) };
}
function nearbyUnits(video) {
    const cached = nearbyIndex.get(video);
    if (cached)
        return cached;
    const title = fieldsFor(video)[0];
    const units = [{ fields: [title], bonus: 30 }];
    let lead;
    for (const paragraph of video.description.slice(0, 6000).split(/\n+/)) {
        // Keep paragraph boundaries even after removing advertisements and links.
        const runs = [[]];
        for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
            if (BOILERPLATE.test(sentence)) {
                runs.push([]);
                continue;
            }
            const clean = cleanDescription(sentence);
            if (clean)
                runs[runs.length - 1].push(clean);
        }
        for (const sentences of runs)
            for (let i = 0; i < sentences.length; i++) {
                const pair = [sentences[i], sentences[i + 1]].filter(Boolean).join(" ");
                const value = pair;
                for (let start = 0; start < value.length; start += 240) {
                    const from = start ? value.indexOf(" ", start) + 1 : 0;
                    if (start && from === 0)
                        break;
                    const end = value.length <= from + 480 ? value.length : value.lastIndexOf(" ", from + 480);
                    if (end <= from)
                        continue;
                    const field = localField("description", value.slice(from, end));
                    units.push({ fields: [field], bonus: 16 });
                    if (!lead)
                        lead = field;
                    if (end === value.length)
                        break;
                }
            }
    }
    if (lead)
        units.push({ fields: [title, lead], bonus: 8 });
    for (const tag of video.tags || [])
        if (tag.length <= 480)
            units.push({ fields: [localField("tags", tag)], bonus: 4 });
    nearbyIndex.set(video, units);
    return units;
}
function matchedGroups(fields, groups) {
    return groups.flatMap((group, i) => group.terms.flatMap(expand).some(term => fields.some(field => matchesTerm(term, field))) ? [i] : []);
}
function connectedCoverage(video, groups, anyOf, global) {
    if (!global.complete || groups.filter(g => g.required !== false).length < 2)
        return { coverage: global, bonus: 0, fields: undefined };
    const titleFields = [fieldsFor(video)[0]];
    const titleCoverage = coverageFor(groups, matchedGroups(titleFields, groups), anyOf);
    if (titleCoverage.complete)
        return { coverage: titleCoverage, bonus: 30, fields: titleFields };
    let best = { coverage: { ...global, complete: false, matchedConcepts: [], missingConcepts: groups.map((_, i) => i) }, bonus: 0, fields: undefined };
    for (const unit of nearbyUnits(video)) {
        const coverage = coverageFor(groups, matchedGroups(unit.fields, groups), anyOf);
        if (coverage.complete && !best.coverage.complete || coverage.complete === best.coverage.complete && (coverage.missingConcepts.length < best.coverage.missingConcepts.length || coverage.missingConcepts.length === best.coverage.missingConcepts.length && unit.bonus > best.bonus))
            best = { coverage, bonus: unit.bonus, fields: unit.fields };
    }
    return best;
}
function requiredGroups(plan) {
    if (plan.conceptGroups?.length)
        return [...plan.conceptGroups, ...(plan.include || []).filter((term) => !plan.conceptGroups.some((group) => group.terms.some((variant) => normalizeVideoQuery(variant) === normalizeVideoQuery(term)))).map((term) => ({ terms: expand(term), required: true }))];
    return [...(plan.terms || []).map(term => ({ terms: expand(term), required: true })), ...(plan.include || []).map((term) => ({ terms: expand(term), required: true }))];
}
function prepareSemanticVideoSearch(plan, topic = "All", channelId) {
    const snapshot = immutablePlan(plan);
    const groups = Object.freeze(requiredGroups(snapshot).map(group => {
        const terms = [...new Set(group.terms.slice(0, 12).flatMap(expand))];
        return Object.freeze({
            ...group,
            terms: Object.freeze(terms),
            // connectedCoverage historically expanded the already-expanded terms again.
            connectedTerms: Object.freeze([...new Set(terms.flatMap(expand))]),
            related: group.related ? Object.freeze([...group.related]) : undefined,
        });
    }));
    const required = groups.flatMap((group, index) => group.required !== false && group.terms.length ? [index] : []);
    const coverageClauses = Object.freeze(snapshot.anyOf?.length
        ? snapshot.anyOf.map(clause => Object.freeze([...clause.filter(index => groups[index]?.required !== false), ...required.filter(index => !snapshot.anyOf.some(other => other.includes(index)))]))
        : [Object.freeze(required)]);
    return Object.freeze({
        plan: snapshot,
        topic,
        selectedChannelId: channelId,
        groups,
        coverageClauses,
        exclusionGroups: Object.freeze((snapshot.exclude || []).map(term => Object.freeze([...new Set(expand(term))]))),
        allGroupIndexes: Object.freeze(groups.map((_, index) => index)),
        requiredGroupCount: required.length,
        related: Object.freeze([...(snapshot.alternatives || []), ...groups.flatMap(group => group.related || [])].slice(0, 96)),
        exactTitleTerms: Object.freeze((snapshot.terms || []).map(normalizeVideoQuery)),
        normalizedTopics: Object.freeze((snapshot.topics || []).map(normalizeVideoQuery)),
        topicHints: Object.freeze([...(snapshot.topicHints || [])]),
        planChannelId: snapshot.channelId,
        hasDateBounds: Boolean(snapshot.minDate || snapshot.maxDate),
        minDateTime: snapshot.minDate ? Date.parse(snapshot.minDate) : undefined,
        maxDateTime: snapshot.maxDate ? Date.parse(snapshot.maxDate) : undefined,
        minDurationSeconds: snapshot.minDurationSeconds,
        maxDurationSeconds: snapshot.maxDurationSeconds,
        sort: snapshot.sort,
        filterOnly: !groups.length && Boolean(snapshot.channelId || channelId || topic !== "All" || snapshot.minDate || snapshot.maxDate || snapshot.minDurationSeconds !== undefined || snapshot.maxDurationSeconds !== undefined || snapshot.sort && snapshot.sort !== "relevance"),
    });
}
function eligiblePreparedSemanticVideo(video, prepared, excludedIds) {
    if (!video.approved || excludedIds.has(video.id) || /#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(video.title) || /#shorts?\b/i.test(video.description || "") || (video.tags || []).some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalizeVideoQuery(tag))))
        return false;
    if (!hasEligibleSpecialPlaylist(video))
        return false;
    if (prepared.selectedChannelId && video.channelId !== prepared.selectedChannelId || prepared.planChannelId && video.channelId !== prepared.planChannelId)
        return false;
    if (prepared.topic !== "All" && !(video.topics || []).includes(prepared.topic))
        return false;
    if (prepared.normalizedTopics.length && !(video.topics || []).some(topic => prepared.normalizedTopics.includes(normalizeVideoQuery(topic))))
        return false;
    if (prepared.hasDateBounds) {
        const uploaded = Date.parse(video.publishedAt);
        if (!Number.isFinite(uploaded) || prepared.minDateTime !== undefined && uploaded < prepared.minDateTime || prepared.maxDateTime !== undefined && uploaded > prepared.maxDateTime)
            return false;
    }
    if ((prepared.minDurationSeconds !== undefined || prepared.maxDurationSeconds !== undefined) && !Number.isFinite(video.durationSeconds))
        return false;
    if (prepared.minDurationSeconds !== undefined && video.durationSeconds < prepared.minDurationSeconds || prepared.maxDurationSeconds !== undefined && video.durationSeconds > prepared.maxDurationSeconds)
        return false;
    const fields = fieldsFor(video);
    return !prepared.exclusionGroups.some(group => group.some(variant => fields.some(field => matchesTerm(variant, field))));
}
function coverageForPrepared(groups, matchedConcepts, clauses) {
    const matched = new Set(matchedConcepts);
    const missing = clauses.map(clause => clause.filter(index => !matched.has(index))).sort((a, b) => a.length - b.length)[0] || [];
    return { matchedConcepts, missingConcepts: missing, complete: !missing.length };
}
function matchedPreparedGroups(fields, groups) {
    const matched = [];
    for (let index = 0; index < groups.length; index++) {
        const group = groups[index];
        if (group.connectedTerms.some(term => fields.some(field => matchesTerm(term, field))))
            matched.push(index);
    }
    return matched;
}
function connectedPreparedCoverage(video, prepared, global) {
    const { groups } = prepared;
    if (!global.complete || prepared.requiredGroupCount < 2)
        return { coverage: global, bonus: 0, fields: undefined };
    const titleFields = [fieldsFor(video)[0]];
    const titleCoverage = coverageForPrepared(groups, matchedPreparedGroups(titleFields, groups), prepared.coverageClauses);
    if (titleCoverage.complete)
        return { coverage: titleCoverage, bonus: 30, fields: titleFields };
    let best = { coverage: { ...global, complete: false, matchedConcepts: [], missingConcepts: [...prepared.allGroupIndexes] }, bonus: 0, fields: undefined };
    for (const unit of nearbyUnits(video)) {
        const coverage = coverageForPrepared(groups, matchedPreparedGroups(unit.fields, groups), prepared.coverageClauses);
        if (coverage.complete && !best.coverage.complete || coverage.complete === best.coverage.complete && (coverage.missingConcepts.length < best.coverage.missingConcepts.length || coverage.missingConcepts.length === best.coverage.missingConcepts.length && unit.bonus > best.bonus))
            best = { coverage, bonus: unit.bonus, fields: unit.fields };
    }
    return best;
}
function eligibleSemanticVideo(video, plan, topic = "All", selectedChannelId, excludedIds = new Set()) {
    if (!video.approved || excludedIds.has(video.id) || /#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(video.title) || /#shorts?\b/i.test(video.description || "") || (video.tags || []).some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalizeVideoQuery(tag))))
        return false;
    if (!hasEligibleSpecialPlaylist(video))
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
    return connectedCoverage(video, groups, plan.anyOf, coverageFor(groups, matched, plan.anyOf)).coverage;
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
/** Insert into an already ranked result list while retaining only its best N entries. */
function insertBoundedRanked(items, candidate, limit, compare) {
    const maximum = Math.max(0, Math.floor(limit));
    if (!maximum)
        return;
    if (items.length >= maximum && compare(candidate, items[items.length - 1]) >= 0)
        return;
    let low = 0, high = items.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (compare(items[middle], candidate) <= 0)
            low = middle + 1;
        else
            high = middle;
    }
    items.splice(low, 0, candidate);
    if (items.length > maximum)
        items.pop();
}
const emptyExcludedIds = new Set();
exports.SEMANTIC_SEARCH_SLICE_BUDGET_MS = 8;
exports.SEMANTIC_SEARCH_MIN_CHUNK_SIZE = 32;
exports.SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE = 64;
exports.SEMANTIC_SEARCH_MAX_CHUNK_SIZE = 640;
/** Adjust the next worker slice toward the time budget without large noisy jumps. */
function nextSemanticSearchChunkSize(currentSize, elapsedMs) {
    const current = Number.isFinite(currentSize)
        ? Math.max(exports.SEMANTIC_SEARCH_MIN_CHUNK_SIZE, Math.min(exports.SEMANTIC_SEARCH_MAX_CHUNK_SIZE, Math.floor(currentSize)))
        : exports.SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE;
    const elapsed = Number.isFinite(elapsedMs) ? Math.max(0.5, elapsedMs) : exports.SEMANTIC_SEARCH_SLICE_BUDGET_MS;
    const scale = Math.max(0.5, Math.min(2, exports.SEMANTIC_SEARCH_SLICE_BUDGET_MS / elapsed));
    return Math.max(exports.SEMANTIC_SEARCH_MIN_CHUNK_SIZE, Math.min(exports.SEMANTIC_SEARCH_MAX_CHUNK_SIZE, Math.round(current * scale)));
}
function semanticSearchNow() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
function searchPreparedSemanticVideos(videos, prepared, limit = 80, excludedIds = emptyExcludedIds) {
    const { groups, related } = prepared;
    const results = [];
    for (const video of videos) {
        if (!eligiblePreparedSemanticVideo(video, prepared, excludedIds))
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
        const connected = connectedPreparedCoverage(video, prepared, coverageForPrepared(groups, matchedConcepts, prepared.coverageClauses));
        const coverage = connected.coverage;
        if (!coverage.complete || !evidence.length && !prepared.filterOnly)
            continue;
        if (connected.fields) {
            evidence.length = 0;
            for (const group of groups) {
                const matches = group.terms.flatMap(term => connected.fields.filter(field => matchesTerm(term, field)).map(field => ({ field, term, score: field.name === "title" ? 20 : field.name === "tags" ? 12 : 8 })));
                matches.sort((a, b) => b.score - a.score);
                if (matches.length)
                    evidence.push(matches[0]);
            }
        }
        const title = fields[0].text;
        const exactTitle = prepared.exactTitleTerms.some((term) => contains(title, term));
        let relatedBonus = 0;
        for (const term of related) {
            if (fields.some(field => matchesTerm(term, field)) && ++relatedBonus === 3)
                break;
        }
        const hint = (video.topics || []).some((topic) => prepared.topicHints.includes(topic));
        results.push({ video, coverage, score: 100 * evidence.length + evidence.reduce((sum, item) => sum + item.score, 0) + (exactTitle ? 10 : 0) + (hint ? 1 : 0) + relatedBonus + connected.bonus, matchedFields: [...new Set(evidence.map((item) => item.field.name))], supportingText: [...new Set(evidence.map((item) => passage(item.field, item.term)))].slice(0, 8) });
    }
    return results.sort((a, b) => compareSemanticCandidates(a, b, prepared.sort)).slice(0, Math.max(1, limit));
}
function searchSemanticVideos(videos, plan, topic = "All", channelId, limit = 80, excluded = []) {
    const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
    return searchPreparedSemanticVideos(videos, prepared, limit, excluded.length ? new Set(excluded) : emptyExcludedIds);
}
async function searchSemanticVideosYielding(videos, plan, topic = "All", channelId, limit = 80, excluded = [], signal) {
    const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
    return searchPreparedSemanticVideosYielding(videos, prepared, limit, excluded.length ? new Set(excluded) : emptyExcludedIds, signal);
}
async function searchPreparedSemanticVideosYielding(videos, prepared, limit = 80, excludedIds = emptyExcludedIds, signal) {
    const matches = [];
    let start = 0;
    let chunkSize = exports.SEMANTIC_SEARCH_INITIAL_CHUNK_SIZE;
    while (start < videos.length) {
        if (signal?.aborted)
            throw new DOMException("Search canceled", "AbortError");
        start = await (0, background_work_1.runBackgroundSlice)(() => {
            const beganAt = semanticSearchNow();
            const end = Math.min(videos.length, start + chunkSize);
            matches.push(...searchPreparedSemanticVideos(videos.slice(start, end), prepared, limit, excludedIds));
            const elapsed = semanticSearchNow() - beganAt;
            chunkSize = nextSemanticSearchChunkSize(chunkSize, elapsed);
            return end;
        }, { priority: "interactive", canPause: true, signal });
        if (signal?.aborted)
            throw new DOMException("Search canceled", "AbortError");
    }
    if (signal?.aborted)
        throw new DOMException("Search canceled", "AbortError");
    return matches.sort((a, b) => compareSemanticCandidates(a, b, prepared.sort)).slice(0, limit);
}
/** Explain only evidence found in searchable metadata; model prose never establishes a match. */
function videoSearchReason(video, plan, localScore = 0, suppliedSupport = []) {
    const groups = requiredGroups(plan);
    const allFields = fieldsFor(video).filter(field => field.name !== "topics");
    const connected = connectedCoverage(video, groups, plan.anyOf, coverageFor(groups, matchedGroups(allFields, groups), plan.anyOf));
    const fields = connected.coverage.complete && connected.fields ? connected.fields : allFields;
    const support = [], matchedFields = new Set();
    for (const group of groups) {
        const matches = group.terms.flatMap(expand).flatMap(term => fields.filter(field => matchesTerm(term, field)).map(field => ({ field, term })));
        const best = matches[0];
        if (best) {
            matchedFields.add(best.field.name);
            const text = `${best.field.name[0].toUpperCase() + best.field.name.slice(1)}: “${passage(best.field, best.term)}”`;
            if (!support.includes(text))
                support.push(text);
        }
    }
    // Require a contiguous excerpt in one field, rather than loose word overlap across fields.
    for (const excerpt of suppliedSupport.slice(0, 4)) {
        if (typeof excerpt !== "string" || !meaningful(excerpt).length)
            continue;
        const normalized = normalizeVideoQuery(excerpt);
        const excerptField = { name: "excerpt", value: excerpt, text: normalized, words: new Set(normalized.split(" ")) };
        if (!groups.some(group => [...group.terms.flatMap(expand), ...(group.related || [])].some(term => matchesTerm(term, excerptField))))
            continue;
        const field = fields.find(field => contains(field.text, normalized));
        if (!field || !normalized)
            continue;
        const text = `${field.name[0].toUpperCase() + field.name.slice(1)}: “${passage(field, excerpt)}”`;
        if (!support.includes(text))
            support.push(text);
    }
    const coverage = videoConceptCoverage(video, plan);
    const strong = groups.length > 0 && coverage.complete && matchedFields.size > 0;
    return {
        videoId: video.id, relevance: strong ? "strong" : "broader",
        support: support.slice(0, 12), localScore,
        explanation: strong ? `Matches all requested concepts in the ${[...matchedFields].join(" and ")}.`
            : support.length ? "Broader recommendation: the metadata below does not establish every requested concept."
                : "Matches your browsing filters; no meaning-based metadata match was found."
    };
}
/** Optional interpretation is warranted only for meaningful queries without full local coverage. */
function shouldEnrichVideoSearch(query, plan, candidates) {
    if (!requiredGroups(plan).length || meaningful(query).length < 2)
        return false;
    return !candidates.some(candidate => semanticCoverage(candidate.video, plan));
}

scope.LEARNED_MEDIA_VIDEO_SEARCH = exports; })(globalThis);
