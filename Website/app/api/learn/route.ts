import { NextResponse } from "next/server";
import { describeGeminiError, generateLearningResponse } from "@/lib/gemini";
import type { FactCard, LearningMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action?: "learn" | "question";
      card?: FactCard;
      question?: string;
      detailed?: boolean;
      history?: LearningMessage[];
    };
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
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
      history: body.history?.slice(-6),
      signal: request.signal
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: describeGeminiError(error) }, { status: 502 });
  }
}
