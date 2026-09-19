import { NextResponse } from "next/server";
import { testGeminiKey } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
    if (!apiKey) return NextResponse.json({ status: "not-configured" }, { status: 400 });
    const result = await testGeminiKey(apiKey, request.signal);
    return NextResponse.json({ status: result.ok ? "connected" : result.status, models: result.models, eligibleModelCount: result.eligibleModelCount }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ status: "unavailable", models: [], error: error instanceof Error ? error.message : "Gemini model discovery failed." }, { status: 502 });
  }
}
