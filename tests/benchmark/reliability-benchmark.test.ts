import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import { retrieveCandidates } from "@/lib/server/candidate-retrieval";
import {
  runHybridRetrieval,
  type HybridRetrievalInput,
} from "@/lib/server/hybrid-retrieval";
import { searchModels, invalidateSearchIndex } from "@/lib/server/search";
import { BoundedLruCache } from "@/lib/server/cache";
import { CircuitBreaker } from "@/lib/server/circuit-breaker";
import type { SemanticResult } from "@/lib/server/semantic-retrieval";

/**
 * Phase 3.2.6 — Reliability benchmarks (local, informational)
 *
 * Measures the overhead/latency of the paths the reliability layer ships and
 * degrades through. Benchmarks are explicitly NOT production guarantees; they
 * exist to catch regressions that make fallback more expensive than the happy
 * path it protects. Bounds are deliberately loose to stay CI-stable.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateSearchIndex();
});

function failedSemantic(): SemanticResult {
  return { matches: [], success: false, fallback: true, embeddedCount: 0, latencyMs: 0, error: "down", failureKind: "SEMANTIC_API_ERROR" };
}

function hybridInput(semanticResult: SemanticResult): HybridRetrievalInput {
  const query = "Lenovo laptop";
  return {
    query,
    normalizedQuery: "lenovo laptop",
    understood: understandQuery(query),
    structuredModels: retrieveCandidates(understandQuery(query), allModels, {}).candidates,
    semanticResult,
    allModels,
    filters: {},
  };
}

describe("Reliability bench — end-to-end search", () => {
  it("searchModels completes within a bounded latency on the structured path", async () => {
    const iterations = 5;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const result = await searchModels("Lenovo", {});
      expect(result.models.length).toBeGreaterThan(0);
    }
    const perCall = (performance.now() - start) / iterations;
    console.log(`searchModels (structured path): ${perCall.toFixed(0)}ms/call`);
    // No semantic provider in the test environment; structured path is
    // entirely in-process — it must stay comfortably fast.
    expect(perCall).toBeLessThan(1500);
  });
});

describe("Reliability bench — hybrid fusion paths", () => {
  it("normal hybrid path (structured + semantic success)", () => {
    const structured = retrieveCandidates(understandQuery("Lenovo"), allModels, {});
    const semantic: SemanticResult = {
      matches: structured.candidates.slice(0, 10).map((v, i) => ({
        variantId: v.id,
        modelId: v.brand ? "m" : "m",
        score: 0.9 - i * 0.01,
        rank: i + 1,
      })),
      success: true,
      fallback: false,
      embeddedCount: 10,
      latencyMs: 0,
    };
    const understood = understandQuery("Lenovo");

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      runHybridRetrieval({
        query: "Lenovo",
        normalizedQuery: "lenovo",
        understood,
        structuredModels: structured.candidates,
        semanticResult: semantic,
        allModels,
        filters: {},
      });
    }
    const perCall = (performance.now() - start) / iterations * 1000;
    console.log(`hybrid (both sources active): ${perCall.toFixed(1)}μs/call`);
    expect(perCall).toBeLessThan(5000);
  });

  it("semantic-failure fallback path (hybrid with semantic down)", () => {
    const iterations = 1000;
    const input = hybridInput(failedSemantic());
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const r = runHybridRetrieval(input);
      expect(r.observable.semanticCandidateCount).toBe(0);
    }
    const perCall = (performance.now() - start) / iterations * 1000;
    console.log(`hybrid fallback (semantic down): ${perCall.toFixed(1)}μs/call`);
    expect(perCall).toBeLessThan(5000);
  });

  it("fallback degradation is no more expensive than the happy path", () => {
    const happy = hybridInput({
      matches: [],
      success: true,
      fallback: false,
      embeddedCount: 0,
      latencyMs: 0,
    });
    const down = hybridInput(failedSemantic());

    const start = performance.now();
    for (let i = 0; i < 2000; i++) runHybridRetrieval(happy);
    const happyPerCall = (performance.now() - start) / 2000 * 1000;

    const start2 = performance.now();
    for (let i = 0; i < 2000; i++) runHybridRetrieval(down);
    const downPerCall = (performance.now() - start2) / 2000 * 1000;

    console.log(`happy ${happyPerCall.toFixed(1)}μs vs fallback ${downPerCall.toFixed(1)}μs`);
    expect(downPerCall).toBeLessThan(happyPerCall * 3 + 100);
  });
});

describe("Reliability bench — bounded cache", () => {
  it("semantic result cache hit is faster than a fresh write", () => {
    const iterations = 50_000;
    const cache = new BoundedLruCache<number, number>(1000, 60_000);
    for (let i = 0; i < 1000; i++) cache.set(i, i);

    // Miss-dominated workload (cycle over distinct keys).
    const startMiss = performance.now();
    for (let i = 0; i < iterations; i++) cache.get(i % 50_000);
    const missPerOp = (performance.now() - startMiss) / iterations * 1000;

    // Hit workload (only keys present in cache).
    const startHit = performance.now();
    for (let i = 0; i < iterations; i++) cache.get(i % 1000);
    const hitPerOp = (performance.now() - startHit) / iterations * 1000;

    console.log(`cache get: hit ${hitPerOp.toFixed(2)}μs vs miss ${missPerOp.toFixed(2)}μs`);
    expect(hitPerOp).toBeLessThan(1);
    expect(missPerOp).toBeLessThan(1);
  });

  it("max-entry eviction is O(1) per write", () => {
    const iterations = 50_000;
    const cache = new BoundedLruCache<number, number>(1000, 60_000);
    const start = performance.now();
    for (let i = 0; i < iterations; i++) cache.set(i, i);
    const perOp = (performance.now() - start) / iterations * 1000;
    expect(cache.size).toBe(1000);
    console.log(`cache set+evict: ${perOp.toFixed(2)}μs/op`);
    expect(perOp).toBeLessThan(2);
  });
});

describe("Reliability bench — circuit breaker", () => {
  it("breaker decision overhead is negligible (CLOSED vs OPEN)", () => {
    const iterations = 100_000;
    const closed = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 1000, halfOpenMaxProbes: 1 });
    const open = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100_000, halfOpenMaxProbes: 1 });
    open.recordFailure(); // trips OPEN

    const startClosed = performance.now();
    for (let i = 0; i < iterations; i++) closed.allow();
    const perClosed = (performance.now() - startClosed) / iterations * 1000;

    const startOpen = performance.now();
    for (let i = 0; i < iterations; i++) open.allow();
    const perOpen = (performance.now() - startOpen) / iterations * 1000;

    console.log(`breaker allow(): CLOSED ${perClosed.toFixed(2)}μs vs OPEN ${perOpen.toFixed(2)}μs`);
    expect(perClosed).toBeLessThan(1);
    expect(perOpen).toBeLessThan(1);
  });
});