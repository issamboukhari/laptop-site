import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { getAllModels } from "@/lib/server/database";
import {
  QUALITY_QUERIES,
  QUALITY_DATASET_VERSION,
  QUALITY_GROUPS,
} from "@/tests/fixtures/search-quality-dataset";
import type { ComputerModel, ComputerVariant } from "@/lib/data/types";
import { SURROGATE_SEMANTIC_SOURCE } from "@/lib/eval/semantic-surrogate";
import {
  runQualityEvaluation,
  formatQualityReport,
  writeQualityReport,
  loadHistoricalBaseline,
  loadV2Baseline,
  writeV2Baseline,
  computeDatasetFingerprint,
  computeCatalogFingerprint,
  computeConfigFingerprint,
  type QualityReport,
  type V2BaselineArtifact,
} from "@/lib/eval/quality";

/**
 * Phase 3.2.7 — Search Quality Suite v2 (Regression Benchmark).
 *
 * Mandatory gates:
 *   1. HardConstraintViolationRate === 0
 *   2. NoResultAccuracy === 1
 *   3. Core retention does not regress beyond -0.05
 *
 * Run explicitly with:  npm run test-search-quality
 */

const REPORT_PATH = path.join(
  process.cwd(),
  "tests",
  "eval",
  "search-quality-report.json"
);

const V2_BASELINE_PATH = path.join(
  process.cwd(),
  "tests",
  "eval",
  "search-quality-baseline-v2.json"
);

describe("Search Quality Suite v2 — Regression Benchmark", () => {
  let report: QualityReport;
  let allModels: Awaited<ReturnType<typeof getAllModels>>;

  beforeAll(async () => {
    allModels = await getAllModels();

    // Generate v2 baseline artifact if it doesn't exist
    let v2BaselineExists = false;
    try {
      await fs.access(V2_BASELINE_PATH);
      v2BaselineExists = true;
    } catch {
      // not found
    }

    if (!v2BaselineExists) {
      await runQualityEvaluation({
        queries: QUALITY_QUERIES,
        allModels,
        semanticSource: SURROGATE_SEMANTIC_SOURCE,
        generateBaseline: true,
      });
    }

    report = await runQualityEvaluation({
      queries: QUALITY_QUERIES,
      allModels,
      semanticSource: SURROGATE_SEMANTIC_SOURCE,
    });
  });

  // =========================================================================
  // Dataset integrity
  // =========================================================================

  describe("Dataset integrity", () => {
    it("dataset is v2", () => {
      expect(QUALITY_DATASET_VERSION).toBe("v2");
    });

    it("has 45 queries across 9 groups", () => {
      expect(QUALITY_QUERIES.length).toBe(45);
      expect(QUALITY_GROUPS.length).toBe(9);
    });

    it("every group is represented in queries", () => {
      for (const group of QUALITY_GROUPS) {
        const count = QUALITY_QUERIES.filter((q) => q.group === group).length;
        expect(count).toBeGreaterThan(0);
      }
    });

    it("every non-negative query has expectedResult: non-empty", () => {
      for (const q of QUALITY_QUERIES) {
        if (q.group !== "negative") {
          expect(q.expectedResult).toBe("non-empty");
        }
      }
    });

    it("every negative query has expectedResult: empty", () => {
      for (const q of QUALITY_QUERIES) {
        if (q.group === "negative") {
          expect(q.expectedResult).toBe("empty");
        }
      }
    });

    it("every negative query has relevant: () => false", () => {
      for (const q of QUALITY_QUERIES) {
        if (q.group === "negative") {
          const fakeModel = {
            id: "m",
            brand: "Test",
            name: "Test",
            category: "gaming-laptop",
            year: 2024,
            description: "Test",
            imageUrl: "",
            variants: [],
          } as unknown as ComputerModel;
          const fakeVariant = {
            id: "v",
            modelId: "m",
            name: "Test",
            brand: "Test",
            category: "gaming-laptop",
            price: 0,
            imageUrl: "",
            specs: {},
            rating: 0,
            reviewCount: 0,
            year: 2024,
            description: "Test",
          } as unknown as ComputerVariant;
          const result = q.relevant(fakeModel, fakeVariant);
          expect(result).toBe(false);
        }
      }
    });

    it("relevance labels are deterministic (idempotent)", () => {
      for (const q of QUALITY_QUERIES) {
        const fakeModel = {
          id: "m1",
          brand: "Lenovo",
          name: "ThinkPad T14 Gen 4",
          category: "business-laptop",
          year: 2024,
          description: "Test model",
          imageUrl: "",
          variants: [],
        } as unknown as ComputerModel;
        const fakeVariant = {
          id: "v1",
          modelId: "m1",
          name: "Test",
          brand: "Lenovo",
          category: "business-laptop",
          price: 1000,
          imageUrl: "",
          specs: { ram: 16, cpu: "Intel Core i7", gpu: "RTX 4060", storage: 512 },
          rating: 0,
          reviewCount: 0,
          year: 2024,
          description: "Test",
        } as unknown as ComputerVariant;
        const r1 = q.relevant(fakeModel, fakeVariant);
        const r2 = q.relevant(fakeModel, fakeVariant);
        expect(r1).toBe(r2);
      }
    });
  });

  // =========================================================================
  // Baseline compatibility
  // =========================================================================

  describe("Baseline compatibility", () => {
    it("historical calibration report loads successfully", async () => {
      const historical = await loadHistoricalBaseline();
      expect(historical.datasetVersion).toBeDefined();
      expect(historical.coreRetrieval).toBeGreaterThanOrEqual(0);
      expect(historical.tradeoffScore).toBeGreaterThanOrEqual(0);
    });

    it("incompatible historical baseline is marked historical-reference-only", () => {
      // v1 historical baseline has 21 queries, v2 has 45 — incompatible
      expect(report.historicalBaseline.compatibility).toBe("historical-reference-only");
      expect(report.historicalBaseline.incompatibilityReason).toBeDefined();
      expect(report.historicalBaseline.incompatibilityReason).toContain("v1");
      expect(report.historicalBaseline.incompatibilityReason).toContain("v2");
    });

    it("v2 baseline artifact exists and matches Dataset v2", async () => {
      const v2 = await loadV2Baseline();
      expect(v2.datasetVersion).toBe("v2");
      expect(v2.queryCount).toBe(45);
      expect(v2.queryIds.length).toBe(45);
      expect(v2.semanticSource).toBe("deterministic-surrogate");
    });

    it("v2 baseline fingerprints match current dataset", async () => {
      const v2 = await loadV2Baseline();
      expect(v2.fingerprints.dataset).toBe(report.dataset.fingerprints.dataset);
      expect(v2.fingerprints.catalog).toBe(report.dataset.fingerprints.catalog);
      expect(v2.fingerprints.config).toBe(report.dataset.fingerprints.config);
    });

    it("no hidden hardcoded fallback exists", () => {
      // The report explicitly distinguishes historical vs current baseline
      expect(report.historicalBaseline.source).toBe("calibration-report.json");
      expect(report.currentDatasetBaseline.source).toContain("v2-evaluation");
    });

    it("fingerprints are computed deterministically", () => {
      const queryIds = QUALITY_QUERIES.map((q) => q.id).sort();
      const ds = computeDatasetFingerprint(queryIds);
      const cat = computeCatalogFingerprint(
        report.dataset.catalogModelCount,
        report.dataset.catalogVariantCount
      );
      const cfg = computeConfigFingerprint(report.currentDatasetBaseline.config);
      expect(ds).toBe(report.dataset.fingerprints.dataset);
      expect(cat).toBe(report.dataset.fingerprints.catalog);
      expect(cfg).toBe(report.dataset.fingerprints.config);
    });
  });

  // =========================================================================
  // Quality gates (mandatory)
  // =========================================================================

  describe("Quality gates", () => {
    it("hard constraint violation rate is 0%", () => {
      expect(report.gates.hardConstraintViolationRate).toBe(0);
    });

    it("no-result accuracy is 100%", () => {
      expect(report.gates.noResultAccuracy).toBe(1.0);
    });

    it("no-result counts are correct", () => {
      const negativeCount = QUALITY_QUERIES.filter(
        (q) => q.expectedResult === "empty"
      ).length;
      expect(report.gates.noResultTotal).toBe(negativeCount);
      expect(report.gates.noResultCorrect).toBe(negativeCount);
    });

    it("core retrieval does not regress beyond -0.05 from baseline", () => {
      expect(report.gates.coreRetentionPass).toBe(true);
      expect(report.gates.coreRetentionDelta).toBeGreaterThanOrEqual(-0.05);
    });
  });

  // =========================================================================
  // Per-group regression (informational)
  // =========================================================================

  describe("Per-group metrics", () => {
    for (const group of QUALITY_GROUPS) {
      it(`${group} group has reported metrics`, () => {
        const g = report.byGroup.find((b) => b.group === group);
        expect(g).toBeDefined();
        expect(g!.queryCount).toBeGreaterThan(0);
        expect(g!.metrics.mrr).toBeGreaterThanOrEqual(0);
        expect(g!.metrics.mrr).toBeLessThanOrEqual(1);
      });
    }
  });

  // =========================================================================
  // Diagnostics
  // =========================================================================

  describe("Diagnostics", () => {
    it("every query has stage diagnostics populated", () => {
      for (const q of report.perQuery) {
        expect(q.stages.queryUnderstanding).toBeDefined();
        expect(q.stages.structuredRetrieval).toBeDefined();
        expect(q.stages.semanticRetrieval).toBeDefined();
        expect(q.stages.hybridFusion).toBeDefined();
        expect(q.stages.hardGate).toBeDefined();
        expect(q.stages.finalResolution).toBeDefined();
      }
    });

    it("every query has a primaryFailureStage", () => {
      for (const q of report.perQuery) {
        expect(q.primaryFailureStage).toBeDefined();
        expect([
          "query-understanding",
          "structured-retrieval",
          "semantic-retrieval",
          "hybrid-fusion",
          "hard-gate",
          "final-resolution",
          "none",
        ]).toContain(q.primaryFailureStage);
      }
    });

    it("passed queries have primaryFailureStage: none", () => {
      for (const q of report.perQuery) {
        const isEmpty = q.expectedResult === "empty";
        const resultCount = q.stages.finalResolution.resultCount;
        const violations = q.violations;
        const isPass = isEmpty
          ? resultCount === 0
          : resultCount > 0 && violations === 0;
        if (isPass) {
          expect(q.primaryFailureStage).toBe("none");
        }
      }
    });

    it("failed queries have a failureReason", () => {
      for (const q of report.perQuery) {
        if (q.primaryFailureStage !== "none") {
          expect(q.failureReason).toBeDefined();
          expect(q.failureReason!.length).toBeGreaterThan(0);
        }
      }
    });

    it("hard-gate failures cite violation count", () => {
      for (const q of report.perQuery) {
        if (q.primaryFailureStage === "hard-gate") {
          expect(q.failureReason).toContain("violated");
          expect(q.violations).toBeGreaterThan(0);
        }
      }
    });

    it("structured-retrieval failures cite zero candidates", () => {
      for (const q of report.perQuery) {
        if (q.primaryFailureStage === "structured-retrieval") {
          expect(q.stages.structuredRetrieval.candidateCount).toBe(0);
          expect(q.failureReason).toContain("0 candidates");
        }
      }
    });

    it("hybrid-fusion failures cite upstream vs fusion count", () => {
      for (const q of report.perQuery) {
        if (q.primaryFailureStage === "hybrid-fusion") {
          expect(q.stages.hybridFusion.fusedCount).toBe(0);
          expect(q.failureReason).toContain("fusion");
        }
      }
    });
  });

  // =========================================================================
  // Regression
  // =========================================================================

  describe("Regression", () => {
    it("has baseline source set", () => {
      expect(report.regression.baselineSource).toBe("calibration-report.json");
    });

    it("overall metrics are within reasonable range", () => {
      expect(report.overall.mrr).toBeGreaterThanOrEqual(0);
      expect(report.overall.mrr).toBeLessThanOrEqual(1);
      expect(report.overall.recall[5]).toBeGreaterThanOrEqual(0);
      expect(report.overall.recall[5]).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // Determinism
  // =========================================================================

  describe("Determinism", () => {
    it("quality evaluation is deterministic across two runs", async () => {
      const r1 = await runQualityEvaluation({
        queries: QUALITY_QUERIES,
        allModels,
        semanticSource: SURROGATE_SEMANTIC_SOURCE,
      });
      const r2 = await runQualityEvaluation({
        queries: QUALITY_QUERIES,
        allModels,
        semanticSource: SURROGATE_SEMANTIC_SOURCE,
      });
      expect(JSON.stringify(r1.perQuery.map((q) => q.queryId))).toBe(
        JSON.stringify(r2.perQuery.map((q) => q.queryId))
      );
      expect(JSON.stringify(r1.overall)).toBe(JSON.stringify(r2.overall));
      expect(r1.gates.hardConstraintViolationRate).toBe(
        r2.gates.hardConstraintViolationRate
      );
      expect(r1.gates.noResultAccuracy).toBe(r2.gates.noResultAccuracy);
      expect(r1.dataset.fingerprints.dataset).toBe(r2.dataset.fingerprints.dataset);
      expect(r1.dataset.fingerprints.catalog).toBe(r2.dataset.fingerprints.catalog);
      expect(r1.dataset.fingerprints.config).toBe(r2.dataset.fingerprints.config);
    });
  });

  // =========================================================================
  // Reporting
  // =========================================================================

  describe("Reporting", () => {
    it("writes search-quality-report.json", async () => {
      const filePath = await writeQualityReport(report);
      const stat = await fs.stat(filePath);
      expect(stat.size).toBeGreaterThan(0);

      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.dataset.version).toBe("v2");
      expect(parsed.dataset.queryCount).toBe(45);
    });

    it("human-readable output contains correct no-result accuracy", () => {
      const summary = formatQualityReport(report);
      expect(summary).toContain("No-result accuracy:");
      // Must contain explicit X/Y format, not derived from passed/failed
      expect(summary).toMatch(/No-result accuracy: \d+\/\d+ \(\d+\.?\d*%\)/);
    });

    it("human-readable output contains baseline distinction", () => {
      const summary = formatQualityReport(report);
      expect(summary).toContain("Historical baseline:");
      expect(summary).toContain("Current baseline:");
      expect(summary).toContain("historical-reference-only");
    });

    it("prints human-readable summary with all gates", () => {
      const summary = formatQualityReport(report);
      expect(summary).toContain("Search Quality Report v2");
      expect(summary).toContain("45 queries");
      expect(summary).toContain("GATES:");
    });
  });
});
