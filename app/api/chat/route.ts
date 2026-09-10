import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { findVariantById, getModelById } from "@/lib/server/database";
import {
  resolveChatComputers,
  formatComputer,
  CHAT_SYSTEM_PROMPT,
  buildUserPrompt,
} from "@/lib/server/chat-grounding";
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

const QUESTION_MAX_LENGTH = 2000;
/** Only the newest 4 messages are sent to Gemini — faster + cheaper tokens. */
const HISTORY_MAX_ITEMS = 4;
const MAX_OUTPUT_TOKENS = 2048;
const OVERALL_TIMEOUT_MS = 90_000;

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
    systemInstruction: CHAT_SYSTEM_PROMPT,
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

    // Resolve all selected computers through the catalog — one lightweight,
    // cached database pass (Phase 3.2.6 grounding boundary). Only REAL
    // catalog variants can reach the AI context; anything else is "not found".
    const { resolved, missingIds } = await resolveChatComputers(computerIds, {
      findVariantById,
      getModelById,
    });

    if (missingIds.length > 0) logError("POST /api/chat:not-found-computer-ids", null, { missingIds });

    if (resolved.length === 0) {
      throw new ApiError("NO_COMPUTERS_SELECTED", "Select at least one computer to compare before asking the AI.", { status: 400 });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new ApiError("NO_API_KEY", "Gemini AI is not configured yet. Add a Gemini API key to use this feature.");

    const computerContext = resolved.map(formatComputer).join("\n\n");
    const userPrompt = buildUserPrompt({
      computers: computerContext,
      question,
      missingIds,
    });
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
