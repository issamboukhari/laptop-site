import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import { retrieveCandidates } from "@/lib/server/candidate-retrieval";
import {
  runHybridRetrieval,
  hasUnverifiableHardRequirement,
} from "@/lib/server/hybrid-retrieval";
import {
  searchModels,
  invalidateSearchIndex,
} from "@/lib/server/search";
import {
  isSemanticAvailable,
  classifyEmbeddingFailure,
  SEMANTIC_RESULT_CACHE,
  SEMANTIC_CONFIG,
} from "@/lib/server/semantic-retrieval";
import {
  withDeadline,
  failureSemanticResult,
  emptySemanticResult,
} from "@/lib/server/reliability";
import { semanticCircuitBreaker, resetSemanticCircuitBreaker } from "@/lib/server/circuit-breaker";
import type { SemanticResult } from "@/lib/server/semantic-retrieval";
import type { SemanticFailureKind } from "@/lib/data/types";

/**
 * Phase 3.2.6 — Search Reliability & Fallback tests
 *
 * Covers:
 *  - withDeadline: bounded waits, no unbounded waiting, errors not swallowed
 *  - typed failure factories (never parsed from strings downstream)
 *  - failure classification (embedding reasons → SemanticFailureKind)
 *  - end-to-end searchModels: semantic unavailable ⇒ structured-only,
 *    reliability observability populated, failures never cached,
 *    breaker stays closed on config-absence (not a fault)
 *  - hybrid fallback matrix never bypasses the hard gate / variant integrity
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateSearchIndex();
  invalidateSearchIndexCacheForTests();
});

/** Local cache/breaker reset per file (vitest isolates modules per file). */
function invalidateSearchIndexCacheForTests(): void {
  resetSemanticCircuitBreaker();
}

// ---------------------------------------------------------------------------
// withDeadline
// ---------------------------------------------------------------------------

describe("withDeadline — bounded waiting", () => {
  it("returns the value when the promise settles in time", async () => {
    const { value, timedOut } = await withDeadline(Promise.resolve(42), 500);
    expect(timedOut).toBe(false);
    expect(value).toBe(42);
  });

  it("reports timedOut when the deadline expires", async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 150));
    const { value, timedOut } = await withDeadline(slow, 20);
    expect(timedOut).toBe(true);
    expect(value).toBeUndefined();
  });

  it("never swallows a real rejection", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 500)).rejects.toThrow("boom");
  });

  it("does not wait when the promise has already settled", async () => {
    const start = Date.now();
    const { value, timedOut } = await withDeadline(Promise.resolve("fast"), 1000);
    expect(timedOut).toBe(false);
    expect(value).toBe("fast");
    expect(Date.now() - start).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// Typed failure factories
// ---------------------------------------------------------------------------

describe("Typed failure factories", () => {
  it("failureSemanticResult carries a machine-readable failureKind", () => {
    const r = failureSemanticResult("SEMANTIC_TIMEOUT", "deadline");
    expect(r.success).toBe(false);
    expect(r.fallback).toBe(true);
    expect(r.failureKind).toBe("SEMANTIC_TIMEOUT");
    expect(r.matches).toEqual([]);
  });

  it("failureSemanticResult defaults latency and embeds custom fields", () => {
    const r = failureSemanticResult("SEMANTIC_UNAVAILABLE", "not configured", { latencyMs: 3 });
    expect(r.latencyMs).toBe(3);
    expect(r.embeddedCount).toBe(0);
  });

  it("isEmptySemanticResult success-with-no-matches is NOT a failure", () => {
    const r = emptySemanticResult({ latencyMs: 5 });
    expect(r.success).toBe(true);
    expect(r.fallback).toBe(false);
    expect(r.semanticEmpty).toBe(true);
    expect(r.failureKind).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

describe("Failure classification", () => {
  const cases: [stamp: Parameters<typeof classifyEmbeddingFailure>[0], kind: SemanticFailureKind][] = [
    ["TIMEOUT", "SEMANTIC_TIMEOUT"],
    ["API_ERROR", "SEMANTIC_API_ERROR"],
    ["INVALID_EMBEDDING", "SEMANTIC_INVALID_EMBEDDING"],
    ["UNAVAILABLE", "SEMANTIC_UNAVAILABLE"],
  ];
  for (const [reason, expected] of cases) {
    it(`maps ${reason} → ${expected}`, () => {
      expect(classifyEmbeddingFailure(reason)).toBe(expected);
    });
  }

  it("every classified kind is legal in the failure union", () => {
    const kind: SemanticFailureKind = classifyEmbeddingFailure("TIMEOUT");
    const valid: SemanticFailureKind[] = [
      "SEMANTIC_TIMEOUT",
      "SEMANTIC_API_ERROR",
      "SEMANTIC_UNAVAILABLE",
      "SEMANTIC_EMPTY",
      "SEMANTIC_INVALID_RESPONSE",
      "SEMANTIC_INVALID_EMBEDDING",
    ];
    expect(valid).toContain(kind);
  });
});

// ---------------------------------------------------------------------------
// Hybrid fallback matrix — hard gate NEVER bypassed on fallback paths
// ---------------------------------------------------------------------------

function semanticSuccess(matches: SemanticResult["matches"]): SemanticResult {
  return { matches, success: true, fallback: false, embeddedCount: matches.length, latencyMs: 0 };
}

function failedSemantic(): SemanticResult {
  return { matches: [], success: false, fallback: true, embeddedCount: 0, latencyMs: 0, error: "down", failureKind: "SEMANTIC_API_ERROR" };
}

describe("Hybrid fallback matrix", () => {
  it("semantic failure ⇒ structured-only rescue (hard gate still enforced)", () => {
    const query = "Lenovo";
    const understood = understandQuery(query);
    const structured = retrieveCandidates(understood, allModels, {});
    const fabricated = { variantId: "ghost-variant", modelId: "ghost-model", score: 0.99, rank: 1 };

    const hybrid = runHybridRetrieval({
      query,
      normalizedQuery: "lenovo",
      understood,
      structuredModels: structured.candidates,
      semanticResult: { ...failedSemantic(), matches: [fabricated] },
      allModels,
      filters: {},
    });

    // The semantic failure drops ALL its candidates — even a fabricated one
    // cannot leak because semanticModelsToCandidates only trusts success.
    expect(hybrid.observable.semanticCandidateCount).toBe(0);
    expect(hybrid.observable.structuredCandidateCount).toBeGreaterThan(0);
    expect([...hybrid.admissibleModelIds].every((id) => allModels.some((m) => m.id === id))).toBe(true);
  });

  it("semantic-only rescue admits only REAL catalog variants", () => {
    const real = allModels[0];
    const variant = real.variants[0];
    const ghost = { variantId: "invented-variant", modelId: "invented-model", score: 0.99, rank: 2 };

    const hybrid = runHybridRetrieval({
      query: "laptop",
      normalizedQuery: "laptop",
      understood: understandQuery("laptop"),
      structuredModels: [],
      semanticResult: semanticSuccess([
        { variantId: variant.id, modelId: real.id, score: 0.9, rank: 1 },
        ghost,
      ]),
      allModels,
      filters: {},
    });

    expect(hybrid.admissible).toHaveLength(1);
    expect(hybrid.admissible[0].variantId).toBe(variant.id);
  });

  it("a semantic candidate whose modelId does not own the variantId is excluded (integrity)", () => {
    const m1 = allModels[0];
    const v1 = m1.variants[0];
    const m2 = allModels[1] ?? m1;
    // Force a mismatch: claim m2 owns m1's variant.
    const crossing = { variantId: v1.id, modelId: m2.id, score: 0.95, rank: 1 };

    const hybrid = runHybridRetrieval({
      query: "laptop",
      normalizedQuery: "laptop",
      understood: understandQuery("laptop"),
      structuredModels: [],
      semanticResult: semanticSuccess([crossing]),
      allModels,
      filters: {},
    });

    expect(hybrid.observable.semanticCandidateCount).toBe(1);
    expect(hybrid.admissible).toHaveLength(0); // integrity violation → dropped
  });

  it("hard criteria survive semantic rescue (RTX candidate must actually carry RTX)", () => {
    const query = "RTX 4060 laptop";
    const normalized = "rtx 4060 laptop";
    const criteriaQuery = understandQuery(query);

    const good = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find(({ v }) => JSON.stringify(v.specs.gpu).toLowerCase().includes("rtx 4060"));
    // A candidate that does NOT match the hard criteria at all.
    const bad = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find(({ v }) => !JSON.stringify(v.specs.gpu).toLowerCase().includes("rtx"))!;

    const hybrid = runHybridRetrieval({
      query,
      normalizedQuery: normalized,
      understood: criteriaQuery,
      structuredModels: [],
      semanticResult: semanticSuccess([
        { variantId: bad.v.id, modelId: bad.m.id, score: 0.97, rank: 1 },
        ...(good ? [{ variantId: good.v.id, modelId: good.m.id, score: 0.9, rank: 2 }] : []),
      ]),
      allModels,
      filters: {},
    });

    const admittedIds = new Set(hybrid.admissible.map((c) => c.variantId));
    expect(admittedIds.has(bad.v.id)).toBe(false);
    if (good) expect(admittedIds.has(good.v.id)).toBe(true);
  });

  it("unverifiable hard requirement blocks unsafe semantic-only rescue (safe empty)", () => {
    const m = allModels[0];
    const v = m.variants[0];
    const understood = understandQuery("120hz");
    expect(hasUnverifiableHardRequirement(understood)).toBe(true);

    const hybrid = runHybridRetrieval({
      query: "120hz",
      normalizedQuery: "120hz",
      understood,
      structuredModels: [],
      semanticResult: semanticSuccess([{ variantId: v.id, modelId: m.id, score: 0.9, rank: 1 }]),
      allModels,
      filters: {},
    });

    expect(hybrid.semanticSuppressed).toBe(true);
    expect(hybrid.admissible).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// End-to-end searchModels reliability contract
// ---------------------------------------------------------------------------

describe("searchModels reliability (semantic unavailable in test env)", () => {
  const semanticPotential = isSemanticAvailable();

  it("structured search always succeeds even when semantic is unavailable", async () => {
    const result = await searchModels("Lenovo", {});
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.reliability).toBeDefined();
  });

  it("populates reliability observability on a failed semantic attempt", async () => {
    const result = await searchModels("Lenovo", {});
    const r = result.reliability!;
    expect(r.structuredSuccess).toBe(true);
    expect(r.structuredEmpty).toBe(false);
    expect(typeof r.semanticSuccess).toBe("boolean");
    expect(typeof r.breakerState).toBe("string");
    expect(r.embedding.model).toBe("gemini-embedding-2");
    expect(r.embedding.version).toBe("1");
    expect(r.embedding.dimension).toBe(768);
    expect(r.resultCount).toBe(result.total);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.candidateCounts.final).toBeGreaterThanOrEqual(0);
    expect(r.candidateCounts.gateExcluded).toBeGreaterThanOrEqual(0);
    expect(r.semanticAvailable).toBe(false); // not configured in test env
    expect(r.fallbackUsed).toBe(true);
  });

  it("fallback reason is typed, never a raw provider error string", async () => {
    const result = await searchModels("Lenovo", {});
    const reason = result.reliability!.fallbackReason;
    expect(reason).toBeDefined();
    const legal: NonNullable<typeof reason>[] = [
      "SEMANTIC_TIMEOUT",
      "SEMANTIC_API_ERROR",
      "SEMANTIC_UNAVAILABLE",
      "SEMANTIC_EMPTY",
      "SEMANTIC_INVALID_RESPONSE",
      "SEMANTIC_INVALID_EMBEDDING",
      "STRUCTURED_EMPTY",
      "STRUCTURED_ERROR",
      "QUERY_UNDERSTANDING_FAILURE",
      "INVALID_CANDIDATE",
      "INTERNAL_SEARCH_ERROR",
      "CIRCUIT_OPEN",
      "TIMEOUT",
    ];
    expect(legal).toContain(reason);
  });

  it("failures and empty results are NEVER written to the semantic cache", async () => {
    if (semanticPotential) {
      console.log("Semantic configured — skipping cache-emission test.");
      return;
    }
    SEMANTIC_RESULT_CACHE.clear();
    await searchModels("Lenovo", {});
    await searchModels("gaming laptop", {});
    expect(SEMANTIC_RESULT_CACHE.size).toBe(0); // nothing but real successes may be cached
  });

  it("config absence does NOT trip the circuit breaker", async () => {
    if (semanticPotential) {
      console.log("Semantic configured — skipping breaker non-trip test.");
      return;
    }
    resetSemanticCircuitBreaker();
    for (let i = 0; i < SEMANTIC_CONFIG.maxRetries + 3; i++) {
      await searchModels("laptop", {});
    }
    expect(semanticCircuitBreaker.currentState().state).toBe("CLOSED");
  });

  it("empty query path returns structured results without reliability (backward compat)", async () => {
    const result = await searchModels("", {});
    expect(result.models).toBeDefined();
    expect(result.reliability).toBeUndefined();
  });
});