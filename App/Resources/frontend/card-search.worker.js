// Generated card-search worker.
const searchHelpers={},cache={},diagnostics={},schemaDiagnostics={};(function(exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerSchemaFields = void 0;
exports.recordProviderSchemaFailure = recordProviderSchemaFailure;
exports.providerSchemaFailureSnapshot = providerSchemaFailureSnapshot;
exports.resetProviderSchemaFailures = resetProviderSchemaFailures;
/** Authoritative ordered schema IDs and paths; build-native-diagnostics emits the Swift equivalent. */
exports.providerSchemaFields = {
    "wikipedia.search": ["$", "error", "error.code", "error.info", "query", "query.search", "query.search[0]", "query.search[0].title"],
    "wikipedia.pages": ["$", "error", "error.code", "error.info", "query", "query.normalized", "query.redirects", "query.pages", "query.pages[0]", "query.pages[0].title", "query.pages[0].fullurl", "query.pages[0].extract", "query.pages[0].pageimage", "query.pages[0].thumbnail", "query.pages[0].thumbnail.source", "query.pages[0].original", "query.pages[0].original.source", "query.pages[0].coordinates", "query.pages[0].coordinates[0]", "query.pages[0].coordinates[0].lat", "query.pages[0].coordinates[0].lon", "query.pages[0].pageprops", "query.pages[0].pageprops.disambiguation"],
    "wikipedia.images": ["$", "error", "error.code", "error.info", "query", "query.pages", "query.pages[0]", "query.pages[0].imageinfo", "query.pages[0].imageinfo[0]", "query.pages[0].imageinfo[0].url", "query.pages[0].imageinfo[0].thumburl", "query.pages[0].imageinfo[0].descriptionurl", "query.pages[0].imageinfo[0].extmetadata"],
    "wikipedia.summary": ["$", "title", "thumbnail", "thumbnail.source", "originalimage", "originalimage.source", "content_urls", "content_urls.desktop", "content_urls.desktop.page"],
    "youtube.channels": ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.customUrl", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.relatedPlaylists", "items[0].contentDetails.relatedPlaylists.uploads"],
    "youtube.search": ["$", "items", "items[0]", "items[0].id", "items[0].id.channelId", "items[0].id.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.channelTitle", "items[0].snippet.channelId"],
    "youtube.playlistItems": ["$", "items", "items[0]", "items[0].contentDetails", "items[0].contentDetails.videoId", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "nextPageToken"],
    "youtube.videos": ["$", "items", "items[0]", "items[0].id", "items[0].snippet", "items[0].snippet.title", "items[0].snippet.description", "items[0].snippet.publishedAt", "items[0].snippet.channelId", "items[0].snippet.channelTitle", "items[0].snippet.tags", "items[0].snippet.thumbnails", "items[0].contentDetails", "items[0].contentDetails.duration", "items[0].status", "items[0].status.privacyStatus", "items[0].status.embeddable"],
    "youtube.error": ["$", "error", "error.code", "error.message", "error.status", "error.errors", "error.errors[0]", "error.errors[0].reason"]
};
const preparedSchemaFields = new Map(Object.entries(exports.providerSchemaFields).map(([schema, paths]) => [schema, Object.freeze(paths.map(path => Object.freeze({
        path,
        steps: Object.freeze(path === "$" ? [] : path.split(".").map(segment => {
            const firstElement = segment.endsWith("[0]");
            return Object.freeze({ key: firstElement ? segment.slice(0, -3) : segment, firstElement });
        }))
    })))]));
const ringCapacity = 64;
const ring = new Array(ringCapacity);
let ringOldest = 0;
let ringSize = 0;
const counts = new Map();
const localRuntime = typeof window !== "undefined" || (typeof self !== "undefined" && "importScripts" in globalThis);
function readPath(value, steps) {
    let current = value;
    for (const { key, firstElement } of steps) {
        if (!current || typeof current !== "object" || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, key))
            return undefined;
        current = current[key];
        if (firstElement)
            current = Array.isArray(current) ? current[0] : undefined;
    }
    return current;
}
function observedType(value, override) {
    if (override)
        return override;
    if (value === undefined)
        return "missing";
    if (value === null)
        return "null";
    if (Array.isArray(value))
        return "array";
    switch (typeof value) {
        case "object": return "object";
        case "string": return "string";
        case "number": return "number";
        case "boolean": return "boolean";
        default: return "other";
    }
}
/** Keeps only allowlisted field names and JSON types; payload values are never retained. */
function recordProviderSchemaFailure(schema, payload, rootOverride) {
    if (!localRuntime)
        return;
    try {
        const fields = preparedSchemaFields.get(schema);
        if (!fields)
            return;
        const safeRootOverride = rootOverride === "invalid-json" || rootOverride === "non-json" ? rootOverride : undefined;
        const fingerprint = `${schema}|${fields.map(({ path, steps }) => `${path}:${observedType(readPath(payload, steps), path === "$" ? safeRootOverride : undefined)}`).join(",")}`;
        let slot;
        if (ringSize === ringCapacity) {
            const expired = ring[ringOldest];
            const remaining = (counts.get(expired) ?? 1) - 1;
            if (remaining <= 0)
                counts.delete(expired);
            else
                counts.set(expired, remaining);
            slot = ringOldest;
            ringOldest = (ringOldest + 1) % ringCapacity;
        }
        else {
            slot = (ringOldest + ringSize) % ringCapacity;
            ringSize += 1;
        }
        ring[slot] = fingerprint;
        counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
    }
    catch {
        // Diagnostics must never alter provider-response handling.
    }
}
function providerSchemaFailureSnapshot() {
    return Array.from(counts, ([fingerprint, count]) => ({ fingerprint, count }));
}
function resetProviderSchemaFailures() {
    ring.fill(undefined);
    ringOldest = 0;
    ringSize = 0;
    counts.clear();
}
})(schemaDiagnostics);(function(exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceFetch = exports.performanceDiagnostics = void 0;
exports.recordPerformance = recordPerformance;
exports.diagnosticTextBytes = diagnosticTextBytes;
const provider_schema_diagnostics_1 = require("./provider-schema-diagnostics");
/** Numeric aggregates only. No event log, identifiers, persistence, or uploads. */
const services = ['gemini', 'youtube', 'wikipedia', 'cloud', 'cache'];
const metrics = ['requests', 'cache_hits', 'cache_misses', 'coalesced', 'queue_ms', 'retries', 'request_bytes', 'response_bytes_reported', 'response_bytes_read'];
const counters = new Map();
const limit = Number.MAX_SAFE_INTEGER;
const localRuntime = typeof window !== 'undefined' || (typeof self !== 'undefined' && 'importScripts' in globalThis);
function recordPerformance(service, metric, value = 1) {
    // Runtime allowlists also reject arbitrary strings from JavaScript callers.
    if (!localRuntime || !services.includes(service) || !metrics.includes(metric) || !Number.isFinite(value) || value < 0)
        return;
    const key = `${service}.${metric}`;
    const sample = Math.min(value, limit);
    const previous = counters.get(key) ?? { samples: 0, total: 0, max: 0 };
    previous.samples = Math.min(limit, previous.samples + 1);
    previous.total = Math.min(limit, previous.total + sample);
    previous.max = Math.max(previous.max, sample);
    counters.set(key, previous);
}
exports.performanceDiagnostics = Object.freeze({
    snapshot: () => ({ version: 1, scope: 'current-runtime', counters: Object.fromEntries([...counters].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, { ...value }])), providerSchemaFailures: (0, provider_schema_diagnostics_1.providerSchemaFailureSnapshot)() }),
    reset: () => { counters.clear(); (0, provider_schema_diagnostics_1.resetProviderSchemaFailures)(); }
});
// Count UTF-8 bytes without retaining text or allocating a second payload buffer.
function diagnosticTextBytes(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x80)
            bytes++;
        else if (code < 0x800)
            bytes += 2;
        else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
            bytes += 4;
            i++;
        }
        else
            bytes += 3;
    }
    return bytes;
}
/** Observe existing fetches; never clone/read responses or add requests. */
const performanceFetch = async (service, input, init) => {
    if (!localRuntime)
        return fetch(input, init);
    recordPerformance(service, 'requests');
    if (typeof init?.body === 'string')
        recordPerformance(service, 'request_bytes', diagnosticTextBytes(init.body));
    const response = await fetch(input, init);
    const length = response.headers.get('content-length');
    if (length !== null && /^\d+$/.test(length))
        recordPerformance(service, 'response_bytes_reported', Number(length));
    return response;
};
exports.performanceFetch = performanceFetch;
if (localRuntime) {
    try {
        Object.defineProperty(globalThis, 'LearnedMediaDiagnostics', { value: exports.performanceDiagnostics, configurable: true });
    }
    catch { /* An optional inspection hook must not prevent app startup. */ }
}
})(diagnostics,()=>schemaDiagnostics);(function(exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSearchText = normalizeSearchText;
exports.searchTextForms = searchTextForms;
exports.commonNameAliases = commonNameAliases;
exports.contextualSearchText = contextualSearchText;
exports.protectedSearchTerms = protectedSearchTerms;
exports.shouldExpandNaturalSearch = shouldExpandNaturalSearch;
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
function distance(left, right) {
    if (left === right)
        return 0;
    if (!left.length)
        return right.length;
    if (!right.length)
        return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[right.length];
}
function tokenScore(queryToken, textToken) {
    if (queryToken === textToken)
        return 20;
    if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken))
        return 13;
    const limit = queryToken.length >= 8 ? 2 : 1;
    return queryToken.length >= 4 && textToken.length >= 4 && distance(queryToken, textToken) <= limit ? 7 : 0;
}
function searchScoreNormalized(normalizedQuery, normalizedText) {
    if (!normalizedQuery || !normalizedText)
        return 0;
    if (normalizedText.includes(normalizedQuery))
        return 100 + normalizedQuery.length;
    const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
    const textTokens = normalizedText.split(" ").filter(Boolean);
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
})(searchHelpers);(function(exports,require){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCache = void 0;
exports.approximateCacheBytes = approximateCacheBytes;
exports.requestCacheScope = requestCacheScope;
exports.requestCacheKey = requestCacheKey;
exports.canonicalRequestIdentity = canonicalRequestIdentity;
exports.reusableStructuredValue = reusableStructuredValue;
const performance_diagnostics_1 = require("./performance-diagnostics");
/** Conservative retained-size estimate; no JSON copy, and shared/cyclic objects count once. */
function approximateCacheBytes(value, limit = Infinity) {
    let bytes = 0;
    const seen = new WeakSet();
    function visit(item, depth) {
        if (bytes > limit)
            return;
        if (typeof item === 'string') {
            bytes += 16 + item.length * 2;
            return;
        }
        if (!item || typeof item !== 'object') {
            bytes += 8;
            return;
        }
        if (seen.has(item))
            return;
        seen.add(item);
        if (depth > 64) {
            bytes = limit + 1;
            return;
        }
        bytes += 32;
        if (ArrayBuffer.isView(item)) {
            bytes += item.byteLength;
            return;
        }
        if (item instanceof ArrayBuffer) {
            bytes += item.byteLength;
            return;
        }
        if (item instanceof Map) {
            for (const [key, entry] of item) {
                bytes += 32;
                visit(key, depth + 1);
                visit(entry, depth + 1);
                if (bytes > limit)
                    break;
            }
        }
        else if (item instanceof Set || Array.isArray(item)) {
            for (const entry of item) {
                bytes += 8;
                visit(entry, depth + 1);
                if (bytes > limit)
                    break;
            }
        }
        else {
            for (const key of Object.keys(item)) {
                bytes += 16 + key.length * 2;
                visit(item[key], depth + 1);
                if (bytes > limit)
                    break;
            }
        }
    }
    visit(value, 0);
    return bytes;
}
/** Small bounded cache for results that are safe to reuse within one session. */
class SessionCache {
    maxEntries;
    ttlMs;
    maxBytes;
    entries = new Map();
    bytes = 0;
    nextExpiryAt = Infinity;
    constructor(maxEntries = 100, ttlMs = 30 * 60 * 1000, maxBytes = 4 * 1024 * 1024) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.maxBytes = maxBytes;
    }
    remove(key) {
        const entry = this.entries.get(key);
        if (entry)
            this.bytes -= entry.bytes;
        this.entries.delete(key);
        if (!this.entries.size)
            this.nextExpiryAt = Infinity;
    }
    get(key, now = Date.now()) {
        const entry = this.entries.get(key);
        if (!entry) {
            (0, performance_diagnostics_1.recordPerformance)("cache", "cache_misses");
            return undefined;
        }
        if (entry.expiresAt <= now) {
            this.remove(key);
            (0, performance_diagnostics_1.recordPerformance)("cache", "cache_misses");
            return undefined;
        }
        this.entries.delete(key);
        this.entries.set(key, entry);
        (0, performance_diagnostics_1.recordPerformance)("cache", "cache_hits");
        return entry.value;
    }
    set(key, value, now = Date.now()) {
        this.remove(key);
        // Deletions may leave an earlier deadline: at worst, one extra sweep.
        if (now >= this.nextExpiryAt) {
            this.nextExpiryAt = Infinity;
            for (const [id, entry] of this.entries) {
                if (entry.expiresAt <= now)
                    this.remove(id);
                else
                    this.nextExpiryAt = Math.min(this.nextExpiryAt, entry.expiresAt);
            }
        }
        const bytes = 96 + key.length * 2 + approximateCacheBytes(value, this.maxBytes);
        if (bytes > this.maxBytes || this.maxEntries <= 0 || this.ttlMs <= 0)
            return;
        const expiresAt = now + this.ttlMs;
        this.entries.set(key, { value, expiresAt, bytes });
        this.nextExpiryAt = Math.min(this.nextExpiryAt, expiresAt);
        this.bytes += bytes;
        while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes)
            this.remove(this.entries.keys().next().value);
    }
    delete(key) { this.remove(key); }
    clear() { this.entries.clear(); this.bytes = 0; this.nextExpiryAt = Infinity; }
    get size() { return this.entries.size; }
    get approximateBytes() { return this.bytes; }
}
exports.SessionCache = SessionCache;
/** Cache scopes are one-way hashes so API keys never become cache keys. */
function requestCacheScope(sessionId, apiKey) {
    return hashValue(`${sessionId}\u0000${apiKey}`);
}
function requestCacheKey(scope, ...parts) {
    const value = JSON.stringify(parts);
    return `${scope}:${hashValue(value)}:${value.length}`;
}
function hashValue(value) {
    let first = 2166136261;
    let second = 0x9e3779b9;
    for (const character of value) {
        first = Math.imul(first ^ character.charCodeAt(0), 16777619);
        second = Math.imul(second ^ character.charCodeAt(0), 2246822519);
    }
    return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
/** Normalize user input only. IDs, source quotations and conversation data remain exact. */
function canonicalRequestIdentity(identity) {
    function ordered(value) {
        if (Array.isArray(value))
            return value.map(ordered);
        if (value && typeof value === "object")
            return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
        return value;
    }
    return ordered({ version: 1, ...identity, query: (identity.query ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim() });
}
/** Provider JSON is reusable only when it satisfies the requested structured shape. */
function reusableStructuredValue(value, schema) {
    if (Array.isArray(schema.enum) && !schema.enum.includes(value))
        return false;
    switch (schema.type) {
        case "OBJECT": {
            if (!value || typeof value !== "object" || Array.isArray(value))
                return false;
            const object = value, fields = (schema.properties ?? {});
            return (!schema.required?.some(key => object[key] === undefined)) && Object.entries(fields).every(([key, field]) => object[key] === undefined || reusableStructuredValue(object[key], field));
        }
        case "ARRAY": return Array.isArray(value) && value.length >= Number(schema.minItems ?? 0) && value.length <= Number(schema.maxItems ?? Infinity) && value.every(item => reusableStructuredValue(item, (schema.items ?? {})));
        case "STRING": return typeof value === "string" && Boolean(value.trim());
        case "INTEGER": return typeof value === "number" && Number.isInteger(value);
        case "NUMBER": return typeof value === "number" && Number.isFinite(value);
        case "BOOLEAN": return typeof value === "boolean";
        default: return true;
    }
}
})(cache,()=>diagnostics);const exports={},require=name=>name.includes('session-cache')?cache:searchHelpers;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference lib="webworker" />
const session_cache_1 = require("@/lib/session-cache");
const search_1 = require("@/lib/search");
const workerScope = self;
const documents = new Map();
const resultCache = new session_cache_1.SessionCache(100, 30 * 60 * 1000, 4 * 1024 * 1024);
let activeEligibility = null;
let revision = -1;
let latestRequestId = 0;
function addDocuments(items) {
    for (const item of items)
        documents.set(item.id, (0, search_1.normalizeSearchText)(item.text));
}
function cacheResult(key, value) {
    resultCache.set(key, value);
}
function yieldToWorker() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
async function search(request) {
    if (request.revision !== revision)
        return;
    const eligibility = activeEligibility;
    if (!eligibility || eligibility.scope !== request.eligibilityScope || eligibility.revision !== request.eligibilityRevision) {
        workerScope.postMessage({ type: "eligibility-stale", requestId: request.requestId, revision, eligibilityScope: request.eligibilityScope, eligibilityRevision: request.eligibilityRevision });
        return;
    }
    latestRequestId = request.requestId;
    const normalizedQuery = (0, search_1.normalizeSearchText)(request.query);
    const key = `${revision}\u0000${request.eligibilityScope}\u0000${request.eligibilityRevision}\u0000${normalizedQuery}\u0000${request.viewKey}`;
    const cached = resultCache.get(key);
    if (cached) {
        workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, eligibilityScope: eligibility.scope, eligibilityRevision: eligibility.revision, viewKey: request.viewKey, ids: cached });
        return;
    }
    const ranked = [];
    for (let index = 0; index < eligibility.ids.length; index += 1) {
        if (request.requestId !== latestRequestId || activeEligibility !== eligibility)
            return;
        const id = eligibility.ids[index];
        const text = documents.get(id);
        if (text === undefined)
            continue;
        const score = (0, search_1.searchScoreNormalized)(normalizedQuery, text);
        if (score > 0)
            ranked.push({ id, index, score });
        if (index > 0 && index % 400 === 0) {
            await yieldToWorker();
            if (request.requestId !== latestRequestId || request.revision !== revision || activeEligibility !== eligibility)
                return;
        }
    }
    if (request.requestId !== latestRequestId || activeEligibility !== eligibility)
        return;
    ranked.sort((left, right) => right.score - left.score || left.index - right.index);
    const ids = ranked.map(({ id }) => id);
    cacheResult(key, ids);
    workerScope.postMessage({ type: "results", requestId: request.requestId, revision, query: request.query, eligibilityScope: eligibility.scope, eligibilityRevision: eligibility.revision, viewKey: request.viewKey, ids });
}
workerScope.onmessage = (event) => {
    const request = event.data;
    if (request.type === "initialize") {
        documents.clear();
        addDocuments(request.documents);
        revision = request.revision;
        latestRequestId = 0;
        activeEligibility = null;
        resultCache.clear();
        workerScope.postMessage({ type: "ready", revision });
    }
    else if (request.type === "update") {
        latestRequestId += 1;
        for (const id of request.removeIds)
            documents.delete(id);
        addDocuments(request.upserts);
        revision = request.revision;
        resultCache.clear();
    }
    else if (request.type === "register-eligibility") {
        if (request.revision !== revision)
            return;
        if (activeEligibility?.scope === request.eligibilityScope && activeEligibility.revision === request.eligibilityRevision)
            return;
        activeEligibility = { scope: request.eligibilityScope, revision: request.eligibilityRevision, ids: request.ids.slice() };
        latestRequestId += 1;
    }
    else if (request.type === "cancel") {
        latestRequestId = request.requestId;
    }
    else {
        void search(request);
    }
};
