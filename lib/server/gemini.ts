import { promises as fs, readFileSync } from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const KEY_FILE = path.join(process.cwd(), ".data", "gemini-api-key");

/** Gemini model — fast + latest. Override with GEMINI_MODEL env var. */
const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-flash-lite-latest";
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}
export function getFallbackModel(): string {
  return FALLBACK_MODEL;
}

/**
 * Resolve the Gemini API key. Order of precedence:
 *  1. `GEMINI_API_KEY` from the process environment (recommended server config)
 *  2. A runtime-persisted key written by the in-app "Configure" flow
 *     (stored in `.data/gemini-api-key`, gitignored, never served publicly)
 */
export function getGeminiApiKey(): string | undefined {
  const env = process.env.GEMINI_API_KEY?.trim();
  if (env) return env;
  try {
    const content = readFileSync(KEY_FILE, "utf8").trim();
    return content || undefined;
  } catch {
    return undefined;
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

// ---------------------------------------------------------------------------
// Circuit breaker — remembers short-term failures so one bad model/tool does
// not slow down or break every request. All state is per-process memory.
// ---------------------------------------------------------------------------

const BREAKER = {
  /** Timestamp until which Google-Search grounding calls are skipped. */
  groundingBlockedUntil: 0,
  /** Timestamp until which a specific primary model is skipped. */
  modelBlockedUntil: 0,
};

export function isGroundingBlocked(): boolean {
  return Date.now() < BREAKER.groundingBlockedUntil;
}

export function isPrimaryModelBlocked(): boolean {
  return Date.now() < BREAKER.modelBlockedUntil;
}

/** Skip grounding calls for a while (default 10 min) after quota/tool errors. */
export function blockGrounding(ms = 10 * 60_000): void {
  BREAKER.groundingBlockedUntil = Date.now() + ms;
}

/** Skip the primary model for a while (default 3 min) after overload/404. */
export function blockPrimaryModel(ms = 3 * 60_000): void {
  BREAKER.modelBlockedUntil = Date.now() + ms;
}

// ---------------------------------------------------------------------------
// Failure classification — drives fallback decisions
// ---------------------------------------------------------------------------

export type GeminiFailureKind =
  | "quota"
  | "overloaded"
  | "model_missing"
  | "tool_error"
  | "network"
  | "timeout"
  | "other";

/** Classify any thrown Gemini/SDK error for fallback routing decisions. */
export function classifyGeminiFailure(error: unknown): GeminiFailureKind {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  let apiCode: number | undefined;
  let apiStatus = "";
  try {
    const parsed = JSON.parse(raw);
    const e = parsed?.error;
    if (e) {
      apiCode = e.code;
      apiStatus = String(e.status || "");
    }
  } catch {
    // not JSON
  }

  if (apiStatus === "RESOURCE_EXHAUSTED" || apiCode === 429 || /quota|rate limit|billing/i.test(lower)) {
    return "quota";
  }
  if (
    apiCode === 503 ||
    apiStatus === "UNAVAILABLE" ||
    /high demand|overload|temporarily unavailable|try again later/i.test(lower)
  ) {
    return "overloaded";
  }
  if (apiCode === 404 || apiStatus === "NOT_FOUND" || /no longer available|model not found/i.test(lower)) {
    return "model_missing";
  }
  if (/tools|googlesearch|grounding|search entry/i.test(lower)) {
    return "tool_error";
  }
  if (/timeout|timed?\s*out/i.test(lower)) {
    return "timeout";
  }
  if (/fetch failed|undici|econnrefused|econnreset|getaddrinfo|network error|failed to fetch/i.test(lower)) {
    return "network";
  }
  return "other";
}

/** Persist a key server-side (runtime config fallback). Never returned to the client. */
export async function saveGeminiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("API key is empty");
  await fs.mkdir(path.dirname(KEY_FILE), { recursive: true });
  await fs.writeFile(KEY_FILE, trimmed, { encoding: "utf8", mode: 0o600 });
}

export type GeminiDiagnosisCode =
  | "NO_API_KEY"
  | "INVALID_API_KEY"
  | "UNAUTHORIZED"
  | "QUOTA_EXCEEDED"
  | "MODEL_NOT_FOUND"
  | "SERVER_ERROR"
  | "NETWORK";

export interface GeminiDiagnosis {
  code: GeminiDiagnosisCode;
  message: string;
  httpStatus: number;
}

/** Map any thrown error from the Gemini SDK to a structured diagnosis. */
export function diagnoseGeminiError(error: unknown): GeminiDiagnosis {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  let apiCode: number | undefined;
  let apiStatus = "";
  try {
    const parsed = JSON.parse(raw);
    const e = parsed?.error;
    if (e) {
      apiCode = e.code;
      apiStatus = String(e.status || "");
    }
  } catch {
    // not JSON
  }

  if (/fetch failed|undici|econnrefused|getaddrinfo|network error|failed to fetch/i.test(lower)) {
    return { code: "NETWORK", message: "Could not reach the Gemini API. Check the server's network connection.", httpStatus: 502 };
  }

  if (apiStatus === "UNAUTHENTICATED" || apiCode === 401) {
    return { code: "INVALID_API_KEY", message: "The Gemini API key was rejected. It is invalid, revoked, or missing a required scope.", httpStatus: 401 };
  }
  if (apiStatus === "PERMISSION_DENIED" || apiCode === 403) {
    return { code: "UNAUTHORIZED", message: "Gemini access was denied. The API key may be revoked or not authorized for this project.", httpStatus: 403 };
  }
  if (apiStatus === "RESOURCE_EXHAUSTED" || apiCode === 429 || /quota|rate limit|billing/i.test(lower)) {
    return { code: "QUOTA_EXCEEDED", message: "Gemini quota or billing limit reached. Check the API key's usage and billing settings.", httpStatus: 429 };
  }
  if (apiCode === 404 || apiStatus === "NOT_FOUND" || /no longer available|model not found/i.test(lower)) {
    return { code: "MODEL_NOT_FOUND", message: "The Gemini model is not available for this API key. The model may have changed.", httpStatus: 404 };
  }
  if (/api key not valid|invalid api key|apikey|invalid argument/i.test(lower) && (apiCode === 400 || apiStatus === "INVALID_ARGUMENT")) {
    return { code: "INVALID_API_KEY", message: "The Gemini API key is not valid. Check that you pasted the full key.", httpStatus: 400 };
  }

  return { code: "SERVER_ERROR", message: raw, httpStatus: 500 };
}

/**
 * Test a Gemini connection with the given key using the cheapest reliable call.
 * Returns a structured diagnosis: `{ ok: true }` on success.
 */
export async function testGeminiConnection(apiKey: string): Promise<{ ok: true } | { ok: false; diagnosis: GeminiDiagnosis }> {
  if (!apiKey.trim()) {
    return { ok: false, diagnosis: { code: "NO_API_KEY", message: "No Gemini API key configured.", httpStatus: 503 } };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  await ai.models.generateContent({
    model: getGeminiModel(),
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
      config: { maxOutputTokens: 1 },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, diagnosis: diagnoseGeminiError(error) };
  }
}