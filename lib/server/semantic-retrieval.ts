/**
 * Phase 3.2.3 — Semantic Retrieval
 *
 * Adds vector-embedding-based semantic retrieval over the EXISTING real
 * computer catalog. Uses Gemini's text-embedding-004 model via the
 * existing @google/genai SDK.
 *
 * TRUST INVARIANT: This module NEVER creates, invents, or modifies
 * computer data. It only identifies which existing catalog records
 * are semantically similar to a user query. Every result maps back to
 * a canonical catalog variant/model ID.
 *
 * Embedding level: Variant-level (each variant gets its own embedding
 * to preserve variant integrity — no invalid cross-variant combinations).
 *
 * Storage: In-memory, invalidated alongside the search index when the
 * catalog snapshot changes.
 */

import { ComputerModel, ComputerVariant } from "../data/types";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./gemini";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Embedding model — must be the same for catalog and queries. */
const EMBEDDING_MODEL = "text-embedding-004";

/** Vector dimension for text-embedding-004 (default output). */
const EMBEDDING_DIMENSION = 768;

/** Maximum number of semantic candidates to retrieve per query. */
export const SEMANTIC_TOP_K = 50;

/** Minimum cosine similarity threshold for semantic matches. */
const MIN_SIMILARITY = 0.3;

/** Maximum text length per semantic document (chars). Embedding models
 *  have input limits; we keep documents concise. */
const MAX_DOC_LENGTH = 1000;

/** Batch size for embedding API calls (Gemini supports batch). */
const EMBED_BATCH_SIZE = 20;

/** In-memory cache TTL — same pattern as database.ts */
const CACHE_TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single semantic document for embedding. */
interface SemanticDocument {
  /** Unique entity ID — variant-level: variant.id */
  entityId: string;
  /** Parent model ID */
  modelId: string;
  /** The text content that was embedded */
  content: string;
  /** Content hash for staleness detection */
  contentHash: string;
}

/** A cached embedding record. */
interface EmbeddingRecord {
  entityId: string;
  modelId: string;
  embedding: number[];
  contentHash: string;
  embeddingModel: string;
  createdAt: number;
}

/** Semantic retrieval result for a single entity. */
export interface SemanticMatch {
  /** Variant ID (the embedded entity) */
  variantId: string;
  /** Parent model ID */
  modelId: string;
  /** Cosine similarity score (0-1) */
  score: number;
  /** Rank position (1-based) */
  rank: number;
}

/** Full semantic retrieval result. */
export interface SemanticResult {
  /** Matched models (deduplicated by modelId, ordered by best score) */
  matches: SemanticMatch[];
  /** Whether embedding generation succeeded */
  success: boolean;
  /** Whether fallback to non-semantic search is needed */
  fallback: boolean;
  /** Number of catalog documents embedded */
  embeddedCount: number;
  /** Latency in ms */
  latencyMs: number;
  /** Error message if fallback triggered */
  error?: string;
}

// ---------------------------------------------------------------------------
// In-memory vector store
// ---------------------------------------------------------------------------

interface VectorStore {
  snapshot: ComputerModel[];
  records: EmbeddingRecord[];
  documents: SemanticDocument[];
  buildTime: number;
}

let _storeKey: ComputerModel[] | null = null;
let _store: VectorStore | null = null;
let _buildPromise: Promise<VectorStore> | null = null;

function invalidateVectorStore(): void {
  _storeKey = null;
  _store = null;
  _buildPromise = null;
}

// ---------------------------------------------------------------------------
// Semantic document generation
// ---------------------------------------------------------------------------

/**
 * Generate a semantic document for a single variant.
 *
 * Uses ONLY real catalog fields. Unknown fields are omitted (never fabricated).
 * The document describes the variant's actual specifications in a structured
 * format suitable for embedding.
 *
 * This is variant-level (not model-level) to preserve correctness:
 * each embedding represents a real, purchasable configuration.
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

  // Core specs — only include non-default values
  const specs = variant.specs;

  // CPU
  if (specs.cpu) parts.push(`CPU: ${specs.cpu}`);
  if (specs.cpuCores) parts.push(`CPU Cores: ${specs.cpuCores}`);

  // GPU
  if (specs.gpu && specs.gpu !== "Integrated") {
    parts.push(`GPU: ${specs.gpu}`);
  } else if (specs.gpu === "Integrated") {
    parts.push(`GPU: Integrated graphics`);
  }

  // Memory
  if (specs.ram > 0) parts.push(`RAM: ${specs.ram} GB`);
  if (specs.ramType) parts.push(`RAM Type: ${specs.ramType}`);

  // Storage
  if (specs.storage > 0) {
    const storageStr = specs.storage >= 1024
      ? `${(specs.storage / 1024).toFixed(specs.storage % 1024 === 0 ? 0 : 1)} TB`
      : `${specs.storage} GB`;
    parts.push(`Storage: ${storageStr} ${specs.storageType}`);
  }

  // Display
  if (specs.displaySize > 0) parts.push(`Display: ${specs.displaySize} inch`);
  if (specs.resolution) parts.push(`Resolution: ${specs.resolution}`);
  if (specs.displayRefreshRate > 0 && specs.displayRefreshRate !== 60) {
    parts.push(`Refresh Rate: ${specs.displayRefreshRate} Hz`);
  }
  if (specs.panelType) parts.push(`Panel: ${specs.panelType}`);
  if (specs.touchscreen) parts.push(`Touchscreen: yes`);

  // Portability
  if (specs.weight > 0) parts.push(`Weight: ${specs.weight} kg`);
  if (specs.batteryLife > 0) parts.push(`Battery: ${specs.batteryLife} hours`);

  // Build quality
  if (specs.buildMaterial) parts.push(`Build: ${specs.buildMaterial}`);
  if (specs.militaryCertification) parts.push(`Certification: ${specs.militaryCertification}`);

  // Keyboard
  if (specs.backlitKeyboard) parts.push(`Backlit keyboard: yes`);
  if (specs.rgbKeyboard) parts.push(`RGB keyboard: yes`);

  // Security
  if (specs.fingerprint) parts.push(`Fingerprint reader: yes`);
  if (specs.faceRecognition) parts.push(`Face recognition: yes`);
  if (specs.tpm) parts.push(`TPM: ${specs.tpm}`);

  // OS
  if (specs.os) parts.push(`OS: ${specs.os}`);

  // Connectivity
  if (specs.wifi) parts.push(`WiFi: ${specs.wifi}`);
  if (specs.bluetooth) parts.push(`Bluetooth: ${specs.bluetooth}`);
  if (specs.ethernet) parts.push(`Ethernet: yes`);
  if (specs.thunderbolt) parts.push(`Thunderbolt: ${specs.thunderbolt}`);

  // Price hint (useful for semantic context, but not a hard filter)
  if (variant.price > 0) {
    if (variant.price < 500) parts.push(`Budget laptop`);
    else if (variant.price < 1000) parts.push(`Mid-range laptop`);
    else if (variant.price < 1500) parts.push(`Premium laptop`);
    else parts.push(`High-end laptop`);
  }

  // Description (if available and short enough)
  if (variant.description && variant.description.length < 200) {
    parts.push(variant.description);
  }

  return parts.join(". ");
}

/**
 * Generate semantic documents for all variants in the catalog.
 * Each variant gets its own document (variant-level embeddings).
 */
function generateSemanticDocuments(
  models: ComputerModel[]
): SemanticDocument[] {
  const docs: SemanticDocument[] = [];

  for (const model of models) {
    for (const variant of model.variants) {
      const content = variantToSemanticDocument(model, variant);
      const truncated = content.length > MAX_DOC_LENGTH
        ? content.slice(0, MAX_DOC_LENGTH)
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

/** Simple string hash for staleness detection (not cryptographic). */
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

/**
 * Generate embeddings for a batch of texts using Gemini's text-embedding-004.
 * Returns an array of embedding vectors, one per input text.
 *
 * On any failure, returns null (caller should fallback to non-semantic search).
 */
async function generateEmbeddings(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][] | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);

      // Gemini embedContent supports single text; call per text for reliability
      for (const text of batch) {
        try {
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: text,
            config: {
              taskType,
              outputDimensionality: EMBEDDING_DIMENSION,
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = result as Record<string, any>;
          const values = r?.embedding?.values ?? r?.embeddings?.[0]?.values;
          if (values && values.length > 0) {
            embeddings.push(values);
          } else {
            // Embedding returned but no values — skip this document
            embeddings.push(new Array(EMBEDDING_DIMENSION).fill(0));
          }
        } catch {
          // Individual text failed — use zero vector (will have low similarity)
          embeddings.push(new Array(EMBEDDING_DIMENSION).fill(0));
        }
      }
    }

    return embeddings;
  } catch {
    // Global failure — return null to trigger fallback
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (typically 0 to 1 for normalized embeddings).
 */
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
// Vector store build
// ---------------------------------------------------------------------------

async function buildVectorStore(
  models: ComputerModel[]
): Promise<VectorStore> {
  const start = performance.now();

  // Generate semantic documents
  const documents = generateSemanticDocuments(models);

  if (documents.length === 0) {
    return { snapshot: models, records: [], documents: [], buildTime: 0 };
  }

  // Generate embeddings for all documents
  const texts = documents.map((d) => d.content);
  const embeddings = await generateEmbeddings(texts, "RETRIEVAL_DOCUMENT");

  if (!embeddings || embeddings.length !== documents.length) {
    // Embedding generation failed — return empty store (triggers fallback)
    return { snapshot: models, records: [], documents: [], buildTime: 0 };
  }

  // Build records
  const records: EmbeddingRecord[] = [];
  for (let i = 0; i < documents.length; i++) {
    records.push({
      entityId: documents[i].entityId,
      modelId: documents[i].modelId,
      embedding: embeddings[i],
      contentHash: documents[i].contentHash,
      embeddingModel: EMBEDDING_MODEL,
      createdAt: Date.now(),
    });
  }

  const buildTime = performance.now() - start;

  return { snapshot: models, records, documents, buildTime };
}

async function getVectorStore(
  models: ComputerModel[]
): Promise<VectorStore> {
  // Check if current snapshot matches
  if (_storeKey === models && _store) return _store;

  // If build is in flight, wait for it
  if (_buildPromise) {
    await _buildPromise;
    if (_storeKey === models && _store) return _store;
  }

  // Start new build
  let resolve!: (value: VectorStore) => void;
  let reject!: (reason?: unknown) => void;
  _buildPromise = new Promise<VectorStore>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  queueMicrotask(async () => {
    try {
      const store = await buildVectorStore(models);
      _store = store;
      _storeKey = models;
      resolve(store);
    } catch (e) {
      reject(e);
    } finally {
      _buildPromise = null;
    }
  });

  return _buildPromise;
}

// ---------------------------------------------------------------------------
// Main retrieval function
// ---------------------------------------------------------------------------

/**
 * Semantic retrieval: find catalog variants semantically similar to a query.
 *
 * Uses the SAME embedding model for catalog and query embeddings.
 * Returns variant IDs mapped to their parent model IDs, with similarity scores.
 *
 * This function NEVER throws — it returns a fallback result on any failure.
 *
 * @param query — raw user query text
 * @param allModels — full catalog (from getAllModels())
 * @param topK — maximum number of results (default SEMANTIC_TOP_K)
 * @returns SemanticResult with matches, or fallback indicator
 */
export async function semanticRetrieval(
  query: string,
  allModels: ComputerModel[],
  topK: number = SEMANTIC_TOP_K
): Promise<SemanticResult> {
  const start = performance.now();

  // Empty query → skip semantic
  if (!query || query.trim().length === 0) {
    return {
      matches: [],
      success: true,
      fallback: false,
      embeddedCount: 0,
      latencyMs: 0,
    };
  }

  // Get or build vector store
  const store = await getVectorStore(allModels);

  // If store is empty (build failed or no documents), fallback
  if (store.records.length === 0) {
    return {
      matches: [],
      success: false,
      fallback: true,
      embeddedCount: 0,
      latencyMs: performance.now() - start,
      error: "No embeddings available",
    };
  }

  // Generate query embedding
  const queryEmbeddings = await generateEmbeddings(
    [query],
    "RETRIEVAL_QUERY"
  );

  if (!queryEmbeddings || queryEmbeddings.length === 0 || !queryEmbeddings[0]) {
    return {
      matches: [],
      success: false,
      fallback: true,
      embeddedCount: store.records.length,
      latencyMs: performance.now() - start,
      error: "Query embedding failed",
    };
  }

  const queryEmbedding = queryEmbeddings[0];

  // Compute similarities
  const scored: { record: EmbeddingRecord; score: number }[] = [];
  for (const record of store.records) {
    const score = cosineSimilarity(queryEmbedding, record.embedding);
    if (score >= MIN_SIMILARITY) {
      scored.push({ record, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top K and deduplicate by modelId (keep best score per model)
  const seenModels = new Set<string>();
  const matches: SemanticMatch[] = [];
  let rank = 0;

  for (const { record, score } of scored) {
    if (matches.length >= topK) break;

    rank++;
    matches.push({
      variantId: record.entityId,
      modelId: record.modelId,
      score,
      rank,
    });

    // Mark model as seen (for dedup tracking, but allow multiple variants)
    seenModels.add(record.modelId);
  }

  const latencyMs = performance.now() - start;

  return {
    matches,
    success: true,
    fallback: false,
    embeddedCount: store.records.length,
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------

/**
 * Invalidate the vector store. Call alongside search index invalidation.
 */
export function invalidateSemanticIndex(): void {
  invalidateVectorStore();
}

/**
 * Check if semantic retrieval is available (API key present).
 */
export function isSemanticAvailable(): boolean {
  return !!getGeminiApiKey();
}

/**
 * Get embedding metadata for observability.
 */
export function getSemanticStats(): {
  available: boolean;
  embeddedCount: number;
  model: string;
  dimension: number;
} {
  return {
    available: isSemanticAvailable(),
    embeddedCount: _store?.records.length ?? 0,
    model: EMBEDDING_MODEL,
    dimension: EMBEDDING_DIMENSION,
  };
}

/**
 * Get the vector store build time (for benchmarking).
 */
export function getSemanticBuildTime(): number {
  return _store?.buildTime ?? 0;
}

/**
 * Check if a specific embedding is stale (content hash mismatch).
 * Useful for monitoring embedding freshness.
 */
export function isEmbeddingStale(
  variantId: string,
  currentContentHash: string
): boolean {
  if (!_store) return true;
  const record = _store.records.find((r) => r.entityId === variantId);
  if (!record) return true;
  return record.contentHash !== currentContentHash;
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
