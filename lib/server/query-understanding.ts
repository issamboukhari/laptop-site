/**
 * Phase 3.1 — Intelligent Query Understanding
 *
 * Preprocessing layer that converts a raw user query (Arabic, English, or
 * mixed) into a structured representation BEFORE the existing search engine
 * runs. The existing search engine is the SOURCE OF TRUTH for catalog
 * matches — this layer only extracts user INTENT and explicit HARDWARE
 * requirements.
 *
 * Anti-hallucination: this module NEVER creates or returns fictional
 * computers. It only parses what the user asked for.
 */

import { UseCase } from "../data/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueryLanguage = "ar" | "en" | "mixed";
export type QueryIntent = "search" | "recommendation" | "comparison" | "unknown";
export type Confidence = "high" | "medium" | "low";

/** Constraint operator for numeric requirements. */
export type ConstraintOperator = "min" | "max" | "exact" | "range";

/** Structured numeric constraint with explicit operator. */
export interface NumericConstraint {
  operator: ConstraintOperator;
  value: number;
  maxValue?: number; // Only for "range"
  unit?: string; // "GB", "TB", "Hz", "inch", etc.
}

/** Explicit numeric/technical requirements that should be enforced as filters. */
export interface HardRequirements {
  minRam?: number;
  maxRam?: number;
  minStorage?: number;
  maxStorage?: number;
  minPrice?: number;
  maxPrice?: number;
  minScreenSize?: number;
  maxScreenSize?: number;
  minRefreshRate?: number;
  maxRefreshRate?: number;
  touchscreen?: boolean;
  cpuTerms?: string[];
  gpuTerms?: string[];
  brand?: string;
  category?: string;
  /**
   * Structured numeric constraints with explicit operators.
   * Phase 3.1.1 addition: separates "at least 16GB" from "up to 16GB" from "exactly 16GB".
   * Existing minRam/minStorage fields are still populated for backwards compatibility.
   */
  ramConstraint?: NumericConstraint;
  storageConstraint?: NumericConstraint;
  priceConstraint?: NumericConstraint;
}

/** Soft preferences that influence ranking/context but never filter. */
export interface Preferences {
  lightweight?: boolean;
  goodBattery?: boolean;
  fast?: boolean;
  highPerformance?: boolean;
  budget?: boolean;
  premium?: boolean;
  portable?: boolean;
  dedicatedGpu?: boolean;
  integratedGpu?: boolean;
  cpuPreference?: "performance" | "efficiency" | "balanced";
  gpuPreference?: "integrated" | "mid-range" | "high-end";
}

/** Structured budget expressed by the user. */
export interface BudgetExpression {
  amount: number;
  currency?: string; // "DZD", "USD", "EUR", "MAD", "SAR" — may be undefined
  currencyCertain: boolean;
  originalText: string;
}

/** The result of query understanding. */
export interface IntelligentQuery {
  originalQuery: string;
  normalizedQuery: string;
  intent: QueryIntent;
  language: QueryLanguage;
  useCases: UseCase[];
  hardRequirements: HardRequirements;
  preferences: Preferences;
  budget?: BudgetExpression;
  keywords: string[];
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

/** Unicode block for Arabic characters: U+0600–U+06FF */
const ARABIC_REGEX = /[\u0600-\u06FF]/;
/** Latin letters: a-z, A-Z */
const LATIN_REGEX = /[a-zA-Z]/;

export function detectLanguage(query: string): QueryLanguage {
  if (!query) return "en";
  const arabicCount = (query.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (query.match(/[a-zA-Z]/g) || []).length;
  if (arabicCount > 0 && latinCount > 0) return "mixed";
  if (arabicCount > 0) return "ar";
  return "en";
}

// ---------------------------------------------------------------------------
// Normalization (does NOT modify the originalQuery)
// ---------------------------------------------------------------------------

const ALIAS_MAP: Record<string, string> = {
  // Arabic → English hardware aliases
  حاسوب: "computer",
  لابتوب: "laptop",
  كمبيوتر: "computer",
  رام: "ram",
  ذاكرة: "ram",
  تخزين: "storage",
  هارد: "storage",
  قرص: "storage",
  معالج: "cpu",
  كارت: "gpu",
  شاشة: "screen",
  بطارية: "battery",
  شاشة_لمس: "touchscreen",
  // English spelling variations
  ram: "ram",
  memory: "ram",
  hdd: "storage",
  ssd: "storage",
  nvme: "storage",
  cpu: "cpu",
  processor: "cpu",
  gpu: "gpu",
  graphics: "gpu",
  card: "gpu",
  display: "screen",
  monitor: "screen",
  battery: "battery",
};

export function normalizeText(query: string): string {
  let result = query.toLowerCase().trim();
  // Collapse whitespace
  result = result.replace(/\s+/g, " ");
  // Remove leading/trailing punctuation
  result = result.replace(/^[^\w\s\u0600-\u06FF]+|[^\w\s\u0600-\u06FF]+$/g, "");
  return result;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

/**
 * Comparison requires ACTUAL comparison evidence:
 *   - "قارن" (Arabic for "compare")
 *   - "vs" / "versus" between two items
 *   - "compare A with/to B"
 *   - "between A and B" in comparison context
 *
 * "best" / "أفضل" / "أحسن" alone is NOT comparison — it's a
 * recommendation request. The user is asking for the best laptop, not
 * comparing two specific products.
 */
const COMPARISON_PATTERNS_AR = /قارن|المقارنة/;
const COMPARISON_VS_PATTERN_AR = /بين.+\s*(و|vs\.?)\s+/;
const COMPARISON_PATTERNS_EN = /\bcompare\b|\bcomparison\b|\bversus\b/;
const COMPARISON_VS_PATTERN_EN = /\bvs\.?\b/;

const RECOMMENDATION_PATTERNS_AR = /نحب|حاب|أريد|أحتاج|ابحث عن|أفضل|أحسن|نوصي|اقترح|بون/;
const RECOMMENDATION_PATTERNS_EN = /recommend|suggest|need|want|looking for|best for|should i|advice|\bbest\b/;

export function detectIntent(query: string, language: QueryLanguage): QueryIntent {
  const lower = query.toLowerCase().trim();
  // Empty or very short query — unknown
  if (lower.length < 2) return "unknown";

  // ===== Comparison detection =====
  // Must have explicit comparison evidence: "قارن", "compare", "vs", "versus"
  // "best" / "أفضل" alone is NOT comparison
  const hasExplicitComparison =
    COMPARISON_PATTERNS_AR.test(query) ||
    COMPARISON_PATTERNS_EN.test(lower) ||
    COMPARISON_VS_PATTERN_AR.test(query) ||
    COMPARISON_VS_PATTERN_EN.test(lower);

  if (hasExplicitComparison) {
    return "comparison";
  }

  // ===== Recommendation detection =====
  // "نحب", "I need", "best laptop", "looking for" → user wants a recommendation
  if (RECOMMENDATION_PATTERNS_AR.test(query) || RECOMMENDATION_PATTERNS_EN.test(lower)) {
    return "recommendation";
  }

  // If the query is a very short single token (< 4 chars), it's ambiguous
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].length < 4) {
    return "unknown";
  }

  // Hardware-only queries (just specs) are "search"
  return "search";
}

// ---------------------------------------------------------------------------
// Use-case detection
// ---------------------------------------------------------------------------

const USE_CASE_PATTERNS: Record<UseCase, RegExp[]> = {
  gaming: [
    /gaming|game|games|ألعاب|جيمنج|لعاب/,
  ],
  programming: [
    /programming|coding|development|developer|برمجة|مطور|كودينج|code/,
  ],
  university: [
    /university|college|school|student|جامعة|دراسة|طالب|طلبة|بون/,
  ],
  editing: [
    /video editing|editing|montage|مونتاج|تصميم فيديو|فيديو/,
  ],
  design: [
    /design|graphic|cad|3d|تصميم|ديزاين|ديزاينر/,
  ],
  battery: [
    /long battery|good battery|battery life|بطارية|بطاريتو مليحة|بطارية قوية/,
  ],
  portability: [
    /portable|lightweight|خفيف|خفيفة|بورتابل/,
  ],
  work: [
    /office|work|business|عمل|أوفيس|مكتب|بزنس/,
  ],
};

export function detectUseCases(query: string, language: QueryLanguage): UseCase[] {
  const lower = query.toLowerCase();
  const useCases = new Set<UseCase>();
  for (const [useCase, patterns] of Object.entries(USE_CASE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower) || pattern.test(query)) {
        useCases.add(useCase as UseCase);
        break;
      }
    }
  }
  return [...useCases];
}

// ---------------------------------------------------------------------------
// Hardware extraction
// ---------------------------------------------------------------------------

/**
 * RAM patterns — require explicit RAM context word to prevent collision
 * with bare "16GB" or storage expressions.
 *
 * Accepted forms:
 *   "16GB RAM" / "16GB memory" / "16GB ذاكرة" / "16GB رام" / "16GB g"
 *   "16 GB RAM" / "RAM 16GB" / "16GB"
 *   Arabic: "16 جيجا رام" / "رام 16"
 *
 * NOT accepted (must be clarified to context):
 *   Bare "16GB" without RAM context → ambiguous, see extractAmbiguousSize()
 */
const RAM_PATTERNS: RegExp[] = [
  // "16GB RAM" / "16GB memory" / "16GB ذاكرة" / "16GB رام"
  /(\d{1,4})\s*(gb|g)\s*(ram|memory|ذاكرة|رام)\b/i,
  // "RAM 16GB" / "memory 16GB" / "رام 16GB"
  /\b(ram|memory|ذاكرة|رام)\s*(\d{1,4})\s*(gb|g)?\b/i,
  // "16GB ذاكرة" (Arabic with ذاكرة)
  /(\d{1,4})\s*(gb|g)\s*ذاكرة/,
  // Arabic: "16 جيجا رام" or "رام 16 جيجا"
  /(\d{1,4})\s*(gb|g|جيجا)\s*رام/,
  /رام\s*(\d{1,4})\b/,
  // "16GB" followed by Arabic "رام" with no space
  /(\d{1,4})\s*رام/,
];

/**
 * Storage patterns — require explicit storage context word.
 *
 * Accepted forms:
 *   "1TB SSD" / "512GB storage" / "1TB تخزين" / "1TB هارد"
 *   "storage 1TB" / "SSD 512GB" / "disk 1TB"
 *   Arabic: "1 تيرابايت"
 *
 * NOT accepted:
 *   Bare "1TB" without storage context → ambiguous
 */
const STORAGE_PATTERNS: RegExp[] = [
  // "1TB SSD" / "512GB storage" / "1TB NVMe" / "1TB هارد"
  /(\d{1,4})\s*(tb|gb|g|تيرابايت)\s*(ssd|hdd|nvme|storage|disk|تخزين|هارد|قرص)\b/i,
  // "storage 1TB" / "SSD 512GB" / "هارد 1TB"
  /\b(ssd|hdd|nvme|storage|disk|تخزين|هارد|قرص)\s*(\d{1,4})\s*(tb|gb|g|تيرابايت)?/i,
  // Arabic: "1 تيرابايت"
  /(\d{1,4})\s*تيرابايت/,
];

/**
 * Detect "16GB" without explicit RAM/storage context.
 * Returns { value, type: 'ram' | 'storage' | 'unknown' }.
 *
 * Heuristic:
 *   - Value <= 64 GB → likely RAM (memory sizes are typically 4-64GB)
 *   - Value > 64 GB → likely storage (storage sizes are typically 128GB+)
 *   - Returns 'unknown' for ambiguous cases (e.g., 32 — could be 32GB RAM or storage)
 *
 * NOTE: This is a FALLBACK for bare numbers. When context is present,
 * RAM_PATTERNS or STORAGE_PATTERNS take priority.
 */
function extractAmbiguousSize(lower: string): { value: number; type: "ram" | "storage" | "unknown" } | undefined {
  // Look for bare "<number> GB" without context
  const match = lower.match(/\b(\d{1,4})\s*(gb|g|tb)\b/i);
  if (!match) return undefined;
  let value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === "tb") value = value * 1024;
  // Only flag as ambiguous if value is in the "could be either" range
  if (value > 64 && value <= 256) {
    // 128GB or 256GB — ambiguous, could be RAM on Mac or storage
    return { value, type: "unknown" };
  }
  if (value > 0 && value <= 64) {
    return { value, type: "ram" };
  }
  if (value > 256) {
    return { value, type: "storage" };
  }
  return undefined;
}

const SCREEN_SIZE_PATTERN = /(\d{1,2}(\.\d)?)\s*(inch|بوصة|"|pouce)/i;
const REFRESH_RATE_PATTERN = /(\d{2,3})\s*hz/i;

/**
 * Detect constraint operator from natural language.
 *
 * Returns:
 *   - "min"   for "at least", "or more", "على الأقل", "فما فوق"
 *   - "max"   for "up to", "at most", "maximum", "حتى", "أقل من"
 *   - "exact" for "exactly", "بالضبط"
 *   - "min"   (default) for bare numbers like "16GB" or "16GB RAM"
 *
 * NOTE: "at most" is tricky because "أقل من" in Arabic means "less than"
 * which is the SAME as "at most". So "16GB أقل من" → max.
 */
function detectConstraintOperator(
  query: string,
  value: number,
  unit: string
): NumericConstraint {
  const lower = query.toLowerCase();

  // "at least X GB" / "X GB or more" / "على الأقل X" / "X فما فوق"
  const minPatterns = [
    new RegExp(`at\\s+least\\s+${value}\\s*${unit}`, "i"),
    new RegExp(`${value}\\s*${unit}\\s+or\\s+more`, "i"),
    new RegExp(`على\\s+الأقل\\s+${value}`),
    new RegExp(`${value}\\s*فما\\s+فوق`),
    new RegExp(`${value}\\s*gb\\s*(\\+|plus|أكثر|فأكثر)`),
  ];
  for (const p of minPatterns) {
    if (p.test(query) || p.test(lower)) {
      return { operator: "min", value, unit };
    }
  }

  // "up to X GB" / "at most X" / "maximum X" / "حتى X" / "X أقل من"
  const maxPatterns = [
    new RegExp(`up\\s+to\\s+${value}\\s*${unit}`, "i"),
    new RegExp(`at\\s+most\\s+${value}\\s*${unit}`, "i"),
    new RegExp(`maximum\\s+${value}\\s*${unit}`, "i"),
    new RegExp(`حتى\\s+${value}`),
    new RegExp(`${value}\\s*أقل\\s+من`),
  ];
  for (const p of maxPatterns) {
    if (p.test(query) || p.test(lower)) {
      return { operator: "max", value, unit };
    }
  }

  // "exactly X GB" / "بالضبط X"
  const exactPatterns = [
    new RegExp(`exactly\\s+${value}\\s*${unit}`, "i"),
    new RegExp(`بالضبط\\s+${value}`),
  ];
  for (const p of exactPatterns) {
    if (p.test(query) || p.test(lower)) {
      return { operator: "exact", value, unit };
    }
  }

  // Default: bare "16GB" or "16GB RAM" → minimum
  return { operator: "min", value, unit };
}

const CPU_PATTERNS = [
  /i[3579][\s-]?\d{4,5}[a-z]{0,3}/i,
  /\bi[3579]\b/i,
  /ryzen[\s-]?[3579][\s-]?\d{4}[a-z]{0,3}/i,
  /ryzen[\s-]?[3579]\b/i,
  /\bryzen\b/i,
  /\bm[1234](?:[\s-]?(?:pro|max|ultra))?\b/i,
  /snapdragon[\s-]?\d+/i,
  /\bintel\b/i,
];

const GPU_PATTERNS = [
  /rtx[\s-]?\d{3,5}/i,
  /gtx[\s-]?\d{3,5}/i,
  /radeon[\s-]?rx[\s-]?\d{3,5}/i,
  /iris[\s-]?xe/i,
  /arc[\s-]?\d+/i,
];

export function extractHardware(query: string): {
  hardRequirements: HardRequirements;
  keywords: string[];
} {
  const hard: HardRequirements = {};
  const keywords: string[] = [];
  const lower = query.toLowerCase();

  // RAM extraction — ONLY with explicit RAM context
  let ramFound = false;
  for (const pattern of RAM_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      // Find the numeric group (could be m[1] or m[2] depending on pattern)
      const numStr = m[1] || m[2];
      const value = parseInt(numStr, 10);
      if (value > 0 && value <= 1024) {
        hard.minRam = value;
        keywords.push(`${value}gb ram`);
        // Detect constraint operator
        hard.ramConstraint = detectConstraintOperator(query, value, "GB");
        ramFound = true;
        break;
      }
    }
  }

  // Storage extraction — ONLY with explicit storage context
  let storageFound = false;
  for (const pattern of STORAGE_PATTERNS) {
    const m = lower.match(pattern);
    if (m) {
      // Find the numeric value and the unit
      // Patterns have either: (num, unit, type) or (type, num, unit) or (num, type)
      let value = 0;
      let unit = "";
      // Try to find the numeric group and the unit group
      for (let i = 1; i < m.length; i++) {
        if (m[i] && /^\d/.test(m[i].replace(/[,\s]/g, ""))) {
          value = parseInt(m[i].replace(/[,\s]/g, ""), 10);
          // The unit is typically the group right after the number
          // or at the end of the match
          for (let j = 1; j < m.length; j++) {
            if (m[j] && /^(tb|gb|g|تيرابايت)$/i.test(m[j])) {
              unit = m[j];
              break;
            }
          }
          if (!unit) {
            // Check the last group as fallback
            const last = m[m.length - 1];
            if (last && /^(tb|gb|g|تيرابايت)$/i.test(last)) {
              unit = last;
            }
          }
          break;
        }
      }
      if (!unit) {
        // Check if the number group is followed by a TB context
        // e.g., "1TB storage" — m[1]="1", m[2]="tb", m[3]="storage"
        if (m[2] && /^(tb|gb|g|تيرابايت)$/i.test(m[2])) {
          unit = m[2];
        }
      }
      if (unit.toLowerCase().startsWith("t")) value = value * 1024;
      if (value > 0 && value <= 1024 * 1024) {
        hard.minStorage = value;
        keywords.push(`${value >= 1024 ? value / 1024 + "tb" : value + "gb"} storage`);
        // Detect constraint operator
        hard.storageConstraint = detectConstraintOperator(query, value, "GB");
        storageFound = true;
        break;
      }
    }
  }

  // Ambiguous size fallback — only when neither RAM nor storage was found
  if (!ramFound && !storageFound) {
    const ambiguous = extractAmbiguousSize(lower);
    if (ambiguous) {
      if (ambiguous.type === "ram") {
        hard.minRam = ambiguous.value;
        keywords.push(`${ambiguous.value}gb ram (ambiguous)`);
      } else if (ambiguous.type === "storage") {
        hard.minStorage = ambiguous.value;
        keywords.push(`${ambiguous.value}gb storage (ambiguous)`);
      }
      // type === "unknown" → do not assign to either field
    }
  }

  // Screen size
  const screenMatch = lower.match(SCREEN_SIZE_PATTERN);
  if (screenMatch) {
    const value = parseFloat(screenMatch[1]);
    if (value >= 10 && value <= 20) {
      hard.minScreenSize = value;
      keywords.push(`${value}" screen`);
    }
  }

  // Refresh rate
  const refreshMatch = lower.match(REFRESH_RATE_PATTERN);
  if (refreshMatch) {
    const value = parseInt(refreshMatch[1], 10);
    if (value >= 60 && value <= 300) {
      hard.minRefreshRate = value;
      keywords.push(`${value}hz`);
    }
  }

  // CPU terms
  const cpuTerms: string[] = [];
  for (const pattern of CPU_PATTERNS) {
    const m = query.match(pattern);
    if (m) {
      cpuTerms.push(m[0].toLowerCase().replace(/[\s-]/g, ""));
      keywords.push(m[0].toLowerCase());
    }
  }
  if (cpuTerms.length > 0) {
    hard.cpuTerms = cpuTerms;
  }

  // GPU terms
  const gpuTerms: string[] = [];
  for (const pattern of GPU_PATTERNS) {
    const m = query.match(pattern);
    if (m) {
      gpuTerms.push(m[0].toLowerCase().replace(/[\s-]/g, ""));
      keywords.push(m[0].toLowerCase());
    }
  }
  if (gpuTerms.length > 0) {
    hard.gpuTerms = gpuTerms;
  }

  // Touchscreen
  if (lower.includes("touchscreen") || lower.includes("touch screen") || query.includes("لمس")) {
    hard.touchscreen = true;
  }

  return { hardRequirements: hard, keywords };
}

// ---------------------------------------------------------------------------
// Budget extraction
// ---------------------------------------------------------------------------

/**
 * Budget patterns support multiple natural word orders.
 *
 * Arabic/Darija forms:
 *   "ما يفوتش 150 ألف"        (verb before number)
 *   "لابتوب ما يفوتش 150 ألف"  (subject + verb + number)
 *   "150 ألف ما يفوتش"        (number before verb)
 *   "أقل من 150000"            (comparator + number)
 *   "حتى 150 ألف"             (comparator + number)
 *   "150000 دج"                (number + currency)
 *
 * English forms:
 *   "under 150000 DZD"
 *   "less than 1000 USD"
 *   "$1000"
 *   "1000 USD"
 *
 * Currency is ONLY recognized when explicitly stated. Ambiguous numbers
 * are marked as uncertain (currencyCertain: false).
 */
const BUDGET_PATTERNS: RegExp[] = [
  // ===== $ amount patterns FIRST (so $ is captured as currency) =====
  /under\s+\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/i,
  /less than\s+\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/i,
  /\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/,

  // ===== Arabic/Darija with currency (number + currency) =====
  /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(ألف|الف|دج|dzd|mad|sar|aed|eur|euro|دولار|ريال|درهم)/i,

  // ===== English with currency word =====
  /under\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /less than\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /up to\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /max\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /at most\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /budget\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,

  // ===== Darija: verb form (ما يفوتش / ما يتعداش) — flexible order =====
  // "ما يفوتش 150 ألف" — verb before number
  /(ما يفوتش|ما يتعداش|ما يفوت)\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/,
  // "150 ألف ما يفوتش" — number before verb
  /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(ما يفوتش|ما يتعداش|ما يفوت)/,

  // ===== Arabic: "أقل من" / "حتى" — flexible order =====
  // "أقل من 150000" — word before number
  /(أقل من|اقل من|حتى|بـ)\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/,
  // "150000 أقل من" — number before word (less common but valid)
  /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(أقل من|اقل من)/,
];

export function extractBudget(query: string): BudgetExpression | undefined {
  for (const pattern of BUDGET_PATTERNS) {
    const m = query.match(pattern);
    if (!m) continue;

    // Extract amount — it's the first numeric group
    let amount = 0;
    for (let i = 1; i < m.length; i++) {
      if (m[i] && /^\d/.test(m[i].replace(/[,\s]/g, ""))) {
        amount = parseInt(m[i].replace(/[,\s]/g, ""), 10);
        break;
      }
    }
    if (isNaN(amount) || amount <= 0) continue;

    // Handle Arabic "ألف" (thousand) multiplier
    const matchedText = m[0];
    if (/ألف|الف/.test(matchedText)) {
      amount = amount * 1000;
    }
    // Handle "k" or "K" suffix
    if (/^\d+\s*k$/i.test(matchedText.trim())) {
      amount = amount * 1000;
    }

    // Currency detection from matched text
    const matchedLower = matchedText.toLowerCase();
    let currency: string | undefined;
    let currencyCertain = false;

    if (matchedLower.includes("dzd") || matchedText.includes("دج")) {
      currency = "DZD";
      currencyCertain = true;
    } else if (matchedLower.includes("mad")) {
      currency = "MAD";
      currencyCertain = true;
    } else if (matchedLower.includes("sar") || matchedText.includes("ريال")) {
      currency = "SAR";
      currencyCertain = true;
    } else if (matchedLower.includes("aed") || matchedText.includes("درهم")) {
      currency = "AED";
      currencyCertain = true;
    } else if (matchedLower.includes("eur") || matchedLower.includes("euro") || matchedText.includes("يورو")) {
      currency = "EUR";
      currencyCertain = true;
    } else if (matchedLower.includes("usd") || matchedLower.includes("dollar") || matchedText.includes("دولار")) {
      currency = "USD";
      currencyCertain = true;
    } else if (matchedText.includes("$")) {
      currency = "USD";
      currencyCertain = true;
    }
    // If no currency indicator found, currencyCertain stays false (ambiguous)

    return {
      amount,
      currency,
      currencyCertain,
      originalText: matchedText,
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Preference extraction (soft signals)
// ---------------------------------------------------------------------------

/**
 * Preferences require CONTEXT to be set.
 *
 * - "خفيف" / "lightweight" / "portable" → lightweight (clear context)
 * - "بطارية قوية" / "good battery" / "long battery life" → goodBattery
 *   (battery + adjective)
 * - "أداء قوي" / "high performance" → highPerformance
 *   (performance + adjective)
 * - "معالج قوي" / "fast processor" → cpuPreference = performance
 *   (CPU + adjective)
 * - "كارت شاشة قوية" / "powerful GPU" → gpuPreference = high-end
 *   (GPU + adjective)
 *
 * Generic "قوي" / "مليح" / "سريع" WITHOUT a preceding noun
 * should NOT set any specific preference — the context is ambiguous.
 *
 * If the user says "لابتوب قوي" (laptop + قوي), the context is the laptop
 * itself, which is too generic to set a specific preference.
 */
export function extractPreferences(query: string, useCases: UseCase[]): Preferences {
  const prefs: Preferences = {};
  const lower = query.toLowerCase();

  // ===== Portability =====
  // Clear context: "خفيف" / "lightweight" / "portable" with NO preceding
  // specific noun (other than laptop) → portable preference
  // Note: \b doesn't work well with Arabic, so we use a more flexible check
  if (
    /(خفيف|خفيفة|lightweight|portable)/.test(lower) &&
    !/(معالج|cpu|processor).*(خفيف|lightweight)/.test(lower) // not "lightweight CPU"
  ) {
    prefs.lightweight = true;
    prefs.portable = true;
  }

  // ===== Battery — REQUIRES battery context =====
  // "بطارية قوية" / "بطارية مليحة" / "good battery" / "long battery life"
  const hasBatteryContext =
    /بطاريتو|بطارية|battery/.test(lower);
  const hasBatteryAdjective =
    /(بطاريتو|بطارية)\s*(قوية|مليحة|كبيرة|طويلة|جيدة|قوي|مليح|كبير|طويل|جيد)/.test(lower) ||
    /(good|long|excellent|great)\s+battery/.test(lower) ||
    /battery\s+(life|that|which)?\s*(is\s+)?(good|long|excellent|great)/.test(lower);
  if (hasBatteryContext && hasBatteryAdjective) {
    prefs.goodBattery = true;
  }

  // ===== Performance — REQUIRES performance/processor context =====
  // "أداء قوي" / "high performance" / "fast" with clear context
  const hasPerformanceContext =
    /(أداء|performance|قوي|مليح)\s/.test(lower) &&
    !/بطاريتو.*قوي|بطارية.*قوي|شاشة.*قوي/.test(lower); // not battery/screen
  if (
    /high\s+performance|أداء\s+قوي|أداء\s+مليح|performant|powerful\s+performance/.test(lower)
  ) {
    prefs.highPerformance = true;
  }

  // ===== CPU — requires CPU context =====
  // "معالج قوي" / "fast CPU" / "powerful processor"
  if (
    /(معالج|cpu|processor|chip)\s*(قوي|مليح|سريع|قوية|مليحة|سريعة)/.test(lower) ||
    /(powerful|fast|strong)\s+(cpu|processor|chip)/.test(lower)
  ) {
    prefs.cpuPreference = "performance";
  }

  // ===== GPU — requires GPU context =====
  // "كارت شاشة قوية" / "powerful graphics" / "strong GPU"
  if (
    /(كارت\s+شاشة|كارت\s+غرافيك|بطاقة\s+رسومية|gpu|graphics\s+card)\s*(قوي|مليح|قوية|مليحة|سريع|سريعة)/.test(lower) ||
    /(powerful|strong|fast)\s+(gpu|graphics|显卡)/.test(lower)
  ) {
    prefs.gpuPreference = "high-end";
  }

  // ===== Speed — generic "fast" / "سريع" with clear noun context =====
  // Avoid matching "fast" alone (too generic)
  if (
    /(laptop|computer|نظام|برنامج|software|app).*(fast|سريع)/.test(lower) ||
    /(fast|سريع)\s+(laptop|computer|نظام|برنامج)/.test(lower)
  ) {
    prefs.fast = true;
  }

  // ===== Budget / premium — requires explicit words =====
  if (
    /\b(budget|cheap|affordable|رخيص|اقتصادي)\b/.test(lower)
  ) {
    prefs.budget = true;
  }
  if (
    /\b(premium|high-end|فاخر|غالي|راقي)\b/.test(lower)
  ) {
    prefs.premium = true;
  }

  // ===== Use-case derived preferences =====
  if (useCases.includes("gaming")) {
    prefs.dedicatedGpu = true;
    prefs.highPerformance = true;
  }
  if (useCases.includes("programming")) {
    prefs.cpuPreference = "performance";
  }
  if (useCases.includes("editing") || useCases.includes("design")) {
    prefs.cpuPreference = "performance";
    prefs.gpuPreference = "mid-range";
  }
  if (useCases.includes("university") || useCases.includes("portability")) {
    prefs.portable = true;
    prefs.goodBattery = true;
  }
  if (useCases.includes("battery")) {
    prefs.goodBattery = true;
  }

  return prefs;
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

export function calculateConfidence(
  intent: QueryIntent,
  useCases: UseCase[],
  hardRequirements: HardRequirements,
  budget: BudgetExpression | undefined,
  query: string
): Confidence {
  let score = 0;

  // Explicit hardware increases confidence
  if (hardRequirements.minRam || hardRequirements.minStorage) score += 2;
  if (hardRequirements.cpuTerms?.length) score += 2;
  if (hardRequirements.gpuTerms?.length) score += 2;
  if (hardRequirements.touchscreen !== undefined) score += 1;

  // Use cases
  if (useCases.length > 0) score += 1;

  // Budget
  if (budget && budget.currencyCertain) score += 2;
  if (budget && !budget.currencyCertain) score += 1;

  // Intent
  if (intent === "comparison") score += 1;

  // Query length
  if (query.length < 3) score -= 2;

  if (score >= 4) return "high";
  if (score >= 1) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a user query into an IntelligentQuery.
 * NEVER throws — returns a fallback with low confidence on failure.
 */
export function understandQuery(query: string): IntelligentQuery {
  try {
    if (!query || typeof query !== "string") {
      return {
        originalQuery: String(query || ""),
        normalizedQuery: "",
        intent: "unknown",
        language: "en",
        useCases: [],
        hardRequirements: {},
        preferences: {},
        keywords: [],
        confidence: "low",
      };
    }

    const language = detectLanguage(query);
    const intent = detectIntent(query, language);
    const useCases = detectUseCases(query, language);
    const { hardRequirements, keywords } = extractHardware(query);
    const budget = extractBudget(query);
    const preferences = extractPreferences(query, useCases);
    const confidence = calculateConfidence(intent, useCases, hardRequirements, budget, query);
    const normalizedQuery = normalizeText(query);

    return {
      originalQuery: query,
      normalizedQuery,
      intent,
      language,
      useCases,
      hardRequirements,
      preferences,
      budget,
      keywords,
      confidence,
    };
  } catch {
    // Fallback: never fail. Return a low-confidence empty parse.
    return {
      originalQuery: query || "",
      normalizedQuery: "",
      intent: "unknown",
      language: "en",
      useCases: [],
      hardRequirements: {},
      preferences: {},
      keywords: [],
      confidence: "low",
    };
  }
}
