import { GoogleGenAI } from "@google/genai";
import { ComputerModel } from "../data/types";
import {
  getGeminiApiKey,
  getGeminiModel,
  getFallbackModel,
  diagnoseGeminiError,
  classifyGeminiFailure,
  isGroundingBlocked,
  isPrimaryModelBlocked,
  blockGrounding,
  blockPrimaryModel,
} from "./gemini";
import { getAllModels, saveCustomModel, invalidateCache } from "./database";
import { saveModelToCloud } from "./cloud-db";
import { sanitizeAiModel } from "./model-normalize";

/**
 * Bilingual research prompt — detects user language and enforces full generation accuracy.
 * Always preserves the complete product name including generation (e.g. "HP ProBook 440 G10").
 */
export const RESEARCH_PROMPT = `You are a computer hardware research API. Given a product query, return a JSON array of matching REAL computers.

LANGUAGE:
- Respond with data in the same language context as the query, but keep technical specs (CPU, GPU, OS names) in their original English form.

NAME & GENERATION ACCURACY (critical):
- ALWAYS preserve the FULL product name INCLUDING generation suffix (e.g. "HP ProBook 440 G10" not "HP ProBook 440", "Lenovo ThinkPad X1 Carbon Gen 11" not "ThinkPad X1 Carbon").
- Correct misspellings and normalize shorthand (e.g. "macbok pro" → "MacBook Pro", "hp 440 g10" → "HP ProBook 440 G10").
- If an exact generation match exists, use it. If not, return the CLOSEST real generation of the same series.
- NEVER invent a product or generation that does not exist. Return only real, verifiable products.
- Return [] only if nothing plausible exists for the query.

DATA RULES:
- Only include specs you can verify with high confidence. Unknown = null (never invent).
- Price = approximate MSRP in USD at launch.
- cpuScore/gpuScore = 0-100 relative benchmarks grounded in real hardware tiers (U-class ≤72, H-class ≤93, HX ≤97; integrated GPU ≤58; use benchmark knowledge).
- ram in GB, storage in GB, ports as string array, display as free-text.
- Include 2-6 real purchasable variants per model (same generation).

GROUNDING:
- Use your knowledge and, when available, Google Search grounding to verify specs, prices, and benchmarks from trusted sources (Notebookcheck, TechPowerUp, official vendor pages).

Return ONLY a JSON array. No markdown, no explanation.

Schema:
[{
  "nameInterpretedAs": "canonical FULL product name with generation (e.g. HP ProBook 440 G10)",
  "id": "brand-family-generation (kebab-case, e.g. hp-probook-440-g10)",
  "name": "FULL marketing name WITH generation (e.g. ProBook 440 G10)",
  "brand": "Brand",
  "family": "series|null",
  "generation": "generation suffix (e.g. G10, Gen 11) — NEVER omit",
  "category": "gaming-laptop|business-laptop|ultrabook|macbook|workstation|desktop|mini-pc",
  "year": 2024,
  "description": "1-2 sentence description mentioning generation",
  "imageUrl": "",
  "variants": [{
    "id": "model-id-config (kebab-case)",
    "name": "config name WITH generation (e.g. ProBook 440 G10 i7/16GB/512GB)",
    "brand": "same as model",
    "category": "same as model",
    "price": 999,
    "rating": 4.5,
    "reviewCount": 200,
    "year": 2024,
    "description": "brief config description",
    "imageUrl": "",
    "sku": "SKU|null",
    "specs": {
      "cpu": "Intel Core i7-1355U",
      "cpuCores": "10C/12T|null",
      "cpuScore": 78,
      "gpu": "Intel Iris Xe Graphics",
      "gpuScore": 35,
      "ram": 16,
      "storage": 512,
      "storageType": "NVMe",
      "display": "14\\" FHD (1920x1080) IPS 300 nits 60Hz",
      "displaySize": 14,
      "displayRefreshRate": 60,
      "batteryLife": 8,
      "weight": 1.38,
      "ports": ["USB-C", "USB-A x2", "HDMI"],
      "os": "Windows 11 Pro"
    }
  }]
}]`;

/**
 * Strict structured-output schema (OpenAPI subset accepted by Gemini).
 * Mirrors the prompt's JSON contract so sanitizeAiModel receives clean data:
 * top-level identity fields + variant specs (cpu/gpu/ram/storage/display/price).
 */
const S = { type: "STRING" as const };
const N = { type: "NUMBER" as const };

export const RESEARCH_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      nameInterpretedAs: S,
      name: S,
      brand: S,
      family: { ...S, nullable: true },
      generation: S,
      category: S,
      year: N,
      description: S,
      imageUrl: S,
      variants: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: S,
            price: N,
            rating: N,
            reviewCount: N,
            sku: { ...S, nullable: true },
            description: S,
            imageUrl: S,
            specs: {
              type: "OBJECT",
              properties: {
                cpu: S,
                cpuScore: N,
                gpu: S,
                gpuScore: N,
                ram: N,
                storage: N,
                storageType: S,
                display: S,
                displaySize: N,
                displayRefreshRate: N,
                batteryLife: N,
                weight: N,
                os: S,
              },
              required: ["cpu", "gpu", "ram", "storage", "display"],
            },
          },
          required: ["name", "specs"],
        },
      },
    },
    required: ["nameInterpretedAs", "name", "brand", "generation", "category", "variants"],
  },
};

export interface AiResearchResult {
  source: "database" | "ai";
  models: ComputerModel[];
  saved: boolean;
  interpretedAs?: string;
}

export type ProgressCallback = (step: string) => void;

/**
 * AI Search — smart fallback chain with circuit breaker:
 *   primary+grounding → primary → fallback model.
 * A failing config (quota / overload / 404 / tool error) is skipped fast and
 * remembered, so one broken tool never blocks discovery.
 */
export async function aiSearch(
  query: string,
  onProgress?: ProgressCallback,
): Promise<AiResearchResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("NO_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  onProgress?.("identifying");

  type Cfg = { model: string; grounding: boolean };
  const attempts: Cfg[] = [];
  if (!isPrimaryModelBlocked()) {
    if (!isGroundingBlocked()) attempts.push({ model: getGeminiModel(), grounding: true });
    attempts.push({ model: getGeminiModel(), grounding: false });
  }
  attempts.push({ model: getFallbackModel(), grounding: false });

  let lastError: unknown = null;

  for (const { model, grounding } of attempts) {
    // One quick same-config retry for transient network blips only.
    for (let tryNum = 0; tryNum < 2; tryNum++) {
      let response;
      try {
        const config: Record<string, unknown> = {
          systemInstruction: RESEARCH_PROMPT,
          temperature: 0.3,
          maxOutputTokens: 8192,
        };
        if (grounding) {
          // Grounding is incompatible with responseMimeType/responseSchema.
          config["tools"] = [{ googleSearch: {} }];
        } else {
          // Strict structured output — the model can only answer with JSON
          // that conforms to RESEARCH_SCHEMA (no markdown, no prose).
          config["responseMimeType"] = "application/json";
          config["responseSchema"] = RESEARCH_SCHEMA;
        }

        response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: `Research: ${query}` }] }],
          config: config as never,
        });
      } catch (callError) {
        lastError = callError;
        const kind = classifyGeminiFailure(callError);
        logResearchAttempt(model, grounding, kind, callError);

        if ((kind === "quota" || kind === "tool_error") && grounding) blockGrounding();
        if (kind === "overloaded" || kind === "model_missing") {
          if (model === getGeminiModel()) blockPrimaryModel();
          break; // next config
        }
        if (kind === "network" && tryNum === 0) continue; // retry once
        break; // next config
      }

      onProgress?.("parsing");

      const text = response.text || "[]";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else return { source: "ai", models: [], saved: false };
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { source: "ai", models: [], saved: false };
      }

      const interpretedAs = parsed
        .map((p) => (p as Record<string, unknown>)?.nameInterpretedAs)
        .find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;

      const discovered = parsed
        .map(sanitizeAiModel)
        .filter((m): m is ComputerModel => m !== null);

      if (discovered.length === 0) {
        return { source: "ai", models: [], saved: false };
      }

      onProgress?.("saving");

      const catalog = await getAllModels();
      const results: ComputerModel[] = [];
      let savedAny = false;

      for (const discoveredModel of discovered) {
        const result = await saveModelToCloud(discoveredModel, catalog, saveCustomModel);
        results.push(result.model);
        if (result.saved && !result.deduped) savedAny = true;
      }

      invalidateCache();

      onProgress?.("done");

      return { source: "ai", models: results, saved: savedAny, interpretedAs };
    }
  }

  // All configurations exhausted.
  if (lastError) {
    const diagnosis = diagnoseGeminiError(lastError);
    throw new Error(diagnosis.code);
  }
  throw new Error("SERVER_ERROR");
}

/** Compact server-side log line per failed attempt. */
function logResearchAttempt(model: string, grounding: boolean, kind: string, err: unknown): void {
  console.warn(
    `[ai-research] attempt ${model}${grounding ? "+grounding" : ""} failed [${kind}]: ${
      err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160)
    }`
  );
}
