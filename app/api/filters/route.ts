import { NextResponse } from "next/server";
import { getFilterFacets } from "@/lib/server/database";
import { errorResponse } from "@/lib/server/api-utils";

export async function GET() {
  try {
    const facets = await getFilterFacets();
    return NextResponse.json(facets);
  } catch (error) {
    return errorResponse(error, "GET /api/filters");
  }
}
