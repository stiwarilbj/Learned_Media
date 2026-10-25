import { NextResponse } from "next/server";
import { describeGeminiError, geminiFailureDetails, generateLearningResponse } from "@/lib/gemini";
import type { FactCard, LearningMessage } from "@/lib/types";
import { isAnswerStructure, isQuestionInstructionPreference } from "@/lib/answer-structure";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action?: "learn" | "adapt" | "glossary" | "question";
      mode?: "simpler" | "deeper";
      card?: FactCard;
      question?: string;
      detailed?: boolean;
      structure?: string;
      instructionPreference?: string;
      history?: LearningMessage[];
    };
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
    const sessionId = request.headers.get("x-learned-media-session")?.trim() || "browser-session";
    if (!apiKey) return NextResponse.json({ error: "Add your Gemini API key in Settings before asking for more detail." }, { status: 400 });
    if (!body.card || (body.action !== "learn" && body.action !== "adapt" && body.action !== "glossary" && body.action !== "question")) {
      return NextResponse.json({ error: "A fact and learning action are required." }, { status: 400 });
    }
    if (body.action === "adapt" && body.mode !== "simpler" && body.mode !== "deeper") {
      return NextResponse.json({ error: "Choose a simpler or deeper explanation." }, { status: 400 });
    }
    if (body.action === "question" && !body.question?.trim()) {
      return NextResponse.json({ error: "Type a question about this fact first." }, { status: 400 });
    }
    if (body.action === "question" && body.structure !== undefined && !isAnswerStructure(body.structure)) {
      return NextResponse.json({ error: "Choose a supported answer structure." }, { status: 400 });
    }
    if (body.action === "question" && body.instructionPreference !== undefined && !isQuestionInstructionPreference(body.instructionPreference)) {
      return NextResponse.json({ error: "Choose a supported instruction priority." }, { status: 400 });
    }
    if (body.action === "glossary") {
      const result = await generateLearningResponse({
        apiKey,
        sessionId,
        action: "glossary",
        card: body.card,
        signal: request.signal
      });
      return NextResponse.json(result);
    }
    const result = await generateLearningResponse({
      apiKey,
      sessionId,
      action: body.action,
      card: body.card,
      question: body.question?.trim().slice(0, 600),
      detailed: Boolean(body.detailed),
      structure: body.structure && isAnswerStructure(body.structure) ? body.structure : "automatic",
      instructionPreference: body.instructionPreference && isQuestionInstructionPreference(body.instructionPreference) ? body.instructionPreference : "written",
      history: body.history?.slice(-6),
      mode: body.mode,
      signal: request.signal
    });
    return NextResponse.json(result);
  } catch (error) {
    const failure = geminiFailureDetails(error);
    return NextResponse.json({ error: describeGeminiError(error), modelOutcomes: failure.outcomes, modelStatus: failure.status }, { status: 502 });
  }
}
