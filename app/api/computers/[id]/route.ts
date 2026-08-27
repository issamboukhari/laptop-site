import { NextRequest, NextResponse } from "next/server";
import { getModelById, findVariantById, findModelByVariantId } from "@/lib/server/database";
import { ApiError, errorResponse, logError } from "@/lib/server/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length > 200) {
      throw new ApiError("INVALID_PARAM", "Invalid computer id.", {
        details: { id },
      });
    }

    const model = await getModelById(id);
    if (model) {
      return NextResponse.json({ model, variant: undefined });
    }

    let variant;
    try {
      variant = await findVariantById(id);
    } catch (dbError) {
      // A database failure while resolving a variant must surface as 500,
      // not as a false "not found".
      logError("GET /api/computers/[id]:variant-lookup", dbError, { id });
      throw new ApiError(
        "INTERNAL_ERROR",
        "Unable to load this computer right now. Please try again."
      );
    }

    if (variant) {
      try {
        const parentModel = await findModelByVariantId(id);
        return NextResponse.json({ model: parentModel || undefined, variant });
      } catch (dbError) {
        logError("GET /api/computers/[id]:parent-lookup", dbError, { id });
        // The variant itself resolved; still return it so the page stays usable.
        return NextResponse.json({ model: undefined, variant });
      }
    }

    throw new ApiError("NOT_FOUND", "This computer could not be found. It may have been removed.", {
      details: { id },
    });
  } catch (error) {
    return errorResponse(error, "GET /api/computers/[id]");
  }
}
