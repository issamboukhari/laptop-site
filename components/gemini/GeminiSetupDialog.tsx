"use client";

import { useState, useCallback } from "react";
import {
  KeyRound,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface GeminiSetupDialogProps {
  open: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

type Status = "idle" | "testing" | "saving" | "success" | "error";

const EXPLANATION_LINES = [
  "Your key is sent to this server over an encrypted connection and stored server-side only.",
  "It is never saved in the browser, never shown back to you, and never committed to the repository.",
  "Recommended: set GEMINI_API_KEY in the server's environment or .env.local for the long term.",
  "Get a key at Google AI Studio (https://aistudio.google.com/apikey).",
];

const CODE_MESSAGES: Record<string, string> = {
  NO_API_KEY: "No API key was provided. Paste your Gemini API key to continue.",
  INVALID_API_KEY: "The Gemini API key is invalid or rejected. Check that you pasted the full key.",
  UNAUTHORIZED:
    "The Gemini API key is not authorized — it may be revoked or disabled. Generate a new key.",
  QUOTA_EXCEEDED:
    "The Gemini API key has reached its quota or billing limit. Check billing settings or use a new key.",
  MODEL_NOT_FOUND: "The Gemini model is not available for this key. The model may have changed.",
  SERVER_ERROR: "The server could not reach Gemini. Try again in a moment.",
  NETWORK: "Could not reach the server. Check your connection.",
};

export function GeminiSetupDialog({ open, onClose, onConfigured }: GeminiSetupDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const run = useCallback(
    async (endpoint: string, body: Record<string, unknown>) => {
      setStatus(endpoint === "/api/gemini/config" ? "saving" : "testing");
      setMessage("");
      setErrorCode("");
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data?.ok) {
          setStatus("success");
          setMessage(data.message || "Gemini connected successfully");
          return true;
        }
        setStatus("error");
        setErrorCode(String(data?.code || "SERVER_ERROR"));
        setMessage(
          CODE_MESSAGES[String(data?.code)] ||
            data?.error ||
            "Gemini connection failed. Please check the key and try again."
        );
        return false;
      } catch {
        setStatus("error");
        setErrorCode("NETWORK");
        setMessage("Could not reach the server. Check your connection and try again.");
        return false;
      }
    },
    []
  );

  const handleTest = async () => {
    await run("/api/gemini/test", { apiKey: apiKey.trim() || undefined });
  };

  const handleSave = async () => {
    const ok = await run("/api/gemini/config", { apiKey: apiKey.trim() });
    if (ok) {
      setTimeout(() => {
        onClose();
        onConfigured?.();
      }, 900);
    }
  };

  const reset = () => {
    setApiKey("");
    setShowKey(false);
    setStatus("idle");
    setMessage("");
    setErrorCode("");
  };

  const busy = status === "testing" || status === "saving";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Configure Gemini API key"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          reset();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-gen-border bg-gen-card gen-card-shadow overflow-hidden animate-pop">
        <div className="p-4 border-b border-gen-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-gen-accent" />
            <h3 className="text-base font-semibold text-gen-fg">Configure Gemini API Key</h3>
          </div>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
            className="text-gen-muted hover:text-gen-fg transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-xl border border-gen-border bg-gen-bg/40 p-3 text-xs text-gen-muted">
            <Info className="w-4 h-4 text-gen-accent shrink-0 mt-0.5" />
            <p>
              Gemini AI is not configured. Add your Gemini API key to enable AI features.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gemini-key-input" className="text-xs font-medium text-gen-fg">
              Gemini API key
            </label>
            <div className="relative">
              <input
                id="gemini-key-input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Gemini API key"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-xl border border-gen-border bg-gen-card px-4 py-3 pr-10 text-sm text-gen-fg placeholder:text-gen-muted focus:outline-none focus:ring-2 focus:ring-gen-accent/40 focus:border-gen-accent/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gen-muted hover:text-gen-fg transition-colors"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gen-border bg-gen-bg/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gen-fg mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Where does this key go?
            </div>
            <ul className="flex flex-col gap-1.5 text-xs text-gen-muted">
              {EXPLANATION_LINES.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-gen-accent">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {status === "success" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500 animate-fade-up">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="font-medium">✓ {message}</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 animate-fade-up">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Connection failed</p>
                <p className="text-xs text-gen-fg/80 mt-1">{message}</p>
                {errorCode && (
                  <p className="text-[10px] text-gen-muted mt-1 uppercase tracking-wide">
                    Code: {errorCode}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 items-center">
            <button
              onClick={handleTest}
              disabled={!apiKey.trim() || busy}
              className="flex-1 rounded-xl border border-gen-border bg-gen-card text-gen-fg px-4 py-2.5 text-sm font-medium hover:border-gen-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "testing" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Testing…
                </span>
              ) : (
                "Test Gemini Connection"
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || busy}
              className={cn(
                "flex-1 rounded-xl bg-gen-accent text-white px-4 py-2.5 text-sm font-medium",
                "hover:bg-gen-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {status === "saving" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save & Enable"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}