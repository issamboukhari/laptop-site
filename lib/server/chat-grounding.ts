/**
 * Phase 3.2.6 — Chat grounding boundary
 *
 * Separates the AI's CATALOG RESPONSIBILITIES (interpret/compare/explain the
 * verified computers the user selected) from the AI's own world knowledge
 * (only reachable when Google Search grounding is enabled). This module owns
 * the ONLY way the chat prompt can learn about catalog computers: real
 * variants resolved through the database, with specs taken verbatim.
 *
 * Trust invariants:
 *  - A computer is only shown to the AI if it was resolved from the real
 *    catalog (findVariantById / getModelById). Nothing else can enter the
 *    context — an invented or unverifiable entity produces "not found", never
 *    a fabricated listing.
 *  - Configurations are NEVER merged: every context block is one real variant
 *    with its own specs. No cross-variant spec recombination is possible
 *    because the context is generated straight from a single variant record.
 *  - Unknown specs are represented as "Not available" / "غير متوفر" — the AI
 *    is instructed to never guess.
 */

import { ComputerVariant } from "@/lib/data/types";
import { calculateRatings, RATING_DEFINITIONS } from "@/lib/scoring/ratings";
import { describeHardware } from "@/lib/scoring/hardware";

export interface ChatComputerResolver {
  findVariantById(id: string): Promise<ComputerVariant | null | undefined>;
  getModelById(id: string): Promise<{ variants: ComputerVariant[] } | null | undefined>;
}

export interface ChatResolution {
  /** Real, verified variants (one per selected config, never merged). */
  resolved: ComputerVariant[];
  /** IDs that could not be resolved — these are NOT in the catalog. */
  missingIds: string[];
}

/**
 * Resolve user-selected computer IDs against the real catalog. A variant is
 * included ONLY when it exists; a model ID expands to its own variants. IDs
 * that resolve to nothing are reported as missing (the chat must NOT invent
 * a computer for them).
 */
export async function resolveChatComputers(
  ids: string[],
  db: ChatComputerResolver
): Promise<ChatResolution> {
  const settled = await Promise.all(
    ids.map(async (id) => {
      const variant = await db.findVariantById(id);
      if (variant) return { variants: [variant] } as { variants: ComputerVariant[] };
      const model = await db.getModelById(id);
      if (model && model.variants.length > 0) {
        return { variants: model.variants.slice(0, 4) };
      }
      return { variants: [] } as { variants: ComputerVariant[] };
    })
  );

  const resolved: ComputerVariant[] = [];
  const missingIds: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    if (settled[i].variants.length > 0) resolved.push(...settled[i].variants);
    else missingIds.push(ids[i]);
  }
  return { resolved, missingIds };
}

/** Ratings line — exactly the six decision-critical ratings, verified scores. */
export function ratingsLine(c: ComputerVariant): string {
  const ratings = calculateRatings(c);
  return RATING_DEFINITIONS
    .filter((r) => ["gaming", "programming", "university", "performance", "value", "battery"].includes(r.id))
    .map((r) => `${r.icon}${ratings[r.id].score}`)
    .join(" · ");
}

/**
 * Render ONE real variant as context. Every number comes from the variant
 * record verbatim — nothing is estimated, guessed, combined, or defaulted.
 */
export function formatComputer(c: ComputerVariant): string {
  const s = c.specs;
  const bits: string[] = [];
  bits.push(`CPU: ${s.cpu}${s.cpuCores ? ` (${s.cpuCores})` : ""}`);
  bits.push(`GPU: ${s.gpu}`);
  bits.push(`RAM: ${s.ram}GB${s.ramType ? ` ${s.ramType}` : ""}`);
  bits.push(`Storage: ${s.storage}GB ${s.storageType}`);
  if (s.displaySize) bits.push(`Display: ${s.displaySize}"${s.displayRefreshRate ? ` ${s.displayRefreshRate}Hz` : ""}`);
  if (s.batteryLife) bits.push(`Battery: ${s.batteryLife}h`);
  if (s.weight) bits.push(`${s.weight}kg`);
  if (s.resolution) bits.push(`Resolution: ${s.resolution}`);
  if (s.panelType) bits.push(`Panel: ${s.panelType}`);

  return `${c.brand} ${c.name} — $${c.price} (${c.year})
${describeHardware(c)}
${bits.join(" | ")}
Ratings: ${ratingsLine(c)}`;
}

/**
 * The chat system prompt. Enforces the grounding boundary: the AI may talk
 * ONLY about computers present in the provided context, must call anything
 * absent "Not available" / "غير متوفر", and must never merge configurations.
 */
export const CHAT_SYSTEM_PROMPT = `You are gen — an expert computer advisor and hardware analyst. You chat naturally with users about computers.

LANGUAGE (critical):
- Detect the user's language from their question. Respond in the SAME language (Arabic ↔ English).
- If the question is in Arabic, answer in natural Arabic. If English, answer in English. Mixed = match the dominant language.
- Keep technical terms (CPU names, GPU names, RAM, NVMe, OLED, benchmark terms) in English even when answering in Arabic — e.g. "معالج Intel Core Ultra 7 155H من فئة H-class".

ACCURACY:
- Use ONLY specs and ratings from the context. NEVER invent numbers, benchmarks, or scores. Unknown = "Not available" / "غير متوفر".
- Trust the provided "Ratings/100" — they are hardware-class-aware (U≤72, H≤93, HX≤97, integrated GPU ≤58, panel/storage class). Never second-guess.
- When Google Search grounding is available, use it to enrich with current prices, benchmarks, and reviews — but ALWAYS ground analysis in the provided specs first.
- Reason from the ACTUAL component strengths (CPU class, dedicated-vs-integrated GPU tier, RAM capacity, panel type, storage speed) and explain WHY a rating is what it is — never quote scores without the hardware behind them.

RESPONSIBILITY BOUNDARY (critical):
- You explain, compare, and advise about ONLY the computers listed in "## Computers". Every spec, price, year, and rating you mention must come from that context.
- A computer is NOT part of the catalog if it is absent from the context. Never describe a model, configuration, spec, price, or availability you cannot find there.
- If the user asks about a computer or a spec that is not in the context, answer that it is "Not available in the catalog" / "غير متوفر في الكتالوج" and suggest which hardware class to look for instead.
- NEVER merge configurations: each listed computer is exactly one configuration with its own specs. Never attribute one variant's RAM/storage/GPU/price to another.
- Unknown values are "Not available" / "غير متوفر" — never estimate, extrapolate, or invent.

STYLE — natural, flexible, expert:
- Answer the ACTUAL question directly — like a knowledgeable friend who knows both machines inside out.
- Focused question → focused answer (don't dump everything).
- Be conversational, warm, and concise. Vary phrasing — never repeat canned responses.
- Cite specific numbers from the context when relevant.

COMPARISON MODE (user asks which is better / overall):
- Open with a bold verdict backed by 2-4 decisive numbers.
- Then key differences; end with who should buy which. Never fence-sit.

When the selected computers don't fit the need, suggest what hardware class to look for instead.`;

/**
 * Build the user prompt. Computers is the pre-rendered verified catalog
 * context; missingIds tell the AI explicitly which requested computers do not
 * exist in the catalog so it can report them as not-found instead of inventing
 * them.
 */
export function buildUserPrompt(options: {
  computers: string;
  question: string;
  missingIds: string[];
}): string {
  const parts = [`## Computers\n${options.computers}`];
  if (options.missingIds.length > 0) {
    parts.push(
      `## Not available in catalog\nThese requested computers were NOT FOUND in the catalog (do not describe them, never invent their specs):\n${options.missingIds.join("\n")}`
    );
  }
  parts.push(`## Question\n${options.question}`);
  return parts.join("\n\n");
}