import { ComputerModel, ComputerVariant, SearchFilters } from "../data/types";

/**
 * Centralized variant-aware filter matching.
 *
 * A model matches when at least one of its variants satisfies ALL
 * applicable configuration-level constraints simultaneously.
 * Model-level constraints (brand, family, category, year) are checked
 * separately at the model level.
 *
 * This is the single source of truth for variant-level filter matching.
 * Both `matchFilters` (database.ts) and `matchFiltersPost` (search.ts)
 * delegate variant-level checks here.
 */

/**
 * Check whether a single variant satisfies all configuration-level filters.
 * Each constraint must be satisfied by THIS variant — no cross-variant combining.
 */
export function variantMatchesFilters(
  variant: ComputerVariant,
  filters: SearchFilters
): boolean {
  const s = variant.specs;

  if (filters.minRam && s.ram < filters.minRam) return false;
  if (filters.maxRam && s.ram > filters.maxRam) return false;
  if (filters.minStorage && s.storage < filters.minStorage) return false;
  if (filters.maxStorage && s.storage > filters.maxStorage) return false;
  if (filters.screenSize && s.displaySize !== filters.screenSize) return false;
  if (filters.touchscreen !== undefined && s.touchscreen !== filters.touchscreen) return false;

  // Price is also configuration-level — check against THIS variant's price
  if (filters.minPrice && variant.price < filters.minPrice) return false;
  if (filters.maxPrice && variant.price > filters.maxPrice) return false;

  return true;
}

/**
 * Check whether at least one variant in the model satisfies all
 * configuration-level filters. Returns the matching variants.
 *
 * If no configuration-level filters are active, returns all variants
 * (they all "match" the empty filter set).
 *
 * Handles models with no variants by returning an empty array.
 */
export function findMatchingVariants(
  model: ComputerModel,
  filters: SearchFilters
): ComputerVariant[] {
  const variants = model.variants;
  if (!variants || variants.length === 0) return [];

  // Check if any configuration-level filter is active
  if (!hasAnyConfigFilter(filters)) {
    return variants;
  }

  return variants.filter((v) => variantMatchesFilters(v, filters));
}

/**
 * Check whether a model matches all filters — both model-level and
 * configuration-level. Configuration-level constraints require at least
 * one variant to satisfy ALL of them simultaneously (including price).
 *
 * This is the primary entry point for model-level filtering.
 */
export function modelMatchesFilters(
  model: ComputerModel,
  filters: SearchFilters
): boolean {
  // Model-level checks
  if (filters.brand && model.brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
  if (filters.family && (!model.family || !model.family.toLowerCase().includes(filters.family.toLowerCase()))) return false;
  if (filters.category && model.category !== filters.category) return false;
  if (filters.minYear && model.year < filters.minYear) return false;
  if (filters.maxYear && model.year > filters.maxYear) return false;

  // Configuration-level: at least one variant must satisfy ALL spec + price filters
  const matching = findMatchingVariants(model, filters);
  if (matching.length === 0 && hasAnyConfigFilter(filters)) return false;

  return true;
}

/**
 * Check whether any configuration-level filter is active in the given filters.
 */
function hasAnyConfigFilter(f: SearchFilters): boolean {
  return (
    f.minRam !== undefined ||
    f.maxRam !== undefined ||
    f.minStorage !== undefined ||
    f.maxStorage !== undefined ||
    f.screenSize !== undefined ||
    f.touchscreen !== undefined ||
    f.minPrice !== undefined ||
    f.maxPrice !== undefined
  );
}

/**
 * Model-level filter check only (brand, family, category, year).
 * Does NOT check variant-level constraints.
 * Used when variant matching is handled separately.
 */
export function modelMatchesBaseFilters(
  model: ComputerModel,
  filters: SearchFilters
): boolean {
  if (filters.brand && model.brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
  if (filters.family && (!model.family || !model.family.toLowerCase().includes(filters.family.toLowerCase()))) return false;
  if (filters.category && model.category !== filters.category) return false;
  if (filters.minYear && model.year < filters.minYear) return false;
  if (filters.maxYear && model.year > filters.maxYear) return false;
  return true;
}
