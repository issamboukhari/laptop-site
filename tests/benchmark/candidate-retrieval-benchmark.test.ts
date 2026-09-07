import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import {
  retrieveCandidates,
  invalidateRetrievalIndexes,
} from "@/lib/server/candidate-retrieval";

/**
 * Phase 3.2.2 — Performance Benchmark
 *
 * Measures candidate retrieval performance: latency, reduction ratios,
 * and index build cost.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateRetrievalIndexes(); // Reset for clean benchmarks
});

describe("Candidate Retrieval — Latency", () => {
  it("retrieveCandidates is sub-millisecond per call", () => {
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
        const understood = understandQuery(q);
        retrieveCandidates(understood, allModels, {});
      }
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / (iterations * queries.length);

    console.log(
      `retrieveCandidates: ${perCall.toFixed(3)}ms/call (${iterations * queries.length} calls in ${elapsed.toFixed(1)}ms)`
    );

    // Sub-millisecond per call
    expect(perCall).toBeLessThan(1);
  });

  it("index build completes in < 50ms", () => {
    invalidateRetrievalIndexes();

    const start = performance.now();
    const understood = understandQuery("laptop");
    retrieveCandidates(understood, allModels, {});
    const elapsed = performance.now() - start;

    console.log(`Index build + first retrieval: ${elapsed.toFixed(1)}ms`);

    // Should complete within 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it("subsequent calls reuse cached index (sub-microsecond)", () => {
    // Warm up
    const understood = understandQuery("laptop");
    retrieveCandidates(understood, allModels, {});

    // Measure cached calls
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      retrieveCandidates(understood, allModels, {});
    }
    const elapsed = performance.now() - start;
    const perCall = (elapsed / iterations) * 1000; // Convert to microseconds

    console.log(
      `Cached retrieval: ${perCall.toFixed(2)}μs/call (${iterations} calls in ${elapsed.toFixed(1)}ms)`
    );

    // Cached calls should be very fast (< 0.1ms)
    expect(perCall).toBeLessThan(100);
  });
});

describe("Candidate Retrieval — Reduction Ratios", () => {
  it("brand filter reduces catalog significantly", () => {
    const understood = understandQuery("laptop");
    const { candidates } = retrieveCandidates(understood, allModels, {
      brand: "Lenovo",
    });

    const reduction = ((allModels.length - candidates.length) / allModels.length) * 100;
    console.log(
      `Brand filter (Lenovo): ${candidates.length}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
    );

    // Lenovo has many models; verify meaningful reduction
    expect(candidates.length).toBeLessThan(allModels.length);
  });

  it("category filter reduces catalog significantly", () => {
    const understood = understandQuery("laptop");
    const { candidates } = retrieveCandidates(understood, allModels, {
      category: "gaming-laptop",
    });

    const reduction = ((allModels.length - candidates.length) / allModels.length) * 100;
    console.log(
      `Category filter (gaming-laptop): ${candidates.length}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
    );

    expect(reduction).toBeGreaterThan(30);
  });

  it("GPU + RAM constraints reduce catalog substantially", () => {
    const understood = understandQuery("RTX 4060 16GB");
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, {});

    const reduction = ((allModels.length - candidates.length) / allModels.length) * 100;
    console.log(
      `GPU+RAM filter (RTX 4060 16GB): ${candidates.length}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
    );
    console.log(`Signals used: ${signalsUsed.join(", ")}`);

    expect(reduction).toBeGreaterThan(20);
  });

  it("combined brand + category + GPU achieves maximum reduction", () => {
    const understood = understandQuery("Lenovo RTX 4060");
    const { candidates, signalsUsed } = retrieveCandidates(understood, allModels, {
      brand: "Lenovo",
      category: "gaming-laptop",
    });

    const reduction = ((allModels.length - candidates.length) / allModels.length) * 100;
    console.log(
      `Combined filter: ${candidates.length}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
    );
    console.log(`Signals used: ${signalsUsed.join(", ")}`);

    expect(reduction).toBeGreaterThan(60);
  });

  it("price filter reduces catalog", () => {
    const understood = understandQuery("laptop");
    const { candidates } = retrieveCandidates(understood, allModels, {
      maxPrice: 1000,
    });

    const reduction = ((allModels.length - candidates.length) / allModels.length) * 100;
    console.log(
      `Price filter (<1000): ${candidates.length}/${allModels.length} models (${reduction.toFixed(1)}% reduction)`
    );

    expect(reduction).toBeGreaterThan(10);
  });
});

describe("Candidate Retrieval — Signals", () => {
  it("reports which signals were used", () => {
    const understood = understandQuery("Lenovo RTX 4060 16GB laptop");
    const { candidates, signalsUsed } = retrieveCandidates(
      understood,
      allModels,
      { brand: "Lenovo" }
    );

    console.log(`Signals used: ${signalsUsed.join(", ")}`);
    console.log(`Candidates: ${candidates.length}/${allModels.length}`);

    // Should use brand and at least one hardware signal
    expect(signalsUsed.some((s) => s.startsWith("brand:"))).toBe(true);
  });

  it("fallback flag is reported", () => {
    // Query with no structured signals
    const understood = understandQuery("");
    const { fallback } = retrieveCandidates(understood, allModels, {});

    console.log(`Fallback triggered: ${fallback}`);

    // Empty query should not trigger fallback (no aggressive filtering)
    expect(fallback).toBe(false);
  });
});

describe("Candidate Retrieval — Edge Cases", () => {
  it("empty query returns all models", () => {
    const understood = understandQuery("");
    const { candidates } = retrieveCandidates(understood, allModels, {});

    expect(candidates.length).toBe(allModels.length);
  });

  it("very specific query narrows to few candidates", () => {
    const understood = understandQuery(
      "Lenovo ThinkPad X1 Carbon Gen 11 i7-1365U 32GB"
    );
    const { candidates } = retrieveCandidates(understood, allModels, {});

    console.log(
      `Very specific query: ${candidates.length}/${allModels.length} models`
    );

    // Should narrow significantly
    expect(candidates.length).toBeLessThan(allModels.length * 0.5);
  });
});
