/**
 * Phase 3.2.1 — Query Understanding → SearchFilters adapter
 *
 * Translates structured HardRequirements (from understandQuery()) into
 * SearchFilters format consumed by the existing variant-matcher pipeline.
 *
 * This adapter ONLY maps hard, explicit requirements. Soft preferences
 * (lightweight, goodBattery, etc.) are NOT mapped to filters — they
 * remain as metadata for future ranking work.
 *
 * Anti-hallucination invariant: this module never creates, invents,
 * or modifies computer data. It only translates filter boundaries.
 */

import { SearchFilters, ComputerCategory } from "../data/types";
import { HardRequirements, IntelligentQuery } from "./query-understanding";

/**
 * Convert HardRequirements into SearchFilters.
 *
 * Rules:
 * - Only explicit, numeric/boolean requirements become filters.
 * - cpuTerms and gpuTerms are NOT mapped (handled by extractSpecCriteria in search.ts).
 * - Constraint operators (min/max/exact) are respected where SearchFilters supports them.
 * - brand and category are passed through when present.
 * - screenSize is a single value in SearchFilters; minScreenSize maps to it.
 * - Budget (minPrice/maxPrice) is mapped when present.
 */
export function hardRequirementsToFilters(
  req: HardRequirements
): Partial<SearchFilters> {
  const filters: Partial<SearchFilters> = {};

  // --- RAM ---
  // Respect constraint operators when SearchFilters supports min/max
  if (req.ramConstraint) {
    const c = req.ramConstraint;
    if (c.operator === "exact") {
      filters.minRam = c.value;
      filters.maxRam = c.value;
    } else if (c.operator === "max") {
      filters.maxRam = c.value;
    } else {
      // "min" or default
      filters.minRam = c.value;
    }
  } else {
    if (req.minRam !== undefined) filters.minRam = req.minRam;
    if (req.maxRam !== undefined) filters.maxRam = req.maxRam;
  }

  // --- Storage ---
  if (req.storageConstraint) {
    const c = req.storageConstraint;
    if (c.operator === "exact") {
      filters.minStorage = c.value;
      filters.maxStorage = c.value;
    } else if (c.operator === "max") {
      filters.maxStorage = c.value;
    } else {
      filters.minStorage = c.value;
    }
  } else {
    if (req.minStorage !== undefined) filters.minStorage = req.minStorage;
    if (req.maxStorage !== undefined) filters.maxStorage = req.maxStorage;
  }

  // --- Price ---
  if (req.priceConstraint) {
    const c = req.priceConstraint;
    if (c.operator === "exact") {
      filters.minPrice = c.value;
      filters.maxPrice = c.value;
    } else if (c.operator === "max") {
      filters.maxPrice = c.value;
    } else {
      filters.minPrice = c.value;
    }
  } else {
    if (req.minPrice !== undefined) filters.minPrice = req.minPrice;
    if (req.maxPrice !== undefined) filters.maxPrice = req.maxPrice;
  }

  // --- Screen size ---
  // SearchFilters has a single `screenSize` field (exact match).
  // We use minScreenSize as the filter — the variant matcher checks exact displaySize.
  if (req.minScreenSize !== undefined) {
    filters.screenSize = req.minScreenSize;
  }

  // --- Touchscreen ---
  if (req.touchscreen !== undefined) {
    filters.touchscreen = req.touchscreen;
  }

  // --- Brand (model-level) ---
  if (req.brand !== undefined) {
    filters.brand = req.brand;
  }

  // --- Category (model-level) ---
  if (req.category !== undefined) {
    // Validate it's a known category — pass through only if valid
    const valid: ComputerCategory[] = [
      "gaming-laptop",
      "business-laptop",
      "ultrabook",
      "macbook",
      "workstation",
      "desktop",
      "mini-pc",
    ];
    if (valid.includes(req.category as ComputerCategory)) {
      filters.category = req.category as ComputerCategory;
    }
  }

  return filters;
}

/**
 * Convert the full IntelligentQuery result into SearchFilters.
 * Handles both hard requirements AND budget (which maps to maxPrice).
 */
export function understoodQueryToFilters(
  query: IntelligentQuery
): Partial<SearchFilters> {
  const filters = hardRequirementsToFilters(query.hardRequirements);

  // Budget → maxPrice (only when currency is certain or amount is reasonable)
  if (query.budget) {
    if (query.budget.currencyCertain) {
      // Certain currency: apply as maxPrice
      filters.maxPrice = query.budget.amount;
    } else if (query.budget.amount > 1000) {
      // Uncertain currency but large amount: likely a budget cap
      // Apply as maxPrice (conservative — won't filter out cheap models)
      filters.maxPrice = query.budget.amount;
    }
    // Small uncertain amounts (< 1000): don't apply as price filter
    // (could be a model number, not a price)
  }

  return filters;
}
