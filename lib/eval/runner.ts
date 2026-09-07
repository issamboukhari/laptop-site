import type { ComputerModel, ComputerVariant, SearchFilters } from "../data/types";
import { understandQuery } from "../server/query-understanding";
import { understoodQueryToFilters } from "../server/query-to-filters";
import { retrieveCandidates } from "../server/candidate-retrieval";
import {
  runHybridRetrieval,
  HYBRID_CONFIG,
  type HybridFusionConfig,
} from "../server/hybrid-retrieval";
import { extractSpecCriteria, hasSpecCriteria, variantMatchesCriteria } from "../server/spec-criteria";
import type { EvaluationQuery, EvaluationGroup } from "../../tests/fixtures/search-evaluation";
import { evaluateRanking, meanRankingMetrics, type RankingMetrics } from "./metrics";
import { SURROGATE_SEMANTIC_SOURCE, type SemanticSource } from "./semantic-surrogate";
import type { SemanticResult } from "../server/semantic-retrieval";

/**
 * Phase 3.2.5 — Calibration orchestration.
 *
 * Runs the EXISTING hybrid pipeline (structured retrieval → fusion → gate)
 * per query per configuration, then aggregates ranking metrics by group.
 * Semantic input is provided by an injectable source (default: the
 * deterministic offline surrogate), so the whole calibration is reproducible
 * with no network access.
 */

// ---------------------------------------------------------------------------
// Independent hard-constraint violation check
// ---------------------------------------------------------------------------

/**
 * Independently re-derives the query's EXPLICIT requirements (from query
 * understanding + spec-criteria) and checks a candidate against them.
 * This is intentionally NOT the pipeline's own gate — it exists to catch
 * violations that a ranking improvement could smuggle past the gate
 * (e.g. refresh-rate / screen-size requirements that are not mappable to
 * SearchFilters or SpecCriteria).
 */
export function isHardConstraintViolation(
  model: ComputerModel,
  variant: ComputerVariant,
  understood: ReturnType<typeof understandQuery>,
  normalizedQuery: string
): boolean {
  const req = understood.hardRequirements;

  if (req.brand && model.brand.toLowerCase() !== req.brand.toLowerCase()) return true;
  if (req.category && model.category !== req.category) return true;

  const s = variant.specs;
  if (req.minRam !== undefined && s.ram < req.minRam) return true;
  if (req.maxRam !== undefined && s.ram > req.maxRam) return true;
  if (req.minStorage !== undefined && s.storage < req.minStorage) return true;
  if (req.maxStorage !== undefined && s.storage > req.maxStorage) return true;
  if (req.minPrice !== undefined && variant.price < req.minPrice) return true;
  if (req.maxPrice !== undefined && variant.price > req.maxPrice) return true;
  if (req.minScreenSize !== undefined && s.displaySize < req.minScreenSize) return true;
  if (req.maxScreenSize !== undefined && s.displaySize > req.maxScreenSize) return true;
  if (req.minRefreshRate !== undefined && s.displayRefreshRate < req.minRefreshRate) return true;
  if (req.maxRefreshRate !== undefined && s.displayRefreshRate > req.maxRefreshRate) return true;
  if (req.touchscreen === true && !s.touchscreen) return true;

  const tokens = normalizedQuery.split(" ").filter((t) => t.length > 0);
  const criteria = extractSpecCriteria(tokens);
  if (hasSpecCriteria(criteria) && !variantMatchesCriteria(s, criteria)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Configuration grid
// ---------------------------------------------------------------------------

export const PARAM_GRID = {
  rrfK: [20, 40, 60, 80],
  structuredWeight: [0.75, 1, 1.5, 2],
  semanticWeight: [0.5, 0.75, 1, 1.25],
} as const;

export function buildConfigMatrix(): HybridFusionConfig[] {
  const out: HybridFusionConfig[] = [];
  for (const rrfK of PARAM_GRID.rrfK) {
    for (const structuredWeight of PARAM_GRID.structuredWeight) {
      for (const semanticWeight of PARAM_GRID.semanticWeight) {
        out.push({ rrfK, structuredWeight, semanticWeight });
      }
    }
  }
  return out;
}

export function configLabel(c: HybridFusionConfig): string {
  return `${c.structuredWeight}/${c.semanticWeight}/${c.rrfK}`;
}

/**
 * Documented selection rules (spec §10/§13/§14):
 *  - minCoreRetention: a candidate may not lose more than 0.02 Recall@5 on the
 *    exact/hardware/combined core vs baseline (exact hardware queries are
 *    authoritative and must not be degraded).
 *  - minImprovement: tradeoffScore must beat baseline by a meaningful margin;
 *    sub-noise deltas on a small dataset must NOT change production defaults.
 */
export const SELECTION_RULES = {
  minCoreRetention: 0.02,
  minImprovement: 0.01,
} as const;

// ---------------------------------------------------------------------------
// Evaluation of a single (query, config) pair
// ---------------------------------------------------------------------------

interface QueryContext {
  query: EvaluationQuery;
  understood: ReturnType<typeof understandQuery>;
  filters: SearchFilters;
  normalizedQuery: string;
  structuredModels: ComputerModel[];
  semanticResult: SemanticResult;
  relevant: Set<string>;
}

export interface QueryEvidence {
  queryId: string;
  group: EvaluationGroup;
  query: string;
  relevantCount: number;
  semanticAvailable: boolean;
  metrics: RankingMetrics;
  violations: number;
  admissibleCount: number;
}

export interface ConfigMetricRow {
  config: HybridFusionConfig;
  label: string;
  isBaseline: boolean;
  overall: RankingMetrics;
  byGroup: Partial<Record<EvaluationGroup, RankingMetrics>>;
  violations: number;
  evaluatedCandidates: number;
  violationRate: number;
  coreRetrieval: number;
  semanticQuality: number;
  tradeoffScore: number;
  semanticAvailableRate: number;
  perQuery: QueryEvidence[];
}

export interface CalibrationReport {
  dataset: {
    version: string;
    queryCount: number;
    groups: Record<string, number>;
    catalogModelCount: number;
    catalogVariantCount: number;
    labeledRelevantPairs: number;
  };
  baseline: HybridFusionConfig;
  matrixSize: number;
  semanticSource: "surrogate" | "live";
  configs: ConfigMetricRow[];
  selected: ConfigMetricRow;
}

export interface CalibrateOptions {
  queries: EvaluationQuery[];
  allModels: ComputerModel[];
  configs?: HybridFusionConfig[];
  semanticSource?: SemanticSource;
}

const R5 = (m: RankingMetrics) => m.recall[5] ?? 0;

function configDistance(a: HybridFusionConfig, b: HybridFusionConfig): number {
  return (
    Math.abs(a.rrfK - b.rrfK) +
    Math.abs(a.structuredWeight - b.structuredWeight) +
    Math.abs(a.semanticWeight - b.semanticWeight)
  );
}

function sameConfig(a: HybridFusionConfig, b: HybridFusionConfig): boolean {
  return a.rrfK === b.rrfK && a.structuredWeight === b.structuredWeight && a.semanticWeight === b.semanticWeight;
}

export function calibrate(options: CalibrateOptions): CalibrationReport {
  const { queries, allModels } = options;
  const configs = options.configs ?? buildConfigMatrix();
  const semanticSource = options.semanticSource ?? SURROGATE_SEMANTIC_SOURCE;

  const baseline = { ...HYBRID_CONFIG };
  const variantIndex = new Map<string, { model: ComputerModel; variant: ComputerVariant }>();
  for (const m of allModels) {
    for (const v of m.variants) variantIndex.set(v.id, { model: m, variant: v });
  }

  // --- Build per-query context once (retrieval is config-independent) ---
  const contexts: QueryContext[] = queries.map((query) => {
    const understood = understandQuery(query.query);
    const filters: SearchFilters = { ...understoodQueryToFilters(understood) };
    const normalizedQuery = (
      understood.normalizedQuery ??
      query.query.toLowerCase().replace(/[^\w\s.+-]/g, " ").trim()
    ).replace(/\s+/g, " ");
    const structured = retrieveCandidates(understood, allModels, filters);
    const semanticResult = semanticSource(query.query, allModels);
    const relevant = new Set<string>();
    for (const m of allModels) {
      for (const v of m.variants) {
        if (query.relevant(m, v)) relevant.add(v.id);
      }
    }
    return {
      query,
      understood,
      filters,
      normalizedQuery,
      structuredModels: structured.candidates,
      semanticResult,
      relevant,
    };
  });

  // --- Evaluate every configuration ---
  const rows: ConfigMetricRow[] = configs.map((config) => {
    const perQuery: QueryEvidence[] = contexts.map((ctx) => {
      const hybrid = runHybridRetrieval({
        query: ctx.query.query,
        normalizedQuery: ctx.normalizedQuery,
        understood: ctx.understood,
        structuredModels: ctx.structuredModels,
        semanticResult: ctx.semanticResult,
        allModels,
        filters: ctx.filters,
        config,
      });
      const ids = hybrid.admissible.map((c) => c.variantId);
      const metrics = evaluateRanking(ids, ctx.relevant);
      let violations = 0;
      for (const c of hybrid.admissible) {
        const lookup = variantIndex.get(c.variantId);
        if (!lookup) continue;
        if (isHardConstraintViolation(lookup.model, lookup.variant, ctx.understood, ctx.normalizedQuery)) {
          violations++;
        }
      }
      return {
        queryId: ctx.query.id,
        group: ctx.query.group,
        query: ctx.query.query,
        relevantCount: ctx.relevant.size,
        semanticAvailable: ctx.semanticResult.success && ctx.semanticResult.matches.length > 0,
        metrics,
        violations,
        admissibleCount: hybrid.admissible.length,
      };
    });

    const overall = meanRankingMetrics(perQuery.map((q) => q.metrics));
    const byGroup: Partial<Record<EvaluationGroup, RankingMetrics>> = {};
    const groups = [...new Set(perQuery.map((q) => q.group))];
    for (const g of groups) {
      byGroup[g] = meanRankingMetrics(perQuery.filter((q) => q.group === g).map((q) => q.metrics));
    }

    const coreGroups: EvaluationGroup[] = ["exact", "hardware", "combined"];
    const coreRows = coreGroups.map((g) => byGroup[g]).filter((m): m is RankingMetrics => m !== undefined);
    const coreRetrieval = coreRows.length ? coreRows.reduce((t, m) => t + R5(m), 0) / coreRows.length : 0;
    const semanticQuality = byGroup.semantic ? R5(byGroup.semantic) : 0;

    const violations = perQuery.reduce((t, q) => t + q.violations, 0);
    const evaluatedCandidates = perQuery.reduce((t, q) => t + q.admissibleCount, 0);

    return {
      config,
      label: configLabel(config),
      isBaseline: sameConfig(config, baseline),
      overall,
      byGroup,
      violations,
      evaluatedCandidates,
      violationRate: evaluatedCandidates > 0 ? violations / evaluatedCandidates : 0,
      coreRetrieval,
      semanticQuality,
      tradeoffScore: 0.5 * coreRetrieval + 0.3 * semanticQuality + 0.2 * overall.mrr,
      semanticAvailableRate:
        perQuery.filter((q) => q.semanticAvailable).length / perQuery.length,
      perQuery,
    };
  });

  // --- Selection: reject violations or core regressions, require a MEANINGFUL
  // overall improvement (noise-level deltas on a small dataset must not change
  // production), then pick the best survivor. ------
  const baselineRow = rows.find((r) => r.isBaseline)!;
  const eligible = rows.filter(
    (r) =>
      r.violationRate === 0 &&
      r.coreRetrieval >= baselineRow.coreRetrieval - SELECTION_RULES.minCoreRetention &&
      r.tradeoffScore >= baselineRow.tradeoffScore + SELECTION_RULES.minImprovement
  );
  const candidates = eligible.length > 0 ? eligible : [baselineRow];
  candidates.sort(
    (a, b) =>
      b.tradeoffScore - a.tradeoffScore ||
      configDistance(a.config, baseline) - configDistance(b.config, baseline)
  );
  const selected = candidates[0];

  const catalogVariantCount = allModels.reduce((t, m) => t + m.variants.length, 0);
  const labeledRelevantPairs = contexts.reduce((t, ctx) => t + ctx.relevant.size, 0);
  const groupCounts: Record<string, number> = {};
  for (const q of queries) groupCounts[q.group] = (groupCounts[q.group] ?? 0) + 1;

  return {
    dataset: {
      version: "v1",
      queryCount: queries.length,
      groups: groupCounts,
      catalogModelCount: allModels.length,
      catalogVariantCount,
      labeledRelevantPairs,
    },
    baseline,
    matrixSize: configs.length,
    semanticSource: options.semanticSource ? "live" : "surrogate",
    configs: rows,
    selected,
  };
}