import { NextResponse } from "next/server";
import { testGeminiKey } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { apiKey?: string };
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ status: "not-configured" }, { status: 400 });
    const result = await testGeminiKey(apiKey);
    return NextResponse.json({ status: result.ok ? "connected" : result.status }, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 502 });
  }
}
