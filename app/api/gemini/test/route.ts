import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey, testGeminiConnection, diagnoseGeminiError } from "@/lib/server/gemini";
import { assertContentLength, logError, parseJsonBody } from "@/lib/server/api-utils";

export async function POST(request: NextRequest) {
  try {
    assertContentLength(request, 16 * 1024);
    const body = await parseJsonBody(request);
    const providedKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (providedKey.length > 256) {
      return NextResponse.json(
        { ok: false, code: "INVALID_API_KEY", error: "That does not look like a valid Gemini API key." },
        { status: 400 }
      );
    }
    const apiKey = providedKey || getGeminiApiKey() || "";

    const result = await testGeminiConnection(apiKey);
    if (!result.ok) {
      logError("POST /api/gemini/test", result.diagnosis.message, {
        geminiCode: result.diagnosis.code,
      });
      return NextResponse.json(
        { ok: false, code: result.diagnosis.code, error: result.diagnosis.message },
        { status: result.diagnosis.httpStatus }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Gemini connected successfully",
      configured: true,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") {
      return NextResponse.json(
        { ok: false, code: "BAD_REQUEST", error: "The request could not be processed. Please try again." },
        { status: 400 }
      );
    }
    const diagnosis = diagnoseGeminiError(error);
    logError("POST /api/gemini/test", diagnosis.message, { geminiCode: diagnosis.code });
    return NextResponse.json(
      { ok: false, code: diagnosis.code, error: diagnosis.message },
      { status: diagnosis.httpStatus }
    );
  }
}
