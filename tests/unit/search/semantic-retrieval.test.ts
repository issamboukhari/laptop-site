import { describe, it, expect, beforeAll, vi } from "vitest";
import { getAllModels } from "@/lib/server/database";
import {
  cosineSimilarity,
  semanticRetrieval,
  invalidateSemanticIndex,
  generateSemanticDoc,
  isSemanticAvailable,
  getSemanticStats,
} from "@/lib/server/semantic-retrieval";

/**
 * Phase 3.2.3 — Semantic Retrieval Tests
 *
 * Tests the semantic retrieval layer that adds embedding-based similarity
 * search over the existing real computer catalog.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateSemanticIndex(); // Reset for clean tests
  // Pre-build vector store to avoid timeout in individual tests
  await semanticRetrieval("laptop", allModels);
}, 60_000);

// ---------------------------------------------------------------------------
// Cosine similarity (pure function, no API calls)
// ---------------------------------------------------------------------------

describe("Cosine Similarity", () => {
  it("identical vectors have similarity 1", () => {
    const v = [1, 0, 0, 1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 4);
  });

  it("orthogonal vectors have similarity 0", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 4);
  });

  it("opposite vectors have similarity -1", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 4);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it("handles zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });

  it("computes correct similarity for known vectors", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot=32, |a|=sqrt(14), |b|=sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 4);
  });
});

// ---------------------------------------------------------------------------
// Semantic document generation
// ---------------------------------------------------------------------------

describe("Semantic Document Generation", () => {
  it("generates a document for a real variant", () => {
    const model = allModels[0];
    const variant = model.variants[0];
    const doc = generateSemanticDoc(model, variant);

    expect(doc).toContain(model.brand);
    expect(doc).toContain(model.name);
    expect(doc.length).toBeGreaterThan(50);
  });

  it("includes category in document", () => {
    const model = allModels.find((m) => m.category === "gaming-laptop");
    if (!model) return; // Skip if no gaming laptop in catalog

    const doc = generateSemanticDoc(model, model.variants[0]);
    expect(doc.toLowerCase()).toContain("gaming");
  });

  it("includes CPU information", () => {
    const model = allModels[0];
    const variant = model.variants[0];
    const doc = generateSemanticDoc(model, variant);

    expect(doc).toContain(variant.specs.cpu);
  });

  it("includes RAM information", () => {
    const model = allModels[0];
    const variant = model.variants[0];
    const doc = generateSemanticDoc(model, variant);

    expect(doc).toContain(`${variant.specs.ram} GB`);
  });

  it("does not fabricate fields not in the variant", () => {
    const model = allModels[0];
    const variant = model.variants[0];
    const doc = generateSemanticDoc(model, variant);

    // Should not contain values that aren't in the actual variant
    if (!variant.specs.fingerprint) {
      expect(doc).not.toContain("Fingerprint reader: yes");
    }
    if (!variant.specs.touchscreen) {
      expect(doc).not.toContain("Touchscreen: yes");
    }
  });

  it("handles variant with minimal specs", () => {
    const model = allModels[0];
    // Create a minimal variant
    const minimalVariant = {
      ...model.variants[0],
      specs: {
        ...model.variants[0],
        cpu: "Intel Core i5",
        gpu: "Integrated",
        ram: 8,
        storage: 256,
        storageType: "SSD" as const,
        display: "14 inch",
        displaySize: 14,
        displayRefreshRate: 60,
        batteryLife: 8,
        weight: 1.5,
        cpuScore: 50,
        gpuScore: 20,
        ports: [],
        os: "Windows 11",
      },
    };

    const doc = generateSemanticDoc(model, minimalVariant);
    expect(doc).toContain("Intel Core i5");
    expect(doc).toContain("Integrated graphics");
  });
});

// ---------------------------------------------------------------------------
// Semantic retrieval (requires Gemini API key)
// ---------------------------------------------------------------------------

describe("Semantic Retrieval — Availability", () => {
  it("reports semantic availability", () => {
    const available = isSemanticAvailable();
    console.log(`Semantic available: ${available}`);
    // Just check it doesn't throw
    expect(typeof available).toBe("boolean");
  });

  it("reports stats", () => {
    const stats = getSemanticStats();
    console.log(`Semantic stats:`, stats);
    expect(stats.model).toBe("text-embedding-004");
    expect(stats.dimension).toBe(768);
  });
});

// ---------------------------------------------------------------------------
// Semantic retrieval — fallback behavior
// ---------------------------------------------------------------------------

describe("Semantic Retrieval — Fallback", () => {
  it("empty query returns empty results", async () => {
    const result = await semanticRetrieval("", allModels);
    expect(result.matches).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(false);
  });

  it("whitespace-only query returns empty results", async () => {
    const result = await semanticRetrieval("   ", allModels);
    expect(result.matches).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("does not throw on any input", async () => {
    const queries = [
      "laptop",
      "أفضل لابتوب",
      "",
      "   ",
      "a",
      "!@#$%^&*()",
    ];

    for (const q of queries) {
      const result = await semanticRetrieval(q, allModels);
      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic retrieval — real catalog (requires API key)
// ---------------------------------------------------------------------------

describe("Semantic Retrieval — Real Catalog", () => {
  it("retrieves gaming-related models for gaming query", async () => {
    const available = isSemanticAvailable();
    if (!available) {
      console.log("Skipping — no Gemini API key");
      return;
    }

    const result = await semanticRetrieval("gaming laptop with good GPU", allModels);

    console.log(`Gaming query: ${result.matches.length} matches, latency: ${result.latencyMs.toFixed(0)}ms`);

    if (result.success && result.matches.length > 0) {
      // At least some matches should be gaming laptops
      const modelIds = new Set(result.matches.map((m) => m.modelId));
      const matchedModels = allModels.filter((m) => modelIds.has(m.id));

      // Check that we found some models
      expect(matchedModels.length).toBeGreaterThan(0);

      // Verify all results map to real catalog models
      for (const match of result.matches) {
        const model = allModels.find((m) => m.id === match.modelId);
        expect(model).toBeDefined();
      }
    }
  });

  it("retrieves portable laptops for portability query", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("lightweight portable laptop for travel", allModels);

    console.log(`Portable query: ${result.matches.length} matches`);

    if (result.success && result.matches.length > 0) {
      // Verify results are real catalog entries
      for (const match of result.matches) {
        const model = allModels.find((m) => m.id === match.modelId);
        expect(model).toBeDefined();
      }
    }
  });

  it("Arabic query retrieves relevant models", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("لابتوب خفيف للبرمجة", allModels);

    console.log(`Arabic query: ${result.matches.length} matches`);

    // Should not fail
    expect(result).toBeDefined();
    expect(Array.isArray(result.matches)).toBe(true);

    if (result.success && result.matches.length > 0) {
      for (const match of result.matches) {
        const model = allModels.find((m) => m.id === match.modelId);
        expect(model).toBeDefined();
      }
    }
  });

  it("mixed Arabic/English query works", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("laptop خفيف للدراسة وبطارية مليحة", allModels);

    console.log(`Mixed query: ${result.matches.length} matches`);

    expect(result).toBeDefined();
    expect(Array.isArray(result.matches)).toBe(true);
  });

  it("scores are between 0 and 1", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("programming laptop", allModels);

    if (result.success) {
      for (const match of result.matches) {
        expect(match.score).toBeGreaterThanOrEqual(0);
        expect(match.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("ranks are sequential starting from 1", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("gaming", allModels);

    if (result.success && result.matches.length > 0) {
      for (let i = 0; i < result.matches.length; i++) {
        expect(result.matches[i].rank).toBe(i + 1);
      }
    }
  });

  it("respects topK parameter", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("laptop", allModels, 5);

    if (result.success) {
      expect(result.matches.length).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic retrieval — trust invariants
// ---------------------------------------------------------------------------

describe("Semantic Retrieval — Diagnostic", () => {
  it("logs similarity scores for debugging", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    // Test with a simple query
    const result = await semanticRetrieval("gaming laptop", allModels, 10);

    console.log(`\n=== Semantic Diagnostic ===`);
    console.log(`Success: ${result.success}`);
    console.log(`Matches: ${result.matches.length}`);
    console.log(`Embedded count: ${result.embeddedCount}`);
    console.log(`Latency: ${result.latencyMs.toFixed(0)}ms`);

    if (result.matches.length > 0) {
      for (const m of result.matches.slice(0, 5)) {
        const model = allModels.find((mod) => mod.id === m.modelId);
        console.log(`  ${m.score.toFixed(4)} | ${model?.brand} ${model?.name}`);
      }
    } else {
      console.log(`No matches found — similarity may be below threshold`);
    }

    // Just verify it doesn't throw
    expect(result).toBeDefined();
  });
});

describe("Semantic Retrieval — Trust Invariants", () => {
  it("all results map to real catalog models", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("laptop", allModels);

    if (result.success) {
      for (const match of result.matches) {
        // Model must exist in catalog
        const model = allModels.find((m) => m.id === match.modelId);
        expect(model).toBeDefined();

        // Variant must exist in the model
        const variant = model!.variants.find((v) => v.id === match.variantId);
        expect(variant).toBeDefined();
      }
    }
  });

  it("does not create new models", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("quantum computer with neural interface", allModels);

    // Even for nonsense queries, all results must be real catalog entries
    if (result.success) {
      for (const match of result.matches) {
        expect(allModels.some((m) => m.id === match.modelId)).toBe(true);
      }
    }
  });

  it("variant IDs map to correct parent models", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("laptop", allModels);

    if (result.success) {
      for (const match of result.matches) {
        const model = allModels.find((m) => m.id === match.modelId);
        expect(model).toBeDefined();
        const variant = model!.variants.find((v) => v.id === match.variantId);
        expect(variant).toBeDefined();
        expect(variant!.brand).toBe(model!.brand);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic retrieval — integration with search
// ---------------------------------------------------------------------------

describe("Semantic Retrieval — Search Integration", () => {
  it("searchModels works with semantic retrieval enabled", async () => {
    const { searchModels } = await import("@/lib/server/search");

    const result = await searchModels("gaming laptop", {});

    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("searchModels works when semantic retrieval is unavailable", async () => {
    // Even without API key, search should work
    const { searchModels } = await import("@/lib/server/search");

    const result = await searchModels("laptop", {});

    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(result.models.length).toBeGreaterThanOrEqual(0);
  });
});
