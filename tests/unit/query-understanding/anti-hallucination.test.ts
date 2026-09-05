import { describe, it, expect } from "vitest";
import { understandQuery, IntelligentQuery } from "@/lib/server/query-understanding";

/**
 * Phase 3.1 — Anti-Hallucination Tests
 *
 * These tests verify that the Query Understanding layer NEVER creates or
 * returns a fictional computer, specification, price, or configuration.
 *
 * The parser is allowed to REPRESENT what the user asked for.
 * It is NOT allowed to FABRICATE a catalog result.
 */

/** Check that a parsed query does NOT contain a forbidden key. */
function expectNoKey(parsed: IntelligentQuery, key: string): void {
  expect(Object.prototype.hasOwnProperty.call(parsed, key)).toBe(false);
  expect((parsed as unknown as Record<string, unknown>)[key]).toBeUndefined();
}

describe("Anti-hallucination — no fictional computers", () => {
  it("Arabic 'super laptop for study and programming' does not create a computer", () => {
    const parsed = understandQuery("أريد لابتوب خارق للدراسة والبرمجة");
    expect(parsed.originalQuery).toBe("أريد لابتوب خارق للدراسة والبرمجة");
    expect(parsed.useCases).toContain("university");
    expect(parsed.useCases).toContain("programming");
    expectNoKey(parsed, "model");
    expectNoKey(parsed, "computer");
    expectNoKey(parsed, "laptop");
    expectNoKey(parsed, "result");
  });

  it("nonexistent hardware 'RTX 9999 128GB' does not create a product", () => {
    const parsed = understandQuery("laptop with RTX 9999 128GB RAM");
    expect(parsed.hardRequirements.minRam).toBe(128);
    expectNoKey(parsed, "model");
    expectNoKey(parsed, "computer");
    expectNoKey(parsed, "price");
    expectNoKey(parsed, "availability");
  });

  it("impossible spec '999TB storage' is parsed as a requirement, not a result", () => {
    const parsed = understandQuery("laptop with 999TB storage");
    expect(parsed.hardRequirements.minStorage).toBe(999 * 1024);
    expectNoKey(parsed, "model");
  });

  it("parsed query has no price field for nonexistent products", () => {
    const parsed = understandQuery("أرخص لابتوب RTX 4090 128GB");
    expectNoKey(parsed, "price");
    expectNoKey(parsed, "estimatedPrice");
  });

  it("parsed query does not include fabricated availability", () => {
    const parsed = understandQuery("laptop in stock today");
    expectNoKey(parsed, "availability");
    expectNoKey(parsed, "inStock");
  });

  it("parsed query does not include fabricated benchmark scores", () => {
    const parsed = understandQuery("fast gaming laptop");
    expectNoKey(parsed, "benchmark");
    expectNoKey(parsed, "score");
  });
});

describe("Anti-hallucination — preserves uncertainty", () => {
  it("ambiguous query has low confidence", () => {
    const parsed = understandQuery("laptop");
    expect(parsed.confidence).toBe("low");
  });

  it("unknown intent is preserved as 'unknown'", () => {
    const parsed = understandQuery("xyz");
    expect(parsed.intent).toBe("unknown");
  });

  it("uncertain currency is marked as uncertain", () => {
    const parsed = understandQuery("laptop under 150000");
    expect(parsed.budget).toBeDefined();
    expect(parsed.budget!.currencyCertain).toBe(false);
  });

  it("originalQuery is never modified", () => {
    const queries = [
      "نحب لابتوب للدراسة",
      "gaming laptop RTX 4060",
      "RTX 9999 128GB RAM",
      "أريد لابتوب خارق للدراسة والبرمجة",
    ];
    for (const q of queries) {
      const parsed = understandQuery(q);
      expect(parsed.originalQuery).toBe(q);
    }
  });
});

describe("Anti-hallucination — IntelligentQuery is pure metadata", () => {
  it("IntelligentQuery only contains intent/requirements, not results", () => {
    const parsed = understandQuery("gaming laptop with RTX 4060");
    const allowedKeys = [
      "originalQuery",
      "normalizedQuery",
      "intent",
      "language",
      "useCases",
      "hardRequirements",
      "preferences",
      "budget",
      "keywords",
      "confidence",
    ];
    const actualKeys = Object.keys(parsed);
    for (const key of actualKeys) {
      expect(allowedKeys).toContain(key);
    }
  });

  it("HardRequirements only contains field constraints, not product data", () => {
    const parsed = understandQuery("laptop with 16GB RAM, RTX 4060, under $1500");
    const allowedKeys = [
      "minRam",
      "maxRam",
      "minStorage",
      "maxStorage",
      "minPrice",
      "maxPrice",
      "minScreenSize",
      "maxScreenSize",
      "minRefreshRate",
      "maxRefreshRate",
      "touchscreen",
      "cpuTerms",
      "gpuTerms",
      "brand",
      "category",
      "ramConstraint",
      "storageConstraint",
      "priceConstraint",
    ];
    for (const key of Object.keys(parsed.hardRequirements)) {
      expect(allowedKeys).toContain(key);
    }
  });
});
