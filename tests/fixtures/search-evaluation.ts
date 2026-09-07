import type { ComputerModel, ComputerVariant } from "@/lib/data/types";

/**
 * Phase 3.2.5 — Search-quality evaluation dataset.
 *
 * Every query carries a DETERMINISTIC variant-level relevance predicate.
 * The predicate is evaluated against real catalog data only — nothing is
 * invented. A query with no evaluable claim in the catalog must be excluded
 * (dataset sanity test enforces >=1 relevant variant per query).
 */

export type EvaluationGroup =
  | "exact"
  | "hardware"
  | "combined"
  | "semantic"
  | "arabic";

export interface EvaluationQuery {
  id: string;
  group: EvaluationGroup;
  query: string;
  description: string;
  /** Binary variant-level relevance, derived from catalog facts. */
  relevant: (model: ComputerModel, variant: ComputerVariant) => boolean;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const brandIs = (model: ComputerModel, b: string): boolean =>
  norm(model.brand) === norm(b);

const nameIncludes = (model: ComputerModel, ...parts: string[]): boolean =>
  parts.every((p) => norm(model.name).includes(norm(p)));

const gpuIncludes = (variant: ComputerVariant, needle: string): boolean =>
  norm(variant.specs.gpu).includes(norm(needle));

const cpuIncludes = (variant: ComputerVariant, needle: string): boolean =>
  norm(variant.specs.cpu).includes(norm(needle));

const ramIs = (variant: ComputerVariant, v: number): boolean =>
  variant.specs.ram === v;

const storageIs = (variant: ComputerVariant, v: number): boolean =>
  variant.specs.storage === v;

/**
 * Dataset v1 — 21 queries across the five required evaluation groups.
 *
 * Relevance refers to a VARIANT (the exact hardware configuration), matching
 * Gen's model/variant identity model and the Phase 3.2.4 anti-merging rule.
 */
export const SEARCH_EVALUATION_VERSION = "v1";

export const SEARCH_EVALUATION_QUERIES: EvaluationQuery[] = [
  // ---------------------------------------------------------------- Exact
  {
    id: "exact-elitebook-840-g8",
    group: "exact",
    query: "HP EliteBook 840 G8",
    description: "Exact model query — HP 840 G8 family.",
    relevant: (m) =>
      brandIs(m, "HP") && nameIncludes(m, "elitebook", "840", "g8"),
  },
  {
    id: "exact-t14-gen4",
    group: "exact",
    query: "Lenovo ThinkPad T14 Gen 4",
    description: "Exact model query — T14 Gen 4, verify exact-generation matching.",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad", "t14", "gen4"),
  },
  {
    id: "exact-t14-gen3",
    group: "exact",
    query: "Lenovo ThinkPad T14 Gen 3",
    description: "Exact model query — generation-sensitive (Gen 3 vs Gen 4).",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad", "t14", "gen3"),
  },
  {
    id: "exact-x1-carbon-g11",
    group: "exact",
    query: "Lenovo ThinkPad X1 Carbon Gen 11",
    description: "Exact model query — premium carbon family, Gen 11.",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad x1 carbon", "gen11"),
  },
  {
    id: "exact-macbook-air-m4",
    group: "exact",
    query: "Apple MacBook Air M4",
    description: "Exact model query — Apple silicon generation filter (M4 only).",
    relevant: (m, v) =>
      brandIs(m, "Apple") &&
      nameIncludes(m, "macbook", "air") &&
      cpuIncludes(v, "m4"),
  },

  // -------------------------------------------------------------- Hardware
  {
    id: "hw-rtx4060-16gb",
    group: "hardware",
    query: "RTX 4060 16GB",
    description: "GPU + RAM on the SAME variant.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060") && ramIs(v, 16),
  },
  {
    id: "hw-rtx4060",
    group: "hardware",
    query: "laptop with RTX 4060",
    description: "Discrete GPU requirement.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060"),
  },
  {
    id: "hw-ryzen7-16gb",
    group: "hardware",
    query: "16GB RAM Ryzen 7",
    description: "CPU + RAM requirement.",
    relevant: (_m, v) => cpuIncludes(v, "ryzen7") && ramIs(v, 16),
  },
  {
    id: "hw-1tb-core-i7",
    group: "hardware",
    query: "1TB SSD Core i7",
    description: "Storage (catalog 1TB convention = 1024GB) + Intel i7. NOTE: ~25 catalog variants advertise '1TB' in their name but store 1000GB and are therefore excluded by the 1TB constraint — a documented data-quality gap surfaced by calibration.",
    relevant: (_m, v) => storageIs(v, 1024) && cpuIncludes(v, "i7"),
  },
  {
    id: "hw-16gb",
    group: "hardware",
    query: "16GB RAM laptop",
    description: "Exact RAM capacity (pipeline criteria uses exact equality).",
    relevant: (_m, v) => ramIs(v, 16),
  },

  // ------------------------------------------------------------- Combined
  {
    id: "comb-lenovo-gaming-4060-16",
    group: "combined",
    query: "Lenovo gaming laptop RTX 4060 16GB",
    description: "Brand + GPU + RAM combined on one variant.",
    relevant: (m, v) =>
      brandIs(m, "Lenovo") && gpuIncludes(v, "rtx 4060") && ramIs(v, 16),
  },
  {
    id: "comb-hp-16gb-512gb",
    group: "combined",
    query: "HP EliteBook 16GB 512GB",
    description: "Brand + family + RAM + storage.",
    relevant: (m, v) =>
      brandIs(m, "HP") &&
      nameIncludes(m, "elitebook") &&
      ramIs(v, 16) &&
      storageIs(v, 512),
  },
  {
    id: "comb-thinkpad-32gb",
    group: "combined",
    query: "ThinkPad 32GB",
    description: "Family + RAM (32GB). 1TB excluded: catalog stores 1TB variants as 1000GB while the pipeline convention is 1024GB — a documented data-quality gap.",
    relevant: (m, v) =>
      nameIncludes(m, "thinkpad") && ramIs(v, 32),
  },
  {
    id: "comb-lenovo-i7-16gb",
    group: "combined",
    query: "Lenovo i7 16GB",
    description: "Brand + CPU + RAM.",
    relevant: (m, v) =>
      brandIs(m, "Lenovo") && cpuIncludes(v, "i7") && ramIs(v, 16),
  },

  // ------------------------------------------------------------- Semantic
  {
    id: "sem-programming",
    group: "semantic",
    query: "laptop for programming",
    description: "Intent: programming = strong CPU + RAM.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 70,
  },
  {
    id: "sem-gaming",
    group: "semantic",
    query: "powerful laptop for gaming",
    description: "Intent: gaming = discrete-class GPU.",
    relevant: (_m, v) => v.specs.gpuScore >= 55,
  },
  {
    id: "sem-portable-battery",
    group: "semantic",
    query: "portable laptop with good battery",
    description: "Intent: portability + battery life.",
    relevant: (_m, v) => v.specs.weight <= 1.5 && v.specs.batteryLife >= 10,
  },
  {
    id: "sem-university",
    group: "semantic",
    query: "lightweight laptop for university",
    description: "Intent: lightweight + affordable.",
    relevant: (_m, v) => v.specs.weight <= 1.4 && v.price < 1000,
  },

  // --------------------------------------------------------------- Arabic
  {
    id: "ar-rtx4060",
    group: "arabic",
    query: "حاسوب ألعاب بـ RTX 4060",
    description: "Arabic: gaming computer with RTX 4060.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060"),
  },
  {
    id: "ar-light-battery",
    group: "arabic",
    query: "لاب توب خفيف وبطارية مليحة",
    description: "Darija: light laptop with good battery.",
    relevant: (_m, v) => v.specs.weight <= 1.5,
  },
  {
    id: "ar-programming",
    group: "arabic",
    query: "حاسوب قوي للبرمجة",
    description: "Arabic: powerful computer for programming.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 70,
  },
];

export const EVALUATION_GROUPS: EvaluationGroup[] = [
  "exact",
  "hardware",
  "combined",
  "semantic",
  "arabic",
];