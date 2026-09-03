import { describe, it, expect } from "vitest";
import { computerModels, findModelById, findModelByVariantId, findVariantById, getAllVariants } from "@/lib/data/computers";

/**
 * Data Integrity Tests
 *
 * These validate the structural integrity of the bundled catalog.
 * They do NOT modify data — they only observe and report issues.
 *
 * If a test fails, it indicates a real data problem that must be
 * investigated before any further development.
 */

const VALID_CATEGORIES = new Set([
  "gaming-laptop",
  "business-laptop",
  "ultrabook",
  "macbook",
  "workstation",
  "desktop",
  "mini-pc",
]);

describe("Data Integrity — Catalog Structure", () => {
  it("computerModels is a non-empty array", () => {
    expect(Array.isArray(computerModels)).toBe(true);
    expect(computerModels.length).toBeGreaterThan(0);
  });

  it("every model has a non-empty id", () => {
    const bad = computerModels.filter((m) => !m.id || typeof m.id !== "string");
    expect(bad).toEqual([]);
  });

  it("every model has a non-empty name", () => {
    const bad = computerModels.filter((m) => !m.name || typeof m.name !== "string");
    expect(bad).toEqual([]);
  });

  it("every model has a non-empty brand", () => {
    const bad = computerModels.filter((m) => !m.brand || typeof m.brand !== "string");
    expect(bad).toEqual([]);
  });

  it("every model has a valid category", () => {
    const bad = computerModels.filter((m) => !VALID_CATEGORIES.has(m.category));
    expect(bad.map((m) => ({ id: m.id, category: m.category }))).toEqual([]);
  });

  it("every model has a positive year", () => {
    const bad = computerModels.filter((m) => !m.year || m.year < 2000 || m.year > 2100);
    expect(bad.map((m) => ({ id: m.id, year: m.year }))).toEqual([]);
  });

  it("every model has at least one variant", () => {
    const bad = computerModels.filter((m) => !Array.isArray(m.variants) || m.variants.length === 0);
    expect(bad.map((m) => m.id)).toEqual([]);
  });
});

describe("Data Integrity — Model ID Uniqueness", () => {
  it("all model IDs are unique", () => {
    const ids = computerModels.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("Data Integrity — Variant Structure", () => {
  const allVariants = computerModels.flatMap((m) =>
    m.variants.map((v) => ({ ...v, modelId: m.id, modelName: m.name }))
  );

  it("all variant IDs are unique", () => {
    const ids = allVariants.map((v) => v.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every variant has a non-empty id", () => {
    const bad = allVariants.filter((v) => !v.id || typeof v.id !== "string");
    expect(bad.map((v) => ({ id: v.id, model: v.modelName }))).toEqual([]);
  });

  it("every variant has a non-empty name", () => {
    const bad = allVariants.filter((v) => !v.name || typeof v.name !== "string");
    expect(bad.map((v) => ({ id: v.id, model: v.modelName }))).toEqual([]);
  });

  it("every variant has a valid category", () => {
    const bad = allVariants.filter((v) => !VALID_CATEGORIES.has(v.category));
    expect(bad.map((v) => ({ id: v.id, category: v.category }))).toEqual([]);
  });

  it("every variant has a positive price", () => {
    const bad = allVariants.filter((v) => typeof v.price !== "number" || v.price <= 0);
    expect(bad.map((v) => ({ id: v.id, price: v.price }))).toEqual([]);
  });
});

describe("Data Integrity — Spec Values", () => {
  const allVariants = computerModels.flatMap((m) =>
    m.variants.map((v) => ({ ...v, modelId: m.id, modelName: m.name }))
  );

  it("RAM is never negative", () => {
    const bad = allVariants.filter((v) => typeof v.specs.ram === "number" && v.specs.ram < 0);
    expect(bad.map((v) => ({ id: v.id, ram: v.specs.ram }))).toEqual([]);
  });

  it("RAM is never NaN", () => {
    const bad = allVariants.filter((v) => typeof v.specs.ram === "number" && Number.isNaN(v.specs.ram));
    expect(bad.map((v) => v.id)).toEqual([]);
  });

  it("storage is never negative", () => {
    const bad = allVariants.filter((v) => typeof v.specs.storage === "number" && v.specs.storage < 0);
    expect(bad.map((v) => ({ id: v.id, storage: v.specs.storage }))).toEqual([]);
  });

  it("storage is never NaN", () => {
    const bad = allVariants.filter((v) => typeof v.specs.storage === "number" && Number.isNaN(v.specs.storage));
    expect(bad.map((v) => v.id)).toEqual([]);
  });

  it("cpuScore is never NaN", () => {
    const bad = allVariants.filter((v) => typeof v.specs.cpuScore === "number" && Number.isNaN(v.specs.cpuScore));
    expect(bad.map((v) => v.id)).toEqual([]);
  });

  it("gpuScore is never NaN", () => {
    const bad = allVariants.filter((v) => typeof v.specs.gpuScore === "number" && Number.isNaN(v.specs.gpuScore));
    expect(bad.map((v) => v.id)).toEqual([]);
  });

  it("displayRefreshRate is never negative", () => {
    const bad = allVariants.filter(
      (v) => typeof v.specs.displayRefreshRate === "number" && v.specs.displayRefreshRate < 0
    );
    expect(bad.map((v) => ({ id: v.id, refresh: v.specs.displayRefreshRate }))).toEqual([]);
  });

  it("batteryLife is never negative", () => {
    const bad = allVariants.filter(
      (v) => typeof v.specs.batteryLife === "number" && v.specs.batteryLife < 0
    );
    expect(bad.map((v) => ({ id: v.id, battery: v.specs.batteryLife }))).toEqual([]);
  });

  it("weight is never negative", () => {
    const bad = allVariants.filter((v) => typeof v.specs.weight === "number" && v.specs.weight < 0);
    expect(bad.map((v) => ({ id: v.id, weight: v.specs.weight }))).toEqual([]);
  });

  it("no Infinity values in numeric spec fields", () => {
    const numericFields = ["ram", "storage", "cpuScore", "gpuScore", "displayRefreshRate", "batteryLife", "weight", "price"] as const;
    const bad: { id: string; field: string; value: number }[] = [];
    for (const v of allVariants) {
      for (const field of numericFields) {
        const val = field === "price" ? v.price : v.specs[field];
        if (typeof val === "number" && !Number.isFinite(val)) {
          bad.push({ id: v.id, field, value: val });
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("Data Integrity — Lookup Functions", () => {
  it("findModelById returns undefined for non-existent ID", () => {
    expect(findModelById("non-existent-id-12345")).toBeUndefined();
  });

  it("findModelByVariantId returns undefined for non-existent variant ID", () => {
    expect(findModelByVariantId("non-existent-variant-12345")).toBeUndefined();
  });

  it("findVariantById returns undefined for non-existent variant ID", () => {
    expect(findVariantById("non-existent-variant-12345")).toBeUndefined();
  });

  it("findModelById returns the correct model for every model ID", () => {
    for (const model of computerModels) {
      const found = findModelById(model.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(model.id);
    }
  });

  it("findVariantById returns the correct variant for every variant ID", () => {
    for (const model of computerModels) {
      for (const variant of model.variants) {
        const found = findVariantById(variant.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(variant.id);
      }
    }
  });

  it("findModelByVariantId returns the parent model for every variant", () => {
    for (const model of computerModels) {
      for (const variant of model.variants) {
        const found = findModelByVariantId(variant.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(model.id);
      }
    }
  });

  it("getAllVariants returns a flat array of all variants", () => {
    const all = getAllVariants();
    const expectedCount = computerModels.reduce((sum, m) => sum + m.variants.length, 0);
    expect(all.length).toBe(expectedCount);
  });
});
