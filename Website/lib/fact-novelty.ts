/** Shared, local-only novelty checks for generated cards and saved fact history. */
export type NoveltyRecord = {
  id?: string;
  title?: string;
  claim?: string;
  body?: string;
  fingerprint?: string;
  claimFingerprint?: string;
  topicPath?: string[];
  sourceUrls?: string[];
  sources?: Array<{ url?: string; canonicalUrl?: string }>;
  evidenceKeys?: string[];
  evidence?: Array<string | { quote?: string; sourceIndex?: number; section?: string }>;
};

export type FactNoveltySignature = {
  kind: "fact-novelty";
  version: 1;
  id: string;
  title: string;
  claim: string;
  hasClaim: boolean;
  fingerprint: string;
  claimFingerprint: string;
  bodyFingerprint: string;
  /** Compact fallback for cards whose main claim is unavailable on the client. */
  bodyTerms?: string;
  detailMarkers: string[];
  negated: boolean;
  topicPath: string[];
  evidenceKeys: string[];
};

export type NoveltyInput = NoveltyRecord | FactNoveltySignature | string;

const STOP_WORDS = new Set("a an the of in on at to for from by with and or but is was were are be been this that it its as his her their had has have who which they he she into through about also one two three".split(" "));

const TERM_FAMILIES: string[][] = [
  ["build", "built", "construct", "constructed", "erect", "erected"],
  ["found", "founded", "establish", "established", "form", "formed"],
  ["begin", "began", "start", "started", "commence", "commenced"],
  ["end", "ended", "cease", "ceased", "conclude", "concluded"],
  ["discover", "discovered", "identify", "identified", "uncover", "uncovered"],
  ["invent", "invented", "devise", "devised"],
  ["ban", "banned", "prohibit", "prohibited", "forbid", "forbade", "outlaw", "outlawed"],
  ["declare", "declared", "proclaim", "proclaimed"],
  ["sign", "signed"],
  ["kill", "killed", "slay", "slain"],
  ["create", "created", "make", "made", "produce", "produced"],
  ["use", "used", "employ", "employed"],
  ["measure", "measured"],
  ["record", "recorded"],
  ["contain", "contained"],
  ["include", "included"],
  ["reach", "reached"],
  ["survive", "survived"],
  ["travel", "travelled", "traveled"],
  ["orbit", "orbited"],
  ["erupt", "erupted"],
  ["collapse", "collapsed"],
  ["cause", "caused", "lead", "led"],
  ["weigh", "weighed"],
  ["publish", "published", "release", "released"],
  ["write", "wrote", "written", "author", "authored"],
  ["win", "won"],
  ["serve", "served"],
  ["name", "named", "call", "called"],
  ["award", "awarded", "grant", "granted"],
  ["elect", "elected", "choose", "chosen", "select", "selected"],
  ["acquire", "acquired", "purchase", "purchased", "buy", "bought"],
  ["convert", "converted", "transform", "transformed"],
  ["move", "moved", "relocate", "relocated"],
  ["remove", "removed", "abolish", "abolished", "dismantle", "dismantled"],
  ["defeat", "defeated", "beat", "beaten"],
  ["separate", "separated", "split", "divided"],
  ["restore", "restored", "rebuild", "rebuilt"],
  ["expand", "expanded", "enlarge", "enlarged"],
  ["reduce", "reduced", "decrease", "decreased"],
  ["distance", "km", "kilometer", "kilometers", "kilometre", "kilometres", "m", "meter", "meters", "metre", "metres", "mi", "mile", "miles"],
  ["mass", "kg", "kilogram", "kilograms", "lb", "pound", "pounds"],
  ["temperature", "c", "celsius", "centigrade", "f", "fahrenheit"]
];
const TERM_CANONICAL = new Map<string, string>();
for (const family of TERM_FAMILIES) for (const term of family) TERM_CANONICAL.set(term, family[0]);
const RELATION_CANONICAL = new Set("build found begin end discover invent ban declare sign kill create use measure record contain include reach survive travel orbit erupt collapse cause weigh publish write win serve name award elect acquire convert move remove defeat separate restore expand reduce".split(" "));

function normalizeText(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalToken(token: string) {
  return TERM_CANONICAL.get(token) ?? token;
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter(word => word.length > 2 && !/^\d+$/.test(word) && !STOP_WORDS.has(word)).map(canonicalToken));
}

function hash(value: string) {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (const character of value) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return (first >>> 0).toString(16).padStart(8, "0") + (second >>> 0).toString(16).padStart(8, "0");
}

function canonicalQuantity(amountText: string, rawUnit: string) {
  const amount = Number(amountText.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return `${amountText}:${rawUnit}`;
  const unit = rawUnit.toLowerCase();
  let value = amount;
  let base = unit;
  if (["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(unit)) { value *= 1000; base = "m"; }
  else if (["mile", "miles", "mi"].includes(unit)) { value *= 1609.344; base = "m"; }
  else if (["meter", "meters", "metre", "metres", "m"].includes(unit)) base = "m";
  else if (["kilogram", "kilograms", "kg"].includes(unit)) base = "kg";
  else if (["pound", "pounds", "lb"].includes(unit)) { value *= 0.45359237; base = "kg"; }
  else if (["fahrenheit", "f"].includes(unit)) { value = (value - 32) * 5 / 9; base = "c"; }
  else if (["celsius", "centigrade", "c"].includes(unit)) base = "c";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return `${Number.isInteger(rounded) ? rounded : rounded.toString()}:${base}`;
}

function details(value: string) {
  const normalized = normalizeText(value);
  const markers: string[] = [];
  const pattern = /\b(\d[\d,]*(?:\.\d+)?)\s*(km|kilometers?|kilometres?|miles?|mi|meters?|metres?|kg|kilograms?|pounds?|lb|celsius|centigrade|fahrenheit|c|f)?\b/gi;
  for (const match of normalized.matchAll(pattern)) {
    markers.push(canonicalQuantity(match[1] ?? "", match[2] ?? ""));
  }
  // Repeated quantities are meaningful (for example, two different years in one claim).
  return markers.slice(0, 16).sort();
}

function negative(value: string) {
  return /\b(?:no|not|never|without|neither|cannot|can't|didn't|doesn't|wasn't|weren't|failed to)\b/i.test(value);
}

type Prepared = {
  id: string;
  title: string;
  claim: string;
  hasClaim: boolean;
  body: string;
  claimKey: string;
  bodyKey: string;
  claimTokens: Set<string>;
  bodyTokens: Set<string>;
  titleTokens: Set<string>;
  relationTokens: Set<string>;
  details: string[];
  negated: boolean;
  topicPath: string[];
  promptClaim: string;
  fingerprint: string;
  claimFingerprint: string;
  evidenceKeys: string[];
};

function prepare(value: NoveltyInput, index = 0): Prepared {
  const source: any = typeof value === "string" ? { id: `legacy-${index}`, title: value, claim: value, body: "" } : value;
  const signature = source?.kind === "fact-novelty" && source?.version === 1;
  const title = String(source?.title ?? "");
  const hasClaim = signature ? source.hasClaim !== false : typeof source?.claim === "string" && Boolean(source.claim.trim());
  const claim = String(source?.claim ?? title);
  const body = String(source?.body ?? "");
  const claimTokens = tokenSet(claim);
  const bodyTokens = signature && typeof source.bodyTerms === "string" ? new Set<string>(source.bodyTerms.split(" ").filter(Boolean)) : tokenSet(body);
  const titleTokens = tokenSet(title);
  const relationTokens = new Set([...claimTokens].filter(term => RELATION_CANONICAL.has(term)));
  const fullClaim = normalizeText(claim);
  const fullBody = normalizeText(body);
  const claimFingerprint = hasClaim ? String(source?.claimFingerprint || (fullClaim ? hash(fullClaim) : "")) : "";
  const fingerprint = String(source?.fingerprint || hash(`${fullClaim} ${fullBody}`.trim()));
  const claimKey = fullClaim && hasClaim ? (signature ? String(source.claimFingerprint ?? "") : hash(fullClaim)) : "";
  const bodyKey = signature ? String(source.bodyFingerprint ?? "") : fullBody ? hash(fullBody) : "";
  const evidenceKeys = Array.isArray(source?.evidenceKeys)
    ? source.evidenceKeys.filter((term: unknown): term is string => typeof term === "string").map((term: string) => signature ? term : hash(term))
    : [];
  if (!signature && !evidenceKeys.length && Array.isArray(source?.evidence)) {
    const sources = Array.isArray(source?.sources) ? source.sources : [];
    for (const entry of source.evidence) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const quote = typeof item.quote === "string" ? item.quote : "";
      if (!quote) continue;
      const sourceIndex = Number.isInteger(item.sourceIndex) ? Number(item.sourceIndex) : -1;
      const sourceItem = sourceIndex >= 0 ? sources[sourceIndex] as Record<string, unknown> | undefined : undefined;
      const sourceUrl = Array.isArray(source?.sourceUrls) ? source.sourceUrls[sourceIndex] : undefined;
      const url = String(sourceItem?.canonicalUrl ?? sourceItem?.url ?? sourceUrl ?? "").split("#", 1)[0];
      if (!url) continue;
      evidenceKeys.push(hash(`${url}|${normalizeText(item.section)}|${normalizeText(quote)}`));
    }
  }
  return {
    id: String(source?.id ?? ""), title, claim, hasClaim, body, claimKey,
    bodyKey, claimTokens, bodyTokens, titleTokens, relationTokens,
    details: signature && Array.isArray(source.detailMarkers) ? source.detailMarkers.filter((term: unknown): term is string => typeof term === "string").slice(0, 16).sort() : details(hasClaim ? claim : body),
    negated: signature ? source.negated === true : negative(hasClaim ? claim : body), topicPath: Array.isArray(source?.topicPath) ? source.topicPath.map(normalizeText) : [],
    promptClaim: String(hasClaim ? claim : signature ? claim || title : body || title).replace(/\s+/g, " ").trim().slice(0, 260), fingerprint, claimFingerprint,
    evidenceKeys
  };
}

function overlap(a: Set<string>, b: Set<string>) {
  const smaller = a.size <= b.size ? a : b;
  const larger = smaller === a ? b : a;
  let shared = 0;
  for (const token of smaller) if (larger.has(token)) shared++;
  return { containment: shared / Math.max(1, smaller.size), jaccard: shared / Math.max(1, a.size + b.size - shared), shared };
}

function incompatible(a: Prepared, b: Prepared) {
  if (a.negated !== b.negated) return true;
  if (a.details.length && b.details.length && a.details.join("|") !== b.details.join("|")) return true;
  return a.relationTokens.size > 0 && b.relationTokens.size > 0 && ![...a.relationTokens].some(token => b.relationTokens.has(token));
}

function repeated(a: Prepared, b: Prepared) {
  if (a.id && a.id === b.id) return true;
  if (a.hasClaim && b.hasClaim && a.claimKey && b.claimKey && a.claimKey === b.claimKey && !incompatible(a, b)) return true;
  if (incompatible(a, b)) return false;
  if (a.bodyKey && b.bodyKey && a.bodyKey === b.bodyKey && a.body && b.body) return true;

  if (a.hasClaim && b.hasClaim && a.claimTokens.size >= 3 && b.claimTokens.size >= 3) {
    const claim = overlap(a.claimTokens, b.claimTokens);
    const sharedRelation = [...a.relationTokens].some(token => b.relationTokens.has(token));
    if (claim.containment >= 0.84 && claim.jaccard >= 0.68 && (sharedRelation || claim.jaccard >= 0.9)) return true;
    // An identical cited passage is supporting context, never a duplicate by itself.
    const evidence = new Set(a.evidenceKeys);
    const sharedEvidence = b.evidenceKeys.some(key => evidence.has(key));
    if (sharedEvidence && claim.containment >= 0.78 && claim.jaccard >= 0.58) return true;
  }

  // Older cards may not have a separate claim. Require very strong body and title agreement;
  // a shared source, section, or quotation alone never makes two cards duplicates.
  if (a.bodyTokens.size >= 5 && b.bodyTokens.size >= 5) {
    const body = overlap(a.bodyTokens, b.bodyTokens);
    const title = overlap(a.titleTokens, b.titleTokens);
    if (body.containment >= 0.92 && body.jaccard >= 0.78 && title.containment >= 0.65) return true;
  }
  return false;
}

export function isRepeatedFact(fact: NoveltyInput, memory: NoveltyInput) {
  return repeated(prepare(fact), prepare(memory));
}

/** Versioned compact data for the generation endpoint; source quotations and full bodies stay local. */
export function factNoveltySignature(memory: NoveltyRecord): FactNoveltySignature {
  const prepared = prepare(memory);
  return {
    kind: "fact-novelty", version: 1, id: prepared.id, title: prepared.title.slice(0, 180), claim: prepared.promptClaim, hasClaim: prepared.hasClaim,
    fingerprint: hash(`${normalizeText(prepared.claim)} ${normalizeText(prepared.body)}`.trim()), claimFingerprint: prepared.hasClaim ? hash(normalizeText(prepared.claim)) : "", bodyFingerprint: prepared.body ? hash(normalizeText(prepared.body)) : "",
    ...(prepared.hasClaim ? {} : { bodyTerms: [...prepared.bodyTokens].slice(0, 48).join(" ") }), detailMarkers: prepared.details, negated: prepared.negated,
    topicPath: prepared.topicPath.slice(0, 5), evidenceKeys: prepared.evidenceKeys.slice(0, 6)
  };
}

export function factNoveltySignatures(memories: NoveltyRecord[]) {
  return memories.map(factNoveltySignature);
}

export class FactNoveltyIndex {
  private readonly records: Prepared[] = [];
  private readonly ids = new Map<string, Prepared>();
  private readonly claims = new Map<string, Prepared>();
  private readonly bodies = new Map<string, Prepared>();
  private readonly terms = new Map<string, Set<Prepared>>();
  private readonly topics = new Map<string, Set<Prepared>>();

  constructor(initial: NoveltyInput[] = []) { initial.forEach((record, index) => this.add(record, index)); }

  add(value: NoveltyInput, index = this.records.length) {
    const item = prepare(value, index);
    if (item.id && this.ids.has(item.id)) return;
    this.records.push(item);
    if (item.id) this.ids.set(item.id, item);
    if (item.claimKey) this.claims.set(item.claimKey, item);
    if (item.bodyKey && item.body) this.bodies.set(item.bodyKey, item);
    for (const term of new Set([...item.claimTokens, ...item.bodyTokens, ...item.titleTokens])) {
      const posting = this.terms.get(term) ?? new Set<Prepared>();
      posting.add(item); this.terms.set(term, posting);
    }
    const topic = item.topicPath.at(-1);
    if (topic) { const posting = this.topics.get(topic) ?? new Set<Prepared>(); posting.add(item); this.topics.set(topic, posting); }
  }

  findDuplicate(value: NoveltyInput) {
    const item = prepare(value);
    if (item.id && this.ids.has(item.id)) return this.ids.get(item.id);
    const candidates = new Set<Prepared>();
    const exactClaim = this.claims.get(item.claimKey);
    const exactBody = this.bodies.get(item.bodyKey);
    if (exactClaim) candidates.add(exactClaim);
    if (exactBody) candidates.add(exactBody);
    for (const token of new Set([...item.claimTokens, ...item.bodyTokens, ...item.titleTokens])) {
      for (const match of this.terms.get(token) ?? []) candidates.add(match);
    }
    const topic = item.topicPath.at(-1);
    if (topic) for (const match of this.topics.get(topic) ?? []) candidates.add(match);
    // A short recent window catches older sparse records without a full-history scan on every card.
    for (const match of this.records.slice(-24)) candidates.add(match);
    for (const candidate of candidates) if (repeated(item, candidate)) return candidate;
    return undefined;
  }

  hasId(id: string) { return this.ids.has(id); }
  get size() { return this.records.length; }
}

export function selectPriorFactClaims(records: NoveltyInput[], topicPaths: string[][], maxCount = 12, maxCharacters = 2400) {
  const prepared = records.map((record, index) => ({ record: prepare(record, index), index }));
  const topicTokens = topicPaths.map(path => tokenSet(path.join(" ")));
  const ranked = prepared.map(({ record, index }) => {
    let score = 0;
    for (let pathIndex = 0; pathIndex < record.topicPath.length; pathIndex++) {
      const label = record.topicPath[pathIndex];
      for (const path of topicPaths) {
        if (normalizeText(path.at(-1) ?? "") === label) score += 3;
        else if (path.some(part => normalizeText(part) === label)) score += 1;
      }
    }
    for (const query of topicTokens) score += overlap(record.claimTokens, query).containment * 2;
    return { record, index, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || b.index - a.index);
  const selected = ranked.slice(0, maxCount).map(({ record }) => ({ id: record.id.slice(0, 48), claim: record.promptClaim }));
  while (selected.length && JSON.stringify(selected).length > maxCharacters) selected.pop();
  return selected;
}
