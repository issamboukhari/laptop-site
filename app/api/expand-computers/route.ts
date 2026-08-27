import { NextRequest } from "next/server";
import {
  ApiError,
  asStringArray,
  assertContentLength,
  errorResponse,
  logError,
  parseJsonBody,
  requireString,
} from "@/lib/server/api-utils";
import { expandComputers } from "@/lib/server/expand";

/**
 * POST /api/expand-computers
 * Body: { query: string, excludeIds?: string[], count?: number }
 *
 * Dynamic Specs Expansion — asks Gemini for NEW real computers matching the
 * user's current hardware criteria, dedupes against the catalog, batch-saves
 * them to Supabase and returns the fresh records for instant rendering.
 */
export async function POST(request: NextRequest) {
  try {
    assertContentLength(request, 64 * 1024);
    const body = await parseJsonBody(request);

    const query = requireString(body.query, "query", 300);
    // Generous ceiling — the client still trims to the newest 40 ids
    // (slice(-40)) to keep payloads small; 1000 simply makes the endpoint
    // impossible to break with large catalogs.
    const rawIds = asStringArray(body.excludeIds ?? [], "excludeIds", { maxItems: 1000, itemMaxLength: 200 });
    const excludeIds = rawIds.slice(-40);
    const countRaw = typeof body.count === "number" ? body.count : 3;

    const result = await expandComputers({
      query,
      excludeIds,
      count: Math.round(countRaw),
    });

    return Response.json({
      models: result.models,
      savedCount: result.savedCount,
      internalCount: result.internalCount,
      criteria: result.criteria,
      source: "ai" as const,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) logError("POST /api/expand-computers", error);
    const err = error as { message?: string };
    // Map engine error codes onto friendly statuses.
    if (err?.message === "NO_API_KEY") {
      return Response.json(
        { error: { code: "NO_API_KEY", message: "Gemini AI is not configured yet." } },
        { status: 503 }
      );
    }
    if (err?.message === "QUOTA_EXCEEDED") {
      return Response.json(
        { error: { code: "QUOTA_EXCEEDED", message: "Gemini quota exceeded. Try again later." } },
        { status: 429 }
      );
    }
    return errorResponse(error, "POST /api/expand-computers");
  }
}
