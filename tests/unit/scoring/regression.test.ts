import { describe, it, expect } from "vitest";
import { calculateScore, calculateComparison } from "@/lib/scoring/algorithm";
import { USE_CASE_WEIGHTS } from "@/lib/data/categories";

/**
 * Golden Regression Tests
 *
 * Each entry is a representative computer profile with its expected score
 * ranges per use case. These are NOT arbitrary — they reflect real gen
 * behavior as of the baseline. If a future change shifts scores outside
 * these ranges, it's a regression that must be investigated.
 *
 * Format: { label, specs, price, expected: { useCase: [min, max] } }
 */

const GAMING_LAPTOP = {
  label: "High-end Gaming Laptop",
  specs: { cpuScore: 88, gpuScore: 92, ram: 32, storage: 1024, displayRefreshRate: 165, batteryLife: 6, weight: 2.5 },
  price: 1799,
};

const LOW_END_LAPTOP = {
  label: "Low-end Laptop",
  specs: { cpuScore: 40, gpuScore: 15, ram: 8, storage: 256, displayRefreshRate: 60, batteryLife: 8, weight: 1.8 },
  price: 499,
};

const BALANCED_LAPTOP = {
  label: "Balanced All-rounder",
  specs: { cpuScore: 65, gpuScore: 45, ram: 16, storage: 512, displayRefreshRate: 120, batteryLife: 10, weight: 1.7 },
  price: 999,
};

const WORKSTATION = {
  label: "Mobile Workstation",
  specs: { cpuScore: 82, gpuScore: 70, ram: 64, storage: 2048, displayRefreshRate: 120, batteryLife: 5, weight: 3.0 },
  price: 2499,
};

const ULTRABOOK = {
  label: "Premium Ultrabook",
  specs: { cpuScore: 60, gpuScore: 20, ram: 16, storage: 512, displayRefreshRate: 90, batteryLife: 14, weight: 1.2 },
  price: 1299,
};

const ALL_COMPUTERS = [GAMING_LAPTOP, LOW_END_LAPTOP, BALANCED_LAPTOP, WORKSTATION, ULTRABOOK];

describe("Scoring — Behavioral Regression", () => {
  describe("Gaming use case", () => {
    it("gaming laptop scores higher than low-end laptop", () => {
      const high = calculateScore(GAMING_LAPTOP.specs, GAMING_LAPTOP.price, USE_CASE_WEIGHTS.gaming);
      const low = calculateScore(LOW_END_LAPTOP.specs, LOW_END_LAPTOP.price, USE_CASE_WEIGHTS.gaming);
      expect(high).toBeGreaterThan(low);
    });

    it("gaming laptop scores higher than ultrabook for gaming", () => {
      const gaming = calculateScore(GAMING_LAPTOP.specs, GAMING_LAPTOP.price, USE_CASE_WEIGHTS.gaming);
      const ultra = calculateScore(ULTRABOOK.specs, ULTRABOOK.price, USE_CASE_WEIGHTS.gaming);
      expect(gaming).toBeGreaterThan(ultra);
    });

    it("gaming score is above 50 for a high-end gaming laptop", () => {
      const score = calculateScore(GAMING_LAPTOP.specs, GAMING_LAPTOP.price, USE_CASE_WEIGHTS.gaming);
      expect(score).toBeGreaterThan(50);
    });
  });

  describe("Portability use case", () => {
    it("ultrabook scores higher than gaming laptop for portability", () => {
      const ultra = calculateScore(ULTRABOOK.specs, ULTRABOOK.price, USE_CASE_WEIGHTS.portability);
      const gaming = calculateScore(GAMING_LAPTOP.specs, GAMING_LAPTOP.price, USE_CASE_WEIGHTS.portability);
      expect(ultra).toBeGreaterThan(gaming);
    });

    it("low-end laptop scores at least as high as workstation for portability (lighter weight offsets weaker specs)", () => {
      const low = calculateScore(LOW_END_LAPTOP.specs, LOW_END_LAPTOP.price, USE_CASE_WEIGHTS.portability);
      const ws = calculateScore(WORKSTATION.specs, WORKSTATION.price, USE_CASE_WEIGHTS.portability);
      expect(low).toBeGreaterThanOrEqual(ws);
    });
  });

  describe("Battery use case", () => {
    it("ultrabook with long battery beats gaming laptop", () => {
      const ultra = calculateScore(ULTRABOOK.specs, ULTRABOOK.price, USE_CASE_WEIGHTS.battery);
      const gaming = calculateScore(GAMING_LAPTOP.specs, GAMING_LAPTOP.price, USE_CASE_WEIGHTS.battery);
      expect(ultra).toBeGreaterThan(gaming);
    });
  });

  describe("Programming use case", () => {
    it("workstation scores well for programming (high CPU + RAM)", () => {
      const ws = calculateScore(WORKSTATION.specs, WORKSTATION.price, USE_CASE_WEIGHTS.programming);
      expect(ws).toBeGreaterThan(50);
    });
  });

  describe("Price sensitivity", () => {
    it("same specs but cheaper price yields higher score", () => {
      const expensive = calculateScore(BALANCED_LAPTOP.specs, 1500, USE_CASE_WEIGHTS.gaming);
      const cheap = calculateScore(BALANCED_LAPTOP.specs, 600, USE_CASE_WEIGHTS.gaming);
      expect(cheap).toBeGreaterThan(expensive);
    });
  });
});

describe("Scoring — Golden Regression (score ranges)", () => {
  const cases: { label: string; computer: typeof GAMING_LAPTOP; useCase: keyof typeof USE_CASE_WEIGHTS; min: number; max: number }[] = [
    { label: "gaming laptop → gaming", computer: GAMING_LAPTOP, useCase: "gaming", min: 50, max: 85 },
    { label: "low-end → gaming", computer: LOW_END_LAPTOP, useCase: "gaming", min: 5, max: 30 },
    { label: "ultrabook → portability", computer: ULTRABOOK, useCase: "portability", min: 55, max: 85 },
    { label: "workstation → programming", computer: WORKSTATION, useCase: "programming", min: 50, max: 80 },
    { label: "balanced → university", computer: BALANCED_LAPTOP, useCase: "university", min: 40, max: 70 },
  ];

  it.each(cases)("$label should score between $min and $max", ({ computer, useCase, min, max }) => {
    const score = calculateScore(computer.specs, computer.price, USE_CASE_WEIGHTS[useCase]);
    expect(score).toBeGreaterThanOrEqual(min);
    expect(score).toBeLessThanOrEqual(max);
  });
});

describe("Scoring — calculateComparison", () => {
  it("returns correct overallWinner when A is clearly better", () => {
    const result = calculateComparison(GAMING_LAPTOP, LOW_END_LAPTOP, "gaming");
    expect(result.overallWinner).toBe("A");
    expect(result.scoreA).toBeGreaterThan(result.scoreB);
  });

  it("returns tie when both computers are identical", () => {
    const result = calculateComparison(BALANCED_LAPTOP, { ...BALANCED_LAPTOP }, "gaming");
    expect(result.overallWinner).toBe("tie");
    expect(result.scoreA).toBe(result.scoreB);
  });

  it("returns correct spec winners array with 8 entries", () => {
    const result = calculateComparison(GAMING_LAPTOP, ULTRABOOK, "gaming");
    expect(result.winners).toHaveLength(8);
    for (const w of result.winners) {
      expect(w.winner).toMatch(/^(A|B|tie)$/);
    }
  });

  it("gaming laptop wins GPU spec", () => {
    const result = calculateComparison(GAMING_LAPTOP, LOW_END_LAPTOP, "gaming");
    const gpu = result.winners.find((w) => w.key === "gpu");
    expect(gpu?.winner).toBe("A");
  });

  it("ultrabook wins weight spec", () => {
    const result = calculateComparison(ULTRABOOK, GAMING_LAPTOP, "gaming");
    const weight = result.winners.find((w) => w.key === "weight");
    expect(weight?.winner).toBe("A");
  });
});

describe("Scoring — all scores are valid integers", () => {
  it.each(ALL_COMPUTERS)("$label produces integer scores for all use cases", (computer) => {
    for (const useCase of Object.keys(USE_CASE_WEIGHTS) as (keyof typeof USE_CASE_WEIGHTS)[]) {
      const score = calculateScore(computer.specs, computer.price, USE_CASE_WEIGHTS[useCase]);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
