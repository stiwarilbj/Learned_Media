import { NextResponse } from "next/server";
import { describeGeminiError, generateGeminiFacts } from "@/lib/gemini";
import type { FeedSettings, LearningProfile } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { topics?: Array<{ path: string[]; weight: number }>; settings?: FeedSettings; learningProfile?: LearningProfile; avoid?: string[]; rabbitHole?: string | null };
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
    if (!apiKey) return NextResponse.json({ error: "Paste your Gemini API key in Settings and connect it before starting the feed.", reason: "missing-credential" }, { status: 400 });
    const settings: FeedSettings = body.settings ?? { obscurity: 10, displayMode: "picture-text", sentenceLength: 2, surpriseMe: true };
    const result = await generateGeminiFacts({
      apiKey,
      topicPaths: body.topics ?? [],
      settings,
      learningProfile: body.learningProfile ?? {},
      avoid: body.avoid ?? [],
      rabbitHole: body.rabbitHole,
      signal: request.signal
    });
    return NextResponse.json(result);
  } catch (error) {
    const failure = error as { outcomes?: unknown; status?: number };
    return NextResponse.json({ error: describeGeminiError(error), reason: "provider-error", modelOutcomes: failure.outcomes ?? [], partial: false, retryable: failure.status !== 401 && failure.status !== 403, retryGuidance: "No sample facts were inserted. Fix the connection or retry." }, { status: 502 });
  }
}
