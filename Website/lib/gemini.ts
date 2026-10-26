import { performanceFetch, recordPerformance, diagnosticTextBytes } from "./performance-diagnostics";
import { ValidationDiagnostics, type ValidationDiagnostic } from "./validation-diagnostics";
import { nextOutputCapacity, truncatedOutputFloor, MAX_OUTPUT_CAPACITY } from "./output-capacity";
import { buildPrompt, buildLearningPrompt, buildFactCardPrompt, buildSearchInterpretationPrompt } from "./prompts";
import { validateTopicPlan, type TopicQueryPlan } from "./topic-suggestions";
import type { AnswerPresentation, AnswerStructure, CardGlossaryEntry, Difficulty, FactCard, FeedSettings, GeminiModelCheck, GeminiModelOutcome, GeminiStatus, LearningMessage, QuestionInstructionPreference, ResolvedAnswerStructure, SavedCardGlossary, WikipediaSource } from "./types";
import type { LearningProfile } from "./types";
import { DIFFICULTY_LABELS, getTopicLearningProfile, normalizeDifficulty } from "./recommendations";
import { resolveWikipediaArticle, resolveWikipediaSources, sharedWikipediaResolutionCache, wikipediaEvidenceLink, type ResolvedWikipediaSource, type WikipediaResolutionCache } from "./wikipedia";
import { hashFactKey, difficultyRubric, evidencePassageKey, stableEvidenceId, restoreEvidenceReferences, selectEvidence, validateDraft, normalizeSentenceLength, completeSentenceChunks, rememberFact, normalizedText, factAvoidKeys, type FactAvoidKey, type FactMemory, type GroundedDraft } from "./fact-quality";
import { FactNoveltyIndex, isRepeatedFact as noveltyRepeatedFact, selectPriorFactClaims, type FactNoveltySignature, type NoveltyInput } from "./fact-novelty";
import { factSpecificityReason, FactSpecificityError } from "./fact-specificity";
import type { YouTubeSearchCandidate } from "./youtube";
import { canonicalRequestIdentity, reusableStructuredValue, requestCacheKey, SessionCache, type RequestIdentity } from "./session-cache";
import { geminiAttemptRounds } from "./model-retry-policy";
import { JsonArrayItemStreamParser } from "./stream-json";
import { normalizeStructuredValue, parseStructuredResponse, stripResponseBom } from "./structured-response";
import { transientRetryDelayMs } from "./retry-timing";
import { ImmutableSchemaCache } from "./immutable-schema-cache";
import { createSavedFollowUpQuestions } from "./card-follow-ups";
import { cardGlossaryFingerprint, normalizeCardGlossary } from "./card-glossary";
import { createSavedCardChronology } from "./card-chronology";
import { createSavedCardLocations } from "./card-locations";
import { factAngleDefinition, normalizeFactAngle, type FactAngle } from "./fact-angle";
import { ANSWER_STRUCTURE_POLICY_VERSION, QUESTION_INSTRUCTION_POLICY_VERSION, isAnswerStructure, isQuestionInstructionPreference, normalizeAnswerResponse, resolveQuestionInstructions } from "./answer-structure";
import { validStableBatchAssignments } from "./batch-replay";

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_CHECK_TIMEOUT_MS = 20_000;
const GENERATION_TIMEOUT_MS = 45_000;
const MODEL_COOLDOWN_MS = 45_000;
const MAX_FACTS_PER_BATCH = 10;
export const DEFAULT_CARD_GENERATION_COUNT = 7;
const MAX_CONCURRENT_GEMINI_REQUESTS = 1;
const MAX_CANDIDATE_RETRIES = 3;
const MAX_CARDS_PER_GROUP = MAX_FACTS_PER_BATCH;
const MAX_GROUNDING_CONTEXT_CHARS = 48_000;
const responseSchemaCache = new ImmutableSchemaCache(16);
export const REQUIRED_WORKING_MODELS = 2;

export const PRIMARY_FLASH_LITE_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const;

export const ALLOWED_GEMINI_MODELS = [
  ...PRIMARY_FLASH_LITE_MODELS,
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash"
] as const;

type CandidateFact = {
  slot?: number;
  claim?: string;
  title?: string;
  hook?: string;
  topicPath?: string[];
  wikipediaSearchTitles?: string[];
  difficulty?: number;
};

type GroundedFact = { topicPath?: string[]; status?: "grounded" | "needs_evidence" | "duplicate" | "angle_unavailable"; duplicateOf?: string; claimEvidenceIds?: string[]; missingEvidence?: string; slot?: number; title?: string; hook?: string; claim?: string; sentences?: string[]; evidence?: Array<{ sentence: number; evidenceIds?: string[] }>; followUpQuestions?: unknown; chronology?: unknown; locations?: unknown };
type GroundingEvidence = { sourceIndex: number; quote: string; section: string };

type ModelPool = {
  cacheScope: string;
  models: string[];
  checks: Map<string, GeminiModelCheck>;
  cooldowns: Map<string, number>;
  transientFailureCounts: Map<string, number>;
  projectQuotaCooldownUntil: number;
  inFlight: Set<string>;
  inFlightResolved: Set<string>;
  requestQueue: QueuedRequest[];
  queueRunning: boolean;
  queueOrder: number;
  structuredCache: SessionCache<StructuredResult>;
  structuredFlights: Map<string, StructuredFlight>;
  ready: boolean;
};

type QueuedRequest = {
  priority: number;
  queuedAt: number;
  order: number;
  signal?: AbortSignal;
  operation: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  started: boolean;
  onAbort?: () => void;
};

type StructuredResult = { value: unknown; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] };
type StructuredFlight = { controller: AbortController; subscribers: Set<symbol>; promise: Promise<StructuredResult>; settled: boolean };

type GeminiTextResponse = {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
  modelVersion?: string;
};

type GenerationSlot = {
  index: number;
  slotId?: string;
  path: string[];
  target: Difficulty;
  candidate?: CandidateFact;
  sources?: ResolvedWikipediaSource[];
  mode: "candidate" | "grounding" | "combined";
  lastError?: string;
  candidateOutputFloor?: number;
  groundingOutputFloor?: number;
};

export type GeminiProgressEvent =
  | { type: "model"; outcome: GeminiModelOutcome }
  | { type: "status"; status: GeminiStatus }
  | { type: "slot-start"; slot: number; requested: number }
  | { type: "card"; slot: number; slotId?: string; card: FactCard }
  | { type: "slot-error"; slot: number; error: string }
  | { type: "cooldown"; until: string };

export type GeminiGenerationResult = {
  cards: FactCard[];
  slotMappings: Array<{ slotId: string; cardId: string }>;
  modelOutcomes: GeminiModelOutcome[];
  requestedCount: number;
  completedCount: number;
  partial: boolean;
  failedJobs: number;
  retryable: boolean;
  retryGuidance?: string;
  validationDiagnostics: ValidationDiagnostic[];
};

class GeminiFailure extends Error {
  validationDiagnostics: ValidationDiagnostic[] = [];
  status?: number;
  retryAfterMs?: number;
  retryable: boolean;
  outcomes: GeminiModelOutcome[];
  quotaScope?: "model" | "project" | "unknown";

  constructor(message: string, status?: number, outcomes: GeminiModelOutcome[] = [], retryAfterMs?: number, retryable = true, quotaScope?: "model" | "project" | "unknown") {
    super(message);
    this.name = "GeminiFailure";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
    this.outcomes = outcomes;
    this.quotaScope = quotaScope;
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
  const created: ModelPool = {
    cacheScope: key,
    models: [...ALLOWED_GEMINI_MODELS],
    checks: new Map(ALLOWED_GEMINI_MODELS.map((model) => [model, { model, status: "unchecked" as const }])),
    cooldowns: new Map(),
    transientFailureCounts: new Map(),
    projectQuotaCooldownUntil: 0,
    inFlight: new Set(),
    inFlightResolved: new Set(),
    requestQueue: [],
    queueRunning: false,
    queueOrder: 0,
    structuredCache: new SessionCache<StructuredResult>(100, 30 * 60 * 1000),
    structuredFlights: new Map(),
    ready: false
  };
  pools.set(key, created);
  return created;
}

function stripJsonFence(value: string) {
  return stripResponseBom(value).replace(/^\u0060\u0060\u0060json\s*/i, "").replace(/^\u0060\u0060\u0060\s*/i, "").replace(/\s*\u0060\u0060\u0060$/i, "").trim();
}

function errorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: { message?: string; status?: string; details?: Array<{ reason?: string }> } }).error;
  const reason = error?.details?.map((detail) => detail.reason).filter(Boolean).join(", ");
  return [error?.message, error?.status, reason].filter(Boolean).join(" · ");
}

function retryAfterMs(response: Response, serializedPayload: string) {
  const rawHeader = response.headers.get("retry-after");
  const header = Number(rawHeader);
  if (Number.isFinite(header) && header > 0) return header * 1000;
  if (rawHeader) {
    const date = Date.parse(rawHeader);
    if (Number.isFinite(date) && date > Date.now()) return date - Date.now();
  }
  const match = serializedPayload.match(/retryDelay["']?\s*:\s*["'](\d+(?:\.\d+)?)s/i);
  return match ? Number(match[1]) * 1000 : undefined;
}

function quotaScope(status: number, serializedPayload: string): GeminiFailure["quotaScope"] {
  if (status !== 429) return undefined;
  if (/per.?day|daily quota|requests? per day|tokens? per day|project.{0,40}quota|quota.{0,40}project/i.test(serializedPayload)) return "project";
  if (/quota.{0,40}model|model.{0,40}quota|per.?model|model[_ -]specific/i.test(serializedPayload)) return "model";
  return "unknown";
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

function isCredentialFailure(error: GeminiFailure) {
  return error.status === 401 || error.status === 403 || /API key|permission|unauthorized|forbidden/i.test(error.message);
}

function abortError() {
  return new GeminiFailure("Gemini request canceled.", undefined, [], undefined, false);
}

function pumpRequestQueue(pool: ModelPool) {
  if (pool.queueRunning) return;
  pool.queueRunning = true;
  void (async () => {
    while (pool.requestQueue.length) {
      pool.requestQueue.sort((left, right) => left.priority - right.priority || left.order - right.order);
      const task = pool.requestQueue.shift()!;
      task.started = true;
      if (task.onAbort) task.signal?.removeEventListener("abort", task.onAbort);
      if (task.signal?.aborted) {
        task.reject(abortError());
        continue;
      }
      recordPerformance("gemini", "queue_ms", Math.max(0, performance.now() - task.queuedAt));
      try { task.resolve(await task.operation()); }
      catch (error) { task.reject(error); }
    }
    pool.queueRunning = false;
    if (pool.requestQueue.length) pumpRequestQueue(pool);
  })();
}

async function withRequestQueue<T>(pool: ModelPool, signal: AbortSignal | undefined, operation: () => Promise<T>, priority = 0): Promise<T> {
  if (signal?.aborted) throw abortError();
  return new Promise<T>((resolve, reject) => {
    const task: QueuedRequest = {
      priority,
      queuedAt: performance.now(),
      order: pool.queueOrder++,
      signal,
      operation,
      resolve: (value) => resolve(value as T),
      reject,
      started: false
    };
    task.onAbort = () => {
      if (task.started) return;
      const index = pool.requestQueue.indexOf(task);
      if (index >= 0) pool.requestQueue.splice(index, 1);
      reject(abortError());
    };
    signal?.addEventListener("abort", task.onAbort, { once: true });
    pool.requestQueue.push(task);
    pumpRequestQueue(pool);
  });
}

async function readEventStream(response: Response, onTextChunk?: (text: string) => void) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventData: string[] = [];
  let text = "";
  let resolvedModel: string | undefined;
  let finishReason: string | undefined;
  const flush = () => {
    if (!eventData.length) return;
    const data = eventData.join("\n");
    eventData = [];
    if (!data || data === "[DONE]") return;
    let payload: GeminiTextResponse;
    try { payload = JSON.parse(stripResponseBom(data)) as GeminiTextResponse; }
    catch { throw new GeminiFailure("Gemini returned malformed streamed output.", response.status, [], undefined, true); }
    resolvedModel = payload.modelVersion ?? resolvedModel;
    finishReason = payload.candidates?.[0]?.finishReason ?? finishReason;
    const chunk = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
    if (chunk) {
      text += chunk;
      onTextChunk?.(chunk);
    }
  };
  const consumeLine = (line: string) => {
    const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!clean) { flush(); return; }
    if (clean.startsWith("data:")) eventData.push(clean.slice(5).replace(/^ /, ""));
  };
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer) consumeLine(buffer);
    flush();
    return { text, resolvedModel, finishReason };
  } finally { recordPerformance("gemini", "response_bytes_read", receivedBytes); }
}

async function fetchResponseText(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal, onTextChunk?: (text: string) => void) {
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
    const response = await performanceFetch("gemini", input, { ...init, signal: controller.signal });
    if (onTextChunk && response.ok && response.body) {
      const streamed = await readEventStream(response, onTextChunk);
      return { response, raw: streamed.text, resolvedModel: streamed.resolvedModel, finishReason: streamed.finishReason, streamed: true };
    }
    const raw = await response.text();
    recordPerformance("gemini", "response_bytes_read", diagnosticTextBytes(raw));
    return { response, raw, resolvedModel: undefined, finishReason: undefined, streamed: false };
  } catch (error) {
    if (externalSignal?.aborted) throw abortError();
    if (timedOut) throw new GeminiFailure("Gemini request timed out after " + Math.round(timeoutMs / 1000) + " seconds.", undefined, [], undefined, true);
    throw classifyFailure(error);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function requestModelText(apiKey: string, model: string, prompt: string, responseSchema: Record<string, unknown>, timeoutMs: number, maxOutputTokens: number, signal?: AbortSignal, onTextChunk?: (text: string) => void) {
  const endpoint = GEMINI_API_ROOT + "/models/" + encodeURIComponent(model) + (onTextChunk ? ":streamGenerateContent?alt=sse" : ":generateContent");
  const { response, raw, resolvedModel: streamedModel, finishReason: streamedFinishReason, streamed } = await fetchResponseText(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: onTextChunk ? "text/event-stream" : "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens, responseMimeType: "application/json", responseSchema }
    })
  }, timeoutMs, signal, onTextChunk);
  if (!response.ok) {
    let payload: unknown = {};
    try { payload = JSON.parse(stripResponseBom(raw)); } catch { /* Keep the HTTP status as the primary signal. */ }
    const detail = errorDetail(payload) || "Gemini returned HTTP " + response.status + ".";
    const serializedPayload = JSON.stringify(payload);
    throw new GeminiFailure(detail, response.status, [], retryAfterMs(response, serializedPayload), isTransient(response.status, detail), quotaScope(response.status, serializedPayload));
  }
  if (streamed) {
    return { text: stripJsonFence(raw), resolvedModel: streamedModel, finishReason: streamedFinishReason };
  }
  let payload: unknown = {};
  try {
    payload = JSON.parse(stripResponseBom(raw));
  } catch {
    throw new GeminiFailure("Gemini returned malformed JSON.", response.status, [], undefined, true);
  }
  const typed = payload as GeminiTextResponse;
  const text = typed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return { text: stripJsonFence(text), resolvedModel: typed.modelVersion, finishReason: typed.candidates?.[0]?.finishReason };
}

function availableModels(pool: ModelPool, allowedModels?: readonly string[]) {
  const now = Date.now();
  if (pool.projectQuotaCooldownUntil > now) return [];
  const resolved = new Set<string>();
  return pool.models.filter((model) => {
    if (allowedModels && !allowedModels.includes(model)) return false;
    const status = pool.checks.get(model)?.status;
    if (status === "failed" || status === "checking" || (pool.cooldowns.get(model) ?? 0) > now) return false;
    const version = pool.checks.get(model)?.resolvedModel;
    if (version && resolved.has(version)) return false;
    if (version) resolved.add(version);
    return true;
  });
}

function nextRetryAt(pool: ModelPool, allowedModels?: readonly string[]) {
  const retryTimes = Array.from(pool.cooldowns, ([model, time]) => ({ model, time }))
    .filter(({ model, time }) => time > Date.now() && (!allowedModels || allowedModels.includes(model)))
    .map(({ time }) => time);
  if (pool.projectQuotaCooldownUntil > Date.now()) retryTimes.push(pool.projectQuotaCooldownUntil);
  return retryTimes.length ? Math.min(...retryTimes) : undefined;
}

function retryCandidateModels(pool: ModelPool, allowedModels?: readonly string[]) {
  const resolved = new Set<string>();
  return pool.models.filter(model => {
    if (allowedModels && !allowedModels.includes(model)) return false;
    if (pool.checks.get(model)?.status === "failed") return false;
    const version = pool.checks.get(model)?.resolvedModel;
    if (version && resolved.has(version)) return false;
    if (version) resolved.add(version);
    return true;
  });
}

function reserveModel(pool: ModelPool, model: string) {
  if (pool.inFlight.size >= MAX_CONCURRENT_GEMINI_REQUESTS) return undefined;
  if (pool.inFlight.has(model) || !availableModels(pool, [model]).includes(model)) return undefined;
  const resolvedModel = pool.checks.get(model)?.resolvedModel;
  if (resolvedModel && pool.inFlightResolved.has(resolvedModel)) return undefined;
  pool.inFlight.add(model);
  if (resolvedModel) pool.inFlightResolved.add(resolvedModel);
  return model;
}

async function waitForRetry(until: number, signal: AbortSignal) {
  while (until > Date.now()) {
    if (signal.aborted) throw abortError();
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); signal.removeEventListener("abort", onAbort); reject(abortError()); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, Math.min(60_000, until - Date.now()));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }
  if (signal.aborted) throw abortError();
}

function markModelSuccess(pool: ModelPool, model: string, latencyMs: number, resolvedModel?: string) {
  pool.cooldowns.delete(model);
  pool.transientFailureCounts.delete(model);
  pool.checks.set(model, { model, status: "working", latencyMs, checkedAt: new Date().toISOString(), ...(resolvedModel ? { resolvedModel } : {}) });
}

function releaseModel(pool: ModelPool, model: string) {
  pool.inFlight.delete(model);
  const resolvedModel = pool.checks.get(model)?.resolvedModel;
  if (resolvedModel) pool.inFlightResolved.delete(resolvedModel);
}

function markModelFailure(pool: ModelPool, model: string, error: GeminiFailure) {
  const failureCount = (pool.transientFailureCounts.get(model) ?? 0) + 1;
  if (error.retryable && error.status !== 429) pool.transientFailureCounts.set(model, failureCount);
  const delay = error.status === 429
    ? Math.max(MODEL_COOLDOWN_MS, error.retryAfterMs ?? 0)
    : transientRetryDelayMs(failureCount, error.retryAfterMs ?? 0);
  const retryAt = error.retryable ? Date.now() + delay : undefined;
  if (retryAt) pool.cooldowns.set(model, retryAt);
  const resolvedModel = pool.checks.get(model)?.resolvedModel;
  pool.checks.set(model, { model, status: error.retryable ? "cooldown" : "failed", checkedAt: new Date().toISOString(), error: error.message, ...(resolvedModel ? { resolvedModel } : {}), ...(retryAt ? { retryAt: new Date(retryAt).toISOString() } : {}) });
  return retryAt;
}

type StructuredRequestOptions = { priority?: "interactive" | "background"; models?: readonly string[]; maxOutputTokens?: number; cacheContext?: string; identity?: RequestIdentity; streaming?: boolean; onStreamAttemptStart?: () => void; onStreamText?: (text: string) => void };

async function requestStructured<T>(apiKey: string, sessionId: string, prompt: string, responseSchema: Record<string, unknown>, stage: GeminiModelOutcome["stage"], timeoutMs = GENERATION_TIMEOUT_MS, signal?: AbortSignal, onProgress?: (event: GeminiProgressEvent) => void, options: StructuredRequestOptions = {}): Promise<{ value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] }> {
  const pool = await poolFor(apiKey, sessionId);
  if (!pool.ready) throw new GeminiFailure("Connect Gemini and wait until both primary Flash Lite models pass their structured-output checks.", undefined, [], undefined, false);
  if (signal?.aborted) throw abortError();
  const priority = options.priority === "background" ? 1 : 0;
  if (stage !== "learning") {
    return withRequestQueue(pool, signal, () => runStructuredRequest(pool, apiKey, prompt, responseSchema, stage, timeoutMs, signal ?? new AbortController().signal, onProgress, options), priority) as Promise<{ value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] }>;
  }
  const cacheKey = requestCacheKey(pool.cacheScope, stage, options.models ?? "all", options.maxOutputTokens ?? "default", options.cacheContext ?? "", options.identity ? canonicalRequestIdentity(options.identity) : prompt, responseSchema);
  const cached = pool.structuredCache.get(cacheKey);
  if (cached) return cached as { value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] };
  let flight = pool.structuredFlights.get(cacheKey);
  if (flight?.controller.signal.aborted) { pool.structuredFlights.delete(cacheKey); flight = undefined; }
  if (flight) recordPerformance("gemini", "coalesced");
  if (!flight) {
    const controller = new AbortController();
    const created: StructuredFlight = {
      controller,
      subscribers: new Set(),
      settled: false,
      promise: Promise.resolve({ value: {}, model: "", outcomes: [] })
    };
    created.promise = withRequestQueue(pool, controller.signal, () => runStructuredRequest(pool, apiKey, prompt, responseSchema, stage, timeoutMs, controller.signal, onProgress, options), priority).then((result) => {
      if (controller.signal.aborted) throw abortError();
      if (reusableStructuredValue(result.value, responseSchema)) pool.structuredCache.set(cacheKey, result);
      return result;
    }).finally(() => {
      created.settled = true;
      if (pool.structuredFlights.get(cacheKey) === created) pool.structuredFlights.delete(cacheKey);
    });
    flight = created;
    pool.structuredFlights.set(cacheKey, flight);
  }
  return subscribeToFlight<T>(flight, signal);
}

function subscribeToFlight<T>(flight: StructuredFlight, signal?: AbortSignal): Promise<{ value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] }> {
  const subscriber = Symbol("gemini-request");
  flight.subscribers.add(subscriber);
  return new Promise((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", onAbort);
      flight.subscribers.delete(subscriber);
      if (!flight.settled && flight.subscribers.size === 0) flight.controller.abort();
    };
    const onAbort = () => { release(); reject(abortError()); };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    flight.promise.then((result) => {
      if (finished) return;
      release();
      resolve(result as { value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] });
    }, (error) => {
      if (finished) return;
      release();
      reject(error);
    });
  });
}

async function runStructuredRequest<T>(pool: ModelPool, apiKey: string, prompt: string, responseSchema: Record<string, unknown>, stage: GeminiModelOutcome["stage"], timeoutMs: number, signal: AbortSignal, onProgress: ((event: GeminiProgressEvent) => void) | undefined, options: StructuredRequestOptions): Promise<{ value: T; model: string; resolvedModel?: string; outcomes: GeminiModelOutcome[] }> {
  const outcomes: GeminiModelOutcome[] = [];
  let lastError: GeminiFailure | undefined;
  const modelsAtStart = availableModels(pool, options.models);
  const retryAt = nextRetryAt(pool, options.models);
  const recover = options.priority !== "background";
  const candidates = retryCandidateModels(pool, options.models);
  if (!candidates.length) {
    onProgress?.({ type: "status", status: "unavailable" });
    throw new GeminiFailure("No available Gemini models remain. Reconnect in Settings to check model availability again.", undefined, outcomes, undefined, false);
  }
  if (pool.projectQuotaCooldownUntil > Date.now() || !recover && !modelsAtStart.length) {
    const error = new GeminiFailure("All available Gemini models are cooling down. Retry after the displayed retry time.", undefined, outcomes, retryAt ? Math.max(0, retryAt - Date.now()) : undefined, true);
    onProgress?.({ type: "status", status: retryAt ? "rate-limited" : "unavailable" });
    throw error;
  }
  let outputCapacity = nextOutputCapacity(options.maxOutputTokens ?? (stage === "candidate" ? 4096 : stage === "grounding" ? 16_384 : 2048));
  const rounds = geminiAttemptRounds(candidates, PRIMARY_FLASH_LITE_MODELS, recover);
  for (let round = 0; round < rounds.length; round += 1) {
    for (const target of rounds[round]) {
      if (signal.aborted) throw abortError();
      if (!retryCandidateModels(pool, options.models).includes(target)) continue;
      const modelRetryAt = pool.cooldowns.get(target) ?? 0;
      if (modelRetryAt > Date.now()) {
        if (!recover || round === 0 && modelsAtStart.length) continue;
        onProgress?.({ type: "cooldown", until: new Date(modelRetryAt).toISOString() });
        await waitForRetry(modelRetryAt, signal);
      }
      const model = reserveModel(pool, target);
      if (!model) continue;
      if (outcomes.length) recordPerformance("gemini", "retries");
      const started = Date.now();
      const maxOutputTokens = outputCapacity;
      let finishReason: string | undefined;
      try {
        if (options.streaming) options.onStreamAttemptStart?.();
        const result = await requestModelText(apiKey, model, prompt, responseSchema, timeoutMs, maxOutputTokens, signal, options.streaming ? options.onStreamText : undefined);
        finishReason = result.finishReason ?? "UNKNOWN";
        outputCapacity = nextOutputCapacity(maxOutputTokens, finishReason);
        let value: T;
        try { value = parseStructuredResponse(result.text, responseSchema) as T; }
        catch { throw new GeminiFailure(finishReason === "MAX_TOKENS" ? "Gemini reached its output limit before a complete item arrived." : "Gemini returned malformed structured output.", undefined, [], undefined, true); }
        if (!value || typeof value !== "object") throw new GeminiFailure("Gemini returned malformed structured output.", undefined, [], undefined, true);
        const outcome: GeminiModelOutcome = { model, resolvedModel: result.resolvedModel, finishReason, outputLimitReached: finishReason === "MAX_TOKENS", maxOutputTokens, stage, status: "success", latencyMs: Date.now() - started };
        markModelSuccess(pool, model, outcome.latencyMs ?? 0, result.resolvedModel);
        outcomes.push(outcome);
        onProgress?.({ type: "model", outcome });
        onProgress?.({ type: "status", status: "connected" });
        releaseModel(pool, model);
        return { value, model, resolvedModel: result.resolvedModel, outcomes };
      } catch (rawError) {
        releaseModel(pool, model);
        if (signal.aborted) throw abortError();
        const error = classifyFailure(rawError);
        const modelRetryAt = markModelFailure(pool, model, error);
        const outcome: GeminiModelOutcome = { model, ...(finishReason ? { finishReason, outputLimitReached: finishReason === "MAX_TOKENS", maxOutputTokens } : {}), stage, status: error.retryable ? "cooldown" : "failed", latencyMs: Date.now() - started, error: error.message, ...(modelRetryAt ? { retryAt: new Date(modelRetryAt).toISOString() } : {}) };
        outcomes.push(outcome);
        onProgress?.({ type: "model", outcome });
        if (isCredentialFailure(error)) {
          onProgress?.({ type: "status", status: "invalid" });
          throw new GeminiFailure(error.message, error.status, outcomes, error.retryAfterMs, false);
        }
        if (error.status === 429 && error.quotaScope !== "model") {
          pool.projectQuotaCooldownUntil = Date.now() + Math.max(MODEL_COOLDOWN_MS, error.retryAfterMs ?? 0);
          onProgress?.({ type: "status", status: "rate-limited" });
          throw new GeminiFailure(error.quotaScope === "project" ? "Gemini reports a project-wide quota limit. Retry after the displayed cooldown." : error.message, error.status, outcomes, error.retryAfterMs, true, error.quotaScope);
        }
        if (!error.retryable && error.status !== 404) {
          onProgress?.({ type: "status", status: "unavailable" });
          throw new GeminiFailure(error.message, error.status, outcomes, error.retryAfterMs, false);
        }
        lastError = new GeminiFailure(error.message, error.status, outcomes, error.retryAfterMs, error.retryable, error.quotaScope);
      }
    }
  }
  if (signal.aborted) throw abortError();
  const allOutcomesCooldown = outcomes.length > 0 && outcomes.every((outcome) => outcome.status === "cooldown");
  const finalStatus: GeminiStatus = allOutcomesCooldown ? "rate-limited" : "unavailable";
  onProgress?.({ type: "status", status: finalStatus });
  if (!outcomes.length && retryAt) throw new GeminiFailure("All available Gemini models are cooling down. Retry after the displayed retry time.", undefined, outcomes, Math.max(0, retryAt - Date.now()), true);
  throw new GeminiFailure("Every available Gemini model failed" + (recover ? " after the initial pass and both recovery cycles. " : " this request. ") + (lastError?.message ?? "Retry after checking the model status in Settings."), lastError?.status, outcomes, lastError?.retryAfterMs, allOutcomesCooldown, lastError?.quotaScope);
}

export function describeGeminiError(error: unknown) {
  const failure = classifyFailure(error);
  if (failure.status === 401 || failure.status === 403 || /API key|permission|unauthorized|forbidden/i.test(failure.message)) return "Gemini rejected this API key. Check that it is active in Google AI Studio, then paste it again.";
  if (failure.status === 429 || /quota|rate.?limit|resource exhausted/i.test(failure.message)) return "Gemini is rate-limited or out of quota. The app will retry after its cooldown.";
  if (failure.status === 404 || /not found|unsupported model/i.test(failure.message)) return "This requested Gemini model is unavailable for the key. It was skipped without using an unrequested model.";
  if (/no eligible|structured-output checks/i.test(failure.message)) return "Connect Gemini and wait until both primary Flash Lite models pass their structured-output checks.";
  if (/timed out|timeout/i.test(failure.message)) return "Gemini timed out. The scheduler is trying another allowed model.";
  if (/Wikipedia/i.test(failure.message)) return failure.message;
  if (/malformed|structured/i.test(failure.message)) return "Gemini returned invalid structured output. The scheduler will try another allowed model.";
  return "Gemini could not complete this request. Check the key in Settings and retry.";
}

export function geminiFailureDetails(error: unknown): { status?: GeminiStatus; outcomes: GeminiModelOutcome[] } {
  if (!(error instanceof GeminiFailure)) return { outcomes: [] };
  if (error.outcomes.some((outcome) => outcome.status === "success")) return { status: "connected", outcomes: error.outcomes };
  if (!error.outcomes.length && error.status !== 401 && error.status !== 403 && error.status !== 429 && !error.retryAfterMs) return { outcomes: [] };
  const status: GeminiStatus = isCredentialFailure(error)
    ? "invalid"
    : error.status === 429 || error.outcomes.length > 0 && error.outcomes.every((outcome) => outcome.status === "cooldown")
      ? "rate-limited"
      : "unavailable";
  return { status, outcomes: error.outcomes };
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

function normalizeAvoidMemory(avoid: Array<FactMemory | FactAvoidKey | FactNoveltySignature | string>) {
  return avoid.map((item, index) => typeof item === "string"
    ? { id: `legacy-memory-${index}`, title: item, hook: "", body: "", topicPath: [], claim: item, fingerprint: normalizedText(item), claimFingerprint: normalizedText(item), sourceUrls: [], evidence: [], evidenceKeys: [], evidenceSections: [] }
    : "body" in item && typeof item.id === "string" && typeof item.title === "string" ? item : null).filter(Boolean) as FactMemory[];
}

function normalizeAvoidKeys(avoid: Array<FactMemory | FactAvoidKey | FactNoveltySignature | string>) {
  const keys = new Set<string>();
  for (const item of avoid) {
    if (typeof item === "string") keys.add(`f:${item}`);
    else if ("body" in item) factAvoidKeys([item]).forEach(key => {
      keys.add(`f:${key.fingerprint}`);
      if (key.claimFingerprint) keys.add(`c:${key.claimFingerprint}`);
      key.evidenceKeys?.forEach(value => keys.add(`e:${value}`));
    });
    else {
      keys.add(`f:${item.fingerprint}`);
      if (item.claimFingerprint) keys.add(`c:${item.claimFingerprint}`);
      item.evidenceKeys?.forEach(value => keys.add(`e:${value}`));
    }
  }
  return keys;
}

function factAvoidKeySet(fact: FactMemory) {
  const keys = factAvoidKeys([fact])[0];
  return new Set([
    `f:${keys.fingerprint}`,
    ...(keys.claimFingerprint ? [`c:${keys.claimFingerprint}`] : []),
    ...(keys.evidenceKeys ?? []).map(value => `e:${value}`)
  ]);
}

function candidateSchema(slotCount: number) {
  return responseSchemaCache.get(`candidate:${slotCount}`, () => ({ type: "OBJECT", properties: { facts: { type: "ARRAY", maxItems: slotCount, items: { type: "OBJECT", properties: { slot: { type: "INTEGER" }, title: { type: "STRING" }, claim: { type: "STRING" }, topicPath: { type: "ARRAY", items: { type: "STRING" } }, wikipediaSearchTitles: { type: "ARRAY", minItems: 1, maxItems: 3, items: { type: "STRING" } } }, required: ["slot", "title", "claim", "topicPath", "wikipediaSearchTitles"] } } }, required: ["facts"] }));
}
function groundedSchema(sentenceCount: number, combined = false) {
  return responseSchemaCache.get(`grounded:${sentenceCount}:${combined ? 1 : 0}`, () => ({ type: "OBJECT", properties: { facts: { type: "ARRAY", items: { type: "OBJECT", properties: {
    ...(combined ? {topicPath: { type: "ARRAY", items: {type: "STRING"} }} : {}), slot: { type: "INTEGER" }, status: { type: "STRING", enum: ["grounded", "needs_evidence", "duplicate", "angle_unavailable"] }, duplicateOf: { type: "STRING" }, claimEvidenceIds: { type: "ARRAY", minItems: 1, maxItems: 3, items: { type: "STRING" } }, missingEvidence: { type: "STRING" }, title: { type: "STRING" }, hook: { type: "STRING" }, claim: { type: "STRING" },
    sentences: { type: "ARRAY", items: { type: "STRING" }, minItems: sentenceCount, maxItems: sentenceCount },
    evidence: { type: "ARRAY", maxItems: 12, items: { type: "OBJECT", properties: { sentence: { type: "INTEGER" }, evidenceIds: { type: "ARRAY", minItems: 1, maxItems: 3, items: { type: "STRING" } } }, required: ["sentence", "evidenceIds"] } },
    followUpQuestions: { type: "ARRAY", maxItems: 2, items: { type: "STRING" } },
    chronology: { type: "OBJECT", properties: { events: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: {
      dateText: { type: "STRING" }, eventText: { type: "STRING" }, anchor: { type: "OBJECT", properties: { field: { type: "STRING", enum: ["title", "hook", "body"] }, sentenceIndex: { type: "INTEGER" } }, required: ["field"] }
    }, required: ["dateText", "eventText", "anchor"] } } }, required: ["events"] },
    locations: { type: "ARRAY", maxItems: 2, items: { type: "OBJECT", properties: { name: { type: "STRING" }, articleTitle: { type: "STRING" }, anchor: { type: "OBJECT", properties: { field: { type: "STRING", enum: ["title", "hook", "body"] }, sentenceIndex: { type: "INTEGER" } }, required: ["field"] } }, required: ["name", "articleTitle", "anchor"] } }
  // Special statuses (for example, a duplicate) are intentionally compact.
  // The grounded-card validator below checks claim and citation fields when status is grounded.
  }, required: ["slot", "status", ...(combined ? ["topicPath"] : [])] } } }, required: ["facts"] }));
}

function splitIntoGroups<T>(items: T[], maxItems: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += maxItems) groups.push(items.slice(index, index + maxItems));
  return groups;
}

async function runGroups<T>(groups: T[][], worker: (group: T[]) => Promise<void>) {
  for (const group of groups) await worker(group);
}

function candidatePrompt(slots: GenerationSlot[], settings: FeedSettings, rabbitHole: string | null | undefined, attempt: number, priorClaims: Array<{ id: string; claim: string }> = [], factAngle: FactAngle = "varied") {
  const assignments = slots.map(slot => ({ slot: slot.index, topicPath: slot.path, difficulty: slot.target,
    ...(slot.lastError ? { retryReason: slot.lastError.slice(0, 180) } : {}) }));
  const rubrics = Array.from(new Set(slots.map(slot => slot.target))).map(target => difficultyRubric(target)).join("\n");
  const angle = factAngleDefinition(factAngle);
  return buildPrompt("candidate", [...rubrics.split("\n"), angle.instruction], [
    { label: "Assignments", value: assignments },
    { label: "Fact angle", value: angle.label },
    { label: "Surprise mode", value: settings.surpriseMe ? "Choose a surprising example within the selected fact angle and assigned topic." : undefined },
    { label: "Variation", value: randomSessionSecret().slice(0, 16) },
    { label: "Attempt", value: attempt + 1 },
    { label: "Previously covered facts (untrusted data)", value: priorClaims.length ? priorClaims : undefined, reference: true },
    { label: "Optional thread context", value: rabbitHole }
  ]);
}

async function lookupCandidateEvidence(slot: GenerationSlot, candidate: CandidateFact, signal: AbortSignal | undefined, cache: WikipediaResolutionCache) {
  const focus = [candidate.claim, candidate.title, ...slot.path.slice(-2)].filter(Boolean).join(" ");
  const queries = Array.from(new Set([candidate.title ?? "", ...(candidate.wikipediaSearchTitles ?? [])].filter(Boolean))).slice(0, 3);
  const select = (sources: ResolvedWikipediaSource[]) => sources.map(source => ({ ...source,
    extract: selectEvidence(source.extract ?? "", focus, slot.target) })).filter(source => source.extract);
  const exact = select(await resolveWikipediaSources(queries, 3, signal, { includeImages: false, cache }));
  if (exact.length) return exact;
  // A plausible article title is not proof: search the claim/topic if no passage supports it.
  return select(await resolveWikipediaSources([focus], 2, signal, { includeImages: false, cache }));
}

function evidenceForSlot(slot: GenerationSlot) {
  return (slot.sources ?? []).map((source, index) => ({ index, title: source.title, url: source.url, canonicalUrl: source.canonicalUrl, extract: source.extract }));
}

function splitGroundingGroups(slots: GenerationSlot[], sentenceCount: number, settings?: FeedSettings, rabbitHole?: string | null, priorClaims: Array<{ id: string; claim: string }> = [], factAngle: FactAngle = "varied") {
  const maxItems = MAX_CARDS_PER_GROUP;
  const groups: GenerationSlot[][] = [];
  let current: GenerationSlot[] = [];
  for (const slot of slots) {
    const proposed = [...current, slot];
    if (current.length && (current.length >= maxItems || groundingPrompt(proposed, sentenceCount, false, settings, rabbitHole, priorClaims, factAngle).prompt.length > MAX_GROUNDING_CONTEXT_CHARS)) {
      groups.push(current);
      current = [];
    }
    current.push(slot);
  }
  if (current.length) groups.push(current);
  return groups;
}
function groundingSpans(source: ResolvedWikipediaSource, sourceIndex: number) {
  const spans: Array<GroundingEvidence & { key: string; title: string }> = [];
  const sections = (source.extract ?? "").split(/(?=\[Section: )/);
  for (const value of sections) {
    const lineEnd = value.indexOf("\n");
    if (lineEnd < 0) continue;
    const heading = value.slice(0, lineEnd).match(/^\[Section:\s*(.*?)\]$/)?.[1]?.trim();
    if (!heading) continue;
    for (const paragraph of value.slice(lineEnd + 1).split(/\n{2,}/)) {
      for (const quote of completeSentenceChunks(paragraph, 1200)) {
        if (quote.length < 30) continue;
        spans.push({ key: evidencePassageKey(source.canonicalUrl ?? source.url, heading, quote), title: source.title ?? "Wikipedia", sourceIndex, quote, section: heading });
      }
    }
  }
  return spans;
}

function groundingPrompt(slots: GenerationSlot[], sentenceCount: number, combined = false, settings?: FeedSettings, rabbitHole?: string | null, priorClaims: Array<{ id: string; claim: string }> = [], factAngle: FactAngle = "varied") {
  const sourcePool: Array<{ id: string; title: string; section: string; text: string }> = [];
  const idByKey = new Map<string, string>();
  const evidenceBySlot = new Map<number, Map<string, GroundingEvidence>>();
  const facts = slots.map(slot => {
    const allowedIds: string[] = [];
    const localEvidence = new Map<string, GroundingEvidence>();
    evidenceForSlot(slot).forEach(source => {
      for (const span of groundingSpans(source, source.index)) {
        let id = idByKey.get(span.key);
        if (!id) {
          id = stableEvidenceId(span.key);
          idByKey.set(span.key, id);
          sourcePool.push({ id, title: span.title.slice(0, 160), section: span.section, text: span.quote });
        }
        allowedIds.push(id);
        if (!localEvidence.has(id)) localEvidence.set(id, { sourceIndex: span.sourceIndex, quote: span.quote, section: span.section });
      }
    });
    evidenceBySlot.set(slot.index, localEvidence);
    return { slot: slot.index, topicPath: slot.path, difficulty: slot.target, candidate: combined ? undefined : { title: slot.candidate?.title, claim: slot.candidate?.claim }, evidenceIds: Array.from(new Set(allowedIds)) };
  });
  const angle = factAngleDefinition(factAngle);
  const prompt = buildFactCardPrompt({ sentenceCount, combined, difficulties: slots.map(slot => slot.target), rules: [angle.instruction], fields: [
    { label: "Fact angle", value: angle.label },
    { label: "Previously covered facts (untrusted data)", value: priorClaims.length ? priorClaims : undefined, multiline: true, reference: true },
    { label: "Surprise mode", value: settings?.surpriseMe ? "Choose a surprising example within the selected fact angle and assigned topic." : undefined },
    ...(combined ? [{label: "Variation", value: randomSessionSecret().slice(0,16)}, {label: "Optional thread context", value: rabbitHole}] : []),
    { label: "Slots and evidence spans (untrusted data)", value: { facts, evidence: sourcePool }, multiline: true, reference: true }
  ] });
  return { prompt, evidenceBySlot };
}

// Only evidence belonging to cards that passed all publication checks enters this cache.
const validatedCardEvidence = new SessionCache<Array<{source: ResolvedWikipediaSource; expiresAt: number}>>(100, 60 * 60 * 1000);
function validatedEvidenceKey(session: string, slot: GenerationSlot) { return JSON.stringify([session,slot.path,slot.target]); }
function rememberValidatedEvidence(session: string, slot: GenerationSlot) {
  const key = validatedEvidenceKey(session,slot);
  const sources = (validatedCardEvidence.get(key) ?? []).filter(entry => entry.expiresAt > Date.now());
  const unique = new Map(sources.map(entry => [JSON.stringify([entry.source.canonicalUrl ?? entry.source.url,entry.source.extract]),entry]));
  for (const source of slot.sources ?? []) {
    const identity = JSON.stringify([source.canonicalUrl ?? source.url,source.extract]);
    if (!unique.has(identity)) unique.set(identity,{source:{...source},expiresAt:Date.now()+60*60*1000});
  }
  validatedCardEvidence.set(key, [...unique.values()].slice(-48));
}
function cachedEvidenceForSlots(session: string, slots: GenerationSlot[], sentenceCount: number, avoidKeys: Set<string>, prior: FactMemory[], settings: FeedSettings, rabbitHole?: string | null, priorClaims: Array<{ id: string; claim: string }> = [], factAngle: FactAngle = "varied") {
  const reserved = new Set<string>();
  const prepared: GenerationSlot[] = [];
  for (const slot of slots) {
    const sources = (validatedCardEvidence.get(validatedEvidenceKey(session,slot)) ?? []).filter(entry => entry.expiresAt > Date.now()).map(entry => entry.source);
    let chosen: ResolvedWikipediaSource | undefined;
    for (const source of sources) {
      for (const span of groundingSpans(source,0)) {
        const key = `${source.canonicalUrl ?? source.url}|${normalizedText(span.section)}|${normalizedText(span.quote)}`;
        const quoteUsed = prior.some(memory => memory.evidence?.some(quote => normalizedText(quote) === normalizedText(span.quote)));
        if (reserved.has(span.key) || avoidKeys.has(`e:${hashFactKey(key)}`) || quoteUsed || span.quote.length < sentenceCount * 35 || (span.quote.match(/[.!?](?:\s|$)/g)?.length ?? 0) < Math.min(sentenceCount,3)) continue;
        chosen = {...source,extract:`[Section: ${span.section}]\n${span.quote}`};
        reserved.add(span.key); break;
      }
      if (chosen) break;
    }
    if (!chosen) return undefined;
    prepared.push({...slot,sources:[chosen],mode:"combined"});
  }
  if (prepared.length > MAX_CARDS_PER_GROUP || groundingPrompt(prepared,sentenceCount,true,settings,rabbitHole,priorClaims,factAngle).prompt.length > MAX_GROUNDING_CONTEXT_CHARS) return undefined;
  return prepared;
}

function hasAssignedTopic(candidate: CandidateFact, path: string[]) {
  if (!candidate.topicPath?.length) return false;
  if (candidate.topicPath.length < path.length) return false;
  return path.every((part, index) => normalizedText(candidate.topicPath![index]) === normalizedText(part));
}

export async function generateGeminiFacts({ apiKey, sessionId = "default-session", topicPaths, settings, learningProfile, avoid, rabbitHole, factAngle: requestedFactAngle, requestedCount = DEFAULT_CARD_GENERATION_COUNT, signal, onProgress }: { apiKey: string; sessionId?: string; topicPaths: Array<{ path: string[]; weight: number; difficulty?: Difficulty; slotId?: string }>; settings: FeedSettings; learningProfile: LearningProfile; avoid: Array<FactMemory | FactAvoidKey | FactNoveltySignature | string>; rabbitHole?: string | null; factAngle?: FactAngle; requestedCount?: number; signal?: AbortSignal; onProgress?: (event: GeminiProgressEvent) => void }): Promise<GeminiGenerationResult> {
  const factAngle = normalizeFactAngle(requestedFactAngle);
  if (!apiKey.trim()) throw new GeminiFailure("Paste your Gemini API key in Settings to generate a fresh batch.", undefined, [], undefined, false);
  if (!topicPaths.length) throw new GeminiFailure("Choose at least one topic before generating a batch.", undefined, [], undefined, false);
  const cards: FactCard[] = [];
  const outcomes: GeminiModelOutcome[] = [];
  const targetCount = Math.max(1, Math.min(MAX_FACTS_PER_BATCH, Math.round(requestedCount)));
  if (!validStableBatchAssignments(topicPaths, targetCount)) throw new RangeError("Generation slot assignments must contain one verified path, difficulty and stable ID for every requested card.");
  const suppliedSlotIds = topicPaths.map(topic => topic.slotId).filter((id): id is string => typeof id === "string");
  if (suppliedSlotIds.length && (suppliedSlotIds.length !== targetCount || new Set(suppliedSlotIds).size !== suppliedSlotIds.length || suppliedSlotIds.some(id => !id.trim() || id.length > 160))) {
    throw new RangeError("Generation slot assignments must have unique stable IDs for every requested card.");
  }
  const sentenceCount = normalizeSentenceLength(settings.sentenceLength);
  const candidateGroupSize = MAX_CARDS_PER_GROUP;
  const slots: GenerationSlot[] = Array.from({ length: targetCount }, (_, index) => {
    const assignment = topicPaths[index % topicPaths.length];
    const path = assignment.path;
    const explicitDifficulty = assignment.difficulty;
    if (explicitDifficulty !== undefined && (!Number.isInteger(explicitDifficulty) || explicitDifficulty < 1 || explicitDifficulty > 10)) throw new RangeError("A batch slot has an unsupported difficulty target.");
    return { index, slotId: assignment.slotId, path, target: explicitDifficulty ?? getTopicLearningProfile(learningProfile, path, normalizeDifficulty(settings.obscurity)).targetDifficulty, mode: "candidate" };
  });
  const priorMemory = normalizeAvoidMemory(avoid);
  const priorAvoidKeys = normalizeAvoidKeys(avoid);
  const noveltyHistory: NoveltyInput[] = [...priorMemory, ...avoid.filter((item): item is FactNoveltySignature => typeof item === "object" && item !== null && "kind" in item && item.kind === "fact-novelty")];
  const noveltyIndex = new FactNoveltyIndex(noveltyHistory);
  const memory = [...priorMemory];
  const acceptedSlots = new Set<number>();
  const acceptedCardBySlot = new Map<number, FactCard>();
  const diagnostics = new ValidationDiagnostics();
  const wikiCache = sharedWikipediaResolutionCache;
  let providerExhausted = false;
  let publicationGate = Promise.resolve();
  const emit = (event: GeminiProgressEvent) => {
    if (event.type === "model") outcomes.push(event.outcome);
    onProgress?.(event);
  };
  const uniqueForPublication = async (card: FactCard) => {
    const previous = publicationGate;
    let unlock!: () => void;
    publicationGate = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    try {
      if (signal?.aborted) throw abortError();
      const next = rememberFact(card);
      const exactKeys = [...factAvoidKeySet(next)].filter(key => !key.startsWith("e:"));
      if (noveltyIndex.findDuplicate(next) || exactKeys.some(key => priorAvoidKeys.has(key))) return false;
      memory.push(next);
      noveltyIndex.add(next);
      return true;
    } finally { unlock(); }
  };
  const markRetry = (slot: GenerationSlot, message: string, round: number, retryGrounding: boolean, validation = true) => {
    slot.lastError = validation ? diagnostics.record("grounding", slot.index, message) : message;
    slot.mode = retryGrounding && round === 0 ? "grounding" : "candidate";
  };

  const initialPriorClaims = selectPriorFactClaims(noveltyHistory, topicPaths.map(topic => topic.path));
  const cachedSlots = cachedEvidenceForSlots(sessionId, slots, sentenceCount, priorAvoidKeys, priorMemory, settings, rabbitHole, initialPriorClaims, factAngle);
  if (cachedSlots) cachedSlots.forEach((slot,index) => { slots[index] = slot; });
  for (let round = cachedSlots ? -1 : 0; round < MAX_CANDIDATE_RETRIES && acceptedSlots.size < targetCount; round += 1) {
    if (signal?.aborted) throw abortError();
    const candidateSlots = slots.filter(slot => !acceptedSlots.has(slot.index) && slot.mode === "candidate");
    const candidateGroups = splitIntoGroups(candidateSlots, candidateSlots.some(slot => slot.candidateOutputFloor === MAX_OUTPUT_CAPACITY) ? 1 : candidateGroupSize);
    const candidatesThisRound = new FactNoveltyIndex();
    await runGroups(candidateGroups, async group => {
      if (providerExhausted) return;
      if (signal?.aborted) throw abortError();
      const streamedCandidates = new Map<number, { identity: string; promise: Promise<ResolvedWikipediaSource[]> }>();
      const streamedNoveltyCandidates: NoveltyInput[] = [];
      const prefetchRejected = new Set<number>();
      const streamParser = new JsonArrayItemStreamParser("facts");
      const candidateIdentity = (candidate: CandidateFact) => JSON.stringify([candidate.title, candidate.claim, candidate.topicPath, candidate.wikipediaSearchTitles]);
      const startEvidenceLookup = (slot: GenerationSlot, candidate: CandidateFact) => {
        const identity = candidateIdentity(candidate);
        if (streamedCandidates.has(slot.index) || !candidate.title?.trim() || !candidate.claim?.trim() || !hasAssignedTopic(candidate, slot.path) || factSpecificityReason(candidate.claim)) return;
        const noveltyCandidate: NoveltyInput = { id: `stream-${round}-${slot.index}`, title: candidate.title, claim: candidate.claim, body: "", topicPath: candidate.topicPath ?? slot.path };
        if (noveltyIndex.findDuplicate(noveltyCandidate) || candidatesThisRound.findDuplicate(noveltyCandidate) || streamedNoveltyCandidates.some(previous => noveltyRepeatedFact(noveltyCandidate, previous))) {
          prefetchRejected.add(slot.index);
          return;
        }
        streamedNoveltyCandidates.push(noveltyCandidate);
        const promise = lookupCandidateEvidence(slot, candidate, signal, wikiCache).catch(() => []);
        streamedCandidates.set(slot.index, { identity, promise });
      };
      try {
        const priorClaims = selectPriorFactClaims([...noveltyHistory, ...memory], group.map(slot => slot.path));
        const result = await requestStructured<{ facts?: CandidateFact[] }>(apiKey, sessionId, candidatePrompt(group, settings, rabbitHole, round, priorClaims, factAngle), candidateSchema(group.length), "candidate", GENERATION_TIMEOUT_MS, signal, emit, {
          maxOutputTokens: Math.max(4096, ...group.map(slot => slot.candidateOutputFloor ?? 0)),
          streaming: true,
          onStreamAttemptStart: () => {
            streamParser.reset();
            streamedCandidates.clear();
            streamedNoveltyCandidates.length = 0;
            prefetchRejected.clear();
          },
          onStreamText: (text) => {
            for (const value of streamParser.push(text)) {
              const candidate = normalizeStructuredValue(value, candidateSchema(group.length).properties.facts.items) as CandidateFact | undefined;
              if (!candidate) continue;
              const slot = group.find(item => item.index === candidate.slot);
              if (slot) startEvidenceLookup(slot, candidate);
            }
          }
        });
        const floor = truncatedOutputFloor(result.outcomes);
        if (floor) for (const slot of group) slot.candidateOutputFloor = Math.max(slot.candidateOutputFloor ?? 0, floor);
        const facts = result.value.facts ?? [];
        const eligible: GenerationSlot[] = [];
        for (const slot of group) {
          const matches = facts.filter(fact => fact.slot === slot.index);
          const candidate = matches.length === 1 ? matches[0] : undefined;
          if (!candidate?.title?.trim() || !candidate.claim?.trim() || !hasAssignedTopic(candidate, slot.path)) {
            slot.lastError = diagnostics.record("candidate", slot.index, "Gemini omitted a slot or returned a candidate for the wrong topic.");
            continue;
          }
          const specificityReason = factSpecificityReason(candidate.claim);
          if (specificityReason) {
            slot.lastError = diagnostics.record("candidate", slot.index, specificityReason);
            slot.mode = "candidate";
            slot.candidate = undefined;
            slot.sources = [];
            continue;
          }
          const noveltyCandidate: NoveltyInput = { id: `candidate-${round}-${slot.index}`, title: candidate.title, claim: candidate.claim, body: "", topicPath: candidate.topicPath ?? slot.path };
          if (prefetchRejected.has(slot.index) || noveltyIndex.findDuplicate(noveltyCandidate) || candidatesThisRound.findDuplicate(noveltyCandidate)) {
            slot.lastError = diagnostics.record("candidate", slot.index, "This candidate repeats a fact already covered in your history or this batch.");
            slot.mode = "candidate";
            slot.candidate = undefined;
            continue;
          }
          candidatesThisRound.add(noveltyCandidate);
          slot.candidate = candidate;
          eligible.push(slot);
        }
        await Promise.all(eligible.map(async slot => {
          try {
            const streamed = streamedCandidates.get(slot.index);
            if (streamed && streamed.identity === candidateIdentity(slot.candidate!)) slot.sources = await streamed.promise;
            else {
              slot.sources = await lookupCandidateEvidence(slot, slot.candidate!, signal, wikiCache);
            }
            if (!slot.sources.length) throw new GeminiFailure("Wikipedia did not return supporting articles for this fact.");
            slot.mode = "grounding";
          } catch (rawError) {
            if (signal?.aborted) throw abortError();
            slot.lastError = rawError instanceof Error ? rawError.message : "Wikipedia could not verify this candidate.";
          }
        }));
      } catch (rawError) {
        if (signal?.aborted) throw abortError();
        const error = classifyFailure(rawError);
        if (isCredentialFailure(error)) throw error;
        if (error.outcomes.length || /available Gemini models|every available Gemini model/i.test(error.message)) providerExhausted = true;
        for (const slot of group) slot.lastError = error.message;
      }
    });

    const groundingSlots = slots.filter(slot => !acceptedSlots.has(slot.index) && (slot.mode === "combined" || slot.mode === "grounding" && slot.candidate) && slot.sources?.length);
    const groundingGroups = splitGroundingGroups(groundingSlots, sentenceCount, settings, rabbitHole, selectPriorFactClaims([...noveltyHistory, ...memory], groundingSlots.map(slot => slot.path)), factAngle).flatMap(group => group.some(slot => slot.groundingOutputFloor === MAX_OUTPUT_CAPACITY) ? group.map(slot => [slot]) : [group]);
    await runGroups(groundingGroups, async group => {
      if (providerExhausted) return;
      if (signal?.aborted) throw abortError();
      try {
        const combined = group.every(slot => slot.mode === "combined");
        const priorClaims = selectPriorFactClaims([...noveltyHistory, ...memory], group.map(slot => slot.path));
        const grounding = groundingPrompt(group, sentenceCount, combined, settings, rabbitHole, priorClaims, factAngle);
        const maxOutputTokens = Math.min(65_536, Math.max(8192, group.length * sentenceCount * 500, ...group.map(slot => slot.groundingOutputFloor ?? 0)));
        const result = await requestStructured<{ facts?: GroundedFact[] }>(apiKey, sessionId, grounding.prompt, groundedSchema(sentenceCount, combined), "grounding", GENERATION_TIMEOUT_MS, signal, emit, { maxOutputTokens });
        const floor = truncatedOutputFloor(result.outcomes);
        if (floor) for (const slot of group) slot.groundingOutputFloor = Math.max(slot.groundingOutputFloor ?? 0, floor);
        const facts = result.value.facts ?? [];
        for (const slot of group) {
          const matches = facts.filter(fact => fact.slot === slot.index);
          const fact = matches.length === 1 ? matches[0] : undefined;
          try {
            if (!fact) throw new GeminiFailure("Gemini omitted this grounded fact slot.");
            if (combined) {
              if (!hasAssignedTopic(fact,slot.path)) throw new GeminiFailure("The combined card returned a different topic.");
              slot.candidate = {title:fact.title,claim:fact.claim,topicPath:fact.topicPath};
            }
            if (fact.status === "needs_evidence") {
              markRetry(slot, "The supplied passages do not support this card’s specific main claim; more evidence is needed.", round, false);
              continue;
            }
            if (fact.status === "angle_unavailable") {
              const label = factAngleDefinition(factAngle).label;
              markRetry(slot, fact.missingEvidence?.trim() || `The supplied evidence cannot support a main fact that fits the ${label} angle.`, round, false);
              continue;
            }
            if (fact.status === "duplicate") {
              markRetry(slot, `This fact repeats ${fact.duplicateOf || "another covered fact"}.`, round, false);
              continue;
            }
            if (fact.status !== "grounded") throw new GeminiFailure("The grounded result is missing a valid evidence status.");
            const assignedEvidence = grounding.evidenceBySlot.get(slot.index) ?? new Map<string, GroundingEvidence>();
            // Claim support is explicit and must use this slot's supplied evidence, independently of sentence citations.
            const claimEvidence = restoreEvidenceReferences([{ sentence: 0, evidenceIds: fact.claimEvidenceIds }], assignedEvidence, sentenceCount);
            const localFact: GroundedDraft = {
              title: fact.title ?? "",
              hook: fact.hook ?? "",
              claim: fact.claim ?? "",
              claimEvidence: claimEvidence.map(item => item.quote),
              sentences: fact.sentences ?? [],
              evidence: restoreEvidenceReferences(fact.evidence, assignedEvidence, sentenceCount)
            };
            const sentenceEvidenceIds = new Set((fact.evidence ?? []).flatMap(item => item.evidenceIds ?? []));
            if (!fact.claimEvidenceIds!.every(id => sentenceEvidenceIds.has(id))) throw new GeminiFailure("The card’s main claim evidence is missing from its sentence citations.");
            validateDraft(localFact, slot.sources!, sentenceCount, slot.target);
            const chosenIndexes = Array.from(new Set(localFact.evidence.map(item => item.sourceIndex)));
            const chosenSources = chosenIndexes.map(index => slot.sources![index]);
            const linkedSources = chosenSources.map((source, selectedIndex) => {
              const originalIndex = chosenIndexes[selectedIndex];
              const quote = localFact.evidence.find(item => item.sourceIndex === originalIndex)?.quote;
              return quote ? { ...source, canonicalUrl: source.canonicalUrl ?? source.url, url: wikipediaEvidenceLink(source.url, quote) } : source;
            });
            const generatedAt = new Date().toISOString();
            const card: FactCard = {
              id: "gemini-" + Date.now() + "-" + slot.index + "-" + round + "-" + Math.random().toString(36).slice(2, 8),
              hook: localFact.hook.trim().replace(/[.]+$/, ""),
              title: localFact.title.trim(),
              body: localFact.sentences.map(sentence => sentence.trim()).join(" "),
              sentences: localFact.sentences.map(sentence => sentence.trim()),
              sentenceCount,
              claim: localFact.claim.trim(),
              evidence: localFact.evidence.map(item => ({ ...item, sourceIndex: chosenIndexes.indexOf(item.sourceIndex) })),
              topicPath: slot.path,
              sources: cardSources(linkedSources),
              difficulty: slot.target,
              obscurity: slot.target,
              accent: ["blue", "lilac", "mint", "sand", "coral"][slot.index % 5] as FactCard["accent"],
              surprise: settings.surpriseMe && !topicPaths.some(({ path }) => slot.candidate?.topicPath?.join(" ").startsWith(path.join(" "))),
              createdAt: generatedAt,
              provenance: { provider: "gemini" as const, model: result.resolvedModel ?? result.model, generatedAt }
            };
            // Optional copy suggestions are sanitized independently; they can never invalidate a grounded card.
            card.followUpQuestions = createSavedFollowUpQuestions(fact.followUpQuestions, card);
            card.chronology = createSavedCardChronology(fact.chronology, card);
            card.locations = createSavedCardLocations(fact.locations, card);
            if (!await uniqueForPublication(card)) throw new GeminiFailure("This information has already been shown. Trying a fresh fact.");
            rememberValidatedEvidence(sessionId, slot);
            acceptedSlots.add(slot.index);
            acceptedCardBySlot.set(slot.index, card);
            cards.push(card);
            onProgress?.({ type: "card", slot: slot.index, slotId: slot.slotId, card });
          } catch (rawError) {
            if (signal?.aborted) throw abortError();
            const error = classifyFailure(rawError);
            markRetry(slot, error.message, round, !combined && !(rawError instanceof FactSpecificityError) && !/already been shown|repeats another|duplicate/i.test(error.message));
          }
        }
      } catch (rawError) {
        if (signal?.aborted) throw abortError();
        const error = classifyFailure(rawError);
        if (isCredentialFailure(error)) throw error;
        if (error.outcomes.length || /available Gemini models|every available Gemini model/i.test(error.message)) providerExhausted = true;
        for (const slot of group) markRetry(slot, error.message, round, round >= 0, false);
      }
    });
    if (providerExhausted) break;
  }

  const failedSlots = slots.filter(slot => !acceptedSlots.has(slot.index));
  if (!cards.length) {
    const failure = new GeminiFailure(failedSlots[0]?.lastError ?? "Gemini could not complete a Wikipedia-grounded batch.", undefined, outcomes, undefined, providerExhausted);
    failure.validationDiagnostics = diagnostics.snapshot();
    throw failure;
  }
  const partial = cards.length < targetCount;
  failedSlots.forEach(slot => onProgress?.({ type: "slot-error", slot: slot.index, error: slot.lastError ?? "This fact slot could not be completed." }));
  return { cards, slotMappings: slots.flatMap(slot => {
    const card = acceptedCardBySlot.get(slot.index);
    return slot.slotId && card ? [{ slotId: slot.slotId, cardId: card.id }] : [];
  }), validationDiagnostics: diagnostics.snapshot(), modelOutcomes: outcomes, requestedCount: targetCount, completedCount: cards.length, partial, failedJobs: failedSlots.length, retryable: partial, retryGuidance: partial ? `${cards.length} facts arrived. Retry to find supported facts for the remaining slots.` : undefined };
}

type GlossaryLearningResponse = { glossary: SavedCardGlossary; modelOutcomes: GeminiModelOutcome[] };
type AnswerLearningResponse = { answer: string; citations: WikipediaSource[]; modelOutcomes: GeminiModelOutcome[]; presentation?: AnswerPresentation; structure?: ResolvedAnswerStructure };
type GlossaryLearningRequest = { apiKey: string; sessionId?: string; action: "glossary"; card: FactCard; signal?: AbortSignal };
type AnswerLearningRequest = { apiKey: string; sessionId?: string; action: "learn" | "adapt" | "question"; card: FactCard; question?: string; detailed?: boolean; structure?: AnswerStructure; instructionPreference?: QuestionInstructionPreference; history?: LearningMessage[]; mode?: "simpler" | "deeper"; signal?: AbortSignal };

async function generateCardGlossary({ apiKey, sessionId = "default-session", card, signal }: GlossaryLearningRequest): Promise<GlossaryLearningResponse> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before explaining terms.", undefined, [], undefined, false);
  const resolved = await Promise.all(card.sources.slice(0, 3).map(async (source, sourceIndex) => {
    let extract = source.extract?.trim() ?? "";
    if (!extract) {
      extract = (card.evidence ?? []).filter(item => item.sourceIndex === sourceIndex)
        .map(item => `${item.section ? `[Section: ${item.section}]\n` : ""}${item.quote}`).join("\n\n");
    }
    if (!extract) {
      const article = await resolveWikipediaArticle(source.title, signal);
      extract = article?.extract?.trim() ?? "";
    }
    return extract ? { source: { title: source.title, url: source.canonicalUrl ?? source.url, canonicalUrl: source.canonicalUrl ?? source.url }, originalIndex: sourceIndex, extract } : undefined;
  }));
  const available = resolved.filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!available.length) throw new GeminiFailure("The cited Wikipedia passages could not be loaded to explain these terms.", undefined, [], undefined, true);
  const evidence = available.map((item, index) => ({ index, title: item.source.title, extract: item.extract.slice(0, 12_000) }));
  const prompt = buildLearningPrompt({ action: "glossary", card: { topicPath: card.topicPath, hook: card.hook, title: card.title, body: card.body, claim: card.claim }, evidence });
  const result = await requestStructured<{ entries?: Array<{ term?: unknown; definition?: unknown; citationIndexes?: unknown }> }>(apiKey, sessionId, prompt, {
    type: "OBJECT",
    properties: { entries: { type: "ARRAY", maxItems: 3, items: { type: "OBJECT", properties: { term: { type: "STRING" }, definition: { type: "STRING" }, citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["term", "definition", "citationIndexes"] } } },
    required: ["entries"]
  }, "learning", GENERATION_TIMEOUT_MS, signal, undefined, {
    maxOutputTokens: 1024,
    identity: { task: "glossary", topics: card.topicPath, filters: {}, context: { card: { hook: card.hook, title: card.title, body: card.body, claim: card.claim }, evidence, sourceUrls: available.map(item => item.source.canonicalUrl) } }
  });
  const sources = available.map(item => item.source);
  const entries: CardGlossaryEntry[] = (result.value.entries ?? []).slice(0, 12).flatMap(raw => {
    const term = typeof raw?.term === "string" ? raw.term.trim() : "";
    const definition = typeof raw?.definition === "string" ? raw.definition.trim() : "";
    const sourceIndexes = Array.isArray(raw?.citationIndexes) ? Array.from(new Set(raw.citationIndexes.filter((index): index is number => Number.isInteger(index) && Number(index) >= 0 && Number(index) < sources.length))).slice(0, 3) : [];
    return term && definition && sourceIndexes.length ? [{ term, definition, sourceIndexes }] : [];
  });
  const fingerprint = cardGlossaryFingerprint(card);
  const glossary = normalizeCardGlossary({ ...card, glossary: { entries, sources, fingerprint } });
  if (!glossary) throw new GeminiFailure("Gemini returned glossary terms that could not be checked against the card and its sources.", undefined, result.outcomes, undefined, true);
  return { glossary, modelOutcomes: result.outcomes };
}

export function generateLearningResponse(request: GlossaryLearningRequest): Promise<GlossaryLearningResponse>;
export function generateLearningResponse(request: AnswerLearningRequest): Promise<AnswerLearningResponse>;
export async function generateLearningResponse(request: GlossaryLearningRequest | AnswerLearningRequest): Promise<GlossaryLearningResponse | AnswerLearningResponse> {
  if (request.action === "glossary") return generateCardGlossary({ ...request, sessionId: request.sessionId ?? "default-session" });
  if (request.action === "question" && request.structure !== undefined && !isAnswerStructure(request.structure)) {
    throw new GeminiFailure("Choose a supported answer structure.", undefined, [], undefined, false);
  }
  if (request.action === "question" && request.instructionPreference !== undefined && !isQuestionInstructionPreference(request.instructionPreference)) {
    throw new GeminiFailure("Choose a supported instruction priority.", undefined, [], undefined, false);
  }
  const { apiKey, sessionId = "default-session", action, card, question, detailed, history, mode, signal } = request;
  const structure = request.action === "question" ? request.structure ?? "automatic" : "automatic";
  const instructionPreference = request.action === "question" ? request.instructionPreference ?? "written" : "written";
  const instructionResolution = request.action === "question"
    ? resolveQuestionInstructions(question ?? "", Boolean(detailed), structure, instructionPreference)
    : undefined;
  const effectiveQuestion = instructionResolution?.questionForPrompt ?? question;
  const effectiveStructure = instructionResolution?.effectiveStructure ?? structure;
  const effectiveDetailed = instructionResolution?.effectiveDetailed ?? Boolean(detailed);
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before asking for more detail.", undefined, [], undefined, false);
  const cachedOriginals = card.sources.filter(source => source.extract?.trim());
  const cachedTitles = new Set(cachedOriginals.map(source => source.title.toLocaleLowerCase()));
  const missingOriginalTitles = card.sources.filter(source => !cachedTitles.has(source.title.toLocaleLowerCase())).map(source => source.title);
  const [fetchedOriginals, questionSources] = await Promise.all([
    missingOriginalTitles.length ? resolveWikipediaSources(missingOriginalTitles, 3, signal, { includeImages: false }) : Promise.resolve([]),
    action === "question" && effectiveQuestion ? resolveWikipediaSources([effectiveQuestion], 2, signal, { includeImages: false }) : Promise.resolve([])
  ]);
  const originalSources = [
    ...cachedOriginals,
    ...fetchedOriginals.map(source => ({ ...source, extract: selectEvidence(source.extract ?? "", card.title + " " + card.body, 5) }))
  ];
  const originalUrls = new Set(originalSources.map((source) => source.canonicalUrl ?? source.url));
  const sources = Array.from(new Map([...originalSources, ...questionSources].map((source) => [source.canonicalUrl ?? source.url, source])).values()).slice(0, 5);
  if (!sources.length) throw new GeminiFailure("Wikipedia did not return the cited pages for this fact.", undefined, [], undefined, true);
  sources.forEach(source => {
    if (!originalUrls.has(source.canonicalUrl ?? source.url)) source.extract = selectEvidence(source.extract ?? "", effectiveQuestion?.trim() ? effectiveQuestion : card.title, 5);
  });
  const context = sources.map((source, index) => ({ index, kind: originalUrls.has(source.canonicalUrl ?? source.url) ? "original" : "supplemental", title: source.title, extract: source.extract ?? "No extract returned" }));
  const prompt = buildLearningPrompt({ action, mode, question, detailed, structure, instructionPreference, history,
    card: { topicPath: card.topicPath, hook: card.hook, title: card.title, body: card.body, claim: card.claim }, evidence: context
  });
  const questionSchema = { type: "OBJECT", properties: {
    directAnswer: { type: "STRING" },
    // Legacy answer is an optional salvage field; presentation metadata must
    // never make an otherwise readable answer fail structured decoding.
    answer: { type: "STRING" },
    resolvedStructure: { type: "STRING" },
    paragraphs: { type: "ARRAY", items: { type: "STRING" } },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    comparisonSubjects: { type: "ARRAY", items: { type: "STRING" } },
    comparisonRows: { type: "ARRAY", items: { type: "OBJECT", properties: { property: { type: "STRING" }, values: { type: "ARRAY", items: { type: "STRING" } } } } },
    fallbackReason: { type: "STRING" },
    citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } }
  }, required: ["citationIndexes"] };
  const ordinarySchema = { type: "OBJECT", properties: { answer: { type: "STRING" }, citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["answer", "citationIndexes"] };
  const result = await requestStructured<Record<string, unknown>>(apiKey, sessionId, prompt, action === "question" ? questionSchema : ordinarySchema, "learning", GENERATION_TIMEOUT_MS, signal, undefined, {
    maxOutputTokens: action === "question" ? effectiveStructure === "short-explanation" ? 2048 : effectiveDetailed ? 8192 : 4096 : action === "adapt" && mode === "simpler" ? 2048 : action === "adapt" ? 4096 : undefined,
    identity: {task: action === "question" ? "question" : action === "adapt" ? "adapt" : "learn", query: action === "question" ? question : undefined, topics: card.topicPath, filters: action === "question" ? {detailed: effectiveDetailed, structure: effectiveStructure, structurePolicy: ANSWER_STRUCTURE_POLICY_VERSION, instructionPolicy: QUESTION_INSTRUCTION_POLICY_VERSION, instructionPreference, directive: instructionResolution?.directive} : action === "adapt" ? {mode} : {}, context: {card: {hook: card.hook, title: card.title, body: card.body, claim: card.claim}, history: action === "question" ? history?.slice(-6) ?? [] : [], evidence: context, sourceUrls: sources.map(source => source.canonicalUrl ?? source.url)}}
  });
  const normalizedAnswer = action === "question" ? normalizeAnswerResponse(result.value, effectiveStructure) : undefined;
  const answer = normalizedAnswer?.answer ?? (typeof result.value.answer === "string" ? result.value.answer.trim() : "");
  if (!answer) throw new GeminiFailure("Gemini returned an empty explanation.", undefined, result.outcomes, undefined, true);
  const citationIndexes = Array.isArray(result.value.citationIndexes) ? result.value.citationIndexes : [];
  const indexes = Array.from(new Set(citationIndexes.filter((index): index is number => typeof index === "number" && Number.isInteger(index) && index >= 0 && index < sources.length))).slice(0, 3);
  if (action === "adapt" && indexes.length === 0) throw new GeminiFailure("Gemini could not support this alternate explanation with the card’s sources.", undefined, result.outcomes, undefined, true);
  if (action === "question" && !normalizedAnswer) throw new GeminiFailure("Gemini returned an answer that could not be safely presented.", undefined, result.outcomes, undefined, true);
  return { answer, citations: (indexes.length ? indexes : [0]).map((index) => sources[index]).filter(Boolean), modelOutcomes: result.outcomes, presentation: normalizedAnswer?.presentation, structure: normalizedAnswer?.structure };
}

export type { VideoSearchPlan } from "./video-semantic";
import { videoSearchReason, type VideoSearchPlan } from "./video-semantic";

export async function interpretVideoSearch({ apiKey, sessionId = "default-session", query, catalogVersion = "current", signal }: { apiKey: string; sessionId?: string; query: string; catalogVersion?: string | number; signal?: AbortSignal }): Promise<{ plan: VideoSearchPlan; modelOutcomes: GeminiModelOutcome[] }> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before using smart video search.", undefined, [], undefined, false);
  const prompt = buildSearchInterpretationPrompt("videoInterpret", query);
  const result = await requestStructured<Pick<VideoSearchPlan, "terms" | "include" | "alternatives" | "topics" | "conceptGroups">>(apiKey, sessionId, prompt, {
    type: "OBJECT",
    properties: {
      terms: { type: "ARRAY", items: { type: "STRING" } }, include: { type: "ARRAY", items: { type: "STRING" } }, alternatives: { type: "ARRAY", items: { type: "STRING" } }, topics: { type: "ARRAY", items: { type: "STRING" } }, conceptGroups: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: { label: { type: "STRING" }, terms: { type: "ARRAY", minItems: 1, maxItems: 12, items: { type: "STRING" } }, related: { type: "ARRAY", maxItems: 12, items: { type: "STRING" } }, required: { type: "BOOLEAN" } }, required: ["label", "terms", "related", "required"] } }
    },
    required: ["conceptGroups", "topics"]
  }, "learning", GENERATION_TIMEOUT_MS, signal, undefined, { priority: "background", models: PRIMARY_FLASH_LITE_MODELS, maxOutputTokens: 2048, cacheContext: "youtube-catalog:" + catalogVersion, identity: {task: "videoInterpret", query} });
  const plan: VideoSearchPlan = {
    terms: (result.value.terms ?? []).filter((term): term is string => typeof term === "string").map((term) => term.trim()).filter(Boolean).slice(0, 24),
    include: (result.value.include ?? []).filter((term): term is string => typeof term === "string").map((term) => term.trim()).filter(Boolean).slice(0, 24),
    alternatives: (result.value.alternatives ?? []).filter((term): term is string => typeof term === "string").map((term) => term.trim()).filter(Boolean).slice(0, 32),
    topics: (result.value.topics ?? []).filter((term): term is string => typeof term === "string").map((term) => term.trim()).filter(Boolean).slice(0, 12),
    conceptGroups: (result.value.conceptGroups ?? []).filter((group) => group && Array.isArray(group.terms)).slice(0, 8).map((group) => ({ ...group, label: typeof group.label === "string" ? group.label.trim().slice(0,100) : undefined, required: true, related: (Array.isArray(group.related) ? group.related : []).filter((term): term is string => typeof term === "string").map(term => term.trim().slice(0,100)).filter(Boolean).slice(0,12), terms: group.terms.filter((term): term is string => typeof term === "string").map((term) => term.trim().slice(0,100)).filter(Boolean).slice(0, 12) })).filter((group) => group.terms.length > 0)
  };
  return { plan, modelOutcomes: result.outcomes };
}

export async function interpretNaturalSearch({ apiKey, sessionId = "default-session", query, catalogVersion = "current", signal }: { apiKey: string; sessionId?: string; query: string; catalogVersion?: string | number; signal?: AbortSignal }): Promise<{ terms: string[]; plan: TopicQueryPlan; modelOutcomes: GeminiModelOutcome[] }> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before using natural-language search.", undefined, [], undefined, false);
  const prompt = buildSearchInterpretationPrompt("topicInterpret", query);
  const result = await requestStructured<TopicQueryPlan>(apiKey, sessionId, prompt, {
    type: "OBJECT", properties: { groups: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: { label: { type: "STRING" }, equivalents: { type: "ARRAY", minItems: 1, maxItems: 12, items: { type: "STRING" } }, related: { type: "ARRAY", maxItems: 12, items: { type: "STRING" } } }, required: ["label", "equivalents", "related"] } }, alternatives: { type: "BOOLEAN" } }, required: ["groups", "alternatives"]
  }, "learning", GENERATION_TIMEOUT_MS, signal, undefined, { priority: "background", models: PRIMARY_FLASH_LITE_MODELS, maxOutputTokens: 1024, cacheContext: "topic-catalog:" + catalogVersion, identity: {task: "topicInterpret", query} });
  const plan = validateTopicPlan(result.value);
  return { plan, terms: plan.groups.flatMap(group => group.equivalents).slice(0,12), modelOutcomes: result.outcomes };
}

export type RankedVideoSearchResult = {
  videoId: string;
  relevance: "direct" | "strong" | "broader";
  support: string[];
  explanation: string;
  localScore: number;
};

export async function rankVideoSearchCandidates({ apiKey, sessionId = "default-session", query, plan, candidates, catalogVersion = "current", signal }: { apiKey: string; sessionId?: string; query: string; plan: VideoSearchPlan; candidates: YouTubeSearchCandidate[]; catalogVersion?: string | number; signal?: AbortSignal }): Promise<{ results: RankedVideoSearchResult[]; modelOutcomes: GeminiModelOutcome[] }> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before using smart video search.", undefined, [], undefined, false);
  const boundedCandidates = candidates.slice(0, 40);
  if (!boundedCandidates.length) return { results: [], modelOutcomes: [] };
  const candidatePayload = boundedCandidates.map(({ video, supportingText, matchedFields }) => ({
    videoId: video.id,
    title: video.title,
    creator: video.channelName,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    topics: video.topics,
    tags: video.tags.slice(0, 8),
    descriptionExcerpt: searchableVideoDescription(video.description).slice(0, 520),
    locallyMatchedFields: matchedFields,
    localSupportingText: supportingText
  }));
  const prompt = buildPrompt("videoVerify", [], [{ label: "Query", value: query }, { label: "Plan", value: plan, reference: true }, { label: "Candidates", value: candidatePayload, reference: true }]);
  const result = await requestStructured<{ matches?: Array<{ videoId?: string; relevance?: string; support?: string[]; explanation?: string }> }>(apiKey, sessionId, prompt, {
    type: "OBJECT",
    properties: { matches: { type: "ARRAY", items: { type: "OBJECT", properties: { videoId: { type: "STRING" }, relevance: { type: "STRING", enum: ["direct", "strong"] }, support: { type: "ARRAY", items: { type: "STRING" } }, explanation: { type: "STRING" } }, required: ["videoId", "relevance", "support", "explanation"] } } },
    required: ["matches"]
  }, "learning", GENERATION_TIMEOUT_MS, signal, undefined, { priority: "background", models: PRIMARY_FLASH_LITE_MODELS, maxOutputTokens: 4096, cacheContext: "youtube-catalog:" + catalogVersion, identity: {task: "videoVerify", query, topics: plan.topics, filters: plan, context: candidatePayload} });
  const allowed = new Set(boundedCandidates.map(({ video }) => video.id));
  const candidateById = new Map(boundedCandidates.map((candidate) => [candidate.video.id, candidate]));
  const seen = new Set<string>();
  const results = (result.value.matches ?? []).flatMap((match) => {
    const videoId = match.videoId?.trim() ?? "";
    const relevance = match.relevance === "direct" || match.relevance === "strong" ? match.relevance : undefined;
    const candidate = candidateById.get(videoId);
    if (!allowed.has(videoId) || seen.has(videoId) || !candidate || !relevance) return [];
    const reason = videoSearchReason(candidate.video, plan, candidate.score, match.support ?? []);
    if (!reason.support.length) return [];
    seen.add(videoId);
    return [reason];
  });
  return { results, modelOutcomes: result.outcomes };
}

function searchableVideoDescription(value: string) {
  return value.replace(/(?:subscribe|like and subscribe|follow us|social media|patreon|sponsor(?:ed)? by|use code|affiliate|merch(?:andise)?|join the discord|business inquiries|check out my|support the channel)[^.!?]*(?:[.!?]|$)/gi, " ").replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim().slice(0, 2400);
}

async function checkOneModel(apiKey: string, model: string, signal?: AbortSignal): Promise<GeminiModelCheck> {
  const started = Date.now();
  try {
    const result = await requestModelText(apiKey, model, buildPrompt("connection"), { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] }, MODEL_CHECK_TIMEOUT_MS, 128, signal);
    const parsed = JSON.parse(result.text) as { ok?: boolean };
    if (parsed.ok !== true) throw new GeminiFailure("The model returned invalid structured test output.", undefined, [], undefined, true);
    return { model, status: "working", latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), ...(result.resolvedModel ? { resolvedModel: result.resolvedModel } : {}) };
  } catch (rawError) {
    const error = classifyFailure(rawError);
    const retryAt = error.retryable ? new Date(Date.now() + Math.max(MODEL_COOLDOWN_MS, error.retryAfterMs ?? 0)).toISOString() : undefined;
    return { model, status: error.retryable ? "cooldown" : "failed", statusCode: error.status, quotaScope: error.quotaScope, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), error: error.message, ...(retryAt ? { retryAt } : {}) };
  }
}

export async function testGeminiKey(apiKey: string, signal?: AbortSignal, sessionId = "default-session", onCheck?: (check: GeminiModelCheck, readyCount: number) => void) {
  if (!apiKey.trim()) return { ok: false as const, status: "not-configured" as const, models: ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" as const })), eligibleModelCount: ALLOWED_GEMINI_MODELS.length, requiredWorkingModels: REQUIRED_WORKING_MODELS };
  const pool = await poolFor(apiKey, sessionId);
  return withRequestQueue(pool, signal, async () => {
    if (pool.projectQuotaCooldownUntil > Date.now()) {
      const models = ALLOWED_GEMINI_MODELS.map((model) => pool.checks.get(model) ?? { model, status: "unchecked" as const });
      return { ok: false as const, status: "rate-limited" as const, models, eligibleModelCount: ALLOWED_GEMINI_MODELS.length, requiredWorkingModels: REQUIRED_WORKING_MODELS };
    }
    pool.projectQuotaCooldownUntil = 0;
    pool.models = [...ALLOWED_GEMINI_MODELS];
    pool.checks.clear();
    pool.cooldowns.clear();
    pool.transientFailureCounts.clear();
    pool.inFlight.clear();
    pool.inFlightResolved.clear();
    pool.ready = false;
    const checks: GeminiModelCheck[] = ALLOWED_GEMINI_MODELS.map((model) => ({ model, status: "unchecked" }));
    checks.forEach((check) => pool.checks.set(check.model, check));
    let readyCount = 0;
    for (const model of ALLOWED_GEMINI_MODELS.slice(0, 2)) {
      if (signal?.aborted) throw abortError();
      const check = await checkOneModel(apiKey, model, signal);
      const index = checks.findIndex((item) => item.model === model);
      checks[index] = check;
      pool.checks.set(check.model, check);
      if (check.status === "cooldown" && check.retryAt) pool.cooldowns.set(check.model, Date.parse(check.retryAt));
      if (check.statusCode === 429 && check.quotaScope !== "model") pool.projectQuotaCooldownUntil = Date.now() + Math.max(MODEL_COOLDOWN_MS, check.retryAt ? Date.parse(check.retryAt) - Date.now() : 0);
      readyCount = new Set(checks.filter((item) => item.status === "working").map((item) => item.resolvedModel ?? item.model)).size;
      onCheck?.(check, readyCount);
      if (check.statusCode === 401 || check.statusCode === 403 || (check.error && /401|403|API key|permission|unauthorized|forbidden/i.test(check.error))) break;
      if (check.statusCode === 429 && check.quotaScope !== "model") break;
      if (check.status === "failed" && check.statusCode !== 404) break;
    }
    if (signal?.aborted) throw abortError();
    const working = checks.filter((check) => check.status === "working");
    const distinctWorking = new Set(working.map((check) => check.resolvedModel ?? check.model));
    const primaryChecks = checks.slice(0, 2).filter((check) => check.status !== "unchecked");
    const invalid = primaryChecks.some((check) => check.statusCode === 401 || check.statusCode === 403 || Boolean(check.error && /401|403|API key|permission|unauthorized|forbidden/i.test(check.error)));
    const status: GeminiStatus = distinctWorking.size >= REQUIRED_WORKING_MODELS ? "connected" : invalid ? "invalid" : primaryChecks.some((check) => check.status === "cooldown") ? "rate-limited" : "unavailable";
    pool.ready = distinctWorking.size >= REQUIRED_WORKING_MODELS;
    return { ok: pool.ready, status, models: checks, eligibleModelCount: ALLOWED_GEMINI_MODELS.length, requiredWorkingModels: REQUIRED_WORKING_MODELS };
  });
}
