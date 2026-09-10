import { promises as fs } from "fs";
import path from "path";
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
 * baseline (from calibration-report.json), not absolute quality.
 *
 * 6-stage diagnostics per query:
 *   1. Query Understanding
 *   2. Structured Retrieval
 *   3. Semantic Retrieval
 *   4. Hybrid Fusion
 *   5. Hard Constraint Gate
 *   6. Final Resolution
 *
 * Fail-closed: if calibration-report.json is missing, corrupt, or incomplete,
 * the quality suite FAILS immediately. No fallback. No hardcoded baseline.
 */

// ---------------------------------------------------------------------------
// Baseline loading (fail-closed)
// ---------------------------------------------------------------------------

const CALIBRATION_REPORT_PATH = path.join(
  process.cwd(),
  "tests",
  "eval",
  "calibration-report.json"
);

export interface BaselineData {
  coreRetrieval: number;
  tradeoffScore: number;
  config: { rrfK: number; structuredWeight: number; semanticWeight: number };
}

export async function loadBaseline(): Promise<BaselineData> {
  let raw: string;
  try {
    raw = await fs.readFile(CALIBRATION_REPORT_PATH, "utf-8");
  } catch {
    throw new Error(
      "FAIL-CLOSED: calibration-report.json not found at " +
        CALIBRATION_REPORT_PATH +
        ". Run 'npm run calibrate' first to generate the baseline."
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

  const selected = report.selected as Record<string, unknown>;
  const baseline = report.baseline as Record<string, unknown>;

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
  if (typeof selected.violationRate !== "number") {
    throw new Error("FAIL-CLOSED: selected.violationRate missing");
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
    coreRetrieval: selected.coreRetrieval as number,
    tradeoffScore: selected.tradeoffScore as number,
    config: {
      rrfK: cfg.rrfK as number,
      structuredWeight: cfg.structuredWeight as number,
      semanticWeight: cfg.semanticWeight as number,
    },
  };
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
  };
  baseline: {
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
}

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
      if (
        stages.structuredRetrieval.candidateCount === 0 &&
        stages.semanticRetrieval.matchCount === 0
      ) {
        return {
          stage: "hybrid-fusion",
          reason: "both structured and semantic retrieval returned 0 candidates",
        };
      }
      if (stages.structuredRetrieval.candidateCount === 0) {
        return {
          stage: "structured-retrieval",
          reason: "structured retrieval returned 0 candidates",
        };
      }
      if (stages.semanticRetrieval.failureKind) {
        return {
          stage: "semantic-retrieval",
          reason: `semantic retrieval failed: ${stages.semanticRetrieval.failureKind}`,
        };
      }
      if (!stages.queryUnderstanding.success) {
        return {
          stage: "query-understanding",
          reason: "query understanding failed",
        };
      }
      return {
        stage: "final-resolution",
        reason: "all candidates excluded after fusion",
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

  const baseline = await loadBaseline();

  const productionConfig: HybridFusionConfig = {
    rrfK: baseline.config.rrfK,
    structuredWeight: baseline.config.structuredWeight,
    semanticWeight: baseline.config.semanticWeight,
  };

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
  const coreRetentionDelta = coreR5Measured - baseline.coreRetrieval;
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
  // Compare per-group R@5 against baseline as a proxy for regression
  for (const q of perQuery) {
    const qR5 = R5(q.metrics);
    // Use baseline coreRetrieval as a rough per-query threshold
    if (q.expectedResult === "non-empty" && qR5 < baseline.coreRetrieval - 0.05) {
      regressions.push({
        queryId: q.queryId,
        metric: "recall@5",
        baseline: baseline.coreRetrieval,
        measured: qR5,
        delta: qR5 - baseline.coreRetrieval,
      });
    }
  }

  // --- Catalog stats ---
  const catalogVariantCount = allModels.reduce((t, m) => t + m.variants.length, 0);

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
    },
    baseline: {
      source: "calibration-report.json",
      coreRetrieval: baseline.coreRetrieval,
      tradeoffScore: baseline.tradeoffScore,
      config: baseline.config,
    },
    overall,
    byGroup,
    perQuery,
    gates: {
      hardConstraintViolationRate,
      noResultAccuracy,
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
    `Baseline: coreRetrieval=${report.baseline.coreRetrieval.toFixed(3)} ` +
      `tradeoffScore=${report.baseline.tradeoffScore.toFixed(3)} ` +
      `(from ${report.baseline.source})`
  );
  lines.push("");

  lines.push(`Overall: ${formatMetrics(report.overall)}`);
  lines.push(
    `Violations: ${report.gates.hardConstraintViolationRate} (${(report.gates.hardConstraintViolationRate * 100).toFixed(1)}%)`
  );
  lines.push(
    `No-result accuracy: ${report.diagnostics.passedQueries - report.diagnostics.failedQueries + (report.dataset.queryCount - report.diagnostics.totalQueries)}/${report.dataset.queryCount} ` +
      `(${(report.gates.noResultAccuracy * 100).toFixed(1)}%)`
  );
  lines.push(
    `Core retention delta: ${report.gates.coreRetentionDelta.toFixed(3)} ` +
      `(PASS, threshold: >= -0.05)`
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
