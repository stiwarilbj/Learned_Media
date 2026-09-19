import type { FactCard, FeedSettings, GeminiModelCheck, GeminiModelOutcome, LearningMessage, WikipediaSource } from "./types";
import type { LearningProfile } from "./types";
import { DIFFICULTY_LABELS, getTopicLearningProfile, normalizeDifficulty } from "./recommendations";
import { resolveWikipediaSources, type ResolvedWikipediaSource } from "./wikipedia";

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const MODEL_CHECK_TIMEOUT_MS = 20_000;
const GENERATION_TIMEOUT_MS = 45_000;
const MAX_STAGE_ATTEMPTS = 3;
const MODEL_COOLDOWN_MS = 45_000;

type CandidateFact = {
  title?: string;
  hook?: string;
  fact?: string;
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
  cursor: number;
};

type ModelListResponse = {
  models?: DiscoveredModel[];
  nextPageToken?: string;
};

type GeminiTextResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export type GeminiGenerationResult = {
  cards: FactCard[];
  modelOutcomes: GeminiModelOutcome[];
  partial: boolean;
  failedJobs: number;
  retryable: boolean;
  retryGuidance?: string;
};

class GeminiFailure extends Error {
  status?: number;
  outcomes: GeminiModelOutcome[];

  constructor(message: string, status?: number, outcomes: GeminiModelOutcome[] = []) {
    super(message);
    this.name = "GeminiFailure";
    this.status = status;
    this.outcomes = outcomes;
  }
}

const pools = new Map<string, ModelPool>();

function keyFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function poolFor(apiKey: string) {
  const fingerprint = keyFingerprint(apiKey);
  const existing = pools.get(fingerprint);
  if (existing) return existing;
  const created: ModelPool = { models: [], checks: new Map(), cooldowns: new Map(), cursor: 0 };
  pools.set(fingerprint, created);
  return created;
}

function stripJsonFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function errorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: { message?: string; status?: string } }).error;
  return error?.message || error?.status || "";
}

function classifyFailure(error: unknown) {
  if (error instanceof GeminiFailure) return error;
  const message = error instanceof Error ? error.message : "Gemini request failed";
  if (/timed out|timeout/i.test(message)) return new GeminiFailure("Gemini request timed out.");
  if (/JSON|usable answer|structured/i.test(message)) return new GeminiFailure("Gemini returned malformed structured output.");
  return new GeminiFailure(message);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    if (externalSignal?.aborted) throw new GeminiFailure("Gemini request canceled.");
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (externalSignal?.aborted) throw new GeminiFailure("Gemini request canceled.");
    if (controller.signal.aborted) throw new GeminiFailure(`Gemini request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    throw classifyFailure(error);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

function modelId(model: DiscoveredModel) {
  return (model.baseModelId || model.name || "").replace(/^models\//, "").trim();
}

function isEligibleModel(model: DiscoveredModel) {
  const id = modelId(model).toLowerCase();
  const methods = model.supportedGenerationMethods ?? [];
  if (!id || !methods.includes("generateContent")) return false;
  return !/(image|imagen|video|veo|audio|embedding|embed|live|realtime|speech|tts|lyria|robotics)/i.test(id);
}

function modelRank(model: string) {
  const value = model.toLowerCase();
  if (value.includes("flash")) return value.includes("lite") ? 1 : 0;
  if (value.includes("pro")) return 2;
  return 3;
}

function sortModels(models: string[]) {
  return Array.from(new Set(models)).sort((left, right) => modelRank(left) - modelRank(right) || right.localeCompare(left));
}

async function discoverModels(apiKey: string, signal?: AbortSignal) {
  const found: DiscoveredModel[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`${GEMINI_API_ROOT}/models`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetchWithTimeout(url, { headers: { accept: "application/json", "x-goog-api-key": apiKey } }, MODEL_CHECK_TIMEOUT_MS, signal);
    const raw = await response.text();
    let payload: ModelListResponse | { error?: { message?: string; status?: string } } = {};
    try { payload = JSON.parse(raw) as ModelListResponse; } catch { throw new GeminiFailure("Google returned malformed model discovery data.", response.status); }
    if (!response.ok) throw new GeminiFailure(errorDetail(payload) || `Google model discovery returned HTTP ${response.status}.`, response.status);
    found.push(...((payload as ModelListResponse).models ?? []));
    pageToken = (payload as ModelListResponse).nextPageToken ?? "";
    if (!pageToken) break;
  }
  const eligible = sortModels(found.filter(isEligibleModel).map(modelId));
  if (!eligible.length) throw new GeminiFailure("Google returned no eligible Gemini text models for this key.");
  return { models: eligible, metadata: found.filter(isEligibleModel) };
}

async function refreshPool(apiKey: string, signal?: AbortSignal) {
  const pool = poolFor(apiKey);
  const discovered = await discoverModels(apiKey, signal);
  pool.models = discovered.models;
  for (const model of pool.models) {
    if (!pool.checks.has(model)) pool.checks.set(model, { model, status: "checking" });
  }
  return { pool, metadata: discovered.metadata };
}

async function requestModelText(apiKey: string, model: string, prompt: string, responseSchema: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal) {
  const endpoint = `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, responseMimeType: "application/json", responseSchema }
    })
  }, timeoutMs, signal);
  const raw = await response.text();
  let payload: unknown = {};
  try { payload = JSON.parse(raw); } catch { throw new GeminiFailure("Gemini returned malformed JSON.", response.status); }
  if (!response.ok) throw new GeminiFailure(errorDetail(payload) || `Gemini returned HTTP ${response.status}.`, response.status);
  const text = (payload as GeminiTextResponse).candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new GeminiFailure("Gemini returned no usable structured answer.");
  return stripJsonFence(text);
}

function availableModels(pool: ModelPool) {
  const now = Date.now();
  const healthy = pool.models.filter((model) => pool.checks.get(model)?.status === "working" && (pool.cooldowns.get(model) ?? 0) <= now);
  const untested = pool.models.filter((model) => !healthy.includes(model) && (pool.cooldowns.get(model) ?? 0) <= now && pool.checks.get(model)?.status !== "failed");
  return [...healthy, ...untested];
}

function markModelFailure(pool: ModelPool, model: string, error: GeminiFailure) {
  if (error.status === 429 || error.status === 503) pool.cooldowns.set(model, Date.now() + MODEL_COOLDOWN_MS);
  pool.checks.set(model, { model, status: error.status === 429 || error.status === 503 ? "cooldown" : "failed", checkedAt: new Date().toISOString(), error: error.message });
}

async function requestStructured<T>(apiKey: string, prompt: string, responseSchema: Record<string, unknown>, stage: GeminiModelOutcome["stage"], timeoutMs = GENERATION_TIMEOUT_MS, signal?: AbortSignal) {
  const pool = poolFor(apiKey);
  if (!pool.models.length) await refreshPool(apiKey, signal);
  const available = availableModels(pool);
  if (!available.length) throw new GeminiFailure("Every eligible Gemini model is cooling down. Try again shortly.");
  const start = pool.cursor % available.length;
  pool.cursor = (pool.cursor + 1) % Math.max(pool.models.length, 1);
  const candidates = available.slice(start).concat(available.slice(0, start)).slice(0, MAX_STAGE_ATTEMPTS);
  const outcomes: GeminiModelOutcome[] = [];
  let lastError: GeminiFailure | undefined;
  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    const started = Date.now();
    try {
      const text = await requestModelText(apiKey, model, prompt, responseSchema, timeoutMs, signal);
      const value = JSON.parse(text) as T;
      if (!value || typeof value !== "object") throw new GeminiFailure("Gemini returned malformed structured output.");
      const latencyMs = Date.now() - started;
      pool.checks.set(model, { model, status: "working", latencyMs, checkedAt: new Date().toISOString() });
      outcomes.push({ model, stage, status: "success", latencyMs });
      return { value, model, outcomes };
    } catch (rawError) {
      if (signal?.aborted) throw new GeminiFailure("Gemini request canceled.", undefined, outcomes);
      const error = classifyFailure(rawError);
      const latencyMs = Date.now() - started;
      markModelFailure(pool, model, error);
      outcomes.push({ model, stage, status: error.status === 429 || error.status === 503 ? "cooldown" : "failed", latencyMs, error: error.message });
      lastError = new GeminiFailure(error.message, error.status, outcomes);
      if (error.status === 401 || error.status === 403) break;
    }
  }
  throw lastError ?? new GeminiFailure("Gemini did not return a usable result.", undefined, outcomes);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const result: R[] = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      result[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return result;
}

export function describeGeminiError(error: unknown) {
  const failure = classifyFailure(error);
  if (failure.status === 401 || failure.status === 403 || /API key|permission|unauthorized|forbidden/i.test(failure.message)) return "Gemini rejected this API key. Check that it is active in Google AI Studio, then paste it again.";
  if (failure.status === 429 || /quota|rate.?limit|resource exhausted/i.test(failure.message)) return "Gemini is rate-limited or out of quota. Wait for the quota window to recover, then retry.";
  if (failure.status === 404 || /no eligible|unavailable model|not found/i.test(failure.message)) return "Google did not make an eligible text model available for this key. Reconnect and check all models again.";
  if (/timed out|timeout/i.test(failure.message)) return "Gemini timed out. Retry the batch; another healthy model may be available.";
  if (/Wikipedia/i.test(failure.message)) return failure.message;
  if (/malformed|structured/i.test(failure.message)) return "Gemini returned an invalid structured response. Retry to use another model.";
  return "Gemini could not generate this batch. Check the key in Settings and try again.";
}

function hookWithoutPeriods(value: string) {
  const clean = value.replace(/[.!?]+/g, "").replace(/\s+/g, " ").trim();
  return clean.split(" ").slice(0, 12).join(" ");
}

function cardSources(source: ResolvedWikipediaSource[]) {
  return source.map(({ image: _image, ...source }) => source);
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
  return { type: "OBJECT", properties: { facts: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, hook: { type: "STRING" }, fact: { type: "STRING" }, topicPath: { type: "ARRAY", items: { type: "STRING" } }, wikipediaSearchTitles: { type: "ARRAY", items: { type: "STRING" } }, difficulty: { type: "INTEGER" } }, required: ["title", "hook", "topicPath", "wikipediaSearchTitles", "difficulty"] } } }, required: ["facts"] };
}

function groundedSchema() {
  return { type: "OBJECT", properties: { facts: { type: "ARRAY", items: { type: "OBJECT", properties: { candidateIndex: { type: "INTEGER" }, title: { type: "STRING" }, hook: { type: "STRING" }, body: { type: "STRING" }, sourceIndexes: { type: "ARRAY", items: { type: "INTEGER" } }, difficulty: { type: "INTEGER" } }, required: ["candidateIndex", "title", "hook", "body", "sourceIndexes", "difficulty"] } } }, required: ["facts"] };
}

function candidatePrompt(topicPaths: Array<{ path: string[]; weight: number }>, settings: FeedSettings, learningProfile: LearningProfile, avoid: string[], rabbitHole: string | null | undefined, jobIndex: number) {
  const variation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${jobIndex}`;
  const topicText = topicPaths.length ? topicPaths.map(({ path, weight }) => `${path.join(" → ")} (relative weight ${weight})`).join("\n") : "a broad surprise topic";
  const targetText = topicPaths.length ? topicPaths.map(({ path }) => {
    const profile = getTopicLearningProfile(learningProfile, path, normalizeDifficulty(settings.obscurity));
    return `${path.join(" → ")}: target difficulty ${profile.targetDifficulty}/10 (${DIFFICULTY_LABELS[profile.targetDifficulty]}; ${profile.heard} heard, ${profile.unknown} unknown)`;
  }).join("\n") : `Default target difficulty: ${settings.obscurity}/10`;
  return `You generate one half of a ten-card knowledge batch for Learned Media. Create exactly 5 genuinely obscure, interesting, understandable facts. The learner wants facts they are unlikely to have heard before, not famous trivia, common sense, textbook definitions, broad introductory facts, or beginner examples. Prefer specific historical details, forgotten events, unusual inventions, counterintuitive science, hidden technical details, and specific geography. Avoid myths, clickbait, unsupported claims, vague generalizations, and repeated ideas.

For every candidate, suggest one to three exact English Wikipedia article titles that can support the claim. The application will verify every page. Include the complete topicPath from the supplied topics. Write a 4 to 12 word hook with no period, exclamation mark, or question mark.

Difficulty is standardized from 1 to 10: 1 common starting point, 2 familiar, 3 easy curiosity, 4 less-common curiosity, 5 unusual, 6 challenging, 7 deep cut, 8 rare, 9 esoteric, 10 genuinely obscure or specialist. Match the targets below.

Topics and relative weights:
${topicText}

Learning targets:
${targetText}

Baseline difficulty: ${settings.obscurity}/10
Desired sentence length: ${settings.sentenceLength}
Surprise Me: ${settings.surpriseMe ? "enabled" : "disabled"}
Rabbit hole thread: ${rabbitHole ?? "none"}
Batch variation: ${variation}. Randomize candidate order and do not begin with the first obvious examples that come to mind.

Do not repeat or closely paraphrase these recent cards:
${avoid.slice(-12).join("\n") || "none"}

Return structured JSON only with a facts array.`;
}

async function generateJob(apiKey: string, topicPaths: Array<{ path: string[]; weight: number }>, settings: FeedSettings, learningProfile: LearningProfile, avoid: string[], rabbitHole: string | null | undefined, jobIndex: number, signal?: AbortSignal) {
  const outcomes: GeminiModelOutcome[] = [];
  const candidateResult = await requestStructured<{ facts?: CandidateFact[] }>(apiKey, candidatePrompt(topicPaths, settings, learningProfile, avoid, rabbitHole, jobIndex), candidateSchema(), "candidate", GENERATION_TIMEOUT_MS, signal);
  outcomes.push(...candidateResult.outcomes);
  const candidates = (candidateResult.value.facts ?? []).slice(0, 5).filter((candidate) => candidate.title?.trim() && candidate.topicPath?.length);
  if (!candidates.length) throw new GeminiFailure("Gemini returned no complete fact candidates.", undefined, outcomes);

  const bundles = await mapWithConcurrency(candidates, 4, async (candidate) => ({ candidate, sources: await resolveWikipediaSources(candidate.wikipediaSearchTitles?.slice(0, 3) ?? [candidate.title ?? ""], 3, signal) }));
  const usableBundles = bundles.filter((bundle) => bundle.sources.length > 0);
  if (!usableBundles.length) throw new GeminiFailure("Wikipedia did not return supporting articles for this job.", undefined, outcomes);

  const evidence = usableBundles.map(({ candidate, sources }, index) => ({ candidateIndex: index, candidateTitle: candidate.title, candidateTopicPath: candidate.topicPath, sources: sources.map((source, sourceIndex) => ({ index: sourceIndex, title: source.title, url: source.url, extract: source.extract?.slice(0, 900) ?? "" })) }));
  const groundedPrompt = `Turn these candidate ideas into up to 5 final Learned Media cards using only the supplied Wikipedia evidence. Every claim in body must be supported by cited excerpts. Choose one to three sourceIndexes from the matching candidate, using one when sufficient. Write a 4 to 12 word hook with no punctuation at the end. Write a useful body in two or three sentences with normal punctuation. Preserve a standardized difficulty from 1 to 10. Do not invent citations, use another candidate's sources, or return incomplete cards.

Evidence:
${JSON.stringify(evidence)}

Return structured JSON only with a facts array.`;
  const groundedResult = await requestStructured<{ facts?: GroundedFact[] }>(apiKey, groundedPrompt, groundedSchema(), "grounding", GENERATION_TIMEOUT_MS, signal);
  outcomes.push(...groundedResult.outcomes);
  const cards = (groundedResult.value.facts ?? []).slice(0, 5).flatMap((fact, index) => {
    const candidateIndex = fact.candidateIndex ?? index;
    const bundle = usableBundles[candidateIndex];
    if (!bundle || !fact.title?.trim() || !fact.body?.trim() || !fact.hook?.trim()) return [];
    const chosenIndexes = Array.from(new Set((fact.sourceIndexes ?? []).filter((sourceIndex) => sourceIndex >= 0 && sourceIndex < bundle.sources.length))).slice(0, 3);
    const chosenSources = (chosenIndexes.length ? chosenIndexes.map((sourceIndex) => bundle.sources[sourceIndex]) : bundle.sources.slice(0, 1)).filter(Boolean);
    if (!chosenSources.length) return [];
    const imageSource = chosenSources.find((source) => source.image) ?? bundle.sources.find((source) => source.image);
    const candidate = bundle.candidate;
    const difficulty = normalizeDifficulty(fact.difficulty ?? candidate.difficulty, normalizeDifficulty(settings.obscurity));
    const generatedAt = new Date().toISOString();
    return [{ id: `gemini-${Date.now()}-${jobIndex}-${index}-${Math.random().toString(36).slice(2, 7)}`, hook: hookWithoutPeriods(fact.hook), title: fact.title.trim(), body: fact.body.trim(), topicPath: candidate.topicPath!.filter(Boolean), sources: cardSources(chosenSources), image: imageSource?.image, difficulty, obscurity: difficulty, accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5] as FactCard["accent"], surprise: settings.surpriseMe && !topicPaths.some(({ path }) => candidate.topicPath?.join(" ").startsWith(path.join(" "))), createdAt: generatedAt, provenance: { provider: "gemini" as const, model: groundedResult.model, generatedAt } } satisfies FactCard];
  });
  if (!cards.length) throw new GeminiFailure("Gemini returned no complete cards grounded in Wikipedia.", undefined, outcomes);
  return { cards, outcomes };
}

export async function generateGeminiFacts({ apiKey, topicPaths, settings, learningProfile, avoid, rabbitHole, signal }: { apiKey: string; topicPaths: Array<{ path: string[]; weight: number }>; settings: FeedSettings; learningProfile: LearningProfile; avoid: string[]; rabbitHole?: string | null; signal?: AbortSignal }): Promise<GeminiGenerationResult> {
  if (!apiKey.trim()) throw new GeminiFailure("Paste your Gemini API key in Settings to generate a fresh batch.");
  if (!topicPaths.length) throw new GeminiFailure("Choose at least one topic before generating a batch.");
  const started = Date.now();
  const batchController = new AbortController();
  const abortParent = () => batchController.abort();
  signal?.addEventListener("abort", abortParent, { once: true });
  let deadlineReached = false;
  const deadlineTimer = setTimeout(() => { deadlineReached = true; batchController.abort(); }, 180_000);
  const jobs = await Promise.allSettled([0, 1].map((jobIndex) => generateJob(apiKey, topicPaths, settings, learningProfile, avoid, rabbitHole, jobIndex, batchController.signal)));
  const cleanup = () => { clearTimeout(deadlineTimer); signal?.removeEventListener("abort", abortParent); };
  if (signal?.aborted) { cleanup(); throw new GeminiFailure("Gemini batch canceled."); }
  if (deadlineReached || Date.now() - started > 180_000) { cleanup(); throw new GeminiFailure("The three-minute batch deadline was reached. Retry the batch when you are ready."); }
  const cards = jobs.flatMap((job) => job.status === "fulfilled" ? job.value.cards : []).filter((card, index, list) => list.findIndex((candidate) => candidate.title.toLowerCase() === card.title.toLowerCase()) === index).slice(0, 10);
  const modelOutcomes = jobs.flatMap((job) => {
    if (job.status === "fulfilled") return job.value.outcomes;
    return job.reason instanceof GeminiFailure ? job.reason.outcomes : [];
  });
  const failedJobs = jobs.filter((job) => job.status === "rejected").length;
  if (!cards.length) {
    const rejected = jobs.find((job) => job.status === "rejected");
    const failure = rejected && rejected.status === "rejected" && rejected.reason instanceof GeminiFailure ? rejected.reason : undefined;
    cleanup();
    throw new GeminiFailure(failure?.message ?? "Gemini could not complete a Wikipedia-grounded batch.", failure?.status, modelOutcomes);
  }
  const retryable = failedJobs > 0 || cards.length < 10;
  cleanup();
  return { cards: shuffle(cards), modelOutcomes, partial: retryable, failedJobs, retryable, retryGuidance: retryable ? "Some work failed. Retry to fill the remaining cards." : undefined };
}

export async function generateLearningResponse({ apiKey, action, card, question, detailed, history, signal }: { apiKey: string; action: "learn" | "question"; card: FactCard; question?: string; detailed?: boolean; history?: LearningMessage[]; signal?: AbortSignal }): Promise<{ answer: string; citations: WikipediaSource[]; modelOutcomes: GeminiModelOutcome[] }> {
  if (!apiKey.trim()) throw new GeminiFailure("Add your Gemini API key in Settings before asking for more detail.");
  const [originalSources, questionSources] = await Promise.all([resolveWikipediaSources(card.sources.map((source) => source.title), 3, signal), action === "question" && question ? resolveWikipediaSources([question], 2, signal) : Promise.resolve([])]);
  const sources = Array.from(new Map([...originalSources, ...questionSources].map((source) => [source.url, source])).values()).slice(0, 3);
  if (!sources.length) throw new GeminiFailure("Wikipedia did not return the cited pages for this fact.");
  const context = sources.map((source, index) => `${index}. ${source.title}\nURL: ${source.url}\nExcerpt: ${source.extract ?? "No extract returned"}`).join("\n\n");
  const prompt = action === "learn" ? `Explain this fact in one useful paragraph of approximately 100 to 160 words. Use only the Wikipedia evidence below, add context rather than repeating the card body, and return citationIndexes for supporting sources.\n\nCard title: ${card.title}\nCard body: ${card.body}\n\nWikipedia evidence:\n${context}` : `Answer the user's question about this fact using only the Wikipedia evidence below. Normally answer in 2 to 4 sentences. If detailed is true, answer in approximately 150 to 250 words. If the evidence cannot answer the question, say so plainly and explain what the sources do establish. Return citationIndexes for supporting sources.\n\nFact: ${card.title}\nCard body: ${card.body}\nUser question: ${question ?? ""}\nMore Details: ${detailed ? "true" : "false"}\nConversation so far: ${JSON.stringify(history?.slice(-6) ?? [])}\n\nWikipedia evidence:\n${context}`;
  const result = await requestStructured<{ answer?: string; citationIndexes?: number[] }>(apiKey, prompt, { type: "OBJECT", properties: { answer: { type: "STRING" }, citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["answer", "citationIndexes"] }, "learning", GENERATION_TIMEOUT_MS, signal);
  if (!result.value.answer?.trim()) throw new GeminiFailure("Gemini returned an empty explanation.", undefined, result.outcomes);
  const indexes = Array.from(new Set((result.value.citationIndexes ?? []).filter((index) => index >= 0 && index < sources.length))).slice(0, 3);
  return { answer: result.value.answer.trim(), citations: (indexes.length ? indexes : [0]).map((index) => sources[index]).filter(Boolean).map(({ image: _image, ...source }) => source), modelOutcomes: result.outcomes };
}

async function checkOneModel(apiKey: string, model: string, signal?: AbortSignal): Promise<GeminiModelCheck> {
  const started = Date.now();
  try {
    const text = await requestModelText(apiKey, model, "Return exactly the JSON object {\"ok\":true} and nothing else.", { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] }, MODEL_CHECK_TIMEOUT_MS, signal);
    const parsed = JSON.parse(text) as { ok?: boolean };
    if (parsed.ok !== true) throw new GeminiFailure("The model returned invalid structured test output.");
    return { model, status: "working", latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
  } catch (rawError) {
    const error = classifyFailure(rawError);
    return { model, status: error.status === 429 || error.status === 503 ? "cooldown" : "failed", latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), error: error.message };
  }
}

export async function testGeminiKey(apiKey: string, signal?: AbortSignal) {
  if (!apiKey.trim()) return { ok: false as const, status: "not-configured" as const, models: [] as GeminiModelCheck[], eligibleModelCount: 0 };
  const { pool } = await refreshPool(apiKey, signal);
  const checks = await mapWithConcurrency(pool.models, 3, async (model) => checkOneModel(apiKey, model, signal));
  checks.forEach((check) => pool.checks.set(check.model, check));
  const working = checks.filter((check) => check.status === "working");
  const firstFailure = checks.find((check) => check.status !== "working");
  const status = working.length ? "connected" : firstFailure?.error && /401|403|key|permission/i.test(firstFailure.error) ? "invalid" : firstFailure?.status === "cooldown" ? "rate-limited" : "unavailable";
  return { ok: working.length > 0, status, models: checks, eligibleModelCount: pool.models.length };
}
