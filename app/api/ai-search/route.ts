import { NextRequest } from "next/server";
import { aiSearch } from "@/lib/server/ai-research";
import { findStrictDatabaseMatches } from "@/lib/server/search";
import { diagnoseGeminiError } from "@/lib/server/gemini";
import {
  ApiError,
  assertContentLength,
  errorResponse,
  logError,
  parseJsonBody,
  requireString,
  withTimeout,
} from "@/lib/server/api-utils";

const AI_SEARCH_TIMEOUT_MS = 90_000;

/**
 * AI Computer Search — streaming SSE endpoint.
 *
 * Progress events:
 *   { type: "progress", step: "database" | "identifying" | "parsing" | "saving" | "done" }
 * Final event:
 *   { type: "result", source, models, saved, interpretedAs? }
 * Error event:
 *   { type: "error", code, message }
 */
export async function POST(request: NextRequest) {
  try {
    assertContentLength(request, 16 * 1024);
    const body = await parseJsonBody(request);
    const query = requireString(body.query, "query", 300);

    // Fast path: already in the global catalog? Return without Gemini.
    const existing = await findStrictDatabaseMatches(query);
    if (existing.length > 0) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (obj: Record<string, unknown>) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          send({ type: "progress", step: "database" });
          send({ type: "result", source: "database", models: existing, saved: false });
          controller.close();
        },
      });
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Gemini discovery with streaming progress.
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          const aiResult = await withTimeout(
            aiSearch(query, (step) => send({ type: "progress", step })),
            AI_SEARCH_TIMEOUT_MS,
            "AI search",
          );
          send({ type: "result", ...aiResult });
        } catch (aiError) {
          if (aiError instanceof ApiError) {
            send({ type: "error", code: aiError.code, message: aiError.userMessage });
          } else if (aiError instanceof Error && aiError.message === "NO_API_KEY") {
            send({
              type: "error",
              code: "NO_API_KEY",
              message: "Gemini AI is not configured yet. Add a Gemini API key to use AI Search.",
            });
          } else {
            const diagnosis = diagnoseGeminiError(aiError);
            send({ type: "error", code: diagnosis.code, message: diagnosis.message });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error, "POST /api/ai-search");
  }
}
