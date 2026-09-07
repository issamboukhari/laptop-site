/**
 * Phase 3.2.5 — Ranking quality metrics.
 *
 * Binary-relevance metrics computed over ranked VARIANT id lists:
 *   Recall@K, Precision@K, MRR, NDCG@K (binary gains).
 * A HardConstraintViolationRate metric is implemented in runner.ts using an
 * independent re-derivation of the query's explicit requirements.
 */

export interface RankingMetrics {
  recall: Record<number, number>;
  precision: Record<number, number>;
  mrr: number;
  ndcg: Record<number, number>;
}

export const RECALL_K = [1, 3, 5, 10] as const;
export const PRECISION_K = [3, 5, 10] as const;
export const NDCG_K = [5] as const;

export function recallAt(
  ranked: string[],
  relevant: Set<string>,
  k: number
): number {
  if (relevant.size === 0) return 0;
  const top = ranked.slice(0, k);
  let hits = 0;
  const seen = new Set<string>();
  for (const id of top) {
    if (relevant.has(id) && !seen.has(id)) {
      hits++;
      seen.add(id);
    }
  }
  return hits / relevant.size;
}

export function precisionAt(
  ranked: string[],
  relevant: Set<string>,
  k: number
): number {
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  let hits = 0;
  for (const id of top) if (relevant.has(id)) hits++;
  return hits / k;
}

export function reciprocalRank(
  ranked: string[],
  relevant: Set<string>
): number {
  for (let i = 0; i < ranked.length; i++) {
    if (relevant.has(ranked[i])) return 1 / (i + 1);
  }
  return 0;
}

export function ndcgAt(
  ranked: string[],
  relevant: Set<string>,
  k: number
): number {
  const top = ranked.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < top.length; i++) {
    if (relevant.has(top[i])) dcg += 1 / Math.log2(i + 2);
  }
  const ideal = Math.min(k, relevant.size);
  let idcg = 0;
  for (let i = 0; i < ideal; i++) idcg += 1 / Math.log2(i + 2);
  return idcg > 0 ? dcg / idcg : 0;
}

export function evaluateRanking(
  ranked: string[],
  relevant: Set<string>
): RankingMetrics {
  const recall: Record<number, number> = {};
  for (const k of RECALL_K) recall[k] = recallAt(ranked, relevant, k);
  const precision: Record<number, number> = {};
  for (const k of PRECISION_K) precision[k] = precisionAt(ranked, relevant, k);
  const ndcg: Record<number, number> = {};
  for (const k of NDCG_K) ndcg[k] = ndcgAt(ranked, relevant, k);
  return {
    recall,
    precision,
    mrr: reciprocalRank(ranked, relevant),
    ndcg,
  };
}

export const EMPTY_METRICS: RankingMetrics = {
  recall: { 1: 0, 3: 0, 5: 0, 10: 0 },
  precision: { 3: 0, 5: 0, 10: 0 },
  mrr: 0,
  ndcg: { 5: 0 },
};

export function meanRankingMetrics(rows: RankingMetrics[]): RankingMetrics {
  if (rows.length === 0) return EMPTY_METRICS;
  const sum = (sel: (m: RankingMetrics) => Record<number, number>, ks: number[]) => {
    const acc: Record<number, number> = {};
    for (const k of ks) {
      acc[k] = rows.reduce((t, r) => t + sel(r)[k], 0) / rows.length;
    }
    return acc;
  };
  return {
    recall: sum((r) => r.recall, [...RECALL_K]),
    precision: sum((r) => r.precision, [...PRECISION_K]),
    mrr: rows.reduce((t, r) => t + r.mrr, 0) / rows.length,
    ndcg: sum((r) => r.ndcg, [...NDCG_K]),
  };
}