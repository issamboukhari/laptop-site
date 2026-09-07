/**
 * Phase 3.2.4 — Hybrid Retrieval / Fusion
 *
 * Combines Structured Candidate Retrieval (Phase 3.2.2) with Semantic
 * Retrieval (Phase 3.2.3) into ONE unified, deduplicated candidate set with
 * a reciprocal-rank-fusion (RRF) ranking signal.
 *
 * This module does NOT run either retrieval engine. It only CONSUMES their
 * outputs. The retrieval engines are imported by the caller (search.ts) and
 * executed concurrently there; this module fuses the two result lists.
 *
 * Core invariants:
 *   - Candidates carry canonical variant identity (variantId) — never merge
 *     different variants of the same model, never combine specs across
 *     variants, never synthesize a candidate.
 *   - Hard constraints (filters + GPU/CPU/RAM/storage criteria) are enforced
 *     by a gate that reuses the EXACT matching logic used by the existing
 *     search pipeline. Semantic similarity can never rescue a violating
 *     candidate.
 *   - Incompatible raw scores (structured score vs semantic similarity) are
 *     NOT directly combined — fusion is rank-based RRF.
 *
 * Trust invariant: this module never creates, invents, or modifies computer
 * data. Candidates either map to a real catalog variant or are excluded.
 */

import { ComputerModel, SearchFilters } from "../data/types";
import { IntelligentQuery } from "./query-understanding";
import {
  hasSpecCriteria,
  extractSpecCriteria,
  variantMatchesCriteria,
} from "./spec-criteria";
import {
  modelMatchesBaseFilters,
  variantMatchesFilters,
} from "./variant-matcher";
import { SemanticResult } from "./semantic-retrieval";

// ---------------------------------------------------------------------------
// Candidate contract
// ---------------------------------------------------------------------------

/** A candidate produced by one retrieval path. */
export interface RetrievalCandidate {
  variantId: string;
  modelId: string;
  rank: number;
  source: "structured" | "semantic";
  /** Optional raw score from the source (never combined across sources). */
  score?: number;
}

/** A fused candidate after RRF. */
export interface FusedCandidate {
  variantId: string;
  modelId: string;
  structuredRank?: number;
  semanticRank?: number;
  semanticScore?: number;
  /** Weighted RRF score — the ONLY cross-source signal. */
  rrfScore: number;
  /** Final rank after sorting by RRF score (1-based). */
  rank: number;
  source: "structured" | "semantic" | "both";
}

// ---------------------------------------------------------------------------
// Fusion configuration
// ---------------------------------------------------------------------------

export interface HybridFusionConfig {
  /** RRF smoothing constant (higher → rank distribution is flatter). */
  rrfK: number;
  /** Weight applied to the structured RRF contribution. */
  structuredWeight: number;
  /** Weight applied to the semantic RRF contribution. */
  semanticWeight: number;
}

/**
 * Production fusion configuration — centralized.
 *
 * Phase 3.2.5 calibration (lib/eval/runner.ts, tests/eval/calibration-report.json)
 * ran every combination of the documented matrix (rrfK 20–80, structured
 * weight 0.75–2.0, semantic weight 0.5–1.25) against the v1 evaluation
 * dataset. Result: 0/64 configurations produced a meaningful improvement
 * (max delta in overall tradeoff score ≈ 0.001, far below the 0.01 selection
 * threshold) and ALL configurations — including this one — had zero
 * hard-constraint violations. The deciding evidence was the multi-objective
 * guard: no configuration beat the baseline's core retrieval (exact/hardware/
 * combined) by a material margin, so changing weights would be over-fitting to
 * noise. Baseline is therefore RETAINED as the production default.
 *
 * Re-run `npm run calibrate` if the retrieval pipeline or catalog changes
 * substantively.
 */
export const HYBRID_CONFIG: HybridFusionConfig = {
  rrfK: 60,
  structuredWeight: 1,
  semanticWeight: 1,
} as const;

// ---------------------------------------------------------------------------
// Retrieval output → candidate contract
// ---------------------------------------------------------------------------

/**
 * Map structured retrieval output (model-level candidates) to variant-level
 * candidates. Each real variant of a retrieved model becomes a candidate
 * inheriting the model's positional rank. No variant is invented — variants
 * are taken verbatim from the catalog models.
 */
export function structuredModelsToCandidates(
  models: ComputerModel[]
): RetrievalCandidate[] {
  const out: RetrievalCandidate[] = [];
  models.forEach((m, i) => {
    for (const v of m.variants) {
      out.push({ variantId: v.id, modelId: m.id, rank: i + 1, source: "structured" });
    }
  });
  return out;
}

/**
 * Map semantic retrieval output (variant-level matches) to candidates.
 * Semantic matches already carry canonical variant/model IDs and rank+score.
 */
export function semanticMatchesToCandidates(
  semantic: SemanticResult
): RetrievalCandidate[] {
  if (!semantic.success) return [];
  return semantic.matches.map((m) => ({
    variantId: m.variantId,
    modelId: m.modelId,
    rank: m.rank,
    source: "semantic",
    score: m.score,
  }));
}

// ---------------------------------------------------------------------------
// RRF fusion
// ---------------------------------------------------------------------------

/**
 * Fuse two candidate lists into one deduplicated RRF-ranked pool.
 *
 * Identity key: variantId (canonical exact variant identity).
 * A variant present in both lists receives a contribution from both; a
 * variant present in one list only receives that list's contribution only.
 *
 * Rate:  1/(rrfK + rank) per contributing source.
 * Score: structuredWeight * rate(structured) + semanticWeight * rate(semantic).
 * Raw scores are never combined directly.
 */
export function fuseCandidates(
  structured: RetrievalCandidate[],
  semantic: RetrievalCandidate[],
  config: HybridFusionConfig = HYBRID_CONFIG
): FusedCandidate[] {
  const k = config.rrfK;
  const table = new Map<
    string,
    {
      modelId: string;
      sRank?: number;
      sScore?: number;
      mRank?: number;
      mScore?: number;
    }
  >();

  for (const c of structured) {
    const entry = table.get(c.variantId) ?? { modelId: c.modelId };
    entry.sRank = c.rank;
    entry.sScore = c.score;
    if (!entry.modelId) entry.modelId = c.modelId;
    table.set(c.variantId, entry);
  }
  for (const c of semantic) {
    const entry = table.get(c.variantId) ?? { modelId: c.modelId };
    entry.mRank = c.rank;
    entry.mScore = c.score;
    if (!entry.modelId) entry.modelId = c.modelId;
    table.set(c.variantId, entry);
  }

  const fused: FusedCandidate[] = [];
  for (const [variantId, e] of table) {
    const structuredRrf = e.sRank !== undefined ? 1 / (k + e.sRank) : 0;
    const semanticRrf = e.mRank !== undefined ? 1 / (k + e.mRank) : 0;
    const rrfScore =
      config.structuredWeight * structuredRrf +
      config.semanticWeight * semanticRrf;

    const source: FusedCandidate["source"] =
      e.sRank !== undefined && e.mRank !== undefined
        ? "both"
        : e.sRank !== undefined
        ? "structured"
        : "semantic";

    fused.push({
      variantId,
      modelId: e.modelId,
      structuredRank: e.sRank,
      semanticRank: e.mRank,
      semanticScore: e.mScore,
      rrfScore,
      rank: 0,
      source,
    });
  }

  // Deterministic ordering: RRF score desc, dual-source first on ties,
  // then variantId for full determinism.
  fused.sort(
    (a, b) =>
      b.rrfScore - a.rrfScore ||
      (a.source === "both" ? 0 : 1) - (b.source === "both" ? 0 : 1) ||
      a.variantId.localeCompare(b.variantId)
  );
  fused.forEach((c, i) => {
    c.rank = i + 1;
  });

  return fused;
}

// ---------------------------------------------------------------------------
// Hard constraint gate
// ---------------------------------------------------------------------------

export interface HardConstraintInput {
  /** Merged effective filters (explicit URL params override query-understood). */
  filters: SearchFilters;
  /** Query understanding output (used to detect unverifiable requirements). */
  understood: IntelligentQuery;
  /** Normalized query tokens — used to re-derive GPU/CPU/RAM/storage criteria. */
  normalizedQuery: string;
}

export interface GateResult {
  admissible: FusedCandidate[];
  excludedCount: number;
}

/**
 * Hard-constraint gate.
 *
 * Excludes any candidate that violates:
 *   - model-level filters (brand, family, category, year)
 *   - configuration-level filters (RAM, storage, price, screen, touchscreen)
 *   - query hardware criteria (GPU/CPU/RAM/storage terms, same-variant AND-match)
 *   - unknown/non-catalog variants (never admit an invented entity)
 *
 * Reuses variant-matcher + spec-criteria — the SAME logic the existing search
 * pipeline uses — so there is no second, divergent interpretation of a hard
 * requirement.
 */
export function applyHardConstraintGate(
  fused: FusedCandidate[],
  allModels: ComputerModel[],
  input: HardConstraintInput
): GateResult {
  const modelById = new Map(allModels.map((m) => [m.id, m]));

  const tokens = input.normalizedQuery.split(" ").filter((t) => t.length > 0);
  const criteria = extractSpecCriteria(tokens);
  const useCriteria = hasSpecCriteria(criteria);

  const admissible: FusedCandidate[] = [];
  let excludedCount = 0;

  for (const c of fused) {
    const model = modelById.get(c.modelId);
    if (!model) {
      excludedCount++;
      continue;
    }
    const variant = model.variants.find((v) => v.id === c.variantId);
    if (!variant) {
      excludedCount++;
      continue;
    }
    if (!modelMatchesBaseFilters(model, input.filters)) {
      excludedCount++;
      continue;
    }
    if (!variantMatchesFilters(variant, input.filters)) {
      excludedCount++;
      continue;
    }
    if (useCriteria && !variantMatchesCriteria(variant.specs, criteria)) {
      excludedCount++;
      continue;
    }
    admissible.push(c);
  }

  return { admissible, excludedCount };
}

// ---------------------------------------------------------------------------
// Hybrid orchestration
// ---------------------------------------------------------------------------

export interface HybridRetrievalInput {
  query: string;
  normalizedQuery: string;
  understood: IntelligentQuery;
  /** Structured retrieval candidate models (from candidate-retrieval.ts). */
  structuredModels: ComputerModel[];
  /** Semantic retrieval result (from semantic-retrieval.ts). */
  semanticResult: SemanticResult;
  allModels: ComputerModel[];
  filters: SearchFilters;
  config?: HybridFusionConfig;
}

export interface HybridObservability {
  structuredCandidateCount: number;
  semanticCandidateCount: number;
  mergedCandidateCount: number;
  finalCandidateCount: number;
  gateExcludedCount: number;
  sourceMembership: { structuredOnly: number; semanticOnly: number; both: number };
}

export interface HybridRetrievalResult {
  /** Fused + gated candidates, ranked by RRF. */
  admissible: FusedCandidate[];
  /** Model IDs that still have ≥1 admissible variant (feeds existing resolution). */
  admissibleModelIds: Set<string>;
  observable: HybridObservability;
  /** True when semantic retrieval actually produced matches. */
  semanticAvailable: boolean;
  /**
   * True when semantic-only rescue was suppressed because structured
   * retrieval failed AND the query carries a hard requirement the gate
   * cannot verify (e.g. refresh rate).
   */
  semanticSuppressed: boolean;
}

/**
 * True when the query carries a hard requirement that the gate cannot verify
 * through SearchFilters or SpecCriteria. Semantic-only rescue must not be
 * allowed to bypass such a requirement.
 */
export function hasUnverifiableHardRequirement(
  understood: IntelligentQuery
): boolean {
  const req = understood.hardRequirements;
  return req.minRefreshRate !== undefined || req.maxRefreshRate !== undefined;
}

/**
 * Run the full Phase 3.2.4 fusion pipeline over already-computed retrieval
 * outputs: contract mapping → RRF fusion → hard-constraint gate.
 *
 * NEVER throws. Failure paths collapse to a safe, possibly empty result.
 */
export function runHybridRetrieval(
  input: HybridRetrievalInput
): HybridRetrievalResult {
  const structuredCandidates = structuredModelsToCandidates(input.structuredModels);
  const semanticCandidates = semanticMatchesToCandidates(input.semanticResult);

  const fused = fuseCandidates(structuredCandidates, semanticCandidates, input.config);

  const gateInput: HardConstraintInput = {
    filters: input.filters,
    understood: input.understood,
    normalizedQuery: input.normalizedQuery,
  };
  const { admissible, excludedCount } = applyHardConstraintGate(fused, input.allModels, gateInput);

  // Structured-failure protection: if structured contributed nothing and the
  // query carries a hard requirement the gate cannot verify, semantic-only
  // rescue is UNSAFE — return safe empty instead.
  let finalAdmissible = admissible;
  let semanticSuppressed = false;
  if (
    structuredCandidates.length === 0 &&
    semanticCandidates.length > 0 &&
    hasUnverifiableHardRequirement(input.understood)
  ) {
    finalAdmissible = [];
    semanticSuppressed = true;
  }

  const admissibleModelIds = new Set(finalAdmissible.map((c) => c.modelId));

  const membership = { structuredOnly: 0, semanticOnly: 0, both: 0 };
  for (const c of finalAdmissible) {
    if (c.source === "both") membership.both++;
    else if (c.source === "structured") membership.structuredOnly++;
    else membership.semanticOnly++;
  }

  return {
    admissible: finalAdmissible,
    admissibleModelIds,
    observable: {
      structuredCandidateCount: structuredCandidates.length,
      semanticCandidateCount: semanticCandidates.length,
      mergedCandidateCount: fused.length,
      finalCandidateCount: finalAdmissible.length,
      gateExcludedCount: excludedCount,
      sourceMembership: membership,
    },
    semanticAvailable: input.semanticResult.success && input.semanticResult.matches.length > 0,
    semanticSuppressed,
  };
}