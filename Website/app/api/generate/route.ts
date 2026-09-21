import { describeGeminiError, generateGeminiFacts } from "@/lib/gemini";
import type { FeedSettings, LearningProfile } from "@/lib/types";
import { NextResponse } from "next/server";

type GenerateBody = {
  topics?: Array<{ path: string[]; weight: number }>;
  settings?: FeedSettings;
  learningProfile?: LearningProfile;
  avoid?: string[];
  rabbitHole?: string | null;
  requestedCount?: number;
};

function streamResponse(request: Request, apiKey: string, sessionId: string, body: GenerateBody) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (value: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      request.signal.addEventListener("abort", () => {
        closed = true;
        controller.close();
      }, { once: true });
      void generateGeminiFacts({
        apiKey,
        sessionId,
        topicPaths: body.topics ?? [],
        settings: body.settings ?? { obscurity: 5, displayMode: "picture-text", sentenceLength: 3, surpriseMe: true },
        learningProfile: body.learningProfile ?? {},
        avoid: body.avoid ?? [],
        rabbitHole: body.rabbitHole,
        requestedCount: body.requestedCount,
        signal: request.signal,
        onProgress: (event) => send({ type: "progress", event })
      }).then((result) => {
        send({ type: "complete", ...result });
      }).catch((error) => {
        const failure = error as { outcomes?: unknown; status?: number };
        send({ type: "error", error: describeGeminiError(error), modelOutcomes: failure.outcomes ?? [], retryable: failure.status !== 401 && failure.status !== 403, retryGuidance: "No sample facts were inserted. Retry after fixing the connection." });
      }).finally(close);
    }
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as GenerateBody;
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
    const sessionId = request.headers.get("x-learned-media-session")?.trim() || "browser-session";
    if (!apiKey) return NextResponse.json({ error: "Paste your Gemini API key in Settings and connect it before starting the feed.", reason: "missing-credential" }, { status: 400 });
    if (request.headers.get("accept")?.includes("application/x-ndjson")) return streamResponse(request, apiKey, sessionId, body);
    const result = await generateGeminiFacts({
      apiKey,
      sessionId,
      topicPaths: body.topics ?? [],
      settings: body.settings ?? { obscurity: 5, displayMode: "picture-text", sentenceLength: 3, surpriseMe: true },
      learningProfile: body.learningProfile ?? {},
      avoid: body.avoid ?? [],
      rabbitHole: body.rabbitHole,
      requestedCount: body.requestedCount,
      signal: request.signal
    });
    return NextResponse.json(result);
  } catch (error) {
    const failure = error as { outcomes?: unknown; status?: number };
    return NextResponse.json({ error: describeGeminiError(error), reason: "provider-error", modelOutcomes: failure.outcomes ?? [], partial: false, retryable: failure.status !== 401 && failure.status !== 403, retryGuidance: "No sample facts were inserted. Fix the connection or retry." }, { status: 502 });
  }
}
