import { describe, it, expect } from "vitest";
import {
  understandQuery,
  extractHardware,
  extractBudget,
  extractPreferences,
  detectIntent,
  IntelligentQuery,
} from "@/lib/server/query-understanding";

/**
 * Phase 3.1.1 — Hardening Tests
 *
 * These tests verify the corrections to Phase 3.1 bugs:
 *
 * A. RAM/Storage isolation — no cross-contamination
 * B. Budget word ordering — Arabic/Darija natural order
 * C. "best/أفضل" intent — not comparison
 * D. Generic word false positives — "قوي"/"مليح" don't auto-trigger battery
 * E. Constraint operators — min/max/exact/range
 * F. Preference context — adjectives need clear nouns
 * G. Currency safety — uncertain when not explicit
 * H. Anti-hallucination preserved
 */

// =========================================================================
// A. RAM/Storage isolation
// =========================================================================

describe("A. RAM/Storage isolation — no cross-contamination", () => {
  it("'16GB RAM' sets RAM only, not storage", () => {
    const { hardRequirements } = extractHardware("laptop with 16GB RAM");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.minStorage).toBeUndefined();
  });

  it("'1TB SSD' sets storage only, not RAM", () => {
    const { hardRequirements } = extractHardware("laptop with 1TB SSD");
    expect(hardRequirements.minStorage).toBe(1024);
    expect(hardRequirements.minRam).toBeUndefined();
  });

  it("'16GB RAM 1TB SSD' sets both independently", () => {
    const { hardRequirements } = extractHardware("laptop with 16GB RAM 1TB SSD");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.minStorage).toBe(1024);
  });

  it("'16GB' alone does NOT set both RAM and storage", () => {
    const { hardRequirements } = extractHardware("laptop 16GB");
    // Either RAM (if value <= 64) or storage (if value > 256) or unknown
    // 16 is in RAM range, so it should be RAM
    if (hardRequirements.minRam !== undefined) {
      expect(hardRequirements.minRam).toBe(16);
      expect(hardRequirements.minStorage).toBeUndefined();
    } else {
      expect(hardRequirements.minStorage).toBeUndefined();
    }
  });

  it("'16GB memory' sets RAM only", () => {
    const { hardRequirements } = extractHardware("laptop with 16GB memory");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.minStorage).toBeUndefined();
  });

  it("'16GB ذاكرة' (Arabic memory) sets RAM only", () => {
    const { hardRequirements } = extractHardware("لابتوب 16GB ذاكرة");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.minStorage).toBeUndefined();
  });

  it("'512GB storage' sets storage only", () => {
    const { hardRequirements } = extractHardware("laptop with 512GB storage");
    expect(hardRequirements.minStorage).toBe(512);
    expect(hardRequirements.minRam).toBeUndefined();
  });

  it("'1TB هارد' (Arabic disk) sets storage only", () => {
    const { hardRequirements } = extractHardware("لابتوب 1TB هارد");
    expect(hardRequirements.minStorage).toBe(1024);
    expect(hardRequirements.minRam).toBeUndefined();
  });

  it("'16GB RAM' in Arabic 'لابتوب 16 رام' sets RAM only", () => {
    const { hardRequirements } = extractHardware("لابتوب 16 رام");
    expect(hardRequirements.minRam).toBe(16);
    expect(hardRequirements.minStorage).toBeUndefined();
  });
});

// =========================================================================
// B. Budget word ordering
// =========================================================================

describe("B. Budget word ordering — natural Arabic/Darija forms", () => {
  it("'ما يفوتش 150 ألف' — verb before number", () => {
    const budget = extractBudget("لابتوب ما يفوتش 150 ألف");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("'150 ألف ما يفوتش' — number before verb", () => {
    const budget = extractBudget("150 ألف ما يفوتش");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("'لابتوب ما يفوتش 150 ألف' — subject + verb + number", () => {
    const budget = extractBudget("لابتوب ما يفوتش 150 ألف");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("'أقل من 150000' — word before number", () => {
    const budget = extractBudget("لابتوب أقل من 150000");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("'حتى 150 ألف' — حتى before number", () => {
    const budget = extractBudget("لابتوب حتى 150 ألف");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
  });

  it("'under 150000 DZD' — English form", () => {
    const budget = extractBudget("laptop under 150000 DZD");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
    expect(budget!.currency).toBe("DZD");
  });

  it("'less than 1000 USD' — English form", () => {
    const budget = extractBudget("laptop less than 1000 USD");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(1000);
    expect(budget!.currency).toBe("USD");
  });

  it("budget without currency is uncertain", () => {
    const budget = extractBudget("laptop under 150000");
    expect(budget).toBeDefined();
    expect(budget!.amount).toBe(150000);
    expect(budget!.currencyCertain).toBe(false);
  });
});

// =========================================================================
// C. "best/أفضل" intent — not comparison
// =========================================================================

describe("C. Intent — 'best/أفضل' is recommendation, not comparison", () => {
  it("'أفضل لابتوب للدراسة' is recommendation", () => {
    expect(detectIntent("أفضل لابتوب للدراسة", "ar")).toBe("recommendation");
  });

  it("'best laptop for programming' is recommendation", () => {
    expect(detectIntent("best laptop for programming", "en")).toBe("recommendation");
  });

  it("'best laptop for gaming' is recommendation", () => {
    expect(detectIntent("best laptop for gaming", "en")).toBe("recommendation");
  });

  it("'قارن بين Lenovo LOQ و HP Victus' is comparison", () => {
    expect(detectIntent("قارن بين Lenovo LOQ و HP Victus", "ar")).toBe("comparison");
  });

  it("'Lenovo LOQ vs HP Victus' is comparison", () => {
    expect(detectIntent("Lenovo LOQ vs HP Victus", "en")).toBe("comparison");
  });

  it("'compare Dell XPS vs MacBook' is comparison", () => {
    expect(detectIntent("compare Dell XPS vs MacBook", "en")).toBe("comparison");
  });

  it("understandQuery: 'best laptop for programming' has recommendation intent", () => {
    const parsed = understandQuery("best laptop for programming");
    expect(parsed.intent).toBe("recommendation");
  });

  it("understandQuery: 'أفضل لابتوب للدراسة' has recommendation intent", () => {
    const parsed = understandQuery("أفضل لابتوب للدراسة");
    expect(parsed.intent).toBe("recommendation");
  });
});

// =========================================================================
// D. Generic word false positives
// =========================================================================

describe("D. Generic words — 'قوي/مليح' do NOT auto-trigger battery", () => {
  it("'RTX 4060 قوي' does NOT set goodBattery", () => {
    const prefs = extractPreferences("RTX 4060 قوي", []);
    expect(prefs.goodBattery).toBeUndefined();
  });

  it("'معالج قوي' does NOT set goodBattery", () => {
    const prefs = extractPreferences("معالج قوي", []);
    expect(prefs.goodBattery).toBeUndefined();
  });

  it("'مليح' alone does NOT set goodBattery", () => {
    const prefs = extractPreferences("لابتوب مليح", []);
    expect(prefs.goodBattery).toBeUndefined();
  });

  it("'قوي' alone does NOT set goodBattery", () => {
    const prefs = extractPreferences("لابتوب قوي", []);
    expect(prefs.goodBattery).toBeUndefined();
  });

  it("'بطارية قوية' DOES set goodBattery (clear context)", () => {
    const prefs = extractPreferences("بطارية قوية", []);
    expect(prefs.goodBattery).toBe(true);
  });

  it("'بطاريتو مليحة' DOES set goodBattery", () => {
    const prefs = extractPreferences("بطاريتو مليحة", []);
    expect(prefs.goodBattery).toBe(true);
  });

  it("'good battery' DOES set goodBattery", () => {
    const prefs = extractPreferences("laptop with good battery", []);
    expect(prefs.goodBattery).toBe(true);
  });

  it("'long battery life' DOES set goodBattery", () => {
    const prefs = extractPreferences("laptop with long battery life", []);
    expect(prefs.goodBattery).toBe(true);
  });
});

// =========================================================================
// E. Constraint operators
// =========================================================================

describe("E. Constraint operators — min/max/exact", () => {
  it("'at least 16GB' → min operator", () => {
    const { hardRequirements } = extractHardware("laptop with at least 16GB RAM");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("min");
    expect(hardRequirements.ramConstraint!.value).toBe(16);
  });

  it("'up to 16GB' → max operator", () => {
    const { hardRequirements } = extractHardware("laptop with up to 16GB RAM");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("max");
    expect(hardRequirements.ramConstraint!.value).toBe(16);
  });

  it("'على الأقل 16GB' → min operator (Arabic)", () => {
    const { hardRequirements } = extractHardware("لابتوب على الأقل 16GB رام");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("min");
  });

  it("'حتى 16GB' → max operator (Arabic)", () => {
    const { hardRequirements } = extractHardware("لابتوب حتى 16GB رام");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("max");
  });

  it("'exactly 16GB' → exact operator", () => {
    const { hardRequirements } = extractHardware("laptop with exactly 16GB RAM");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("exact");
  });

  it("bare '16GB RAM' → min operator (default)", () => {
    const { hardRequirements } = extractHardware("laptop with 16GB RAM");
    expect(hardRequirements.ramConstraint).toBeDefined();
    expect(hardRequirements.ramConstraint!.operator).toBe("min");
  });
});

// =========================================================================
// F. Preference context — adjectives need clear nouns
// =========================================================================

describe("F. Preference context — adjectives need clear nouns", () => {
  it("'معالج قوي' sets cpuPreference=performance", () => {
    const prefs = extractPreferences("معالج قوي", []);
    expect(prefs.cpuPreference).toBe("performance");
  });

  it("'fast processor' sets cpuPreference=performance", () => {
    const prefs = extractPreferences("laptop with fast processor", []);
    expect(prefs.cpuPreference).toBe("performance");
  });

  it("'كارت شاشة قوية' sets gpuPreference=high-end", () => {
    const prefs = extractPreferences("لابتوب كارت شاشة قوية", []);
    expect(prefs.gpuPreference).toBe("high-end");
  });

  it("'powerful graphics card' sets gpuPreference=high-end", () => {
    const prefs = extractPreferences("laptop with powerful graphics card", []);
    expect(prefs.gpuPreference).toBe("high-end");
  });

  it("'لابتوب قوي' does NOT set any specific preference (too generic)", () => {
    const prefs = extractPreferences("لابتوب قوي", []);
    expect(prefs.goodBattery).toBeUndefined();
    expect(prefs.cpuPreference).toBeUndefined();
    expect(prefs.gpuPreference).toBeUndefined();
  });

  it("'high performance' sets highPerformance", () => {
    const prefs = extractPreferences("laptop with high performance", []);
    expect(prefs.highPerformance).toBe(true);
  });
});

// =========================================================================
// G. Currency safety
// =========================================================================

describe("G. Currency safety — never guessed", () => {
  it("explicit DZD is certain", () => {
    const budget = extractBudget("laptop under 150000 DZD");
    expect(budget!.currency).toBe("DZD");
    expect(budget!.currencyCertain).toBe(true);
  });

  it("ambiguous number is uncertain", () => {
    const budget = extractBudget("laptop under 150000");
    expect(budget!.currencyCertain).toBe(false);
  });

  it("'ميزانية 150' does not invent currency", () => {
    const budget = extractBudget("ميزانية 150");
    if (budget) {
      expect(budget.currencyCertain).toBe(false);
    }
  });

  it("'150 ألف' without currency is uncertain", () => {
    const budget = extractBudget("ميزانيتي 150 ألف");
    if (budget) {
      expect(budget.currencyCertain).toBe(false);
    }
  });

  it("explicit USD is certain", () => {
    const budget = extractBudget("laptop under 1000 USD");
    expect(budget!.currency).toBe("USD");
    expect(budget!.currencyCertain).toBe(true);
  });

  it("$1000 is USD and certain", () => {
    const budget = extractBudget("laptop under $1000");
    expect(budget!.currency).toBe("USD");
    expect(budget!.currencyCertain).toBe(true);
  });
});

// =========================================================================
// H. Anti-hallucination preserved
// =========================================================================

describe("H. Anti-hallucination — invariants preserved", () => {
  it("IntelligentQuery has no model field", () => {
    const parsed = understandQuery("gaming laptop RTX 4060");
    expect(Object.prototype.hasOwnProperty.call(parsed, "model")).toBe(false);
  });

  it("IntelligentQuery has no computer field", () => {
    const parsed = understandQuery("gaming laptop RTX 4060");
    expect(Object.prototype.hasOwnProperty.call(parsed, "computer")).toBe(false);
  });

  it("originalQuery is never modified", () => {
    const queries = [
      "نحب لابتوب للدراسة",
      "best laptop for programming",
      "RTX 9999 128GB RAM",
      "أفضل لابتوب للدراسة",
    ];
    for (const q of queries) {
      const parsed = understandQuery(q);
      expect(parsed.originalQuery).toBe(q);
    }
  });

  it("no fabricated price for nonexistent products", () => {
    const parsed = understandQuery("أرخص لابتوب RTX 4090 128GB");
    expect(Object.prototype.hasOwnProperty.call(parsed, "price")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, "estimatedPrice")).toBe(false);
  });
});

// =========================================================================
// I. End-to-end hardening tests
// =========================================================================

describe("I. End-to-end hardening", () => {
  it("Arabic study query: lightweight + battery, no false RAM", () => {
    const parsed = understandQuery("لابتوب خفيف وبطاريتو مليحة");
    expect(parsed.preferences.lightweight).toBe(true);
    expect(parsed.preferences.goodBattery).toBe(true);
    // No false RAM extraction
    expect(parsed.hardRequirements.minRam).toBeUndefined();
  });

  it("English gaming query: GPU + performance, no false battery", () => {
    const parsed = understandQuery("gaming laptop with RTX 4060");
    expect(parsed.hardRequirements.gpuTerms).toBeDefined();
    expect(parsed.useCases).toContain("gaming");
    // No false battery from "gaming"
    expect(parsed.preferences.goodBattery).toBeUndefined();
  });

  it("Arabic mixed query: recommendation + RAM", () => {
    const parsed = understandQuery("نحب لابتوب للبرمجة 16 رام");
    expect(parsed.intent).toBe("recommendation");
    expect(parsed.useCases).toContain("programming");
    expect(parsed.hardRequirements.minRam).toBe(16);
  });

  it("Budget query: Arabic verb form, no currency invented", () => {
    const parsed = understandQuery("لابتوب ما يفوتش 150 ألف");
    expect(parsed.budget).toBeDefined();
    expect(parsed.budget!.amount).toBe(150000);
    expect(parsed.budget!.currencyCertain).toBe(false);
  });

  it("Best laptop is recommendation, not comparison", () => {
    const parsed = understandQuery("best laptop for gaming");
    expect(parsed.intent).toBe("recommendation");
    expect(parsed.useCases).toContain("gaming");
  });
});
