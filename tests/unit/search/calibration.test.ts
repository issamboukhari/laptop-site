import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import { searchModels } from "@/lib/server/search";
import { understandQuery } from "@/lib/server/query-understanding";
import { understoodQueryToFilters } from "@/lib/server/query-to-filters";
import { retrieveCandidates } from "@/lib/server/candidate-retrieval";
import { runHybridRetrieval, HYBRID_CONFIG } from "@/lib/server/hybrid-retrieval";
import {
  SEARCH_EVALUATION_QUERIES,
  EVALUATION_GROUPS,
} from "@/tests/fixtures/search-evaluation";
import {
  calibrate,
  buildConfigMatrix,
  SELECTION_RULES,
  isHardConstraintViolation,
} from "@/lib/eval/runner";
import { surrogateSemanticRetrieval } from "@/lib/eval/semantic-surrogate";
import { SEMANTIC_TOP_K } from "@/lib/server/semantic-retrieval";
import {
  recallAt,
  precisionAt,
  reciprocalRank,
  ndcgAt,
  evaluateRanking,
  meanRankingMetrics,
} from "@/lib/eval/metrics";
import type { ComputerModel } from "@/lib/data/types";

const models: ComputerModel[] = [];

beforeAll(async () => {
  models.push(...(await getAllModels()));
});

function variantIndex(models: ComputerModel[]): Map<string, ComputerModel> {
  const map = new Map<string, ComputerModel>();
  for (const m of models) for (const v of m.variants) map.set(v.id, m);
  return map;
}

function hybridAdmissible(models: ComputerModel[], query: string): string[] {
  const understood = understandQuery(query);
  const filters = { ...understoodQueryToFilters(understood) };
  const normalizedQuery = (understood.normalizedQuery ?? query.toLowerCase().replace(/[^\w\s.+-]/g, " ").trim()).replace(/\s+/g, " ");
  const structured = retrieveCandidates(understood, models, filters);
  const semantic = surrogateSemanticRetrieval(query, models);
  const hybrid = runHybridRetrieval({
    query,
    normalizedQuery,
    understood,
    structuredModels: structured.candidates,
    semanticResult: semantic,
    allModels: models,
    filters,
    config: HYBRID_CONFIG,
  });
  return hybrid.admissible.map((c) => c.variantId);
}

// ---------------------------------------------------------------------------
// Metrics math
// ---------------------------------------------------------------------------

describe("Phase 3.2.5 — metrics unit math", () => {
  it("recallAt counts unique relevant hits against the relevant pool", () => {
    const relevant = new Set(["a", "c"]);
    expect(recallAt(["a", "b", "c"], relevant, 1)).toBe(0.5);
    expect(recallAt(["a", "b", "c"], relevant, 3)).toBe(1);
    expect(recallAt(["x", "y"], relevant, 10)).toBe(0);
    expect(recallAt(["a"], new Set(), 5)).toBe(0);
  });

  it("precisionAt divides by the requested window size", () => {
    const relevant = new Set(["a", "c"]);
    expect(precisionAt(["a", "b", "c"], relevant, 3)).toBe(2 / 3);
    expect(precisionAt(["a", "b"], relevant, 3)).toBe(1 / 3);
    expect(precisionAt([], relevant, 5)).toBe(0);
  });

  it("reciprocalRank returns inverse of first hit position", () => {
    expect(reciprocalRank(["a", "b", "c"], new Set(["b"]))).toBe(0.5);
    expect(reciprocalRank(["a"], new Set(["a"]))).toBe(1);
    expect(reciprocalRank(["x"], new Set(["a"]))).toBe(0);
  });

  it("ndcgAt is 1 for a perfect ranking and 0 for no hits", () => {
    const relevant = new Set(["a", "b"]);
    expect(ndcgAt(["a", "b"], relevant, 2)).toBeCloseTo(1);
    expect(ndcgAt(["b", "a"], relevant, 2)).toBeCloseTo(1);
    expect(ndcgAt(["x", "y"], relevant, 2)).toBe(0);
    const partial = ndcgAt(["a", "x", "b"], relevant, 3);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
  });

  it("evaluateRanking exposes the full metric record", () => {
    const m = evaluateRanking(["a", "b", "c"], new Set(["a", "c"]));
    expect(m.recall[5]).toBe(1);
    expect(m.precision[3]).toBe(2 / 3);
    expect(m.mrr).toBe(1);
    expect(m.ndcg[5]).toBeGreaterThan(0);
  });

  it("meanRankingMetrics macro-averages across rows", () => {
    const avg = meanRankingMetrics([
      evaluateRanking(["a"], new Set(["a"])),
      evaluateRanking(["b"], new Set(["a"])),
    ]);
    expect(avg.mrr).toBe(0.5);
    expect(avg.recall[1]).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Semantic surrogate
// ---------------------------------------------------------------------------

describe("Phase 3.2.5 — semantic surrogate", () => {
  it("is deterministic across runs", () => {
    expect(surrogateSemanticRetrieval("laptop with RTX 4060", models)).toEqual(
      surrogateSemanticRetrieval("laptop with RTX 4060", models)
    );
  });

  it("returns matches sorted by score desc with no duplicate variants", () => {
    const r = surrogateSemanticRetrieval("powerful laptop for gaming", models);
    const scores = r.matches.map((m) => m.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const ids = r.matches.map((m) => m.variantId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(SEMANTIC_TOP_K);
  });

  it("returns no matches for pure Arabic without Latin tokens (English docs, documented)", () => {
    const r = surrogateSemanticRetrieval("حاسوب قوي للبرمجة", models);
    expect(r.success).toBe(true);
    expect(r.matches.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Evaluation dataset sanity
// ---------------------------------------------------------------------------

describe("Phase 3.2.5 — evaluation dataset sanity", () => {
  it("every query has at least one relevant variant backed by real catalog data", () => {
    expect(models.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const q of SEARCH_EVALUATION_QUERIES) {
      let relevant = 0;
      for (const m of models) {
        for (const v of m.variants) {
          if (q.relevant(m, v)) { relevant++; ids.add(v.id); }
        }
      }
      expect(relevant, `query ${q.id} has no relevant variant`).toBeGreaterThan(0);
    }
    expect(ids.size).toBeGreaterThan(0);
  });

  it("query ids are unique and groups are valid", () => {
    const ids = SEARCH_EVALUATION_QUERIES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of SEARCH_EVALUATION_QUERIES) {
      expect(EVALUATION_GROUPS).toContain(q.group);
    }
    for (const g of EVALUATION_GROUPS) {
      expect(SEARCH_EVALUATION_QUERIES.filter((q) => q.group === g).length).toBeGreaterThan(0);
    }
  });

  it("relevance labels are deterministic", () => {
    const m0 = models[0];
    const v0 = m0.variants[0];
    for (const q of SEARCH_EVALUATION_QUERIES) {
      expect(q.relevant(m0, v0)).toBe(q.relevant(m0, v0));
    }
  });
});

// ---------------------------------------------------------------------------
// Calibration integrity
// ---------------------------------------------------------------------------

describe("Phase 3.2.5 — calibration integrity", () => {
  let report: ReturnType<typeof calibrate>;

  beforeAll(() => {
    report = calibrate({ queries: SEARCH_EVALUATION_QUERIES, allModels: models });
  });

  it("buildConfigMatrix covers the full 4×4×4 grid", () => {
    const matrix = buildConfigMatrix();
    expect(matrix.length).toBe(64);
    const labels = new Set(matrix.map((c) => `${c.rrfK},${c.structuredWeight},${c.semanticWeight}`));
    expect(labels.size).toBe(64);
  });

  it("every configuration in the matrix has ZERO hard-constraint violations", () => {
    for (const row of report.configs) {
      expect(row.violations, `config ${row.label} violates hard constraints`).toBe(0);
      expect(row.violationRate).toBe(0);
    }
  });

  it("baseline is selected when no configuration improves meaningfully (no over-fitting)", () => {
    expect(report.selected.isBaseline).toBe(true);
    const baselineRow = report.configs.find((r) => r.isBaseline)!;
    expect(report.selected.tradeoffScore).toBeGreaterThanOrEqual(baselineRow.tradeoffScore);
    // No eligible candidate exceeded the meaningful-improvement threshold.
    const beaten = report.configs.filter(
      (r) => !r.isBaseline && r.tradeoffScore >= baselineRow.tradeoffScore + SELECTION_RULES.minImprovement
    );
    expect(beaten).toHaveLength(0);
  });

  it("covariant 3.2.5 selection rules are exported and finite", () => {
    expect(SELECTION_RULES.minCoreRetention).toBeGreaterThan(0);
    expect(SELECTION_RULES.minImprovement).toBeGreaterThan(0);
  });

  it("all metrics stay in [0,1] and groups are reported", () => {
    expect(report.dataset.queryCount).toBe(SEARCH_EVALUATION_QUERIES.length);
    for (const g of EVALUATION_GROUPS) {
      const m = report.selected.byGroup[g];
      expect(m).toBeDefined();
      for (const mrr of [m!.mrr, m!.recall[5], m!.precision[5], m!.ndcg[5]]) {
        expect(mrr).toBeGreaterThanOrEqual(0);
        expect(mrr).toBeLessThanOrEqual(1);
      }
    }
  });

  it("pure-Arabic queries have no surrogate semantic input (documented)", () => {
    const hasLatinToken = (s: string) => /[A-Za-z0-9]/.test(s);
    for (const q of report.selected.perQuery) {
      if (q.group === "arabic" && !hasLatinToken(q.query)) {
        expect(q.semanticAvailable, `${q.queryId} should be structured-only`).toBe(false);
      }
    }
    expect(report.selected.semanticAvailableRate).toBeLessThan(1);
  });

  it("admissible lists are duplicate-free and internally consistent", () => {
    const idx = variantIndex(models);
    const ids = hybridAdmissible(models, "laptop with RTX 4060");
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(idx.has(id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression — production pipeline with validated fusion weights
// ---------------------------------------------------------------------------

describe("Phase 3.2.5 — ranking regression (baseline HYBRID_CONFIG retained)", () => {
  const idx = () => variantIndex(models);

  const findRelevant = (query: string, qid: string, cap = Infinity): string[] => {
    const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
    const relevant = new Set<string>();
    for (const m of models) for (const v of m.variants) if (q.relevant(m, v)) relevant.add(v.id);
    const admissible = hybridAdmissible(models, query);
    return relevantIdsInOrder(relevant, admissible, cap);
  };

  const relevantIdsInOrder = (relevant: Set<string>, ranked: string[], cap: number): string[] =>
    ranked.filter((id, i) => i < cap && relevant.has(id));

  it("exact model queries surface the exact family in the admissible set", () => {
    // Trace: exact variants are present (they are the authoritative result set).
    for (const qid of ["exact-elitebook-840-g8", "exact-t14-gen4", "exact-t14-gen3", "exact-x1-carbon-g11", "exact-macbook-air-m4"]) {
      const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
      const found = findRelevant(q.query, qid);
      expect(found.length, `${qid} lost its exact variants`).toBeGreaterThan(0);
    }
  });

  it("hardware queries keep the right variants in the admissible set", () => {
    for (const qid of ["hw-rtx4060-16gb", "hw-rtx4060", "hw-ryzen7-16gb", "hw-1tb-core-i7", "hw-16gb"]) {
      const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
      const found = findRelevant(q.query, qid);
      expect(found.length, `${qid} lost its relevant variants`).toBeGreaterThan(0);
    }
  });

  it("combined queries keep the right variants in the admissible set", () => {
    for (const qid of ["comb-lenovo-gaming-4060-16", "comb-hp-16gb-512gb", "comb-thinkpad-32gb", "comb-lenovo-i7-16gb"]) {
      const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
      const found = findRelevant(q.query, qid);
      expect(found.length, `${qid} lost its relevant variants`).toBeGreaterThan(0);
    }
  });

  it("semantic intent queries surface relevant variants in the admissible set", () => {
    for (const qid of ["sem-programming", "sem-gaming", "sem-portable-battery", "sem-university"]) {
      const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
      const found = findRelevant(q.query, qid);
      expect(found.length, `${qid} lost its relevant variants`).toBeGreaterThan(0);
    }
  });

  it("Arabic queries (structured-only path) keep relevant variants", () => {
    for (const qid of ["ar-rtx4060", "ar-light-battery", "ar-programming"]) {
      const q = SEARCH_EVALUATION_QUERIES.find((x) => x.id === qid)!;
      const found = findRelevant(q.query, qid);
      expect(found.length, `${qid} lost its relevant variants`).toBeGreaterThan(0);
    }
  });

  it("independent violation check agrees with zero-violation guarantee", () => {
    for (const q of SEARCH_EVALUATION_QUERIES) {
      const understood = understandQuery(q.query);
      const admissible = hybridAdmissible(models, q.query);
      for (const id of admissible) {
        const m = idx().get(id)!;
        const v = m.variants.find((x) => x.id === id)!;
        expect(
          isHardConstraintViolation(m, v, understood, understood.normalizedQuery ?? q.query),
          `${q.id}: candidate ${id} violates hard constraints`
        ).toBe(false);
      }
    }
  });

  describe("production smoke via searchModels", () => {
    it("ThinkPad family search surfaces real T14 models through the production endpoint", async () => {
      const r = await searchModels("ThinkPad T14", {});
      const hit = r.models.some(
        (m) => m.brand === "Lenovo" && m.name.toLowerCase().includes("t14")
      );
      expect(r.models.length).toBeGreaterThan(0);
      expect(hit).toBe(true);
    });

    it("RTX 4060 16GB hardware query is preserved through production", async () => {
      const r = await searchModels("RTX 4060 16GB", {});
      expect(r.models.length).toBeGreaterThan(0);
      for (const m of r.models) {
        const hasValid = m.variants.some(
          (v) => v.specs.ram === 16 && v.specs.gpu.toLowerCase().includes("rtx 4060")
        );
        expect(hasValid).toBe(true);
      }
    });
  });
});