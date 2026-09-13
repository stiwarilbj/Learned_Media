import type { FactCard, FeedSettings, LearningMessage, WikipediaSource } from "./types";
import { resolveWikipediaSources, type ResolvedWikipediaSource } from "./wikipedia";

const DEFAULT_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-flash"
];

type CandidateFact = {
  title?: string;
  hook?: string;
  fact?: string;
  topicPath?: string[];
  wikipediaSearchTitles?: string[];
  obscurityScore?: number;
};

type GroundedFact = {
  candidateIndex?: number;
  title?: string;
  hook?: string;
  body?: string;
  sourceIndexes?: number[];
  obscurityScore?: number;
};

function models() {
  return (process.env.GEMINI_TEXT_MODELS ?? DEFAULT_MODELS.join(",")).split(",").map((model) => model.trim()).filter(Boolean);
}

function stripJsonFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function requestStructured<T>(apiKey: string, prompt: string, responseSchema: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (const model of models()) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, responseMimeType: "application/json", responseSchema }
        })
      });
      if (!response.ok) throw new Error(`Gemini model ${model} returned ${response.status}`);
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      return JSON.parse(stripJsonFence(text)) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini did not return usable JSON");
}

function hookWithoutPeriods(value: string) {
  const clean = value.replace(/[.!?]+/g, "").replace(/\s+/g, " ").trim();
  return clean.split(" ").slice(0, 12).join(" ") || "A small fact worth keeping";
}

function cardSources(source: ResolvedWikipediaSource[]) {
  return source.map(({ image: _image, ...source }) => source);
}

function candidateSchema() {
  return {
    type: "OBJECT",
    properties: {
      facts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            hook: { type: "STRING" },
            fact: { type: "STRING" },
            topicPath: { type: "ARRAY", items: { type: "STRING" } },
            wikipediaSearchTitles: { type: "ARRAY", items: { type: "STRING" } },
            obscurityScore: { type: "INTEGER" }
          },
          required: ["title", "hook", "topicPath", "wikipediaSearchTitles", "obscurityScore"]
        }
      }
    },
    required: ["facts"]
  };
}

function groundedSchema() {
  return {
    type: "OBJECT",
    properties: {
      facts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            candidateIndex: { type: "INTEGER" },
            title: { type: "STRING" },
            hook: { type: "STRING" },
            body: { type: "STRING" },
            sourceIndexes: { type: "ARRAY", items: { type: "INTEGER" } },
            obscurityScore: { type: "INTEGER" }
          },
          required: ["candidateIndex", "title", "hook", "body", "sourceIndexes", "obscurityScore"]
        }
      }
    },
    required: ["facts"]
  };
}

export async function generateGeminiFacts({ apiKey, topicPaths, settings, avoid, rabbitHole }: {
  apiKey: string;
  topicPaths: Array<{ path: string[]; weight: number }>;
  settings: FeedSettings;
  avoid: string[];
  rabbitHole?: string | null;
}): Promise<FactCard[]> {
  const topicText = topicPaths.length ? topicPaths.map(({ path, weight }) => `${path.join(" → ")} (${weight}%)`).join("\n") : "a broad surprise topic";
  const candidatePrompt = `You generate candidate knowledge cards for Learned Media.

Create 10 obscure, interesting, understandable facts about the supplied topics. Prefer surprising historical details, forgotten events, strange connections, unusual inventions, counterintuitive science, hidden technical details, and specific geography. Avoid textbook facts, common trivia, myths, clickbait, unsupported claims, and vague generalizations.

For every candidate, suggest one to three exact English Wikipedia article titles that can support the claim. The titles are search hints only; the application will verify the pages and provide the final sources. Write a short opening hook of 4 to 12 words with no period, exclamation mark, or question mark.

Topics and weights:
${topicText}

Obscurity level: ${settings.obscurity}/5
Desired sentence length: ${settings.sentenceLength}
Surprise Me: ${settings.surpriseMe ? "enabled, use sparingly" : "disabled"}
Rabbit hole thread: ${rabbitHole ?? "none"}

Do not repeat or closely paraphrase these recent cards:
${avoid.slice(-12).join("\n") || "none"}

Return structured JSON only.`;

  const candidatePayload = await requestStructured<{ facts?: CandidateFact[] }>(apiKey, candidatePrompt, candidateSchema());
  const candidates = (candidatePayload.facts ?? []).slice(0, 10);
  const bundles = await Promise.all(candidates.map(async (candidate) => ({
    candidate,
    sources: await resolveWikipediaSources(candidate.wikipediaSearchTitles?.slice(0, 3) ?? [candidate.title ?? "Wikipedia"], 3)
  })));
  const usableBundles = bundles.filter((bundle) => bundle.sources.length > 0);
  if (!usableBundles.length) throw new Error("Wikipedia did not return supporting articles");

  const evidence = usableBundles.map(({ candidate, sources }, index) => ({
    candidateIndex: index,
    candidateTitle: candidate.title,
    candidateTopicPath: candidate.topicPath,
    sources: sources.map((source, sourceIndex) => ({ index: sourceIndex, title: source.title, url: source.url, extract: source.extract?.slice(0, 900) ?? "" }))
  }));
  const groundedPrompt = `Turn these candidate ideas into 10 final Learned Media cards using only the supplied Wikipedia evidence.

Rules:
- Every claim in body must be supported by the cited source excerpts.
- Choose one to three sourceIndexes from the candidate's sources. Use one when it is enough and add a second or third only when it contributes supporting context.
- Write a short hook of 4 to 12 words with no periods, exclamation marks, or question marks.
- The body is the normal card description, written in two or three clear sentences with normal punctuation.
- Keep the title specific and interesting. Do not invent citations or use sources from another candidate.

Evidence:
${JSON.stringify(evidence)}

Return structured JSON only.`;
  const groundedPayload = await requestStructured<{ facts?: GroundedFact[] }>(apiKey, groundedPrompt, groundedSchema());
  const grounded = groundedPayload.facts ?? [];
  return grounded.slice(0, 10).flatMap((fact, index) => {
    const bundle = usableBundles[fact.candidateIndex ?? index] ?? usableBundles[index % usableBundles.length];
    const chosenIndexes = Array.from(new Set((fact.sourceIndexes ?? []).filter((sourceIndex) => sourceIndex >= 0 && sourceIndex < bundle.sources.length))).slice(0, 3);
    const chosenSources = chosenIndexes.length ? chosenIndexes.map((sourceIndex) => bundle.sources[sourceIndex]) : bundle.sources.slice(0, 1);
    const imageSource = chosenSources.find((source) => source.image) ?? bundle.sources.find((source) => source.image);
    const candidate = bundle.candidate;
    return [{
      id: `gemini-${Date.now()}-${index}`,
      hook: hookWithoutPeriods(fact.hook ?? candidate.hook ?? fact.title ?? candidate.title ?? "A fact worth keeping"),
      title: fact.title?.trim() || candidate.title?.trim() || "A fact worth keeping",
      body: fact.body?.trim() || candidate.fact?.trim() || "A curious detail grounded in Wikipedia.",
      topicPath: candidate.topicPath?.filter(Boolean).slice(0, 4) ?? ["Surprise topic"],
      sources: cardSources(chosenSources),
      image: imageSource?.image,
      obscurity: Math.max(1, Math.min(5, Number(fact.obscurityScore) || Number(candidate.obscurityScore) || settings.obscurity)),
      accent: ["blue", "lilac", "mint", "sand", "coral"][index % 5] as FactCard["accent"],
      surprise: settings.surpriseMe && !topicPaths.some(({ path }) => candidate.topicPath?.join(" ").startsWith(path.join(" "))),
      createdAt: "Just now"
    } satisfies FactCard];
  });
}

export async function generateLearningResponse({ apiKey, action, card, question, detailed, history }: {
  apiKey: string;
  action: "learn" | "question";
  card: FactCard;
  question?: string;
  detailed?: boolean;
  history?: LearningMessage[];
}): Promise<{ answer: string; citations: WikipediaSource[] }> {
  const originalSources = await resolveWikipediaSources(card.sources.map((source) => source.title), 3);
  const questionSources = action === "question" && question ? await resolveWikipediaSources([question], 2) : [];
  const sources = Array.from(new Map([...originalSources, ...questionSources].map((source) => [source.url, source])).values()).slice(0, 3);
  if (!sources.length) throw new Error("Wikipedia did not return the cited pages for this fact");
  const context = sources.map((source, index) => `${index}. ${source.title}\nURL: ${source.url}\nExcerpt: ${source.extract ?? "No extract returned"}`).join("\n\n");
  const prompt = action === "learn"
    ? `Explain this fact in one useful paragraph of approximately 100 to 160 words. Use only the Wikipedia evidence below, keep the explanation clear, and add context rather than repeating the card body. Return citationIndexes for the sources that support the explanation.\n\nCard title: ${card.title}\nCard body: ${card.body}\n\nWikipedia evidence:\n${context}`
    : `Answer the user's question about this fact using only the Wikipedia evidence below. Normally answer in 2 to 4 sentences. If detailed is true, answer in approximately 150 to 250 words. If the evidence cannot answer the question, say so plainly and explain what the sources do establish. Return citationIndexes for the sources that support the answer.\n\nFact: ${card.title}\nCard body: ${card.body}\nUser question: ${question ?? ""}\nMore Details: ${detailed ? "true" : "false"}\nConversation so far: ${JSON.stringify(history?.slice(-6) ?? [])}\n\nWikipedia evidence:\n${context}`;
  const payload = await requestStructured<{ answer?: string; citationIndexes?: number[] }>(apiKey, prompt, {
    type: "OBJECT",
    properties: {
      answer: { type: "STRING" },
      citationIndexes: { type: "ARRAY", items: { type: "INTEGER" } }
    },
    required: ["answer", "citationIndexes"]
  });
  const indexes = Array.from(new Set((payload.citationIndexes ?? []).filter((index) => index >= 0 && index < sources.length))).slice(0, 3);
  return { answer: payload.answer?.trim() || "I could not generate an explanation from the cited Wikipedia pages.", citations: (indexes.length ? indexes : [0]).map((index) => sources[index]).filter(Boolean).map(({ image: _image, ...source }) => source) };
}

export async function testGeminiKey(apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(models()[0])}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single JSON object {\"ok\":true}." }] }], generationConfig: { responseMimeType: "application/json" } })
  });
  if (response.ok) return { ok: true as const };
  if (response.status === 401 || response.status === 403) return { ok: false as const, status: "invalid" as const };
  if (response.status === 429) return { ok: false as const, status: "rate-limited" as const };
  if (response.status === 404) return { ok: false as const, status: "unavailable" as const };
  return { ok: false as const, status: "unavailable" as const };
}
