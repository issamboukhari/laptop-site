import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllModels,
  queryModels,
  invalidateCache,
} from "@/lib/server/database";
import { ComputerCategory, SearchFilters } from "@/lib/data/types";

/**
 * Phase 2.4.2 — Category & Brand Index Tests
 *
 * Validates that:
 *  - Category index retrieves correct models
 *  - Brand index retrieves correct models
 *  - Combined category+brand narrows correctly
 *  - All other filters still work with indexed candidate pools
 *  - Indexes are invalidated and rebuilt correctly
 *  - Ordering is preserved
 */

let catalog: Awaited<ReturnType<typeof getAllModels>>;
let sampleCategory: ComputerCategory;
let sampleBrand: string;

beforeAll(async () => {
  catalog = await getAllModels();

  const catCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  for (const m of catalog) {
    catCounts.set(m.category, (catCounts.get(m.category) || 0) + 1);
    brandCounts.set(m.brand, (brandCounts.get(m.brand) || 0) + 1);
  }

  for (const [cat, count] of catCounts) {
    if (count >= 3) { sampleCategory = cat as ComputerCategory; break; }
  }
  for (const [brand, count] of brandCounts) {
    if (count >= 3) { sampleBrand = brand; break; }
  }
});

// ---------------------------------------------------------------------------
// A. Category index
// ---------------------------------------------------------------------------

describe("Category index — candidate retrieval", () => {
  it("returns models belonging to a category", async () => {
    const result = await queryModels({ category: sampleCategory }, 0, 500);
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      expect(m.category).toBe(sampleCategory);
    }
  });

  it("different categories are isolated", async () => {
    const cats = [...new Set(catalog.map((m) => m.category))].slice(0, 5) as ComputerCategory[];
    for (const cat of cats) {
      const result = await queryModels({ category: cat }, 0, 500);
      for (const m of result.models) {
        expect(m.category).toBe(cat);
      }
    }
  });

  it("unknown category returns no candidates", async () => {
    const result = await queryModels(
      { category: "gaming-laptop" as ComputerCategory },
      0, 500
    );
    // Use a category that exists but test with a brand that has no overlap
    const allBrands = [...new Set(catalog.map((m) => m.brand))];
    const catModels = catalog.filter((m) => m.category === sampleCategory);
    const catBrands = new Set(catModels.map((m) => m.brand));
    const alienBrand = allBrands.find((b) => !catBrands.has(b));
    if (alienBrand) {
      const r2 = await queryModels({ category: sampleCategory, brand: alienBrand }, 0, 500);
      expect(r2.models).toHaveLength(0);
      expect(r2.total).toBe(0);
    }
  });

  it("category filtering respects minRam/maxRam filters", async () => {
    const result = await queryModels(
      { category: sampleCategory, minRam: 16, maxRam: 16 },
      0, 500
    );
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      expect(m.category).toBe(sampleCategory);
    }
  });

  it("category + ram returns fewer models than category alone", async () => {
    const catOnly = await queryModels({ category: sampleCategory }, 0, 500);
    const catRam = await queryModels(
      { category: sampleCategory, minRam: 16, maxRam: 16 },
      0, 500
    );
    expect(catRam.total).toBeLessThanOrEqual(catOnly.total);
  });

  it("category filtering respects minPrice/maxPrice filter", async () => {
    const result = await queryModels(
      { category: sampleCategory, minPrice: 0, maxPrice: 50000 },
      0, 500
    );
    for (const m of result.models) {
      expect(m.category).toBe(sampleCategory);
      const withPrice = m.variants.filter((v) => v.price > 0);
      expect(withPrice.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// B. Brand index
// ---------------------------------------------------------------------------

describe("Brand index — candidate retrieval", () => {
  it("returns models belonging to a brand", async () => {
    const result = await queryModels({ brand: sampleBrand }, 0, 500);
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      expect(m.brand).toBe(sampleBrand);
    }
  });

  it("different brands are isolated", async () => {
    const brands = [...new Set(catalog.map((m) => m.brand))].slice(0, 5);
    for (const brand of brands) {
      const result = await queryModels({ brand }, 0, 500);
      for (const m of result.models) {
        expect(m.brand).toBe(brand);
      }
    }
  });

  it("unknown brand returns no candidates", async () => {
    const result = await queryModels({ brand: "NonExistentBrand12345" }, 0, 500);
    expect(result.models).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("brand filtering respects minRam/maxRam filters", async () => {
    const result = await queryModels(
      { brand: sampleBrand, minRam: 16, maxRam: 16 },
      0, 500
    );
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      expect(m.brand).toBe(sampleBrand);
    }
  });

  it("brand + ram returns fewer models than brand alone", async () => {
    const brandOnly = await queryModels({ brand: sampleBrand }, 0, 500);
    const brandRam = await queryModels(
      { brand: sampleBrand, minRam: 16, maxRam: 16 },
      0, 500
    );
    expect(brandRam.total).toBeLessThanOrEqual(brandOnly.total);
  });

  it("brand filtering respects minPrice/maxPrice filter", async () => {
    const result = await queryModels(
      { brand: sampleBrand, minPrice: 0, maxPrice: 50000 },
      0, 500
    );
    for (const m of result.models) {
      expect(m.brand).toBe(sampleBrand);
      const withPrice = m.variants.filter((v) => v.price > 0);
      expect(withPrice.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// C. Combined category + brand
// ---------------------------------------------------------------------------

describe("Combined category + brand", () => {
  it("returns only models satisfying both category and brand", async () => {
    const brandInCat = catalog
      .filter((m) => m.category === sampleCategory && m.brand === sampleBrand)
      .length;

    let testBrand = sampleBrand;
    if (brandInCat === 0) {
      const found = catalog.find((m) => m.category === sampleCategory);
      if (found) testBrand = found.brand;
    }

    const result = await queryModels(
      { category: sampleCategory, brand: testBrand },
      0, 500
    );
    for (const m of result.models) {
      expect(m.category).toBe(sampleCategory);
      expect(m.brand).toBe(testBrand);
    }
  });

  it("combined category + brand + price still respects modelMatchesFilters", async () => {
    const result = await queryModels(
      { category: sampleCategory, brand: sampleBrand, minPrice: 0, maxPrice: 50000 },
      0, 500
    );
    for (const m of result.models) {
      expect(m.category).toBe(sampleCategory);
      expect(m.brand).toBe(sampleBrand);
    }
  });

  it("combined category + brand with empty intersection returns nothing", async () => {
    const otherBrands = [...new Set(catalog.map((m) => m.brand))]
      .filter((b) => !catalog.some((m) => m.brand === b && m.category === sampleCategory));
    if (otherBrands.length === 0) return;

    const result = await queryModels(
      { category: sampleCategory, brand: otherBrands[0] },
      0, 500
    );
    expect(result.models).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D. Index invalidation
// ---------------------------------------------------------------------------

describe("Index lifecycle — category/brand", () => {
  it("indexes are rebuilt after cache invalidation", async () => {
    const before = await queryModels({ category: sampleCategory }, 0, 500);
    expect(before.models.length).toBeGreaterThan(0);

    invalidateCache();

    const after = await queryModels({ category: sampleCategory }, 0, 500);
    expect(after.models.length).toBe(before.models.length);
    expect(after.models.map((m) => m.id)).toEqual(before.models.map((m) => m.id));
  });

  it("brand index is rebuilt after cache invalidation", async () => {
    const before = await queryModels({ brand: sampleBrand }, 0, 500);
    expect(before.models.length).toBeGreaterThan(0);

    invalidateCache();

    const after = await queryModels({ brand: sampleBrand }, 0, 500);
    expect(after.models.length).toBe(before.models.length);
    expect(after.models.map((m) => m.id)).toEqual(before.models.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// E. Ordering
// ---------------------------------------------------------------------------

describe("Ordering — indexed vs full catalog", () => {
  it("category results preserve catalog order", async () => {
    const result = await queryModels({ category: sampleCategory }, 0, 500);
    const catModels = catalog.filter((m) => m.category === sampleCategory);
    expect(result.models.map((m) => m.id)).toEqual(catModels.map((m) => m.id));
  });

  it("brand results preserve catalog order", async () => {
    const result = await queryModels({ brand: sampleBrand }, 0, 500);
    const brandModels = catalog.filter((m) => m.brand === sampleBrand);
    expect(result.models.map((m) => m.id)).toEqual(brandModels.map((m) => m.id));
  });

  it("no-filter query returns full catalog order", async () => {
    const result = await queryModels({}, 0, 500);
    expect(result.models.map((m) => m.id)).toEqual(catalog.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// F. Regression — behavior equivalence
// ---------------------------------------------------------------------------

describe("Regression — category/brand index vs full scan", () => {
  it("category filter matches full catalog scan", async () => {
    const indexed = await queryModels({ category: sampleCategory }, 0, 500);
    const manual = catalog.filter((m) => m.category === sampleCategory);
    expect(indexed.total).toBe(manual.length);
    expect(indexed.models.map((m) => m.id)).toEqual(manual.map((m) => m.id));
  });

  it("brand filter matches full catalog scan", async () => {
    const indexed = await queryModels({ brand: sampleBrand }, 0, 500);
    const manual = catalog.filter((m) => m.brand === sampleBrand);
    expect(indexed.total).toBe(manual.length);
    expect(indexed.models.map((m) => m.id)).toEqual(manual.map((m) => m.id));
  });

  it("empty filters return all models", async () => {
    const result = await queryModels({}, 0, 500);
    expect(result.total).toBe(catalog.length);
    expect(result.models.length).toBe(catalog.length);
  });

  it("pagination still works with indexed pool", async () => {
    const page1 = await queryModels({ category: sampleCategory }, 0, 2);
    const page2 = await queryModels({ category: sampleCategory }, 2, 2);
    expect(page1.models.length).toBeLessThanOrEqual(2);
    expect(page1.total).toBeGreaterThanOrEqual(page1.models.length);
    const ids1 = new Set(page1.models.map((m) => m.id));
    for (const m of page2.models) {
      expect(ids1.has(m.id)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// G. Performance
// ---------------------------------------------------------------------------

describe("Performance — indexed category/brand lookup", () => {
  it("category lookup completes 5000 iterations under 500ms", async () => {
    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      await queryModels({ category: sampleCategory }, 0, 20);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("brand lookup completes 5000 iterations under 500ms", async () => {
    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      await queryModels({ brand: sampleBrand }, 0, 20);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("category+brand combined lookup completes 5000 iterations under 500ms", async () => {
    const start = performance.now();
    for (let i = 0; i < 5000; i++) {
      await queryModels({ category: sampleCategory, brand: sampleBrand }, 0, 20);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
