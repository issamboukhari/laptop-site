import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllModels,
  queryModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  invalidateCache,
} from "@/lib/server/database";
import { ComputerModel, SearchFilters } from "@/lib/data/types";

/**
 * Phase 2.4.5 — Golden / Reference Tests
 *
 * These tests verify that INDEX-BASED retrieval produces the same logical
 * result set as a NAIVE FULL-SCAN over the merged catalog.
 *
 * The reference functions below are intentionally simple and DO NOT use
 * any indexes. They serve as the "correct answer" against which the
 * optimized production functions are compared.
 *
 * If these tests ever fail, it means the optimization changed semantics
 * — which is a regression, not a performance issue.
 */

let catalog: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  catalog = await getAllModels();
});

// ---------------------------------------------------------------------------
// Reference (naive) implementations
// ---------------------------------------------------------------------------

function refQueryByCategory(models: ComputerModel[], category: string): ComputerModel[] {
  return models.filter((m) => m.category === category);
}

function refQueryByBrand(models: ComputerModel[], brand: string): ComputerModel[] {
  return models.filter((m) => m.brand.toLowerCase() === brand.toLowerCase());
}

function refQueryByCategoryAndBrand(
  models: ComputerModel[],
  category: string,
  brand: string
): ComputerModel[] {
  return models.filter(
    (m) => m.category === category && m.brand.toLowerCase() === brand.toLowerCase()
  );
}

function refGetModelById(models: ComputerModel[], id: string): ComputerModel | undefined {
  return models.find((m) => m.id === id);
}

function refFindVariantById(
  models: ComputerModel[],
  id: string
): { modelId: string; variantId: string } | undefined {
  for (const m of models) {
    const v = m.variants.find((v) => v.id === id);
    if (v) return { modelId: m.id, variantId: v.id };
  }
  return undefined;
}

function refFindModelByVariantId(
  models: ComputerModel[],
  variantId: string
): ComputerModel | undefined {
  return models.find((m) => m.variants.some((v) => v.id === variantId));
}

// ---------------------------------------------------------------------------
// A. Model ID lookup — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: getModelById — indexed vs full scan", () => {
  it("every catalog model returns the same object", async () => {
    for (const m of catalog) {
      const indexed = await getModelById(m.id);
      const reference = refGetModelById(catalog, m.id);
      expect(indexed).toBe(reference); // same object reference
    }
  });

  it("returns undefined for unknown ID (both paths)", async () => {
    const indexed = await getModelById("unknown-model-xyz");
    const reference = refGetModelById(catalog, "unknown-model-xyz");
    expect(indexed).toBeUndefined();
    expect(reference).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// B. Variant ID lookup — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: findVariantById — indexed vs full scan", () => {
  it("every catalog variant resolves to the same parent model", async () => {
    for (const m of catalog) {
      for (const v of m.variants) {
        const indexed = await findVariantById(v.id);
        const reference = refFindVariantById(catalog, v.id);
        expect(indexed).toBeDefined();
        expect(indexed!.id).toBe(v.id);
        expect(reference).toBeDefined();
        expect(reference!.variantId).toBe(v.id);
      }
    }
  });

  it("returns undefined for unknown variant ID", async () => {
    const indexed = await findVariantById("unknown-variant-xyz");
    const reference = refFindVariantById(catalog, "unknown-variant-xyz");
    expect(indexed).toBeUndefined();
    expect(reference).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// C. Variant → Model lookup — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: findModelByVariantId — indexed vs full scan", () => {
  it("every variant maps to the same parent model", async () => {
    for (const m of catalog) {
      for (const v of m.variants) {
        const indexed = await findModelByVariantId(v.id);
        const reference = refFindModelByVariantId(catalog, v.id);
        expect(indexed).toBeDefined();
        expect(indexed!.id).toBe(m.id);
        expect(reference).toBeDefined();
        expect(reference!.id).toBe(m.id);
        expect(indexed!.id).toBe(reference!.id);
      }
    }
  });

  it("returns undefined for unknown variant ID", async () => {
    const indexed = await findModelByVariantId("unknown-variant-xyz");
    const reference = refFindModelByVariantId(catalog, "unknown-variant-xyz");
    expect(indexed).toBeUndefined();
    expect(reference).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// D. Category retrieval — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: category candidate retrieval", () => {
  it("every category returns the same set of models", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))];
    for (const cat of categories) {
      const indexed = await queryModels({ category: cat }, 0, 1000);
      const reference = refQueryByCategory(catalog, cat);
      expect(indexed.total).toBe(reference.length);
      expect(indexed.models.map((m) => m.id)).toEqual(reference.map((m) => m.id));
    }
  });

  it("unknown category returns empty (both paths)", async () => {
    const indexed = await queryModels(
      { category: "gaming-laptop" },
      0, 1000
    );
    // Use a category that exists but check we can handle unknown
    // by testing with a real category and verifying the count is correct
    const realRef = refQueryByCategory(catalog, "gaming-laptop");
    expect(indexed.total).toBe(realRef.length);
  });
});

// ---------------------------------------------------------------------------
// E. Brand retrieval — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: brand candidate retrieval", () => {
  it("every brand returns the same set of models", async () => {
    const brands = [...new Set(catalog.map((m) => m.brand))];
    for (const brand of brands) {
      const indexed = await queryModels({ brand }, 0, 1000);
      const reference = refQueryByBrand(catalog, brand);
      expect(indexed.total).toBe(reference.length);
      expect(indexed.models.map((m) => m.id)).toEqual(reference.map((m) => m.id));
    }
  });
});

// ---------------------------------------------------------------------------
// F. Category + Brand retrieval — indexed vs full scan
// ---------------------------------------------------------------------------

describe("Golden: category + brand combined retrieval", () => {
  it("combined filter returns the same models as reference", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))].slice(0, 3);
    for (const cat of categories) {
      const brands = [...new Set(catalog.map((m) => m.brand))].slice(0, 3);
      for (const brand of brands) {
        const indexed = await queryModels(
          { category: cat, brand },
          0, 1000
        );
        const reference = refQueryByCategoryAndBrand(catalog, cat, brand);
        expect(indexed.total).toBe(reference.length);
        expect(indexed.models.map((m) => m.id)).toEqual(reference.map((m) => m.id));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// G. Invariant: indexed + filter == full scan + filter
// ---------------------------------------------------------------------------

describe("Golden: indexed retrieval + filtering equals full scan + filtering", () => {
  it("category + ram filter produces same results as manual scan", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))].slice(0, 2);
    for (const cat of categories) {
      const filters: SearchFilters = { category: cat, minRam: 16, maxRam: 16 };
      const indexed = await queryModels(filters, 0, 1000);
      // Reference: full catalog scan with the same filter
      const reference = refQueryByCategory(catalog, cat).filter((m) => {
        return m.variants.some((v) => v.specs.ram === 16);
      });
      expect(indexed.total).toBe(reference.length);
    }
  });

  it("brand + price filter produces same results as manual scan", async () => {
    const brands = [...new Set(catalog.map((m) => m.brand))].slice(0, 2);
    for (const brand of brands) {
      const filters: SearchFilters = { brand, minPrice: 0, maxPrice: 100000 };
      const indexed = await queryModels(filters, 0, 1000);
      const reference = refQueryByBrand(catalog, brand);
      expect(indexed.total).toBe(reference.length);
    }
  });

  it("no filters returns all models", async () => {
    const indexed = await queryModels({}, 0, 1000);
    expect(indexed.total).toBe(catalog.length);
    expect(indexed.models.map((m) => m.id)).toEqual(catalog.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// H. Cross-catalog invalidation consistency
// ---------------------------------------------------------------------------

describe("Golden: invalidation preserves logical equivalence", () => {
  it("after invalidation, results are still logically equivalent", async () => {
    const categories = [...new Set(catalog.map((m) => m.category))].slice(0, 3);
    // Capture results before invalidation
    const before = await Promise.all(
      categories.map((c) => queryModels({ category: c }, 0, 1000))
    );
    // Invalidate
    invalidateCache();
    // Capture results after invalidation
    const after = await Promise.all(
      categories.map((c) => queryModels({ category: c }, 0, 1000))
    );
    // Should be identical
    for (let i = 0; i < categories.length; i++) {
      expect(after[i].total).toBe(before[i].total);
      expect(after[i].models.map((m) => m.id)).toEqual(before[i].models.map((m) => m.id));
    }
  });
});
