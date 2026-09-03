import { describe, it, expect } from "vitest";
import { queryModels, getFilterFacets, getAllModels } from "@/lib/server/database";

/**
 * Phase 2.1 — Data Flow & Client Payload Regression Tests
 *
 * Validates that:
 *  - queryModels returns bounded results (not the full catalog)
 *  - limit parameter is respected
 *  - category filtering works via the API layer
 *  - getFilterFacets computes correctly over the catalog
 *  - the merged catalog is non-empty and stable
 */

describe("Data Flow — Bounded Catalog Loading", () => {
  it("queryModels returns at most `limit` models", async () => {
    const { models } = await queryModels({}, 0, 10);
    expect(models.length).toBeLessThanOrEqual(10);
  });

  it("queryModels respects limit=20 (default page size)", async () => {
    const { models, total } = await queryModels({}, 0, 20);
    expect(models.length).toBeLessThanOrEqual(20);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(models.length);
  });

  it("queryModels with limit=1 returns exactly 1 model", async () => {
    const { models } = await queryModels({}, 0, 1);
    expect(models.length).toBe(1);
  });

  it("queryModels with offset returns a different subset", async () => {
    const page1 = await queryModels({}, 0, 10);
    const page2 = await queryModels({}, 10, 10);
    // Pages should not overlap (assuming enough models)
    if (page1.models.length === 10 && page2.models.length > 0) {
      const ids1 = new Set(page1.models.map((m) => m.id));
      const ids2 = new Set(page2.models.map((m) => m.id));
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false);
      }
    }
  });

  it("queryModels total count matches unfiltered catalog size", async () => {
    const all = await getAllModels();
    const { total } = await queryModels({}, 0, 1);
    expect(total).toBe(all.length);
  });
});

describe("Data Flow — Category Filtering", () => {
  it("queryModels filters by category", async () => {
    const { models, total } = await queryModels(
      { category: "gaming-laptop" },
      0,
      100
    );
    for (const m of models) {
      expect(m.category).toBe("gaming-laptop");
    }
    expect(total).toBe(models.length);
  });

  it("queryModels category filter returns fewer results than unfiltered", async () => {
    const unfiltered = await queryModels({}, 0, 1000);
    const filtered = await queryModels(
      { category: "gaming-laptop" },
      0,
      1000
    );
    expect(filtered.total).toBeLessThanOrEqual(unfiltered.total);
  });

  it("queryModels with brand filter returns only matching brands", async () => {
    const { models } = await queryModels({ brand: "Lenovo" }, 0, 100);
    for (const m of models) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
    }
  });
});

describe("Data Flow — Filter Facets", () => {
  it("getFilterFacets returns all expected fields", async () => {
    const facets = await getFilterFacets();
    expect(facets.brands).toBeDefined();
    expect(facets.categories).toBeDefined();
    expect(facets.ramRange).toBeDefined();
    expect(facets.storageRange).toBeDefined();
    expect(facets.priceRange).toBeDefined();
    expect(facets.yearRange).toBeDefined();
  });

  it("getFilterFacets brands are sorted by count descending", async () => {
    const facets = await getFilterFacets();
    for (let i = 1; i < facets.brands.length; i++) {
      expect(facets.brands[i].count).toBeLessThanOrEqual(
        facets.brands[i - 1].count
      );
    }
  });

  it("getFilterFacets with category filter narrows the facet pool", async () => {
    const allFacets = await getFilterFacets();
    const gamingFacets = await getFilterFacets({ category: "gaming-laptop" });
    // Gaming should have fewer or equal brands than all
    expect(gamingFacets.brands.length).toBeLessThanOrEqual(
      allFacets.brands.length
    );
  });
});

describe("Data Flow — Merged Catalog", () => {
  it("getAllModels returns a non-empty array", async () => {
    const models = await getAllModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  it("getAllModels returns stable reference within TTL", async () => {
    const a = await getAllModels();
    const b = await getAllModels();
    // Within the 5-second TTL, should return the same reference
    expect(a).toBe(b);
  });

  it("every model from getAllModels has required fields", async () => {
    const models = await getAllModels();
    for (const m of models) {
      expect(typeof m.id).toBe("string");
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe("string");
      expect(typeof m.brand).toBe("string");
      expect(Array.isArray(m.variants)).toBe(true);
    }
  });
});
