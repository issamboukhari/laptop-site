/**
 * Phase 2.4.1 — Benchmark: Linear Scan vs. Indexed Lookup
 *
 * Measures actual latency of single-item lookups using the real catalog.
 * Run with: npx vitest run tests/benchmark/catalog-index-benchmark.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getAllModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  invalidateCache,
} from "@/lib/server/database";

describe("Benchmark — catalog index performance", () => {
  it("measures lookup latency at catalog scale", async () => {
    const catalog = await getAllModels();
    const modelCount = catalog.length;
    const variantCount = catalog.reduce((sum, m) => sum + m.variants.length, 0);
    const firstModel = catalog[0];
    const firstVariant = firstModel.variants[0];
    const lastModel = catalog[catalog.length - 1];
    const lastVariant = lastModel.variants[lastModel.variants.length - 1];
    const missingId = "non-existent-id-benchmark-12345";

    const WARMUP = 100;
    const ITERATIONS = 5000;

    // Warm up
    for (let i = 0; i < WARMUP; i++) {
      await getModelById(firstModel.id);
      await findVariantById(firstVariant.id);
      await findModelByVariantId(firstVariant.id);
    }

    // --- getModelById ---
    const modelStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await getModelById(firstModel.id);
    }
    const modelMs = performance.now() - modelStart;

    const modelLastStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await getModelById(lastModel.id);
    }
    const modelLastMs = performance.now() - modelLastStart;

    const modelMissingStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await getModelById(missingId);
    }
    const modelMissingMs = performance.now() - modelMissingStart;

    // --- findVariantById ---
    const variantStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await findVariantById(firstVariant.id);
    }
    const variantMs = performance.now() - variantStart;

    const variantLastStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await findVariantById(lastVariant.id);
    }
    const variantLastMs = performance.now() - variantLastStart;

    const variantMissingStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await findVariantById(missingId);
    }
    const variantMissingMs = performance.now() - variantMissingStart;

    // --- findModelByVariantId ---
    const mvStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await findModelByVariantId(firstVariant.id);
    }
    const mvMs = performance.now() - mvStart;

    // --- Report ---
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║  Phase 2.4.1 — Catalog Index Benchmark                  ║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  Catalog: ${modelCount} models, ${variantCount} variants`.padEnd(59) + "║");
    console.log(`║  Iterations: ${ITERATIONS}`.padEnd(59) + "║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  getModelById (first):    ${(modelMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log(`║  getModelById (last):     ${(modelLastMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log(`║  getModelById (missing):  ${(modelMissingMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  findVariantById (first):    ${(variantMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log(`║  findVariantById (last):     ${(variantLastMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log(`║  findVariantById (missing):  ${(variantMissingMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log("╠══════════════════════════════════════════════════════════╣");
    console.log(`║  findModelByVariantId:     ${(mvMs / ITERATIONS * 1000).toFixed(2).padStart(8)} µs/op`.padEnd(59) + "║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    // All lookups should be well under 1ms per operation
    expect(modelMs / ITERATIONS).toBeLessThan(1); // < 1ms per op
    expect(variantMs / ITERATIONS).toBeLessThan(1);
    expect(mvMs / ITERATIONS).toBeLessThan(1);
  });
});
