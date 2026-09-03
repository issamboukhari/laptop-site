import { describe, it, expect } from "vitest";
import { calculateScore, calculateComparison } from "@/lib/scoring/algorithm";
import { USE_CASE_WEIGHTS } from "@/lib/data/categories";

/**
 * Edge-Case Tests
 *
 * These ensure the scoring engine is robust against:
 * - undefined / null / missing values
 * - Extreme values (0, negative, very large)
 * - Partial specifications
 * - Boundary conditions
 *
 * The invariant: scores must ALWAYS be finite, non-NaN, non-Infinity,
 * and within [0, 100].
 */

const MIN_SPECS = {
  cpuScore: 0,
  gpuScore: 0,
  ram: 0,
  storage: 0,
  displayRefreshRate: 0,
  batteryLife: 0,
  weight: 0,
};

const MAX_SPECS = {
  cpuScore: 100,
  gpuScore: 100,
  ram: 128,
  storage: 4000,
  displayRefreshRate: 360,
  batteryLife: 22,
  weight: 0.5,
};

function isValidScore(score: unknown): score is number {
  return typeof score === "number" && Number.isFinite(score) && !Number.isNaN(score);
}

describe("Scoring — Edge Cases: extreme values", () => {
  it("all-zero specs produce a valid score", () => {
    const score = calculateScore(MIN_SPECS, 299, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("all-max specs produce a valid score", () => {
    const score = calculateScore(MAX_SPECS, 4999, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("very high price produces valid score (price normalized inverted)", () => {
    const score = calculateScore(MIN_SPECS, 99999, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
  });

  it("zero price produces valid score", () => {
    const score = calculateScore(MAX_SPECS, 0, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
  });

  it("negative price produces valid score", () => {
    const score = calculateScore(MAX_SPECS, -500, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
  });
});

describe("Scoring — Edge Cases: partial specs", () => {
  const partialCases = [
    { label: "missing GPU", specs: { cpuScore: 70, gpuScore: 0, ram: 16, storage: 512, displayRefreshRate: 60, batteryLife: 8, weight: 2.0 } },
    { label: "missing RAM", specs: { cpuScore: 70, gpuScore: 50, ram: 0, storage: 512, displayRefreshRate: 60, batteryLife: 8, weight: 2.0 } },
    { label: "missing storage", specs: { cpuScore: 70, gpuScore: 50, ram: 16, storage: 0, displayRefreshRate: 60, batteryLife: 8, weight: 2.0 } },
    { label: "missing display refresh", specs: { cpuScore: 70, gpuScore: 50, ram: 16, storage: 512, displayRefreshRate: 0, batteryLife: 8, weight: 2.0 } },
    { label: "missing battery", specs: { cpuScore: 70, gpuScore: 50, ram: 16, storage: 512, displayRefreshRate: 60, batteryLife: 0, weight: 2.0 } },
    { label: "missing weight", specs: { cpuScore: 70, gpuScore: 50, ram: 16, storage: 512, displayRefreshRate: 60, batteryLife: 8, weight: 0 } },
  ];

  it.each(partialCases)("$label → valid score for all use cases", ({ specs }) => {
    for (const useCase of Object.keys(USE_CASE_WEIGHTS) as (keyof typeof USE_CASE_WEIGHTS)[]) {
      const score = calculateScore(specs, 999, USE_CASE_WEIGHTS[useCase]);
      expect(isValidScore(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("Scoring — Edge Cases: comparison with edge inputs", () => {
  it("comparison with two identical minimal computers is a tie", () => {
    const result = calculateComparison(
      { specs: MIN_SPECS, price: 299 },
      { specs: { ...MIN_SPECS }, price: 299 },
      "gaming"
    );
    expect(result.overallWinner).toBe("tie");
    expect(result.scoreA).toBe(result.scoreB);
  });

  it("comparison with two identical max computers is a tie", () => {
    const result = calculateComparison(
      { specs: MAX_SPECS, price: 4999 },
      { specs: { ...MAX_SPECS }, price: 4999 },
      "gaming"
    );
    expect(result.overallWinner).toBe("tie");
  });

  it("comparison always returns valid scores", () => {
    const result = calculateComparison(
      { specs: MIN_SPECS, price: 299 },
      { specs: MAX_SPECS, price: 4999 },
      "gaming"
    );
    expect(isValidScore(result.scoreA)).toBe(true);
    expect(isValidScore(result.scoreB)).toBe(true);
    expect(result.winners).toHaveLength(8);
  });
});

describe("Scoring — Edge Cases: normalization boundaries", () => {
  it("score at exact SPEC_RANGES.min for cpuScore (30) normalizes to 0", () => {
    const specs = { cpuScore: 30, gpuScore: 50, ram: 64, storage: 2048, displayRefreshRate: 120, batteryLife: 12, weight: 2.0 };
    const score = calculateScore(specs, 1000, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
  });

  it("score at exact SPEC_RANGES.max for cpuScore (100) normalizes to 1", () => {
    const specs = { cpuScore: 100, gpuScore: 50, ram: 64, storage: 2048, displayRefreshRate: 120, batteryLife: 12, weight: 2.0 };
    const score = calculateScore(specs, 1000, USE_CASE_WEIGHTS.gaming);
    expect(isValidScore(score)).toBe(true);
  });

  it("all use cases produce valid scores for a moderate computer", () => {
    const specs = { cpuScore: 60, gpuScore: 40, ram: 16, storage: 512, displayRefreshRate: 120, batteryLife: 8, weight: 1.8 };
    for (const useCase of Object.keys(USE_CASE_WEIGHTS) as (keyof typeof USE_CASE_WEIGHTS)[]) {
      const score = calculateScore(specs, 999, USE_CASE_WEIGHTS[useCase]);
      expect(isValidScore(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
