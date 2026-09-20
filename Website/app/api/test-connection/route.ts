import { NextResponse } from "next/server";
import { describeGeminiError, testGeminiKey } from "@/lib/gemini";

function streamResponse(request: Request, apiKey: string, sessionId: string) {
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
      void testGeminiKey(apiKey, request.signal, sessionId, (check, readyCount) => {
        send({ type: "model", check, readyCount, requiredWorkingModels: 5 });
      }).then((result) => {
        send({ type: "complete", ...result });
      }).catch((error) => {
        send({ type: "error", status: "unavailable", error: describeGeminiError(error) });
      }).finally(close);
    }
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-gemini-api-key")?.trim() ?? "";
    const sessionId = request.headers.get("x-learned-media-session")?.trim() || "browser-session";
    if (!apiKey) return NextResponse.json({ status: "not-configured" }, { status: 400 });
    if (request.headers.get("accept")?.includes("application/x-ndjson")) return streamResponse(request, apiKey, sessionId);
    const result = await testGeminiKey(apiKey, request.signal, sessionId);
    return NextResponse.json({ status: result.status, models: result.models, eligibleModelCount: result.eligibleModelCount, requiredWorkingModels: result.requiredWorkingModels }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ status: "unavailable", models: [], error: describeGeminiError(error) }, { status: 502 });
  }
}
