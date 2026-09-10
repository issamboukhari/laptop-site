/**
 * Phase 3.2.6 — Bounded in-memory cache (LRU + TTL)
 *
 * Serves the semantic-result cache. Bounded by BOTH max entries and TTL so a
 * busy deployment can never grow memory without limit and stale embeddings
 * (e.g. after a provider migration) expire naturally.
 *
 * Design notes:
 *  - Deterministic: Map insertion order gives a stable, O(1) LRU eviction
 *    (evict the oldest key). Same input key → same cached value.
 *  - Key identity is the SOLE responsibility of the caller. For semantic
 *    results the key MUST encode normalizedQuery + language + embedding
 *    model + embedding version (+ topK) so embedding spaces can never mix.
 *  - This class is generic; it never looks at the meaning of its values.
 *  - Errors are never cached by the CALLER's policy, not by this class.
 */

export interface BoundedCacheEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * A Map-backed LRU cache with a size limit and per-entry TTL. Reads refresh
 * recency; reads of expired entries remove them and miss.
 */
export class BoundedLruCache<K, V> {
  private readonly entries = new Map<K, BoundedCacheEntry<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
      throw new Error("maxEntries must be a positive number");
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error("ttlMs must be a positive number");
    }
  }

  /** Read a value, refreshing its recency. Expired entries count as a miss. */
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (this.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh LRU position on access.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Does a non-expired entry exist? Does not refresh recency. */
  has(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.now() > entry.expiresAt) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  /** Insert or refresh a value, evicting the least-recently-used on overflow. */
  set(key: K, value: V): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as K | undefined;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}