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

const { ALLOWED_GEMINI_MODELS, generateGeminiFacts, testGeminiKey } = require("../lib/gemini.ts");
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
  const marker = "Slots and evidence (untrusted source data):\n";
  const start = prompt.indexOf(marker);
  if (start < 0) return [];
  const serialized = prompt.slice(start + marker.length).split("\n", 1)[0];
  return JSON.parse(serialized);
}

function installNetworkMock(options = {}) {
  const state = { requests: [], candidatePrompts: [], groundingPrompts: [], omittedSlots: new Set() };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    const body = init.body ? JSON.parse(String(init.body)) : {};
    state.requests.push({ url, body });
    if (url.hostname === "generativelanguage.googleapis.com") {
      const model = decodeURIComponent(url.pathname.split("/models/")[1].split(":")[0]);
      const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
      const failure = prompt.includes('"ok":true') ? options.connectionFailures?.[model] : options.requestFailures?.[model];
      if (failure) return jsonResponse({ error: { message: `Mock Gemini failure for ${model}` } }, Number(failure));
      if (options.delayMs && !prompt.includes('"ok":true')) await new Promise(resolve => setTimeout(resolve, options.delayMs));
      let output;
      if (prompt.includes('"ok":true')) {
        output = { ok: true };
      } else if (prompt.includes("Generate exactly one candidate for every supplied slot")) {
        state.candidatePrompts.push(prompt);
        const attempt = Number(prompt.match(/Attempt: (\d+)/)?.[1] ?? 1);
        output = { facts: candidateAssignments(prompt).map(assignment => {
          let word = words[assignment.slot];
          if (options.duplicateSlot === 5 && assignment.slot === 5 && attempt === 1) word = words[0];
          if (options.duplicateSlot === 5 && assignment.slot === 0 && attempt > 1) word = words[10];
          return { slot: assignment.slot, title: "Shared Article", claim: factBundle(word).claim, topicPath: assignment.topicPath, wikipediaSearchTitles: ["Shared Article"] };
        }).reverse() };
      } else if (prompt.includes("Return one grounded fact per supplied slot")) {
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
            evidence: quotes.map((quote, sentence) => ({ sentence, sourceIndex: 0, quote, section: sectionName(word) }))
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
  assert.equal(checks.length, ALLOWED_GEMINI_MODELS.length, "connection should check every allowed model");
  assert.deepEqual(checks.map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0])), ALLOWED_GEMINI_MODELS);
  assert.ok(checks.every(request => request.url.pathname.includes(":generateContent")), "connection must not call model discovery");
  assert.deepEqual(result.models.map(model => model.model), ALLOWED_GEMINI_MODELS, "Settings should list every model in policy order");
  assert.ok(result.models.every(model => model.status !== "unchecked"), "every allowed model should receive a check");
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

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("generation request efficiency", async t => {
await t.test("connection checks every allowed model even after enough models pass", async () => {
  const state = installNetworkMock({ connectionFailures: { [ALLOWED_GEMINI_MODELS[0]]: 404 } });
  const result = await testGeminiKey("test-key", undefined, `model-fallback-${++testNumber}`);
  assert.equal(result.status, "connected");
  const checks = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com");
  assert.equal(checks.length, ALLOWED_GEMINI_MODELS.length);
  assert.deepEqual(checks.map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0])), ALLOWED_GEMINI_MODELS);
  assert.equal(result.models.filter(model => model.status === "working").length, ALLOWED_GEMINI_MODELS.length - 1);
  assert.equal(result.models.filter(model => model.status === "unchecked").length, 0);
});

await t.test("busy and cooldown models fall back from the top of the policy", async () => {
  const busyState = installNetworkMock({ delayMs: 5 });
  const busySession = await connectMock(busyState);
  const busyResult = await generateGeminiFacts({ ...generationArgs(busySession), requestedCount: 10 });
  assert.equal(busyResult.completedCount, 10);
  const busyModels = Array.from(new Set(busyState.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").slice(0, 2).map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]))));
  assert.deepEqual(busyModels, ALLOWED_GEMINI_MODELS.slice(0, 2), "a concurrent request skips the model already handling the first request");

  const cooldownState = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 429 } });
  const cooldownSession = await connectMock(cooldownState);
  const cooldownResult = await generateGeminiFacts({ ...generationArgs(cooldownSession), requestedCount: 1 });
  assert.equal(cooldownResult.completedCount, 1);
  const cooldownModels = cooldownState.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]));
  assert.ok(cooldownModels.includes(ALLOWED_GEMINI_MODELS[1]), "the next model should handle a request while the first is cooling down");
  assert.ok(!cooldownModels.includes(ALLOWED_GEMINI_MODELS[0]) || cooldownModels.filter(model => model === ALLOWED_GEMINI_MODELS[0]).length === 1, "the cooling model is not retried during its cooldown");
});

await t.test("checked models remain available as generation fallbacks", async () => {
  const state = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 404, [ALLOWED_GEMINI_MODELS[1]]: 404, [ALLOWED_GEMINI_MODELS[2]]: 404 } });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 });
  assert.equal(result.completedCount, 1);
  const models = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]));
  assert.ok(models.includes(ALLOWED_GEMINI_MODELS[3]), "the first checked fallback model should be used after earlier models fail");
});

await t.test("an invalid key stops model fallback", async () => {
  const state = installNetworkMock({ requestFailures: { [ALLOWED_GEMINI_MODELS[0]]: 401 } });
  const sessionId = await connectMock(state);
  await assert.rejects(generateGeminiFacts({ ...generationArgs(sessionId), requestedCount: 1 }), /Mock Gemini failure/);
  const generationModels = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]));
  assert.deepEqual(generationModels, [ALLOWED_GEMINI_MODELS[0]], "an invalid key must not probe lower-priority models");
});

await t.test("ten three-sentence cards use two candidate and two grounding calls, preserving slot mapping and citations", async () => {
  const state = installNetworkMock({ delayMs: 5 });
  const sessionId = await connectMock(state);
  const streamed = [];
  const errors = [];
  const result = await generateGeminiFacts({ ...generationArgs(sessionId), onProgress: event => { if (event.type === "card") streamed.push(event.card); if (event.type === "slot-error") errors.push({ slot: event.slot, error: event.error }); } });
  assert.deepEqual(errors, []);
  assert.equal(geminiCallCount(state), 4);
  const generationModels = state.requests.filter(request => request.url.hostname === "generativelanguage.googleapis.com").map(request => decodeURIComponent(request.url.pathname.split("/models/")[1].split(":")[0]));
  assert.deepEqual(new Set(generationModels.slice(0, 2)), new Set(ALLOWED_GEMINI_MODELS.slice(0, 2)));
  assert.deepEqual(state.candidatePrompts.map(prompt => candidateAssignments(prompt).length), [5, 5]);
  assert.deepEqual(state.groundingPrompts.map(prompt => groundingSlots(prompt).length), [5, 5]);
  assert.equal(result.completedCount, 10);
  assert.equal(streamed.length, 10);
  assert.deepEqual(new Set(result.cards.map(card => card.topicPath[1])), new Set(generationArgs(sessionId).topicPaths.map(topic => topic.path[1])));
  for (const card of result.cards) {
    assert.equal(card.evidence?.length, 3);
    assert.ok(card.evidence?.every(item => card.sources[item.sourceIndex].extract?.includes(item.quote)));
  }
  assert.equal(state.requests.filter(request => request.url.hostname === "en.wikipedia.org" && request.url.searchParams.get("titles") === "Shared Article").length, 1, "the repeated article title should be fetched once per generation batch");
  assert.equal(state.requests.filter(request => request.url.searchParams.get("titles") === "File:Shared.jpg").length, 1, "the repeated image should be attributed once per batch");
});

await t.test("a missing grounded slot retries only grounding and returns all cards", async () => {
  const state = installNetworkMock({ omitSlotOnce: 7 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.completedCount, 10);
  assert.equal(geminiCallCount(state), 5);
  assert.equal(state.candidatePrompts.length, 2, "retry must reuse the failed slot's candidate");
  assert.equal(state.groundingPrompts.length, 3, "retry should request a new grounded result only for the missing slot");
});

await t.test("duplicate content is rejected and only that slot is regenerated", async () => {
  const state = installNetworkMock({ duplicateSlot: 5 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.completedCount, 10);
  assert.equal(new Set(result.cards.map(card => `${card.title}:${card.body}`)).size, 10);
  assert.equal(geminiCallCount(state), 6, "one duplicate slot should add one candidate and one grounding call");
  assert.equal(state.candidatePrompts.length, 3);
  assert.equal(state.groundingPrompts.length, 3);
});

await t.test("unsupported quotations fail local validation and leave only that slot partial", async () => {
  const state = installNetworkMock({ invalidSlot: 9 });
  const sessionId = await connectMock(state);
  const result = await generateGeminiFacts(generationArgs(sessionId));
  assert.equal(result.partial, true);
  assert.equal(result.completedCount, 9);
  assert.equal(result.failedJobs, 1);
  assert.equal(geminiCallCount(state), 7, "one invalid citation should be retried for three total draft attempts, without running AI review");
  assert.equal(state.candidatePrompts.length, 3, "only the persistently invalid slot should receive a replacement candidate");
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
