import type { UseCase, UseCaseWeights } from "../data/types";
import { USE_CASE_WEIGHTS } from "../data/categories";

const SPEC_RANGES = {
  cpuScore: { min: 30, max: 100 },
  gpuScore: { min: 5, max: 100 },
  ram: { min: 4, max: 128 },
  storage: { min: 128, max: 4000 },
  display: { min: 60, max: 240 },
  batteryLife: { min: 3, max: 22 },
  weight: { min: 0.7, max: 4.5 },
  price: { min: 299, max: 4999 },
} as const;

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function normalizeInverted(value: number, min: number, max: number): number {
  return 1 - normalize(value, min, max);
}

export function calculateScore(
  specs: {
    cpuScore: number;
    gpuScore: number;
    ram: number;
    storage: number;
    displayRefreshRate: number;
    batteryLife: number;
    weight: number;
  },
  price: number,
  weights: UseCaseWeights
): number {
  const scores = {
    cpu: normalize(specs.cpuScore, SPEC_RANGES.cpuScore.min, SPEC_RANGES.cpuScore.max),
    gpu: normalize(specs.gpuScore, SPEC_RANGES.gpuScore.min, SPEC_RANGES.gpuScore.max),
    ram: normalize(specs.ram, SPEC_RANGES.ram.min, SPEC_RANGES.ram.max),
    storage: normalize(specs.storage, SPEC_RANGES.storage.min, SPEC_RANGES.storage.max),
    display: normalize(specs.displayRefreshRate, SPEC_RANGES.display.min, SPEC_RANGES.display.max),
    batteryLife: normalize(specs.batteryLife, SPEC_RANGES.batteryLife.min, SPEC_RANGES.batteryLife.max),
    weight: normalizeInverted(specs.weight, SPEC_RANGES.weight.min, SPEC_RANGES.weight.max),
    price: normalizeInverted(price, SPEC_RANGES.price.min, SPEC_RANGES.price.max),
  };

  const weighted =
    scores.cpu * weights.cpu +
    scores.gpu * weights.gpu +
    scores.ram * weights.ram +
    scores.storage * weights.storage +
    scores.display * weights.display +
    scores.batteryLife * weights.batteryLife +
    scores.weight * weights.weight +
    scores.price * weights.price;

  return Math.round(weighted * 100);
}

export function calculateComparison(
  computerA: {
    specs: { cpuScore: number; gpuScore: number; ram: number; storage: number; displayRefreshRate: number; batteryLife: number; weight: number };
    price: number;
  },
  computerB: {
    specs: { cpuScore: number; gpuScore: number; ram: number; storage: number; displayRefreshRate: number; batteryLife: number; weight: number };
    price: number;
  },
  useCase: UseCase
) {
  const weights = USE_CASE_WEIGHTS[useCase];
  const scoreA = calculateScore(computerA.specs, computerA.price, weights);
  const scoreB = calculateScore(computerB.specs, computerB.price, weights);

  const specComparisons = [
    { key: "cpu", label: "CPU Performance", a: computerA.specs.cpuScore, b: computerB.specs.cpuScore, higher: true },
    { key: "gpu", label: "GPU Performance", a: computerA.specs.gpuScore, b: computerB.specs.gpuScore, higher: true },
    { key: "ram", label: "RAM", a: computerA.specs.ram, b: computerB.specs.ram, higher: true },
    { key: "storage", label: "Storage", a: computerA.specs.storage, b: computerB.specs.storage, higher: true },
    { key: "display", label: "Display", a: computerA.specs.displayRefreshRate, b: computerB.specs.displayRefreshRate, higher: true },
    { key: "battery", label: "Battery Life", a: computerA.specs.batteryLife, b: computerB.specs.batteryLife, higher: true },
    { key: "weight", label: "Weight", a: computerA.specs.weight, b: computerB.specs.weight, higher: false },
    { key: "price", label: "Price", a: computerA.price, b: computerB.price, higher: false },
  ];

  const winners = specComparisons.map((sc) => ({
    ...sc,
    winner: sc.a === sc.b ? "tie" : (sc.higher ? (sc.a > sc.b ? "A" : "B") : (sc.a < sc.b ? "A" : "B")),
  }));

  const overallWinner = scoreA === scoreB ? "tie" : scoreA > scoreB ? "A" : "B";

  return { scoreA, scoreB, winners, overallWinner };
}
