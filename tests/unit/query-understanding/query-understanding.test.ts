import { describe, it, expect } from "vitest";
import {
  understandQuery,
  detectLanguage,
  detectIntent,
  detectUseCases,
  extractHardware,
  extractBudget,
  extractPreferences,
  calculateConfidence,
  normalizeText,
} from "@/lib/server/query-understanding";

/**
 * Phase 3.1 — Query Understanding Tests
 *
 * Covers: language detection, intent, hardware, use cases,
 * hard/soft requirements, budget, confidence, mixed language,
 * aliases, malformed queries, fallback.
 */

// =========================================================================
// Language detection
// =========================================================================

describe("Language detection", () => {
  it("detects pure Arabic", () => {
    expect(detectLanguage("حاسوب للدراسة")).toBe("ar");
  });

  it("detects pure English", () => {
    expect(detectLanguage("laptop for gaming")).toBe("en");
  });

  it("detects mixed Arabic/English", () => {
    expect(detectLanguage("نحب laptop خفيف")).toBe("mixed");
    expect(detectLanguage("حاسوب programming")).toBe("mixed");
    expect(detectLanguage("RTX 4060 حاسوب")).toBe("mixed");
  });

  it("handles empty input", () => {
    expect(detectLanguage("")).toBe("en");
  });
});

// =========================================================================
// Intent detection
// =========================================================================

describe("Intent detection", () => {
  it("detects search intent for hardware queries", () => {
    const q = "RTX 4060 16GB";
    expect(detectIntent(q, "en")).toBe("search");
  });

  it("detects recommendation intent in Arabic", () => {
    expect(detectIntent("نحب لابتوب للدراسة", "ar")).toBe("recommendation");
    expect(detectIntent("حاب laptop للبرمجة", "ar")).toBe("recommendation");
  });

  it("detects recommendation intent in English", () => {
    expect(detectIntent("I need a laptop for programming", "en")).toBe("recommendation");
    expect(detectIntent("looking for a gaming laptop", "en")).toBe("recommendation");
  });

  it("detects comparison intent", () => {
    expect(detectIntent("قارن بين Lenovo LOQ و HP Victus", "ar")).toBe("comparison");
    expect(detectIntent("compare Dell XPS vs MacBook", "en")).toBe("comparison");
  });

  it("falls back to search for pure hardware queries", () => {
    expect(detectIntent("i7 16GB RTX 4050", "en")).toBe("search");
  });
});

// =========================================================================
// Use-case detection
// =========================================================================

describe("Use-case detection", () => {
  it("detects study/university use case", () => {
    const cases = detectUseCases("لابتوب للدراسة", "ar");
    expect(cases).toContain("university");
  });

  it("detects programming use case", () => {
    const cases = detectUseCases("laptop for programming", "en");
    expect(cases).toContain("programming");
  });

  it("detects gaming use case", () => {
    const cases = detectUseCases("gaming laptop", "en");
    expect(cases).toContain("gaming");
  });

  it("detects multiple use cases", () => {
    const cases = detectUseCases("gaming laptop for design and programming", "en");
    expect(cases.length).toBeGreaterThan(1);
    expect(cases).toContain("gaming");
  });

  it("detects editing use case", () => {
    const cases = detectUseCases("لابتوب للمونتاج", "ar");
    expect(cases).toContain("editing");
  });

  it("returns empty for hardware-only query", () => {
    const cases = detectUseCases("i7 16GB RTX 4060", "en");
    expect(cases).toHaveLength(0);
  });
});

// =========================================================================
// Hardware extraction
// =========================================================================

describe("Hardware extraction", () => {
  it("extracts RAM requirement", () => {
    const { hardRequirements } = extractHardware("laptop with 16GB RAM");
    expect(hardRequirements.minRam).toBe(16);
  });

  it("extracts RAM in Arabic", () => {
    const { hardRequirements } = extractHardware("لابتوب 16 رام");
    expect(hardRequirements.minRam).toBe(16);
  });

  it("extracts storage", () => {
    const { hardRequirements } = extractHardware("laptop with 1TB storage");
    expect(hardRequirements.minStorage).toBe(1024);
  });

  it("extracts storage in Arabic", () => {
    const { hardRequirements } = extractHardware("لابتوب 512 GB تخزين");
    expect(hardRequirements.minStorage).toBe(512);
  });

  it("extracts CPU terms", () => {
    const { hardRequirements } = extractHardware("laptop with i7-13700H");
    expect(hardRequirements.cpuTerms).toBeDefined();
    expect(hardRequirements.cpuTerms!.length).toBeGreaterThan(0);
    expect(hardRequirements.cpuTerms![0]).toContain("i7");
  });

  it("extracts AMD Ryzen CPU", () => {
    const { hardRequirements } = extractHardware("laptop with Ryzen 7 7840H");
    expect(hardRequirements.cpuTerms).toBeDefined();
    expect(hardRequirements.cpuTerms![0]).toContain("ryzen7");
  });

  it("extracts Apple Silicon", () => {
    const { hardRequirements } = extractHardware("MacBook with M3 Pro");
    expect(hardRequirements.cpuTerms).toBeDefined();
  });

  it("extracts NVIDIA GPU", () => {
    const { hardRequirements } = extractHardware("laptop with RTX 4060");
    expect(hardRequirements.gpuTerms).toBeDefined();
    expect(hardRequirements.gpuTerms![0]).toContain("rtx");
    expect(hardRequirements.gpuTerms![0]).toContain("4060");
  });

  it("extracts AMD Radeon GPU", () => {
    const { hardRequirements } = extractHardware("laptop with Radeon RX 7600M");
    expect(hardRequirements.gpuTerms).toBeDefined();
    expect(hardRequirements.gpuTerms![0]).toContain("radeon");
  });

  it("extracts screen size", () => {
    const { hardRequirements } = extractHardware('15.6" laptop');
    expect(hardRequirements.minScreenSize).toBe(15.6);
  });

  it("extracts refresh rate", () => {
    const { hardRequirements } = extractHardware("144Hz display");
    expect(hardRequirements.minRefreshRate).toBe(144);
  });

  it("extracts touchscreen requirement", () => {
    const { hardRequirements } = extractHardware("touchscreen laptop");
    expect(hardRequirements.touchscreen).toBe(true);
  });

  it("extracts multiple hardware specs together", () => {
    const { hardRequirements } = extractHardware("i7 16GB RTX 4050");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.cpuTerms).toBeDefined();
    expect(hardRequirements.gpuTerms).toBeDefined();
  });
});

// =========================================================================
// Budget extraction
// =========================================================================

describe("Budget extraction", () => {
  it("extracts budget in DZD", () => {
    const budget = extractBudget("laptop under 150000 DZD");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
    expect(budget!.currency).toBe("DZD");
    expect(budget!.currencyCertain).toBe(true);
  });

  it("extracts budget in Arabic with 'ألف'", () => {
    const budget = extractBudget("لابتوب ما يفوتش 150 ألف");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("extracts budget in USD", () => {
    const budget = extractBudget("laptop under $1000");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(1000);
    expect(budget!.currency).toBe("USD");
  });

  it("extracts budget with 'less than'", () => {
    const budget = extractBudget("less than 150000 DZD");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("marks currency as uncertain when no currency is given", () => {
    const budget = extractBudget("laptop under 150000");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
    expect(budget!.currencyCertain).toBe(false);
  });

  it("returns undefined when no budget is mentioned", () => {
    const budget = extractBudget("laptop for gaming");
    expect(budget).toBeUndefined();
  });
});

// =========================================================================
// Preference extraction
// =========================================================================

describe("Preference extraction", () => {
  it("detects lightweight preference", () => {
    const prefs = extractPreferences("laptop خفيف", []);
    expect(prefs.lightweight).toBe(true);
  });

  it("detects good battery preference", () => {
    const prefs = extractPreferences("laptop with good battery", []);
    expect(prefs.goodBattery).toBe(true);
  });

  it("derives preferences from use cases", () => {
    const prefs = extractPreferences("gaming laptop", ["gaming"]);
    expect(prefs.dedicatedGpu).toBe(true);
  });

  it("derives battery preference from university use case", () => {
    const prefs = extractPreferences("university laptop", ["university"]);
    expect(prefs.goodBattery).toBe(true);
    expect(prefs.portable).toBe(true);
  });

  it("does not set preferences for hardware-only queries", () => {
    const prefs = extractPreferences("i7 16GB RTX 4060", []);
    expect(prefs.lightweight).toBeUndefined();
    expect(prefs.goodBattery).toBeUndefined();
  });
});

// =========================================================================
// Confidence scoring
// =========================================================================

describe("Confidence scoring", () => {
  it("high confidence for explicit hardware + budget + use case", () => {
    const c = calculateConfidence(
      "search",
      ["gaming"],
      { minRam: 16, cpuTerms: ["i7"], gpuTerms: ["rtx4060"] },
      { amount: 150000, currency: "DZD", currencyCertain: true, originalText: "150000 DZD" },
      "gaming laptop i7 16GB RTX 4060 under 150000 DZD"
    );
    expect(c).toBe("high");
  });

  it("medium confidence for use case only", () => {
    const c = calculateConfidence("search", ["gaming"], {}, undefined, "gaming laptop");
    expect(c).toBe("medium");
  });

  it("low confidence for empty/ambiguous", () => {
    const c = calculateConfidence("search", [], {}, undefined, "a");
    expect(c).toBe("low");
  });
});

// =========================================================================
// Main entry point — understandQuery
// =========================================================================

describe("understandQuery — main entry point", () => {
  it("parses Arabic query for study", () => {
    const q = "حاسوب للدراسة";
    const parsed = understandQuery(q);
    expect(parsed.originalQuery).toBe(q);
    expect(parsed.language).toBe("ar");
    expect(parsed.useCases).toContain("university");
  });

  it("parses Arabic query for programming with RAM", () => {
    const q = "نحب لابتوب للبرمجة 16 رام";
    const parsed = understandQuery(q);
    expect(parsed.originalQuery).toBe(q);
    expect(parsed.intent).toBe("recommendation");
    expect(parsed.useCases).toContain("programming");
    expect(parsed.hardRequirements.minRam).toBe(16);
  });

  it("parses Arabic query for lightweight + battery", () => {
    const q = "لابتوب خفيف وبطاريتو مليحة";
    const parsed = understandQuery(q);
    expect(parsed.preferences.lightweight).toBe(true);
    expect(parsed.preferences.goodBattery).toBe(true);
  });

  it("parses English gaming query", () => {
    const q = "gaming laptop RTX 4060";
    const parsed = understandQuery(q);
    expect(parsed.intent).toBe("search");
    expect(parsed.useCases).toContain("gaming");
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
  });

  it("parses English lightweight programming query", () => {
    const q = "lightweight laptop for programming";
    const parsed = understandQuery(q);
    expect(parsed.useCases).toContain("programming");
    expect(parsed.preferences.lightweight).toBe(true);
  });

  it("parses English student query with battery", () => {
    const q = "student laptop with good battery";
    const parsed = understandQuery(q);
    expect(parsed.useCases).toContain("university");
    expect(parsed.preferences.goodBattery).toBe(true);
  });

  it("parses mixed Arabic/English query", () => {
    const q = "نحب laptop خفيف للجامعة";
    const parsed = understandQuery(q);
    expect(parsed.language).toBe("mixed");
    expect(parsed.intent).toBe("recommendation");
    expect(parsed.preferences.lightweight).toBe(true);
  });

  it("parses mixed query with hardware", () => {
    const q = "حاسوب programming 16GB Ryzen";
    const parsed = understandQuery(q);
    expect(parsed.language).toBe("mixed");
    expect(parsed.useCases).toContain("programming");
    expect(parsed.hardRequirements.minRam).toBe(16);
    expect(parsed.hardRequirements.cpuTerms).toBeDefined();
  });

  it("parses mixed query with GPU", () => {
    const q = "لابتوب gaming RTX 4060";
    const parsed = understandQuery(q);
    expect(parsed.language).toBe("mixed");
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
  });

  it("parses complex hardware query", () => {
    const q = "i7 16GB RTX 4050";
    const parsed = understandQuery(q);
    expect(parsed.hardRequirements.minRam).toBe(16);
    expect(parsed.hardRequirements.cpuTerms).toBeDefined();
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
  });

  it("parses budget in DZD", () => {
    const q = "laptop under 150000 DZD";
    const parsed = understandQuery(q);
    expect(parsed.budget).toBeDefined();
    expect(parsed.budget!.amount).toBe(150000);
    expect(parsed.budget!.currency).toBe("DZD");
  });

  it("parses Arabic budget with ألف", () => {
    const q = "لابتوب ما يفوتش 150 ألف";
    const parsed = understandQuery(q);
    expect(parsed.budget).toBeDefined();
    expect(parsed.budget!.amount).toBe(150000);
  });

  it("parses comparison query", () => {
    const q = "قارن بين Lenovo LOQ و HP Victus";
    const parsed = understandQuery(q);
    expect(parsed.intent).toBe("comparison");
  });

  it("never throws on malformed input", () => {
    expect(() => understandQuery("")).not.toThrow();
    expect(() => understandQuery("   ")).not.toThrow();
    expect(() => understandQuery("🎮💻")).not.toThrow();
    expect(() => understandQuery(null as unknown as string)).not.toThrow();
    expect(() => understandQuery(undefined as unknown as string)).not.toThrow();
  });

  it("preserves originalQuery exactly", () => {
    const q = "نحب Laptop للدراسة 16GB";
    const parsed = understandQuery(q);
    expect(parsed.originalQuery).toBe(q);
  });

  it("returns unknown intent for ambiguous queries", () => {
    const parsed = understandQuery("xyz");
    expect(parsed.intent).toBe("unknown");
  });
});

// =========================================================================
// Normalization
// =========================================================================

describe("Text normalization", () => {
  it("normalizes whitespace", () => {
    expect(normalizeText("hello    world")).toBe("hello world");
  });

  it("lowercases text", () => {
    expect(normalizeText("HELLO World")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeText("  hello world  ")).toBe("hello world");
  });
});
