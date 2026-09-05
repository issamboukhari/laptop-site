import { describe, it, expect, beforeAll } from "vitest";
import { searchModels } from "@/lib/server/search";
import { getAllModels } from "@/lib/server/database";
import { understandQuery } from "@/lib/server/query-understanding";

/**
 * Phase 3.1 — Regression Tests
 *
 * Verifies that the Query Understanding layer does not break the existing
 * search engine. The search engine remains the source of truth for catalog
 * matches.
 */

beforeAll(async () => {
  await getAllModels();
});

describe("Regression — existing search behavior preserved", () => {
  it("exact model search still works", async () => {
    const result = await searchModels("ThinkPad X1 Carbon", {});
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("brand search still works", async () => {
    const result = await searchModels("Lenovo", {});
    expect(result.models.length).toBeGreaterThan(0);
    for (const m of result.models) {
      expect(m.brand.toLowerCase()).toBe("lenovo");
    }
  });

  it("fuzzy search still works", async () => {
    const result = await searchModels("lenov", {});
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("GPU search still works", async () => {
    const result = await searchModels("RTX 4060", {});
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("RAM criteria search still works", async () => {
    const result = await searchModels("16gb", {});
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("generation search still works", async () => {
    const result = await searchModels("g11", {});
    expect(result).toBeDefined();
  });

  it("multi-criteria search still works", async () => {
    const result = await searchModels("lenovo 16gb", {});
    expect(result.models.length).toBeGreaterThan(0);
  });
});

describe("Regression — Query Understanding does not affect search results", () => {
  it("Arabic query through understandQuery does not produce a model", () => {
    const parsed = understandQuery("لابتوب للدراسة");
    // No model field
    expect(Object.prototype.hasOwnProperty.call(parsed, "model")).toBe(false);
  });

  it("understanding a query is a separate step from searching", async () => {
    // Understand
    const parsed = understandQuery("gaming laptop");
    expect(parsed.useCases).toContain("gaming");
    // Search still uses the original query
    const result = await searchModels("gaming laptop", {});
    expect(result).toBeDefined();
    expect(result.models).toBeDefined();
  });

  it("existing search returns actual catalog models, not fabricated ones", async () => {
    const result = await searchModels("nonexistent-laptop-xyz12345", {});
    // The search engine should not return anything for a nonexistent model
    expect(result.models).toHaveLength(0);
    // It should NOT fabricate a computer
  });
});
