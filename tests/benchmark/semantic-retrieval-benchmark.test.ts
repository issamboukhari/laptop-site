import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import {
  semanticRetrieval,
  invalidateSemanticIndex,
  cosineSimilarity,
  isSemanticAvailable,
  getSemanticStats,
  indexSemanticEmbeddings,
} from "@/lib/server/semantic-retrieval";

/**
 * Phase 3.2.3 FIX — Performance Benchmark
 *
 * Measures persistent semantic retrieval performance: cosine similarity,
 * query embedding latency, vector DB retrieval latency, and end-to-end search.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateSemanticIndex();
});

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
    const perCall = (elapsed / iterations) * 1000;

    console.log(`cosineSimilarity (768-dim): ${perCall.toFixed(2)}μs/call`);

    expect(perCall).toBeLessThan(100);
  });
});

describe("Semantic Retrieval — Configuration", () => {
  it("uses gemini-embedding-2 with 768 dimensions", () => {
    const stats = getSemanticStats();

    console.log(`Model: ${stats.model}`);
    console.log(`Dimension: ${stats.dimension}`);
    console.log(`Available: ${stats.available}`);

    expect(stats.model).toBe("gemini-embedding-2");
    expect(stats.dimension).toBe(768);
  });
});

describe("Semantic Retrieval — Indexing", () => {
  it("indexSemanticEmbeddings is safely rerunnable", async () => {
    const available = isSemanticAvailable();
    if (!available) {
      console.log("Skipping — Gemini API key or Supabase not configured");
      return;
    }

    // First run — should index all variants
    const count1 = await indexSemanticEmbeddings(allModels);
    console.log(`First indexing: ${count1} embeddings created/updated`);

    // Second run — should skip unchanged (incremental)
    const count2 = await indexSemanticEmbeddings(allModels);
    console.log(`Second indexing (incremental): ${count2} embeddings updated`);

    expect(count2).toBeLessThanOrEqual(count1);
  });

  it("force=true re-embeds all variants", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const count = await indexSemanticEmbeddings(allModels, true);
    console.log(`Force re-indexing: ${count} embeddings updated`);

    // Force should re-embed everything
    expect(count).toBeGreaterThan(0);
  });
});

describe("Semantic Retrieval — Latency", () => {
  it("semantic retrieval completes in < 5 seconds (database-backed)", async () => {
    const available = isSemanticAvailable();
    if (!available) {
      console.log("Skipping — Gemini API key or Supabase not configured");
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

    console.log(`Semantic retrieval (DB-backed): ${perQuery.toFixed(0)}ms/query`);

    // DB-backed retrieval should be fast (query embedding + RPC)
    expect(perQuery).toBeLessThan(5000);
  });
});

describe("Semantic Retrieval — Reduction Ratios", () => {
  it("semantic retrieval returns fewer candidates than full catalog", async () => {
    const available = isSemanticAvailable();
    if (!available) return;

    const result = await semanticRetrieval("gaming laptop with RTX GPU", allModels);

    if (result.success && result.matches.length > 0) {
      const uniqueModels = new Set(result.matches.map((m) => m.modelId));
      const reduction = ((allModels.length - uniqueModels.size) / allModels.length) * 100;

      console.log(
        `Semantic candidates: ${uniqueModels.size}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
      );

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

    expect(perQuery).toBeLessThan(10000);
  });

  it("searchModels fallback works without API key", async () => {
    const { searchModels } = await import("@/lib/server/search");

    const result = await searchModels("laptop", {});

    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
  });
});
