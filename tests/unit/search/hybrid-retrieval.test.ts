import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";
import { retrieveCandidates, invalidateRetrievalIndexes } from "@/lib/server/candidate-retrieval";
import {
  normalizeQuery,
  searchModels,
  extractSpecCriteria,
  invalidateSearchIndex,
} from "@/lib/server/search";
import {
  fuseCandidates,
  applyHardConstraintGate,
  runHybridRetrieval,
  structuredModelsToCandidates,
  semanticMatchesToCandidates,
  hasUnverifiableHardRequirement,
  HYBRID_CONFIG,
  type RetrievalCandidate,
  type FusedCandidate,
  type HybridFusionConfig,
} from "@/lib/server/hybrid-retrieval";
import type { SemanticResult } from "@/lib/server/semantic-retrieval";
import { variantMatchesCriteria } from "@/lib/server/spec-criteria";
import type { SearchFilters } from "@/lib/data/types";

/**
 * Phase 3.2.4 — Hybrid Retrieval / Fusion Tests
 *
 * Focused coverage:
 *  - RRF fusion mathematics (both / single-source / dual-source / config)
 *  - Canonical deduplication + variant integrity
 *  - Hard-constraint gate (semantic can never bypass filters/criteria)
 *  - Failure & empty handling (semantic down, structured down, unsafe rescue)
 *  - Anti-hallucination (unknown variant rejected)
 *  - End-to-end regression through searchModels (hybrid path active)
 *
 * Synthetic candidate objects are used ONLY for isolated fusion mathematics.
 * Integration tests reference REAL catalog variants only.
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
  invalidateRetrievalIndexes();
  invalidateSearchIndex();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rc(
  variantId: string,
  modelId: string,
  rank: number,
  source: RetrievalCandidate["source"],
  score?: number
): RetrievalCandidate {
  return { variantId, modelId, rank, source, score };
}

function semanticResult(matches: SemanticResult["matches"]): SemanticResult {
  return {
    matches,
    success: true,
    fallback: false,
    embeddedCount: matches.length,
    latencyMs: 0,
  };
}

function failedSemantic(): SemanticResult {
  return { matches: [], success: false, fallback: true, embeddedCount: 0, latencyMs: 0, error: "down" };
}

// ---------------------------------------------------------------------------
// 1. RRF fusion mathematics
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — RRF mathematics", () => {
  it("structured-only candidate: 1/(rrfK + rank), semantic contributes 0", () => {
    const fused = fuseCandidates([rc("A", "m1", 1, "structured")], []);
    expect(fused).toHaveLength(1);
    expect(fused[0].rrfScore).toBeCloseTo(1 / (HYBRID_CONFIG.rrfK + 1), 9);
    expect(fused[0].source).toBe("structured");
  });

  it("semantic-only candidate: only semantic contributes", () => {
    const fused = fuseCandidates([], [rc("B", "m2", 3, "semantic", 0.9)]);
    expect(fused).toHaveLength(1);
    expect(fused[0].rrfScore).toBeCloseTo(1 / (HYBRID_CONFIG.rrfK + 3), 9);
    expect(fused[0].source).toBe("semantic");
  });

  it("dual-source candidate receives combined RRF contribution", () => {
    const fused = fuseCandidates(
      [rc("X", "m3", 4, "structured")],
      [rc("X", "m3", 2, "semantic", 0.8)]
    );
    expect(fused).toHaveLength(1);
    expect(fused[0].rrfScore).toBeCloseTo(
      1 / (HYBRID_CONFIG.rrfK + 4) + 1 / (HYBRID_CONFIG.rrfK + 2),
      9
    );
    expect(fused[0].structuredRank).toBe(4);
    expect(fused[0].semanticRank).toBe(2);
    expect(fused[0].source).toBe("both");
  });

  it("dual-source contribution strictly exceeds single-source contribution", () => {
    const dual = fuseCandidates(
      [rc("X", "m3", 4, "structured")],
      [rc("X", "m3", 2, "semantic", 0.8)]
    )[0].rrfScore;
    const single = fuseCandidates([rc("X", "m3", 4, "structured")], [])[0].rrfScore;
    expect(dual).toBeGreaterThan(single);
    expect(dual - single).toBeCloseTo(1 / (HYBRID_CONFIG.rrfK + 2), 9);
  });

  it("configurable rrfK changes the score scale", () => {
    const cfg: HybridFusionConfig = { rrfK: 10, structuredWeight: 1, semanticWeight: 1 };
    const fused = fuseCandidates([rc("A", "m1", 1, "structured")], [], cfg);
    expect(fused[0].rrfScore).toBeCloseTo(1 / 11, 9);
    // Different from the default k=60 value
    expect(fused[0].rrfScore).not.toBeCloseTo(1 / 61, 9);
  });

  it("configurable structured weight scales structured contribution", () => {
    const cfg: HybridFusionConfig = { rrfK: 60, structuredWeight: 3, semanticWeight: 1 };
    const fused = fuseCandidates(
      [rc("X", "m3", 4, "structured")],
      [rc("X", "m3", 2, "semantic", 0.8)],
      cfg
    );
    expect(fused[0].rrfScore).toBeCloseTo(3 / 64 + 1 / 62, 9);
  });

  it("configurable semantic weight scales semantic contribution", () => {
    const cfg: HybridFusionConfig = { rrfK: 60, structuredWeight: 1, semanticWeight: 4 };
    const fused = fuseCandidates(
      [rc("X", "m3", 4, "structured")],
      [rc("X", "m3", 2, "semantic", 0.8)],
      cfg
    );
    expect(fused[0].rrfScore).toBeCloseTo(1 / 64 + 4 / 62, 9);
  });

  it("scores are rank-based; raw structuredScore + semanticScore are never added", () => {
    // Construct the exact dual candidate with a large raw semantic score that
    // MUST NOT be summed into the fusion number.
    const fused = fuseCandidates(
      [rc("X", "m3", 4, "structured", 1000)],
      [rc("X", "m3", 2, "semantic", 0.99)]
    );
    expect(fused[0].rrfScore).toBeCloseTo(1 / 64 + 1 / 62, 9);
    expect(fused[0].rrfScore).not.toBeCloseTo(1000 + 0.99, 9);
  });

  it("rank field is assigned deterministically after sorting", () => {
    const fused = fuseCandidates(
      [rc("A", "m1", 1, "structured"), rc("B", "m2", 2, "structured")],
      [rc("A", "m1", 1, "semantic", 0.9)]
    );
    expect(fused.map((c) => c.rank)).toEqual([1, 2]);
    // Dual-source A must outrank single-source B.
    expect(fused[0].variantId).toBe("A");
    expect(fused[1].variantId).toBe("B");
  });

  it("ordering is deterministic across repeated runs", () => {
    const inputs = {
      structured: [rc("a", "m1", 1, "structured"), rc("c", "m3", 3, "structured")],
      semantic: [rc("b", "m2", 2, "semantic"), rc("a", "m1", 1, "semantic")],
    };
    const a = fuseCandidates(inputs.structured, inputs.semantic);
    const b = fuseCandidates(inputs.structured, inputs.semantic);
    expect(a.map((c) => c.variantId)).toEqual(b.map((c) => c.variantId));
    expect(a.map((c) => c.rrfScore)).toEqual(b.map((c) => c.rrfScore));
  });
});

// ---------------------------------------------------------------------------
// 2. Deduplication & variant integrity
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — deduplication & variant integrity", () => {
  it("same variant from both sources merges into ONE candidate", () => {
    const fused = fuseCandidates(
      [rc("V1", "m1", 1, "structured")],
      [rc("V1", "m1", 5, "semantic", 0.7)]
    );
    expect(fused).toHaveLength(1);
    expect(fused[0].variantId).toBe("V1");
    expect(fused[0].source).toBe("both");
  });

  it("different variants of the SAME model remain separate identities", () => {
    const fused = fuseCandidates(
      [rc("V1", "m1", 1, "structured"), rc("V2", "m1", 2, "structured")],
      [rc("V2", "m1", 1, "semantic", 0.9)]
    );
    expect(fused).toHaveLength(2);
    const ids = new Set(fused.map((c) => c.variantId));
    expect(ids).toEqual(new Set(["V1", "V2"]));
    for (const c of fused) expect(c.modelId).toBe("m1");
  });

  it("A B C (structured) + B C D (semantic) → A B C D (no duplicates)", () => {
    const structured = [
      rc("A", "m1", 1, "structured"),
      rc("B", "m2", 2, "structured"),
      rc("C", "m3", 3, "structured"),
    ];
    const semantic = [
      rc("B", "m2", 1, "semantic", 0.9),
      rc("C", "m3", 2, "semantic", 0.8),
      rc("D", "m4", 3, "semantic", 0.7),
    ];
    const fused = fuseCandidates(structured, semantic);
    expect(fused.map((c) => c.variantId).sort()).toEqual(["A", "B", "C", "D"]);
    expect(new Set(fused.map((c) => c.variantId)).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Hard-constraint gate
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — hard-constraint gate", () => {
  function gate(fused: FusedCandidate[], filters: SearchFilters = {}, q = "") {
    return applyHardConstraintGate(fused, allModels, {
      filters,
      understood: understandQuery(q),
      normalizedQuery: normalizeQuery(q),
    });
  }

  function realCandidate(modelId: string, variantId: string, rank = 1): FusedCandidate[] {
    return fusedFromRetrieval([rc(variantId, modelId, rank, "semantic", 0.99)]);
  }

  function fusedFromRetrieval(cands: RetrievalCandidate[]): FusedCandidate[] {
    return fuseCandidates([], cands);
  }

  it("rejects a semantic candidate whose variant is not in the catalog", () => {
    const fused = fusedFromRetrieval([rc("ghost-variant-zzz", "m1", 1, "semantic", 0.99)]);
    const { admissible, excludedCount } = gate(fused);
    expect(admissible).toHaveLength(0);
    expect(excludedCount).toBe(1);
  });

  it("rejects a semantic candidate whose model is not in the catalog", () => {
    const fused = fusedFromRetrieval([rc("V1", "ghost-model-zzz", 1, "semantic", 0.99)]);
    const { admissible } = gate(fused);
    expect(admissible).toHaveLength(0);
  });

  it("RAM hard constraint — 16GB min excludes an 8GB-variant candidate", () => {
    const sixteenOrMore = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .filter((x) => x.v.specs.ram >= 16);
    const subSixteen = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .filter((x) => x.v.specs.ram < 16);

    if (subSixteen.length > 0) {
      const fused = realCandidate(subSixteen[0].m.id, subSixteen[0].v.id);
      const { admissible } = gate(fused, { minRam: 16 });
      expect(admissible).toHaveLength(0);
    } else {
      const fused = realCandidate(sixteenOrMore[0].m.id, sixteenOrMore[0].v.id);
      const { admissible } = gate(fused, { minRam: 16 });
      expect(admissible.length).toBeGreaterThan(0);
    }
  });

  it("price hard constraint — maxPrice excludes over-budget variant", () => {
    const over = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => x.v.price > 1000)!;
    const fused = realCandidate(over.m.id, over.v.id);
    const { admissible } = gate(fused, { maxPrice: over.v.price - 1 });
    expect(admissible).toHaveLength(0);
  });

  it("brand hard constraint — semantic HP candidate excluded under Lenovo filter", () => {
    const { m, v } = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => x.m.brand.toLowerCase() !== "lenovo")!;
    const fused = realCandidate(m.id, v.id);
    const { admissible } = gate(fused, { brand: "Lenovo" });
    expect(admissible).toHaveLength(0);
  });

  it("GPU/RAM criteria — a semantically strong but invalid candidate is excluded", () => {
    const query = "RTX 4060 16GB";
    const criteria = extractSpecCriteria(normalizeQuery(query).split(" "));
    const candidate = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => !variantMatchesCriteria(x.v.specs, criteria))!;
    const fused = realCandidate(candidate.m.id, candidate.v.id);
    const { admissible } = gate(fused, {}, query);
    expect(admissible).toHaveLength(0);
  });

  it("CPU criteria — candidate missing the required CPU is excluded", () => {
    const query = "i713700h";
    const criteria = extractSpecCriteria(normalizeQuery(query).split(" "));
    expect(criteria.cpuTerms.length).toBeGreaterThan(0);
    const candidate = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => !variantMatchesCriteria(x.v.specs, criteria))!;
    const fused = realCandidate(candidate.m.id, candidate.v.id);
    const { admissible } = gate(fused, {}, query);
    expect(admissible).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Failure & empty handling
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — failure & empty handling", () => {
  it("semantic failure preserves structured search", () => {
    const understood = understandQuery("Lenovo");
    const structured = retrieveCandidates(understood, allModels, {});
    expect(structured.candidates.length).toBeGreaterThan(0);

    const hybrid = runHybridRetrieval({
      query: "Lenovo",
      normalizedQuery: "lenovo",
      understood,
      structuredModels: structured.candidates,
      semanticResult: failedSemantic(),
      allModels,
      filters: {},
    });
    expect(hybrid.semanticAvailable).toBe(false);
    expect(hybrid.observable.semanticCandidateCount).toBe(0);
    expect(hybrid.observable.structuredCandidateCount).toBeGreaterThan(0);
    expect(hybrid.admissibleModelIds.size).toBeGreaterThan(0);
  });

  it("structured empty + safe semantic-only fallback is allowed", () => {
    const m = allModels[0];
    const v = m.variants[0];
    const match = { variantId: v.id, modelId: m.id, score: 0.9, rank: 1 };
    const hybrid = runHybridRetrieval({
      query: "laptop",
      normalizedQuery: "laptop",
      understood: understandQuery("laptop"),
      structuredModels: [],
      semanticResult: semanticResult([match]),
      allModels,
      filters: {},
    });
    expect(hybrid.observable.semanticCandidateCount).toBe(1);
    expect(hybrid.admissible).toHaveLength(1);
    expect(hybrid.admissible[0].variantId).toBe(v.id);
  });

  it("structured empty + unsafe semantic-only (unverifiable hard req) → safe empty", () => {
    const { m, v } = { m: allModels[0], v: allModels[0].variants[0] };
    const understood = understandQuery("120hz");
    expect(hasUnverifiableHardRequirement(understood)).toBe(true);
    const hybrid = runHybridRetrieval({
      query: "120hz",
      normalizedQuery: "120hz",
      understood,
      structuredModels: [],
      semanticResult: semanticResult([{ variantId: v.id, modelId: m.id, score: 0.9, rank: 1 }]),
      allModels,
      filters: {},
    });
    expect(hybrid.semanticSuppressed).toBe(true);
    expect(hybrid.admissible).toHaveLength(0);
    expect(hybrid.admissibleModelIds.size).toBe(0);
  });

  it("semantic empty result (success but no matches) → structured only", () => {
    const understood = understandQuery("Dell");
    const structured = retrieveCandidates(understood, allModels, {});
    const hybrid = runHybridRetrieval({
      query: "Dell",
      normalizedQuery: "dell",
      understood,
      structuredModels: structured.candidates,
      semanticResult: semanticResult([]),
      allModels,
      filters: {},
    });
    expect(hybrid.semanticAvailable).toBe(false);
    expect(hybrid.observable.mergedCandidateCount).toBe(hybrid.observable.structuredCandidateCount);
    expect(hybrid.admissibleModelIds.size).toBeGreaterThan(0);
  });

  it("both failures → safe empty, never invents", () => {
    const hybrid = runHybridRetrieval({
      query: "gaming laptop",
      normalizedQuery: "gaming laptop",
      understood: understandQuery("gaming laptop"),
      structuredModels: [],
      semanticResult: failedSemantic(),
      allModels,
      filters: {},
    });
    expect(hybrid.admissible).toHaveLength(0);
    expect(hybrid.admissibleModelIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Integration (real catalog fixtures)
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — integration", () => {
  it("semantically strong but invalid candidate is excluded; valid candidate admitted", () => {
    const query = "Lenovo RTX 4060 16GB";
    const normalized = normalizeQuery(query);
    const understood = understandQuery(query);
    const emptyFilters: SearchFilters = {};
    const structured = retrieveCandidates(understood, allModels, emptyFilters);
    expect(structured.candidates.length).toBeGreaterThan(0);

    // Good: a real Lenovo variant that satisfies the hard criteria.
    const criteria = extractSpecCriteria(normalized.split(" "));
    const good = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => variantMatchesCriteria(x.v.specs, criteria))!;

    // Bad: a REAL variant that violates the criteria (semantically ranked high).
    const bad = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => !variantMatchesCriteria(x.v.specs, criteria))!;

    // Ghost: non-existent variant — must never survive.
    const ghost = { variantId: "synthetic-variant-zzz", modelId: good.m.id, score: 0.99, rank: 3 };

    const hybrid = runHybridRetrieval({
      query,
      normalizedQuery: normalized,
      understood,
      structuredModels: structured.candidates,
      semanticResult: semanticResult([
        { variantId: good.v.id, modelId: good.m.id, score: 0.92, rank: 1 },
        { variantId: bad.v.id, modelId: bad.m.id, score: 0.88, rank: 2 },
        ghost,
      ]),
      allModels,
      filters: {},
    });

    const admittedVariants = new Set(hybrid.admissible.map((c) => c.variantId));

    // Valid candidate admitted (directly from semantic, so source must exist).
    expect(admittedVariants.has(good.v.id)).toBe(true);
    expect(hybrid.admissibleModelIds.has(good.m.id)).toBe(true);

    // Invalid + ghost candidates excluded.
    expect(admittedVariants.has(bad.v.id)).toBe(false);
    expect(admittedVariants.has("synthetic-variant-zzz")).toBe(false);

    // Every admitted candidate corresponds to a REAL catalog variant.
    const catalogVariants = new Set<string>();
    for (const m of allModels) for (const v of m.variants) catalogVariants.add(v.id);
    for (const c of hybrid.admissible) {
      expect(catalogVariants.has(c.variantId)).toBe(true);
    }
  });

  it("dual-source candidate wins the fusion ranking in the real pipeline", () => {
    const query = "Lenovo RTX 4060 16GB";
    const normalized = normalizeQuery(query);
    const understood = understandQuery(query);
    const structured = retrieveCandidates(understood, allModels, {});

    const criteria = extractSpecCriteria(normalized.split(" "));
    const good = allModels
      .flatMap((m) => m.variants.map((v) => ({ m, v })))
      .find((x) => variantMatchesCriteria(x.v.specs, criteria))!;

    const hybrid = runHybridRetrieval({
      query,
      normalizedQuery: normalized,
      understood,
      structuredModels: structured.candidates,
      semanticResult: semanticResult([
        { variantId: good.v.id, modelId: good.m.id, score: 0.95, rank: 1 },
      ]),
      allModels,
      filters: {},
    });

    // The dual-source variant must have contributions from both paths recorded.
    const entry = hybrid.admissible.find((c) => c.variantId === good.v.id);
    expect(entry).toBeDefined();
    expect(entry!.structuredRank).toBeDefined();
    expect(entry!.semanticRank).toBe(1);
    expect(entry!.source).toBe("both");
  });

  it("hard-constraint preservation end-to-end via searchModels", async () => {
    const result = await searchModels("RTX 4060 16GB", {});
    expect(result.models.length).toBeGreaterThan(0);
    // Every returned model must have a REAL 16GB + RTX 4060 variant (same variant).
    for (const m of result.models) {
      const hasValid = m.variants.some(
        (v) => v.specs.ram === 16 && v.specs.gpu.toLowerCase().includes("rtx 4060")
      );
      expect(hasValid).toBe(true);
    }
  });

  it("brand hard-constraint preserved end-to-end via searchModels", async () => {
    const result = await searchModels("Lenovo RTX 4060 16GB", {});
    if (result.models.length > 0) {
      for (const m of result.models) {
        expect(m.brand.toLowerCase()).toBe("lenovo");
      }
    }
  });

  it("all searchModels results reference real catalog entities (anti-hallucination)", async () => {
    const catalogIds = new Set(allModels.map((m) => m.id));
    for (const q of ["gaming laptop", "Lenovo", "RTX 4060", "ThinkPad T14"]) {
      const result = await searchModels(q, {});
      for (const m of result.models) {
        expect(catalogIds.has(m.id)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Semantic result contract mapping
// ---------------------------------------------------------------------------

describe("Hybrid Fusion — semantic match contract mapping", () => {
  it("semanticMatchesToCandidates only maps successful matches", () => {
    expect(semanticMatchesToCandidates(failedSemantic())).toHaveLength(0);
    const mapped = semanticMatchesToCandidates(
      semanticResult([{ variantId: "V1", modelId: "M1", score: 0.5, rank: 2 }])
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({ variantId: "V1", modelId: "M1", rank: 2, source: "semantic", score: 0.5 });
  });

  it("structuredModelsToCandidates expands every real variant once", () => {
    const model = allModels[0];
    const cands = structuredModelsToCandidates([model]);
    expect(cands).toHaveLength(model.variants.length);
    expect(cands[0].modelId).toBe(model.id);
    expect(cands[0].rank).toBe(1);
  });
});