import { describe, it, expect } from "vitest";
import { BoundedLruCache } from "@/lib/server/cache";
import {
  normalizeForCacheKey,
  semanticCacheKey,
  SEMANTIC_RESULT_CACHE,
  SEMANTIC_CONFIG,
  invalidateSemanticResultCache,
} from "@/lib/server/semantic-retrieval";

/**
 * Phase 3.2.6 — Bounded semantic cache tests
 *
 * BoundedLruCache: TTL expiry, max-entry eviction in LRU order, read-recently
 * refresh. Cache-key policy:
 *   - key encodes normalizedQuery + language + embeddingModel + embeddingVersion + topK
 *   - same normalized query → same key (deterministic)
 *   - different model/version/language/topK → different key (isolation)
 */

// ---------------------------------------------------------------------------
// BoundedLruCache core
// ---------------------------------------------------------------------------

describe("BoundedLruCache — TTL", () => {
  it("stores and returns a value", () => {
    const c = new BoundedLruCache<string, number>(10, 1000);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("misses for unknown keys", () => {
    const c = new BoundedLruCache<string, number>(10, 1000);
    expect(c.get("nope")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    let t = 0;
    const c = new BoundedLruCache<string, number>(10, 1000, () => t);
    c.set("a", 1);
    t = 999;
    expect(c.get("a")).toBe(1);
    t = 1001;
    expect(c.get("a")).toBeUndefined();
  });

  it("expired keys are purged on read (size decreases)", () => {
    let t = 0;
    const c = new BoundedLruCache<string, number>(10, 1000, () => t);
    c.set("a", 1);
    c.set("b", 2);
    t = 1001;
    c.get("a"); // purge a
    expect(c.size).toBe(1);
    expect(c.has("a")).toBe(false);
  });

  it("overwrite refreshes the TTL", () => {
    let t = 0;
    const c = new BoundedLruCache<string, number>(10, 1000, () => t);
    c.set("a", 1);
    t = 900;
    c.set("a", 2);
    t = 1500; // past the FIRST deadline, inside the refreshed one
    expect(c.get("a")).toBe(2);
  });
});

describe("BoundedLruCache — LRU eviction", () => {
  it("evicts the least-recently-used entry beyond maxEntries", () => {
    const c = new BoundedLruCache<string, number>(2, 1000);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("reads refresh recency (protect from eviction)", () => {
    const c = new BoundedLruCache<string, number>(2, 1000);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // a becomes most-recent
    c.set("c", 3); // evicts "b", NOT "a"
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("re-inserting a key refreshes its position and value", () => {
    const c = new BoundedLruCache<string, number>(2, 1000);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 10);
    c.set("c", 3); // evicts "b" (a was refreshed)
    expect(c.get("a")).toBe(10);
    expect(c.get("b")).toBeUndefined();
  });
});

describe("BoundedLruCache — validation & clear", () => {
  it("rejects invalid limits", () => {
    expect(() => new BoundedLruCache(0, 100)).toThrow();
    expect(() => new BoundedLruCache(10, 0)).toThrow();
  });

  it("clear empties the cache", () => {
    const c = new BoundedLruCache<string, number>(10, 1000);
    c.set("a", 1);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get("a")).toBeUndefined();
  });

  it("has() does not refresh recency", () => {
    const c = new BoundedLruCache<string, number>(2, 1000);
    c.set("a", 1);
    c.set("b", 2);
    c.has("a"); // LRU order must remain b,a (b newest)
    c.set("c", 3); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cache-key policy (version/space isolation)
// ---------------------------------------------------------------------------

describe("Semantic cache — key determinism", () => {
  it("normalizes casing and whitespace for the key", () => {
    expect(semanticCacheKey({
      query: "  Gaming   LAPTOP ",
      language: "en",
      topK: 50,
      embeddingModel: "gemini-embedding-2",
      embeddingVersion: "1",
    })).toBe(semanticCacheKey({
      query: "gaming laptop",
      language: "en",
      topK: 50,
      embeddingModel: "gemini-embedding-2",
      embeddingVersion: "1",
    }));
  });

  it("key differs across embedding VERSIONS (incompatible spaces can never mix)", () => {
    const base = { query: "gaming laptop", language: "en", topK: 50 };
    const v1 = semanticCacheKey({ ...base, embeddingModel: "gemini-embedding-2", embeddingVersion: "1" });
    const v2 = semanticCacheKey({ ...base, embeddingModel: "gemini-embedding-2", embeddingVersion: "2" });
    expect(v1).not.toBe(v2);
  });

  it("key differs across embedding MODELS", () => {
    const base = { query: "gaming laptop", language: "en", topK: 50 };
    const m1 = semanticCacheKey({ ...base, embeddingModel: "gemini-embedding-2", embeddingVersion: "1" });
    const m2 = semanticCacheKey({ ...base, embeddingModel: "other-model", embeddingVersion: "1" });
    expect(m1).not.toBe(m2);
  });

  it("key differs across languages", () => {
    const base = { query: "gaming laptop", topK: 50, embeddingModel: "gemini-embedding-2", embeddingVersion: "1" };
    expect(semanticCacheKey({ ...base, language: "en" })).not.toBe(
      semanticCacheKey({ ...base, language: "ar" })
    );
  });

  it("key differs across topK windows", () => {
    const base = { query: "gaming laptop", language: "en", embeddingModel: "gemini-embedding-2", embeddingVersion: "1" };
    expect(semanticCacheKey({ ...base, topK: 10 })).not.toBe(semanticCacheKey({ ...base, topK: 50 }));
  });

  it("key differs for genuinely different queries", () => {
    const base = { language: "en", topK: 50, embeddingModel: "gemini-embedding-2", embeddingVersion: "1" };
    expect(semanticCacheKey({ ...base, query: "gaming laptop" })).not.toBe(
      semanticCacheKey({ ...base, query: "lightweight laptop" })
    );
  });

  it("normalizeForCacheKey strips punctuation deterministically", () => {
    expect(normalizeForCacheKey("  Lenovo  -  ThinkPad!! ")).toBe("lenovo thinkpad");
  });
});

// ---------------------------------------------------------------------------
// Production cache singleton
// ---------------------------------------------------------------------------

describe("Semantic cache — production singleton", () => {
  it("is bounded by the configured max entries", () => {
    expect(SEMANTIC_CONFIG.semanticCache.maxEntries).toBeGreaterThan(0);
    expect(SEMANTIC_RESULT_CACHE.size).toBeLessThanOrEqual(SEMANTIC_CONFIG.semanticCache.maxEntries);
  });

  it("invalidateSemanticResultCache clears the singleton", () => {
    SEMANTIC_RESULT_CACHE.set("test-key-1", {
      matches: [],
      embeddedCount: 0,
      cachedLatencyMs: 1,
    });
    expect(SEMANTIC_RESULT_CACHE.size).toBeGreaterThan(0);
    invalidateSemanticResultCache();
    expect(SEMANTIC_RESULT_CACHE.size).toBe(0);
  });
});