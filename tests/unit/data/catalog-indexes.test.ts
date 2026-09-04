import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  invalidateCache,
} from "@/lib/server/database";

/**
 * Phase 2.4.1 — Indexed Single-Item Catalog Access Tests
 *
 * Validates that:
 *  - Index-based lookups return identical results to linear scans
 *  - Missing IDs return undefined
 *  - Variant enrichment is preserved
 *  - Variant→parent model relationship is correct
 *  - Indexes are invalidated and rebuilt correctly
 *  - All existing behavior remains unchanged (regression)
 */

let catalog: Awaited<ReturnType<typeof getAllModels>>;
let firstModel: (typeof catalog)[number];
let firstVariant: (typeof catalog)[number]["variants"][number];

beforeAll(async () => {
  catalog = await getAllModels();
  firstModel = catalog[0];
  firstVariant = firstModel.variants[0];
});

// ---------------------------------------------------------------------------
// 1. getModelById — existing model ID
// ---------------------------------------------------------------------------

describe("getModelById — indexed lookup", () => {
  it("returns the correct model for an existing ID", async () => {
    const found = await getModelById(firstModel.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(firstModel.id);
    expect(found!.name).toBe(firstModel.name);
    expect(found!.brand).toBe(firstModel.brand);
    expect(found!.variants.length).toBe(firstModel.variants.length);
  });

  it("returns the same reference on repeated calls (index reuse)", async () => {
    const a = await getModelById(firstModel.id);
    const b = await getModelById(firstModel.id);
    expect(a).toBe(b); // same object reference — index is working
  });

  it("returns undefined for a non-existent model ID", async () => {
    const result = await getModelById("non-existent-model-id-12345");
    expect(result).toBeUndefined();
  });

  it("every model in the catalog is findable by ID", async () => {
    for (const m of catalog) {
      const found = await getModelById(m.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(m.id);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. findVariantById — existing variant ID
// ---------------------------------------------------------------------------

describe("findVariantById — indexed lookup", () => {
  it("returns the correct variant for an existing ID", async () => {
    const found = await findVariantById(firstVariant.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(firstVariant.id);
    expect(found!.name).toBe(firstVariant.name);
    expect(found!.specs.cpu).toBe(firstVariant.specs.cpu);
  });

  it("returns enriched specs (MODEL_BASE_SPECS merged)", async () => {
    const found = await findVariantById(firstVariant.id);
    expect(found).toBeDefined();
    // enriched specs should have all required fields populated
    expect(found!.specs.ram).toBe(firstVariant.specs.ram);
    expect(found!.specs.storage).toBe(firstVariant.specs.storage);
  });

  it("returns undefined for a non-existent variant ID", async () => {
    const result = await findVariantById("non-existent-variant-id-12345");
    expect(result).toBeUndefined();
  });

  it("every variant in the catalog is findable by ID", async () => {
    for (const m of catalog) {
      for (const v of m.variants) {
        const found = await findVariantById(v.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(v.id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. findModelByVariantId — variant→parent model
// ---------------------------------------------------------------------------

describe("findModelByVariantId — indexed lookup", () => {
  it("returns the parent model for a known variant ID", async () => {
    const parent = await findModelByVariantId(firstVariant.id);
    expect(parent).toBeDefined();
    expect(parent!.id).toBe(firstModel.id);
    expect(parent!.variants.some((v) => v.id === firstVariant.id)).toBe(true);
  });

  it("returns undefined for a non-existent variant ID", async () => {
    const result = await findModelByVariantId("non-existent-variant-id-12345");
    expect(result).toBeUndefined();
  });

  it("every variant maps to the correct parent model", async () => {
    for (const m of catalog) {
      for (const v of m.variants) {
        const parent = await findModelByVariantId(v.id);
        expect(parent).toBeDefined();
        expect(parent!.id).toBe(m.id);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Index invalidation
// ---------------------------------------------------------------------------

describe("Index lifecycle", () => {
  it("indexes are cleared when invalidateCache() is called", async () => {
    // Build indexes by doing a lookup
    await getModelById(firstModel.id);

    // Invalidate
    invalidateCache();

    // Next lookup should rebuild indexes (no error, correct result)
    const found = await getModelById(firstModel.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(firstModel.id);
  });

  it("indexes return correct results after cache invalidation", async () => {
    // Build indexes
    await getModelById(firstModel.id);
    await findVariantById(firstVariant.id);

    // Invalidate
    invalidateCache();

    // All lookups should still work
    const model = await getModelById(firstModel.id);
    expect(model).toBeDefined();
    expect(model!.id).toBe(firstModel.id);

    const variant = await findVariantById(firstVariant.id);
    expect(variant).toBeDefined();
    expect(variant!.id).toBe(firstVariant.id);

    const parent = await findModelByVariantId(firstVariant.id);
    expect(parent).toBeDefined();
    expect(parent!.id).toBe(firstModel.id);
  });

  it("new catalog snapshot triggers index rebuild", async () => {
    // First call builds indexes
    const a = await getModelById(firstModel.id);
    expect(a).toBeDefined();

    // Invalidate + rebuild
    invalidateCache();
    const b = await getModelById(firstModel.id);
    expect(b).toBeDefined();
    expect(b!.id).toBe(firstModel.id);

    // The references should be from the same catalog snapshot
    const allAfter = await getAllModels();
    expect(b).toBe(allAfter.find((m) => m.id === firstModel.id));
  });
});

// ---------------------------------------------------------------------------
// 5. Behavior equivalence (regression)
// ---------------------------------------------------------------------------

describe("Behavior equivalence — indexed vs expected", () => {
  it("getModelById returns same result as manual catalog find", async () => {
    const indexed = await getModelById(firstModel.id);
    const manual = (await getAllModels()).find((m) => m.id === firstModel.id);
    expect(indexed).toBe(manual);
  });

  it("findVariantById returns enriched variant matching manual enrichment", async () => {
    const indexed = await findVariantById(firstVariant.id);
    expect(indexed).toBeDefined();
    // The indexed result should have the same variant data
    expect(indexed!.id).toBe(firstVariant.id);
    expect(indexed!.specs.cpu).toBe(firstVariant.specs.cpu);
    expect(indexed!.specs.ram).toBe(firstVariant.specs.ram);
    expect(indexed!.specs.storage).toBe(firstVariant.specs.storage);
  });

  it("findModelByVariantId returns the model that contains the variant", async () => {
    const parent = await findModelByVariantId(firstVariant.id);
    expect(parent).toBeDefined();
    expect(parent!.variants.some((v) => v.id === firstVariant.id)).toBe(true);
  });

  it("empty string ID returns undefined for all lookups", async () => {
    expect(await getModelById("")).toBeUndefined();
    expect(await findVariantById("")).toBeUndefined();
    expect(await findModelByVariantId("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Performance baseline (informational)
// ---------------------------------------------------------------------------

describe("Performance — indexed lookup", () => {
  it("single model lookup completes within reasonable time", async () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await getModelById(firstModel.id);
    }
    const elapsed = performance.now() - start;
    // 1000 lookups should complete well under 100ms with indexes
    expect(elapsed).toBeLessThan(100);
  });

  it("single variant lookup completes within reasonable time", async () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await findVariantById(firstVariant.id);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("variant→model lookup completes within reasonable time", async () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      await findModelByVariantId(firstVariant.id);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
