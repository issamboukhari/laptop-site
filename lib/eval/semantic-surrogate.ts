import type { ComputerModel } from "../data/types";
import { generateSemanticDoc, SEMANTIC_TOP_K, type SemanticResult } from "../server/semantic-retrieval";

/**
 * Phase 3.2.5 — Deterministic semantic RETRIEVAL SURROGATE.
 *
 * OFFLINE calibration stand-in ONLY. Production search NEVER imports this
 * module: production keeps calling the real embedding pipeline
 * (semantic-retrieval.ts). This surrogate lets the calibration runner and
 * tests measure RRF fusion behavior deterministically without any network,
 * API key, or persisted embeddings.
 *
 * Matching is token overlap between the query and the EXACT semantic document
 * text production embeds (generateSemanticDoc), so the surrogate speaks the
 * same "vocabulary" as the live embeddings. English-only: pure-Arabic queries
 * produce no matches (their docs are English). Latin model/spec tokens embedded
 * in Arabic queries (e.g. "RTX 4060") still match. Fully deterministic: ties
 * are broken by score desc, then variantId asc, then modelId asc.
 */

const MISSING = Symbol("missing");

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s.+-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function surrogateSemanticRetrieval(
  query: string,
  allModels: ComputerModel[]
): SemanticResult {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) {
    return { matches: [], success: true, fallback: true, embeddedCount: 0, latencyMs: 0 };
  }

  const scored: { variantId: string; modelId: string; score: number }[] = [];

  for (const model of allModels) {
    for (const variant of model.variants) {
      const doc = generateSemanticDoc(model, variant);
      const docTokens = new Set(tokenize(doc));

      let common = 0;
      let effTokens = 0;
      for (const t of qTokens) {
        // Skip pure numbers unless present verbatim in the doc (docs contain
        // "16", "1tb", "14 inch" tokens) — keeps RAM/storage/screen intent.
        if (/^\d+([.]\d+)?$/.test(t) && !docTokens.has(t)) continue;
        effTokens++;
        if (docTokens.has(t)) common++;
      }
      if (effTokens === 0) continue;

      let score = common / effTokens;
      if (score <= 0) continue;
      // Soft length penalty — longer docs get slightly diluted, mirroring the
      // specificity of embeddings over generic text.
      score = score / (1 + Math.log1p(docTokens.size) / 6);

      scored.push({ variantId: variant.id, modelId: model.id, score });
    }
  }

  const best = new Map<string, typeof scored[number]>();
  for (const s of scored) {
    const prev = best.get(s.variantId) ?? MISSING;
    if (prev === MISSING || s.score > prev.score) best.set(s.variantId, s);
  }

  const ranked = [...best.values()]
    .sort((a, b) => b.score - a.score || a.variantId.localeCompare(b.variantId) || a.modelId.localeCompare(b.modelId))
    .slice(0, SEMANTIC_TOP_K);

  return {
    matches: ranked.map((m, i) => ({
      variantId: m.variantId,
      modelId: m.modelId,
      score: m.score,
      rank: i + 1,
    })),
    success: true,
    fallback: true,
    embeddedCount: ranked.length,
    latencyMs: 0,
  };
}

export type SemanticSource = (
  query: string,
  allModels: ComputerModel[]
) => SemanticResult;

export const SURROGATE_SEMANTIC_SOURCE: SemanticSource =
  surrogateSemanticRetrieval;