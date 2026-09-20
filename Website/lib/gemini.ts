import type { FactCard, FeedSettings, GeminiModelCheck, GeminiModelOutcome, GeminiStatus, LearningMessage, WikipediaSource } from "./types";
import type { LearningProfile } from "./types";
import { DIFFICULTY_LABELS, getTopicLearningProfile, normalizeDifficulty } from "./recommendations";
import { resolveWikipediaSources, type ResolvedWikipediaSource } from "./wikipedia";

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_CHECK_TIMEOUT_MS = 20_000;
const GENERATION_TIMEOUT_MS = 45_000;
const MODEL_COOLDOWN_MS = 45_000;
const OUTAGE_COOLDOWN_MS = 60_000;
const MAX_FACTS_PER_BATCH = 10;
const MAX_CONCURRENT_GEMINI_REQUESTS = 5;
const MAX_CANDIDATE_RETRIES = 3;

export const ALLOWED_GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
] as const;

type CandidateFact = {
  title?: string;
  hook?: string;
  topicPath?: string[];
  wikipediaSearchTitles?: string[];
  difficulty?: number;
};

type GroundedFact = {
  candidateIndex?: number;
  title?: string;
  hook?: string;
  body?: string;
  sourceIndexes?: number[];
  difficulty?: number;
};

type DiscoveredModel = {
  name?: string;
  baseModelId?: string;
  supportedGenerationMethods?: string[];
};

type ModelPool = {
  models: string[];
  checks: Map<string, GeminiModelCheck>;
  cooldowns: Map<string, number>;
  inFlight: Set<string>;
  inFlightResolved: Set<string>;
  cursor: number;
  outageCooldownUntil: number;
};

type ModelListResponse = { models?: DiscoveredModel[]; nextPageToken?: string };
type GeminiTextResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  modelVersion?: string;
};

export type GeminiProgressEvent =
  | { type: "model"; outcome: GeminiModelOutcome }
  | { type: "slot-start"; slot: number; requested: number }
  | { type: "card"; slot: number; card: FactCard }
  | { type: "slot-error"; slot: number; error: string }
  | { type: "cooldown"; until: string };

export type GeminiGenerationResult = {
  cards: FactCard[];
  modelOutcomes: GeminiModelOutcome[];
  requestedCount: number;
  completedCount: number;
  partial: boolean;
  failedJobs: number;
  retryable: boolean;
  retryGuidance?: string;
};

class GeminiFailure extends Error {
  status?: number;
  retryAfterMs?: number;
  retryable: boolean;
  outcomes: GeminiModelOutcome[];

  constructor(message: string, status?: number, outcomes: GeminiModelOutcome[] = [], retryAfterMs?: number, retryable = true) {
    super(message);
    this.name = "GeminiFailure";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
    this.outcomes = outcomes;
  }
}

const pools = new Map<string, ModelPool>();
const sessionSecrets = new Map<string, string>();
const activePoolKeys = new Map<string, string>();

function randomSessionSecret() {
  const values = new Uint32Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

async function credentialFingerprint(secret: string, apiKey: string) {
  const material = new TextEncoder().encode(secret + ":" + apiKey);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", material);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  Array.from(material).forEach((value) => { hash = Math.imul(hash ^ value, 16777619); });
  return (hash >>> 0).toString(16);
}

async function poolFor(_apiKey: string, sessionId = "default-session") {
  // Keep the model pool isolated to both this browser session and the current
  // credential without storing the credential or using a collision-prone hash.
  const secret = sessionSecrets.get(sessionId) ?? randomSessionSecret();
  sessionSecrets.set(sessionId, secret);
  const key = sessionId + ":" + await credentialFingerprint(secret, _apiKey);
  const previousKey = activePoolKeys.get(sessionId);
  if (previousKey && previousKey !== key) pools.delete(previousKey);
  activePoolKeys.set(sessionId, key);
  const existing = pools.get(key);
  if (existing) return existing;
  const created: ModelPool = { models: [...ALLOWED_GEMINI_MODELS], checks: new Map(), cooldowns: new Map(), inFlight: new Set(), inFlightResolved: new Set(), cursor: 0, outageCooldownUntil: 0 };
  pools.set(key, created);
  return created;
}

function stripJsonFence(value: string) {
  return value.replace(/^\u0060\u0060\u0060json\s*/i, "").replace(/^\u0060\u0060\u0060\s*/i, "").replace(/\s*\u0060\u0060\u0060$/i, "").trim();
}

function errorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: { message?: string; status?: string; details?: Array<{ reason?: string }> } }).error;
  const reason = error?.details?.map((detail) => detail.reason).filter(Boolean).join(", ");
  return [error?.message, error?.status, reason].filter(Boolean).join(" · ");
}

function retryAfterMs(response: Response, payload: unknown) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const match = JSON.stringify(payload).match(/retryDelay["']?\s*:\s*["'](\d+)s/i);
  return match ? Number(match[1]) * 1000 : undefined;
}

function isTransient(status?: number, message = "") {
  return status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500) ||
    /timeout|timed out|network|malformed|structured|no usable|temporarily|overloaded|wikipedia/i.test(message);
}

function classifyFailure(error: unknown) {
  if (error instanceof GeminiFailure) return error;
  const message = error instanceof Error ? error.message : "Gemini request failed.";
  return new GeminiFailure(message, undefined, [], undefined, isTransient(undefined, message));
}

function abortError() {
  return new GeminiFailure("Gemini request canceled.", undefined, [], undefined, false);
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", abort, { once: true });
    setTimeout(() => signal?.removeEventListener("abort", abort), ms + 10);
  });
}

async function fetchResponseText(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    if (externalSignal?.aborted) throw abortError();
    const response = await fetch(input, { ...init, signal: controller.signal });
    const raw = await response.text();
    return { response, raw };
  } catch (error) {
    if (externalSignal?.aborted) throw abortError();
    if (timedOut) throw new GeminiFailure("Gemini request timed out after " + Math.round(timeoutMs / 1000) + " seconds.", undefined, [], undefined, true);
    throw classifyFailure(error);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function modelId(model: DiscoveredModel) {
  return (model.name || model.baseModelId || "").replace(/^models\//, "").trim();
}

async function discoverModels(apiKey: string, signal?: AbortSignal) {
  let pageToken = "";
  const seenTokens = new Set<string>();
  const discovered: DiscoveredModel[] = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(GEMINI_API_ROOT + "/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const { response, raw } = await fetchResponseText(url, { headers: { accept: "application/json", "x-goog-api-key": apiKey } }, MODEL_CHECK_TIMEOUT_MS, signal);
    let payload: ModelListResponse | { error?: { message?: string; status?: string } } = {};
    try {
      payload = JSON.parse(raw) as ModelListResponse;
    } catch {
      throw new GeminiFailure("Google returned malformed model discovery data.", response.status, [], undefined, false);
    }
    if (!response.ok) {
      const detail = errorDetail(payload) || "Google model discovery returned HTTP " + response.status + ".";
      throw new GeminiFailure(detail, response.status, [], retryAfterMs(response, payload), isTransient(response.status, detail));
    }
    discovered.push(...((payload as ModelListResponse).models ?? []));
    pageToken = (payload as ModelListResponse).nextPageToken ?? "";
    if (!pageToken || seenTokens.has(pageToken)) break;
    seenTokens.add(pageToken);
  }
  return discovered;
}

async function refreshPool(apiKey: string, sessionId: string, signal?: AbortSignal, resetChecks = false) {
  const pool = await poolFor(apiKey, sessionId);
  const discovered = await discoverModels(apiKey, signal);
  pool.models = [...ALLOWED_GEMINI_MODELS];
  if (resetChecks) {
    pool.checks.clear();
    pool.cooldowns.clear();
    pool.inFlight.clear();
    pool.inFlightResolved.clear();
    pool.cursor = 0;
    pool.outageCooldownUntil = 0;
  }
  for (const model of pool.models) {
    if (!pool.checks.has(model)) {
      const metadata = discovered.find((item) => modelId(item) === model);
      pool.checks.set(model, { model, status: "checking", supportedGenerationMethods: metadata?.supportedGenerationMethods });
    }
  }
  return { pool, discovered };
}

async function requestModelText(apiKey: string, model: string, prompt: string, responseSchema: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal) {
  const endpoint = GEMINI_API_ROOT + "/models/" + encodeURIComponent(model) + ":generateContent";
  const { response, raw } = await fetchResponseText(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, responseMimeType: "application/json", responseSchema }
    })
  }, timeoutMs, signal);
  let payload: unknown = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new GeminiFailure("Gemini returned malformed JSON.", response.status, [], undefined, true);
  }
  if (!response.ok) {
    const detail = errorDetail(payload) || "Gemini returned HTTP " + response.status + ".";
    throw new GeminiFailure(detail, response.status, [], retryAfterMs(response, payload), isTransient(response.status, detail));
  }
  const typed = payload as GeminiTextResponse;
  const text = typed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new GeminiFailure("Gemini returned no usable structured answer.", undefined, [], undefined, true);
  return { text: stripJsonFence(text), resolvedModel: typed.modelVersion };
}

function workingModels(pool: ModelPool) {
  const now = Date.now();
  const resolved = new Set<string>();
  return pool.models.filter((model) => {
    const status = pool.checks.get(model)?.status;
    if ((status !== "working" && status !== "cooldown") || (pool.cooldowns.get(model) ?? 0) > now) return false;
    const version = pool.checks.get(model)?.resolvedModel;
    if (version && resolved.has(version)) return false;
    if (version) resolved.add(version);
    return true;
  });
}

function nextRetryAt(pool: ModelPool) {
  const retryTimes = Array.from(pool.cooldowns.values()).filter((time) => time > Date.now());
  return retryTimes.length ? Math.min(...retryTimes) : undefined;
}

function reserveModel(pool: ModelPool, tried: Set<string>) {
  if (pool.inFlight.size >= MAX_CONCURRENT_GEMINI_REQUESTS) return undefined;
  const now = Date.now();
  const eligible = new Set(workingModels(pool));
  for (let offset = 0; offset < pool.models.length; offset += 1) {
    const index = (pool.cursor + offset) % pool.models.length;
    const model = pool.models[index];
    if (tried.has(model) || pool.inFlight.has(model)) continue;
    if (!eligible.has(model) || (pool.cooldowns.get(model) ?? 0) > now) continue;
    const resolvedModel = pool.checks.get(model)?.resolvedModel;
    if (resolvedModel && pool.inFlightResolved.has(resolvedModel)) continue;
    pool.inFlight.add(model);
    if (resolvedModel) pool.inFlightResolved.add(resolvedModel);
    pool.cursor = (index + 1) % pool.models.length;
    return model;
  }
  return undefined;
}

function markModelSuccess(pool: ModelPool, model: string, latencyMs: number, resolvedModel?: string) {
  pool.cooldowns.delete(model);
  pool.outageCooldownUntil = 0;
  pool.checks.set(model, { model, status: "working", latencyMs, checkedAt: new Date().toISOString(), ...(resolvedModel ? { resolvedModel } : {}) });
}

function releaseModel(pool: ModelPool, model: string) {
  pool.inFlight.delete(model);
  const resolvedModel = pool.checks.get(model)?.resolvedModel;
  if (resolvedModel) pool.inFlightResolved.delete(resolvedModel);
}

function markModelFailure(pool: ModelPool, model: string, error: GeminiFailure) {
  if (error.retryable) pool.cooldowns.set(model, Date.now() + Math.max(MODEL_COOLDOWN_MS, error.retryAfterMs ?? 0));
  const resolvedModel = pool.checks.get(model)?.resolvedModel;
  pool.checks.set(model, { model, status: error.retryable ? "cooldown" : "failed", checkedAt: new Date().toISOString(), error: error.message, ...(resolvedModel ? { resolvedModel } : {}) });
}

async function requestStructured<T>(apiKey: string, sessionId: string, prompt: string, responseSchema: Record<string, unknown>, stage: GeminiModelOutcome["stage"], timeoutMs = GENERATION_TIMEOUT_MS, signal?: AbortSignal, onProgress?: (event: GeminiProgressEvent) => void) {
  const pool = await poolFor(apiKey, sessionId);
  if (!workingModels(pool).length) {
    const retryAt = nextRetryAt(pool);
    if (retryAt) await delay(Math.max(0, retryAt - Date.now()), signal);
  }
  if (!workingModels(pool).length) throw new GeminiFailure("No healthy allowed Gemini model is available right now. Recheck the models or retry after the cooldown.", undefined, [], undefined, true);
  const outcomes: GeminiModelOutcome[] = [];
  let lastError: GeminiFailure | undefined;
  let pass = 0;
  let sawRetryableFailure = false;
  let tried = new Set<string>();
  while (!signal?.aborted) {
    if (pool.outageCooldownUntil > Date.now()) {
      await delay(pool.outageCooldownUntil - Date.now(), signal);
      continue;
    }
    const model = reserveModel(pool, tried);
    if (!model) {
      const remaining = workingModels(pool).some((candidate) => !tried.has(candidate) && !pool.inFlight.has(candidate));
      if (pool.inFlight.size > 0) {
        await delay(40, signal);
        continue;
      }
      if (remaining) continue;
      const retryAt = nextRetryAt(pool);
      if (retryAt) {
        await delay(Math.max(0, retryAt - Date.now()), signal);
        continue;
      }
      if (tried.size === 0) throw new GeminiFailure("Every working Gemini model is busy or cooling down.", undefined, outcomes, undefined, true);
      if (!sawRetryableFailure) throw lastError ?? new GeminiFailure("No working Gemini model could complete the request.", undefined, outcomes, undefined, false);
      if (pass < 1) {
        pass += 1;
        tried = new Set<string>();
        continue;
      }
      pool.outageCooldownUntil = Math.max(pool.outageCooldownUntil, Date.now() + OUTAGE_COOLDOWN_MS);
      onProgress?.({ type: "cooldown", until: new Date(pool.outageCooldownUntil).toISOString() });
      await delay(Math.max(0, pool.outageCooldownUntil - Date.now()), signal);
      pass = 0;
      tried = new Set<string>();
      sawRetryableFailure = false;
      continue;
    }
    tried.add(model);
    const started = Date.now();
    try {
      const result = await requestModelText(apiKey, model, prompt, responseSchema, timeoutMs, signal);
      const value = JSON.parse(result.text) as T;
      if (!value || typeof value !== "object") throw new GeminiFailure("Gemini returned malformed structured output.", undefined, [], undefined, true);
      const outcome: GeminiModelOutcome = { model, resolvedModel: result.resolvedModel, stage, status: "success", latencyMs: Date.now() - started };
      markModelSuccess(pool, model, outcome.latencyMs ?? 0, result.resolvedModel);
      outcomes.push(outcome);
      onProgress?.({ type: "model", outcome });
      releaseModel(pool, model);
      return { value, model, resolvedModel: result.resolvedModel, outcomes };
    } catch (rawError) {
      releaseModel(pool, model);
      if (signal?.aborted) throw abortError();
      const error = classifyFailure(rawError);
      const outcome: GeminiModelOutcome = { model, stage, status: error.retryable ? "cooldown" : "failed", latencyMs: Date.now() - started, error: error.message };
      markModelFailure(pool, model, error);
      outcomes.push(outcome);
      onProgress?.({ type: "model", outcome });
      sawRetryableFailure ||= error.retryable;
      lastError = new GeminiFailure(error.message, error.status, outcomes, error.retryAfterMs, error.retryable);
    }
  }
  throw abortError();
}

export function describeGeminiError(error: unknown) {
  const failure = classifyFailure(error);
  if (failure.status === 401 || failure.status === 403 || /API key|permission|unauthorized|forbidden/i.test(failure.message)) return "Gemini rejected this API key. Check that it is active in Google AI Studio, then paste it again.";
  if (failure.status === 429 || /quota|rate.?limit|resource exhausted/i.test(failure.message)) return "Gemini is rate-limited or out of quota. The app will retry after its cooldown.";
  if (failure.status === 404 || /not found|unsupported model/i.test(failure.message)) return "This requested Gemini model is unavailable for the key. It was skipped without using an unrequested model.";
  if (/no eligible|verify at least five/i.test(failure.message)) return "Connect Gemini and wait until at least five allowed models pass their structured-output checks.";
  if (/timed out|timeout/i.test(failure.message)) return "Gemini timed out. The scheduler is trying another allowed model.";
  if (/Wikipedia/i.test(failure.message)) return failure.message;
  if (/malformed|structured/i.test(failure.message)) return "Gemini returned invalid structured output. The scheduler will try another allowed model.";
  return "Gemini could not complete this request. Check the key in Settings and retry.";
}

function hookWithoutPeriods(value: string) {
  const clean = value.replace(/[.!?]+/g, "").replace(/\s+/g, " ").trim().split(" ").slice(0, 12).join(" ");
  return clean.replace(/^(\s*[\"'“‘([{]*)([a-z])/, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

function cardSources(source: ResolvedWikipediaSource[]) {
  return source.map(({ image: _image, ...rest }) => rest);
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function candidateSchema() {
  return { type: "OBJECT", properties: { facts: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, hook: { type: "STRING" }, topicPath: { type: "ARRAY", items: { type: "STRING" } }, wikipediaSearchTitles: { type: "ARRAY", items: { type: "STRING" } }, difficulty: { type: "INTEGER" } }, required: ["title", "hook", "topicPath", "wikipediaSearchTitles", "difficulty"] } } }, required: ["facts"] };
}

function groundedSchema() {
  return { type: "OBJECT", properties: { facts: { type: "ARRAY", items: { type: "OBJECT", properties: { candidateIndex: { type: "INTEGER" }, title: { type: "STRING" }, hook: { type: "STRING" }, body: { type: "STRING" }, sourceIndexes: { type: "ARRAY", items: { type: "INTEGER" } }, difficulty: { type: "INTEGER" } }, required: ["candidateIndex", "title", "hook", "body", "sourceIndexes", "difficulty"] } } }, required: ["facts"] };
}

function candidatePrompt(topicPaths: Array<{ path: string[]; weight: number }>, settings: FeedSettings, learningProfile: LearningProfile, avoid: string[], rabbitHole: string | null | undefined, jobIndex: number, attempt: number) {
  const variation = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "-" + jobIndex + "-" + attempt;
  const topicText = topicPaths.length ? topicPaths.map(({ path, weight }) => path.join(" → ") + " (relative weight " + weight + ")").join("\n") : "a broad surprise topic";
  const targetText = topicPaths.length ? topicPaths.map(({ path }) => {
    const profile = getTopicLearningProfile(learningProfile, path, normalizeDifficulty(settings.obscurity));
    return path.join(" → ") + ": target difficulty " + profile.targetDifficulty + "/10 (" + DIFFICULTY_LABELS[profile.targetDifficulty] + "; " + profile.heard + " heard, " + profile.unknown + " unknown)";
  }).join("\n") : "Default target difficulty: " + settings.obscurity + "/10";
  return "Create exactly one genuinely obscure, accurate, interesting fact for Learned Media. Avoid common sense, famous trivia, textbook definitions, and the first obvious examples. Prefer a specific forgotten event, unusual invention, counterintuitive scientific detail, hidden technical behavior, or precise geographic detail. Do not invent or speculate.\n\n" +
    "Suggest one to three exact English Wikipedia article titles that can support the claim. Include the complete topicPath. Give the card a specific but broadly understandable title of about 3 to 9 words. Make the title and hook feel fresh and different from recent cards, without clickbait or vague phrases. Write a 4 to 12 word hook with its first word capitalized and no period, exclamation mark, or question mark. Difficulty is standardized from 1 to 10, where 10 is most obscure.\n\n" +
    "Topics and relative weights:\n" + topicText + "\n\nLearning targets:\n" + targetText + "\n\n" +
    "Baseline difficulty: " + settings.obscurity + "/10\nDesired sentence length: " + settings.sentenceLength + "\nSurprise Me: " + (settings.surpriseMe ? "enabled" : "disabled") +
    "\nRabbit hole thread: " + (rabbitHole ?? "none") + "\nVariation: " + variation + "\nDo not repeat these recent cards:\n" + (avoid.slice(-16).join("\n") || "none") +
    "\nReturn structured JSON only with a facts array containing exactly one candidate.";
}

async function generateFactJob(apiKey: string, sessionId: string, topicPaths: Array<{ path: string[]; weight: number }>, settings: FeedSettings, learningProfile: LearningProfile, avoid: string[], rabbitHole: string | null | undefined, jobIndex: number, attempt: number, signal?: AbortSignal, onProgress?: (event: GeminiProgressEvent) => void) {
  const outcomes: GeminiModelOutcome[] = [];
  const candidateResult = await requestStructured<{ facts?: CandidateFact[] }>(apiKey, sessionId, candidatePrompt(topicPaths, settings, learningProfile, avoid, rabbitHole, jobIndex, attempt), candidateSchema(), "candidate", GENERATION_TIMEOUT_MS, signal, onProgress);
  outcomes.push(...candidateResult.outcomes);
  const candidate = (candidateResult.value.facts ?? []).find((item) => item.title?.trim() && item.topicPath?.length);
  if (!candidate) throw new GeminiFailure("Gemini returned no complete fact candidate.", undefined, outcomes, undefined, true);
  const sources = await resolveWikipediaSources(candidate.wikipediaSearchTitles?.slice(0, 3) ?? [candidate.title ?? ""], 3, signal);
  if (!sources.length) throw new GeminiFailure("Wikipedia did not return supporting articles for this fact.", undefined, outcomes, undefined, true);
  const evidence = sources.map((source, index) => ({ index, title: source.title, url: source.url, extract: source.extract?.slice(0, 1100) ?? "" }));
  const groundingPrompt = "Turn this candidate into one final Learned Media card using only the supplied Wikipedia evidence. Every claim in body must be supported by the excerpts. Use one to three sourceIndexes, but use one when sufficient. Keep the title specific but broadly understandable and different from recent cards. Write a 4 to 12 word hook with a capitalized first word and no terminal punctuation. Write the body in two or three short sentences using clear eighth-grade English, common words, and a brief explanation of any necessary technical term. Difficulty controls how obscure the fact is, not how hard the writing is. Do not invent citations or use sources not listed.\n\nCandidate:\n" +
    JSON.stringify({ title: candidate.title, topicPath: candidate.topicPath, difficulty: candidate.difficulty }) + "\nEvidence:\n" + JSON.stringify(evidence) +
    "\nReturn structured JSON only with a facts array containing exactly one final card.";
  const groundedResult = await requestStructured<{ facts?: GroundedFact[] }>(apiKey, sessionId, groundingPrompt, groundedSchema(), "grounding", GENERATION_TIMEOUT_MS, signal, onProgress);
  outcomes.push(...groundedResult.outcomes);
  const fact = groundedResult.value.facts?.[0];
  if (!fact?.title?.trim() || !fact.body?.trim() || !fact.hook?.trim()) throw new GeminiFailure("Gemini returned an incomplete grounded card.", undefined, outcomes, undefined, true);
  const chosenIndexes = Array.from(new Set((fact.sourceIndexes ?? []).filter((index) => index >= 0 && index < sources.length))).slice(0, 3);
  const chosenSources = (chosenIndexes.length ? chosenIndexes.map((index) => sources[index]) : sources.slice(0, 1)).filter(Boolean);
  if (!chosenSources.length) throw new GeminiFailure("The final card did not cite a verified Wikipedia page.", undefined, outcomes, undefined, true);
  const imageSource = chosenSources.find((source) => source.image);
  const difficulty = normalizeDifficulty(fact.difficulty ?? candidate.difficulty, normalizeDifficulty(settings.obscurity));
  const generatedAt = new Date().toISOString();
  const card = {
    id: "gemini-" + Date.now() + "-" + jobIndex + "-" + attempt + "-" + Math.random().toString(36).slice(2, 8),
    hook: hookWithoutPeriods(fact.hook),
    title: fact.title.trim(),
    body: fact.body.trim(),
    topicPath: candidate.topicPath!.filter(Boolean),
    sources: cardSources(chosenSources),
    image: imageSource?.image,
    difficulty,
    obscurity: difficulty,
    accent: ["blue", "lilac", "mint", "sand", "coral"][jobIndex % 5] as FactCard["accent"],
    surprise: settings.surpriseMe && !topicPaths.some(({ path }) => candidate.topicPath?.join(" ").startsWith(path.join(" "))),
    createdAt: generatedAt,
    provenance: { provider: "gemini" as const, model: groundedResult.resolvedModel ?? groundedResult.model, generatedAt }
  } satisfies FactCard;
  return { card, outcomes };
}

export async function generateGeminiFacts({ apiKey, sessionId = "default-session", topicPaths, settings, learningProfile, avoid, rabbitHole, requestedCount = MAX_FACTS_PER_BATCH, signal, onProgress }: { apiKey: string; sessionId?: string; topicPaths: Array<{ path: string[]; weight: number }>; settings: FeedSettings; learningProfile: LearningProfile; avoid: string[]; rabbitHole?: string | null; requestedCount?: number; signal?: AbortSignal; onProgress?: (event: GeminiProgressEvent) => void }): Promise<GeminiGenerationResult> {
  if (!apiKey.trim()) throw new GeminiFailure("Paste your Gemini API key in Settings to generate a fresh batch.", undefined, [], undefined, false);
  if (!topicPaths.length) throw new GeminiFailure("Choose at least one topic before generating a batch.", undefined, [], undefined, false);
  const cards: FactCard[] = [];
  const outcomes: GeminiModelOutcome[] = [];
  const failures: string[] = [];
  const targetCount = Math.max(1, Math.min(MAX_FACTS_PER_BATCH, Math.round(requestedCount)));
  const seenTitles = new Set(avoid.map((title) => title.toLowerCase()));
  let nextSlot = 0;
  async function runWorker() {
    while (nextSlot < targetCount) {
      if (signal?.aborted) throw abortError();
      const slot = nextSlot++;
      onProgress?.({ type: "slot-start", slot, requested: targetCount });
      let accepted: FactCard | undefined;
      let lastFailure: GeminiFailure | undefined;
      for (let attempt = 0; attempt < MAX_CANDIDATE_RETRIES && !accepted; attempt += 1) {
        try {
          const result = await generateFactJob(apiKey, sessionId, topicPaths, settings, learningProfile, Array.from(seenTitles), rabbitHole, slot, attempt, signal, (event) => {
            if (event.type === "model") outcomes.push(event.outcome);
            onProgress?.(event);
          });
          if (seenTitles.has(result.card.title.toLowerCase())) {
            lastFailure = new GeminiFailure("Gemini returned a duplicate fact title.", undefined, result.outcomes, undefined, true);
            outcomes.push(...result.outcomes);
            continue;
          }
          accepted = result.card;
          outcomes.push(...result.outcomes);
        } catch (rawError) {
          const error = classifyFailure(rawError);
          lastFailure = error;
          outcomes.push(...error.outcomes);
          if (!error.retryable) break;
        }
      }
      if (accepted) {
        seenTitles.add(accepted.title.toLowerCase());
        cards.push(accepted);
        onProgress?.({ type: "card", slot, card: accepted });
      } else {
        const message = lastFailure?.message ?? "This fact slot could not be completed.";
        failures.push(message);
        onProgress?.({ type: "slot-error", slot, error: message });
      }
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENT_GEMINI_REQUESTS }, () => runWorker()));
  const uniqueCards = cards.filter((card, index, list) => list.findIndex((item) => item.title.toLowerCase() === card.title.toLowerCase()) === index).slice(0, targetCount);
  if (!uniqueCards.length) throw new GeminiFailure(failures[0] ?? "Gemini could not complete a Wikipedia-grounded batch.", undefined, outcomes);
  const partial = uniqueCards.length < targetCount;
  return { cards: shuffle(uniqueCards), modelOutcomes: outcomes, requestedCount: targetCount, completedCount: uniqueCards.length, partial, failedJobs: failures.length, retryable: partial, retryGuidance: partial ? uniqueCards.length + " facts arrived. Retry to fill the remaining slots." : undefined };
}

export async function generateLearningResponse({ apiKey, sessionId = "default-session", action, card, question, detailed, history, signal }: { apiKey: string; sessionId?: string; action: "learn" | "question"; card: FactCard; question?: string; detailed?: boolean; history?: LearningMessage[]; signal?: AbortSignal }): Promise<{ answer: string; citations: WikipediaSource[]; modelOutcomes: GeminiModelOutcome[] }> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before asking for more detail.", undefined, [], undefined, false);
  const [originalSources, questionSources] = await Promise.all([
    resolveWikipediaSources(card.sources.map((source) => source.title), 3, signal),
    action === "question" && question ? resolveWikipediaSources([question], 2, signal) : Promise.resolve([])
  ]);
  const sources = Array.from(new Map([...originalSources, ...questionSources].map((source) => [source.url, source])).values()).slice(0, 3);
  if (!sources.length) throw new GeminiFailure("Wikipedia did not return the cited pages for this fact.", undefined, [], undefined, true);
  const context = sources.map((source, index) => index + ". " + source.title + "\nURL: " + source.url + "\nExcerpt: " + (source.extract ?? "No extract returned")).join("\n\n");
  const prompt = action === "learn"
    ? "Explain this fact in one useful paragraph of approximately 100 to 160 words. Use only the Wikipedia evidence below and add context rather than repeating the card body. Return citationIndexes for supporting sources.\n\nCard title: " + card.title + "\nCard body: " + card.body + "\n\nWikipedia evidence:\n" + context
    : "Answer the user's question about this fact using only the Wikipedia evidence below. Normally answer in 2 to 4 sentences. If detailed is true, answer in approximately 150 to 250 words. If the evidence cannot answer the question, say so plainly and explain what the sources do establish. Return citationIndexes for supporting sources.\n\nFact: " + card.title + "\nCard body: " + card.body + "\nUser question: " + (question ?? "") + "\nMore Details: " + (detailed ? "true" : "false") + "\nConversation so far: " + JSON.stringify(history?.slice(-6) ?? []) + "\n\nWikipedia evidence:\n" + context;
  const result = await requestStructured<{ answer?: string; citationIndexes?: number[] }>(apiKey, sessionId, prompt, { type: "OBJECT", properties: { answer: { type: "STRING" }, citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["answer", "citationIndexes"] }, "learning", GENERATION_TIMEOUT_MS, signal);
  if (!result.value.answer?.trim()) throw new GeminiFailure("Gemini returned an empty explanation.", undefined, result.outcomes, undefined, true);
  const indexes = Array.from(new Set((result.value.citationIndexes ?? []).filter((index) => index >= 0 && index < sources.length))).slice(0, 3);
  return { answer: result.value.answer.trim(), citations: (indexes.length ? indexes : [0]).map((index) => sources[index]).filter(Boolean).map(({ image: _image, ...source }) => source), modelOutcomes: result.outcomes };
}

async function checkOneModel(apiKey: string, model: string, signal?: AbortSignal): Promise<GeminiModelCheck> {
  const started = Date.now();
  try {
    const result = await requestModelText(apiKey, model, "Return exactly the JSON object {\"ok\":true} and nothing else.", { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] }, MODEL_CHECK_TIMEOUT_MS, signal);
    const parsed = JSON.parse(result.text) as { ok?: boolean };
    if (parsed.ok !== true) throw new GeminiFailure("The model returned invalid structured test output.", undefined, [], undefined, true);
    return { model, status: "working", latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), ...(result.resolvedModel ? { resolvedModel: result.resolvedModel } : {}) };
  } catch (rawError) {
    const error = classifyFailure(rawError);
    return { model, status: error.retryable && (error.status === 429 || error.status === 503) ? "cooldown" : "failed", latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), error: error.message };
  }
}

export async function testGeminiKey(apiKey: string, signal?: AbortSignal, sessionId = "default-session", onCheck?: (check: GeminiModelCheck, readyCount: number) => void) {
  if (!apiKey.trim()) return { ok: false as const, status: "not-configured" as const, models: [] as GeminiModelCheck[], eligibleModelCount: 0, requiredWorkingModels: 5 };
  const { pool } = await refreshPool(apiKey, sessionId, signal, true);
  const checks: GeminiModelCheck[] = new Array(ALLOWED_GEMINI_MODELS.length);
  let nextIndex = 0;
  let readyCount = 0;
  async function worker() {
    while (nextIndex < ALLOWED_GEMINI_MODELS.length) {
      const index = nextIndex++;
      const model = ALLOWED_GEMINI_MODELS[index];
      const check = await checkOneModel(apiKey, model, signal);
      checks[index] = check;
      pool.checks.set(model, check);
      readyCount = new Set(checks.filter((item) => item?.status === "working").map((item) => item.resolvedModel ?? item.model)).size;
      onCheck?.(check, readyCount);
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENT_GEMINI_REQUESTS }, () => worker()));
  const working = checks.filter((check) => check.status === "working");
  const distinctWorking = new Set(working.map((check) => check.resolvedModel ?? check.model));
  const firstFailure = checks.find((check) => check.status !== "working");
  const status: GeminiStatus = distinctWorking.size >= 5 ? "connected" : firstFailure?.error && /401|403|key|permission/i.test(firstFailure.error) ? "invalid" : checks.some((check) => check.status === "cooldown") ? "rate-limited" : "unavailable";
  return { ok: distinctWorking.size >= 5, status, models: checks, eligibleModelCount: ALLOWED_GEMINI_MODELS.length, requiredWorkingModels: 5 };
}
