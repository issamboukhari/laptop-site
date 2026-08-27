import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { findVariantById, getModelById } from "@/lib/server/database";
import { ComputerVariant } from "@/lib/data/types";
import { calculateRatings, RATING_DEFINITIONS } from "@/lib/scoring/ratings";
import { describeHardware } from "@/lib/scoring/hardware";
import {
  ApiError,
  asStringArray,
  assertContentLength,
  errorResponse,
  logError,
  parseJsonBody,
  requireString,
} from "@/lib/server/api-utils";
import { getGeminiApiKey, getGeminiModel, getFallbackModel, diagnoseGeminiError, classifyGeminiFailure, isGroundingBlocked, isPrimaryModelBlocked, blockGrounding, blockPrimaryModel } from "@/lib/server/gemini";

/** Bilingual expert advisor — responds in the user's language (Arabic or English). */
const SYSTEM_PROMPT = `You are gen — an expert computer advisor and hardware analyst. You chat naturally with users about computers.

LANGUAGE (critical):
- Detect the user's language from their question. Respond in the SAME language (Arabic ↔ English).
- If the question is in Arabic, answer in natural Arabic. If English, answer in English. Mixed = match the dominant language.
- Keep technical terms (CPU names, GPU names, RAM, NVMe, OLED, benchmark terms) in English even when answering in Arabic — e.g. "معالج Intel Core Ultra 7 155H من فئة H-class".

ACCURACY:
- Use ONLY specs and ratings from the context. NEVER invent numbers, benchmarks, or scores. Unknown = "Not available" / "غير متوفر".
- Trust the provided "Ratings/100" — they are hardware-class-aware (U≤72, H≤93, HX≤97, integrated GPU ≤58, panel/storage class). Never second-guess.
- When Google Search grounding is available, use it to enrich with current prices, benchmarks, and reviews — but ALWAYS ground analysis in the provided specs first.
- Reason from the ACTUAL component strengths (CPU class, dedicated-vs-integrated GPU tier, RAM capacity, panel type, storage speed) and explain WHY a rating is what it is — never quote scores without the hardware behind them.

STYLE — natural, flexible, expert:
- Answer the ACTUAL question directly — like a knowledgeable friend who knows both machines inside out.
- Focused question → focused answer (don't dump everything).
- Be conversational, warm, and concise. Vary phrasing — never repeat canned responses.
- Cite specific numbers from the context when relevant.

COMPARISON MODE (user asks which is better / overall):
- Open with a bold verdict backed by 2-4 decisive numbers.
- Then key differences; end with who should buy which. Never fence-sit.

When the selected computers don't fit the need, suggest what hardware class to look for instead.`;

const QUESTION_MAX_LENGTH = 2000;
/** Only the newest 4 messages are sent to Gemini — faster + cheaper tokens. */
const HISTORY_MAX_ITEMS = 4;
const MAX_OUTPUT_TOKENS = 2048;
const OVERALL_TIMEOUT_MS = 90_000;

function ratingsLine(c: ComputerVariant): string {
  const ratings = calculateRatings(c);
  return RATING_DEFINITIONS
    .filter((r) => ["gaming", "programming", "university", "performance", "value", "battery"].includes(r.id))
    .map((r) => `${r.icon}${ratings[r.id].score}`)
    .join(" · ");
}

function formatComputer(c: ComputerVariant): string {
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

interface HistoryItem { role: string; text: string; }

function parseHistory(value: unknown): HistoryItem[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError("VALIDATION_ERROR", "Chat history must be an array.");
  return value.slice(-HISTORY_MAX_ITEMS).map((item, i) => {
    if (!item || typeof item !== "object") throw new ApiError("VALIDATION_ERROR", `history[${i}] must be an object.`);
    const role = (item as Record<string, unknown>).role;
    const text = (item as Record<string, unknown>).text;
    if (role !== "user" && role !== "assistant") throw new ApiError("VALIDATION_ERROR", `history[${i}].role must be "user" or "assistant".`);
    if (typeof text !== "string") throw new ApiError("VALIDATION_ERROR", `history[${i}].text must be a string.`);
    return { role, text: text.slice(0, QUESTION_MAX_LENGTH) };
  });
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const diagnosis = diagnoseGeminiError(error);
  return new ApiError("GEMINI_ERROR", diagnosis.message, {
    status: diagnosis.httpStatus,
    technical: diagnosis.message,
    details: { geminiCode: diagnosis.code },
  });
}

async function startGeminiStream(
  ai: GoogleGenAI,
  model: string,
  contents: ReturnType<typeof buildContents>,
  useGrounding: boolean,
): Promise<AsyncIterable<{ text?: string }>> {
  const config: Record<string, unknown> = {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.7,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  if (useGrounding) {
    config["tools"] = [{ googleSearch: {} }];
  }
  return ai.models.generateContentStream({
    model,
    contents,
    config: config as never,
  });
}

function buildContents(history: HistoryItem[], userPrompt: string) {
  return [
    ...history.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.text }],
    })),
    { role: "user" as const, parts: [{ text: userPrompt }] },
  ];
}

export async function POST(request: NextRequest) {
  try {
    assertContentLength(request, 256 * 1024);
    const body = await parseJsonBody(request);

    const question = requireString(body.question, "question", QUESTION_MAX_LENGTH);
    const computerIds = asStringArray(body.computerIds, "computerIds", { maxItems: 4, itemMaxLength: 200 });
    const history = parseHistory(body.history);

    // Resolve all selected computers in parallel — one lightweight catalog
    // pass (cached), fully independent from the Gemini call below.
    const settled = await Promise.all(
      computerIds.map(async (id) => {
        const variant = await findVariantById(id);
        if (variant) return { id, variants: [variant] };
        const model = await getModelById(id);
        if (model && model.variants.length > 0) return { id, variants: model.variants.slice(0, 4) };
        return { id, variants: [] as ComputerVariant[] };
      })
    );
    const resolved: ComputerVariant[] = [];
    const invalidIds: string[] = [];
    for (const s of settled) {
      if (s.variants.length > 0) resolved.push(...s.variants);
      else invalidIds.push(s.id);
    }

    if (invalidIds.length > 0) logError("POST /api/chat:unknown-computer-ids", null, { invalidIds });

    if (resolved.length === 0) {
      throw new ApiError("NO_COMPUTERS_SELECTED", "Select at least one computer to compare before asking the AI.", { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new ApiError("NO_API_KEY", "Gemini AI is not configured yet. Add a Gemini API key to use this feature.");

    const computerContext = resolved.map(formatComputer).join("\n\n");
    const userPrompt = `## Computers\n${computerContext}\n\n## Question\n${question}`;
    const contents = buildContents(history, userPrompt);
    const ai = new GoogleGenAI({ apiKey });

    // ---- SSE streaming with smart fallback chain ----
    // Order: primary+grounding → primary → fallback model. The circuit
    // breaker skips configs that recently failed (quota/overload/404) so a
    // single broken tool never stalls or breaks the chat.
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

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
            try {
              const streamResult = await startGeminiStream(ai, model, contents, grounding);

              let full = "";
              const overallDeadline = Date.now() + OVERALL_TIMEOUT_MS;

              for await (const chunk of streamResult) {
                if (Date.now() > overallDeadline) {
                  throw new ApiError("TIMEOUT", "Response took too long. Please try a shorter question.", {
                    technical: `overall timeout ${OVERALL_TIMEOUT_MS}ms`,
                  });
                }
                const text = chunk.text;
                if (text) {
                  full += text;
                  send({ type: "chunk", text });
                }
              }

              if (!full.trim()) {
                logError("POST /api/chat:empty-response", null, { model });
                send({ type: "error", code: "GEMINI_ERROR", message: "Gemini returned an empty response. Please try again." });
              } else {
                send({ type: "done" });
              }
              controller.close();
              return;
            } catch (streamError) {
              lastError = streamError;
              const kind = classifyGeminiFailure(streamError);
              logError(`POST /api/chat:attempt ${model}${grounding ? "+grounding" : ""} [${kind}]`, streamError);

              // Remember broken configs so later requests skip them instantly.
              if ((kind === "quota" || kind === "tool_error") && grounding) blockGrounding();
              if (kind === "overloaded" || kind === "model_missing") {
                if (model === getGeminiModel()) blockPrimaryModel();
                break; // this model is dead for now — next config
              }
              if (kind === "network" && tryNum === 0) continue; // retry once
              break; // move to next config
            }
          }
        }

        // All configurations exhausted — surface the most useful error.
        const apiError = lastError instanceof ApiError ? lastError : toApiError(lastError);
        logError("POST /api/chat:final", lastError);
        send({ type: "error", code: apiError.code, message: apiError.userMessage });
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) logError("POST /api/chat", error);
    return errorResponse(error, "POST /api/chat");
  }
}
