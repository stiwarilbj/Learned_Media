import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const oldTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { ALLOWED_GEMINI_MODELS, expandTopicSearch, generateGeminiFacts, interpretNaturalSearch, interpretVideoSearch, testGeminiKey } = require("../lib/gemini.ts");
const { SessionCache } = require("../lib/session-cache.ts");
const { shouldExpandNaturalSearch } = require("../lib/search.ts");
const { searchYouTubeCandidates, strongLocalVideoCandidates } = require("../lib/youtube.ts");
const originalFetch = globalThis.fetch;
const words = ["amber", "birch", "cobalt", "delta", "ember", "fossil", "granite", "harbor", "indigo", "juniper", "kelp"];
const factBundles = [
  { title: "Larkspur Meteorograph", hook: "A Brass Diaphragm Caught Winter Pressure", claim: "The amber meteorograph at Larkspur recorded a sharp pressure drop during winter calibration.", sentences: ["At the Larkspur observatory, the amber meteorograph registered a sudden pressure drop during a winter calibration.", "Technicians compared its brass diaphragm with three sealed glass standards before accepting the measurement.", "The unusual reading stayed in a logbook used to check later barometer repairs."] },
  { title: "Tern Island Telegraph Cells", hook: "Birch Cells Stabilized Telegraph Signals", claim: "Birch separators in Tern Island telegraph cells prevented salt crystals from bridging their plates.", sentences: ["On Tern Island, thin birch separators kept salt crystals from bridging the telegraph battery plates.", "The station fitted each wooden strip between copper sheets exposed to damp ocean air.", "Operators recorded fewer broken signals after replacing their older cotton insulation."] },
  { title: "Cobalt Kiln Pigment", hook: "A Blue Kiln Glaze Revealed Heat", claim: "Cobalt pigment on kiln tiles changed color at the temperature used to fire a local ceramic glaze.", sentences: ["A cobalt wash on the kiln tiles turned violet when the ceramic chamber reached its firing temperature.", "Potters placed the small test squares beside bowls rather than trusting the furnace dial.", "The color change let them compare heat across separate shelves after each firing."] },
  { title: "Delta Flood Bell", hook: "A Bronze Bell Marked River Surges", claim: "The delta flood bell rang when rising water lifted its enclosed cork float past a metal pin.", sentences: ["At the delta sluice, rising water lifted a cork float inside the flood bell housing.", "Once the float passed a brass pin, a chain struck the bell above the embankment.", "Night crews could hear the warning from fields beyond the locked gate."] },
  { title: "Ember Archive Ink", hook: "Soot Ink Preserved Ember Ledger Entries", claim: "Ember soot mixed with walnut oil made archive ink resistant to damp storage rooms.", sentences: ["An ember-black ink recipe mixed chimney soot with walnut oil for the archive ledgers.", "Clerks brushed the mixture onto paper only after filtering out coarse ash grains.", "The darker writing remained readable in the cellar where ordinary iron ink blurred."] },
  { title: "Fossil Track Compass", hook: "Fossil Tracks Set The Compass", claim: "Fossilized tracks on the plateau helped surveyors align a compass traverse around a magnetic ridge.", sentences: ["Surveyors followed fossilized track marks across the plateau to bypass a magnetic ridge.", "They checked each compass bearing again after crossing the iron-rich outcrop.", "The detour kept the map line aligned with the valley markers below."] },
  { title: "Granite Listening Posts", hook: "Granite Walls Carried Distant Knocks", claim: "Granite walls in the mountain listening posts carried coded maintenance knocks between chambers.", sentences: ["Inside the granite listening post, a hammer tap traveled through the north wall into a sealed chamber.", "Workers used three measured knocks to signal that the ventilation shaft was clear.", "The stone carried the vibration farther than the station's short copper speaking tube."] },
  { title: "Harbor Tide Ledger", hook: "Harbor Clerks Corrected Moon Tables", claim: "Harbor clerks added a local correction to moon tables after recording delayed spring tides.", sentences: ["Harbor clerks penciled a seven-minute correction beside the moon table after spring tides arrived late.", "Their notes compared the pier gauge with a clock kept inside the customs office.", "The amendment was copied into pilot books used by boats entering the narrow channel."] },
  { title: "Indigo Dye Thermometer", hook: "Indigo Cloth Signaled Cooling Dye", claim: "Indigo dyers used a cloth strip as a cooling indicator before lifting fabric from the vat.", sentences: ["An indigo dyer dipped a narrow cloth strip to judge when the vat had cooled enough.", "The test strip showed a green surface before its exposed fibers turned blue.", "Workers waited for that color shift before raising a full length of woven linen."] },
  { title: "Juniper Signal Kite", hook: "Juniper Frames Kept Signal Kites", claim: "Juniper frames kept a coastal signal kite taut in gusts that bent its usual bamboo spars.", sentences: ["Coastal signal crews replaced bamboo spars with juniper when crosswinds twisted the kite frame.", "They lashed each stiff branch to the canvas with tarred linen cord.", "The repaired kite held its coded shape above the headland during stronger gusts."] },
  { title: "Kelp Drying Gauge", hook: "Kelp Strips Measured Salt Drying", claim: "Kelp strips hanging beside the salt pans showed when workers could rake the crystallized surface.", sentences: ["Beside the kelp-lined salt pans, workers watched hanging strips curl as the brine dried.", "They raked the crystals only after the lowest strip stiffened in the afternoon wind.", "That simple gauge reduced the amount of wet salt carried into storage baskets."] }
];
let testNumber = 0;

function sentenceSet(word) {
  return factBundles[words.indexOf(word)].sentences;
}

function factBundle(word) {
  return factBundles[words.indexOf(word)];
}

function sectionName(word) {
  return word[0].toUpperCase() + word.slice(1) + " record";
}

function articleExtract() {
  return words.map(word => `==${sectionName(word)}==\n${sentenceSet(word).join(" ")}`).join("\n\n");
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function candidateAssignments(prompt) {
  const match = prompt.match(/Assignments: (\[[^\n]+\])/);
  return match ? JSON.parse(match[1]) : [];
}

function groundingSlots(prompt) {
  const marker = "Slots and source assignments (untrusted data):\n";
  const start = prompt.indexOf(marker);
  if (start < 0) return [];
  const serialized = prompt.slice(start + marker.length).split("\n", 1)[0];
  const payload = JSON.parse(serialized);
  const sources = new Map((payload.sources || []).map(source => [source.index, source]));
  return (payload.facts || []).map(value => ({
    ...value,
    evidence: (value.sourceIndexes || []).map(index => sources.get(index)).filter(Boolean)
  }));
}

function installNetworkMock(options = {}) {
  const state = { requests: [], candidatePrompts: [], groundingPrompts: [], omittedSlots: new Set(), requestFailures: options.requestFailures || {}, requestFailureMessages: options.requestFailureMessages || {}, connectionFailures: options.connectionFailures || {}, connectionFailureMessages: options.connectionFailureMessages || {} };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const body = init.body ? JSON.parse(String(init.body)) : {};
    state.requests.push({ url, body });
    if (url.hostname === "generativelanguage.googleapis.com") {
      const model = decodeURIComponent(url.pathname.split("/models/")[1].split(":")[0]);
      const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
      const connectionCheck = prompt.includes('"ok":true');
      const failure = connectionCheck ? state.connectionFailures[model] : state.requestFailures[model];
      if (failure) return jsonResponse({ error: { message: connectionCheck ? state.connectionFailureMessages[model] ?? `Mock Gemini failure for ${model}` : state.requestFailureMessages[model] ?? `Mock Gemini failure for ${model}` } }, Number(failure));
      if (options.delayMs && !prompt.includes('"ok":true')) await new Promise(resolve => setTimeout(resolve, options.delayMs));
      let output;
      if (prompt.includes('"ok":true')) {
        output = { ok: true };
      } else if (prompt.includes("Expand this unresolved natural-language query")) {
        output = { terms: ["stellar evolution", "supernova"] };
      } else if (prompt.includes("Interpret this natural-language video search")) {
        output = { terms: ["black holes"], include: [], alternatives: ["gravitational lensing"], exclude: [], topics: ["Science"], sort: "relevance" };
      } else if (prompt.includes("Check these approved videos against the plan")) {
        output = { matches: [] };
      } else if (prompt.includes("Generate exactly one candidate for every supplied slot")) {
        state.candidatePrompts.push(prompt);
        const attempt = Number(prompt.match(/Attempt: (\d+)/)?.[1] ?? 1);
        output = { facts: candidateAssignments(prompt).map(assignment => {
          let word = words[assignment.slot];
          if (options.duplicateSlot === 5 && assignment.slot === 5 && attempt === 1) word = words[0];
          if (options.duplicateSlot === 5 && assignment.slot === 0 && attempt > 1) word = words[10];
          return { slot: assignment.slot, title: "Shared Article", claim: factBundle(word).claim, topicPath: assignment.topicPath, wikipediaSearchTitles: ["Shared Article"] };
        }).reverse() };
      } else if (prompt.includes("Return one grounded fact for each slot")) {
        state.groundingPrompts.push(prompt);
        const values = groundingSlots(prompt);
        output = { facts: values.map(value => {
          const slot = value.slot;
          const claim = value.candidate.claim;
          const normalizedClaim = claim.toLowerCase();
          const word = words.find(candidate => normalizedClaim.startsWith(`${candidate} `) || normalizedClaim.includes(` ${candidate} `)) ?? words[slot];
          if (options.omitSlotOnce === slot && !state.omittedSlots.has(slot)) {
            state.omittedSlots.add(slot);
            return null;
          }
          const sentences = sentenceSet(word);
          const quotes = options.invalidSlot === slot ? sentences.map((quote, index) => index === 0 ? "This quotation does not occur in the supplied Wikipedia passage." : quote) : sentences;
          return {
            slot,
            title: factBundle(word).title,
            hook: factBundle(word).hook,
            claim,
            sentences,
            evidence: quotes.map((quote, sentence) => ({ sentence, sourceIndex: value.sourceIndexes[0] ?? 0, quote, section: sectionName(word) }))
          };
        }).filter(Boolean).reverse() };
      } else {
        throw new Error(`Unexpected Gemini prompt: ${prompt.slice(0, 90)}`);
      }
      return jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }], modelVersion: model });
    }
    if (url.hostname === "en.wikipedia.org" && url.pathname === "/w/api.php") {
      const action = url.searchParams.get("action");
      const title = url.searchParams.get("titles") ?? "";
      if (action === "query" && title.startsWith("File:")) {
        return jsonResponse({ query: { pages: { "-1": { imageinfo: [{ url: "https://upload.wikimedia.org/shared.jpg", thumburl: "https://upload.wikimedia.org/shared-thumb.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Shared.jpg", extmetadata: { Artist: { value: "Test Artist" } } }] } } } });
      }
      if (action === "query") {
        return jsonResponse({ query: { pages: { "42": { title: "Shared Article", fullurl: "https://en.wikipedia.org/wiki/Shared_Article", extract: articleExtract(), pageimage: "Shared.jpg", thumbnail: { source: "https://upload.wikimedia.org/shared-thumb.jpg" }, original: { source: "https://upload.wikimedia.org/shared.jpg" } } } } });
      }
    }
    throw new Error(`Unexpected request: ${url.toString()}`);
  };
  return state;
}

async function connectMock(state) {
  const sessionId = `request-efficiency-${++testNumber}`;
  const result = await testGeminiKey("test-key", undefined, sessionId);
  assert.equal(result.status, "connected");
  const checks = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com");
  assert.equal(checks.length, 2, "connection should check only the two primary models");
  assert.deepEqual(checks.map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0])), ALLOWED_GEMINI_MODELS.slice(0, 2));
  assert.ok(checks.every(request => request.url.pathname.includes(":generateContent")), "connection must not call model discovery");
  assert.deepEqual(result.models.map(model => model.model), ALLOWED_GEMINI_MODELS, "Settings should list every model in policy order");
  assert.ok(result.models.slice(0, 2).every(model => model.status !== "unchecked"), "both primary models should receive a check");
  assert.ok(result.models.slice(2).every(model => model.status === "unchecked"), "fallback models should remain unchecked until needed");
  state.requests.length = 0;
  return sessionId;
}

function generationArgs(sessionId, options = {}) {
  return {
    apiKey: "test-key",
    sessionId,
    topicPaths: Array.from({ length: 10 }, (_, index) => ({ path: ["Science", `${words[index]} topic`], weight: 1 })),
    settings: { obscurity: 5, displayMode: "picture-text", sentenceLength: 3, surpriseMe: false },
    learningProfile: {},
    avoid: [],
    requestedCount: options.requestedCount ?? 10,
    ...options.args
  };
}

function geminiCallCount(state) {
  return state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").length;
}

function geminiCalls(state) {
  return state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").map(request => ({
    model: decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]),
    prompt: request.body.contents?.[0]?.parts?.[0]?.text ?? ""
  }));
}

function assertNoModelRepeatsWithinLogicalRequest(state) {
  const byPrompt = new Map();
  for (const call of geminiCalls(state)) {
    const attempted = byPrompt.get(call.prompt) ?? [];
    attempted.push(call.model);
    byPrompt.set(call.prompt, attempted);
  }
  for (const attempted of byPrompt.values()) assert.equal(new Set(attempted).size, attempted.length, "a logical prompt must not retry the same model twice");
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("generation request efficiency", async t => {
await t.test("session caches are bounded, expire, and avoid repeating weak local-search calls", async () => {
  const cache = new SessionCache(2, 1000);
  cache.set("first", 1, 100);
  cache.set("second", 2, 100);
  assert.equal(cache.get("first", 200), 1);
  cache.set("third", 3, 200);
  assert.equal(cache.get("second", 200), undefined, "least-recently-used entry should be evicted at capacity");
  assert.equal(cache.get("first", 1200), undefined, "expired results should not be reused");
  assert.equal(shouldExpandNaturalSearch("how did early navigation instruments shape trade routes", 8), false, "enough meaningful local topics should suppress Gemini expansion");
  assert.equal(shouldExpandNaturalSearch("how did early navigation instruments shape trade routes", 0), true, "unresolved natural-language searches may request one expansion");

  const videos = [
    { id: "direct", channelId: "c1", channelName: "Science", title: "How Black Holes Bend Light", description: "A measured example of gravitational lensing.", tags: ["black holes", "light"], topics: ["Science"], publishedAt: "2024-01-01", durationSeconds: 600, durationLabel: "10:00", approved: true, embedAvailable: true },
    { id: "generic", channelId: "c1", channelName: "Science", title: "Science Facts", description: "A general overview.", tags: ["science"], topics: ["Science"], publishedAt: "2024-01-01", durationSeconds: 600, durationLabel: "10:00", approved: true, embedAvailable: true }
  ];
  const candidates = searchYouTubeCandidates(videos, { terms: ["black holes bend light"] }, "All", undefined, 80);
  assert.deepEqual(strongLocalVideoCandidates("black holes bend light", candidates).map(candidate => candidate.video.id), ["direct"], "only concept-complete metadata matches count as strong local results");
});

await t.test("video searches preserve channel, exclusion, date, duration, approval, topic, and Shorts filters", async () => {
  const makeVideo = (id, overrides = {}) => ({
    id,
    channelId: "c1",
    channelName: "Science",
    title: "Black Holes and Gravity",
    description: "A measured explanation of gravitational physics.",
    tags: ["black holes", "gravity"],
    topics: ["Science"],
    publishedAt: "2024-01-01",
    durationSeconds: 600,
    durationLabel: "10:00",
    approved: true,
    embedAvailable: true,
    ...overrides
  });
  const videos = [
    makeVideo("match"),
    makeVideo("wrong-channel", { channelId: "c2" }),
    makeVideo("excluded", { description: "Black holes and gravity, with a spoiler." }),
    makeVideo("too-old", { publishedAt: "2020-01-01" }),
    makeVideo("too-short", { durationSeconds: 120 }),
    makeVideo("too-long", { durationSeconds: 1300 }),
    makeVideo("unapproved", { approved: false }),
    makeVideo("shorts", { title: "Black Holes #Shorts" }),
    makeVideo("wrong-topic", { topics: ["Culture"] })
  ];
  const plan = {
    terms: ["black holes"],
    channelId: "c1",
    exclude: ["spoiler"],
    topics: ["Science"],
    minDate: "2022-01-01",
    minDurationSeconds: 300,
    maxDurationSeconds: 1200
  };
  assert.deepEqual(searchYouTubeCandidates(videos, plan).map(candidate => candidate.video.id), ["match"]);
  assert.deepEqual(searchYouTubeCandidates(videos, { ...plan, dateIntent: "event" }).map(candidate => candidate.video.id), ["match", "too-old"], "historical subject dates must not filter upload dates");
});

await t.test("successful search interpretations coalesce and invalidate by catalog and credential", async () => {
  const state = installNetworkMock();
  const sessionId = await connectMock(state);
  const topicArgs = { apiKey: "test-key", sessionId, query: "why do some stars explode at the end of their life", catalogVersion: 1 };
  const [first, duplicate] = await Promise.all([interpretNaturalSearch(topicArgs), interpretNaturalSearch(topicArgs)]);
  assert.deepEqual(first.terms, ["stellar evolution", "supernova"]);
  assert.deepEqual(duplicate.terms, first.terms);
  const topicCalls = () => geminiCalls(state).filter(call => call.prompt.includes("Expand this unresolved natural-language query"));
  assert.equal(topicCalls().length, 1, "identical pending interpretations should share one Gemini request");
  await interpretNaturalSearch(topicArgs);
  assert.equal(topicCalls().length, 1, "successful responses should be cached for the session");
  await interpretNaturalSearch({ ...topicArgs, catalogVersion: 2 });
  assert.equal(topicCalls().length, 2, "a catalog version change should invalidate cached interpretation");

  const videoArgs = { apiKey: "test-key", sessionId, query: "videos about black holes", catalogVersion: 4 };
  await interpretVideoSearch(videoArgs);
  await interpretVideoSearch(videoArgs);
  const videoCalls = () => geminiCalls(state).filter(call => call.prompt.includes("Interpret this natural-language video search"));
  assert.equal(videoCalls().length, 1, "identical video plans should be cached");
  await interpretVideoSearch({ ...videoArgs, catalogVersion: 5 });
  assert.equal(videoCalls().length, 2, "a video catalog change should invalidate cached plans");

  const otherKeyCheck = await testGeminiKey("another-key", undefined, sessionId);
  assert.equal(otherKeyCheck.status, "connected");
  await interpretNaturalSearch({ ...topicArgs, apiKey: "another-key", catalogVersion: 2 });
  assert.equal(topicCalls().length, 3, "cached results must not cross credential scopes");
});

await t.test("connection checks two primary models in order and succeeds when only the secondary works", async () => {
  const state = installNetworkMock({ connectionFailures: { [ALLOWED_GEMINI_MODELS[0]]: 404 } });
  const result = await testGeminiKey("test-key", undefined, `model-fallback-${++testNumber}`);
  assert.equal(result.status, "connected");
  const checks = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com");
  assert.equal(checks.length, 2);
  assert.deepEqual(checks.map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0])), ALLOWED_GEMINI_MODELS.slice(0, 2));
  assert.equal(result.models.filter(model => model.status === "working").length, 1);
  assert.equal(result.models.filter(model => model.status === "unchecked").length, ALLOWED_GEMINI_MODELS.length - 2);
});

await t.test("connection stops after one invalid-credential response", async () => {
  const state = installNetworkMock({ connectionFailures: { [ALLOWED_GEMINI_MODELS[0]]: 403 } });
  const result = await testGeminiKey("test-key", undefined, `invalid-connect-${++testNumber}`);
  assert.equal(result.status, "invalid");
  assert.equal(geminiCallCount(state), 1);
  assert.equal(result.models[0].status, "failed");
  assert.equal(result.models[1].status, "unchecked");
});

await t.test("connection stops after a deterministic request error", async () => {
  const state = installNetworkMock({ connectionFailures: { [ALLOWED_GEMINI_MODELS[0]]: 400 } });
  const result = await testGeminiKey("test-key", undefined, `deterministic-connect-${++testNumber}`);
  assert.equal(result.status, "unavailable");
  assert.equal(geminiCallCount(state), 1);
  assert.equal(result.models[0].status, "failed");
  assert.equal(result.models[1].status, "unchecked");
});

await t.test("connection stops on a project-wide quota and respects its retry window", async () => {
  const state = installNetworkMock({ connectionFailures: { [ALLOWED_GEMINI_MODELS[0]]: 429 }, connectionFailureMessages: { [ALLOWED_GEMINI_MODELS[0]]: "Daily project quota exceeded." } });
  const sessionId = `project-quota-connect-${++testNumber}`;
  const first = await testGeminiKey("test-key", undefined, sessionId);
  assert.equal(first.status, "rate-limited");
  assert.equal(geminiCallCount(state), 1, "a project quota should stop the second primary probe");
  const second = await testGeminiKey("test-key", undefined, sessionId);
  assert.equal(second.status, "rate-limited");
  assert.equal(geminiCallCount(state), 1, "rechecking during Retry-After should not make another request");
});

await t.test("default seven-card generation uses one candidate and one grounding call", async () => {
  const state = installNetworkMock();
  const sessionId = await connectMock(state);
  const args = generationArgs(sessionId);
  delete args.requestedCount;
  const result = await generateGeminiFacts(args);
  assert.equal(result.completedCount, 7);
  assert.equal(geminiCallCount(state), 2);
  assert.deepEqual(state.candidatePrompts.map(prompt => candidateAssignments(prompt).length), [7]);
  assert.deepEqual(state.groundingPrompts.map(prompt => groundingSlots(prompt).length), [7]);
  assert.deepEqual(geminiCalls(state).map(call => call.model), [ALLOWED_GEMINI_MODELS[0], ALLOWED_GEMINI_MODELS[0]]);
  assertNoModelRepeatsWithinLogicalRequest(state);
});

await t.test("serialized requests use a healthy primary and fall back only after its failure", async () => {
  const primaryState = installNetworkMock({ delayMs: 5 });
  const primarySession = await connectMock(primaryState);
  const primaryResult = await generateGeminiFacts({ ...generationArgs(primarySession), requestedCount: 1 });
  assert.equal(primaryResult.completedCount, 1);
  assert.deepEqual(geminiCalls(primaryState).map(call => call.model), [ALLOWED_GEMINI_MODELS[0], ALLOWED_GEMINI_MODELS[0]]);

  const fallbackState = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 503 } });
  const fallbackSession = await connectMock(fallbackState);
  const fallbackResult = await generateGeminiFacts({ ...generationArgs(fallbackSession), requestedCount: 1 });
  assert.equal(fallbackResult.completedCount, 1);
  assert.deepEqual(geminiCalls(fallbackState).map(call => call.model), [ALLOWED_GEMINI_MODELS[0], ALLOWED_GEMINI_MODELS[1], ALLOWED_GEMINI_MODELS[1]]);
  assertNoModelRepeatsWithinLogicalRequest(fallbackState);
});

await t.test("concurrent callers share one serialized primary model", async () => {
  const busyState = installNetworkMock({ delayMs: 5 });
  const busySession = await connectMock(busyState);
  const busyResult = await generateGeminiFacts({ ...generationArgs(busySession), requestedCount: 10 });
  assert.equal(busyResult.completedCount, 10);
  assert.deepEqual(new Set(geminiCalls(busyState).map(call => call.model)), new Set([ALLOWED_GEMINI_MODELS[0]]), "the queue prevents concurrent calls from causing model rotation");

  const cooldownState = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 429 }, requestFailureMessages: { [ALLOWED_GEMINI_MODELS[0]]: "Per-model requests per minute quota exceeded." } });
  const cooldownSession = await connectMock(cooldownState);
  const cooldownResult = await generateGeminiFacts({ ...generationArgs(cooldownSession), requestedCount: 1 });
  assert.equal(cooldownResult.completedCount, 1);
  const cooldownModels = geminiCalls(cooldownState).map(call => call.model);
  assert.deepEqual(cooldownModels, [ALLOWED_GEMINI_MODELS[0], ALLOWED_GEMINI_MODELS[1], ALLOWED_GEMINI_MODELS[1]]);
  assertNoModelRepeatsWithinLogicalRequest(cooldownState);
});

await t.test("project-wide quota stops fallback and suppresses follow-up calls", async () => {
  const state = installNetworkMock();
  const sessionId = await connectMock(state);
  state.requestFailures[ALLOWED_GEMINI_MODELS[0]] = 429;
  state.requestFailureMessages[ALLOWED_GEMINI_MODELS[0]] = "Project-wide requests per day quota exceeded.";
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 }), /project-wide quota/i);
  assert.deepEqual(geminiCalls(state).map(call => call.model), [ALLOWED_GEMINI_MODELS[0]], "project quota should not fall through to another model");
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 }), /cooling down/i);
  assert.equal(geminiCallCount(state), 1, "subsequent work should wait for the shared retry time without calling Gemini");
});

await t.test("checked models remain available as generation fallbacks", async () => {
  const state = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 404, [ALLOWED_GEMINI_MODELS[1]]: 404, [ALLOWED_GEMINI_MODELS[2]]: 404 } });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 });
  assert.equal(result.completedCount, 1);
  const models = geminiCalls(state).map(call => call.model);
  assert.ok(models.includes(ALLOWED_GEMINI_MODELS[3]), "the first checked fallback model should be used after earlier models fail");
  assert.ok(!models.includes(ALLOWED_GEMINI_MODELS[4]), "models below the first successful fallback should not be tried");
  assertNoModelRepeatsWithinLogicalRequest(state);
});

await t.test("an invalid key stops model fallback", async () => {
  const state = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 401 } });
  const sessionId = await connectMock(state);
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 }), /Mock Gemini failure/);
  const generationModels = geminiCalls(state).map(call => call.model);
  assert.deepEqual(generationModels, [ALLOWED_GEMINI_MODELS[0]], "an invalid key must not probe lower-priority models");
});

await t.test("a deterministic request error stops without fallback", async () => {
  const state = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 400 } });
  const sessionId = await connectMock(state);
  const statuses = [];
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1, onProgress: event => { if (event.type === "status") statuses.push(event.status); } }), /Mock Gemini failure/);
  assert.deepEqual(geminiCalls(state).map(call => call.model), [ALLOWED_GEMINI_MODELS[0]]);
  assert.equal(statuses.at(-1), "unavailable");
});

await t.test("exhausting all models updates status and tries each model only once", async () => {
  const requestFailures = Object.fromEntries(ALLOWED_GEMINI_MODELS.map(model => [model, 503]));
  const state = installNetworkMock({ requestFailures });
  const sessionId = await connectMock(state);
  const statuses = [];
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1, onProgress: event => { if (event.type === "status") statuses.push(event.status); } }), /Every available Gemini model failed/);
  assert.deepEqual(geminiCalls(state).map(call => call.model), ALLOWED_GEMINI_MODELS);
  assertNoModelRepeatsWithinLogicalRequest(state);
  assert.equal(statuses.at(-1), "rate-limited");
});

await t.test("ten three-sentence cards use one candidate and one grounding call, preserving slot mapping and citations", async () => {
  const state = installNetworkMock({ delayMs: 5 });
  const sessionId = await connectMock(state);
  const streamed = [];
  const errors = [];
  const result = await generateGeminiFacts({ ...generationArgs(sessionId), onProgress: event => { if (event.type === "card") streamed.push(event.card); if (event.type === "slot-error") errors.push({ slot: event.slot, error: event.error }); } });
  assert.deepEqual(errors, []);
  assert.equal(geminiCallCount(state), 2);
  const generationModels = geminiCalls(state).map(call => call.model);
  assert.deepEqual(generationModels, [ALLOWED_GEMINI_MODELS[0], ALLOWED_GEMINI_MODELS[0]]);
  assert.deepEqual(state.candidatePrompts.map(prompt => candidateAssignments(prompt).length), [10]);
  assert.deepEqual(state.groundingPrompts.map(prompt => groundingSlots(prompt).length), [10]);
  assert.equal(result.completedCount, 10);
  assert.equal(streamed.length, 10);
  assert.deepEqual(new Set(result.cards.map(card => card.topicPath[1])), new Set(generationArgs(sessionId).topicPaths.map(topic => topic.path[1])));
  for (const card of result.cards) {
    assert.equal(card.evidence?.length, 3);
    assert.ok(card.evidence?.every(item => card.sources[item.sourceIndex].extract?.includes(item.quote)));
  }
  assert.ok(state.requests.filter(request => request.url.hostname === "en.wikipedia.org" && request.url.searchParams.get("titles") === "Shared Article").length <= 1, "the repeated article title should be fetched at most once per generation batch and may come from the session cache");
  assert.ok(state.requests.filter(request => request.url.searchParams.get("titles") === "File:Shared.jpg").length <= 1, "the repeated image should be attributed at most once and may come from the session cache");
});

await t.test("a missing grounded slot retries only grounding and returns all cards", async () => {
  const state = installNetworkMock({ omitSlotOnce: 7 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.completedCount, 10);
  assert.equal(geminiCallCount(state), 3);
  assert.equal(state.candidatePrompts.length, 1, "retry must reuse the failed slot's candidate");
  assert.equal(state.groundingPrompts.length, 2, "retry should request a new grounded result only for the missing slot");
});

await t.test("duplicate content is rejected and only that slot is regenerated", async () => {
  const state = installNetworkMock({ duplicateSlot: 5 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.completedCount, 10);
  assert.equal(new Set(result.cards.map(card => `${card.title}:${card.body}`)).size, 10);
  assert.equal(geminiCallCount(state), 4, "one duplicate slot should add one candidate and one grounding call");
  assert.equal(state.candidatePrompts.length, 2);
  assert.equal(state.groundingPrompts.length, 2);
});

await t.test("unsupported quotations fail local validation and leave only that slot partial", async () => {
  const state = installNetworkMock({ invalidSlot: 9 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.partial, true);
  assert.equal(result.completedCount, 9);
  assert.equal(result.failedJobs, 1);
  assert.equal(geminiCallCount(state), 5, "the invalid citation reuses its candidate once, then retries the unfinished slot");
  assert.equal(state.candidatePrompts.length, 2, "only the persistently invalid slot should receive a replacement candidate");
  assert.ok(result.cards.every(card => card.evidence?.every(item => card.sources[item.sourceIndex].extract?.includes(item.quote))));
});

await t.test("an already-cancelled batch performs no provider or Wikipedia requests", async () => {
  const state = installNetworkMock();
  const sessionId = await connectMock(state);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), signal: controller.signal }), /canceled/i);
  assert.equal(state.requests.length, 0);
});
});
