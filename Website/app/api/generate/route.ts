import { NextResponse } from "next/server";
import { DEMO_FACTS } from "@/lib/demo-data";
import { describeGeminiError, generateGeminiFacts } from "@/lib/gemini";
import { enrichDemoCards } from "@/lib/wikipedia";
import { selectDemoFacts } from "@/lib/recommendations";
import type { FeedSettings, LearningProfile } from "@/lib/types";

export async function POST(request: Request) {
  let fallbackCards = DEMO_FACTS;
  let credential = "";
  try {
    const body = await request.json() as { apiKey?: string; topics?: Array<{ path: string[]; weight: number }>; settings?: FeedSettings; learningProfile?: LearningProfile; avoid?: string[]; rabbitHole?: string | null };
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    credential = apiKey ?? "";
    const settings: FeedSettings = body.settings ?? { obscurity: 10, displayMode: "picture-text", sentenceLength: 2, surpriseMe: true };
    const demoCards = selectDemoFacts(DEMO_FACTS, body.topics ?? [], settings, body.learningProfile ?? {}, body.avoid ?? []);
    fallbackCards = demoCards;
    if (!apiKey) return NextResponse.json({ cards: await enrichDemoCards(demoCards), demo: true });
    const cards = await generateGeminiFacts({
      apiKey,
      topicPaths: body.topics ?? [],
      settings,
      learningProfile: body.learningProfile ?? {},
      avoid: body.avoid ?? [],
      rabbitHole: body.rabbitHole
    });
    return NextResponse.json({ cards, demo: false });
  } catch (error) {
    if (credential) return NextResponse.json({ error: describeGeminiError(error), reason: "provider-error" }, { status: 502 });
    const enrichedFallbackCards = await enrichDemoCards(fallbackCards).catch(() => fallbackCards);
    return NextResponse.json({ cards: enrichedFallbackCards, demo: true, reason: "generation-fallback" });
  }
}
