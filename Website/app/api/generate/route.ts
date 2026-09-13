import { NextResponse } from "next/server";
import { DEMO_FACTS } from "@/lib/demo-data";
import { generateGeminiFacts } from "@/lib/gemini";
import { enrichDemoCards } from "@/lib/wikipedia";
import type { FeedSettings } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { apiKey?: string; topics?: Array<{ path: string[]; weight: number }>; settings?: FeedSettings; avoid?: string[]; rabbitHole?: string | null };
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ cards: await enrichDemoCards(DEMO_FACTS), demo: true });
    const cards = await generateGeminiFacts({
      apiKey,
      topicPaths: body.topics ?? [],
      settings: body.settings ?? { obscurity: 4, displayMode: "picture-text", sentenceLength: 2, surpriseMe: true },
      avoid: body.avoid ?? [],
      rabbitHole: body.rabbitHole
    });
    return NextResponse.json({ cards, demo: false });
  } catch {
    const fallbackCards = await enrichDemoCards(DEMO_FACTS).catch(() => DEMO_FACTS);
    return NextResponse.json({ cards: fallbackCards, demo: true, reason: "generation-fallback" });
  }
}
