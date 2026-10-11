import { normalizeSearchText } from "./search";
import type { TopicNode } from "./types";
export const TOPIC_SEARCH_VERSION = 2;
export type TopicSuggestionGroup = "keyword" | "related" | "explore";
export type TopicSuggestion = {
    id: string;
    label: string;
    path: string[];
    group: TopicSuggestionGroup;
};
export type TopicConcept = {
    label: string;
    equivalents: string[];
    related: string[];
};
export type TopicQueryPlan = {
    groups: TopicConcept[];
    alternatives?: boolean;
    anyOf?: number[][];
};
type TopicWithPath = TopicNode & {
    path: string[];
};
type Entry = {
    topic: TopicWithPath;
    fields: string[];
    context: string;
    parent?: string;
    order: number;
};
export type TopicSuggestionIndex = {
    entries: Entry[];
    byId: Map<string, Entry>;
};
export type TopicSemanticResult = {
    suggestions: TopicSuggestion[];
    visibleIds: string[];
    matchingDescendants: string[];
    directScores: Array<[
        string,
        number
    ]>;
    matchedIds: string[];
    completeCoverage: boolean;
};
const STOP = new Set("a about an and are as at be by can did do does explain find for from how i in into is it me of on or our please show some that the their them there these this to was were what when where which who why with would tell topics learn learning want know".split(" "));
const CONCEPTS: TopicConcept[] = [
    { label: "earthquakes", equivalents: ["earthquake", "earthquakes", "quake", "quakes", "tremors", "ground shaking", "shaking ground", "ground shake", "seismic activity", "earth tremor"], related: ["plate tectonics", "geology", "tsunamis", "faults", "seismic waves"] },
    { label: "volcanoes", equivalents: ["volcano", "volcanoes", "volcanic eruption", "erupting mountain", "molten rock", "lava flow", "magma", "ash cloud", "volcanology"], related: ["geology", "plate tectonics", "natural disasters"] },
    { label: "paleontology", equivalents: ["paleontology", "fossils", "fossil record", "fossil hunting", "prehistoric creatures", "ancient life", "extinct animals"], related: ["dinosaurs", "evolution", "mass extinctions", "archaeology"] },
    { label: "ancient dna", equivalents: ["ancient dna", "ancient genetics", "old human dna", "genetic ancestry"], related: ["genetics", "human origins", "archaeology", "evolution"] },
    { label: "extraterrestrial life", equivalents: ["extraterrestrial life", "life beyond earth", "alien life", "life on other planets", "search for extraterrestrial life"], related: ["astronomy", "space exploration", "planets", "astrophysics"] },
    { label: "astronomy", equivalents: ["astronomy", "outer space", "the cosmos", "stars and planets"], related: ["space exploration", "astrophysics", "spaceflight"] },
    { label: "gravitational lensing", equivalents: ["gravitational lensing", "bending starlight", "light bending", "gravity bends light"], related: ["astrophysics", "astronomy", "general relativity", "gravity"] },
    { label: "psychology", equivalents: ["psychology", "human behavior", "how people think", "people think", "the mind", "mental processes"], related: ["cognitive science", "neuroscience", "philosophy of mind"] },
    { label: "climate change", equivalents: ["climate change", "climate crisis", "global warming", "rising temperatures", "changing climate"], related: ["climatology", "environmental science", "renewable energy", "conservation"] },
    { label: "artificial intelligence", equivalents: ["artificial intelligence", "machine intelligence", "thinking machines", "computer intelligence", "generative ai", "ai"], related: ["computer science", "robotics", "machine learning"] },
    { label: "economics", equivalents: ["economics", "how money works", "economic systems"], related: ["history of money", "finance", "economic history", "business"] },
    { label: "religion", equivalents: ["religion", "world religions", "spiritual traditions", "belief systems"], related: ["religious history", "philosophy", "mythology", "theology", "sacred texts"] },
    { label: "archaeology", equivalents: ["archaeology", "lost civilizations", "early human societies", "how societies began"], related: ["ancient history", "human origins", "anthropology"] },
    { label: "film", equivalents: ["film", "films", "movie", "movies", "cinema"], related: ["directors", "screenwriting"] },
    { label: "television", equivalents: ["television", "tv", "tv shows"], related: ["series"] },
    { label: "writers", equivalents: ["writers", "writer", "authors", "author", "novelists", "novelist"], related: ["poets", "literature", "essays"] },
    { label: "population", equivalents: ["population", "demography", "human population", "population growth"], related: ["migration", "urbanization"] },
    { label: "evolution", equivalents: ["evolution", "natural selection", "species evolve"], related: ["biology", "genetics", "darwin"] },
    { label: "japan", equivalents: ["japan", "japanese"], related: [] },
    { label: "united states", equivalents: ["united states", "usa", "us", "american"], related: [] },
    { label: "united kingdom", equivalents: ["united kingdom", "uk", "british", "britain"], related: [] }
];
const words = (s: string) => normalizeSearchText(s).split(" ").filter(w => w.length > 1 && !STOP.has(w));
const contains = (s: string, t: string) => Boolean(t) && (` ${s} `).includes(` ${t} `);
const fieldTokens = new Map<string, string[]>();
const termCache = new Map<string, {
    text: string;
    tokens: string[];
}>();
function matches(s: string, t: string) {
    let term = termCache.get(t);
    if (!term) {
        term = { text: normalizeSearchText(t), tokens: words(t) };
        termCache.set(t, term);
        if (termCache.size > 500)
            termCache.delete(termCache.keys().next().value!);
    }
    if (contains(s, term.text))
        return true;
    if (!term.tokens.length)
        return false;
    let candidates = fieldTokens.get(s);
    if (!candidates) {
        candidates = s.split(" ");
        fieldTokens.set(s, candidates);
    }
    return term.tokens.every(w => candidates!.includes(w) || w.length >= 5 && candidates!.some(v => Math.abs(v.length - w.length) <= 2 && (v.startsWith(w) || w.startsWith(v))));
}
const conceptAliases = new Map(CONCEPTS.flatMap(c => c.equivalents.map(e => [normalizeSearchText(e), c.equivalents] as const)));
const conceptsByPhrase = CONCEPTS.flatMap(c => c.equivalents.map(p => ({ phrase: normalizeSearchText(p), concept: c }))).sort((a, b) => b.phrase.length - a.phrase.length);
export function validateTopicPlan(value: unknown): TopicQueryPlan {
    const v = value as Partial<TopicQueryPlan> | null;
    const clean = (a: unknown) => Array.isArray(a) ? Array.from(new Set(a.filter((x): x is string => typeof x === "string").map(normalizeSearchText).filter(x => x.length > 1 && x.length <= 120))).slice(0, 12) : [];
    return { groups: (Array.isArray(v?.groups) ? v.groups : []).slice(0, 8).flatMap(g => { if (!g || typeof g !== "object")
            return []; const equivalents = clean(g.equivalents); return equivalents.length ? [{ label: typeof g.label === "string" ? g.label.slice(0, 120) : equivalents[0], equivalents, related: clean(g.related) }] : []; }), alternatives: v?.alternatives === true };
}
export function localTopicPlan(query: string): TopicQueryPlan {
    const clauses = query.split(/\bor\b/i);
    if (clauses.length > 1) {
        const plans = clauses.map(localTopicPlan);
        const groups = plans.flatMap(p => p.groups);
        let offset = 0;
        const anyOf = plans.map(p => { const indices = p.groups.map((_, i) => offset + i); offset += p.groups.length; return indices; }).filter(a => a.length);
        return { groups, anyOf };
    }
    let remaining = normalizeSearchText(query);
    const groups: TopicConcept[] = [];
    for (const { phrase, concept } of conceptsByPhrase)
        if (contains(remaining, phrase)) {
            if (!groups.includes(concept))
                groups.push(concept);
            remaining = (` ${remaining} `).split(` ${phrase} `).join(" ").trim();
        }
    for (const w of words(remaining))
        groups.push({ label: w, equivalents: [w], related: [] });
    return { groups, alternatives: /\bor\b/i.test(query) };
}
export function shouldEnrichTopics(query: string, completeCoverage: boolean) { return !completeCoverage && words(query).length >= 2; }
function geographicContext(value: string) { const s = normalizeSearchText(value); return /\b(tohoku|kanto|sanriku|kobe|tokyo|osaka|kyoto|fukushima|nankai)\b/.test(s) ? "japan japanese" : ""; }
export function createTopicSuggestionIndex(topics: TopicWithPath[]): TopicSuggestionIndex {
    if (fieldTokens.size > 100000)
        fieldTokens.clear();
    const pathIds = new Map(topics.map(t => [t.path.join("\0"), t.id]));
    const entries = topics.map((topic, order) => { const fields = [topic.label, ...topic.aliases || [], topic.path.join(" ")].map(normalizeSearchText); const context = geographicContext(fields.join(" ")); return { topic, fields, context, order, parent: pathIds.get(topic.path.slice(0, -1).join("\0")) }; });
    return { entries, byId: new Map(entries.map(e => [e.topic.id, e])) };
}
type Ranked = {
    entry: Entry;
    complete: boolean;
    direct: number;
    score: number;
    covered: number;
};
function rank(entry: Entry, query: string, plan: TopicQueryPlan): Ranked {
    const queryWords = words(query), q = normalizeSearchText(query);
    const direct = queryWords.length ? Math.max(...entry.fields.map((f, i) => contains(f, q) ? 600 - i * 80 : queryWords.every(w => matches(f, w)) ? 350 - i * 70 : 0), 0) : 0;
    let covered = 0, score = 0;
    const coveredGroups = new Set<number>();
    for (const [groupIndex, g] of plan.groups.entries()) {
        const equivalents = g.equivalents;
        let best = 0;
        for (const term of equivalents) {
            if (matches(entry.fields[0], term))
                best = Math.max(best, 160);
            else if (entry.fields.slice(1, -1).some(f => matches(f, term)))
                best = Math.max(best, 140);
            else if (matches(entry.fields[entry.fields.length - 1], term))
                best = Math.max(best, 100);
            else if (matches(entry.context, term))
                best = Math.max(best, 95);
        }
        if (best) {
            covered++;
            coveredGroups.add(groupIndex);
            score += best;
        }
        else if (g.related.some(t => entry.fields.slice(0, -1).some(f => matches(f, t))))
            score += 30;
    }
    const complete = plan.groups.length > 0 && (plan.anyOf?.length ? plan.anyOf.some(clause => clause.every(i => coveredGroups.has(i))) : plan.alternatives ? covered > 0 : covered === plan.groups.length);
    return { entry, complete, direct, covered, score: score + (complete ? 10000 : 0) + covered * 500 + direct };
}
function finalize(index: TopicSuggestionIndex, query: string, ranked: Ranked[]): TopicSemanticResult {
    ranked.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);
    const direct = ranked.filter(r => r.direct > 0).slice(0, 10), used = new Set(direct.map(r => r.entry.topic.id));
    const anchors = ranked.filter(r => r.covered > 0 || r.score > 0).slice(0, 20);
    const related = ranked.filter(r => !used.has(r.entry.topic.id)).map(r => { let proximity = 0; if (!r.score)
        for (const a of anchors) {
            let shared = 0;
            while (shared < a.entry.topic.path.length && shared < r.entry.topic.path.length && a.entry.topic.path[shared] === r.entry.topic.path[shared])
                shared++;
            if (shared >= 2)
                proximity = Math.max(proximity, 15 + shared);
        } return { ...r, score: r.score || proximity }; }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.entry.order - b.entry.order).slice(0, 100 - direct.length);
    for (const r of related)
        used.add(r.entry.topic.id);
    let hash = 2166136261;
    for (const c of normalizeSearchText(query))
        hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    const fallback: Ranked[] = [];
    const start = (hash >>> 0) % Math.max(1, index.entries.length);
    for (let i = 0; fallback.length + direct.length + related.length < 100 && i < index.entries.length; i++) {
        const entry = index.entries[(start + i * 7919) % index.entries.length];
        if (used.has(entry.topic.id))
            continue;
        used.add(entry.topic.id);
        fallback.push({ entry, score: 0, direct: 0, complete: false, covered: 0 });
    }
    // A stride may share factors with a custom catalog's size.
    for (const entry of index.entries) {
        if (fallback.length + direct.length + related.length >= 100)
            break;
        if (!used.has(entry.topic.id)) {
            used.add(entry.topic.id);
            fallback.push({ entry, score: 0, direct: 0, complete: false, covered: 0 });
        }
    }
    const suggest = (r: Ranked, group: TopicSuggestionGroup): TopicSuggestion => ({ id: r.entry.topic.id, label: r.entry.topic.label, path: r.entry.topic.path, group });
    const matched = ranked.filter(r => r.complete), visible = new Set<string>(), ancestors = new Set<string>();
    for (const { entry } of matched) {
        visible.add(entry.topic.id);
        let parent = entry.parent;
        while (parent) {
            visible.add(parent);
            ancestors.add(parent);
            parent = index.byId.get(parent)?.parent;
        }
    }
    return { suggestions: [...direct.map(r => suggest(r, "keyword")), ...related.map(r => suggest(r, "related")), ...fallback.map(r => suggest(r, "explore"))], matchedIds: matched.map(r => r.entry.topic.id), completeCoverage: matched.length > 0, visibleIds: [...visible], matchingDescendants: [...ancestors], directScores: matched.map(r => [r.entry.topic.id, r.score]) };
}
function planFor(query: string, enrichment: TopicQueryPlan | string[]): TopicQueryPlan {
    const p = Array.isArray(enrichment) ? enrichment.length ? { groups: [{ label: "subject", equivalents: enrichment, related: [] }] } : localTopicPlan(query) : validateTopicPlan(enrichment);
    const plan = p.groups.length ? p : localTopicPlan(query);
    if (!Array.isArray(enrichment) && p.groups.length) {
        for (const original of localTopicPlan(query).groups.filter(g => CONCEPTS.includes(g)))
            if (!plan.groups.some(g => g.equivalents.some(t => original.equivalents.includes(normalizeSearchText(t)))))
                plan.groups.push(original);
    }
    return { ...plan, groups: plan.groups.map(g => ({ ...g, equivalents: Array.from(new Set(g.equivalents.flatMap(t => conceptAliases.get(normalizeSearchText(t)) || [t]))) })) };
}
export function searchTopicIndex(index: TopicSuggestionIndex, query: string, enrichment: TopicQueryPlan | string[] = []): TopicSemanticResult { if (!query.trim())
    return { suggestions: [], matchedIds: [], completeCoverage: false, visibleIds: [], matchingDescendants: [], directScores: [] }; const plan = planFor(query, enrichment); return finalize(index, query, index.entries.map(e => rank(e, query, plan))); }
export function suggestTopics(index: TopicSuggestionIndex, query: string, enrichment: TopicQueryPlan | string[] = []) { return searchTopicIndex(index, query, enrichment).suggestions; }
export async function searchTopicIndexYielding(index: TopicSuggestionIndex, query: string, enrichment: TopicQueryPlan | string[] = [], isCurrent: () => boolean = () => true) { const plan = planFor(query, enrichment), ranked: Ranked[] = []; for (let start = 0; start < index.entries.length; start += 400) {
    if (!isCurrent())
        return null;
    for (const e of index.entries.slice(start, start + 400))
        ranked.push(rank(e, query, plan));
    if (start + 400 < index.entries.length)
        await new Promise(r => setTimeout(r, 0));
} return isCurrent() ? finalize(index, query, ranked) : null; }
