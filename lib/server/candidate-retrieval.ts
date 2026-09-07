/**
 * Phase 3.2.2 — Structured Candidate Retrieval
 *
 * Uses structured signals from Query Understanding to efficiently narrow
 * the candidate set BEFORE final verification and ranking.
 *
 * This module ONLY narrows candidates — it never verifies, ranks, or
 * creates computers. Final verification remains with the existing
 * variant-aware matching pipeline.
 *
 * Trust invariant: this module never creates, invents, or modifies
 * computer data. It only identifies which existing catalog records
 * are worth checking.
 */

import { ComputerModel, SearchFilters } from "../data/types";
import { HardRequirements, IntelligentQuery } from "./query-understanding";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Candidate retrieval result — a subset of the catalog worth checking. */
export interface CandidateResult {
  /** Models that passed structured candidate retrieval. */
  candidates: ComputerModel[];
  /** Which retrieval signals were used (for debugging/benchmarking). */
  signalsUsed: string[];
  /** Whether retrieval was unsafe (fell back to full catalog). */
  fallback: boolean;
}

// ---------------------------------------------------------------------------
// Retrieval indexes (built lazily from the catalog snapshot)
// ---------------------------------------------------------------------------

interface RetrievalIndexes {
  snapshot: ComputerModel[];
  byGpuText: Map<string, ComputerModel[]>;
  byCpuText: Map<string, ComputerModel[]>;
}

let _retrievalIndexKey: ComputerModel[] | null = null;
let _retrievalIndex: RetrievalIndexes | null = null;

/**
 * Build GPU/CPU text indexes for candidate retrieval.
 *
 * GPU index: lowercased GPU text → models that have at least one variant
 * with that GPU substring. Uses substring tokens for flexible matching.
 *
 * CPU index: same approach for CPU strings.
 */
function buildRetrievalIndexes(models: ComputerModel[]): RetrievalIndexes {
  const byGpuText = new Map<string, ComputerModel[]>();
  const byCpuText = new Map<string, ComputerModel[]>();

  for (const m of models) {
    const gpuTokens = new Set<string>();
    const cpuTokens = new Set<string>();

    for (const v of m.variants) {
      const gpuLower = (v.specs.gpu || "").toLowerCase();
      const cpuLower = (v.specs.cpu || "").toLowerCase();

      // Extract meaningful GPU tokens (skip common words)
      for (const token of gpuLower.split(/\s+/)) {
        if (token.length >= 2 && !/^(nvidia|amd|intel|graphics|card|mobile|max-q|max-q,?)$/.test(token)) {
          gpuTokens.add(token);
        }
      }
      // Also add 2-word GPU phrases for more precise matching
      const gpuWords = gpuLower.split(/\s+/);
      for (let i = 0; i < gpuWords.length - 1; i++) {
        const phrase = `${gpuWords[i]} ${gpuWords[i + 1]}`;
        if (!/^(nvidia|amd|intel)\s+(graphics|card|geforce|radeon)$/.test(phrase)) {
          gpuTokens.add(phrase);
        }
      }

      // Extract meaningful CPU tokens
      for (const token of cpuLower.split(/[\s-]+/)) {
        if (token.length >= 2 && !/^(intel|amd|qualcomm|processor|core)$/i.test(token)) {
          cpuTokens.add(token);
        }
      }
      // Also add full CPU model phrases
      const cpuWords = cpuLower.split(/\s+/);
      for (let i = 0; i < cpuWords.length - 1; i++) {
        const phrase = `${cpuWords[i]} ${cpuWords[i + 1]}`;
        cpuTokens.add(phrase);
      }
    }

    for (const gpuToken of gpuTokens) {
      const existing = byGpuText.get(gpuToken);
      if (existing) existing.push(m);
      else byGpuText.set(gpuToken, [m]);
    }
    for (const cpuToken of cpuTokens) {
      const existing = byCpuText.get(cpuToken);
      if (existing) existing.push(m);
      else byCpuText.set(cpuToken, [m]);
    }
  }

  return { snapshot: models, byGpuText, byCpuText };
}

function getRetrievalIndexes(models: ComputerModel[]): RetrievalIndexes {
  if (_retrievalIndexKey === models && _retrievalIndex) return _retrievalIndex;
  _retrievalIndex = buildRetrievalIndexes(models);
  _retrievalIndexKey = models;
  return _retrievalIndex;
}

/**
 * Invalidate retrieval indexes. Call alongside search index invalidation.
 */
export function invalidateRetrievalIndexes(): void {
  _retrievalIndexKey = null;
  _retrievalIndex = null;
}

// ---------------------------------------------------------------------------
// Brand candidate lookup (reuses database.ts _modelsByBrand)
// ---------------------------------------------------------------------------

/**
 * Get brand candidates from the database brand index.
 * The brand index is maintained by database.ts — we query it through
 * the models array and a simple filter.
 */
function getBrandCandidates(
  models: ComputerModel[],
  brand: string
): ComputerModel[] {
  const lower = brand.toLowerCase();
  return models.filter((m) => m.brand.toLowerCase() === lower);
}

// ---------------------------------------------------------------------------
// Category candidate lookup
// ---------------------------------------------------------------------------

function getCategoryCandidates(
  models: ComputerModel[],
  category: string
): ComputerModel[] {
  return models.filter((m) => m.category === category);
}

// ---------------------------------------------------------------------------
// GPU candidate lookup
// ---------------------------------------------------------------------------

/**
 * Find models that have at least one variant with GPU text matching
 * any of the required GPU terms. Uses the retrieval GPU index for
 * efficient lookup, with fallback to linear scan.
 */
function getGpuCandidates(
  models: ComputerModel[],
  gpuTerms: string[],
  indexes: RetrievalIndexes
): ComputerModel[] {
  if (gpuTerms.length === 0) return models;

  const candidateIds = new Set<string>();

  for (const term of gpuTerms) {
    const lower = term.toLowerCase().replace(/[^a-z0-9\s]/g, "");

    // Try index lookup first — check both the full term and individual words
    let foundViaIndex = false;
    const searchTerms = [lower, ...lower.split(/\s+/).filter((w) => w.length >= 3)];

    for (const searchTerm of searchTerms) {
      const indexed = indexes.byGpuText.get(searchTerm);
      if (indexed) {
        for (const m of indexed) candidateIds.add(m.id);
        foundViaIndex = true;
      }
    }

    // If index didn't find anything, fall back to linear scan
    if (!foundViaIndex) {
      for (const m of models) {
        for (const v of m.variants) {
          const gpuLower = (v.specs.gpu || "").toLowerCase();
          if (gpuLower.includes(lower)) {
            candidateIds.add(m.id);
            break;
          }
        }
      }
    }
  }

  return models.filter((m) => candidateIds.has(m.id));
}

// ---------------------------------------------------------------------------
// CPU candidate lookup
// ---------------------------------------------------------------------------

function getCpuCandidates(
  models: ComputerModel[],
  cpuTerms: string[],
  indexes: RetrievalIndexes
): ComputerModel[] {
  if (cpuTerms.length === 0) return models;

  const candidateIds = new Set<string>();

  for (const term of cpuTerms) {
    const lower = term.toLowerCase().replace(/[^a-z0-9\s]/g, "");

    let foundViaIndex = false;
    const searchTerms = [lower, ...lower.split(/\s+/).filter((w) => w.length >= 3)];

    for (const searchTerm of searchTerms) {
      const indexed = indexes.byCpuText.get(searchTerm);
      if (indexed) {
        for (const m of indexed) candidateIds.add(m.id);
        foundViaIndex = true;
      }
    }

    if (!foundViaIndex) {
      for (const m of models) {
        for (const v of m.variants) {
          const cpuLower = (v.specs.cpu || "").toLowerCase();
          if (cpuLower.includes(lower)) {
            candidateIds.add(m.id);
            break;
          }
        }
      }
    }
  }

  return models.filter((m) => candidateIds.has(m.id));
}

// ---------------------------------------------------------------------------
// RAM candidate lookup
// ---------------------------------------------------------------------------

/**
 * Find models that have at least one variant with RAM matching the constraint.
 * This is recall-safe: if ANY variant satisfies the RAM constraint, the model
 * is included.
 */
function getRamCandidates(
  models: ComputerModel[],
  req: HardRequirements
): ComputerModel[] {
  const ramValue = req.minRam ?? req.maxRam;
  if (ramValue === undefined) return models;

  const operator = req.ramConstraint?.operator ?? "min";

  return models.filter((m) => {
    return m.variants.some((v) => {
      const ram = v.specs.ram;
      switch (operator) {
        case "exact":
          return ram === ramValue;
        case "max":
          return ram <= ramValue;
        case "min":
        default:
          return ram >= ramValue;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Storage candidate lookup
// ---------------------------------------------------------------------------

function getStorageCandidates(
  models: ComputerModel[],
  req: HardRequirements
): ComputerModel[] {
  const storageValue = req.minStorage ?? req.maxStorage;
  if (storageValue === undefined) return models;

  const operator = req.storageConstraint?.operator ?? "min";

  return models.filter((m) => {
    return m.variants.some((v) => {
      const storage = v.specs.storage;
      switch (operator) {
        case "exact":
          return storage === storageValue;
        case "max":
          return storage <= storageValue;
        case "min":
        default:
          return storage >= storageValue;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Intersection utility
// ---------------------------------------------------------------------------

/** Intersect multiple candidate arrays, preserving deduplication by model ID. */
function intersectCandidates(pools: ComputerModel[][]): ComputerModel[] {
  if (pools.length === 0) return [];
  if (pools.length === 1) return pools[0];

  // Sort pools by size (ascending) — intersect smaller sets first for efficiency
  const sorted = [...pools].sort((a, b) => a.length - b.length);

  let result = new Set<string>(sorted[0].map((m) => m.id));
  let resultModels = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const nextIds = new Set(sorted[i].map((m) => m.id));
    const intersection = new Set<string>();
    for (const id of result) {
      if (nextIds.has(id)) intersection.add(id);
    }
    result = intersection;
    // Rebuild model list from intersection
    resultModels = resultModels.filter((m) => result.has(m.id));
    // If intersection is empty, stop early
    if (result.size === 0) return [];
  }

  return resultModels;
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Structured Candidate Retrieval.
 *
 * Uses Query Understanding output to efficiently narrow the candidate set
 * before final verification. This is a RECALL-SAFE optimization:
 * - When signals are available and reliable, use them to narrow candidates
 * - When signals are missing, incomplete, or ambiguous, fall back to the
 *   full catalog
 * - Final verification (variant-matcher) is NEVER bypassed
 *
 * @param understood — the parsed query from understandQuery()
 * @param allModels — the full catalog (from getAllModels())
 * @param filters — explicit URL params (take precedence)
 * @returns CandidateResult with narrowed candidate set and metadata
 */
export function retrieveCandidates(
  understood: IntelligentQuery,
  allModels: ComputerModel[],
  filters: SearchFilters
): CandidateResult {
  const req = understood.hardRequirements;
  const signalsUsed: string[] = [];
  let candidates = allModels;
  let fallback = false;

  // --- Phase 1: Brand/Category narrowing (highly selective) ---
  // These use the strongest available signals and are always safe.

  const effectiveBrand = req.brand || filters.brand;
  const effectiveCategory = req.category || filters.category;

  if (effectiveBrand) {
    candidates = getBrandCandidates(candidates, effectiveBrand);
    signalsUsed.push(`brand:${effectiveBrand}`);
  }

  if (effectiveCategory) {
    candidates = getCategoryCandidates(candidates, effectiveCategory);
    signalsUsed.push(`category:${effectiveCategory}`);
  }

  // If brand/category already narrowed to a small set, skip GPU/CPU
  // retrieval to avoid over-filtering. Threshold: < 50 models.
  if (candidates.length <= 50) {
    // Small enough — final verification will handle the rest
    return { candidates, signalsUsed, fallback };
  }

  // --- Phase 2: GPU/CPU narrowing (medium selectivity) ---
  // Only apply when we have explicit terms AND the candidate set is still large.
  // This is recall-safe: we use OR matching (any GPU term qualifies).

  const hasGpuTerms = req.gpuTerms && req.gpuTerms.length > 0;
  const hasCpuTerms = req.cpuTerms && req.cpuTerms.length > 0;

  if ((hasGpuTerms || hasCpuTerms) && candidates.length > 50) {
    const indexes = getRetrievalIndexes(allModels);

    // Use GPU/CPU indexes from the FULL catalog, then intersect with
    // current candidates (brand/category narrowed set).
    if (hasGpuTerms) {
      const gpuCandidates = getGpuCandidates(allModels, req.gpuTerms!, indexes);
      // Intersect: keep only models that are in BOTH the GPU candidates
      // AND the current candidates
      const gpuIds = new Set(gpuCandidates.map((m) => m.id));
      candidates = candidates.filter((m) => gpuIds.has(m.id));
      signalsUsed.push(`gpu:[${req.gpuTerms!.join(",")}]`);
    }

    if (hasCpuTerms) {
      const cpuCandidates = getCpuCandidates(allModels, req.cpuTerms!, indexes);
      const cpuIds = new Set(cpuCandidates.map((m) => m.id));
      candidates = candidates.filter((m) => cpuIds.has(m.id));
      signalsUsed.push(`cpu:[${req.cpuTerms!.join(",")}]`);
    }

    // If GPU/CPU filtering eliminated too aggressively, fall back
    if (candidates.length === 0 && (hasGpuTerms || hasCpuTerms)) {
      // GPU/CPU retrieval was too aggressive — fall back to brand/category
      // candidates only (which are already applied above).
      fallback = true;
      candidates = allModels;
      signalsUsed.length = 0;
      if (effectiveBrand) {
        candidates = getBrandCandidates(candidates, effectiveBrand);
        signalsUsed.push(`brand:${effectiveBrand}`);
      }
      if (effectiveCategory) {
        candidates = getCategoryCandidates(candidates, effectiveCategory);
        signalsUsed.push(`category:${effectiveCategory}`);
      }
    }
  }

  // --- Phase 3: RAM/Storage narrowing (conditional) ---
  // Only apply when the candidate set is still large and the constraints
  // are explicit (not ambiguous). This is recall-safe: OR matching on variants.

  if (candidates.length > 100) {
    if (req.minRam !== undefined || req.maxRam !== undefined) {
      const ramCandidates = getRamCandidates(candidates, req);
      if (ramCandidates.length > 0) {
        candidates = ramCandidates;
        signalsUsed.push(`ram:${req.minRam ?? "?"}-${req.maxRam ?? "?"}`);
      }
    }

    if (req.minStorage !== undefined || req.maxStorage !== undefined) {
      const storageCandidates = getStorageCandidates(candidates, req);
      if (storageCandidates.length > 0) {
        candidates = storageCandidates;
        signalsUsed.push(`storage:${req.minStorage ?? "?"}-${req.maxStorage ?? "?"}`);
      }
    }
  }

  // --- Phase 4: Price narrowing (from URL params or budget) ---
  // Price filtering is also done in the variant matcher, but applying it
  // here reduces the candidate set earlier.
  const effectiveMaxPrice = filters.maxPrice ?? req.maxPrice;
  const effectiveMinPrice = filters.minPrice ?? req.minPrice;
  if (effectiveMaxPrice !== undefined || effectiveMinPrice !== undefined) {
    candidates = candidates.filter((m) => {
      return m.variants.some((v) => {
        if (effectiveMaxPrice !== undefined && v.price > effectiveMaxPrice) return false;
        if (effectiveMinPrice !== undefined && v.price < effectiveMinPrice) return false;
        return true;
      });
    });
    if (effectiveMaxPrice !== undefined) signalsUsed.push(`price:max=${effectiveMaxPrice}`);
    if (effectiveMinPrice !== undefined) signalsUsed.push(`price:min=${effectiveMinPrice}`);
  }

  return { candidates, signalsUsed, fallback };
}
