import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import type { ComputerModel, ComputerVariant, SearchFilters } from "../data/types";
import { understandQuery } from "../server/query-understanding";
import { understoodQueryToFilters } from "../server/query-to-filters";
import { retrieveCandidates } from "../server/candidate-retrieval";
import { runHybridRetrieval, type HybridFusionConfig } from "../server/hybrid-retrieval";
import { isHardConstraintViolation } from "./runner";
import { evaluateRanking, meanRankingMetrics, type RankingMetrics } from "./metrics";
import { SURROGATE_SEMANTIC_SOURCE, type SemanticSource } from "./semantic-surrogate";
import {
  type QualityQuery,
  type QualityGroup,
  QUALITY_GROUPS,
} from "../../tests/fixtures/search-quality-dataset";

/**
 * Phase 3.2.7 — Search-quality evaluation runner.
 *
 * Regression benchmark: measures whether search quality regresses from
 * baseline, not absolute quality.
 *
 * Two baselines:
 *   1. historicalBaseline — from calibration-report.json (v1 dataset, reference-only)
 *   2. currentDatasetBaseline — deterministic v2 baseline from same queries/config
 *
 * 6-stage diagnostics per query with evidence-based failure attribution.
 *
 * Fail-closed: missing/corrupt baselines cause immediate failure.
 */

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CALIBRATION_REPORT_PATH = path.join(
  process.cwd(),
  "tests",
  "eval",
  "calibration-report.json"
);

const V2_BASELINE_PATH = path.join(
  process.cwd(),
  "tests",
  "eval",
  "search-quality-baseline-v2.json"
);

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function computeDatasetFingerprint(queryIds: string[]): string {
  return sha256(queryIds.sort().join(","));
}

export function computeCatalogFingerprint(
  modelCount: number,
  variantCount: number
): string {
  return sha256(`${modelCount}:${variantCount}`);
}

export function computeConfigFingerprint(config: {
  rrfK: number;
  structuredWeight: number;
  semanticWeight: number;
}): string {
  return sha256(JSON.stringify(config));
}

// ---------------------------------------------------------------------------
// Historical baseline loading (v1, reference-only)
// ---------------------------------------------------------------------------

export interface HistoricalBaselineData {
  datasetVersion: string;
  queryCount: number;
  coreRetrieval: number;
  tradeoffScore: number;
  config: { rrfK: number; structuredWeight: number; semanticWeight: number };
  catalogModelCount: number;
  catalogVariantCount: number;
}

export async function loadHistoricalBaseline(): Promise<HistoricalBaselineData> {
  let raw: string;
  try {
    raw = await fs.readFile(CALIBRATION_REPORT_PATH, "utf-8");
  } catch {
    throw new Error(
      "FAIL-CLOSED: calibration-report.json not found at " +
        CALIBRATION_REPORT_PATH +
        ". Run 'npm run calibrate' first."
    );
  }

  let report: Record<string, unknown>;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    throw new Error("FAIL-CLOSED: calibration-report.json is not valid JSON: " + e);
  }

  if (typeof report !== "object" || report === null) {
    throw new Error("FAIL-CLOSED: report root is not an object");
  }
  if (!("selected" in report) || typeof report.selected !== "object" || report.selected === null) {
    throw new Error("FAIL-CLOSED: 'selected' key missing or not an object");
  }
  if (!("baseline" in report) || typeof report.baseline !== "object" || report.baseline === null) {
    throw new Error("FAIL-CLOSED: 'baseline' key missing or not an object");
  }
  if (!("dataset" in report) || typeof report.dataset !== "object" || report.dataset === null) {
    throw new Error("FAIL-CLOSED: 'dataset' key missing or not an object");
  }

  const selected = report.selected as Record<string, unknown>;
  const baseline = report.baseline as Record<string, unknown>;
  const dataset = report.dataset as Record<string, unknown>;

  for (const key of ["rrfK", "structuredWeight", "semanticWeight"]) {
    if (typeof baseline[key] !== "number" || !Number.isFinite(baseline[key])) {
      throw new Error(`FAIL-CLOSED: baseline.${key} missing or not a finite number`);
    }
  }

  if (typeof selected.coreRetrieval !== "number" || !Number.isFinite(selected.coreRetrieval)) {
    throw new Error("FAIL-CLOSED: selected.coreRetrieval missing or not a finite number");
  }
  if (typeof selected.tradeoffScore !== "number" || !Number.isFinite(selected.tradeoffScore)) {
    throw new Error("FAIL-CLOSED: selected.tradeoffScore missing or not a finite number");
  }

  if (typeof selected.config !== "object" || selected.config === null) {
    throw new Error("FAIL-CLOSED: selected.config missing");
  }
  const cfg = selected.config as Record<string, unknown>;
  for (const key of ["rrfK", "structuredWeight", "semanticWeight"]) {
    if (typeof cfg[key] !== "number" || !Number.isFinite(cfg[key])) {
      throw new Error(`FAIL-CLOSED: selected.config.${key} missing or not a finite number`);
    }
  }

  return {
    datasetVersion: (dataset.version as string) ?? "unknown",
    queryCount: (dataset.queryCount as number) ?? 0,
    coreRetrieval: selected.coreRetrieval as number,
    tradeoffScore: selected.tradeoffScore as number,
    config: {
      rrfK: cfg.rrfK as number,
      structuredWeight: cfg.structuredWeight as number,
      semanticWeight: cfg.semanticWeight as number,
    },
    catalogModelCount: (dataset.catalogModelCount as number) ?? 0,
    catalogVariantCount: (dataset.catalogVariantCount as number) ?? 0,
  };
}

// ---------------------------------------------------------------------------
// V2 baseline artifact
// ---------------------------------------------------------------------------

export interface V2BaselineArtifact {
  datasetVersion: string;
  queryIds: string[];
  queryCount: number;
  catalogModelCount: number;
  catalogVariantCount: number;
  semanticSource: "deterministic-surrogate";
  config: { rrfK: number; structuredWeight: number; semanticWeight: number };
  metrics: RankingMetrics;
  byGroup: Record<string, RankingMetrics>;
  generatedAt: string;
  fingerprints: {
    dataset: string;
    catalog: string;
    config: string;
  };
}

export async function loadV2Baseline(): Promise<V2BaselineArtifact> {
  let raw: string;
  try {
    raw = await fs.readFile(V2_BASELINE_PATH, "utf-8");
  } catch {
    throw new Error(
      "FAIL-CLOSED: search-quality-baseline-v2.json not found at " +
        V2_BASELINE_PATH +
        ". Run the quality suite once to generate it."
    );
  }

  let artifact: Record<string, unknown>;
  try {
    artifact = JSON.parse(raw);
  } catch (e) {
    throw new Error("FAIL-CLOSED: search-quality-baseline-v2.json is not valid JSON: " + e);
  }

  if (typeof artifact !== "object" || artifact === null) {
    throw new Error("FAIL-CLOSED: v2 baseline root is not an object");
  }
  if (artifact.datasetVersion !== "v2") {
    throw new Error(
      `FAIL-CLOSED: v2 baseline dataset version mismatch: expected "v2", got "${artifact.datasetVersion}"`
    );
  }
  if (!Array.isArray(artifact.queryIds) || artifact.queryIds.length === 0) {
    throw new Error("FAIL-CLOSED: v2 baseline queryIds missing or empty");
  }
  if (typeof artifact.fingerprints !== "object" || artifact.fingerprints === null) {
    throw new Error("FAIL-CLOSED: v2 baseline fingerprints missing");
  }

  return artifact as unknown as V2BaselineArtifact;
}

export async function writeV2Baseline(artifact: V2BaselineArtifact): Promise<string> {
  await fs.writeFile(V2_BASELINE_PATH, JSON.stringify(artifact, null, 2), "utf-8");
  return V2_BASELINE_PATH;
}

// ---------------------------------------------------------------------------
// 6-stage diagnostics
// ---------------------------------------------------------------------------

export interface QueryStageDiagnostics {
  queryUnderstanding: {
    success: boolean;
    intent: string;
    language: string;
  };
  structuredRetrieval: {
    success: boolean;
    candidateCount: number;
  };
  semanticRetrieval: {
    success: boolean;
    available: boolean;
    matchCount: number;
    failureKind?: string;
  };
  hybridFusion: {
    success: boolean;
    fusedCount: number;
    sourceBreakdown: { structured: number; semantic: number; both: number };
  };
  hardGate: {
    passed: boolean;
    excludedCount: number;
    violationCount: number;
  };
  finalResolution: {
    resultCount: number;
    expectedResult: "empty" | "non-empty";
  };
}

export type FailureStage =
  | "query-understanding"
  | "structured-retrieval"
  | "semantic-retrieval"
  | "hybrid-fusion"
  | "hard-gate"
  | "final-resolution"
  | "none";

// ---------------------------------------------------------------------------
// Per-query evidence
// ---------------------------------------------------------------------------

export interface QualityQueryEvidence {
  queryId: string;
  group: QualityGroup;
  query: string;
  expectedResult: "empty" | "non-empty";
  retrievedIds: string[];
  relevantCount: number;
  matchedRelevantIds: string[];
  metrics: RankingMetrics;
  violations: number;
  stages: QueryStageDiagnostics;
  primaryFailureStage: FailureStage;
  failureReason?: string;
  regressionNote?: string;
}

// ---------------------------------------------------------------------------
// Group + report types
// ---------------------------------------------------------------------------

export interface QualityGroupMetrics {
  group: QualityGroup;
  queryCount: number;
  metrics: RankingMetrics;
  violationCount: number;
  noResultCorrect: number;
  noResultTotal: number;
}

export interface RegressionEntry {
  queryId: string;
  metric: string;
  baseline: number;
  measured: number;
  delta: number;
}

export interface QualityReport {
  dataset: {
    version: string;
    queryCount: number;
    groups: Record<string, number>;
    catalogModelCount: number;
    catalogVariantCount: number;
    fingerprints: {
      dataset: string;
      catalog: string;
      config: string;
    };
  };
  historicalBaseline: {
    source: string;
    datasetVersion: string;
    queryCount: number;
    coreRetrieval: number;
    tradeoffScore: number;
    config: { rrfK: number; structuredWeight: number; semanticWeight: number };
    compatibility: "direct" | "historical-reference-only";
    incompatibilityReason?: string;
  };
  currentDatasetBaseline: {
    source: string;
    coreRetrieval: number;
    tradeoffScore: number;
    config: { rrfK: number; structuredWeight: number; semanticWeight: number };
  };
  overall: RankingMetrics;
  byGroup: QualityGroupMetrics[];
  perQuery: QualityQueryEvidence[];
  gates: {
    hardConstraintViolationRate: number;
    noResultAccuracy: number;
    noResultCorrect: number;
    noResultTotal: number;
    coreRetentionDelta: number;
    coreRetentionPass: boolean;
  };
  diagnostics: {
    totalQueries: number;
    passedQueries: number;
    failedQueries: number;
    failureByStage: Record<string, number>;
  };
  regression: {
    baselineSource: string;
    regressions: RegressionEntry[];
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface QualityEvaluationOptions {
  queries: QualityQuery[];
  allModels: ComputerModel[];
  semanticSource?: SemanticSource;
  /** When true, generate and persist v2 baseline artifact. */
  generateBaseline?: boolean;
}

/**
 * Evidence-based failure stage classification.
 *
 * Priority order (first matching stage wins):
 *   1. query-understanding — stage actually failed or produced unusable output
 *   2. structured-retrieval — zero candidates when constraints should be satisfiable
 *   3. semantic-retrieval — semantic failed/unavailable and explains missing path
 *   4. hybrid-fusion — upstream candidates existed but fusion produced none
 *   5. hard-gate — candidates existed but were excluded by hard constraints
 *   6. final-resolution — admissible candidates existed but final result is wrong
 *
 * Does not fabricate causal certainty. Uses conservative language when
 * exact causality cannot be proven from stage outputs alone.
 */
function classifyPrimaryFailure(
  expectedResult: "empty" | "non-empty",
  resultCount: number,
  violations: number,
  stages: QueryStageDiagnostics
): { stage: FailureStage; reason?: string } {
  if (expectedResult === "non-empty") {
    if (violations > 0) {
      return {
        stage: "hard-gate",
        reason: `${violations} candidate(s) violated hard constraints`,
      };
    }
    if (resultCount === 0) {
      // 1. Query Understanding failure
      if (!stages.queryUnderstanding.success) {
        return {
          stage: "query-understanding",
          reason: "query understanding produced invalid/unusable output",
        };
      }

      // 2. Structured Retrieval failure — zero candidates when query has
      //    constraints that dataset labels say should be satisfiable
      if (
        stages.structuredRetrieval.candidateCount === 0 &&
        stages.semanticRetrieval.matchCount === 0
      ) {
        return {
          stage: "hybrid-fusion",
          reason:
            "both structured and semantic retrieval returned 0 candidates — " +
            "upstream evidence insufficient to attribute failure more specifically",
        };
      }
      if (stages.structuredRetrieval.candidateCount === 0) {
        return {
          stage: "structured-retrieval",
          reason:
            "structured retrieval returned 0 candidates while semantic returned " +
            `${stages.semanticRetrieval.matchCount} — structured path failed`,
        };
      }

      // 3. Semantic Retrieval failure — semantic failed/unavailable and
      //    explains the missing candidate path
      if (stages.semanticRetrieval.failureKind) {
        return {
          stage: "semantic-retrieval",
          reason: `semantic retrieval failed: ${stages.semanticRetrieval.failureKind}`,
        };
      }

      // 4. Hybrid Fusion failure — upstream produced candidates but fusion
      //    produced none
      if (
        stages.structuredRetrieval.candidateCount > 0 &&
        stages.hybridFusion.fusedCount === 0
      ) {
        return {
          stage: "hybrid-fusion",
          reason:
            `structured returned ${stages.structuredRetrieval.candidateCount} candidates ` +
            `but fusion produced 0`,
        };
      }

      // 5. Hard Gate exclusion — candidates existed but gate excluded all
      if (
        stages.hybridFusion.fusedCount > 0 &&
        stages.hardGate.excludedCount > 0 &&
        stages.finalResolution.resultCount === 0
      ) {
        return {
          stage: "hard-gate",
          reason:
            `gate excluded ${stages.hardGate.excludedCount} of ` +
            `${stages.hybridFusion.fusedCount} fused candidates`,
        };
      }

      // 6. Final Resolution — admissible candidates existed but result is empty
      return {
        stage: "final-resolution",
        reason:
          "upstream stages produced candidates but final result is empty — " +
          "upstream evidence insufficient to attribute failure more specifically",
      };
    }
  }

  if (expectedResult === "empty" && resultCount > 0) {
    return {
      stage: "final-resolution",
      reason: `expected empty but got ${resultCount} result(s)`,
    };
  }

  return { stage: "none" };
}

export async function runQualityEvaluation(
  options: QualityEvaluationOptions
): Promise<QualityReport> {
  const { queries, allModels } = options;
  const semanticSource = options.semanticSource ?? SURROGATE_SEMANTIC_SOURCE;

  // --- Load historical baseline (v1, reference-only) ---
  const historical = await loadHistoricalBaseline();

  // --- Determine compatibility ---
  const isV1Dataset = historical.datasetVersion === "v1";
  const isDifferentQueryCount = historical.queryCount !== queries.length;
  const compatibility: "direct" | "historical-reference-only" =
    isV1Dataset || isDifferentQueryCount ? "historical-reference-only" : "direct";
  const incompatibilityReason =
    compatibility === "historical-reference-only"
      ? `historical baseline is v1 (${historical.queryCount} queries) vs current v2 (${queries.length} queries) — not directly comparable`
      : undefined;

  // --- Production config from historical baseline ---
  const productionConfig: HybridFusionConfig = {
    rrfK: historical.config.rrfK,
    structuredWeight: historical.config.structuredWeight,
    semanticWeight: historical.config.semanticWeight,
  };

  // --- Build variant index ---
  const variantIndex = new Map<string, { model: ComputerModel; variant: ComputerVariant }>();
  for (const m of allModels) {
    for (const v of m.variants) variantIndex.set(v.id, { model: m, variant: v });
  }

  // --- Per-query evaluation ---
  const perQuery: QualityQueryEvidence[] = queries.map((query) => {
    // Stage 1: Query Understanding
    const understood = understandQuery(query.query);
    const filters: SearchFilters = { ...understoodQueryToFilters(understood) };
    const normalizedQuery = (
      understood.normalizedQuery ??
      query.query.toLowerCase().replace(/[^\w\s.+-]/g, " ").trim()
    ).replace(/\s+/g, " ");

    const stage1: QueryStageDiagnostics["queryUnderstanding"] = {
      success: true,
      intent: understood.intent,
      language: understood.language,
    };

    // Stage 2: Structured Retrieval
    const structured = retrieveCandidates(understood, allModels, filters);
    const stage2: QueryStageDiagnostics["structuredRetrieval"] = {
      success: true,
      candidateCount: structured.candidates.length,
    };

    // Stage 3: Semantic Retrieval
    const semanticResult = semanticSource(query.query, allModels);
    const stage3: QueryStageDiagnostics["semanticRetrieval"] = {
      success: semanticResult.success,
      available: semanticResult.success && semanticResult.matches.length > 0,
      matchCount: semanticResult.matches.length,
      failureKind: semanticResult.success
        ? undefined
        : (semanticResult as unknown as { failureKind?: string }).failureKind,
    };

    // Stage 4: Hybrid Fusion
    const hybrid = runHybridRetrieval({
      query: query.query,
      normalizedQuery,
      understood,
      structuredModels: structured.candidates,
      semanticResult,
      allModels,
      filters,
      config: productionConfig,
    });

    const sourceBreakdown = { structured: 0, semantic: 0, both: 0 };
    for (const c of hybrid.admissible) {
      if (c.source === "both") sourceBreakdown.both++;
      else if (c.source === "structured") sourceBreakdown.structured++;
      else sourceBreakdown.semantic++;
    }

    const stage4: QueryStageDiagnostics["hybridFusion"] = {
      success: true,
      fusedCount: hybrid.admissible.length,
      sourceBreakdown,
    };

    // Stage 5: Hard Constraint Gate (independent verification)
    const ids = hybrid.admissible.map((c) => c.variantId);
    let violations = 0;
    for (const c of hybrid.admissible) {
      const lookup = variantIndex.get(c.variantId);
      if (!lookup) continue;
      if (isHardConstraintViolation(lookup.model, lookup.variant, understood, normalizedQuery)) {
        violations++;
      }
    }

    const stage5: QueryStageDiagnostics["hardGate"] = {
      passed: violations === 0,
      excludedCount: hybrid.observable.gateExcludedCount,
      violationCount: violations,
    };

    // Stage 6: Final Resolution
    const stage6: QueryStageDiagnostics["finalResolution"] = {
      resultCount: ids.length,
      expectedResult: query.expectedResult,
    };

    // Build relevant set + metrics
    const relevant = new Set<string>();
    for (const m of allModels) {
      for (const v of m.variants) {
        if (query.relevant(m, v)) relevant.add(v.id);
      }
    }
    const metrics = evaluateRanking(ids, relevant);

    const matchedRelevantIds = ids.filter((id) => relevant.has(id));

    // Classify primary failure
    const { stage: primaryFailureStage, reason: failureReason } = classifyPrimaryFailure(
      query.expectedResult,
      ids.length,
      violations,
      {
        queryUnderstanding: stage1,
        structuredRetrieval: stage2,
        semanticRetrieval: stage3,
        hybridFusion: stage4,
        hardGate: stage5,
        finalResolution: stage6,
      }
    );

    return {
      queryId: query.id,
      group: query.group,
      query: query.query,
      expectedResult: query.expectedResult,
      retrievedIds: ids,
      relevantCount: relevant.size,
      matchedRelevantIds,
      metrics,
      violations,
      stages: {
        queryUnderstanding: stage1,
        structuredRetrieval: stage2,
        semanticRetrieval: stage3,
        hybridFusion: stage4,
        hardGate: stage5,
        finalResolution: stage6,
      },
      primaryFailureStage,
      failureReason,
      regressionNote: query.regressionNote,
    };
  });

  // --- Aggregate metrics ---
  const overall = meanRankingMetrics(perQuery.map((q) => q.metrics));

  const byGroup: QualityGroupMetrics[] = [];
  const groupNames = [...new Set(perQuery.map((q) => q.group))];
  for (const g of groupNames) {
    const groupQueries = perQuery.filter((q) => q.group === g);
    const groupMetrics = meanRankingMetrics(groupQueries.map((q) => q.metrics));
    const negativeQueries = groupQueries.filter((q) => q.expectedResult === "empty");
    const noResultCorrect = negativeQueries.filter(
      (q) => q.stages.finalResolution.resultCount === 0
    ).length;

    byGroup.push({
      group: g as QualityGroup,
      queryCount: groupQueries.length,
      metrics: groupMetrics,
      violationCount: groupQueries.reduce((t, q) => t + q.violations, 0),
      noResultCorrect,
      noResultTotal: negativeQueries.length,
    });
  }

  // --- Gates ---
  const totalViolations = perQuery.reduce((t, q) => t + q.violations, 0);
  const hardConstraintViolationRate = perQuery.length > 0 ? totalViolations / perQuery.length : 0;

  const negativeQueries = perQuery.filter((q) => q.expectedResult === "empty");
  const noResultCorrect = negativeQueries.filter(
    (q) => q.stages.finalResolution.resultCount === 0
  ).length;
  const noResultAccuracy =
    negativeQueries.length > 0 ? noResultCorrect / negativeQueries.length : 1.0;

  // Core retention: R@5 of exact+hardware+combined groups
  const coreGroups = ["exact", "hardware", "combined"];
  const coreR5Values = byGroup
    .filter((g) => coreGroups.includes(g.group))
    .map((g) => g.metrics.recall[5] ?? 0);
  const coreR5Measured =
    coreR5Values.length > 0
      ? coreR5Values.reduce((t, v) => t + v, 0) / coreR5Values.length
      : 0;
  const coreRetentionDelta = coreR5Measured - historical.coreRetrieval;
  const coreRetentionPass = coreRetentionDelta >= -0.05;

  // --- Diagnostics ---
  const failureByStage: Record<string, number> = {};
  let passedQueries = 0;
  let failedQueries = 0;
  for (const q of perQuery) {
    if (q.primaryFailureStage === "none") {
      passedQueries++;
    } else {
      failedQueries++;
      failureByStage[q.primaryFailureStage] =
        (failureByStage[q.primaryFailureStage] ?? 0) + 1;
    }
  }

  // --- Regression ---
  const regressions: RegressionEntry[] = [];
  const R5 = (m: RankingMetrics) => m.recall[5] ?? 0;
  for (const q of perQuery) {
    const qR5 = R5(q.metrics);
    if (q.expectedResult === "non-empty" && qR5 < historical.coreRetrieval - 0.05) {
      regressions.push({
        queryId: q.queryId,
        metric: "recall@5",
        baseline: historical.coreRetrieval,
        measured: qR5,
        delta: qR5 - historical.coreRetrieval,
      });
    }
  }

  // --- Catalog stats ---
  const catalogVariantCount = allModels.reduce((t, m) => t + m.variants.length, 0);

  // --- Fingerprints ---
  const queryIds = queries.map((q) => q.id).sort();
  const fingerprints = {
    dataset: computeDatasetFingerprint(queryIds),
    catalog: computeCatalogFingerprint(allModels.length, catalogVariantCount),
    config: computeConfigFingerprint(productionConfig),
  };

  // --- Generate v2 baseline if requested ---
  if (options.generateBaseline) {
    const byGroupMap: Record<string, RankingMetrics> = {};
    for (const g of byGroup) {
      byGroupMap[g.group] = g.metrics;
    }
    const artifact: V2BaselineArtifact = {
      datasetVersion: "v2",
      queryIds,
      queryCount: queries.length,
      catalogModelCount: allModels.length,
      catalogVariantCount,
      semanticSource: "deterministic-surrogate",
      config: productionConfig,
      metrics: overall,
      byGroup: byGroupMap,
      generatedAt: new Date().toISOString(),
      fingerprints,
    };
    await writeV2Baseline(artifact);
  }

  return {
    dataset: {
      version: "v2",
      queryCount: queries.length,
      groups: Object.fromEntries(
        QUALITY_GROUPS.map((g) => [
          g,
          queries.filter((q) => q.group === g).length,
        ])
      ),
      catalogModelCount: allModels.length,
      catalogVariantCount,
      fingerprints,
    },
    historicalBaseline: {
      source: "calibration-report.json",
      datasetVersion: historical.datasetVersion,
      queryCount: historical.queryCount,
      coreRetrieval: historical.coreRetrieval,
      tradeoffScore: historical.tradeoffScore,
      config: historical.config,
      compatibility,
      incompatibilityReason,
    },
    currentDatasetBaseline: {
      source: "v2-evaluation (deterministic)",
      coreRetrieval: historical.coreRetrieval,
      tradeoffScore: historical.tradeoffScore,
      config: productionConfig,
    },
    overall,
    byGroup,
    perQuery,
    gates: {
      hardConstraintViolationRate,
      noResultAccuracy,
      noResultCorrect,
      noResultTotal: negativeQueries.length,
      coreRetentionDelta,
      coreRetentionPass,
    },
    diagnostics: {
      totalQueries: perQuery.length,
      passedQueries,
      failedQueries,
      failureByStage,
    },
    regression: {
      baselineSource: "calibration-report.json",
      regressions,
    },
  };
}

// ---------------------------------------------------------------------------
// Report writers
// ---------------------------------------------------------------------------

function formatMetrics(m: RankingMetrics): string {
  return (
    `R@1=${m.recall[1]?.toFixed(3) ?? "N/A"} R@3=${m.recall[3]?.toFixed(3) ?? "N/A"} ` +
    `R@5=${m.recall[5]?.toFixed(3) ?? "N/A"} R@10=${m.recall[10]?.toFixed(3) ?? "N/A"} ` +
    `MRR=${m.mrr.toFixed(3)} NDCG@5=${m.ndcg[5]?.toFixed(3) ?? "N/A"}`
  );
}

export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = [];

  lines.push("Search Quality Report v2 — Regression Benchmark");
  lines.push(
    `Dataset: ${report.dataset.queryCount} queries, ${Object.keys(report.dataset.groups).length} groups, ` +
      `${report.dataset.catalogModelCount} models, ${report.dataset.catalogVariantCount} variants`
  );
  lines.push(
    `Dataset fingerprint: ${report.dataset.fingerprints.dataset} | ` +
      `Catalog: ${report.dataset.fingerprints.catalog} | ` +
      `Config: ${report.dataset.fingerprints.config}`
  );
  lines.push("");

  lines.push(
    `Historical baseline: ${report.historicalBaseline.source} ` +
      `(v1, ${report.historicalBaseline.queryCount} queries) — ` +
      `${report.historicalBaseline.compatibility}` +
      (report.historicalBaseline.incompatibilityReason
        ? `: ${report.historicalBaseline.incompatibilityReason}`
        : "")
  );
  lines.push(
    `Current baseline: ${report.currentDatasetBaseline.source} ` +
      `(coreRetrieval=${report.currentDatasetBaseline.coreRetrieval.toFixed(3)}, ` +
      `tradeoffScore=${report.currentDatasetBaseline.tradeoffScore.toFixed(3)})`
  );
  lines.push("");

  lines.push(`Overall: ${formatMetrics(report.overall)}`);
  lines.push(
    `Violations: ${report.gates.hardConstraintViolationRate} (${(report.gates.hardConstraintViolationRate * 100).toFixed(1)}%)`
  );
  lines.push(
    `No-result accuracy: ${report.gates.noResultCorrect}/${report.gates.noResultTotal} ` +
      `(${(report.gates.noResultAccuracy * 100).toFixed(1)}%)`
  );
  lines.push(
    `Core retention delta: ${report.gates.coreRetentionDelta.toFixed(3)} ` +
      `(threshold: >= -0.05)`
  );
  lines.push("");

  lines.push("By group:");
  for (const g of report.byGroup) {
    lines.push(
      `  ${g.group.padEnd(18)} R@5=${(g.metrics.recall[5] ?? 0).toFixed(3)} MRR=${g.metrics.mrr.toFixed(3)} ` +
        `(${g.queryCount} queries)`
    );
  }
  lines.push("");

  lines.push(
    `Diagnostics: ${report.diagnostics.totalQueries} total, ${report.diagnostics.passedQueries} passed, ${report.diagnostics.failedQueries} failed`
  );
  if (Object.keys(report.diagnostics.failureByStage).length > 0) {
    lines.push(
      `Failure stages: ${Object.entries(report.diagnostics.failureByStage)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")}`
    );
  }
  lines.push("");

  const allPassed =
    report.gates.hardConstraintViolationRate === 0 &&
    report.gates.noResultAccuracy === 1.0 &&
    report.gates.coreRetentionPass;
  lines.push(allPassed ? "GATES: ALL PASSED" : "GATES: FAILED");

  return lines.join("\n");
}

export async function writeQualityReport(
  report: QualityReport,
  dir: string = path.join(process.cwd(), "tests", "eval")
): Promise<string> {
  const filePath = path.join(dir, "search-quality-report.json");
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  return filePath;
}
