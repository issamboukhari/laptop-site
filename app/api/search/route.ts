import { NextRequest, NextResponse } from "next/server";
import { searchModels } from "@/lib/server/search";
import { SearchFilters, ComputerCategory } from "@/lib/data/types";
import { errorResponse, parseNumberParam } from "@/lib/server/api-utils";

const VALID_CATEGORIES: ComputerCategory[] = [
  "gaming-laptop",
  "business-laptop",
  "ultrabook",
  "macbook",
  "workstation",
  "desktop",
  "mini-pc",
];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const query = (sp.get("q") ?? "").slice(0, 200);
    const filters: SearchFilters = {};

    const brand = sp.get("brand");
    if (brand) filters.brand = brand.slice(0, 100);

    const family = sp.get("family");
    if (family) filters.family = family.slice(0, 100);

    const category = sp.get("category");
    if (category) {
      if (!VALID_CATEGORIES.includes(category as ComputerCategory)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PARAM",
              message: `Unknown category "${category}".`,
            },
          },
          { status: 400 }
        );
      }
      filters.category = category as SearchFilters["category"];
    }

    filters.minRam = parseNumberParam(sp, "minRam", { min: 0, max: 1024 });
    filters.maxRam = parseNumberParam(sp, "maxRam", { min: 0, max: 1024 });
    filters.minStorage = parseNumberParam(sp, "minStorage", { min: 0, max: 100000 });
    filters.maxStorage = parseNumberParam(sp, "maxStorage", { min: 0, max: 100000 });
    filters.minPrice = parseNumberParam(sp, "minPrice", { min: 0, max: 1000000 });
    filters.maxPrice = parseNumberParam(sp, "maxPrice", { min: 0, max: 1000000 });
    filters.minYear = parseNumberParam(sp, "minYear", { min: 2000, max: 2100, integer: true });
    filters.maxYear = parseNumberParam(sp, "maxYear", { min: 2000, max: 2100, integer: true });
    filters.screenSize = parseNumberParam(sp, "screenSize", { min: 5, max: 40 });

    const touchscreen = sp.get("touchscreen");
    if (touchscreen === "true" || touchscreen === "false") {
      filters.touchscreen = touchscreen === "true";
    } else if (touchscreen !== null) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAM",
            message: 'touchscreen must be "true" or "false".',
          },
        },
        { status: 400 }
      );
    }

    const offset = parseNumberParam(sp, "offset", { min: 0, max: 100000, integer: true }) ?? 0;
    const limit =
      parseNumberParam(sp, "limit", { min: 1, max: 500, integer: true }) ?? 20;

    const result = await searchModels(query, filters, offset, limit);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "GET /api/search");
  }
}
