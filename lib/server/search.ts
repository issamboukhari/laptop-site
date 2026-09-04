import {
  ComputerModel,
  SearchFilters,
  FilterFacets,
  SearchResult,
  AutocompleteResult,
} from "../data/types";
import {
  getAllModels,
  getFilterFacets,
  queryModels,
} from "./database";
import { modelMatchesFilters } from "./variant-matcher";

// ---------------------------------------------------------------------------
// Query normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw user query:
 * - lowercase
 * - trim + collapse all whitespace runs (fixes "hp ", " hp  ", etc.)
 * - strip punctuation (keeps word/number characters, . + -)
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s.+-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeNormalized(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}

/** Synonyms expanded as low-weight bonus tokens. Keys are normalized. */
const ALIASES: Record<string, string[]> = {
  thinkpad: ["lenovo"],
  mac: ["apple", "macbook"],
  macbook: ["apple"],
  mbp: ["macbook", "pro"],
  mba: ["macbook", "air"],
  hp: ["hewlett", "packard"],
  hewlett: ["hp"],
  think: ["thinkpad"],
  legion: ["lenovo"],
  ideapad: ["lenovo"],
  yoga: ["lenovo"],
  rog: ["asus"],
  strix: ["asus", "rog"],
  zephyrus: ["asus", "rog"],
  tuf: ["asus"],
  alienware: ["dell"],
  xps: ["dell"],
  inspiron: ["dell"],
  latitude: ["dell"],
  precision: ["dell"],
  probook: ["hp"],
  elitebook: ["hp"],
  pavilion: ["hp"],
  spectre: ["hp"],
  envy: ["hp"],
  omen: ["hp"],
  vivobook: ["asus"],
  zenbook: ["asus"],
  nitro: ["acer"],
  predator: ["acer"],
  swift: ["acer"],
  aspire: ["acer"],
  surface: ["microsoft"],
  chromebook: ["chrome os"],
};

function expandAliases(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) out.add(t);
  for (const t of tokens) {
    const targets = ALIASES[t];
    if (targets) for (const x of targets) out.add(x);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Generation-aware matching
// ---------------------------------------------------------------------------

/**
 * Extract explicit generation tokens from normalized query tokens.
 * Recognizes: "g10", "gen10", "gen 10", "generation 11" → canonical "g10".
 * Returns [] when the query carries no generation suffix.
 */
function extractGenTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let m = t.match(/^g(\d{1,3})$/);
    if (m) {
      out.push(`g${m[1]}`);
      continue;
    }
    m = t.match(/^gen(\d{1,3})$/);
    if (m) {
      out.push(`g${m[1]}`);
      continue;
    }
    // Apple-silicon generations: "m3", "m4", also glued "m3pro"/"m2max".
    m = t.match(/^m([1-4])(?:pro|max|ultra)?$/);
    if (m) {
      out.push(`m${m[1]}`);
      continue;
    }
    if ((t === "gen" || t === "generation") && i + 1 < tokens.length) {
      const nm = tokens[i + 1].match(/^(\d{1,3})$/);
      if (nm) out.push(`g${nm[1]}`);
    }
  }
  return [...new Set(out)];
}

/** True when this indexed model carries the exact generation token ("g11"). */
function modelHasGenToken(m: IndexedModel, genTok: string): boolean {
  // Stored generation field: "G10"/"Gen 11"/"g10" all normalize to "g10".
  const genNorm = (m.generation || "").replace(/[^a-z0-9]/g, "");
  if (genNorm === genTok || genNorm === `generation${genTok.slice(1)}`) return true;
  // Some families embed the suffix in the model name itself ("ROG Strix G16").
  if (m.nameWords.some((w) => w === genTok)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Multi-criteria hardware search (GPU / RAM / CPU / storage)
//
// Detects hardware requirements inside a free-text query and enforces them as
// HARD filters against structured spec data — the in-memory equivalent of a
// Supabase ILIKE multi-column RPC, applied to the merged cached catalog so
// local + cloud rows behave identically with zero extra roundtrips.
//   "rtx 3060 16gb"     → GPU must contain "rtx 3060" AND some variant 16GB
//   "i7 32gb"           → CPU i7-family AND 32GB RAM
//   "iris xe"           → integrated Intel GPU
// ---------------------------------------------------------------------------

interface SpecCriteria {
  /** Substrings required inside some variant's lowercased GPU string ("rtx 4060"). */
  gpuTerms: string[];
  /** De-punctuated substrings required inside some variant's CPU string ("i713550h", "ryzen7"). */
  cpuTerms: string[];
  /** RAM capacities (GB) — at least one variant must carry one of these. */
  ramSizes: number[];
  /** Storage capacities (GB) — at least one variant must carry one of these. */
  storageSizes: number[];
  /** Indexes into the token array consumed as criteria (excluded from fuzzy ranking). */
  tokenIndexes: number[];
  /** Original normalized fragments for client-side highlighting. */
  displayTerms: string[];
}

function emptyCriteria(): SpecCriteria {
  return { gpuTerms: [], cpuTerms: [], ramSizes: [], storageSizes: [], tokenIndexes: [], displayTerms: [] };
}

function hasSpecCriteria(c: SpecCriteria): boolean {
  return c.gpuTerms.length > 0 || c.cpuTerms.length > 0 || c.ramSizes.length > 0 || c.storageSizes.length > 0;
}

/** Parse hardware criteria out of normalized query tokens (with bigram lookahead). */
export function extractSpecCriteria(tokens: string[]): SpecCriteria {
  const c = emptyCriteria();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1] ?? "";

    // ---- Capacity tokens: "16gb", "16g", "1tb", or "16 gb" bigram ----
    let m = t.match(/^(\d{1,4})(gb|g|tb)$/);
    let unit = m?.[2];
    let numStr = m?.[1];
    if (!m && /^\d{1,4}$/.test(t) && /^(gb|g|tb)$/.test(next)) {
      numStr = t;
      unit = next;
    }
    if (numStr && unit) {
      const value = parseInt(numStr, 10) * (unit === "tb" ? 1024 : 1);
      if (value >= 1 && value <= 8192) {
        // ≤64 reads as memory ("16gb"); larger reads as disk ("512gb", "1tb").
        if (value <= 64) c.ramSizes.push(value);
        else c.storageSizes.push(value);
        c.tokenIndexes.push(i);
        if (unit !== undefined && !m) c.tokenIndexes.push(i + 1);
        c.displayTerms.push(`${numStr}${unit}`);
      }
      continue;
    }

    // ---- NVIDIA/AMD/Intel mobile GPUs with model number: "rtx 4060", "gtx1650" ----
    m = t.match(/^(rtx|gtx|mx|rx)$/);
    if (m && /^\d{3,5}[a-z]?i?$/.test(next)) {
      c.gpuTerms.push(`${m[1]} ${next}`);
      c.tokenIndexes.push(i, i + 1);
      c.displayTerms.push(`${m[1]} ${next}`);
      continue;
    }
    m = t.match(/^(rtx|gtx)(\d{3,5})$/);
    if (m) {
      c.gpuTerms.push(`${m[1]} ${m[2]}`);
      c.tokenIndexes.push(i);
      c.displayTerms.push(`${m[1]}${m[2]}`);
      continue;
    }

    // ---- GPU family keywords ----
    if (/^(iris|geforce|radeon|quadro)$/.test(t)) {
      if (t === "iris" && next === "xe") {
        c.gpuTerms.push("iris xe");
        c.tokenIndexes.push(i, i + 1);
        c.displayTerms.push("iris xe");
        i++;
      } else {
        c.gpuTerms.push(t);
        c.tokenIndexes.push(i);
        c.displayTerms.push(t);
      }
      continue;
    }

    // ---- Intel Core with model number: "i7-13500h", "i7 13500h", "i713500h" ----
    m = t.match(/^i([3579])$/);
    if (m && /^\d{4,5}[a-z]{0,3}$/i.test(next)) {
      c.cpuTerms.push(`i${m[1]}${next.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
      c.tokenIndexes.push(i, i + 1);
      c.displayTerms.push(`i${m[1]}-${next.toLowerCase()}`);
      continue;
    }
    m = t.match(/^i([3579])(\d{4,5}[a-z]{0,3})$/i);
    if (m) {
      c.cpuTerms.push(`i${m[1]}${m[2].toLowerCase()}`);
      c.tokenIndexes.push(i);
      c.displayTerms.push(t);
      continue;
    }

    // ---- AMD Ryzen: "ryzen 7", "ryzen7", bare "ryzen" ----
    if (/^ryzen$/.test(t)) {
      if (/^[3579]$/.test(next)) {
        c.cpuTerms.push(`ryzen${next}`);
        c.tokenIndexes.push(i, i + 1);
        c.displayTerms.push(`ryzen ${next}`);
        i++;
      } else if (/^\d{4}[a-z]{0,3}$/i.test(next)) {
        c.cpuTerms.push(`ryzen${next.toLowerCase()}`);
        c.tokenIndexes.push(i, i + 1);
        c.displayTerms.push(`ryzen ${next}`);
        i++;
      } else {
        c.cpuTerms.push("ryzen");
        c.tokenIndexes.push(i);
        c.displayTerms.push("ryzen");
      }
      continue;
    }
    m = t.match(/^ryzen([3579])$/);
    if (m) {
      c.cpuTerms.push(`ryzen${m[1]}`);
      c.tokenIndexes.push(i);
      c.displayTerms.push(t);
      continue;
    }

    // ---- Intel Core Ultra: "ultra 9", "ultra7" ----
    if (/^ultra$/.test(t) && /^[579]$/.test(next)) {
      c.cpuTerms.push(`ultra ${next}`);
      c.tokenIndexes.push(i, i + 1);
      c.displayTerms.push(`ultra ${next}`);
      i++;
      continue;
    }
    m = t.match(/^ultra([579])$/);
    if (m) {
      c.cpuTerms.push(`ultra ${m[1]}`);
      c.tokenIndexes.push(i);
      c.displayTerms.push(t);
      continue;
    }

    // ---- Other platform keywords ----
    if (/^(snapdragon|celeron|pentium)$/.test(t)) {
      c.cpuTerms.push(t);
      c.tokenIndexes.push(i);
      c.displayTerms.push(t);
      continue;
    }
    if (t === "apple" || t === "m1" || t === "m2" || t === "m3" || t === "m4") {
      // Apple silicon doubles as generation — handled by extractGenTokens too.
      c.cpuTerms.push(t);
      c.tokenIndexes.push(i);
      c.displayTerms.push(t);
      continue;
    }
  }

  return c;
}

/**
 * HARD AND-match of every criterion against ONE variant's actual specs.
 * Comparison is punctuation-insensitive on both sides so "i7-13500h",
 * "i7 13500h" and "i713500h" all find "Intel Core i7-13500H".
 */
function variantMatchesCriteria(
  specs: { cpu: string; gpu: string; ram: number; storage: number },
  c: SpecCriteria
): boolean {
  const cpuHay = specs.cpu.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const g of c.gpuTerms) {
    if (!specs.gpu.toLowerCase().includes(g)) return false;
  }
  for (const cpuNeedle of c.cpuTerms) {
    const n = cpuNeedle.replace(/[^a-z0-9]/g, "");
    if (!n || !cpuHay.includes(n)) return false;
  }
  if (c.ramSizes.length > 0 && !c.ramSizes.some((r) => r === specs.ram)) return false;
  if (c.storageSizes.length > 0 && !c.storageSizes.some((s) => s === specs.storage)) return false;
  return true;
}

/**
 * Criteria pass/fail for a MODEL: at least one purchasable configuration must
 * satisfy EVERY criterion together (an RTX 4060 model with a 16GB config —
 * not a 4060/8GB variant plus a separate 16GB/UHD variant).
 * Returns 0 when failing; otherwise a quality score favoring models whose
 * primary configuration matches and which carry many matching configs.
 */
function specCriteriaScore(m: IndexedModel, c: SpecCriteria): number {
  let matching = 0;
  let primaryMatch = 0;
  m.model.variants.forEach((v, idx) => {
    if (!variantMatchesCriteria(v.specs, c)) return;
    matching++;
    if (idx === 0) primaryMatch = 1;
  });
  if (matching === 0 || m.model.variants.length === 0) return 0;
  const ratio = matching / m.model.variants.length;
  return Math.round(20 + ratio * 40 + primaryMatch * 25);
}

// ---------------------------------------------------------------------------
// Fuzzy matching (bounded Levenshtein)
// ---------------------------------------------------------------------------

/** Early-exit Levenshtein distance with a max-distance cutoff. */
function levenshteinWithin(a: string, b: string, maxDist: number): number {
  if (a === b) return 0;
  const alen = a.length;
  const blen = b.length;
  if (Math.abs(alen - blen) > maxDist) return maxDist + 1;

  let prev = new Array<number>(blen + 1);
  let curr = new Array<number>(blen + 1);
  for (let j = 0; j <= blen; j++) prev[j] = j;

  for (let i = 1; i <= alen; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= blen; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[blen];
}

function fuzzyMaxDistance(tokenLength: number): number {
  // Short tokens must match nearly exactly; longer tokens allow more slack.
  if (tokenLength <= 3) return 0;
  if (tokenLength <= 5) return 1;
  if (tokenLength <= 8) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Search index (built once per database snapshot)
// ---------------------------------------------------------------------------

interface IndexedModel {
  model: ComputerModel;
  id: string;
  name: string; // lowercased
  nameWords: string[];
  brand: string; // lowercased
  family: string; // lowercased
  generation: string; // lowercased
  category: string; // lowercased
  year: number;
  variantNames: string[];
  variantText: string; // joined variant/configuration names
  cpuGpuOs: string; // aggregated spec text
  description: string; // aggregated variant descriptions
  searchText: string; // everything, single-spaced
  despacedText: string; // searchText without spaces ("hpelitebook845g11")
  words: Set<string>; // vocabulary of standalone words across key fields
  // Structured spec fields for multi-criteria hardware search.
  cpuText: string; // joined lowercased CPU strings
  cpuDespaced: string; // cpuText without spaces/punctuation ("i5-13500h"→"i513500h")
  gpuText: string; // joined lowercased GPU strings
  rams: Set<number>; // every variant RAM size (GB)
  storages: Set<number>; // every variant storage size (GB)
}

let _indexKey: ComputerModel[] | null = null;
let _index: IndexedModel[] = [];
let _buildPromise: Promise<IndexedModel[]> | null = null;

/**
 * Explicitly invalidate the search index.  Call this when the catalog is
 * known to have changed (e.g. after database.invalidateCache()) so the next
 * search triggers a fresh build instead of serving stale results.
 *
 * This is optional — getIndex() will detect a new catalog snapshot via
 * reference equality even without calling this.  However, calling this
 * immediately frees the old index memory and guarantees no stale lookups
 * can slip through during the rebuild window.
 */
export function invalidateSearchIndex(): void {
  _indexKey = null;
  _index = [];
  _buildPromise = null;
}

function buildIndex(models: ComputerModel[]): IndexedModel[] {
  return models.map((m) => {
    const name = m.name.toLowerCase();
    const brand = m.brand.toLowerCase();
    const family = (m.family || "").toLowerCase();
    const generation = (m.generation || "").toLowerCase();
    const category = m.category.toLowerCase().replace(/-/g, " ");
    const variantNames: string[] = [];
    const cpuParts: string[] = [];
    const gpuParts: string[] = [];
    const osParts: string[] = [];
    const descParts: string[] = [];

    for (const v of m.variants) {
      variantNames.push(v.name.toLowerCase());
      cpuParts.push(v.specs.cpu?.toLowerCase() ?? "");
      gpuParts.push(v.specs.gpu?.toLowerCase() ?? "");
      if (v.specs.os) osParts.push(v.specs.os.toLowerCase());
      descParts.push(v.description?.toLowerCase() ?? "");
    }

    const searchText = [
      name,
      brand,
      family,
      generation,
      category,
      String(m.year),
      ...variantNames,
      ...cpuParts,
      ...gpuParts,
      ...osParts,
      ...descParts,
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const words = new Set<string>();
    for (const w of name.split(" ")) if (w) words.add(w);
    for (const w of brand.split(" ")) if (w) words.add(w);
    for (const w of family.split(" ")) if (w) words.add(w);
    for (const w of generation.split(" ")) if (w) words.add(w);
    for (const vn of variantNames) for (const w of vn.split(" ")) if (w) words.add(w);

    const rams = new Set<number>();
    const storages = new Set<number>();
    for (const v of m.variants) {
      if (Number.isFinite(v.specs.ram) && v.specs.ram > 0) rams.add(v.specs.ram);
      if (Number.isFinite(v.specs.storage) && v.specs.storage > 0) storages.add(v.specs.storage);
    }
    const cpuText = cpuParts.join(" ");
    const gpuText = gpuParts.join(" ");

    return {
      model: m,
      id: m.id,
      name,
      nameWords: name.split(" ").filter(Boolean),
      brand,
      family,
      generation,
      category,
      year: m.year,
      variantNames,
      variantText: variantNames.join(" "),
      cpuGpuOs: [...cpuParts, ...gpuParts, ...osParts].join(" "),
      description: descParts.join(" "),
      searchText,
      despacedText: searchText.replace(/\s+/g, ""),
      words,
      cpuText,
      cpuDespaced: cpuText.replace(/[^a-z0-9]/g, ""),
      gpuText,
      rams,
      storages,
    };
  });
}

async function getIndex(): Promise<IndexedModel[]> {
  const models = await getAllModels();
  if (_indexKey === models) return _index;

  // If a build is already in flight for any snapshot, wait for it then
  // re-check — the snapshot may have changed again while we waited.
  if (_buildPromise) {
    await _buildPromise;
    if (_indexKey === models) return _index;
  }

  // Store the promise BEFORE starting work so concurrent callers see it
  // and wait instead of spawning a duplicate build.
  let resolve!: (value: IndexedModel[]) => void;
  let reject!: (reason?: unknown) => void;
  _buildPromise = new Promise<IndexedModel[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  queueMicrotask(async () => {
    try {
      const idx = buildIndex(models);
      _index = idx;
      _indexKey = models;
      resolve(idx);
    } catch (e) {
      // On failure: _indexKey is NOT set, so next call will retry.
      reject(e);
    } finally {
      _buildPromise = null;
    }
  });

  return _buildPromise;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Field weights — how strong a hit in each field is. */
const FIELD_WEIGHTS = {
  name: 3,
  family: 2.4,
  brand: 2.2,
  generation: 1.6,
  specs: 1.5,
  category: 1.2,
  description: 0.6,
} as const;

/** Match quality tiers inside a field string. */
function tokenFieldScore(token: string, field: string): number {
  if (!field) return 0;
  if (field === token) return 100;
  const spaceIdx = field.indexOf(" ");
  if (spaceIdx === -1) {
    // Single-word field.
    if (field.startsWith(token)) return 70;
    if (field.includes(token)) return 45;
    return 0;
  }
  let exact = false;
  let prefix = false;
  let start = 0;
  while (start <= field.length) {
    let end = field.indexOf(" ", start);
    if (end === -1) end = field.length;
    if (end > start) {
      const w = end - start === token.length ? field.startsWith(token, start) : false;
      if (w) {
        exact = true;
        break;
      }
      if (!prefix && field.startsWith(token, start)) prefix = true;
    }
    start = end + 1;
    if (start > field.length) break;
  }
  if (exact) return 60;
  if (prefix) return 42;
  if (field.includes(token)) return 24;
  return 0;
}

/** Best score for one query token against one indexed model (non-fuzzy). */
function matchToken(tok: string, m: IndexedModel): number {
  let best = 0;
  let s: number;

  s = tokenFieldScore(tok, m.name) * FIELD_WEIGHTS.name;
  if (s > best) best = s;

  if (m.family) {
    s = tokenFieldScore(tok, m.family) * FIELD_WEIGHTS.family;
    if (s > best) best = s;
  }

  s = tokenFieldScore(tok, m.brand) * FIELD_WEIGHTS.brand;
  if (s > best) best = s;

  if (m.generation) {
    s = tokenFieldScore(tok, m.generation) * FIELD_WEIGHTS.generation;
    if (s > best) best = s;
  }

  // Exact configuration names carry near-name weight ("845" in
  // "EliteBook 845 G11 (i7-1165G7)").
  s = tokenFieldScore(tok, m.variantText) * FIELD_WEIGHTS.family;
  if (s > best) best = s;

  s = tokenFieldScore(tok, m.cpuGpuOs) * FIELD_WEIGHTS.specs;
  if (s > best) best = s;

  s = tokenFieldScore(tok, m.category) * FIELD_WEIGHTS.category;
  if (s > best) best = s;

  if (best === 0) {
    s = tokenFieldScore(tok, m.description) * FIELD_WEIGHTS.description;
    if (s > best) best = s;
  }

  return best;
}

/** Fuzzy score for one token: closest vocabulary word within edit budget. */
function fuzzyTokenScore(
  tok: string,
  vocabularies: { words: Set<string>; weight: number }[]
): number {
  const maxDist = fuzzyMaxDistance(tok.length);
  if (maxDist === 0) return 0;
  let best = 0;
  for (const { words, weight } of vocabularies) {
    for (const w of words) {
      if (Math.abs(w.length - tok.length) > maxDist) continue;
      const d = levenshteinWithin(tok, w, maxDist);
      if (d <= maxDist) {
        const score = Math.max(8, 34 - d * 9) * weight;
        if (score > best) best = score;
      }
    }
  }
  return best;
}

interface RankedMatch {
  entry: IndexedModel;
  score: number;
  usedFuzzy: boolean;
}

/** Per-model, per-token match detail computed in one pass. */
interface ScoredModel {
  entry: IndexedModel;
  direct: number[]; // strict score per query token
  fuzzy: number[]; // fuzzy score per query token (0 when not applicable)
  totalDirect: number;
  totalAny: number;
}

function scoreCorpus(
  index: IndexedModel[],
  tokens: string[]
): { scored: ScoredModel[]; tokenHasDirect: boolean[] } {
  const scored: ScoredModel[] = [];
  const tokenHasDirect = tokens.map(() => false);

  for (const m of index) {
    const direct = tokens.map((t) => matchToken(t, m));
    const fuzzy = tokens.map((t, i) =>
      direct[i] > 0 ? 0 : fuzzyTokenScore(t, [{ words: m.words, weight: 1 }])
    );
    const totalDirect = direct.reduce((a, b) => a + b, 0);
    const totalAny = direct.reduce((a, b, i) => a + b + fuzzy[i], 0);
    for (let i = 0; i < tokens.length; i++) {
      if (direct[i] > 0) tokenHasDirect[i] = true;
    }
    scored.push({ entry: m, direct, fuzzy, totalDirect, totalAny });
  }

  return { scored, tokenHasDirect };
}

function sortScored(scored: ScoredModel[]): ScoredModel[] {
  const idx = scored.map((_, i) => i);
  idx.sort((ai, bi) => {
    const a = scored[ai];
    const b = scored[bi];
    return (
      b.totalAny - a.totalAny ||
      b.entry.year - a.entry.year ||
      a.entry.name.localeCompare(b.entry.name)
    );
  });
  return idx.map((i) => scored[i]);
}

function applyAliasBonus(scored: ScoredModel[], aliasTokens: string[], tokens: string[]): void {
  for (const s of scored) {
    let bonus = 0;
    for (const at of aliasTokens) {
      if (tokens.includes(at)) continue;
      if (s.entry.searchText.includes(at)) bonus += 2;
    }
    s.totalAny += bonus;
    s.totalDirect += bonus / 2;
  }
}

/** De-spaced full-query hits (missing-space tolerance). Returns matching ids. */
function despaceMatches(index: IndexedModel[], despacedQuery: string): Map<string, number> {
  const boosts = new Map<string, number>();
  if (despacedQuery.length < 4) return boosts;
  for (const m of index) {
    const pos = m.despacedText.indexOf(despacedQuery);
    if (pos !== -1) {
      boosts.set(m.id, 55);
    }
  }
  return boosts;
}

/**
 * Multi-tier Google-style matching over one scoring pass. Guarantees useful
 * results whenever any reasonable interpretation of the query exists:
 *   Tier 1: every token matches directly (any word order, prefixes OK)
 *   Tier 2: de-spaced full-query hits ("hpspectre" → HP Spectre)
 *   Tier 3: typo tolerance — every token matches directly OR fuzzily
 *   Tier 4: drop globally-dead tokens (junk/gibberish), keep direct matches
 *   Tier 5: closest single-token matches (never-empty guarantee)
 */
async function smartSearch(
  rawQuery: string
): Promise<{
  ranked: RankedMatch[];
  relaxed: boolean;
  missingGeneration?: string[];
  missingCriteria?: SpecCriteria;
  matchedTerms?: string[];
}> {
  const normalized = normalizeQuery(rawQuery);
  const tokens = tokenizeNormalized(normalized);
  if (tokens.length === 0) return { ranked: [], relaxed: false };

  const index = await getIndex();

  // ---- Multi-criteria hardware detection ---------------------------------
  // Criteria tokens are enforced as hard spec filters and REMOVED from the
  // fuzzy ranking pipeline so "16gb"/"rtx" don't dilute name matching.
  const criteria = extractSpecCriteria(tokens);
  const useCriteria = hasSpecCriteria(criteria);
  const criteriaIdx = new Set(criteria.tokenIndexes);
  const freeTokens = tokens.filter((_, i) => !criteriaIdx.has(i));

  const aliasTokens = expandAliases(freeTokens);
  const despacedQuery = normalized.replace(/\s+/g, "");

  // One scoring pass over the corpus (free tokens only).
  const corpus = scoreCorpus(index, freeTokens);
  let scored = corpus.scored;
  const tokenHasDirect = corpus.tokenHasDirect;

  // Highlight terms: detected hardware fragments + every free token with a
  // direct catalog hit anywhere.
  const matchedTerms: string[] = [
    ...criteria.displayTerms,
    ...freeTokens.filter((_, i) => tokenHasDirect[i]),
  ];

  if (useCriteria) {
    const boosted: ScoredModel[] = [];
    for (const s of scored) {
      const critScore = specCriteriaScore(s.entry, criteria);
      if (critScore === 0) continue;
      boosted.push({ ...s, totalAny: s.totalAny + critScore, totalDirect: s.totalDirect + critScore });
    }
    if (boosted.length === 0) {
      // Nothing in the catalog carries these exact specs together.
      return { ranked: [], relaxed: false, missingCriteria: criteria, matchedTerms };
    }
    scored = boosted;
  }

  // ---- Exact generation enforcement -------------------------------------
  // A query with an explicit generation ("elitebook 845 g11") must resolve to
  // that EXACT generation. If the catalog carries it → restrict the corpus so
  // older generations can never outrank it. If it does NOT exist anywhere →
  // return nothing and flag it, so callers trigger AI discovery instead of
  // serving random older generations.
  const genTokens = extractGenTokens(tokens);
  if (genTokens.length > 0) {
    const genOk = new Set<string>();
    for (const s of scored) {
      if (genTokens.every((gt) => modelHasGenToken(s.entry, gt))) {
        genOk.add(s.entry.id);
      }
    }
    if (genOk.size === 0) {
      return { ranked: [], relaxed: false, missingGeneration: genTokens, matchedTerms };
    }
    scored = scored.filter((s) => genOk.has(s.entry.id));

    // Generation named explicitly → demand full-token precision INSIDE that
    // generation ("elitebook 845 g11" must match an actual 845 G11). Loose
    // sibling matches (840 G11, 640 G11…) are noise, not answers: report the
    // requested configuration as missing so AI discovery kicks in.
    const strictWithinGen = scored.filter(
      (s) => s.direct.every((d) => d > 0)
    );
    if (strictWithinGen.length === 0 && freeTokens.length > 0) {
      return {
        ranked: [],
        relaxed: false,
        missingGeneration: genTokens,
        matchedTerms,
      };
    }
  }

  // Token-level alias bonus (low weight — never overrides direct matches).
  applyAliasBonus(scored, aliasTokens, freeTokens);

  // Tier 1 — all tokens matched strictly. With pure-criteria queries
  // (no free tokens) every filtered model qualifies and sorts by year/name.
  const strict =
    freeTokens.length === 0
      ? scored
      : scored.filter((s) => s.direct.every((d) => d > 0));
  if (strict.length > 0) {
    return {
      ranked: sortScored(strict).map(toRanked(false)),
      relaxed: false,
      matchedTerms,
    };
  }

  // Tier 2 — de-spaced query ("hpspectre", "thinkpadt14", "hp elitebook845").
  {
    const boosts = despaceMatches(index, despacedQuery);
    if (boosts.size > 0) {
      const hits = scored
        .filter((s) => boosts.has(s.entry.id))
        .map((s) => ({ ...s, totalAny: s.totalAny + boosts.get(s.entry.id)! + 40 }));
      if (hits.length > 0) {
        return { ranked: sortScored(hits).map(toRanked(true)), relaxed: true, matchedTerms };
      }
    }
  }

  // Tier 3 — typo tolerance: every token matched directly or via fuzzy.
  {
    const fuzzyHits: ScoredModel[] = [];
    for (const s of scored) {
      let ok = true;
      let usedFuzzy = false;
      for (let i = 0; i < freeTokens.length; i++) {
        if (s.direct[i] > 0) continue;
        if (s.fuzzy[i] > 0) {
          usedFuzzy = true;
          continue;
        }
        ok = false;
        break;
      }
      // Every token must resolve; at least one via fuzzy correction, and the
      // directly-matched tokens must be strong so unrelated models stay out.
      if (ok && usedFuzzy && s.totalDirect >= 40 * Math.max(0, freeTokens.length - 1)) {
        fuzzyHits.push(s);
      }
    }
    if (fuzzyHits.length > 0) {
      return { ranked: sortScored(fuzzyHits).map(toRanked(true)), relaxed: true, matchedTerms };
    }
  }

  // Tier 4 — drop globally-dead tokens (no direct match on ANY computer),
  // e.g. "hp elitebook zzz" — "zzz" exists nowhere.
  if (freeTokens.length >= 2) {
    const liveIdx = freeTokens.map((_, i) => i).filter((i) => tokenHasDirect[i]);
    if (liveIdx.length >= 1 && liveIdx.length < freeTokens.length) {
      const partial = scored.filter((s) => {
        let all = true;
        let totalLive = 0;
        for (const i of liveIdx) {
          if (s.direct[i] <= 0) {
            all = false;
            break;
          }
          totalLive += s.direct[i];
        }
        return all && totalLive >= 40 * liveIdx.length;
      });
      if (partial.length > 0) {
        return { ranked: sortScored(partial).map(toRanked(false)), relaxed: true, matchedTerms };
      }
    }
  }

  // Tier 5 — closest matches on any single strong token (never-empty guarantee).
  const singleBest: RankedMatch[] = [];
  for (const s of scored) {
    const bestDirect = Math.max(...(s.direct.length ? s.direct : [0]));
    if (bestDirect > 30) {
      singleBest.push({ entry: s.entry, score: bestDirect, usedFuzzy: false });
    }
  }
  if (singleBest.length > 0) {
    const seen = new Set<string>();
    const deduped = singleBest
      .sort((a, b) => b.score - a.score)
      .filter((r) => !seen.has(r.entry.id) && seen.add(r.entry.id));
    return { ranked: deduped.slice(0, 24), relaxed: true, matchedTerms };
  }

  // Pure-criteria query whose models passed the filter but carry no direct
  // free-token hits — serve them ranked by year (never-empty guarantee).
  if (useCriteria && scored.length > 0) {
    return { ranked: sortScored(scored).map(toRanked(false)), relaxed: false, matchedTerms };
  }

  // Even fuzzy found nothing meaningful — genuinely no relevant computers.
  return { ranked: [], relaxed: true, matchedTerms };
}

function toRanked(usedFuzzy: boolean) {
  return (s: ScoredModel): RankedMatch => ({
    entry: s.entry,
    score: s.totalAny,
    usedFuzzy,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function matchFiltersPost(m: ComputerModel, f: SearchFilters): boolean {
  return modelMatchesFilters(m, f);
}

export async function searchModels(
  query: string,
  filters: SearchFilters,
  offset = 0,
  limit = 20
): Promise<SearchResult> {
  const normalized = normalizeQuery(query ?? "");
  const hasQuery = normalizeQuery(query).length > 0;

  if (!hasQuery) {
    const { models, total } = await queryModels(filters, offset, limit);
    const facets = await getFilterFacets(filters);
    return { models, total, offset, limit, query: normalized, facets };
  }

  const { ranked, missingGeneration, matchedTerms } = await smartSearch(normalized);
  const filtered = ranked.filter((s) => matchFiltersPost(s.entry.model, filters));
  const total = filtered.length;
  const models = filtered.slice(offset, offset + limit).map((s) => s.entry.model);

  const facets = await computeFacetsFromSubset(filtered.map((s) => s.entry.model));

  return {
    models,
    total,
    offset,
    limit,
    query: normalized,
    facets,
    generationMissing: missingGeneration,
    matchedTerms,
  };
}

/**
 * Parse hardware criteria from a free-text query — used by the expansion
 * engine ("find more computers with these specs") to know what to ask Gemini.
 */
export function parseSpecCriteriaFromQuery(
  query: string
): { criteria: SpecCriteria; displayTerms: string[] } {
  const tokens = tokenizeNormalized(normalizeQuery(query));
  const criteria = extractSpecCriteria(tokens);
  return { criteria, displayTerms: criteria.displayTerms };
}

/**
 * Strict database-existence check used by AI Search: returns models ONLY when
 * every query token matches directly (Tier 1) — including the exact requested
 * generation when one is named. Relaxed/fuzzy interpretations and
 * missing-generation queries do NOT count as "already in the database";
 * those must go to Gemini discovery.
 */
export async function findStrictDatabaseMatches(
  query: string,
  limit = 8
): Promise<ComputerModel[]> {
  const normalized = normalizeQuery(query ?? "");
  if (!normalized) return [];
  const { ranked, relaxed, missingGeneration } = await smartSearch(normalized);
  if (relaxed || ranked.length === 0 || (missingGeneration && missingGeneration.length > 0)) {
    return [];
  }
  return ranked.slice(0, limit).map((r) => r.entry.model);
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions
// ---------------------------------------------------------------------------

type SuggestionTier = 0 | 1 | 2 | 3 | 4; // 0 strongest … 4 weakest

interface ModelSuggestion {
  text: string;
  id: string;
  brand: string;
  family?: string;
  score: number;
  tier: SuggestionTier;
}

function suggestModelScore(
  tokens: string[],
  fullNorm: string,
  m: IndexedModel
): { score: number; tier: SuggestionTier } | null {
  const nameL = m.name;
  const labelL = `${m.brand} ${m.name}`;

  // 1. Exact / near-exact model-name matches.
  if (nameL === fullNorm || labelL === fullNorm) return { score: 1000, tier: 0 };
  if (fullNorm.length >= 3 && (nameL.startsWith(fullNorm) || labelL.startsWith(fullNorm)))
    return { score: 900, tier: 0 };

  // Every token present as a standalone word or word-prefix in the model name
  // (order-independent: "t14 thinkpad" works).
  const allInName = tokens.every((t) =>
    m.nameWords.some((w) => w === t || w.startsWith(t))
  );
  if (allInName) return { score: 800, tier: 1 };

  // Family / series + generation coverage ("hp elite" → EliteBook family).
  if (m.family) {
    const famWords = `${m.family} ${m.generation}`.split(" ").filter(Boolean);
    const allInFamily = tokens.every((t) => famWords.some((w) => w === t || w.startsWith(t)));
    if (allInFamily && m.brand.split(" ").some((b) => tokens.some((t) => b === t || b.startsWith(t))))
      return { score: 700, tier: 2 };
    if (allInFamily) return { score: 600, tier: 2 };
  }

  // All tokens somewhere (name OR family OR specs).
  const allAnywhere = tokens.every((t) => matchToken(t, m) > 0);
  if (allAnywhere) return { score: 500, tier: 2 };

  // Partial: most tokens matched.
  const matchedCount = tokens.filter((t) => matchToken(t, m) > 0).length;
  if (matchedCount >= Math.ceil(tokens.length / 2))
    return { score: 300 + matchedCount * 10, tier: 3 };

  // Fuzzy typo correction.
  let fuzzyTotal = 0;
  let fuzzyHits = 0;
  for (const t of tokens) {
    const direct = matchToken(t, m);
    if (direct > 0) {
      fuzzyTotal += direct;
      fuzzyHits++;
      continue;
    }
    const fz = fuzzyTokenScore(t, [{ words: m.words, weight: 1 }]);
    if (fz > 0) {
      fuzzyTotal += fz;
      fuzzyHits++;
    }
  }
  if (fuzzyHits === tokens.length && tokens.some((t) => fuzzyMaxDistance(t.length) > 0))
    return { score: Math.min(200, fuzzyTotal), tier: 4 };

  return null;
}

export async function getAutocomplete(rawQuery: string): Promise<AutocompleteResult> {
  const normalized = normalizeQuery(rawQuery ?? "");
  const tokens = tokenizeNormalized(normalized);
  if (tokens.length === 0) return { brands: [], families: [], models: [] };

  const index = await getIndex();

  const brandCounts = new Map<string, { count: number; score: number }>();
  const familyEntries = new Map<
    string,
    { text: string; brand: string; count: number; score: number }
  >();
  const modelSuggestions: ModelSuggestion[] = [];

  for (const m of index) {
    // ---- Brands ----
    const brandL = m.brand;
    const brandHit =
      tokens.every((t) => brandL.split(" ").some((w) => w.startsWith(t))) ||
      tokens.some((t) => tokenFieldScore(t, brandL) >= 42);
    if (brandHit) {
      const existing = brandCounts.get(m.model.brand);
      const strength = tokens.every((t) => brandL === t || brandL.split(" ").some((w) => w === t))
        ? 2
        : 1;
      if (existing) {
        existing.count++;
        existing.score = Math.max(existing.score, strength);
      } else {
        brandCounts.set(m.model.brand, { count: 1, score: strength });
      }
    }

    // ---- Families / series ----
    if (m.family) {
      const famWords = `${m.family}`.split(" ").filter(Boolean);
      const genWords = `${m.generation || ""}`.split(" ").filter(Boolean);
      const famHit =
        tokens.every(
          (t) =>
            famWords.some((w) => w === t || w.startsWith(t)) ||
            genWords.some((w) => w === t || w.startsWith(t)) ||
            m.brand.split(" ").some((w) => w === t || w.startsWith(t))
        ) && tokens.some((t) => famWords.some((w) => w === t || w.startsWith(t)));
      if (famHit) {
        const key = `${m.brand}|${m.family}`;
        const strength = tokens.length * 10 + m.family.length;
        const existing = familyEntries.get(key);
        if (existing) {
          existing.count++;
          existing.score = Math.max(existing.score, strength);
        } else {
          familyEntries.set(key, {
            text: `${m.model.brand} ${m.model.family}`,
            brand: m.model.brand,
            count: 1,
            score: strength,
          });
        }
      }
    }

    // ---- Models ----
    const sug = suggestModelScore(tokens, normalized, m);
    if (sug) {
      modelSuggestions.push({
        text: `${m.model.brand} ${m.model.name}`,
        id: m.id,
        brand: m.model.brand,
        family: m.model.family,
        score: sug.score,
        tier: sug.tier,
      });
    }
  }

  const brands = [...brandCounts.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count)
    .slice(0, 4)
    .map(([text, { count }]) => ({ text, count }));

  const families = [...familyEntries.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 6)
    .map(({ text, brand, count }) => ({ text, brand, count }));

  const models = modelSuggestions
    .sort((a, b) => b.score - a.score || b.tier - a.tier)
    .slice(0, 8)
    .map(({ text, id, brand, family }) => ({ text, id, brand, family }));

  // Never-empty guarantee: if nothing surfaced, fall back to the strongest
  // fuzzy/partial interpretations instead of returning zero rows.
  if (models.length === 0 && families.length === 0 && brands.length === 0) {
    const { ranked } = await smartSearch(normalized);
    return {
      brands: [],
      families: [],
      models: ranked.slice(0, 6).map((r) => ({
        text: `${r.entry.model.brand} ${r.entry.model.name}`,
        id: r.entry.id,
        brand: r.entry.model.brand,
        family: r.entry.model.family,
      })),
    };
  }

  return { brands, families, models };
}

// ---------------------------------------------------------------------------
// Facets over a result subset
// ---------------------------------------------------------------------------

async function computeFacetsFromSubset(models: ComputerModel[]): Promise<FilterFacets> {
  const brandMap = new Map<string, number>();
  const familyMap = new Map<string, { brand: string; count: number }>();
  const catMap = new Map<string, number>();
  const cpuMap = new Map<string, number>();
  const gpuMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const screenMap = new Map<number, number>();
  let minRam = Infinity,
    maxRam = 0;
  let minStorage = Infinity,
    maxStorage = 0;
  let minPrice = Infinity,
    maxPrice = 0;
  let minYear = Infinity,
    maxYear = 0;

  for (const m of models) {
    brandMap.set(m.brand, (brandMap.get(m.brand) || 0) + 1);
    if (m.family) {
      const key = `${m.brand}|${m.family}`;
      const existing = familyMap.get(key);
      if (existing) existing.count++;
      else familyMap.set(key, { brand: m.brand, count: 1 });
    }
    catMap.set(m.category, (catMap.get(m.category) || 0) + 1);
    if (m.year < minYear) minYear = m.year;
    if (m.year > maxYear) maxYear = m.year;
    for (const v of m.variants) {
      const cpuShort = v.specs.cpu.split(" ").slice(-1)[0] || v.specs.cpu;
      cpuMap.set(cpuShort, (cpuMap.get(cpuShort) || 0) + 1);
      const gpuShort = v.specs.gpu.split(" ").slice(-2).join(" ");
      gpuMap.set(gpuShort, (gpuMap.get(gpuShort) || 0) + 1);
      osMap.set(v.specs.os, (osMap.get(v.specs.os) || 0) + 1);
      if (v.specs.displaySize)
        screenMap.set(v.specs.displaySize, (screenMap.get(v.specs.displaySize) || 0) + 1);
      if (v.specs.ram < minRam) minRam = v.specs.ram;
      if (v.specs.ram > maxRam) maxRam = v.specs.ram;
      if (v.specs.storage < minStorage) minStorage = v.specs.storage;
      if (v.specs.storage > maxStorage) maxStorage = v.specs.storage;
      if (v.price < minPrice) minPrice = v.price;
      if (v.price > maxPrice) maxPrice = v.price;
    }
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

  const families = [...familyMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([value, { brand, count }]) => ({ value, brand, count }));

  return {
    brands: toSorted(brandMap),
    families,
    categories: toSorted(catMap),
    cpus: toSorted(cpuMap).slice(0, 50),
    gpus: toSorted(gpuMap).slice(0, 30),
    ramRange: { min: minRam === Infinity ? 4 : minRam, max: maxRam || 128 },
    storageRange: { min: minStorage === Infinity ? 128 : minStorage, max: maxStorage || 4000 },
    priceRange: { min: minPrice === Infinity ? 0 : minPrice, max: maxPrice || 5000 },
    yearRange: { min: minYear === Infinity ? 2015 : minYear, max: maxYear || 2026 },
    screenSizes: [...screenMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count })),
    osOptions: toSorted(osMap),
  };
}
