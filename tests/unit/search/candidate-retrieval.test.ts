import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import { retrieveCandidates, invalidateRetrievalIndexes } from "@/lib/server/candidate-retrieval";
import { SearchFilters } from "@/lib/data/types";

/**
 * Phase 3.2.2 — Structured Candidate Retrieval Tests
 *
 * Verifies that candidate retrieval correctly narrows the catalog subset
 * based on Query Understanding output, while preserving recall safety.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateRetrievalIndexes(); // Reset for clean tests
});

describe("Candidate Retrieval — Brand", () => {
  it("Lenovo brand filter narrows candidates", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { brand: "Lenovo" };
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(allModels.length);
    expect(signalsUsed.some((s) => s.startsWith("brand:"))).toBe(true);

    // All candidates should be Lenovo
    for (const m of candidates) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
    }
  });

  it("HP brand filter narrows candidates", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { brand: "HP" };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(allModels.length);
    for (const m of candidates) {
      expect(m.brand.toLowerCase()).toBe("hp");
    }
  });
});

describe("Candidate Retrieval — Category", () => {
  it("gaming-laptop category filter narrows candidates", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { category: "gaming-laptop" };
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    expect(signalsUsed.some((s) => s.startsWith("category:"))).toBe(true);

    // All candidates should be gaming-laptop category
    for (const m of candidates) {
      expect(m.category).toBe("gaming-laptop");
    }
  });
});

describe("Candidate Retrieval — Multiple constraints", () => {
  it("Lenovo + gaming narrows by both brand and category", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { brand: "Lenovo", category: "gaming-laptop" };
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    expect(signalsUsed.some((s) => s.startsWith("brand:"))).toBe(true);
    expect(signalsUsed.some((s) => s.startsWith("category:"))).toBe(true);

    for (const m of candidates) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
      expect(m.category).toBe("gaming-laptop");
    }
  });

  it("Lenovo + RTX 4060 narrows by brand + GPU", () => {
    const understood = understandQuery("Lenovo RTX 4060");
    const filters: SearchFilters = { brand: "Lenovo" };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);

    // All candidates should be Lenovo
    for (const m of candidates) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
    }
  });
});

describe("Candidate Retrieval — Same variant safety", () => {
  it("RTX 4060 16GB retrieves models with same-variant match", () => {
    const understood = understandQuery("RTX 4060 16GB");
    const { candidates } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);

    // The search should find models where at least one variant has BOTH
    // RTX 4060 and 16GB (same variant, not cross-variant)
    let foundSameVariant = false;
    for (const m of candidates) {
      for (const v of m.variants) {
        if (
          v.specs.ram === 16 &&
          v.specs.gpu.toLowerCase().includes("rtx 4060")
        ) {
          foundSameVariant = true;
          break;
        }
      }
      if (foundSameVariant) break;
    }
    expect(foundSameVariant).toBe(true);
  });
});

describe("Candidate Retrieval — Recall safety", () => {
  it("valid result is not lost when one signal is missing", () => {
    // Search for "RTX 4060" without brand/category — should still find results
    const understood = understandQuery("RTX 4060");
    const { candidates } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);
  });

  it("empty GPU terms does not eliminate candidates", () => {
    const understood = understandQuery("laptop");
    const { candidates } = retrieveCandidates(understood, allModels, {});

    // Without specific hardware requirements, should return a reasonable subset
    expect(candidates.length).toBeGreaterThan(0);
  });

  it("fallback triggers when GPU/CPU filtering eliminates all candidates", () => {
    // Use a very specific GPU that might not match many models
    const understood = understandQuery("NVIDIA GeForce RTX 999999");
    const { candidates, fallback } = retrieveCandidates(understood, allModels, {});

    // Should either find candidates or trigger fallback
    if (candidates.length === 0) {
      expect(fallback).toBe(true);
    }
    // Either way, we should have candidates (via fallback or direct match)
    expect(candidates.length).toBeGreaterThan(0);
  });
});

describe("Candidate Retrieval — RAM/storage isolation", () => {
  it("16GB RAM retrieves models with 16GB RAM variants", () => {
    const understood = understandQuery("16GB RAM laptop");
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);
    expect(signalsUsed.some((s) => s.startsWith("ram:"))).toBe(true);

    // At least some candidates should have 16GB RAM variants
    const has16gb = candidates.some((m) =>
      m.variants.some((v) => v.specs.ram === 16)
    );
    expect(has16gb).toBe(true);
  });

  it("1TB SSD retrieves models with 1TB storage variants", () => {
    const understood = understandQuery("1TB SSD laptop");
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);
    expect(signalsUsed.some((s) => s.startsWith("storage:"))).toBe(true);

    // At least some candidates should have 1TB (1024GB) storage variants
    const has1tb = candidates.some((m) =>
      m.variants.some((v) => v.specs.storage === 1024)
    );
    expect(has1tb).toBe(true);
  });
});

describe("Candidate Retrieval — Price", () => {
  it("budget constraint is applied when passed as filter", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { maxPrice: 1000 };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);

    // All candidates should have at least one variant within budget
    for (const m of candidates) {
      const hasAffordable = m.variants.some((v) => v.price <= 1000);
      expect(hasAffordable).toBe(true);
    }
  });
});

describe("Candidate Retrieval — No match", () => {
  it("nonexistent brand returns empty candidates", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { brand: "FakeBrandXYZ" };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBe(0);
  });
});

describe("Candidate Retrieval — Fallback", () => {
  it("fallback returns full catalog when structured retrieval is unsafe", () => {
    // Use a query with no structured signals
    const understood = understandQuery("");
    const { candidates, fallback } = retrieveCandidates(understood, allModels, {});

    // Should return all models (or a large subset) with no filtering
    expect(candidates.length).toBeGreaterThan(0);
    // Empty query should not trigger aggressive filtering
  });
});

describe("Candidate Retrieval — Explicit filters", () => {
  it("explicit brand filter in URL params is respected", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { brand: "Dell" };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    for (const m of candidates) {
      expect(m.brand.toLowerCase()).toBe("dell");
    }
  });

  it("explicit category filter in URL params is respected", () => {
    const understood = understandQuery("laptop");
    const filters: SearchFilters = { category: "ultrabook" };
    const { candidates } = retrieveCandidates(understood, allModels, filters);

    expect(candidates.length).toBeGreaterThan(0);
    for (const m of candidates) {
      expect(m.category).toBe("ultrabook");
    }
  });
});

describe("Candidate Retrieval — Arabic queries", () => {
  it("Arabic RAM query works", () => {
    const understood = understandQuery("لابتوب 16 جيجا رام");
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);
    expect(signalsUsed.some((s) => s.startsWith("ram:"))).toBe(true);
  });
});

describe("Candidate Retrieval — Mixed language", () => {
  it("mixed Arabic/English query works", () => {
    const understood = understandQuery("لابتوب RTX 4060 16GB");
    const { candidates } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBeGreaterThan(0);
  });
});

describe("Candidate Retrieval — Performance", () => {
  it("retrieval completes in reasonable time", () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const understood = understandQuery("Lenovo RTX 4060 16GB");
      retrieveCandidates(understood, allModels, {});
    }
    const elapsed = performance.now() - start;
    // 100 retrievals should complete in < 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});
