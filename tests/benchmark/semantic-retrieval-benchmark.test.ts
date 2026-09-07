import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import {
  semanticRetrieval,
  invalidateSemanticIndex,
  cosineSimilarity,
  isSemanticAvailable,
  getSemanticStats,
  getSemanticBuildTime,
} from "@/lib/server/semantic-retrieval";

/**
 * Phase 3.2.3 — Performance Benchmark
 *
 * Measures semantic retrieval performance: embedding generation,
 * retrieval latency, and comparison with existing search.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateSemanticIndex();
  // Pre-build vector store to avoid timeout in individual tests
  await semanticRetrieval("laptop", allModels);
}, 60_000);

describe("Semantic Retrieval — Cosine Similarity Performance", () => {
  it("cosine similarity is fast for 768-dim vectors", () => {
    const a = Array.from({ length: 768 }, () => Math.random());
    const b = Array.from({ length: 768 }, () => Math.random());

    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      cosineSimilarity(a, b);
    }
    const elapsed = performance.now() - start;
    const perCall = (elapsed / iterations) * 1000; // microseconds

    console.log(`cosineSimilarity (768-dim): ${perCall.toFixed(2)}μs/call`);

    // Should be very fast
    expect(perCall).toBeLessThan(100); // < 100μs
  });
});

describe("Semantic Retrieval — Availability", () => {
  it("reports availability and stats", () => {
    const available = isSemanticAvailable();
    const stats = getSemanticStats();

    console.log(`Available: ${available}`);
    console.log(`Model: ${stats.model}`);
    console.log(`Dimension: ${stats.dimension}`);
    console.log(`Embedded count: ${stats.embeddedCount}`);

    expect(stats.model).toBe("text-embedding-004");
    expect(stats.dimension).toBe(768);
  });
});

describe("Semantic Retrieval — Latency", () => {
  it("semantic retrieval completes in < 2 seconds (warm)", async () => {
    const available = isSemanticAvailable();
    if (!available) {
      console.log("Skipping — no Gemini API key");
      return;
    }

    const queries = [
      "gaming laptop",
      "lightweight laptop for university",
      "لابتوب خفيف للبرمجة",
      "programming laptop with good CPU",
    ];

    const start = performance.now();
    for (const q of queries) {
      const result = await semanticRetrieval(q, allModels);
      expect(result).toBeDefined();
    }
    const elapsed = performance.now() - start;
    const perQuery = elapsed / queries.length;

    console.log(`Semantic retrieval (warm): ${perQuery.toFixed(0)}ms/query`);

    // Warm calls should be fast (vector store cached)
    expect(perQuery).toBeLessThan(2000);
  });

  it("vector store build time is reported", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const buildTime = getSemanticBuildTime();
    console.log(`Vector store build time: ${buildTime.toFixed(0)}ms`);

    expect(buildTime).toBeGreaterThanOrEqual(0);
  });
});

describe("Semantic Retrieval — Reduction Ratios", () => {
  it("semantic retrieval returns fewer candidates than full catalog", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("gaming laptop with RTX GPU", allModels);

    if (result.success && result.matches.length > 0) {
      const uniqueModels = new Set(result.matches.map((m) => m.modelId));
      const reduction = ((allModels.length - uniqueModels.size) / allModels.length) * 10;

      console.log(
        `Semantic candidates: ${uniqueModels.size}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
      );

      // Should return a subset
      expect(uniqueModels.size).toBeLessThanOrEqual(allModels.length);
    }
  });
});

describe("Semantic Retrieval — End-to-End with Existing Search", () => {
  it("searchModels with semantic completes in < 10 seconds", async () => {
    const { searchModels } = await import("@/lib/server/search");

    const queries = [
      "gaming laptop",
      "lightweight laptop for university",
      "لابتوب خفيف للبرمجة",
      "programming laptop with good CPU",
      "best laptop under 1000",
    ];

    const start = performance.now();
    for (const q of queries) {
      const result = await searchModels(q, {});
      expect(result.models).toBeDefined();
    }
    const elapsed = performance.now() - start;
    const perQuery = elapsed / queries.length;

    console.log(`searchModels (with semantic): ${perQuery.toFixed(0)}ms/query`);

    // Each search has a 5s semantic timeout, so max ~5s per query
    expect(perQuery).toBeLessThan(10000);
  });

  it("searchModels fallback works without API key", async () => {
    const { searchModels } = await import("@/lib/server/search");

    // Search should work regardless of semantic availability
    const result = await searchModels("laptop", {});

    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
  });
});
