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

const COMPARISON_PATTERNS_AR = /قارن|المقارنة|بين|أفضل|أحسن/;
const COMPARISON_PATTERNS_EN = /compare|comparison|vs\.?|versus|better than|best/;
const RECOMMENDATION_PATTERNS_AR = /نحب|حاب|أريد|أحتاج|ابحث عن|أفضل|نوصي|اقترح|بون/;
const RECOMMENDATION_PATTERNS_EN = /recommend|suggest|need|want|looking for|best for|should i|advice/;

export function detectIntent(query: string, language: QueryLanguage): QueryIntent {
  const lower = query.toLowerCase().trim();
  // Empty or very short query — unknown
  if (lower.length < 2) return "unknown";
  // Comparison: explicit "compare" or "vs" or Arabic "قارن"
  if (COMPARISON_PATTERNS_AR.test(query) || COMPARISON_PATTERNS_EN.test(lower)) {
    // "vs" alone might be part of a brand name; only count as comparison if there are two model names
    if (/ vs\.? /i.test(lower) || COMPARISON_PATTERNS_AR.test(query)) {
      return "comparison";
    }
  }
  // Recommendation: phrases like "I need" or "نحب"
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

const RAM_PATTERN = /(\d{1,4})\s*(gb|g|رام|ذاكرة)/i;
const STORAGE_PATTERN = /(\d{1,4})\s*(tb|تيرابايت|to)/i;
const SCREEN_SIZE_PATTERN = /(\d{1,2}(\.\d)?)\s*(inch|بوصة|"|pouce)/i;
const REFRESH_RATE_PATTERN = /(\d{2,3})\s*hz/i;

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

  // RAM
  const ramMatch = lower.match(RAM_PATTERN);
  if (ramMatch) {
    const value = parseInt(ramMatch[1], 10);
    if (value > 0 && value <= 1024) {
      hard.minRam = value;
      keywords.push(`${value}gb ram`);
    }
  }

  // Storage (TB → GB)
  const storageMatch = lower.match(STORAGE_PATTERN) || lower.match(/(\d{2,4})\s*(gb|g)\b/i);
  if (storageMatch) {
    let value = parseInt(storageMatch[1], 10);
    if (storageMatch[2]?.toLowerCase().startsWith("t")) {
      value = value * 1024;
    }
    if (value > 0 && value <= 1024 * 1024) {
      hard.minStorage = value;
      keywords.push(`${value >= 1024 ? value / 1024 + "tb" : value + "gb"} storage`);
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

const BUDGET_PATTERNS = [
  // $ amount patterns FIRST (so $ is captured as currency)
  /under\s+\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/i,
  /less than\s+\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/i,
  /\$\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)/,
  // Arabic patterns (with currency)
  /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(ألف|الف|دج|dzd|mad|sar|aed|eur|euro|دولار|دج\.?م|ريال|درهم)/i,
  // English patterns (without $)
  /under\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /less than\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /up to\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /max\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  /budget\s+(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*([a-z]{2,4})?/i,
  // Darija: "ما يفوتش" (doesn't exceed)
  /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(ما يفوتش|حتى|أقل من|اقل من)/,
];

export function extractBudget(query: string): BudgetExpression | undefined {
  for (const pattern of BUDGET_PATTERNS) {
    const m = query.match(pattern);
    if (m) {
      const rawAmount = m[1].replace(/[,\s]/g, "");
      let amount = parseInt(rawAmount, 10);
      if (isNaN(amount) || amount <= 0) continue;

      // Handle Arabic "ألف" (thousand)
      if (/ألف|الف/i.test(m[2] || "")) {
        amount = amount * 1000;
      }
      // Handle "k" or "K" suffix
      if (/^k$/i.test(m[2] || "")) {
        amount = amount * 1000;
      }

      // Currency detection
      const matchedText = m[0].toLowerCase();
      const currencyText = (m[2] || "").toLowerCase();
      let currency: string | undefined;
      let currencyCertain = false;

      if (currencyText.includes("dzd") || currencyText.includes("دج")) {
        currency = "DZD";
        currencyCertain = true;
      } else if (currencyText.includes("mad")) {
        currency = "MAD";
        currencyCertain = true;
      } else if (currencyText.includes("sar") || currencyText.includes("ريال")) {
        currency = "SAR";
        currencyCertain = true;
      } else if (currencyText.includes("aed") || currencyText.includes("درهم")) {
        currency = "AED";
        currencyCertain = true;
      } else if (currencyText.includes("eur") || currencyText.includes("euro") || currencyText.includes("يورو")) {
        currency = "EUR";
        currencyCertain = true;
      } else if (currencyText.includes("usd") || currencyText.includes("dollar") || currencyText.includes("دولار")) {
        currency = "USD";
        currencyCertain = true;
      } else if (matchedText.includes("$")) {
        // $ sign in the matched text → USD
        currency = "USD";
        currencyCertain = true;
      } else if (/^\d+$/.test(currencyText)) {
        // No currency mentioned — uncertain
        currencyCertain = false;
      }

      return {
        amount,
        currency,
        currencyCertain,
        originalText: m[0],
      };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Preference extraction (soft signals)
// ---------------------------------------------------------------------------

export function extractPreferences(query: string, useCases: UseCase[]): Preferences {
  const prefs: Preferences = {};
  const lower = query.toLowerCase();

  // Direct preference keywords
  if (lower.includes("خفيف") || lower.includes("lightweight") || lower.includes("portable")) {
    prefs.lightweight = true;
    prefs.portable = true;
  }
  if (lower.includes("بطارية") || lower.includes("battery") || lower.includes("مليح") || lower.includes("قوي")) {
    prefs.goodBattery = true;
  }
  if (lower.includes("fast") || lower.includes("سريع")) {
    prefs.fast = true;
  }
  if (lower.includes("high performance") || lower.includes("قوي") || lower.includes("performant")) {
    prefs.highPerformance = true;
  }
  if (lower.includes("budget") || lower.includes("رخيص") || lower.includes("اقتصادي") || lower.includes("cheap")) {
    prefs.budget = true;
  }
  if (lower.includes("premium") || lower.includes("فاخر") || lower.includes("غالي")) {
    prefs.premium = true;
  }

  // Use-case derived preferences
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
