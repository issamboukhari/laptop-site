import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllModels,
  queryModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  invalidateCache,
} from "@/lib/server/database";
import { invalidateSearchIndex } from "@/lib/server/search";

/**
 * Phase 2.4.5 — Invariant Tests
 *
 * These tests verify cross-catalog invariants that must ALWAYS hold,
 * regardless of catalog size, invalidation state, or index lifecycle.
 *
 * If any of these fail, it indicates a fundamental architectural problem.
 */

let catalog: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  catalog = await getAllModels();
});

// ---------------------------------------------------------------------------
// INVARIANT 1: Every model returned by category index must have that category
// ---------------------------------------------------------------------------

describe("INVARIANT 1: category index results have correct category", () => {
  it("every model in category-filtered result has the requested category", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))];
    for (const cat of categories) {
      const result = await queryModels({ category: cat }, 0, 1000);
      for (const m of result.models) {
        expect(m.category).toBe(cat);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 2: Every model returned by brand index must have that brand
// ---------------------------------------------------------------------------

describe("INVARIANT 2: brand index results have correct brand", () => {
  it("every model in brand-filtered result has the requested brand", async () => {
    const brands = [...new Set(catalog.map((m) => m.brand))];
    for (const brand of brands) {
      const result = await queryModels({ brand }, 0, 1000);
      for (const m of result.models) {
        expect(m.brand.toLowerCase()).toBe(brand.toLowerCase());
      }
    }
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 3: Every variant index entry must point to correct parent model
// ---------------------------------------------------------------------------

describe("INVARIANT 3: variant index entries point to correct parent", () => {
  it("every variant resolves to a model that contains it", async () => {
    for (const m of catalog) {
      for (const v of m.variants) {
        const found = await findVariantById(v.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(v.id);

        const parent = await findModelByVariantId(v.id);
        expect(parent).toBeDefined();
        expect(parent!.id).toBe(m.id);
        expect(parent!.variants.some((pv) => pv.id === v.id)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 4: Search index corresponds to exactly one catalog snapshot
// ---------------------------------------------------------------------------

describe("INVARIANT 4: search index snapshot identity", () => {
  it("repeated search against same catalog returns same results", async () => {
    invalidateSearchIndex();
    const r1 = await import("@/lib/server/search").then((m) =>
      m.searchModels("lenovo", {})
    );
    const r2 = await import("@/lib/server/search").then((m) =>
      m.searchModels("lenovo", {})
    );
    expect(r1.models.map((m) => m.id)).toEqual(r2.models.map((m) => m.id));
  });

  it("after explicit invalidation, search still returns correct results", async () => {
    invalidateSearchIndex();
    const r1 = await import("@/lib/server/search").then((m) =>
      m.searchModels("dell", {})
    );
    expect(r1.models.length).toBeGreaterThan(0);
    invalidateSearchIndex();
    const r2 = await import("@/lib/server/search").then((m) =>
      m.searchModels("dell", {})
    );
    expect(r2.models.length).toBeGreaterThan(0);
    expect(r2.models.map((m) => m.id)).toEqual(r1.models.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 5: Applying filters must never produce a model that violates filters
// ---------------------------------------------------------------------------

describe("INVARIANT 5: filtered results always satisfy their filters", () => {
  it("category filter: every result has the category", async () => {
    const cat = [...new Set(catalog.map((m) => m.category))][0];
    const result = await queryModels({ category: cat }, 0, 1000);
    for (const m of result.models) {
      expect(m.category).toBe(cat);
    }
  });

  it("brand filter: every result has the brand (case-insensitive)", async () => {
    const brand = [...new Set(catalog.map((m) => m.brand))][0];
    const result = await queryModels({ brand }, 0, 1000);
    for (const m of result.models) {
      expect(m.brand.toLowerCase()).toBe(brand.toLowerCase());
    }
  });

  it("minYear filter: every result year >= minYear", async () => {
    const result = await queryModels({ minYear: 2022 }, 0, 1000);
    for (const m of result.models) {
      expect(m.year).toBeGreaterThanOrEqual(2022);
    }
  });

  it("maxYear filter: every result year <= maxYear", async () => {
    const result = await queryModels({ maxYear: 2020 }, 0, 1000);
    for (const m of result.models) {
      expect(m.year).toBeLessThanOrEqual(2020);
    }
  });

  it("minPrice filter: every result has at least one variant with price >= minPrice", async () => {
    const result = await queryModels({ minPrice: 1000 }, 0, 1000);
    for (const m of result.models) {
      const hasMatch = m.variants.some((v) => v.price >= 1000);
      expect(hasMatch).toBe(true);
    }
  });

  it("minRam filter: every result has at least one variant with ram >= minRam", async () => {
    const result = await queryModels({ minRam: 32 }, 0, 1000);
    for (const m of result.models) {
      const hasMatch = m.variants.some((v) => v.specs.ram >= 32);
      expect(hasMatch).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 6: Indexed retrieval + filtering = full scan + filtering
// ---------------------------------------------------------------------------

describe("INVARIANT 6: indexed retrieval is semantically equivalent to full scan", () => {
  it("for every category, indexed count = reference count", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))];
    for (const cat of categories) {
      const indexed = await queryModels({ category: cat }, 0, 1000);
      const reference = catalog.filter((m) => m.category === cat);
      expect(indexed.total).toBe(reference.length);
    }
  });

  it("for every brand, indexed count = reference count", async () => {
    const brands = [...new Set(catalog.map((m) => m.brand))];
    for (const brand of brands) {
      const indexed = await queryModels({ brand }, 0, 1000);
      const reference = catalog.filter(
        (m) => m.brand.toLowerCase() === brand.toLowerCase()
      );
      expect(indexed.total).toBe(reference.length);
    }
  });

  it("no-filter query returns all models in order", async () => {
    const indexed = await queryModels({}, 0, 1000);
    expect(indexed.models.map((m) => m.id)).toEqual(catalog.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 7: model count consistency across operations
// ---------------------------------------------------------------------------

describe("INVARIANT 7: count consistency", () => {
  it("total models is consistent across lookups", async () => {
    const all = await getAllModels();
    const indexed = await queryModels({}, 0, 1000);
    expect(indexed.total).toBe(all.length);
  });

  it("variant count per model is consistent", async () => {
    for (const m of catalog) {
      const found = await getModelById(m.id);
      expect(found).toBeDefined();
      expect(found!.variants.length).toBe(m.variants.length);
    }
  });

  it("total variant count across all models is consistent", async () => {
    let indexedTotal = 0;
    for (const m of catalog) {
      const found = await getModelById(m.id);
      indexedTotal += found!.variants.length;
    }
    const referenceTotal = catalog.reduce((sum, m) => sum + m.variants.length, 0);
    expect(indexedTotal).toBe(referenceTotal);
  });
});

// ---------------------------------------------------------------------------
// INVARIANT 8: index lifecycle invariants
// ---------------------------------------------------------------------------

describe("INVARIANT 8: index lifecycle invariants", () => {
  it("after invalidateCache, all lookups still return correct results", async () => {
    // Build all indexes
    const cat = catalog[0].category;
    const brand = catalog[0].brand;
    await queryModels({ category: cat }, 0, 1000);
    await queryModels({ brand }, 0, 1000);

    // Invalidate
    invalidateCache();

    // Verify all lookups still work
    const catResult = await queryModels({ category: cat }, 0, 1000);
    expect(catResult.models.length).toBeGreaterThan(0);
    for (const m of catResult.models) {
      expect(m.category).toBe(cat);
    }

    const brandResult = await queryModels({ brand }, 0, 1000);
    expect(brandResult.models.length).toBeGreaterThan(0);
    for (const m of brandResult.models) {
      expect(m.brand.toLowerCase()).toBe(brand.toLowerCase());
    }
  });

  it("repeated invalidateCache does not corrupt state", async () => {
    for (let i = 0; i < 3; i++) {
      invalidateCache();
      const result = await queryModels({}, 0, 5);
      expect(result.models.length).toBe(5);
    }
  });
});
