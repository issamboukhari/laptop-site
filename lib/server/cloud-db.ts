import { ComputerModel } from "../data/types";
import { isSupabaseConfigured, sbSelect, sbUpsert, SupabaseUnavailableError } from "./supabase";
import { logError } from "./api-utils";
import {
  modelSignature,
  modelNameKey,
  normGeneration,
} from "./model-normalize";

/**
 * Supabase Cloud persistence for AI-discovered computers.
 *
 * Architecture: frontend → backend (this file) → Supabase. Nothing here is
 * ever imported by client components. When Supabase is unreachable or not
 * configured, every function degrades gracefully to the local JSON store so
 * the app keeps working offline; writes are mirrored locally in that case and
 * will be re-syncable once the cloud is reachable again.
 */

const TABLE = "computer_models";

interface ComputerModelRow {
  [key: string]: unknown;
  id: string;
  brand: string;
  family: string | null;
  series: string | null;
  name: string;
  generation: string | null;
  category: string;
  year: number | null;
  description: string | null;
  image_url: string | null;
  source: string;
  variants: ComputerModel["variants"];
  signature: string;
  name_key: string;
  search_text: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;

let _cloudCache: { models: ComputerModel[]; at: number } | null = null;
let _cloudReachable = true;
let _lastFailureAt = 0;
const FAILURE_COOLDOWN_MS = 15_000;

export function invalidateCloudCache(): void {
  _cloudCache = null;
}

export function isCloudConfigured(): boolean {
  return isSupabaseConfigured();
}

/** Last known cloud reachability (for status reporting). */
export function cloudStatus(): { configured: boolean; reachable: boolean } {
  return {
    configured: isSupabaseConfigured(),
    reachable: !isSupabaseConfigured() ? false : _cloudReachable || Date.now() - _lastFailureAt > FAILURE_COOLDOWN_MS,
  };
}

function rowToModel(row: ComputerModelRow): ComputerModel {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    family: row.family ?? undefined,
    generation: row.generation ?? undefined,
    category: row.category as ComputerModel["category"],
    year: row.year ?? new Date().getFullYear(),
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    variants: Array.isArray(row.variants) ? row.variants : [],
  };
}

function modelToRow(m: ComputerModel): ComputerModelRow {
  const searchText = [
    m.brand,
    m.family ?? "",
    m.generation ?? "",
    m.name,
    m.category,
    String(m.year),
    ...m.variants.flatMap((v) => [v.name, v.specs.cpu, v.specs.gpu, v.specs.os]),
    m.description,
  ]
    .join(" ")
    .toLowerCase();

  return {
    id: m.id,
    brand: m.brand,
    family: m.family ?? null,
    series: m.family ?? null,
    name: m.name,
    generation: m.generation ?? null,
    category: m.category,
    year: m.year,
    description: m.description,
    image_url: m.imageUrl ?? "",
    source: "ai",
    variants: m.variants,
    signature: modelSignature(m),
    name_key: modelNameKey(m.brand, m.family, m.name),
    search_text: searchText.slice(0, 4000),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** All cloud models, cached for CACHE_TTL_MS. [] when unreachable/unconfigured. */
export async function getCloudModels(): Promise<ComputerModel[]> {
  if (!isSupabaseConfigured()) return [];

  if (_cloudCache && Date.now() - _cloudCache.at < CACHE_TTL_MS) {
    return _cloudCache.models;
  }
  if (!_cloudReachable && Date.now() - _lastFailureAt < FAILURE_COOLDOWN_MS) {
    // Recent failure — don't hammer a dead host on every request.
    return _cloudCache?.models ?? [];
  }

  try {
    const rows = await sbSelect<ComputerModelRow>(TABLE, { limit: 10000 });
    const models = rows.map(rowToModel);
    _cloudCache = { models, at: Date.now() };
    _cloudReachable = true;
    return models;
  } catch (error) {
    _cloudReachable = false;
    _lastFailureAt = Date.now();
    if (error instanceof SupabaseUnavailableError) {
      logError("cloud-db:getCloudModels", error, { reason: error.reason });
    } else {
      logError("cloud-db:getCloudModels", error);
    }
    return _cloudCache?.models ?? [];
  }
}

// ---------------------------------------------------------------------------
// Dedupe + writes
// ---------------------------------------------------------------------------

export interface CloudSaveResult {
  saved: boolean;
  model: ComputerModel;
  /** true when an identical signature already existed and was reused/merged */
  deduped: boolean;
}

/**
 * Save a model to Supabase with multi-level dedupe:
 *  1. exact id match
 *  2. exact signature match (brand|family|name|normalized-generation)
 *  3. same name_key with equivalent normalized generation → merge variants
 * Writes are also mirrored to the local fallback store via `localFallback`.
 */
export async function saveModelToCloud(
  model: ComputerModel,
  existingCatalog: ComputerModel[],
  localFallback: (m: ComputerModel) => Promise<void>
): Promise<CloudSaveResult> {
  // ---- Level A: merge into an existing catalog entry with same name key ----
  const incomingKey = modelNameKey(model.brand, model.family, model.name);
  const incomingGen = normGeneration(model.generation);

  const twinInCatalog = existingCatalog.find((m) => {
    if (modelNameKey(m.brand, m.family, m.name) !== incomingKey) return false;
    return normGeneration(m.generation) === incomingGen;
  });

  let target = model;
  let deduped = false;

  if (twinInCatalog) {
    // Merge only configurations that don't exist yet.
    const existingVariantIds = new Set(twinInCatalog.variants.map((v) => v.id));
    const newVariants = model.variants.filter((v) => !existingVariantIds.has(v.id));
    target = {
      ...twinInCatalog,
      variants:
        newVariants.length > 0 ? [...twinInCatalog.variants, ...newVariants] : twinInCatalog.variants,
    };
    deduped = newVariants.length === 0;
  }

  // ---- Level B: check cloud for the same signature/name-key before writing ----
  if (isSupabaseConfigured()) {
    try {
      const candidates = await sbSelect<ComputerModelRow>(TABLE, {
        filters: { name_key: `eq.${incomingKey}` },
        columns: "*",
        limit: 20,
      });

      const twinInCloud = candidates.find(
        (row) =>
          row.signature === modelSignature(target) ||
          normGeneration(row.generation) === incomingGen
      );

      if (twinInCloud) {
        const cloudModel = rowToModel(twinInCloud);
        const existingVariantIds = new Set(cloudModel.variants.map((v) => v.id));
        const newVariants = target.variants.filter((v) => !existingVariantIds.has(v.id));

        if (newVariants.length === 0) {
          // Fully duplicate — reuse the stored row, write nothing.
          return { saved: false, model: cloudModel, deduped: true };
        }

        target = {
          ...cloudModel,
          variants: [...cloudModel.variants, ...newVariants],
        };
        deduped = false;
      }
    } catch (error) {
      if (!(error instanceof SupabaseUnavailableError)) {
        logError("cloud-db:dedupe-check", error);
      }
      // Fall through to upsert below; deterministic ids keep it safe anyway.
    }

    try {
      await sbUpsert(TABLE, [modelToRow(target) as Record<string, unknown>], "id");
      _cloudReachable = true;
      invalidateCloudCache();
      return { saved: true, model: target, deduped };
    } catch (error) {
      _cloudReachable = false;
      _lastFailureAt = Date.now();
      logError("cloud-db:save", error);
      // fall through to local mirror
    }
  }

  // ---- Cloud unavailable: mirror locally so nothing is lost ----
  await localFallback(target);
  return { saved: true, model: target, deduped };
}
