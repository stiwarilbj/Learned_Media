import { NextResponse } from "next/server";
import { generateLearningResponse } from "@/lib/gemini";
import type { FactCard, LearningMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      apiKey?: string;
      action?: "learn" | "question";
      card?: FactCard;
      question?: string;
      detailed?: boolean;
      history?: LearningMessage[];
    };
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Add your Gemini API key in Settings before asking for more detail." }, { status: 400 });
    if (!body.card || (body.action !== "learn" && body.action !== "question")) {
      return NextResponse.json({ error: "A fact and learning action are required." }, { status: 400 });
    }
    if (body.action === "question" && !body.question?.trim()) {
      return NextResponse.json({ error: "Type a question about this fact first." }, { status: 400 });
    }
    const result = await generateLearningResponse({
      apiKey,
      action: body.action,
      card: body.card,
      question: body.question?.trim().slice(0, 600),
      detailed: Boolean(body.detailed),
      history: body.history?.slice(-6)
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Gemini could not answer from the cited Wikipedia pages. Try again in a moment." }, { status: 502 });
  }
}
