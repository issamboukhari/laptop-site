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
): Promise<{ models: ComputerModel[]; total: number }> {
  const all = await getAllModels();
  const filtered = all.filter((m) => matchFilters(m, filters));
  return { models: filtered.slice(offset, offset + limit), total: filtered.length };
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
  if (f.brand && m.brand.toLowerCase() !== f.brand.toLowerCase()) return false;
  if (f.family && (!m.family || !m.family.toLowerCase().includes(f.family.toLowerCase()))) return false;
  if (f.category && m.category !== f.category) return false;
  if (f.minYear && m.year < f.minYear) return false;
  if (f.maxYear && m.year > f.maxYear) return false;

  const primary = m.variants[0];
  if (!primary) return true;

  if (f.minRam && primary.specs.ram < f.minRam) return false;
  if (f.maxRam && primary.specs.ram > f.maxRam) return false;
  if (f.minStorage && primary.specs.storage < f.minStorage) return false;
  if (f.maxStorage && primary.specs.storage > f.maxStorage) return false;
  if (f.screenSize && primary.specs.displaySize !== f.screenSize) return false;
  if (f.touchscreen !== undefined && primary.specs.touchscreen !== f.touchscreen) return false;

  if (f.minPrice || f.maxPrice) {
    const minV = Math.min(...m.variants.map((v) => v.price));
    const maxV = Math.max(...m.variants.map((v) => v.price));
    if (f.minPrice && maxV < f.minPrice) return false;
    if (f.maxPrice && minV > f.maxPrice) return false;
  }

  return true;
}

export async function saveCustomModel(model: ComputerModel): Promise<void> {
  const custom = await loadCustomModels();
  const existingIdx = custom.findIndex((m) => m.id === model.id);
  if (existingIdx >= 0) {
    const existing = custom[existingIdx];
    const existingVariantIds = new Set(existing.variants.map((v) => v.id));
    for (const v of model.variants) {
      if (!existingVariantIds.has(v.id)) existing.variants.push(v);
    }
    custom[existingIdx] = existing;
  } else {
    custom.push(model);
  }
  await fs.mkdir(path.dirname(CUSTOM_DB_PATH), { recursive: true });
  await fs.writeFile(CUSTOM_DB_PATH, JSON.stringify(custom, null, 2), "utf8");
  invalidateCache();
}
