/**
 * Spec criteria extraction & matching (shared by search.ts and
 * hybrid-retrieval.ts).
 *
 * This module owns the HARD hardware-criteria interpretation: GPU/CPU terms,
 * RAM sizes, and storage sizes parsed out of a normalized query. Both the
 * existing search scoring pipeline and the Phase 3.2.4 hard-constraint gate
 * use the SAME functions so a candidate rejected here can never be rescued
 * by semantic similarity elsewhere.
 *
 * Anti-hallucination invariant: pure parsing/matching — never creates data.
 */

/** Structured hardware criteria parsed from a normalized query. */
export interface SpecCriteria {
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

export function emptyCriteria(): SpecCriteria {
  return { gpuTerms: [], cpuTerms: [], ramSizes: [], storageSizes: [], tokenIndexes: [], displayTerms: [] };
}

export function hasSpecCriteria(c: SpecCriteria): boolean {
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
export function variantMatchesCriteria(
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