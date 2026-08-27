"use client";

import { useState, useCallback, useRef } from "react";
import { ChatMessage } from "@/lib/data/types";

interface UseGeminiChatOptions {
  computerIds: string[];
}

export interface GeminiChatError {
  code: string;
  message: string;
  title: string;
  /** true when the problem is a missing/invalid/revoked/expired/unauthorized API key */
  isConfigIssue: boolean;
}

interface UseGeminiChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: GeminiChatError | null;
  sendMessage: (question: string) => Promise<void>;
  clearMessages: () => void;
}

const CONFIG_CODES = new Set([
  "NO_API_KEY",
  "INVALID_API_KEY",
  "UNAUTHORIZED",
  "QUOTA_EXCEEDED",
  "MODEL_NOT_FOUND",
]);

const ERROR_TITLES: Record<string, string> = {
  NO_API_KEY: "Gemini AI is not configured",
  INVALID_API_KEY: "Invalid Gemini API key",
  UNAUTHORIZED: "Gemini access denied",
  QUOTA_EXCEEDED: "Gemini quota exceeded",
  MODEL_NOT_FOUND: "Gemini model unavailable",
  SERVER_ERROR: "Gemini is unavailable",
  NETWORK: "Network error",
  GEMINI_ERROR: "Gemini is unavailable",
  TIMEOUT: "Request timed out",
  NO_COMPUTERS_SELECTED: "No computer selected",
};

const ERROR_MESSAGES: Record<string, string> = {
  NO_API_KEY: "Gemini AI is not configured. Add your Gemini API key to enable AI features.",
  INVALID_API_KEY:
    "The Gemini API key was rejected. It is invalid, revoked, expired, or unauthorized. Add a valid Gemini API key to continue.",
  UNAUTHORIZED:
    "The Gemini API key was not authorized. It may have been revoked or disabled. Add a new Gemini API key to continue.",
  QUOTA_EXCEEDED:
    "The Gemini API key reached its quota or billing limit. Add a key with available quota to continue.",
  MODEL_NOT_FOUND:
    "The Gemini model is not available for this API key. The model may have changed — update your API key or configuration.",
  SERVER_ERROR: "Could not reach the Gemini API. Please try again in a moment.",
  NETWORK: "Could not reach the server. Check your connection and try again.",
  GEMINI_ERROR: "Gemini could not answer that question right now. Please try again.",
  TIMEOUT: "The request took too long. Please try again.",
  NO_COMPUTERS_SELECTED:
    "Select at least one computer for the comparison first — then ask the AI about it.",
};

/**
 * Streams Gemini answers token-by-token via Server-Sent Events from
 * /api/chat — the reply appears as it is generated instead of after a long
 * blocking wait.
 */
export function useGeminiChat({
  computerIds,
}: UseGeminiChatOptions): UseGeminiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GeminiChatError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      if (isLoading || !question.trim()) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: Date.now(),
      };

      // Assistant placeholder — filled in live as chunks arrive.
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now() + 1,
      };

      setError(null);
      setIsLoading(true);
      setMessages((prev) => [
        ...prev.filter((m) => m.content.trim().length > 0),
        userMsg,
        assistantMsg,
      ]);

      const patchAssistant = (text: string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m))
        );
      };

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            computerIds,
            question,
            history: history.slice(0, -1),
          }),
          signal,
        });

        if (!response.ok) {
          let code = "SERVER_ERROR";
          let serverMessage: string | undefined;
          try {
            const err = await response.json();
            if (err?.error?.code) code = String(err.error.code);
            else if (err?.code) code = String(err.code);
            if (typeof err?.error?.message === "string") serverMessage = err.error.message;
          } catch {
            // keep defaults
          }

          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setError({
            code,
            title: ERROR_TITLES[code] ?? "Gemini is unavailable",
            message:
              ERROR_MESSAGES[code] ??
              serverMessage ??
              "Something went wrong while talking to Gemini. Please try again.",
            isConfigIssue: CONFIG_CODES.has(code),
          });
          return;
        }

        // ---- Consume SSE stream ----
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming is not supported in this browser.");

        const decoder = new TextDecoder();
        let buffer = "";

        const handleEvent = (raw: string) => {
          const line = raw.trim();
          if (!line.startsWith("data:")) return;
          let payload: { type?: string; text?: string; code?: string; message?: string };
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            return;
          }
          if (payload.type === "chunk" && typeof payload.text === "string") {
            patchAssistant(payload.text);
          } else if (payload.type === "error") {
            const code = payload.code ?? "GEMINI_ERROR";
            setError({
              code,
              title: ERROR_TITLES[code] ?? "Gemini is unavailable",
              message: ERROR_MESSAGES[code] ?? payload.message ?? "Please try again.",
              isConfigIssue: CONFIG_CODES.has(code),
            });
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const event = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            handleEvent(event);
          }
        }
        if (buffer.trim()) handleEvent(buffer);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.content.trim().length === 0
              ? ({ ...m, id: crypto.randomUUID(), content: "__REMOVE__" })
              : m
          )
        );
        setMessages((prev) => prev.filter((m) => m.content !== "__REMOVE__"));

        setError({
          code: "NETWORK",
          title: "Network error",
          message: "Could not reach the server. Check your connection and try again.",
          isConfigIssue: false,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [computerIds, messages, isLoading]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
