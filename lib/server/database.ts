import { promises as fs } from "fs";
import path from "path";
import {
  ComputerModel,
  ComputerVariant,
  SearchFilters,
  FilterFacets,
} from "../data/types";
import { computerModels, enrichSpecs, MODEL_BASE_SPECS } from "../data/computers";
import { getCloudModels, invalidateCloudCache } from "./cloud-db";
import { modelMatchesFilters, findMatchingVariants } from "./variant-matcher";
import { findExistingModel, findExistingVariant, upsertVariant } from "./model-normalize";

const CUSTOM_DB_PATH = path.join(process.cwd(), ".data", "computers-custom.json");

let _customCache: ComputerModel[] | null = null;
let _customMtime = 0;

async function loadCustomModels(): Promise<ComputerModel[]> {
  try {
    const stat = await fs.stat(CUSTOM_DB_PATH);
    if (_customCache && stat.mtimeMs === _customMtime) return _customCache;
    const raw = await fs.readFile(CUSTOM_DB_PATH, "utf8");
    _customCache = JSON.parse(raw) as ComputerModel[];
    _customMtime = stat.mtimeMs;
    return _customCache;
  } catch {
    _customCache = [];
    return [];
  }
}

/**
 * Central catalog = bundled base + Supabase Cloud (global shared store)
 * + local fallback file. Cloud is the source of truth for AI-discovered
 * computers; the local file only mirrors them when Supabase is unreachable.
 *
 * The merged array is cached briefly (short TTL) so references stay stable
 * for the search index while still picking up newly-saved cloud rows within
 * seconds — even when bundlers isolate module instances per route.
 */
const MERGED_TTL_MS = 5000;
let _cache: { models: ComputerModel[]; at: number } | null = null;

export async function getAllModels(): Promise<ComputerModel[]> {
  if (_cache && Date.now() - _cache.at < MERGED_TTL_MS) return _cache.models;

  const [custom, cloud] = await Promise.all([loadCustomModels(), getCloudModels()]);

  const byId = new Map<string, ComputerModel>();
  for (const m of cloud) byId.set(m.id, m); // cloud wins over nothing
  for (const m of custom) if (!byId.has(m.id)) byId.set(m.id, m);
  for (const m of computerModels) if (!byId.has(m.id)) byId.set(m.id, m);

  _cache = { models: [...byId.values()], at: Date.now() };
  return _cache.models;
}

export function invalidateCache(): void {
  _cache = null;
  invalidateCloudCache();
}

export async function getModelById(id: string): Promise<ComputerModel | undefined> {
  const all = await getAllModels();
  return all.find((m) => m.id === id);
}

export async function findVariantById(id: string): Promise<ComputerVariant | undefined> {
  const all = await getAllModels();
  for (const m of all) {
    const v = m.variants.find((v) => v.id === id);
    if (v) {
      const base = MODEL_BASE_SPECS[m.id] ?? {};
      return { ...v, specs: enrichSpecs({ ...base, ...v.specs }) };
    }
  }
  return undefined;
}

export async function findModelByVariantId(variantId: string): Promise<ComputerModel | undefined> {
  const all = await getAllModels();
  return all.find((m) => m.variants.some((v) => v.id === variantId));
}

export async function queryModels(
  filters: SearchFilters,
  offset = 0,
  limit = 20
): Promise<{ models: ComputerModel[]; total: number; matchingVariants?: Record<string, string[]> }> {
  const all = await getAllModels();
  const filtered = all.filter((m) => matchFilters(m, filters));
  const sliced = filtered.slice(offset, offset + limit);

  // Build a map of model ID → matching variant IDs for the sliced results.
  // This is optional/backward-compatible — existing consumers can ignore it.
  const matchingVariants: Record<string, string[]> = {};
  for (const m of sliced) {
    const matching = findMatchingVariants(m, filters);
    if (matching.length > 0 && matching.length < m.variants.length) {
      matchingVariants[m.id] = matching.map((v) => v.id);
    }
  }

  return {
    models: sliced,
    total: filtered.length,
    ...(Object.keys(matchingVariants).length > 0 ? { matchingVariants } : {}),
  };
}

export async function getFilterFacets(filters?: SearchFilters): Promise<FilterFacets> {
  const all = await getAllModels();
  const pool = filters ? all.filter((m) => matchFilters(m, filters)) : all;

  const brandMap = new Map<string, number>();
  const familyMap = new Map<string, { brand: string; count: number }>();
  const catMap = new Map<string, number>();
  const cpuMap = new Map<string, number>();
  const gpuMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const screenMap = new Map<number, number>();
  let minRam = Infinity, maxRam = 0;
  let minStorage = Infinity, maxStorage = 0;
  let minPrice = Infinity, maxPrice = 0;
  let minYear = Infinity, maxYear = 0;

  for (const m of pool) {
    brandMap.set(m.brand, (brandMap.get(m.brand) || 0) + 1);
    if (m.family) {
      const key = `${m.brand}|${m.family}`;
      const existing = familyMap.get(key);
      if (existing) existing.count++;
      else familyMap.set(key, { brand: m.brand, count: 1 });
    }
    catMap.set(m.category, (catMap.get(m.category) || 0) + 1);
    if (m.year < minYear) minYear = m.year;
    if (m.year > maxYear) maxYear = m.year;

    for (const v of m.variants) {
      const cpuShort = v.specs.cpu.split(" ").slice(-1)[0] || v.specs.cpu;
      cpuMap.set(cpuShort, (cpuMap.get(cpuShort) || 0) + 1);
      const gpuShort = v.specs.gpu.split(" ").slice(-2).join(" ");
      gpuMap.set(gpuShort, (gpuMap.get(gpuShort) || 0) + 1);
      osMap.set(v.specs.os, (osMap.get(v.specs.os) || 0) + 1);
      if (v.specs.displaySize) screenMap.set(v.specs.displaySize, (screenMap.get(v.specs.displaySize) || 0) + 1);
      if (v.specs.ram < minRam) minRam = v.specs.ram;
      if (v.specs.ram > maxRam) maxRam = v.specs.ram;
      if (v.specs.storage < minStorage) minStorage = v.specs.storage;
      if (v.specs.storage > maxStorage) maxStorage = v.specs.storage;
      if (v.price < minPrice) minPrice = v.price;
      if (v.price > maxPrice) maxPrice = v.price;
    }
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

  const families = [...familyMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([value, { brand, count }]) => ({ value, brand, count }));

  return {
    brands: toSorted(brandMap),
    families,
    categories: toSorted(catMap),
    cpus: toSorted(cpuMap).slice(0, 50),
    gpus: toSorted(gpuMap).slice(0, 30),
    ramRange: { min: minRam === Infinity ? 4 : minRam, max: maxRam || 128 },
    storageRange: { min: minStorage === Infinity ? 128 : minStorage, max: maxStorage || 4000 },
    priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice || 5000 },
    yearRange: { min: minYear === Infinity ? 2015 : minYear, max: maxYear || 2026 },
    screenSizes: [...screenMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count })),
    osOptions: toSorted(osMap),
  };
}

function matchFilters(m: ComputerModel, f: SearchFilters): boolean {
  return modelMatchesFilters(m, f);
}

export async function saveCustomModel(model: ComputerModel): Promise<void> {
  const custom = await loadCustomModels();

  // Use normalized identity to find existing model (not just ID)
  const existing = findExistingModel(model, custom);

  if (existing) {
    // Merge variants using fingerprint-based dedup
    let mergedVariants = [...existing.variants];
    for (const v of model.variants) {
      mergedVariants = upsertVariant({ ...existing, variants: mergedVariants }, v);
    }
    existing.variants = mergedVariants;
  } else {
    custom.push(model);
  }
  await fs.mkdir(path.dirname(CUSTOM_DB_PATH), { recursive: true });
  await fs.writeFile(CUSTOM_DB_PATH, JSON.stringify(custom, null, 2), "utf8");
  invalidateCache();
}
