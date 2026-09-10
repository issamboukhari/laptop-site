import type { ComputerModel, ComputerVariant } from "@/lib/data/types";

/**
 * Phase 3.2.7 — Search-quality evaluation dataset v2.
 *
 * Regression benchmark: 45 queries across 9 groups.
 * Measures whether search quality regresses from baseline, not absolute quality.
 *
 * Every query carries a DETERMINISTIC variant-level relevance predicate
 * derived from catalog facts. Negative queries carry expectedResult: "empty"
 * for explicit no-result verification.
 */

export type QualityGroup =
  | "exact"
  | "hardware"
  | "combined"
  | "semantic"
  | "natural-language"
  | "arabic"
  | "darija"
  | "typo"
  | "negative";

export interface QualityQuery {
  id: string;
  group: QualityGroup;
  query: string;
  description: string;
  /** Binary variant-level relevance, derived from catalog facts. */
  relevant: (model: ComputerModel, variant: ComputerVariant) => boolean;
  /**
   * Explicit expected outcome. Negative queries declare expectedResult: "empty"
   * so the no-result gate checks this directly instead of relying on
   * relevant() returning false for every variant.
   */
  expectedResult: "empty" | "non-empty";
  /** Regression note: what this query tests and why it matters. */
  regressionNote?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers (mirrors search-evaluation.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Dataset v2 — 45 queries across 9 evaluation groups
// ---------------------------------------------------------------------------

export const QUALITY_DATASET_VERSION = "v2";

export const QUALITY_GROUPS: QualityGroup[] = [
  "exact",
  "hardware",
  "combined",
  "semantic",
  "natural-language",
  "arabic",
  "darija",
  "typo",
  "negative",
];

export const QUALITY_QUERIES: QualityQuery[] = [
  // ================================================================ Exact (5)
  {
    id: "exact-elitebook-840-g8",
    group: "exact",
    query: "HP EliteBook 840 G8",
    description: "Exact model query — HP 840 G8 family.",
    relevant: (m) => brandIs(m, "HP") && nameIncludes(m, "elitebook", "840", "g8"),
    expectedResult: "non-empty",
  },
  {
    id: "exact-t14-gen4",
    group: "exact",
    query: "Lenovo ThinkPad T14 Gen 4",
    description: "Exact model query — T14 Gen 4, verify exact-generation matching.",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad", "t14", "gen4"),
    expectedResult: "non-empty",
  },
  {
    id: "exact-t14-gen3",
    group: "exact",
    query: "Lenovo ThinkPad T14 Gen 3",
    description: "Exact model query — generation-sensitive (Gen 3 vs Gen 4).",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad", "t14", "gen3"),
    expectedResult: "non-empty",
  },
  {
    id: "exact-x1-carbon-g11",
    group: "exact",
    query: "Lenovo ThinkPad X1 Carbon Gen 11",
    description: "Exact model query — premium carbon family, Gen 11.",
    relevant: (m) =>
      brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad x1 carbon", "gen11"),
    expectedResult: "non-empty",
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
    expectedResult: "non-empty",
  },

  // ============================================================= Hardware (5)
  {
    id: "hw-rtx4060-16gb",
    group: "hardware",
    query: "RTX 4060 16GB",
    description: "GPU + RAM on the SAME variant.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060") && ramIs(v, 16),
    expectedResult: "non-empty",
  },
  {
    id: "hw-rtx4060",
    group: "hardware",
    query: "laptop with RTX 4060",
    description: "Discrete GPU requirement.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060"),
    expectedResult: "non-empty",
  },
  {
    id: "hw-ryzen7-16gb",
    group: "hardware",
    query: "16GB RAM Ryzen 7",
    description: "CPU + RAM requirement.",
    relevant: (_m, v) => cpuIncludes(v, "ryzen7") && ramIs(v, 16),
    expectedResult: "non-empty",
  },
  {
    id: "hw-1tb-core-i7",
    group: "hardware",
    query: "1TB SSD Core i7",
    description:
      "Storage (catalog 1TB convention = 1024GB) + Intel i7.",
    relevant: (_m, v) => storageIs(v, 1024) && cpuIncludes(v, "i7"),
    expectedResult: "non-empty",
  },
  {
    id: "hw-16gb",
    group: "hardware",
    query: "16GB RAM laptop",
    description: "Exact RAM capacity (pipeline criteria uses exact equality).",
    relevant: (_m, v) => ramIs(v, 16),
    expectedResult: "non-empty",
  },

  // ============================================================ Combined (4)
  {
    id: "comb-lenovo-gaming-4060-16",
    group: "combined",
    query: "Lenovo gaming laptop RTX 4060 16GB",
    description: "Brand + GPU + RAM combined on one variant.",
    relevant: (m, v) =>
      brandIs(m, "Lenovo") && gpuIncludes(v, "rtx 4060") && ramIs(v, 16),
    expectedResult: "non-empty",
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
    expectedResult: "non-empty",
  },
  {
    id: "comb-thinkpad-32gb",
    group: "combined",
    query: "ThinkPad 32GB",
    description: "Family + RAM (32GB).",
    relevant: (m, v) => nameIncludes(m, "thinkpad") && ramIs(v, 32),
    expectedResult: "non-empty",
  },
  {
    id: "comb-lenovo-i7-16gb",
    group: "combined",
    query: "Lenovo i7 16GB",
    description: "Brand + CPU + RAM.",
    relevant: (m, v) =>
      brandIs(m, "Lenovo") && cpuIncludes(v, "i7") && ramIs(v, 16),
    expectedResult: "non-empty",
  },

  // ============================================================ Semantic (4)
  {
    id: "sem-programming",
    group: "semantic",
    query: "laptop for programming",
    description: "Intent: programming = strong CPU + RAM.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 70,
    expectedResult: "non-empty",
  },
  {
    id: "sem-gaming",
    group: "semantic",
    query: "powerful laptop for gaming",
    description: "Intent: gaming = discrete-class GPU.",
    relevant: (_m, v) => v.specs.gpuScore >= 55,
    expectedResult: "non-empty",
  },
  {
    id: "sem-portable-battery",
    group: "semantic",
    query: "portable laptop with good battery",
    description: "Intent: portability + battery life.",
    relevant: (_m, v) => v.specs.weight <= 1.5 && v.specs.batteryLife >= 10,
    expectedResult: "non-empty",
  },
  {
    id: "sem-university",
    group: "semantic",
    query: "lightweight laptop for university",
    description: "Intent: lightweight + affordable.",
    relevant: (_m, v) => v.specs.weight <= 1.4 && v.price < 1000,
    expectedResult: "non-empty",
  },

  // ==================================================== Natural Language (6)
  {
    id: "nl-gaming",
    group: "natural-language",
    query: "a good gaming laptop",
    description: "Natural language: gaming = any discrete GPU (gpuScore >= 50).",
    relevant: (_m, v) => v.specs.gpuScore >= 50,
    expectedResult: "non-empty",
    regressionNote: "Any discrete GPU = relevant for 'gaming'",
  },
  {
    id: "nl-programming",
    group: "natural-language",
    query: "a laptop for programming",
    description: "Natural language: programming needs RAM + decent CPU.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 60,
    expectedResult: "non-empty",
    regressionNote: "Programming needs RAM + decent CPU",
  },
  {
    id: "nl-portable",
    group: "natural-language",
    query: "a lightweight laptop",
    description: "Natural language: portable = under 1.4kg.",
    relevant: (_m, v) => v.specs.weight <= 1.4 && v.specs.weight > 0,
    expectedResult: "non-empty",
    regressionNote: "Portable = under 1.4kg",
  },
  {
    id: "nl-budget-gaming",
    group: "natural-language",
    query: "a gaming laptop under $1000",
    description: "Natural language: budget gaming = RTX under $1000.",
    relevant: (_m, v) => gpuIncludes(v, "rtx") && v.price < 1000,
    expectedResult: "non-empty",
    regressionNote: "Budget gaming = RTX under $1000",
  },
  {
    id: "nl-business",
    group: "natural-language",
    query: "a business laptop",
    description: "Natural language: business = EliteBook or ThinkPad.",
    relevant: (m) =>
      (brandIs(m, "HP") && nameIncludes(m, "elitebook")) ||
      (brandIs(m, "Lenovo") && nameIncludes(m, "thinkpad")),
    expectedResult: "non-empty",
    regressionNote: "Business = EliteBook or ThinkPad",
  },
  {
    id: "nl-powerful",
    group: "natural-language",
    query: "a powerful laptop",
    description: "Natural language: powerful = 32GB+ RAM.",
    relevant: (_m, v) => v.specs.ram >= 32,
    expectedResult: "non-empty",
    regressionNote: "Powerful = 32GB+ RAM",
  },

  // =============================================================== Arabic (4)
  {
    id: "ar-rtx4060",
    group: "arabic",
    query: "حاسوب ألعاب بـ RTX 4060",
    description: "Arabic: gaming computer with RTX 4060.",
    relevant: (_m, v) => gpuIncludes(v, "rtx 4060"),
    expectedResult: "non-empty",
    regressionNote: "Arabic for 'gaming computer RTX 4060'",
  },
  {
    id: "ar-programming",
    group: "arabic",
    query: "حاسوب قوي للبرمجة",
    description: "Arabic: powerful computer for programming.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 70,
    expectedResult: "non-empty",
    regressionNote: "Arabic for 'powerful programming'",
  },
  {
    id: "ar-light-battery",
    group: "arabic",
    query: "لابتوب خفيف وبطارية جيدة",
    description: "Arabic: light laptop with good battery.",
    relevant: (_m, v) => v.specs.weight <= 1.5 && v.specs.batteryLife >= 10,
    expectedResult: "non-empty",
    regressionNote: "Arabic for 'light with good battery'",
  },
  {
    id: "ar-lenovo-16",
    group: "arabic",
    query: "لابتوب لينوفو 16 رام",
    description: "Arabic: Lenovo laptop 16 RAM.",
    relevant: (m, v) => brandIs(m, "Lenovo") && ramIs(v, 16),
    expectedResult: "non-empty",
    regressionNote: "Arabic: 'Lenovo laptop 16 RAM'",
  },

  // =============================================================== Darija (4)
  {
    id: "dj-gaming",
    group: "darija",
    query: "pc gaming مليح",
    description: "Darija: good gaming PC.",
    relevant: (_m, v) => gpuIncludes(v, "rtx"),
    expectedResult: "non-empty",
    regressionNote: "Darija: 'good gaming PC' — RTX = good",
  },
  {
    id: "dj-university",
    group: "darija",
    query: "لابتوب خفيف للجامعة",
    description: "Darija: light laptop for university.",
    relevant: (_m, v) => v.specs.weight <= 1.5 && v.price < 1200,
    expectedResult: "non-empty",
    regressionNote: "Darija: 'light laptop for university'",
  },
  {
    id: "dj-programming",
    group: "darija",
    query: "أحسن لابتوب للبرمجة",
    description: "Darija: best laptop for programming.",
    relevant: (_m, v) => v.specs.ram >= 16 && v.specs.cpuScore >= 60,
    expectedResult: "non-empty",
    regressionNote: "Darija: 'best laptop for programming'",
  },
  {
    id: "dj-thinkpad-16",
    group: "darija",
    query: "بلاك باس 16 رام",
    description: "Darija phonetic: ThinkPad 16 RAM.",
    relevant: (m, v) => nameIncludes(m, "thinkpad") && ramIs(v, 16),
    expectedResult: "non-empty",
    regressionNote: "Darija phonetic: 'ThinkPad 16 RAM'",
  },

  // ================================================================ Typo (3)
  {
    id: "typo-thinkpad-32-spaced",
    group: "typo",
    query: "thinkpad 32 gb",
    description: "Extra space in '32 gb' — normalization must handle.",
    relevant: (m, v) => nameIncludes(m, "thinkpad") && ramIs(v, 32),
    expectedResult: "non-empty",
    regressionNote: "Extra space in '32 gb' — normalization must handle",
  },
  {
    id: "typo-elytebook",
    group: "typo",
    query: "HP elytebook",
    description: "Common typo 'elytebook' → should fuzzy-match.",
    relevant: (m) => brandIs(m, "HP") && nameIncludes(m, "elitebook"),
    expectedResult: "non-empty",
    regressionNote: "Common typo 'elytebook' → should fuzzy-match",
  },
  {
    id: "typo-ryzen-go",
    group: "typo",
    query: "ryzen 7 16 go",
    description: "French 'go' = GB — should normalize.",
    relevant: (_m, v) => cpuIncludes(v, "ryzen7") && ramIs(v, 16),
    expectedResult: "non-empty",
    regressionNote: "French 'go' = GB — should normalize",
  },

  // =========================================================== Negative (10)
  {
    id: "neg-200-rtx4060",
    group: "negative",
    query: "gaming laptop RTX 4060 $200",
    description: "Cheapest RTX 4060 is $1,249 — $200 is impossible.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "Cheapest RTX 4060 is $1,249",
  },
  {
    id: "neg-1tb-ram",
    group: "negative",
    query: "ThinkPad 1TB RAM",
    description: "No laptop has 1TB RAM — max is 128GB.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "No laptop has 1TB RAM",
  },
  {
    id: "neg-macbook-rtx",
    group: "negative",
    query: "MacBook with RTX 4060",
    description: "Apple uses M-series, never NVIDIA GPUs.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "Apple uses M-series, never NVIDIA",
  },
  {
    id: "neg-800gb-ram",
    group: "negative",
    query: "laptop with 800GB RAM",
    description: "No such RAM size exists.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "No such RAM size",
  },
  {
    id: "neg-300-gaming",
    group: "negative",
    query: "gaming laptop under $300",
    description: "Cheapest gaming laptop is $799.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "Cheapest gaming is $799",
  },
  {
    id: "neg-128gb-ultrabook",
    group: "negative",
    query: "128GB RAM ultrabook",
    description: "Ultrabooks max at 32GB RAM.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "Ultrabooks max at 32GB",
  },
  {
    id: "neg-iphone-laptop",
    group: "negative",
    query: "iPhone laptop",
    description: "No such product exists.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "No such product",
  },
  {
    id: "neg-impossible-spec",
    group: "negative",
    query: "ThinkPad touchscreen RTX 4080 2TB under $500",
    description: "Impossible spec+price combo.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "Impossible spec+price combo",
  },
  {
    id: "neg-desktop-cheap",
    group: "negative",
    query: "desktop 64GB RAM under $200",
    description: "No desktop at that price+RAM.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "No desktop at that price+RAM",
  },
  {
    id: "neg-ryzen9-3050",
    group: "negative",
    query: "Ryzen 9 RTX 3050 256GB",
    description: "No Ryzen 9 paired with RTX 3050 in catalog.",
    relevant: () => false,
    expectedResult: "empty",
    regressionNote: "No Ryzen 9 paired with RTX 3050",
  },
];
