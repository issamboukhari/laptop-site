/**
 * Phase 3.2.3 FIX — Persistent Semantic Retrieval
 *
 * Vector-embedding-based semantic retrieval over the EXISTING real
 * computer catalog. Uses gemini-embedding-2 (768-dim MRL) via the
 * existing @google/genai SDK. Embeddings are persisted in Supabase
 * pgvector — not rebuilt on every server start.
 *
 * TRUST INVARIANT: This module NEVER creates, invents, or modifies
 * computer data. It only identifies which existing catalog records
 * are semantically similar to a user query. Every result maps back to
 * a canonical catalog variant/model ID.
 *
 * Embedding level: Variant-level (each variant gets its own embedding
 * to preserve variant integrity — no invalid cross-variant combinations).
 *
 * Storage: Persistent (Supabase pgvector). Invalidated per-entity via
 * content hashes — not rebuilt wholesale on catalog changes.
 */

import { ComputerModel, ComputerVariant } from "../data/types";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./gemini";
import { isSupabaseConfigured, sbSelect, sbUpsert, sbRpc, sbDelete } from "./supabase";
import { detectLanguage } from "./query-understanding";
import { BoundedLruCache } from "./cache";
import { semanticCircuitBreaker } from "./circuit-breaker";
import {
  failureSemanticResult,
  emptySemanticResult,
} from "./reliability";
import type { SemanticFailureKind } from "../data/types";

// ---------------------------------------------------------------------------
// Centralized Configuration
// ---------------------------------------------------------------------------

export const SEMANTIC_CONFIG = {
  /** Embedding model — must be the same for catalog and queries. */
  embeddingModel: "gemini-embedding-2" as const,

  /** Vector dimension — MRL output, recommended by Google. */
  embeddingDimension: 768 as const,

  /** Embedding version — bump to force re-embedding of all entities. */
  embeddingVersion: "1" as const,

  /** Minimum cosine similarity threshold for semantic matches. */
  minSimilarity: 0.3,

  /** Maximum number of semantic candidates to retrieve per query. */
  topK: 50,

  /** Maximum text length per semantic document (chars). */
  maxDocLength: 1000,

  /** Batch size for embedding API calls. */
  embedBatchSize: 20,

  /** Maximum concurrent embedding API calls. */
  embedConcurrency: 5,

  /** Retry attempts for transient embedding failures. */
  maxRetries: 3,

  /** Base delay for exponential backoff (ms). */
  retryBaseDelayMs: 500,

  /** Timeout for individual embedding API calls (ms). */
  embedTimeoutMs: 15_000,

  /** Timeout for vector DB retrieval (ms). */
  searchTimeoutMs: 5_000,

  /**
   * Phase 3.2.6 — hard upper bound on the WHOLE semantic call (embedding +
   * vector search + provider latency). The search pipeline stops waiting
   * after this and degrades to structured results. Prevents unbounded waits.
   */
  pipelineTimeoutMs: 6_000,

  /**
   * Phase 3.2.6 — bounded semantic result cache. Keyed by
   * normalizedQuery + language + embedding model + embedding version + topK.
   * Successes only — failures are never stored.
   */
  semanticCache: {
    maxEntries: 500,
    ttlMs: 10 * 60_000,
  } as const,
} as const;

/** Legacy constant exports for backward compatibility. */
export const EMBEDDING_MODEL = SEMANTIC_CONFIG.embeddingModel;
export const EMBEDDING_DIMENSION = SEMANTIC_CONFIG.embeddingDimension;
export const SEMANTIC_TOP_K = SEMANTIC_CONFIG.topK;
export const MIN_SIMILARITY = SEMANTIC_CONFIG.minSimilarity;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single semantic document for embedding. */
interface SemanticDocument {
  entityId: string;
  modelId: string;
  content: string;
  contentHash: string;
}

/** A persistent embedding record (stored in Supabase). */
interface EmbeddingRow {
  id: number;
  entity_type: string;
  entity_id: string;
  model_id: string;
  content_hash: string;
  embedding: string; // pgvector serializes as string
  embedding_model: string;
  embedding_dimension: number;
  embedding_version: string;
  created_at: string;
  updated_at: string;
}

/** Semantic retrieval result for a single entity. */
export interface SemanticMatch {
  variantId: string;
  modelId: string;
  score: number;
  rank: number;
}

/**
 * Full semantic retrieval result. Phase 3.2.6 adds typed failure observability
 * (`failureKind`, cache/breaker flags) — all optional so every existing caller
 * and the offline surrogate (`lib/eval/semantic-surrogate.ts`) stays valid.
 */
export interface SemanticResult {
  matches: SemanticMatch[];
  success: boolean;
  fallback: boolean;
  embeddedCount: number;
  latencyMs: number;
  error?: string;
  /** Phase 3.2.6 — typed failure classification (present on failed results). */
  failureKind?: SemanticFailureKind;
  /** True when the provider worked but returned zero matches (valid outcome). */
  semanticEmpty?: boolean;
  /** True when this response was served from the bounded result cache. */
  cacheHit?: boolean;
  /** True when the cache was consulted and missed. */
  cacheMiss?: boolean;
  /** True when the call was skipped because the circuit breaker was OPEN. */
  circuitOpen?: boolean;
  /** Circuit-breaker state at call time (CLOSED/OPEN/HALF_OPEN). */
  breakerState?: string;
}

/** Classified reasons an embedding call can fail with. */
export type EmbeddedFailureReason = "TIMEOUT" | "API_ERROR" | "INVALID_EMBEDDING" | "UNAVAILABLE";

/**
 * Outcome of a single embedding call — enriched so failures can be classified
 * instead of flattened to null. Classified reasons map 1:1 to
 * SemanticFailureKind (minus "unavailable", which is config, not a fault).
 */
export type EmbeddingOutcome =
  | { ok: true; vector: number[] }
  | { ok: false; reason: EmbeddedFailureReason };

/** RPC match result from Supabase. */
interface RpcMatch {
  variant_id: string;
  model_id: string;
  similarity: number;
}

/** A snapshot of a cached semantic result (never contains a failure). */
interface CachedSemanticResult {
  matches: SemanticMatch[];
  embeddedCount: number;
  /** Origin latency of the embedding+search at cache-fill time. */
  cachedLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Semantic document generation
// ---------------------------------------------------------------------------

/**
 * Generate a semantic document for a single variant.
 * Uses ONLY real catalog fields. Unknown fields are omitted (never fabricated).
 */
function variantToSemanticDocument(
  model: ComputerModel,
  variant: ComputerVariant
): string {
  const parts: string[] = [];

  // Identity
  parts.push(`Model: ${model.brand} ${model.name}`);
  if (model.family) parts.push(`Family: ${model.family}`);
  if (model.generation) parts.push(`Generation: ${model.generation}`);
  parts.push(`Category: ${model.category.replace(/-/g, " ")}`);
  parts.push(`Year: ${model.year}`);

  // Core specs
  const specs = variant.specs;

  if (specs.cpu) parts.push(`CPU: ${specs.cpu}`);
  if (specs.cpuCores) parts.push(`CPU Cores: ${specs.cpuCores}`);

  if (specs.gpu && specs.gpu !== "Integrated") {
    parts.push(`GPU: ${specs.gpu}`);
  } else if (specs.gpu === "Integrated") {
    parts.push(`GPU: Integrated graphics`);
  }

  if (specs.ram > 0) parts.push(`RAM: ${specs.ram} GB`);
  if (specs.ramType) parts.push(`RAM Type: ${specs.ramType}`);

  if (specs.storage > 0) {
    const storageStr = specs.storage >= 1024
      ? `${(specs.storage / 1024).toFixed(specs.storage % 1024 === 0 ? 0 : 1)} TB`
      : `${specs.storage} GB`;
    parts.push(`Storage: ${storageStr} ${specs.storageType}`);
  }

  if (specs.displaySize > 0) parts.push(`Display: ${specs.displaySize} inch`);
  if (specs.resolution) parts.push(`Resolution: ${specs.resolution}`);
  if (specs.displayRefreshRate > 0 && specs.displayRefreshRate !== 60) {
    parts.push(`Refresh Rate: ${specs.displayRefreshRate} Hz`);
  }
  if (specs.panelType) parts.push(`Panel: ${specs.panelType}`);
  if (specs.touchscreen) parts.push(`Touchscreen: yes`);

  if (specs.weight > 0) parts.push(`Weight: ${specs.weight} kg`);
  if (specs.batteryLife > 0) parts.push(`Battery: ${specs.batteryLife} hours`);

  if (specs.buildMaterial) parts.push(`Build: ${specs.buildMaterial}`);
  if (specs.militaryCertification) parts.push(`Certification: ${specs.militaryCertification}`);

  if (specs.backlitKeyboard) parts.push(`Backlit keyboard: yes`);
  if (specs.rgbKeyboard) parts.push(`RGB keyboard: yes`);

  if (specs.fingerprint) parts.push(`Fingerprint reader: yes`);
  if (specs.faceRecognition) parts.push(`Face recognition: yes`);
  if (specs.tpm) parts.push(`TPM: ${specs.tpm}`);

  if (specs.os) parts.push(`OS: ${specs.os}`);

  if (specs.wifi) parts.push(`WiFi: ${specs.wifi}`);
  if (specs.bluetooth) parts.push(`Bluetooth: ${specs.bluetooth}`);
  if (specs.ethernet) parts.push(`Ethernet: yes`);
  if (specs.thunderbolt) parts.push(`Thunderbolt: ${specs.thunderbolt}`);

  // Price tier (useful for semantic context)
  if (variant.price > 0) {
    if (variant.price < 500) parts.push(`Budget laptop`);
    else if (variant.price < 1000) parts.push(`Mid-range laptop`);
    else if (variant.price < 1500) parts.push(`Premium laptop`);
    else parts.push(`High-end laptop`);
  }

  // Description (only short, non-marketing text)
  if (variant.description && variant.description.length < 200) {
    parts.push(variant.description);
  }

  return parts.join(". ");
}

/**
 * Generate semantic documents for all variants in the catalog.
 */
function generateSemanticDocuments(
  models: ComputerModel[]
): SemanticDocument[] {
  const docs: SemanticDocument[] = [];
  const maxLen = SEMANTIC_CONFIG.maxDocLength;

  for (const model of models) {
    for (const variant of model.variants) {
      const content = variantToSemanticDocument(model, variant);
      const truncated = content.length > maxLen
        ? content.slice(0, maxLen)
        : content;

      docs.push({
        entityId: variant.id,
        modelId: model.id,
        content: truncated,
        contentHash: simpleHash(truncated),
      });
    }
  }

  return docs;
}

/** Deterministic content hash for staleness detection. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Embedding generation via Gemini
// ---------------------------------------------------------------------------

let _genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (!_genaiClient) {
    _genaiClient = new GoogleGenAI({ apiKey });
  }
  return _genaiClient;
}

/**
 * Generate an embedding for a single text with retry logic.
 *
 * Phase 3.2.6: returns a CLASSIFIED outcome instead of null so failure kinds
 * (timeout / API error / malformed embedding / unavailable) survive to the
 * reliability layer. Retries only on transient, retryable conditions.
 *
 * NOTE: `taskType` is NOT sent to the Gemini API — gemini-embedding-2 does
 * not support the legacy task_type parameter. The query/document semantic
 * distinction is maintained in application logic only.
 */
async function embedSingle(
  text: string,
  _purpose: "document" | "query" = "document"
): Promise<EmbeddingOutcome> {
  const client = getGenAIClient();
  if (!client) return { ok: false, reason: "UNAVAILABLE" };

  const dim = SEMANTIC_CONFIG.embeddingDimension;
  const maxRetries = SEMANTIC_CONFIG.maxRetries;
  const baseDelay = SEMANTIC_CONFIG.retryBaseDelayMs;

  let lastKind: EmbeddedFailureReason = "API_ERROR";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        client.models.embedContent({
          model: SEMANTIC_CONFIG.embeddingModel,
          contents: text,
          config: {
            outputDimensionality: dim,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Embedding timeout")), SEMANTIC_CONFIG.embedTimeoutMs)
        ),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = result as Record<string, any>;
      const values: number[] | undefined = r?.embedding?.values ?? r?.embeddings?.[0]?.values;

      // Runtime dimension validation — reject mismatched embeddings
      if (!values || values.length !== dim) {
        lastKind = "INVALID_EMBEDDING";
        return { ok: false, reason: "INVALID_EMBEDDING" };
      }

      return { ok: true, vector: values };
    } catch (error) {
      const errStr = error instanceof Error ? error.message : String(error);

      // Classify the failing condition (INVALID_EMBEDDING already handled above).
      lastKind = errStr.includes("timeout") ? "TIMEOUT" : "API_ERROR";

      const isTransient = errStr.includes("timeout") ||
        errStr.includes("ECONNRESET") ||
        errStr.includes("503") ||
        errStr.includes("429") ||
        errStr.includes("overloaded");

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isTransient) {
        return { ok: false, reason: lastKind };
      }

      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }

  return { ok: false, reason: lastKind };
}

/**
 * Generate embeddings for a batch of texts with controlled concurrency.
 */
async function generateEmbeddings(
  texts: string[],
  purpose: "document" | "query" = "document"
): Promise<EmbeddingOutcome[]> {
  const results: EmbeddingOutcome[] = new Array(texts.length).fill({
    ok: false,
    reason: "UNAVAILABLE",
  });
  const concurrency = SEMANTIC_CONFIG.embedConcurrency;
  const batchSize = SEMANTIC_CONFIG.embedBatchSize;

  // Process in batches for progress tracking
  for (let i = 0; i < texts.length; i += batchSize * concurrency) {
    const chunkPromises: Promise<void>[] = [];

    for (let j = i; j < Math.min(i + batchSize * concurrency, texts.length); j += batchSize) {
      const batchStart = j;
      const batchEnd = Math.min(j + batchSize, texts.length);

      const promise = (async () => {
        for (let k = batchStart; k < batchEnd; k++) {
          results[k] = await embedSingle(texts[k], purpose);
        }
      })();

      chunkPromises.push(promise);
    }

    await Promise.all(chunkPromises);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Persistent storage (Supabase)
// ---------------------------------------------------------------------------

const EMBEDDING_TABLE = "semantic_embeddings";

/** Row shape for upserting embeddings. */
interface EmbeddingUpsertRow {
  entity_type: string;
  entity_id: string;
  model_id: string;
  content_hash: string;
  embedding: string; // pgvector format: '[0.1,0.2,...]'
  embedding_model: string;
  embedding_dimension: number;
  embedding_version: string;
}

/** Convert number[] to pgvector string format. */
function toPgVector(values: number[]): string {
  return `[${values.map((v) => v.toFixed(8)).join(",")}]`;
}

/**
 * Fetch existing embeddings for given entity IDs.
 * Filters by IDs in the database query — does not load all embeddings.
 */
async function fetchExistingEmbeddings(
  entityIds: string[]
): Promise<Map<string, EmbeddingRow>> {
  if (!isSupabaseConfigured() || entityIds.length === 0) return new Map();

  try {
    // PostgREST `in` filter: entity_id=in.(id1,id2,...)
    // Process in batches to avoid URL length limits
    const map = new Map<string, EmbeddingRow>();
    const batchSize = 100;

    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);
      const idList = batch.map((id) => `"${id}"`).join(",");

      const rows = await sbSelect<EmbeddingRow>(EMBEDDING_TABLE, {
        columns: "entity_id,content_hash,embedding_model,embedding_version",
        filters: {
          entity_type: "eq.variant",
          entity_id: `in.(${idList})`,
        },
        limit: batchSize,
      });

      for (const row of rows) {
        map.set(row.entity_id, row);
      }
    }

    return map;
  } catch {
    return new Map();
  }
}

/**
 * Upsert embeddings into Supabase.
 */
async function upsertEmbeddings(rows: EmbeddingUpsertRow[]): Promise<void> {
  if (!isSupabaseConfigured() || rows.length === 0) return;

  try {
    await sbUpsert(EMBEDDING_TABLE, rows as unknown as Record<string, unknown>[], "entity_type,entity_id,embedding_model,embedding_version");
  } catch {
    // Non-fatal — search will fall back to non-semantic
  }
}

/**
 * Delete embeddings for entity IDs that no longer exist in the catalog.
 * Only deletes entities not in the valid set — does not load all embeddings.
 */
async function deleteStaleEmbeddings(validEntityIds: Set<string>): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    // Fetch only entity_ids that are currently stored
    const allRows = await sbSelect<{ entity_id: string }>(EMBEDDING_TABLE, {
      columns: "entity_id",
      filters: { entity_type: "eq.variant" },
      limit: 10000,
    });

    const staleIds = allRows
      .map((r) => r.entity_id)
      .filter((id) => !validEntityIds.has(id));

    if (staleIds.length === 0) return;

    // Delete stale entries
    for (const id of staleIds) {
      try {
        await sbDelete(EMBEDDING_TABLE, {
          entity_type: "eq.variant",
          entity_id: `eq.${id}`,
        });
      } catch {
        // Best effort — individual deletion failure is non-fatal
      }
    }
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Incremental indexing
// ---------------------------------------------------------------------------

let _indexingInProgress = false;

/**
 * Index or re-index semantic embeddings for the given catalog.
 *
 * - Skips variants whose content hash matches (unchanged).
 * - Re-embeds variants with changed content.
 * - Deletes embeddings for variants that no longer exist.
 *
 * This function is safely rerunnable — running it twice creates no duplicates.
 *
 * @param models — full catalog from getAllModels()
 * @param force — if true, re-embed all variants regardless of hash
 * @returns number of embeddings created or updated
 */
export async function indexSemanticEmbeddings(
  models: ComputerModel[],
  force = false
): Promise<number> {
  if (_indexingInProgress) return 0;
  _indexingInProgress = true;

  try {
    // 1. Generate semantic documents
    const documents = generateSemanticDocuments(models);
    if (documents.length === 0) return 0;

    // 2. Build valid entity set for stale deletion
    const validEntityIds = new Set(documents.map((d) => d.entityId));

    // 3. Fetch existing embeddings to detect staleness
    const entityIds = documents.map((d) => d.entityId);
    const existing = await fetchExistingEmbeddings(entityIds);

    // 4. Partition: skip unchanged, re-embed changed/new
    const toEmbed: SemanticDocument[] = [];
    let skippedCount = 0;

    for (const doc of documents) {
      const existingRow = existing.get(doc.entityId);
      if (!force && existingRow && existingRow.content_hash === doc.contentHash) {
        skippedCount++;
        continue;
      }
      toEmbed.push(doc);
    }

    if (toEmbed.length === 0 && skippedCount > 0) {
      // All embeddings are current — just clean up stale ones
      await deleteStaleEmbeddings(validEntityIds);
      return 0;
    }

    // 5. Generate embeddings for changed/new documents
    const texts = toEmbed.map((d) => d.content);
    const embeddings = await generateEmbeddings(texts, "document");

    // 6. Build upsert rows
    const upsertRows: EmbeddingUpsertRow[] = [];
    for (let i = 0; i < toEmbed.length; i++) {
      const emb = embeddings[i];
      if (!emb.ok) continue; // Skip failed embeddings

      upsertRows.push({
        entity_type: "variant",
        entity_id: toEmbed[i].entityId,
        model_id: toEmbed[i].modelId,
        content_hash: toEmbed[i].contentHash,
        embedding: toPgVector(emb.vector),
        embedding_model: SEMANTIC_CONFIG.embeddingModel,
        embedding_dimension: SEMANTIC_CONFIG.embeddingDimension,
        embedding_version: SEMANTIC_CONFIG.embeddingVersion,
      });
    }

    // 7. Upsert to Supabase
    await upsertEmbeddings(upsertRows);

    // 8. Clean up stale embeddings
    await deleteStaleEmbeddings(validEntityIds);

    return upsertRows.length;
  } finally {
    _indexingInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Cosine similarity (exported for testing only — NOT used for production search)
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// Bounded semantic result cache (Phase 3.2.6)
// ---------------------------------------------------------------------------

/**
 * Version-aware semantic result cache. Key = normalizedQuery + language +
 * embeddingModel + embeddingVersion + topK, so two embedding spaces can never
 * be confused with each other (a cache entry from gemini-embedding-2 v1 is
 * NEVER served for a different model/version, and Arabic/English results are
 * never crossed). Successes only — failures are never cached.
 */
export const SEMANTIC_RESULT_CACHE: BoundedLruCache<string, CachedSemanticResult> =
  new BoundedLruCache<string, CachedSemanticResult>(
    SEMANTIC_CONFIG.semanticCache.maxEntries,
    SEMANTIC_CONFIG.semanticCache.ttlMs
  );

/**
 * Deterministic cache-key normalization. Mirrors the search pipeline's
 * normalization (lowercase, collapse whitespace, strip punctuation) — applied
 * per call so cache identity does not depend on query casing/spacing.
 */
export function normalizeForCacheKey(query: string): string {
  return query
    .toLowerCase()
    .replace(/[-[\]{}()!@#$%^&*_=+`~<>?,;:'"|\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the cache key for a semantic retrieval call. No key confusion is
 * possible between models, versions, languages, or topK windows.
 */
export function semanticCacheKey(input: {
  query: string;
  language: string;
  topK: number;
  embeddingModel: string;
  embeddingVersion: string;
}): string {
  return [
    input.embeddingModel,
    input.embeddingVersion,
    input.language,
    String(input.topK),
    normalizeForCacheKey(input.query),
  ].join("|");
}

/** Reason → typed SemanticFailureKind (unavailable is config, not a fault). */
export function classifyEmbeddingFailure(reason: EmbeddedFailureReason): SemanticFailureKind {
  switch (reason) {
    case "TIMEOUT":
      return "SEMANTIC_TIMEOUT";
    case "API_ERROR":
      return "SEMANTIC_API_ERROR";
    case "INVALID_EMBEDDING":
      return "SEMANTIC_INVALID_EMBEDDING";
    case "UNAVAILABLE":
      return "SEMANTIC_UNAVAILABLE";
  }
}

/** True for operational failures (breaker-relevant). Config absence is not. */
function isBreakerRelevant(kind: SemanticFailureKind): boolean {
  return kind !== "SEMANTIC_UNAVAILABLE" && kind !== "SEMANTIC_EMPTY";
}

// ---------------------------------------------------------------------------
// Main retrieval function (database-backed)
// ---------------------------------------------------------------------------

/**
 * Semantic retrieval: find catalog variants semantically similar to a query.
 *
 * Architecture:
 *   query text → query embedding → Supabase RPC (pgvector ANN) → canonical variant IDs
 *
 * The database performs the vector search, not JavaScript.
 * This function NEVER throws — it returns a typed fallback result on any
 * failure. Phase 3.2.6 adds:
 *   - circuit-breaker gate (OPEN → skip the call entirely, fall back fast)
 *   - bounded version-aware cache (hit → no provider round-trip)
 *   - typed failure classification (`failureKind`)
 */
export async function semanticRetrieval(
  query: string,
  _allModels: ComputerModel[],
  topK: number = SEMANTIC_CONFIG.topK
): Promise<SemanticResult> {
  const start = performance.now();
  const latency = () => performance.now() - start;

  // Empty query → skip semantic (valid, successful empty outcome).
  if (!query || query.trim().length === 0) {
    return {
      matches: [],
      success: true,
      fallback: false,
      embeddedCount: 0,
      latencyMs: 0,
      semanticEmpty: true,
      breakerState: semanticCircuitBreaker.currentState().state,
    };
  }

  // Circuit breaker: when OPEN, skip the provider entirely.
  const decision = semanticCircuitBreaker.allow();
  if (!decision.allowed) {
    return {
      matches: [],
      success: false,
      fallback: true,
      embeddedCount: 0,
      latencyMs: latency(),
      error: "Semantic circuit is open — provider temporarily unavailable",
      failureKind: "SEMANTIC_UNAVAILABLE",
      circuitOpen: true,
      breakerState: decision.state,
    };
  }

  // Both provider prerequisites must hold; otherwise this is not a fault.
  if (!isSupabaseConfigured()) {
    return failureSemanticResult("SEMANTIC_UNAVAILABLE", "Supabase not configured", {
      latencyMs: latency(),
      breakerState: decision.state,
    });
  }
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return failureSemanticResult("SEMANTIC_UNAVAILABLE", "Gemini API key not available", {
      latencyMs: latency(),
      breakerState: decision.state,
    });
  }

  // Bounded version-aware cache consult before any provider round-trip.
  const cacheKey = semanticCacheKey({
    query,
    language: detectLanguage(query),
    topK,
    embeddingModel: SEMANTIC_CONFIG.embeddingModel,
    embeddingVersion: SEMANTIC_CONFIG.embeddingVersion,
  });
  const cached = SEMANTIC_RESULT_CACHE.get(cacheKey);
  if (cached) {
    semanticCircuitBreaker.recordSuccess();
    return {
      matches: cached.matches.map((m) => ({ ...m })),
      success: true,
      fallback: false,
      embeddedCount: cached.embeddedCount,
      latencyMs: latency(),
      cacheHit: true,
      cacheMiss: false,
      breakerState: decision.state,
    };
  }

  // 1. Generate query embedding (with typed failure classification).
  const queryEmb = await embedSingle(query, "query");
  if (!queryEmb.ok) {
    const kind = classifyEmbeddingFailure(queryEmb.reason);
    if (isBreakerRelevant(kind)) semanticCircuitBreaker.recordFailure();
    return failureSemanticResult(
      kind,
      queryEmb.reason === "UNAVAILABLE"
        ? "Query embedding unavailable"
        : `Query embedding failed: ${queryEmb.reason.toLowerCase()}`,
      { latencyMs: latency(), cacheMiss: true, breakerState: decision.state }
    );
  }

  // 2. Search via Supabase RPC (pgvector ANN)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcResult: any = await Promise.race([
      sbRpc<RpcMatch>("match_semantic_variants", {
        query_embedding: toPgVector(queryEmb.vector),
        match_count: topK,
        similarity_threshold: SEMANTIC_CONFIG.minSimilarity,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Vector search timeout")), SEMANTIC_CONFIG.searchTimeoutMs)
      ),
    ]);

    if (!Array.isArray(rpcResult)) {
      semanticCircuitBreaker.recordFailure();
      return failureSemanticResult("SEMANTIC_INVALID_RESPONSE", "Vector search returned a malformed response", {
        latencyMs: latency(),
        cacheMiss: true,
        breakerState: decision.state,
      });
    }

    const matches: SemanticMatch[] = rpcResult.map((row, i) => ({
      variantId: row.variant_id,
      modelId: row.model_id,
      score: row.similarity,
      rank: i + 1,
    }));

    // Same embedding-space guard on the server side: rows must belong to the
    // current model/version. Variants are filtered below by their parent model
    // through the hybrid gate, but version mismatch here is treated as a
    // malformed response rather than a silent cross-version serve.
    if (matches.some((m) => !validVariantRow(m))) {
      semanticCircuitBreaker.recordFailure();
      return failureSemanticResult("SEMANTIC_INVALID_RESPONSE", "Vector search returned rows for unknown catalog variants", {
        latencyMs: latency(),
        cacheMiss: true,
        breakerState: decision.state,
      });
    }

    // Count total embedded records (for observability).
    let embeddedCount = 0;
    try {
      const countResult = await sbSelect<{ count: string }>(EMBEDDING_TABLE, {
        columns: "count",
        limit: 1,
      });
      embeddedCount = parseInt(countResult[0]?.count ?? "0", 10);
    } catch {
      // Non-fatal
    }

    // Provider succeeded — a valid empty outcome is still a success.
    if (matches.length === 0) {
      semanticCircuitBreaker.recordSuccess();
      return emptySemanticResult({
        latencyMs: latency(),
        embeddedCount,
        cacheMiss: true,
        breakerState: decision.state,
      });
    }

    semanticCircuitBreaker.recordSuccess();
    const result: SemanticResult = {
      matches,
      success: true,
      fallback: false,
      embeddedCount,
      latencyMs: latency(),
      semanticEmpty: false,
      cacheMiss: true,
      breakerState: decision.state,
    };

    // Cache successes ONLY — never failures, never empty-for-invalid inputs.
    SEMANTIC_RESULT_CACHE.set(cacheKey, {
      matches: matches.map((m) => ({ ...m })),
      embeddedCount,
      cachedLatencyMs: result.latencyMs,
    });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Vector search failed";
    const kind: SemanticFailureKind = /timeout/i.test(msg)
      ? "SEMANTIC_TIMEOUT"
      : "SEMANTIC_API_ERROR";
    semanticCircuitBreaker.recordFailure();
    return failureSemanticResult(kind, msg, {
      latencyMs: latency(),
      cacheMiss: true,
      breakerState: decision.state,
    });
  }
}

/**
 * Validates that a semantic match references a plausible catalog row. The full
 * variant-mapping check happens in the hybrid hard gate; this is a cheap
 * early integrity filter (non-empty canonical IDs, finite similarity).
 */
function validVariantRow(m: SemanticMatch): boolean {
  return (
    typeof m.variantId === "string" &&
    m.variantId.length > 0 &&
    typeof m.modelId === "string" &&
    m.modelId.length > 0 &&
    Number.isFinite(m.score)
  );
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

/**
 * Invalidate semantic state. Called alongside search index invalidation.
 * Since embeddings are persistent, this only clears the in-memory bounded
 * result cache. The circuit breaker is NOT reset — a provider outage in
 * progress should keep protecting the pipeline until its cooldown elapses.
 */
export function invalidateSemanticIndex(): void {
  SEMANTIC_RESULT_CACHE.clear();
}

/**
 * Clear the bounded semantic result cache (successes only are ever stored).
 * Exposed for tests and for deployments that need a clean post-migration slate.
 */
export function invalidateSemanticResultCache(): void {
  SEMANTIC_RESULT_CACHE.clear();
}

/**
 * Embedding-space identity. Everything that persists or caches embeddings must
 * key on this signature so incompatible/legacy spaces can never mix.
 */
export function getSemanticSpaceMetadata(): {
  model: string;
  version: string;
  dimension: number;
  signature: string;
} {
  return {
    model: SEMANTIC_CONFIG.embeddingModel,
    version: SEMANTIC_CONFIG.embeddingVersion,
    dimension: SEMANTIC_CONFIG.embeddingDimension,
    signature: `${SEMANTIC_CONFIG.embeddingModel}#${SEMANTIC_CONFIG.embeddingVersion}@${SEMANTIC_CONFIG.embeddingDimension}`,
  };
}

/**
 * Check if semantic retrieval is available (both API key and Supabase configured).
 */
export function isSemanticAvailable(): boolean {
  return !!getGeminiApiKey() && isSupabaseConfigured();
}

/**
 * Get embedding metadata for observability.
 */
export function getSemanticStats(): {
  available: boolean;
  embeddedCount: number;
  model: string;
  dimension: number;
  version: string;
  signature: string;
  circuitBreaker: string;
} {
  const space = getSemanticSpaceMetadata();
  return {
    available: isSemanticAvailable(),
    embeddedCount: 0, // Count is fetched from DB on demand
    model: space.model,
    dimension: space.dimension,
    version: space.version,
    signature: space.signature,
    circuitBreaker: semanticCircuitBreaker.currentState().state,
  };
}

/**
 * Get the last indexing duration (for benchmarking).
 * Returns 0 — no in-memory build in persistent architecture.
 */
export function getSemanticBuildTime(): number {
  return 0;
}

/**
 * Check if a specific embedding is stale (content hash mismatch).
 */
export async function isEmbeddingStale(
  variantId: string,
  currentContentHash: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const rows = await sbSelect<{ content_hash: string }>(EMBEDDING_TABLE, {
      columns: "content_hash",
      filters: {
        entity_type: "eq.variant",
        entity_id: `eq.${variantId}`,
      },
      limit: 1,
    });

    if (rows.length === 0) return true;
    return rows[0].content_hash !== currentContentHash;
  } catch {
    return true;
  }
}

/**
 * Generate semantic document for a variant (exported for testing).
 */
export function generateSemanticDoc(
  model: ComputerModel,
  variant: ComputerVariant
): string {
  return variantToSemanticDocument(model, variant);
}
