/**
 * Phase 2.4.4 — Benchmark: Search Index Lifecycle Performance
 *
 * Measures: first search after snapshot, repeated search, search after invalidation.
 * Run with: npx vitest run tests/benchmark/search-lifecycle-benchmark.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getAllModels,
  invalidateCache,
} from "@/lib/server/database";
import {
  searchModels,
  invalidateSearchIndex,
} from "@/lib/server/search";

describe("Benchmark — search index lifecycle", () => {
  it("measures search lifecycle latency", async () => {
    const ITERATIONS = 500;

    // 1. First search (cold index build)
    invalidateSearchIndex();
    const coldStart = performance.now();
    await searchModels("lenovo", {});
    const coldMs = performance.now() - coldStart;

    // 2. Repeated search (warm — index reused)
    const warmStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await searchModels("lenovo", {});
    }
    const warmMs = performance.now() - warmStart;

    // 3. Search after invalidation (rebuild)
    invalidateSearchIndex();
    const rebuildStart = performance.now();
    await searchModels("dell", {});
    const rebuildMs = performance.now() - rebuildStart;

    // 4. Multi-term search (warm)
    const multiStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await searchModels("lenovo thinkpad 16gb", {});
    }
    const multiMs = performance.now() - multiStart;

    // 5. Autocomplete (warm)
    const acStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await searchModels("len", {});
    }
    const acMs = performance.now() - acStart;

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  Phase 2.4.4 — Search Index Lifecycle Benchmark         ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  Cold build (first search):  ${coldMs.toFixed(1).padStart(8)} ms`.padEnd(59) + "║");
    console.log(`║  Warm search (${ITERATIONS}x):     ${(warmMs / ITERATIONS).toFixed(2).padStart(8)} ms/op`.padEnd(59) + "║");
    console.log(`║  Rebuild after invalidation: ${rebuildMs.toFixed(1).padStart(8)} ms`.padEnd(59) + "║");
    console.log(`║  Multi-term (${ITERATIONS}x):     ${(multiMs / ITERATIONS).toFixed(2).padStart(8)} ms/op`.padEnd(59) + "║");
    console.log(`║  Simple search (${ITERATIONS}x):  ${(acMs / ITERATIONS).toFixed(2).padStart(8)} ms/op`.padEnd(59) + "║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    // Verify results are correct
    const result = await searchModels("lenovo", {});
    expect(result.models.length).toBeGreaterThan(0);
  });
});
