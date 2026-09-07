import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { getAllModels } from "@/lib/server/database";
import {
  SEARCH_EVALUATION_QUERIES,
  EVALUATION_GROUPS,
  SEARCH_EVALUATION_VERSION,
} from "@/tests/fixtures/search-evaluation";
import {
  calibrate,
  buildConfigMatrix,
  configLabel,
} from "@/lib/eval/runner";

/**
 * Phase 3.2.5 — Calibration RUNNER (the calibration "command").
 *
 * Run explicitly with:  npm run calibrate
 * (= vitest run tests/eval)
 *
 * Executes the full search pipeline over the evaluation dataset for the
 * entire configuration matrix, computes metrics, writes a deterministic
 * machine-readable report to tests/eval/calibration-report.json, and prints
 * a human-readable summary.
 */

const REPORT_PATH = path.join(process.cwd(), "tests", "eval", "calibration-report.json");

describe("Phase 3.2.5 calibration runner", () => {
  let report: ReturnType<typeof calibrate>;

  beforeAll(async () => {
    const allModels = await getAllModels();
    report = calibrate({
      queries: SEARCH_EVALUATION_QUERIES,
      allModels,
    });
  });

  it("evaluates the full configuration matrix", () => {
    expect(report.configs.length).toBe(buildConfigMatrix().length);
    expect(report.dataset.version).toBe(SEARCH_EVALUATION_VERSION);
    expect(report.dataset.queryCount).toBe(SEARCH_EVALUATION_QUERIES.length);
    // Every group must be represented in the dataset.
    for (const g of EVALUATION_GROUPS) expect(report.dataset.groups[g]).toBeGreaterThan(0);
  });

  it("records a baseline row matching the production defaults", () => {
    const baseline = report.configs.find((r) => r.isBaseline);
    expect(baseline).toBeDefined();
    expect(baseline!.config).toEqual(report.baseline);
    expect(baseline!.config).toEqual({ rrfK: 60, structuredWeight: 1, semanticWeight: 1 });
  });

  it("selected configuration has zero hard-constraint violations", () => {
    expect(report.selected.violationRate).toBe(0);
    expect(report.selected.violations).toBe(0);
  });

  it("is deterministic across runs", async () => {
    const allModels = await getAllModels();
    const rerun = calibrate({
      queries: SEARCH_EVALUATION_QUERIES,
      allModels,
    });
    expect(JSON.stringify(rerun)).toBe(JSON.stringify(report));
  });

  it("writes the machine-readable report and prints the summary", async () => {
    await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

    const round = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3);

    const pad = (s: string, len: number) => s.padEnd(len);
    const out: string[] = [];
    out.push("=".repeat(104));
    out.push("Phase 3.2.5 — Search Ranking Calibration Report");
    out.push(`Dataset v${report.dataset.version} | groups ${JSON.stringify(report.dataset.groups)} | catalog ${report.dataset.catalogModelCount} models / ${report.dataset.catalogVariantCount} variants | ${report.dataset.labeledRelevantPairs} labeled (variant,query) pairs`);
    out.push(`Semantic input: ${report.semanticSource} | matrix: ${report.matrixSize} configurations`);
    out.push("=".repeat(104));

    out.push("");
    out.push(`GROUP         R@1    R@3    R@5    R@10   P@3    P@5    P@10   MRR    NDCG@5  viol`);
    for (const g of EVALUATION_GROUPS) {
      const m = report.selected.byGroup[g];
      if (!m) continue;
      const row = report.selected.perQuery.filter((q) => q.group === g);
      const viol = row.reduce((t, q) => t + q.violations, 0);
      out.push(
        pad(g, 14) +
        `${round(m.recall[1])}  ${round(m.recall[3])}  ${round(m.recall[5])}  ${round(m.recall[10])}  ${round(m.precision[3])}  ${round(m.precision[5])}  ${round(m.precision[10])}  ${round(m.mrr)}  ${round(m.ndcg[5])}     ${viol}`
      );
    }
    const ov = report.selected.overall;
    out.push(
      pad("OVERALL", 14) +
      `${round(ov.recall[1])}  ${round(ov.recall[3])}  ${round(ov.recall[5])}  ${round(ov.recall[10])}  ${round(ov.precision[3])}  ${round(ov.precision[5])}  ${round(ov.precision[10])}  ${round(ov.mrr)}  ${round(ov.ndcg[5])}     ${report.selected.violations}`
    );

    out.push("");
    out.push(
      pad("CONFIG", 18) +
      pad("R@5", 8) + pad("P@5", 8) + pad("MRR", 8) + pad("CORE", 8) + pad("SEM", 8) + pad("SCORE", 8) + pad("VIOL", 6) + "SELECT"
    );
    const ranked = [...report.configs].sort((a, b) => b.tradeoffScore - a.tradeoffScore).slice(0, 12);
    for (const r of ranked) {
      out.push(
        pad(configLabel(r.config), 18) +
        pad(round(r.overall.recall[5]), 8) +
        pad(round(r.overall.precision[5]), 8) +
        pad(round(r.overall.mrr), 8) +
        pad(round(r.coreRetrieval), 8) +
        pad(round(r.semanticQuality), 8) +
        pad(round(r.tradeoffScore), 8) +
        pad(String(r.violations), 6) +
        (r === report.selected ? "  << SELECTED" : r.isBaseline ? "  (baseline)" : "")
      );
    }
    out.push("");
    out.push(`Selected configuration: ${configLabel(report.selected.config)} (${report.selected.isBaseline ? "baseline retained" : "changed"})`);
    out.push(`Semantic availability: ${(report.selected.semanticAvailableRate * 100).toFixed(1)}% of queries produced semantic matches`);
    out.push(`Report written to ${REPORT_PATH}`);
    out.push("=".repeat(104));

    console.log("\n" + out.join("\n") + "\n");

    const saved = JSON.parse(await fs.readFile(REPORT_PATH, "utf8"));
    expect(saved.selected.label).toBe(report.selected.label);
  });
});