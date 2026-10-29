import { searchTextForms, protectedSearchTerms, contextualSearchText } from "./search";
import type { SearchableVideoMetadata } from "./video-metadata";
/** Shared, dependency-free search policy. The native runtime is generated from this file. */
export type VideoSearchPlan = {
  terms?: string[]; include?: string[]; alternatives?: string[]; exclude?: string[];
  topics?: string[]; topicHints?: string[];
  conceptGroups?: Array<{ label?: string; terms: string[]; related?: string[]; required?: boolean }>;
  anyOf?: number[][];
  channel?: string; channelId?: string; dateIntent?: "upload" | "event" | "either";
  minDate?: string; maxDate?: string; minDurationSeconds?: number; maxDurationSeconds?: number;
  sort?: "relevance" | "newest" | "oldest" | "random";
};
export const VIDEO_SEARCH_TOPICS = ["History", "Politics", "Geography", "Science", "Nature", "Mathematics", "Literature", "Sports", "Culture", "Technology"] as const;
export const MAX_VIDEO_SEARCH_RESULT_LIMIT = 10_000;
const MAX_VIDEO_SEARCH_QUERY_LENGTH = 4_096;
const MAX_VIDEO_SEARCH_FILTER_TEXT_LENGTH = 512;
const MAX_VIDEO_SEARCH_FILTER_ITEMS = 256;
const MAX_VIDEO_SEARCH_EXCLUDED_IDS = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

function isBoundedString(value: unknown, maximum = MAX_VIDEO_SEARCH_FILTER_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function isStringList(value: unknown, maximumItems = MAX_VIDEO_SEARCH_FILTER_ITEMS): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems && value.every(item => isBoundedString(item));
}

function isVideoSearchPlan(value: unknown): value is VideoSearchPlan {
  if (!isRecord(value)) return false;
  const allowedFields = new Set(["terms", "include", "alternatives", "exclude", "topics", "topicHints", "conceptGroups", "anyOf", "channel", "channelId", "dateIntent", "minDate", "maxDate", "minDurationSeconds", "maxDurationSeconds", "sort"]);
  if (Object.keys(value).some(field => !allowedFields.has(field))) return false;
  for (const field of ["terms", "include", "alternatives", "exclude", "topics", "topicHints"] as const) {
    if (value[field] !== undefined && !isStringList(value[field])) return false;
  }
  if (value.conceptGroups !== undefined) {
    if (!Array.isArray(value.conceptGroups) || value.conceptGroups.length > 64) return false;
    for (const group of value.conceptGroups) {
      if (!isRecord(group) || Object.keys(group).some(field => !["label", "terms", "related", "required"].includes(field))
        || !isStringList(group.terms, 64) || group.terms.length === 0
        || group.label !== undefined && !isBoundedString(group.label)
        || group.related !== undefined && !isStringList(group.related, 128)
        || group.required !== undefined && typeof group.required !== "boolean") return false;
    }
  }
  if (value.anyOf !== undefined) {
    const conceptGroupCount = Array.isArray(value.conceptGroups) ? value.conceptGroups.length : -1;
    if (!Array.isArray(value.anyOf) || value.anyOf.length > 64 || conceptGroupCount < 0) return false;
    for (const clause of value.anyOf) {
      if (!Array.isArray(clause) || clause.length === 0 || clause.length > 64
        || !clause.every(index => Number.isSafeInteger(index) && index >= 0 && index < conceptGroupCount)) return false;
    }
  }
  for (const field of ["channel", "channelId"] as const) if (value[field] !== undefined && !isBoundedString(value[field], 256)) return false;
  if (value.dateIntent !== undefined && !["upload", "event", "either"].includes(value.dateIntent as string)) return false;
  for (const field of ["minDate", "maxDate"] as const) {
    if (value[field] !== undefined && (!isBoundedString(value[field], 64) || !Number.isFinite(Date.parse(value[field] as string)))) return false;
  }
  if (value.minDate && value.maxDate && Date.parse(value.minDate as string) > Date.parse(value.maxDate as string)) return false;
  for (const field of ["minDurationSeconds", "maxDurationSeconds"] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "number" || !Number.isFinite(value[field]) || (value[field] as number) < 0)) return false;
  }
  if (typeof value.minDurationSeconds === "number" && typeof value.maxDurationSeconds === "number" && value.minDurationSeconds > value.maxDurationSeconds) return false;
  if (value.sort !== undefined && !["relevance", "newest", "oldest", "random"].includes(value.sort as string)) return false;
  return true;
}

/** Validate a worker search payload before it allocates filters or starts ranking. */
export function isValidVideoSearchRequest(value: unknown): value is {
  type: "search"; requestId: number; revision: number; query: string; plan: VideoSearchPlan;
  topic: "All" | typeof VIDEO_SEARCH_TOPICS[number]; channelId?: string; limit: number;
  excludedIds?: string[]; expanded?: boolean; viewKey?: string;
} {
  if (!isRecord(value) || value.type !== "search"
    || !Number.isSafeInteger(value.requestId) || (value.requestId as number) < 0
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0
    || !isBoundedString(value.query, MAX_VIDEO_SEARCH_QUERY_LENGTH)
    || !isVideoSearchPlan(value.plan)
    || value.topic !== "All" && !(VIDEO_SEARCH_TOPICS as readonly unknown[]).includes(value.topic)
    || !Number.isSafeInteger(value.limit) || (value.limit as number) < 1 || (value.limit as number) > MAX_VIDEO_SEARCH_RESULT_LIMIT
    || value.channelId !== undefined && !isBoundedString(value.channelId, 256)
    || value.excludedIds !== undefined && !isStringList(value.excludedIds, MAX_VIDEO_SEARCH_EXCLUDED_IDS)
    || value.expanded !== undefined && typeof value.expanded !== "boolean"
    || value.viewKey !== undefined && !isBoundedString(value.viewKey, 1_024)) return false;
  return true;
}

type Field = { name: string; value: string; text: string; words: Set<string> };
type Video = SearchableVideoMetadata & {
  specialPlaylistEligible?: boolean;
  normalizedChannelName?: string;
  searchFields?: Field[];
};
export type IndexedVideoSearchMetadata = SearchableVideoMetadata & {
  specialPlaylistEligible: boolean;
  /** Worker-only derived fields; never included in catalog or worker messages. */
  normalizedChannelName: string;
  searchFields: Field[];
};
export type VideoConceptCoverage = { matchedConcepts: number[]; missingConcepts: number[]; complete: boolean };
export type SemanticCandidate<T extends Video> = { coverage: VideoConceptCoverage; video: T; score: number; matchedFields: string[]; supportingText: string[] };
export const VIDEO_SEMANTIC_VERSION = 9;

type PreparedConceptGroup = Readonly<{ label?: string; terms: readonly string[]; connectedTerms: readonly string[]; related?: readonly string[]; required?: boolean }>;
export type ImmutableVideoSearchPlan = Omit<Readonly<VideoSearchPlan>, "terms" | "include" | "alternatives" | "exclude" | "topics" | "topicHints" | "conceptGroups" | "anyOf"> & {
  terms?: readonly string[];
  include?: readonly string[];
  alternatives?: readonly string[];
  exclude?: readonly string[];
  topics?: readonly string[];
  topicHints?: readonly string[];
  conceptGroups?: readonly Readonly<{ label?: string; terms: readonly string[]; related?: readonly string[]; required?: boolean }>[];
  anyOf?: readonly (readonly number[])[];
};
export type PreparedVideoSearch = Readonly<{
  plan: ImmutableVideoSearchPlan;
  topic: string;
  selectedChannelId?: string;
  groups: readonly PreparedConceptGroup[];
  coverageClauses: readonly (readonly number[])[];
  exclusionGroups: readonly (readonly string[])[];
  allGroupIndexes: readonly number[];
  requiredGroupCount: number;
  related: readonly string[];
  exactTitleTerms: readonly string[];
  normalizedTopics: readonly string[];
  topicHints: readonly string[];
  planChannelId?: string;
  hasDateBounds: boolean;
  minDateTime?: number;
  maxDateTime?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  sort?: VideoSearchPlan["sort"];
  filterOnly: boolean;
}>;

const RESTRICTED_PLAYLIST_CHANNEL_ID = "UCYO_jab_esuFRV4b17AJtAw";
const APPROVED_3BLUE_PLAYLIST_IDS = new Set([
  "PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi",
  "PL4cNQ1YkG5WhQGmPnRe4vDUImh_nviriy",
]);

function computeSpecialPlaylistEligibility(video: SearchableVideoMetadata, normalizedChannelName = normalizeVideoQuery(video.channelName)) {
  const restrictedChannel = video.channelId === RESTRICTED_PLAYLIST_CHANNEL_ID || normalizedChannelName === "3blue1brown";
  return !restrictedChannel || Boolean(video.special) || (video.sourceIds || []).some((id) => APPROVED_3BLUE_PLAYLIST_IDS.has(id.replace(/^playlist:/, "")));
}

/** Validate a whole worker update before touching its published catalog. */
export function validateVideoSearchCatalogUpdate(revision: number, documents: SearchableVideoMetadata[], removeIds: string[] = [], orderIds?: string[]) {
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
  if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(documents) || !strings(removeIds) || (orderIds !== undefined && !strings(orderIds))) throw new Error("Invalid video catalog update.");
  for (const video of documents) {
    if (!video || typeof video.id !== "string" || !video.id.length
      || ![video.channelId, video.channelName, video.title, video.description, video.publishedAt].every(value => typeof value === "string")
      || !strings(video.tags) || !strings(video.topics) || typeof video.approved !== "boolean"
      || !Number.isFinite(video.durationSeconds) || video.durationSeconds < 0
      || (video.special !== undefined && typeof video.special !== "boolean")
      || (video.sourceIds !== undefined && !strings(video.sourceIds))) throw new Error("Invalid video search document.");
  }
}

/** Add worker-only eligibility metadata without changing or dropping provenance. */
function sameStringList(left: string[] | undefined, right: string[] | undefined) {
  const a = left || [], b = right || [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSearchTextFields(previous: IndexedVideoSearchMetadata, next: SearchableVideoMetadata) {
  return previous.title === next.title && previous.description === next.description
    && sameStringList(previous.tags, next.tags) && sameStringList(previous.topics, next.topics);
}

export function indexVideoSearchMetadata(video: SearchableVideoMetadata, previous?: IndexedVideoSearchMetadata): IndexedVideoSearchMetadata {
  const normalizedChannelName = previous?.channelName === video.channelName
    ? previous.normalizedChannelName
    : normalizeVideoQuery(video.channelName);
  const searchFields = previous && sameSearchTextFields(previous, video) ? previous.searchFields : createSearchFields(video, previous?.searchFields);
  return { ...video, specialPlaylistEligible: computeSpecialPlaylistEligibility(video, normalizedChannelName), normalizedChannelName, searchFields };
}

function hasEligibleSpecialPlaylist(video: Video) {
  return typeof video.specialPlaylistEligible === "boolean" ? video.specialPlaylistEligible : computeSpecialPlaylistEligibility(video);
}

function immutablePlan(plan: VideoSearchPlan): ImmutableVideoSearchPlan {
  const input = { ...plan };
  const snapshot: VideoSearchPlan = {
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
      if (Array.isArray(value)) for (const item of value) if (Array.isArray(item)) Object.freeze(item);
      Object.freeze(value);
    }
  }
  for (const group of snapshot.conceptGroups ?? []) {
    Object.freeze(group.terms);
    if (group.related) Object.freeze(group.related);
    Object.freeze(group);
  }
  if (snapshot.conceptGroups) Object.freeze(snapshot.conceptGroups);
  return Object.freeze(snapshot) as unknown as ImmutableVideoSearchPlan;
}

function stableSearchKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSearchKey).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableSearchKey(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

/** A small per-search cache so chunking and pagination reuse the same compiled filters. */
export class PreparedVideoSearchCache {
  private readonly entries = new Map<string, PreparedVideoSearch>();
  private revision?: string | number;
  private scope?: string;
  constructor(private readonly maxEntries = 4) {}

  get(plan: VideoSearchPlan, topic = "All", channelId?: string, catalogRevision: string | number = 0, scope = "") {
    if (this.revision !== catalogRevision || this.scope !== scope) {
      this.entries.clear();
      this.revision = catalogRevision;
      this.scope = scope;
    }
    const key = stableSearchKey([VIDEO_SEMANTIC_VERSION, catalogRevision, scope, plan, topic, channelId]);
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }
    const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
    if (this.maxEntries > 0) {
      this.entries.set(key, prepared);
      while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    }
    return prepared;
  }

  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }
}

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
export function normalizeVideoQuery(value: string) { return String(value || "").replace(/[\u2010-\u2015\u2212]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " "); }
const equivalentTerms = new Map(CONCEPTS.flatMap((terms) => terms.map((term) => [normalizeVideoQuery(term), terms] as const)));
const aliases = CONCEPTS.flatMap((terms, id) => terms.map((term) => ({ term: normalizeVideoQuery(term), id }))).sort((a, b) => b.term.length - a.term.length);
function contains(text: string, phrase: string) { return (` ${text} `).includes(` ${phrase} `); }
function meaningful(value: string) { return normalizeVideoQuery(value).split(" ").filter((word) => !STOP.has(word) && (word.length > 2 || word === "ai" || /^\d+$/.test(word))); }
function expand(term: string) { const normalized = normalizeVideoQuery(term); return equivalentTerms.get(normalized) || [term]; }
function groupsFor(value: string) {
  value = contextualSearchText(value);
  let remaining = normalizeVideoQuery(value);
  const groups: NonNullable<VideoSearchPlan["conceptGroups"]> = [];
  for (const term of protectedSearchTerms(value)) {
    groups.push({ label: term, terms: [term], required: true });
    remaining = (` ${remaining} `).split(` ${term} `).join(" ").trim();
  }
  const seen = new Set<number>();
  for (const alias of aliases) if (contains(remaining, alias.term)) {
    if (!seen.has(alias.id)) { groups.push({ label: CONCEPTS[alias.id][0], terms: CONCEPTS[alias.id], required: true }); seen.add(alias.id); }
    remaining = (` ${remaining} `).split(` ${alias.term} `).join(" ").trim();
  }
  for (const word of meaningful(remaining)) groups.push({ label: word, terms: [word], required: true });
  return groups;
}
export function makeLocalVideoPlan(query: string, channels: Array<{ id: string; name: string; handle?: string }> = [], selectedChannelId?: string): VideoSearchPlan {
  let core = query;
  const plan: VideoSearchPlan = { terms: [], exclude: [], conceptGroups: [], channelId: selectedChannelId, sort: "relevance" };
  core = core.replace(/\b(?:without|excluding|exclude|not about)\s+(.+?)(?=\s+(?:uploaded|posted|published|under|over|from|by|without|excluding|exclude|not about)\b|[,;]|$)/gi, (_, phrase: string) => { plan.exclude!.push(phrase.trim()); return " "; });
  // Dates without an upload cue remain content concepts (e.g. Europe after 1800).
  core = core.replace(/\b(?:uploaded|posted|published|released)\s+(after|since|before|in)\s+(\d{4})(?:-(\d{2})-(\d{2}))?/gi, (_, intent: string, year: string, month?: string, day?: string) => {
    const date = `${year}-${month || "01"}-${day || "01"}`;
    if (!Number.isFinite(Date.parse(date))) return _;
    plan.dateIntent = "upload";
    if (intent.toLowerCase() === "before") {
      const before = new Date(Date.parse(date) - 1).toISOString();
      plan.maxDate = plan.maxDate && plan.maxDate < before ? plan.maxDate : before;
    }
    else {
      const after = intent.toLowerCase() === "after" ? (month ? new Date(Date.parse(date) + 86400000).toISOString().slice(0,10) : `${Number(year)+1}-01-01`) : date;
      plan.minDate = plan.minDate && plan.minDate > after ? plan.minDate : after;
    }
    if (intent.toLowerCase() === "in") {
      const end = `${date}T23:59:59.999Z`;
      const through = month ? end : `${year}-12-31T23:59:59.999Z`;
      plan.maxDate = plan.maxDate && plan.maxDate < through ? plan.maxDate : through;
    }
    return " ";
  });
  core = core.replace(/\b(?:uploaded|posted|published)\s+(?:within|in|during)\s+the\s+(?:last|past)\s+(week|month|year)\b/gi, (_, unit: string) => { plan.dateIntent = "upload"; const since = new Date(Date.now() - ({week:7,month:31,year:366}[unit.toLowerCase()] || 7)*86400000).toISOString().slice(0,10); plan.minDate = plan.minDate && plan.minDate > since ? plan.minDate : since; return " "; });
  core = core.replace(/\b(under|below|shorter than|less than|over|above|longer than|more than)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi, (_, direction: string, amount: string, unit: string) => {
    const seconds = Number(amount) * (/^(hour|hr)/i.test(unit) ? 3600 : /^(min)/i.test(unit) ? 60 : 1);
    if (/^(under|below|shorter|less)/i.test(direction)) plan.maxDurationSeconds = Math.min(plan.maxDurationSeconds ?? Infinity, Math.max(0,Math.ceil(seconds)-1)); else plan.minDurationSeconds = Math.max(plan.minDurationSeconds ?? 0, Math.floor(seconds)+1);
    return " ";
  });
  const namedChannel = channels.find((channel) => [channel.name, channel.handle || ""].filter(Boolean).some((name) => contains(normalizeVideoQuery(core), normalizeVideoQuery(name))));
  if (namedChannel && /\b(from|by|channel)\b|@/i.test(core)) {
    if (selectedChannelId && selectedChannelId !== namedChannel.id) plan.channelId = "__conflicting_channel__";
    else plan.channelId = namedChannel.id;
    for (const name of [namedChannel.name, namedChannel.handle || ""].filter(Boolean)) core = core.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
    core = core.replace(/\b(from|by|channel)\b/gi, " ");
  }
  if (!namedChannel && /(?:\bchannel\s+|@)[\w.-]+/i.test(core)) plan.channelId = "__unknown_channel__";
  core = core.replace(/\b(newest|latest|oldest|earliest|random)\b/gi, (sort) => { plan.sort = /newest|latest/i.test(sort) ? "newest" : /oldest|earliest/i.test(sort) ? "oldest" : "random"; return " "; });
  const clauseGroups = (value: string) => {
    const quoted: NonNullable<VideoSearchPlan["conceptGroups"]> = [];
    const unquoted = value.replace(/"([^"\n]+)"/g, (_, phrase: string) => { quoted.push({ label: phrase, terms: [phrase], required: true }); return " "; });
    return [...groupsFor(unquoted), ...quoted];
  };
  const orParts = core.split(/\bor\b(?=(?:[^"]*"[^"]*")*[^"]*$)/i);
  if (orParts.length > 1) {
    const clauses = orParts.map(clauseGroups).filter(groups => groups.length);
    plan.conceptGroups = clauses.flat();
    let offset = 0;
    plan.anyOf = clauses.map(groups => { const ids = groups.map((_, i) => offset + i); offset += groups.length; return ids; });
  } else plan.conceptGroups = clauseGroups(core);
  plan.terms = [meaningful(core).join(" ")].filter(Boolean);
  return plan;
}

export function mergeVideoSearchPlans(local: VideoSearchPlan, interpreted: VideoSearchPlan, _channels: Array<{ id: string; name: string; handle?: string }>, selectedChannelId?: string): VideoSearchPlan {
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
function sameVideoConcept(a: NonNullable<VideoSearchPlan["conceptGroups"]>[number], b: NonNullable<VideoSearchPlan["conceptGroups"]>[number]) {
  const terms = new Set(a.terms.flatMap(expand).map(normalizeVideoQuery));
  return b.terms.flatMap(expand).some(term => terms.has(normalizeVideoQuery(term)));
}
function enrichVideoGroup(group: NonNullable<VideoSearchPlan["conceptGroups"]>[number], enriched: NonNullable<VideoSearchPlan["conceptGroups"]>) {
  const matches = enriched.filter(other => sameVideoConcept(group, other));
  return { ...group, required: true, terms: [...new Set([...group.terms, ...matches.flatMap(other => other.terms).filter(term => { const known = equivalentTerms.get(normalizeVideoQuery(term)); return !known || known.some(value => group.terms.flatMap(expand).map(normalizeVideoQuery).includes(normalizeVideoQuery(value))); })])], related: matches.flatMap(other => other.related || []) };
}
function preserveVideoConcepts(local: NonNullable<VideoSearchPlan["conceptGroups"]>, enriched: NonNullable<VideoSearchPlan["conceptGroups"]>) {
  const protectedGroups = local.filter(group => CONCEPTS.some(terms => terms[0] === group.label));
  return [
    ...enriched.filter(group => !protectedGroups.some(original => sameVideoConcept(original, group))).map(group => ({ ...group, required: true })),
    ...protectedGroups.map(group => enrichVideoGroup(group, enriched))
  ];
}
const index = new WeakMap<Video, Field[]>();
const BOILERPLATE = /\b(subscribe|patreon|sponsor(?:ed)?|affiliate|merch|use code|follow (?:me|us)|support (?:me|us|the channel)|buy (?:my|our)|(?:our|my|this) (?:other )?channel|check out (?:our|my)|channel advertisement)\b/i;
function cleanDescription(value: string) { return value.split(/\n+|(?<=[.!?])\s+/).filter((part) => !BOILERPLATE.test(part)).join(" ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim().slice(0,6000); }
function createSearchFields(video: SearchableVideoMetadata, previousFields?: Field[]): Field[] {
  const previousByName = new Map(previousFields?.map((field) => [field.name, field]));
  return [["title", video.title], ["tags", (video.tags || []).join(", ")], ["description", cleanDescription(video.description || "")], ["topics", (video.topics || []).join(" ")]]
    .map(([name, value]) => {
      const previous = previousByName.get(name);
      if (previous?.value === value) return previous;
      const text = searchTextForms(contextualSearchText(value)).join(" ");
      return { name, value, text, words: new Set(text.split(" ")) };
    });
}
function fieldsFor(video: Video) {
  if (video.searchFields) return video.searchFields;
  const cached = index.get(video); if (cached) return cached;
  const fields = createSearchFields(video);
  index.set(video, fields); return fields;
}
function hasPrefix(words: Set<string>, word: string) { for (const candidate of words) if (candidate.length >= 5 && Math.abs(candidate.length-word.length) <= 2 && (candidate.startsWith(word) || word.startsWith(candidate))) return true; return false; }
function matchesTerm(term: string, field: Field) {
  const text = normalizeVideoQuery(term);
  if (!text) return false;
  if (contains(field.text, text)) return true;
  const words = protectedSearchTerms(term).includes(text) ? text.split(" ") : meaningful(text);
  return words.length > 0 && words.every((word) => field.words.has(word) || (word.length >= 5 && hasPrefix(field.words, word)));
}
function passage(field: Field, term: string) {
  const sentences = field.name === "description" ? field.value.split(/(?<=[.!?])\s+/) : [field.value];
  const matching = sentences.find((value) => matchesTerm(term,{...field,text:searchTextForms(contextualSearchText(value)).join(" "),words:new Set(searchTextForms(contextualSearchText(value)).join(" ").split(" "))}));
  const value = matching || field.value;
  const words = meaningful(term);
  const hit = value.toLowerCase().indexOf(words[0] || term.toLowerCase());
  const start = value.length > 320 && hit > 240 ? Math.max(0,hit-80) : 0;
  return value.slice(start,start+320);
}
// Connection evidence stays inside one short passage, or the title and opening passage.
const nearbyIndex = new WeakMap<Video, Array<{ fields: Field[]; bonus: number }>>();
function localField(name: string, value: string): Field {
  const text = searchTextForms(contextualSearchText(value)).join(" ");
  return {name,value,text,words:new Set(text.split(" "))};
}
function nearbyUnits(video: Video) {
  const cached = nearbyIndex.get(video); if (cached) return cached;
  const title = fieldsFor(video)[0];
  const units = [{fields:[title],bonus:30}];
  let lead: Field | undefined;
  for (const paragraph of video.description.slice(0,6000).split(/\n+/)) {
    // Keep paragraph boundaries even after removing advertisements and links.
    const runs: string[][] = [[]];
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (BOILERPLATE.test(sentence)) { runs.push([]); continue; }
      const clean=cleanDescription(sentence); if(clean) runs[runs.length-1].push(clean);
    }
    for (const sentences of runs) for (let i=0;i<sentences.length;i++) {
      const pair = [sentences[i],sentences[i+1]].filter(Boolean).join(" ");
      const value = pair;
      for (let start=0;start<value.length;start+=240) {
        const from = start ? value.indexOf(" ",start) + 1 : 0;
        if (start && from === 0) break;
        const end = value.length <= from+480 ? value.length : value.lastIndexOf(" ",from+480);
        if (end <= from) continue;
        const field = localField("description",value.slice(from,end));
        units.push({fields:[field],bonus:16});
        if (!lead) lead=field;
        if (end === value.length) break;
      }
    }
  }
  if (lead) units.push({fields:[title,lead],bonus:8});
  for (const tag of video.tags || []) if (tag.length <= 480) units.push({fields:[localField("tags",tag)],bonus:4});
  nearbyIndex.set(video,units); return units;
}
function matchedGroups(fields: Field[], groups: NonNullable<VideoSearchPlan["conceptGroups"]>) {
  return groups.flatMap((group,i)=>group.terms.flatMap(expand).some(term=>fields.some(field=>matchesTerm(term,field))) ? [i] : []);
}
function connectedCoverage(video: Video, groups: NonNullable<VideoSearchPlan["conceptGroups"]>, anyOf: number[][] | undefined, global: VideoConceptCoverage) {
  if (!global.complete || groups.filter(g=>g.required!==false).length<2) return {coverage:global,bonus:0,fields:undefined as Field[] | undefined};
  const titleFields=[fieldsFor(video)[0]];
  const titleCoverage=coverageFor(groups,matchedGroups(titleFields,groups),anyOf);
  if(titleCoverage.complete) return {coverage:titleCoverage,bonus:30,fields:titleFields};
  let best = {coverage:{...global,complete:false,matchedConcepts:[] as number[],missingConcepts:groups.map((_,i)=>i)},bonus:0,fields:undefined as Field[] | undefined};
  for (const unit of nearbyUnits(video)) {
    const coverage = coverageFor(groups,matchedGroups(unit.fields,groups),anyOf);
    if (coverage.complete && !best.coverage.complete || coverage.complete===best.coverage.complete && (coverage.missingConcepts.length<best.coverage.missingConcepts.length || coverage.missingConcepts.length===best.coverage.missingConcepts.length && unit.bonus>best.bonus)) best={coverage,bonus:unit.bonus,fields:unit.fields};
  }
  return best;
}

function requiredGroups(plan: VideoSearchPlan): NonNullable<VideoSearchPlan["conceptGroups"]> {
  if (plan.conceptGroups?.length) return [...plan.conceptGroups, ...(plan.include || []).filter((term) => !plan.conceptGroups!.some((group) => group.terms.some((variant) => normalizeVideoQuery(variant) === normalizeVideoQuery(term)))).map((term) => ({terms:expand(term),required:true}))];
  return [...(plan.terms || []).map(term => ({terms:expand(term),required:true})), ...(plan.include || []).map((term) => ({terms:expand(term),required:true}))];
}

export function prepareSemanticVideoSearch(plan: VideoSearchPlan, topic = "All", channelId?: string): PreparedVideoSearch {
  const snapshot = immutablePlan(plan);
  const groups = Object.freeze(requiredGroups(snapshot as unknown as VideoSearchPlan).map(group => {
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
    ? snapshot.anyOf.map(clause => Object.freeze([...clause.filter(index => groups[index]?.required !== false), ...required.filter(index => !snapshot.anyOf!.some(other => other.includes(index)))]))
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

function eligiblePreparedSemanticVideo(video: Video, prepared: PreparedVideoSearch, excludedIds: ReadonlySet<string>) {
  if (!video.approved || excludedIds.has(video.id) || /#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(video.title) || /#shorts?\b/i.test(video.description || "") || (video.tags || []).some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalizeVideoQuery(tag)))) return false;
  if (!hasEligibleSpecialPlaylist(video)) return false;
  if (prepared.selectedChannelId && video.channelId !== prepared.selectedChannelId || prepared.planChannelId && video.channelId !== prepared.planChannelId) return false;
  if (prepared.topic !== "All" && !(video.topics || []).includes(prepared.topic)) return false;
  if (prepared.normalizedTopics.length && !(video.topics || []).some(topic => prepared.normalizedTopics.includes(normalizeVideoQuery(topic)))) return false;
  if (prepared.hasDateBounds) {
    const uploaded = Date.parse(video.publishedAt);
    if (!Number.isFinite(uploaded) || prepared.minDateTime !== undefined && uploaded < prepared.minDateTime || prepared.maxDateTime !== undefined && uploaded > prepared.maxDateTime) return false;
  }
  if ((prepared.minDurationSeconds !== undefined || prepared.maxDurationSeconds !== undefined) && !Number.isFinite(video.durationSeconds)) return false;
  if (prepared.minDurationSeconds !== undefined && video.durationSeconds < prepared.minDurationSeconds || prepared.maxDurationSeconds !== undefined && video.durationSeconds > prepared.maxDurationSeconds) return false;
  const fields = fieldsFor(video);
  return !prepared.exclusionGroups.some(group => group.some(variant => fields.some(field => matchesTerm(variant, field))));
}

function coverageForPrepared(groups: readonly PreparedConceptGroup[], matchedConcepts: number[], clauses: readonly (readonly number[])[]): VideoConceptCoverage {
  const matched = new Set(matchedConcepts);
  const missing = clauses.map(clause => clause.filter(index => !matched.has(index))).sort((a, b) => a.length - b.length)[0] || [];
  return { matchedConcepts, missingConcepts: missing, complete: !missing.length };
}

function matchedPreparedGroups(fields: Field[], groups: readonly PreparedConceptGroup[]) {
  const matched: number[] = [];
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    if (group.connectedTerms.some(term => fields.some(field => matchesTerm(term, field)))) matched.push(index);
  }
  return matched;
}

function connectedPreparedCoverage(video: Video, prepared: PreparedVideoSearch, global: VideoConceptCoverage) {
  const { groups } = prepared;
  if (!global.complete || prepared.requiredGroupCount < 2) return { coverage: global, bonus: 0, fields: undefined as Field[] | undefined };
  const titleFields = [fieldsFor(video)[0]];
  const titleCoverage = coverageForPrepared(groups, matchedPreparedGroups(titleFields, groups), prepared.coverageClauses);
  if (titleCoverage.complete) return { coverage: titleCoverage, bonus: 30, fields: titleFields };
  let best = { coverage: { ...global, complete: false, matchedConcepts: [] as number[], missingConcepts: [...prepared.allGroupIndexes] }, bonus: 0, fields: undefined as Field[] | undefined };
  for (const unit of nearbyUnits(video)) {
    const coverage = coverageForPrepared(groups, matchedPreparedGroups(unit.fields, groups), prepared.coverageClauses);
    if (coverage.complete && !best.coverage.complete || coverage.complete === best.coverage.complete && (coverage.missingConcepts.length < best.coverage.missingConcepts.length || coverage.missingConcepts.length === best.coverage.missingConcepts.length && unit.bonus > best.bonus)) best = { coverage, bonus: unit.bonus, fields: unit.fields };
  }
  return best;
}

export function eligibleSemanticVideo(video: Video, plan: VideoSearchPlan, topic = "All", selectedChannelId?: string, excludedIds = new Set<string>()) {
  if (!video.approved || excludedIds.has(video.id) || /#shorts?\b|\byoutube shorts?\b|\bshorts video\b/i.test(video.title) || /#shorts?\b/i.test(video.description || "") || (video.tags || []).some((tag) => ["shorts", "youtube short", "youtube shorts"].includes(normalizeVideoQuery(tag)))) return false;
  if (!hasEligibleSpecialPlaylist(video)) return false;
  if (selectedChannelId && video.channelId !== selectedChannelId || plan.channelId && video.channelId !== plan.channelId) return false;
  if (topic !== "All" && !(video.topics || []).includes(topic)) return false;
  if (plan.topics?.length && !(video.topics || []).some((topic) => plan.topics!.some((value) => normalizeVideoQuery(value) === normalizeVideoQuery(topic)))) return false;
  if (plan.minDate || plan.maxDate) {
    const uploaded = Date.parse(video.publishedAt);
    if (!Number.isFinite(uploaded) || plan.minDate && uploaded < Date.parse(plan.minDate) || plan.maxDate && uploaded > Date.parse(plan.maxDate)) return false;
  }
  if ((plan.minDurationSeconds !== undefined || plan.maxDurationSeconds !== undefined) && !Number.isFinite(video.durationSeconds)) return false;
  if (plan.minDurationSeconds !== undefined && video.durationSeconds < plan.minDurationSeconds || plan.maxDurationSeconds !== undefined && video.durationSeconds > plan.maxDurationSeconds) return false;
  const fields = fieldsFor(video);
  return !(plan.exclude || []).some((term) => expand(term).some((variant) => fields.some((field) => matchesTerm(variant,field))));
}
function coverageFor(groups: NonNullable<VideoSearchPlan["conceptGroups"]>, matchedConcepts: number[], anyOf?: number[][]): VideoConceptCoverage {
  const matched = new Set(matchedConcepts);
  const required = groups.flatMap((group, i) => group.required !== false && group.terms.length ? [i] : []);
  const clauses = anyOf?.length ? anyOf.map(clause => [...clause.filter(i => groups[i]?.required !== false), ...required.filter(i => !anyOf.some(c => c.includes(i)))]) : [required];
  const missing = clauses.map(clause => clause.filter(i => !matched.has(i))).sort((a,b) => a.length-b.length)[0] || [];
  return { matchedConcepts, missingConcepts: missing, complete: !missing.length };
}
export function videoConceptCoverage<T extends Video>(video: T, plan: VideoSearchPlan): VideoConceptCoverage {
  const fields = fieldsFor(video), groups = requiredGroups(plan);
  const matched = groups.flatMap((group, i) => group.terms.flatMap(expand).some(term => fields.filter(field => field.name !== "topics").some(field => matchesTerm(term,field))) ? [i] : []);
  return connectedCoverage(video,groups,plan.anyOf,coverageFor(groups, matched, plan.anyOf)).coverage;
}
export function semanticCoverage<T extends Video>(video: T, plan: VideoSearchPlan) {
  return requiredGroups(plan).length > 0 && videoConceptCoverage(video,plan).complete;
}
export function compareSemanticCandidates<T extends Video>(a: SemanticCandidate<T>, b: SemanticCandidate<T>, sort?: VideoSearchPlan["sort"]) {
  if (sort === "newest") return b.video.publishedAt.localeCompare(a.video.publishedAt) || b.score-a.score;
  if (sort === "oldest") return a.video.publishedAt.localeCompare(b.video.publishedAt) || b.score-a.score;
  return b.score-a.score;
}
/** Insert into an already ranked result list while retaining only its best N entries. */
export function insertBoundedRanked<T>(items: T[], candidate: T, limit: number, compare: (left: T, right: T) => number) {
  const maximum = Math.max(0, Math.floor(limit));
  if (!maximum) return;
  if (items.length >= maximum && compare(candidate, items[items.length - 1]) >= 0) return;
  let low = 0, high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compare(items[middle], candidate) <= 0) low = middle + 1;
    else high = middle;
  }
  items.splice(low, 0, candidate);
  if (items.length > maximum) items.pop();
}
const emptyExcludedIds: ReadonlySet<string> = new Set<string>();
export function searchPreparedSemanticVideos<T extends Video>(videos: T[], prepared: PreparedVideoSearch, limit = 80, excludedIds: ReadonlySet<string> = emptyExcludedIds): SemanticCandidate<T>[] {
  const { groups, related } = prepared;
  const results: SemanticCandidate<T>[] = [];
  for (const video of videos) {
    if (!eligiblePreparedSemanticVideo(video, prepared, excludedIds)) continue;
    const fields = fieldsFor(video), evidence: Array<{field:Field;term:string;score:number}> = [];
    const matchedConcepts: number[] = [];
    for (const [groupIndex, group] of groups.entries()) {
      const matches = group.terms.flatMap((term) => fields.filter((field) => field.name !== "topics" && matchesTerm(term,field)).map((field) => ({field,term,score:field.name === "title" ? 20 : field.name === "tags" ? 12 : 8})));
      matches.sort((a,b) => b.score-a.score);
      if (matches.length) { evidence.push(matches[0]); matchedConcepts.push(groupIndex); }
    }
    const connected = connectedPreparedCoverage(video, prepared, coverageForPrepared(groups, matchedConcepts, prepared.coverageClauses));
    const coverage = connected.coverage;
    if (!coverage.complete || !evidence.length && !prepared.filterOnly) continue;
    if (connected.fields) {
      evidence.length=0;
      for (const group of groups) {
        const matches=group.terms.flatMap(term=>connected.fields!.filter(field=>matchesTerm(term,field)).map(field=>({field,term,score:field.name==="title"?20:field.name==="tags"?12:8})));
        matches.sort((a,b)=>b.score-a.score); if(matches.length) evidence.push(matches[0]);
      }
    }
    const title = fields[0].text;
    const exactTitle = prepared.exactTitleTerms.some((term) => contains(title,term));
    let relatedBonus = 0;
    for (const term of related) {
      if (fields.some(field => matchesTerm(term, field)) && ++relatedBonus === 3) break;
    }
    const hint = (video.topics || []).some((topic) => prepared.topicHints.includes(topic));
    results.push({video,coverage,score:100*evidence.length + evidence.reduce((sum,item)=>sum+item.score,0)+(exactTitle?10:0)+(hint?1:0)+relatedBonus+connected.bonus,matchedFields:[...new Set(evidence.map((item)=>item.field.name))],supportingText:[...new Set(evidence.map((item)=>passage(item.field,item.term)))].slice(0,8)});
  }
  return results.sort((a,b)=>compareSemanticCandidates(a,b,prepared.sort)).slice(0,Math.max(1,limit));
}
export function searchSemanticVideos<T extends Video>(videos: T[], plan: VideoSearchPlan, topic = "All", channelId?: string, limit = 80, excluded: string[] = []): SemanticCandidate<T>[] {
  const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
  return searchPreparedSemanticVideos(videos, prepared, limit, excluded.length ? new Set(excluded) : emptyExcludedIds);
}
export async function searchSemanticVideosYielding<T extends Video>(videos: T[], plan: VideoSearchPlan, topic = "All", channelId?: string, limit = 80, excluded: string[] = [], signal?: AbortSignal) {
  const prepared = prepareSemanticVideoSearch(plan, topic, channelId);
  return searchPreparedSemanticVideosYielding(videos, prepared, limit, excluded.length ? new Set(excluded) : emptyExcludedIds, signal);
}
export async function searchPreparedSemanticVideosYielding<T extends Video>(videos: T[], prepared: PreparedVideoSearch, limit = 80, excludedIds: ReadonlySet<string> = emptyExcludedIds, signal?: AbortSignal) {
  const matches: SemanticCandidate<T>[] = [];
  for (let start=0;start<videos.length;start+=160) {
    if (signal?.aborted) throw new DOMException("Search canceled","AbortError");
    matches.push(...searchPreparedSemanticVideos(videos.slice(start,start+160),prepared,limit,excludedIds));
    if (start+160<videos.length) await new Promise((resolve)=>setTimeout(resolve,0));
  }
  if (signal?.aborted) throw new DOMException("Search canceled","AbortError");
  return matches.sort((a,b)=>compareSemanticCandidates(a,b,prepared.sort)).slice(0,limit);
}

/** Explain only evidence found in searchable metadata; model prose never establishes a match. */
export function videoSearchReason<T extends Video>(video: T, plan: VideoSearchPlan, localScore = 0, suppliedSupport: string[] = []) {
  const groups = requiredGroups(plan);
  const allFields = fieldsFor(video).filter(field => field.name !== "topics");
  const connected = connectedCoverage(video,groups,plan.anyOf,coverageFor(groups,matchedGroups(allFields,groups),plan.anyOf));
  const fields = connected.coverage.complete && connected.fields ? connected.fields : allFields;
  const support: string[] = [], matchedFields = new Set<string>();
  for (const group of groups) {
    const matches = group.terms.flatMap(expand).flatMap(term => fields.filter(field => matchesTerm(term, field)).map(field => ({field,term})));
    const best = matches[0];
    if (best) {
      matchedFields.add(best.field.name);
      const text = `${best.field.name[0].toUpperCase() + best.field.name.slice(1)}: “${passage(best.field,best.term)}”`;
      if (!support.includes(text)) support.push(text);
    }
  }
  // Require a contiguous excerpt in one field, rather than loose word overlap across fields.
  for (const excerpt of suppliedSupport.slice(0,4)) {
    if (typeof excerpt !== "string" || !meaningful(excerpt).length) continue;
    const normalized = normalizeVideoQuery(excerpt);
    const excerptField = {name:"excerpt",value:excerpt,text:normalized,words:new Set(normalized.split(" "))};
    if (!groups.some(group => [...group.terms.flatMap(expand), ...(group.related || [])].some(term => matchesTerm(term,excerptField)))) continue;
    const field = fields.find(field => contains(field.text,normalized));
    if (!field || !normalized) continue;
    const text = `${field.name[0].toUpperCase() + field.name.slice(1)}: “${passage(field,excerpt)}”`;
    if (!support.includes(text)) support.push(text);
  }
  const coverage = videoConceptCoverage(video,plan);
  const strong = groups.length > 0 && coverage.complete && matchedFields.size > 0;
  return {
    videoId: video.id, relevance: strong ? "strong" as const : "broader" as const,
    support: support.slice(0,12), localScore,
    explanation: strong ? `Matches all requested concepts in the ${[...matchedFields].join(" and ")}.`
      : support.length ? "Broader recommendation: the metadata below does not establish every requested concept."
      : "Matches your browsing filters; no meaning-based metadata match was found."
  };
}

/** Optional interpretation is warranted only for meaningful queries without full local coverage. */
export function shouldEnrichVideoSearch<T extends Video>(query: string, plan: VideoSearchPlan, candidates: Array<{ video: T }>) {
  if (!requiredGroups(plan).length || meaningful(query).length < 2) return false;
  return !candidates.some(candidate => semanticCoverage(candidate.video, plan));
}
