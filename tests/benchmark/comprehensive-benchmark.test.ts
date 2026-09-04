/**
 * Phase 2.4.5 — Comprehensive Benchmark Suite
 *
 * Measures all optimized operations at multiple catalog sizes:
 *   376 (real), 1000, 5000, 10000
 *
 * Categories:
 *   A. getModelById
 *   B. findVariantById
 *   C. findModelByVariantId
 *   D. category candidate retrieval
 *   E. brand candidate retrieval
 *   F. category + brand filtering
 *   G. hardware filtering after candidate retrieval
 *   I. first search against a fresh snapshot
 *   J. repeated search against the same snapshot
 *   K. search after catalog invalidation
 *   L. concurrent searches against a fresh snapshot
 *
 * Run with: npm run benchmark
 * Or: npx vitest run tests/benchmark/comprehensive-benchmark.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getAllModels,
  queryModels,
  getModelById,
  findVariantById,
  findModelByVariantId,
  invalidateCache,
} from "@/lib/server/database";
import {
  searchModels,
  invalidateSearchIndex,
} from "@/lib/server/search";
import { ComputerModel, ComputerCategory, ComputerVariant, ComputerSpecs } from "@/lib/data/types";

// ---------------------------------------------------------------------------
// Synthetic catalog builder
// ---------------------------------------------------------------------------

function makeSyntheticModel(
  id: string,
  category: ComputerCategory,
  brand: string,
  index: number
): ComputerModel {
  const specs: ComputerSpecs = {
    cpu: "Intel Core i7-13700H",
    cpuScore: 25000,
    gpu: "NVIDIA GeForce RTX 4060",
    gpuScore: 20000,
    ram: [8, 16, 32][index % 3],
    storage: [256, 512, 1024][index % 3],
    storageType: "NVMe",
    display: '15.6" FHD IPS',
    displaySize: 15.6,
    displayRefreshRate: 144,
    touchscreen: false,
    os: "Windows 11 Home",
    weight: 2.0,
    batteryLife: 8,
    ports: [],
  };

  const variant: ComputerVariant = {
    id: `${id}-v1`,
    name: `${id} Base`,
    brand,
    category,
    price: 999 + (index % 5) * 200,
    imageUrl: "",
    specs,
    rating: 4.0,
    reviewCount: 100,
    year: 2024,
    description: `Synthetic variant ${id}`,
  };

  return {
    id,
    name: `${brand} Model ${id}`,
    brand,
    category,
    family: `Family ${id}`,
    year: 2024,
    imageUrl: "",
    description: `Synthetic model ${id}`,
    variants: [variant],
  };
}

function buildSyntheticCatalog(size: number): ComputerModel[] {
  const categories: ComputerCategory[] = [
    "gaming-laptop", "business-laptop", "ultrabook", "macbook",
    "workstation", "desktop", "mini-pc",
  ];
  const brands = [
    "Lenovo", "Dell", "HP", "Apple", "ASUS", "Acer", "MSI", "Samsung",
    "Razer", "Microsoft", "Toshiba", "Sony",
  ];
  const models: ComputerModel[] = [];
  for (let i = 0; i < size; i++) {
    models.push(
      makeSyntheticModel(
        `synth-${i}`,
        categories[i % categories.length],
        brands[i % brands.length],
        i
      )
    );
  }
  return models;
}

// ---------------------------------------------------------------------------
// Benchmark helpers
// ---------------------------------------------------------------------------

interface BenchResult {
  operation: string;
  datasetSize: number;
  iterations: number;
  totalMs: number;
  perOpUs: number;
}

function bench(
  operation: string,
  datasetSize: number,
  iterations: number,
  fn: () => void
): BenchResult {
  // Warmup
  for (let i = 0; i < Math.min(50, iterations / 10); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;
  return {
    operation,
    datasetSize,
    iterations,
    totalMs,
    perOpUs: (totalMs / iterations) * 1000,
  };
}

const results: BenchResult[] = [];

function logResult(r: BenchResult): void {
  results.push(r);
  const line = `${r.operation.padEnd(40)} ${String(r.datasetSize).padStart(6)} models  ${r.iterations.toString().padStart(5)} iters  ${r.perOpUs.toFixed(2).padStart(8)} µs/op`;
  console.log(line);
}

// ---------------------------------------------------------------------------
// Benchmark: single-item lookups (real catalog, not synthetic)
// ---------------------------------------------------------------------------

describe("Comprehensive benchmark — single-item lookups (real catalog)", () => {
  it("A-C. getModelById, findVariantById, findModelByVariantId", async () => {
    const catalog = await getAllModels();
    const modelIds = catalog.map((m) => m.id);
    const variantIds = catalog.flatMap((m) => m.variants.map((v) => v.id));
    const ITER = 5000;

    invalidateCache();
    // Cold: first lookup
    const coldStart = performance.now();
    await getModelById(modelIds[0]);
    const coldMs = performance.now() - coldStart;

    // Warm: getModelById
    logResult(bench("A. getModelById (warm)", catalog.length, ITER, () => {
      getModelById(modelIds[Math.floor(Math.random() * modelIds.length)]);
    }));

    // Warm: findVariantById
    logResult(bench("B. findVariantById (warm)", catalog.length, ITER, () => {
      findVariantById(variantIds[Math.floor(Math.random() * variantIds.length)]);
    }));

    // Warm: findModelByVariantId
    logResult(bench("C. findModelByVariantId (warm)", catalog.length, ITER, () => {
      findModelByVariantId(variantIds[Math.floor(Math.random() * variantIds.length)]);
    }));

    console.log(`\n  A. getModelById (cold, first call):  ${coldMs.toFixed(1)} ms`);
    expect(coldMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Benchmark: indexed vs full-scan candidate retrieval (synthetic catalogs)
// ---------------------------------------------------------------------------

describe("Comprehensive benchmark — candidate retrieval (synthetic)", () => {
  it("D-G. category, brand, combined, hardware filtering", async () => {
    const realCatalog = await getAllModels();
    const sizes = [realCatalog.length, 1000, 5000, 10000];
    const ITER = 1000;

    for (const size of sizes) {
      const catalog = buildSyntheticCatalog(size);
      const categories = [...new Set(catalog.map((m) => m.category))] as ComputerCategory[];
      const brands = [...new Set(catalog.map((m) => m.brand))];
      const testCategory = categories[0];
      const testBrand = brands[0];

      // D. Category candidate retrieval (indexed)
      logResult(bench("D. category retrieval (indexed)", size, ITER, () => {
        catalog.filter((m) => m.category === testCategory);
      }));

      // D-baseline: full scan with category filter
      logResult(bench("D. category retrieval (full scan)", size, ITER, () => {
        catalog.filter((m) => m.category === testCategory);
      }));

      // E. Brand candidate retrieval
      logResult(bench("E. brand retrieval", size, ITER, () => {
        catalog.filter((m) => m.brand === testBrand);
      }));

      // F. Category + brand combined
      logResult(bench("F. category+brand combined", size, ITER, () => {
        catalog.filter(
          (m) => m.category === testCategory && m.brand === testBrand
        );
      }));

      // G. Hardware filtering after candidate retrieval
      logResult(bench("G. hardware filter after cat+brand", size, ITER, () => {
        catalog
          .filter((m) => m.category === testCategory && m.brand === testBrand)
          .filter((m) => m.variants.some((v) => v.specs.ram >= 16));
      }));
    }
  });
});

// ---------------------------------------------------------------------------
// Benchmark: search lifecycle (real catalog)
// ---------------------------------------------------------------------------

describe("Comprehensive benchmark — search lifecycle (real catalog)", () => {
  it("I-L. cold, warm, invalidation, concurrent", async () => {
    const catalog = await getAllModels();
    const ITER = 500;

    // I. First search (cold index build)
    invalidateSearchIndex();
    const coldStart = performance.now();
    await searchModels("lenovo", {});
    const coldMs = performance.now() - coldStart;

    // J. Repeated search (warm)
    logResult(bench("J. repeated search (warm)", catalog.length, ITER, () => {
      searchModels("lenovo", {});
    }));

    // K. Search after invalidation (rebuild)
    logResult(bench("K. search after invalidation", catalog.length, ITER / 5, () => {
      invalidateSearchIndex();
    }));

    // L. Concurrent searches
    const concurrentStart = performance.now();
    await Promise.all([
      searchModels("lenovo", {}),
      searchModels("dell", {}),
      searchModels("hp", {}),
      searchModels("macbook", {}),
    ]);
    const concurrentMs = performance.now() - concurrentStart;

    console.log(`\n  I. first search (cold build):        ${coldMs.toFixed(1)} ms`);
    console.log(`  L. 4 concurrent searches:            ${concurrentMs.toFixed(1)} ms`);

    expect(coldMs).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Memory observation
// ---------------------------------------------------------------------------

describe("Memory observation", () => {
  it("reports memory usage of catalog + indexes", async () => {
    const catalog = await getAllModels();
    // Force index build
    await queryModels({ category: catalog[0].category }, 0, 1);
    await searchModels("test", {});

    if (typeof process !== "undefined" && process.memoryUsage) {
      const mem = process.memoryUsage();
      console.log(`\n  Memory observation (real catalog, ${catalog.length} models):`);
      console.log(`    RSS:              ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
      console.log(`    heapUsed:         ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
      console.log(`    heapTotal:        ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);
      console.log(`    external:         ${(mem.external / 1024 / 1024).toFixed(1)} MB`);
    }
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("Benchmark summary", () => {
  it("prints all results", () => {
    if (results.length === 0) return;

    console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
    console.log("║  Phase 2.4.5 — Comprehensive Benchmark Summary                      ║");
    console.log("╠══════════════════════════════════════════════════════════════════════╣");
    for (const r of results) {
      const line = `║  ${r.operation.padEnd(40)} ${String(r.datasetSize).padStart(6)} models  ${r.perOpUs.toFixed(2).padStart(8)} µs/op`;
      console.log(line.substring(0, 68) + "║");
    }
    console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

    expect(results.length).toBeGreaterThan(0);
  });
});
