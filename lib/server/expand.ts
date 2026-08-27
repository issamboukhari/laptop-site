import { ComputerModel } from "../data/types";
import { GoogleGenAI } from "@google/genai";
import {
  getGeminiApiKey,
  getGeminiModel,
  getFallbackModel,
  classifyGeminiFailure,
  isGroundingBlocked,
  isPrimaryModelBlocked,
  blockGrounding,
  blockPrimaryModel,
} from "./gemini";
import { RESEARCH_PROMPT, RESEARCH_SCHEMA } from "./ai-research";
import { sanitizeAiModel } from "./model-normalize";
import { parseSpecCriteriaFromQuery, searchModels } from "./search";
import { getAllModels, invalidateCache, saveCustomModel } from "./database";
import { saveModelToCloud } from "./cloud-db";

/**
 * Dynamic Specs Expansion Engine — "add more computers with these specs".
 *
 * HYBRID two-phase pipeline:
 *   Phase A (instant, free): rank the existing catalog (local + Supabase)
 *   with the same strict multi-criteria spec matcher used by search, and take
 *   every stored model the user is not seeing yet.
 *   Phase B (Gemini, gemini-3.6-flash): only when Phase A comes up short, ask
 *   for NEW, different, real market devices matching the criteria (excluding
 *   everything already shown/picked), dedupe against the catalog and
 *   batch-save them to Supabase.
 *
 * All returned models render immediately in the UI list.
 */
export async function expandComputers(options: {
  query: string;
  excludeIds?: string[];
  count?: number;
}): Promise<{
  models: ComputerModel[];
  savedCount: number;
  internalCount: number;
  criteria: string[];
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const { query } = options;
  const count = Math.min(Math.max(options.count ?? 3, 1), 6);
  const { displayTerms } = parseSpecCriteriaFromQuery(query);

  // ---- Everything the user already sees / explicitly excludes ----
  const excludeIdSet = new Set(options.excludeIds ?? []);
  const catalog = await getAllModels();
  const knownNameSet = new Set(catalog.map((m) => `${m.brand}|${m.name.toLowerCase()}`));

  const picked: ComputerModel[] = [];
  const seenIds = new Set<string>();

  // ========================================================================
  // Phase A — internal stored matches (instant, zero external cost)
  // ========================================================================
  try {
    const { models: matched } = await searchModels(query, {}, 0, 60);
    for (const m of matched) {
      if (picked.length >= count) break;
      if (excludeIdSet.has(m.id) || seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      picked.push(m);
    }
  } catch {
    // Internal matching must never block Phase B.
  }

  const internalCount = picked.length;
  let savedCount = 0;

  // ========================================================================
  // Phase B — Gemini discovery for whatever the catalog could not provide
  // ========================================================================
  const remaining = count - internalCount;
  if (remaining > 0) {
    const knownNames = [
      ...catalog.filter((m) => excludeIdSet.has(m.id)).map((m) => m.name),
      ...picked.map((m) => m.name),
    ];

    const criteriaText = displayTerms.length > 0 ? displayTerms.join(", ") : query.trim();

    const taskLine = [
      `Find exactly ${remaining} NEW and COMPLETELY DIFFERENT real computers available on the global market that contain these hardware specifications: ${criteriaText}.`,
      `Original request: "${query.trim()}"`,
      knownNames.length > 0
        ? `These models are ALREADY KNOWN to the user — do NOT return them or close duplicates: ${knownNames.join("; ")}.`
        : "",
      `Prefer variety across different brands. Every model must genuinely match the required specifications.`,
      `Return ONLY the JSON array.`,
    ]
      .filter(Boolean)
      .join(" ");

    const discovered = await discoverViaGemini(apiKey, taskLine);

    for (const m of discovered) {
      if (picked.length >= count) break;
      if (seenIds.has(m.id)) continue;
      if (knownNameSet.has(`${m.brand}|${m.name.toLowerCase()}`)) continue;
      seenIds.add(m.id);

      // Batch save — saveModelToCloud dedupes per-model as well.
      const result = await saveModelToCloud(m, catalog, saveCustomModel);
      if (!result.deduped) {
        picked.push(result.model);
        if (result.saved) savedCount++;
      }
    }

    if (savedCount > 0) invalidateCache();
  }

  return { models: picked, savedCount, internalCount, criteria: displayTerms };
}

/** Strict-JSON Gemini fallback chain — same semantics as aiSearch. */
async function discoverViaGemini(
  apiKey: string,
  taskLine: string
): Promise<ComputerModel[]> {
  const ai = new GoogleGenAI({ apiKey });

  type Cfg = { model: string; grounding: boolean };
  const attempts: Cfg[] = [];
  if (!isPrimaryModelBlocked()) {
    if (!isGroundingBlocked()) attempts.push({ model: getGeminiModel(), grounding: true });
    attempts.push({ model: getGeminiModel(), grounding: false });
  }
  attempts.push({ model: getFallbackModel(), grounding: false });

  let lastError: unknown = null;

  for (const { model, grounding } of attempts) {
    for (let tryNum = 0; tryNum < 2; tryNum++) {
      let response;
      try {
        const config: Record<string, unknown> = {
          systemInstruction: RESEARCH_PROMPT,
          temperature: 0.5,
          maxOutputTokens: 8192,
        };
        if (grounding) {
          config["tools"] = [{ googleSearch: {} }];
        } else {
          config["responseMimeType"] = "application/json";
          config["responseSchema"] = RESEARCH_SCHEMA;
        }

        response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: taskLine }] }],
          config: config as never,
        });
      } catch (callError) {
        lastError = callError;
        const kind = classifyGeminiFailure(callError);
        console.warn(
          `[expand] attempt ${model}${grounding ? "+grounding" : ""} failed [${kind}]: ${
            callError instanceof Error ? callError.message.slice(0, 140) : String(callError).slice(0, 140)
          }`
        );

        if ((kind === "quota" || kind === "tool_error") && grounding) blockGrounding();
        if (kind === "overloaded" || kind === "model_missing") {
          if (model === getGeminiModel()) blockPrimaryModel();
          break;
        }
        if (kind === "network" && tryNum === 0) continue;
        break;
      }

      // ---- Parse strict JSON ----
      const text = response.text || "[]";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        parsed = JSON.parse(jsonMatch[0]);
      }
      if (!Array.isArray(parsed)) return [];

      return parsed.map(sanitizeAiModel).filter((m): m is ComputerModel => m !== null);
    }
  }

  if (lastError) throw classifyToCode(lastError);
  throw new Error("SERVER_ERROR");
}

function classifyToCode(err: unknown): Error {
  const kind = classifyGeminiFailure(err);
  const map: Record<string, string> = {
    quota: "QUOTA_EXCEEDED",
    overloaded: "GEMINI_ERROR",
    model_missing: "MODEL_NOT_FOUND",
    network: "NETWORK",
    timeout: "TIMEOUT",
  };
  return new Error(map[kind] ?? "SERVER_ERROR");
}
