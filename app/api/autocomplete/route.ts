import { NextRequest, NextResponse } from "next/server";
import { getAutocomplete } from "@/lib/server/search";
import { ApiError, errorResponse } from "@/lib/server/api-utils";

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("q");
    if (raw === null) {
      throw new ApiError("VALIDATION_ERROR", "Query parameter q is required.");
    }
    if (raw.length > 200) {
      throw new ApiError("VALIDATION_ERROR", "Query is too long (max 200 characters).");
    }
    const result = await getAutocomplete(raw);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "GET /api/autocomplete");
  }
}
