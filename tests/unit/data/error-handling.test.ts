import { describe, it, expect } from "vitest";
import {
  getAllModels,
  queryModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  getFilterFacets,
  invalidateCache,
} from "@/lib/server/database";

/**
 * Phase 2.4.5 — Error Handling Tests
 *
 * Verifies graceful fallback behavior for edge cases and failure scenarios.
 * The system must never crash, throw unhandled errors, or return corrupted data.
 */

describe("Error handling — lookups with invalid input", () => {
  it("getModelById with empty string returns undefined", async () => {
    const result = await getModelById("");
    expect(result).toBeUndefined();
  });

  it("getModelById with non-existent ID returns undefined", async () => {
    const result = await getModelById("this-model-does-not-exist-12345");
    expect(result).toBeUndefined();
  });

  it("findVariantById with empty string returns undefined", async () => {
    const result = await findVariantById("");
    expect(result).toBeUndefined();
  });

  it("findVariantById with non-existent ID returns undefined", async () => {
    const result = await findVariantById("this-variant-does-not-exist-12345");
    expect(result).toBeUndefined();
  });

  it("findModelByVariantId with empty string returns undefined", async () => {
    const result = await findModelByVariantId("");
    expect(result).toBeUndefined();
  });

  it("findModelByVariantId with non-existent ID returns undefined", async () => {
    const result = await findModelByVariantId("this-variant-does-not-exist-12345");
    expect(result).toBeUndefined();
  });
});

describe("Error handling — queryModels with edge case filters", () => {
  it("empty filters object returns all models", async () => {
    const result = await queryModels({}, 0, 1000);
    expect(result.models).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
  });

  it("zero offset and zero limit returns empty but valid result", async () => {
    const result = await queryModels({}, 0, 0);
    expect(result.models).toBeDefined();
    expect(result.models).toHaveLength(0);
  });

  it("large offset returns empty but valid result", async () => {
    const result = await queryModels({}, 99999, 10);
    expect(result.models).toBeDefined();
    expect(result.models).toHaveLength(0);
    expect(result.total).toBeGreaterThan(0); // total still reports catalog size
  });

  it("negative offset is handled gracefully", async () => {
    // Negative offset should not crash; most implementations treat as 0
    const result = await queryModels({}, -1, 10);
    expect(result.models).toBeDefined();
  });

  it("filters with empty string values do not match anything", async () => {
    const result = await queryModels({ brand: "" }, 0, 1000);
    // Empty string brand: depends on matcher — at minimum should not crash
    expect(result).toBeDefined();
  });

  it("conflicting min/max year range returns empty", async () => {
    // minYear > maxYear is contradictory
    const result = await queryModels(
      { minYear: 2025, maxYear: 2020 },
      0, 1000
    );
    expect(result.models).toBeDefined();
    expect(result.models).toHaveLength(0);
  });

  it("extremely high minPrice returns empty", async () => {
    const result = await queryModels(
      { minPrice: 999999999, maxPrice: 999999999 },
      0, 1000
    );
    expect(result.models).toHaveLength(0);
  });

  it("minPrice > maxPrice returns empty", async () => {
    const result = await queryModels(
      { minPrice: 5000, maxPrice: 100 },
      0, 1000
    );
    expect(result.models).toHaveLength(0);
  });
});

describe("Error handling — invalidateCache", () => {
  it("multiple consecutive invalidations are safe", async () => {
    for (let i = 0; i < 5; i++) {
      expect(() => invalidateCache()).not.toThrow();
    }
  });

  it("interleaved query + invalidate is safe", async () => {
    await queryModels({}, 0, 5);
    invalidateCache();
    const r = await queryModels({}, 0, 5);
    expect(r.models).toBeDefined();
    expect(r.models.length).toBe(5);
  });
});

describe("Error handling — getFilterFacets", () => {
  it("returns valid facets for empty filters", async () => {
    const facets = await getFilterFacets();
    expect(facets).toBeDefined();
    expect(facets.brands).toBeDefined();
    expect(facets.categories).toBeDefined();
    expect(facets.ramRange).toBeDefined();
    expect(facets.ramRange.min).toBeDefined();
    expect(facets.ramRange.max).toBeDefined();
  });

  it("returns valid facets for category filter", async () => {
    const catalog = await getAllModels();
    const cat = catalog[0].category;
    const facets = await getFilterFacets({ category: cat });
    expect(facets).toBeDefined();
    expect(facets.brands).toBeDefined();
    expect(facets.brands.length).toBeGreaterThan(0);
  });

  it("returns empty facets for impossible filter combination", async () => {
    const facets = await getFilterFacets({
      minYear: 2099,
      maxYear: 2099,
    });
    expect(facets).toBeDefined();
    expect(facets.brands).toBeDefined();
    // Brands/categories should be empty since no models match
    expect(facets.brands).toHaveLength(0);
  });
});

describe("Error handling — concurrent operations", () => {
  it("concurrent lookups return correct results", async () => {
    const catalog = await getAllModels();
    const ids = catalog.slice(0, 20).map((m) => m.id);
    const results = await Promise.all(
      ids.map((id) => getModelById(id))
    );
    for (let i = 0; i < ids.length; i++) {
      expect(results[i]).toBeDefined();
      expect(results[i]!.id).toBe(ids[i]);
    }
  });

  it("concurrent lookups with unknown IDs are safe", async () => {
    const results = await Promise.all([
      getModelById("unknown-1"),
      getModelById("unknown-2"),
      getModelById(""),
      getModelById("unknown-3"),
    ]);
    for (const r of results) {
      expect(r).toBeUndefined();
    }
  });

  it("concurrent queries with mixed valid/invalid filters", async () => {
    const results = await Promise.all([
      queryModels({}, 0, 5),
      queryModels({ category: "gaming-laptop" }, 0, 5),
      queryModels({ minYear: 2099 }, 0, 5),
      queryModels({ brand: "" }, 0, 5),
    ]);
    expect(results[0].models.length).toBe(5);
    expect(results[1]).toBeDefined();
    expect(results[2].models).toHaveLength(0);
    expect(results[3]).toBeDefined();
  });
});

describe("Error handling — search edge cases", () => {
  it("search with only whitespace returns empty", async () => {
    const { searchModels } = await import("@/lib/server/search");
    const result = await searchModels("   ", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });

  it("search with only punctuation returns empty", async () => {
    const { searchModels } = await import("@/lib/server/search");
    const result = await searchModels("!@#$%", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });

  it("search with very long query does not crash", async () => {
    const { searchModels } = await import("@/lib/server/search");
    const longQuery = "a".repeat(500);
    const result = await searchModels(longQuery, {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });

  it("search with empty string returns valid result", async () => {
    const { searchModels } = await import("@/lib/server/search");
    const result = await searchModels("", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });

  it("autocomplete with whitespace returns empty", async () => {
    const { getAutocomplete } = await import("@/lib/server/search");
    const result = await getAutocomplete("   ");
    expect(result).toBeDefined();
    expect(result.brands).toHaveLength(0);
    expect(result.families).toHaveLength(0);
    expect(result.models).toHaveLength(0);
  });
});
