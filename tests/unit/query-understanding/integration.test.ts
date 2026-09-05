import { describe, it, expect, beforeAll } from "vitest";
import { searchModels } from "@/lib/server/search";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import { hardRequirementsToFilters, understoodQueryToFilters } from "@/lib/server/query-to-filters";
import { SearchFilters } from "@/lib/data/types";

/**
 * Phase 3.2.1 — Query Understanding Integration Tests
 *
 * Verifies that understandQuery() results are correctly translated into
 * SearchFilters and applied through the existing variant-matcher pipeline.
 *
 * The existing search engine remains the source of truth for catalog matches.
 * Query Understanding only provides structured interpretation of the query.
 */

beforeAll(async () => {
  await getAllModels();
});

// =========================================================================
// A. Explicit hardware — "16GB RAM RTX 4060"
// =========================================================================

describe("A. Explicit hardware — query understanding + search", () => {
  it("understandQuery extracts RAM and GPU constraints", () => {
    const parsed = understandQuery("16GB RAM RTX 4060");
    expect(parsed.hardRequirements.minRam).toBe(16);
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
    expect(parsed.hardRequirements.gpuTerms!.length).toBeGreaterThan(0);
    expect(parsed.hardRequirements.gpuTerms!.some((g) => g.includes("rtx") && g.includes("4060"))).toBe(true);
  });

  it("adapter translates RAM constraint to SearchFilters", () => {
    const parsed = understandQuery("16GB RAM RTX 4060");
    const filters = hardRequirementsToFilters(parsed.hardRequirements);
    expect(filters.minRam).toBe(16);
    // GPU terms are NOT in SearchFilters — handled by extractSpecCriteria
  });

  it("search returns real catalog models with matching specs", async () => {
    const result = await searchModels("16GB RAM RTX 4060", {});
    expect(result.models.length).toBeGreaterThan(0);
    // Every returned model must have at least one variant with 16GB RAM and RTX 4060
    for (const m of result.models) {
      const hasMatch = m.variants.some(
        (v) =>
          v.specs.ram === 16 &&
          v.specs.gpu.toLowerCase().includes("rtx") &&
          v.specs.gpu.toLowerCase().includes("4060")
      );
      expect(hasMatch).toBe(true);
    }
  });

  it("variant constraints remain same-variant (no cross-variant combining)", async () => {
    const result = await searchModels("16GB RAM RTX 4060", {});
    for (const m of result.models) {
      // No model should have ONLY a 16GB variant with different GPU
      // and ONLY an RTX 4060 variant with different RAM
      const has16gb4060 = m.variants.some(
        (v) => v.specs.ram === 16 && v.specs.gpu.toLowerCase().includes("rtx 4060")
      );
      // If the model appears, at least one variant must match BOTH
      expect(has16gb4060).toBe(true);
    }
  });
});

// =========================================================================
// B. Storage — "1TB SSD" is NOT interpreted as RAM
// =========================================================================

describe("B. Storage — no RAM/storage cross-contamination", () => {
  it("1TB SSD sets storage, not RAM", () => {
    const parsed = understandQuery("1TB SSD laptop");
    expect(parsed.hardRequirements.minStorage).toBe(1024);
    expect(parsed.hardRequirements.minRam).toBeUndefined();
  });

  it("search with 1TB SSD returns models with 1TB storage", async () => {
    const result = await searchModels("1TB SSD", {});
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      const has1tb = m.variants.some((v) => v.specs.storage === 1024);
      expect(has1tb).toBe(true);
    }
  });

  it("'16GB RAM' does not set storage", () => {
    const parsed = understandQuery("16GB RAM laptop");
    expect(parsed.hardRequirements.minRam).toBe(16);
    expect(parsed.hardRequirements.minStorage).toBeUndefined();
  });
});

// =========================================================================
// C. Recommendation — "أفضل لابتوب للبرمجة"
// =========================================================================

describe("C. Recommendation intent — no fabricated requirements", () => {
  it("detects recommendation intent", () => {
    const parsed = understandQuery("أفضل لابتوب للبرمجة");
    expect(parsed.intent).toBe("recommendation");
  });

  it("detects programming use case", () => {
    const parsed = understandQuery("أفضل لابتوب للبرمجة");
    expect(parsed.useCases).toContain("programming");
  });

  it("does NOT fabricate hardware requirements from recommendation", () => {
    const parsed = understandQuery("أفضل لابتوب للبرمجة");
    // "best laptop for programming" should NOT automatically require RTX 4060 or 32GB
    // The query understanding only extracts what was explicitly stated
    expect(parsed.hardRequirements.gpuTerms).toBeUndefined();
    // RAM may be extracted if explicitly mentioned, but not from "programming" alone
  });

  it("search returns actual catalog results for Arabic recommendation", async () => {
    const result = await searchModels("أفضل لابتوب للبرمجة", {});
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
    // Should return some results (or empty if no match — but NOT invented computers)
  });

  it("English recommendation also works", async () => {
    const result = await searchModels("best laptop for programming", {});
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
  });
});

// =========================================================================
// D. Ambiguous query — "16"
// =========================================================================

describe("D. Ambiguous query — safe behavior", () => {
  it("understandQuery returns low confidence for '16'", () => {
    const parsed = understandQuery("16");
    expect(parsed.confidence).toBe("low");
    expect(parsed.intent).toBe("unknown");
  });

  it("search does not crash on ambiguous query", async () => {
    const result = await searchModels("16", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
  });

  it("no aggressive interpretation of bare number", () => {
    const parsed = understandQuery("16");
    // Bare "16" should not become minRam=16 via query understanding
    // (the token-based extraction handles this separately)
    expect(parsed.hardRequirements.minRam).toBeUndefined();
    expect(parsed.hardRequirements.minStorage).toBeUndefined();
  });
});

// =========================================================================
// E. Arabic hardware query — "لابتوب 16 رام RTX 4060"
// =========================================================================

describe("E. Arabic hardware query", () => {
  it("extracts RAM from Arabic '16 رام'", () => {
    const parsed = understandQuery("لابتوب 16 رام RTX 4060");
    expect(parsed.hardRequirements.minRam).toBe(16);
  });

  it("extracts GPU from mixed Arabic/English", () => {
    const parsed = understandQuery("لابتوب 16 رام RTX 4060");
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
    expect(parsed.hardRequirements.gpuTerms!.some((g) => g.includes("4060"))).toBe(true);
  });

  it("search returns real models for Arabic query", async () => {
    const result = await searchModels("لابتوب 16 رام RTX 4060", {});
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// F. English hardware query — "laptop 16GB RAM RTX 4060"
// =========================================================================

describe("F. English hardware query", () => {
  it("extracts RAM and GPU", () => {
    const parsed = understandQuery("laptop 16GB RAM RTX 4060");
    expect(parsed.hardRequirements.minRam).toBe(16);
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
  });

  it("search returns real models", async () => {
    const result = await searchModels("laptop 16GB RAM RTX 4060", {});
    expect(result.models.length).toBeGreaterThan(0);
  });
});

// =========================================================================
// G. Mixed language — "نحب laptop 16GB للبرمجة"
// =========================================================================

describe("G. Mixed Arabic/English query", () => {
  it("detects mixed language", () => {
    const parsed = understandQuery("نحب laptop 16GB للبرمجة");
    expect(parsed.language).toBe("mixed");
  });

  it("extracts RAM from mixed query", () => {
    const parsed = understandQuery("نحب laptop 16GB للبرمجة");
    expect(parsed.hardRequirements.minRam).toBe(16);
  });

  it("detects programming use case", () => {
    const parsed = understandQuery("نحب laptop 16GB للبرمجة");
    expect(parsed.useCases).toContain("programming");
  });

  it("search works for mixed language query", async () => {
    const result = await searchModels("نحب laptop 16GB للبرمجة", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });
});

// =========================================================================
// H. Comparison — "قارن ThinkPad و EliteBook"
// =========================================================================

describe("H. Comparison intent", () => {
  it("detects comparison intent", () => {
    const parsed = understandQuery("قارن ThinkPad و EliteBook");
    expect(parsed.intent).toBe("comparison");
  });

  it("English comparison also detected", () => {
    const parsed = understandQuery("compare ThinkPad vs EliteBook");
    expect(parsed.intent).toBe("comparison");
  });

  it("search returns results for comparison query", async () => {
    const result = await searchModels("قارن ThinkPad و EliteBook", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });
});

// =========================================================================
// I. Unknown intent — safe fallback
// =========================================================================

describe("I. Unknown intent — safe fallback", () => {
  it("single short token returns unknown intent", () => {
    const parsed = understandQuery("hi");
    expect(parsed.intent).toBe("unknown");
  });

  it("search does not crash on unknown intent", async () => {
    const result = await searchModels("hi", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
  });

  it("empty query returns empty results safely", async () => {
    const result = await searchModels("", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });
});

// =========================================================================
// J. No match — no invented computers
// =========================================================================

describe("J. No match — no invented computers", () => {
  it("nonexistent model returns empty results", async () => {
    const result = await searchModels("nonexistent-laptop-xyz99999", {});
    expect(result.models).toHaveLength(0);
  });

  it("impossible requirements return empty results", async () => {
    // No laptop has 999GB RAM
    const result = await searchModels("999GB RAM", {});
    expect(result.models).toHaveLength(0);
  });

  it("search never fabricates a computer", async () => {
    const result = await searchModels("quantum computer 1TB RAM RTX 9999", {});
    expect(result.models).toHaveLength(0);
    // No model should be returned — these specs don't exist
  });
});

// =========================================================================
// K. Explicit filters take precedence over query understanding
// =========================================================================

describe("K. Explicit filters override query understanding", () => {
  it("explicit minRam=32 overrides query-understood minRam=16", async () => {
    // Query says "16GB" but explicit filter says minRam=32
    const result = await searchModels("16GB RAM", { minRam: 32 });
    // All returned models should have at least 32GB RAM
    for (const m of result.models) {
      const hasMin32 = m.variants.some((v) => v.specs.ram >= 32);
      expect(hasMin32).toBe(true);
    }
  });

  it("explicit brand filter is preserved alongside query understanding", async () => {
    const result = await searchModels("16GB RAM", { brand: "Lenovo" });
    for (const m of result.models) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
    }
  });
});

// =========================================================================
// L. understandQuery is called inside searchModels (integration proof)
// =========================================================================

describe("L. Integration — understandQuery feeds into search", () => {
  it("Arabic RAM+GPU search returns same-variant matches", async () => {
    const result = await searchModels("لابتوب 16 رام RTX 4060", {});
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      const hasMatch = m.variants.some(
        (v) =>
          v.specs.ram === 16 &&
          v.specs.gpu.toLowerCase().includes("rtx") &&
          v.specs.gpu.toLowerCase().includes("4060")
      );
      expect(hasMatch).toBe(true);
    }
  });

  it("touchscreen requirement from query understanding is enforced", async () => {
    const parsed = understandQuery("laptop touchscreen 16GB");
    expect(parsed.hardRequirements.touchscreen).toBe(true);
    const result = await searchModels("laptop touchscreen 16GB", {});
    // All models with touchscreen requirement should have touchscreen variants
    for (const m of result.models) {
      const hasTouch = m.variants.some((v) => v.specs.touchscreen === true);
      expect(hasTouch).toBe(true);
    }
  });

  it("budget constraint is applied when present", async () => {
    const parsed = understandQuery("laptop under 150000 DZD");
    expect(parsed.budget).toBeDefined();
    expect(parsed.budget!.amount).toBe(150000);
    const filters = understoodQueryToFilters(parsed);
    // Budget maps to maxPrice (currency is certain for DZD)
    expect(filters.maxPrice).toBe(150000);
  });
});

// =========================================================================
// M. Performance — query understanding overhead
// =========================================================================

describe("M. Query understanding overhead", () => {
  it("understandQuery is synchronous and fast", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      understandQuery("laptop 16GB RAM RTX 4060 for gaming under 1000 USD");
    }
    const elapsed = performance.now() - start;
    // 1000 iterations should complete in < 500ms (sub-microsecond each)
    expect(elapsed).toBeLessThan(500);
  });

  it("searchModels with query understanding completes in reasonable time", async () => {
    const start = performance.now();
    await searchModels("laptop 16GB RAM RTX 4060", {});
    const elapsed = performance.now() - start;
    // Should complete within 5 seconds (including index build on first call)
    expect(elapsed).toBeLessThan(5000);
  });
});
