import { NextRequest, NextResponse } from "next/server";
import {
  saveGeminiApiKey,
  testGeminiConnection,
  diagnoseGeminiError,
  hasGeminiApiKey,
} from "@/lib/server/gemini";
import {
  assertContentLength,
  errorResponse,
  logError,
  parseJsonBody,
} from "@/lib/server/api-utils";

export async function GET() {
  return NextResponse.json({ configured: hasGeminiApiKey() });
}

export async function POST(request: NextRequest) {
  try {
    assertContentLength(request, 16 * 1024);
    const body = await parseJsonBody(request);
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, code: "NO_API_KEY", error: "Paste your Gemini API key to continue." },
        { status: 400 }
      );
    }
    if (apiKey.length > 256) {
      logError("POST /api/gemini/config", null, { reason: "key too long", length: apiKey.length });
      return NextResponse.json(
        { ok: false, code: "INVALID_API_KEY", error: "That does not look like a valid Gemini API key." },
        { status: 400 }
      );
    }

    // Validate against Gemini before persisting so we never store a bad key.
    const result = await testGeminiConnection(apiKey);
    if (!result.ok) {
      logError("POST /api/gemini_config:test-failed", result.diagnosis.message, {
        geminiCode: result.diagnosis.code,
      });
      return NextResponse.json(
        { ok: false, code: result.diagnosis.code, error: result.diagnosis.message },
        { status: result.diagnosis.httpStatus }
      );
    }

    await saveGeminiApiKey(apiKey);
    return NextResponse.json({
      ok: true,
      configured: true,
      message: "Gemini connected successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      return NextResponse.json(
        { ok: false, code: "BAD_REQUEST", error: "The request could not be processed. Please try again." },
        { status: 400 }
      );
    }
    const diagnosis = diagnoseGeminiError(error);
    logError("POST /api/gemini/config", diagnosis.message, { geminiCode: diagnosis.code });
    return NextResponse.json(
      { ok: false, code: diagnosis.code, error: diagnosis.message },
      { status: diagnosis.httpStatus }
    );
  }
}
