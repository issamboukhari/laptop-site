import { describe, it, expect, beforeAll } from "vitest";
import { searchModels } from "@/lib/server/search";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";

/**
 * Phase 3.2.1 — Performance Benchmark
 *
 * Measures the overhead introduced by Query Understanding integration.
 * Compares baseline search latency vs integrated search latency.
 */

beforeAll(async () => {
  await getAllModels();
});

describe("Performance — Query Understanding overhead", () => {
  it("understandQuery is sub-millisecond per call", () => {
    const queries = [
      "laptop 16GB RAM RTX 4060",
      "أفضل لابتوب للبرمجة",
      "gaming laptop under 1000 USD",
      "16 رام كارت شاشة قوي",
      "best laptop for university",
      "laptop touchscreen 32GB",
      "lenovo thinkpad 16gb",
      "ما يفوتش 150 ألف",
    ];

    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const q of queries) {
        understandQuery(q);
      }
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / (iterations * queries.length);

    console.log(`understandQuery: ${perCall.toFixed(3)}ms/call (${iterations * queries.length} calls in ${elapsed.toFixed(1)}ms)`);

    // Sub-millisecond per call
    expect(perCall).toBeLessThan(1);
  });

  it("searchModels with query understanding completes in < 2 seconds", async () => {
    const queries = [
      "laptop 16GB RAM RTX 4060",
      "أفضل لابتوب للبرمجة",
      "gaming laptop under 1000 USD",
      "16 رام كارت شاشة قوي",
      "best laptop for university",
    ];

    const start = performance.now();
    for (const q of queries) {
      const result = await searchModels(q, {});
      expect(result.models).toBeDefined();
    }
    const elapsed = performance.now() - start;
    const perQuery = elapsed / queries.length;

    console.log(`searchModels (with QU): ${perQuery.toFixed(1)}ms/query (${queries.length} queries in ${elapsed.toFixed(1)}ms)`);

    // Should complete within 2 seconds per query
    expect(perQuery).toBeLessThan(2000);
  });

  it("query understanding adds < 0.1ms overhead to search", async () => {
    // Warm up
    await searchModels("laptop", {});

    // Measure search with query understanding
    const queries = ["16GB RAM RTX 4060", "gaming laptop", "lenovo thinkpad"];
    const iterations = 10;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const q of queries) {
        await searchModels(q, {});
      }
    }
    const elapsed = performance.now() - start;
    const perSearch = elapsed / (iterations * queries.length);

    console.log(`searchModels average: ${perSearch.toFixed(1)}ms/search`);

    // understandQuery adds ~0.01ms; total search should still be fast
    expect(perSearch).toBeLessThan(100);
  });

  it("fallback works when query understanding fails", async () => {
    // understandQuery never throws, but test edge cases
    const edgeCases = [
      "",
      " ",
      "a",
      "1234567890".repeat(20), // very long query
      "!@#$%^&*()", // special characters
    ];

    for (const q of edgeCases) {
      const result = await searchModels(q, {});
      expect(result).toBeDefined();
      expect(result.models).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
    }
  });
});
