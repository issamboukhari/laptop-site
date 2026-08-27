"use client";

import { useRef, useEffect, useState } from "react";
import { Sparkles, AlertTriangle, RefreshCw, X, KeyRound, Wrench, WifiOff } from "lucide-react";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { useGeminiChat } from "@/hooks/use-gemini-chat";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { GeminiSetupDialog } from "./GeminiSetupDialog";
import { cn } from "@/lib/utils/cn";

const EXAMPLE_QUESTIONS = [
  "Which one is better for gaming?",
  "Which is better for programming?",
  "Why is one rated higher overall?",
  "How big is the price difference?",
  "Which has better battery life?",
  "Can it run Cyberpunk 2077?",
];

interface GeminiChatPanelProps {
  computerIds: string[];
}

export function GeminiChatPanel({ computerIds }: GeminiChatPanelProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useGeminiChat({
    computerIds,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const { online } = useOnlineStatus();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const retry = () => {
    const q = lastQuestion || "Compare these two computers for me.";
    setLastQuestion(q);
    sendMessage(q);
  };

  return (
    <section className="animate-fade-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gen-accent" />
          <h3 className="text-base font-semibold text-gen-fg">Ask Gemini</h3>
        </div>
        <span className="text-xs text-gen-muted">about the computers above</span>
      </div>

      <div className="rounded-2xl border border-gen-accent/20 bg-gen-card gen-card-shadow overflow-hidden">
        <div className="p-4 border-b border-gen-border flex items-center justify-between">
          <p className="text-xs text-gen-muted">
            Gemini automatically sees the exact configurations you selected.
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSetupOpen(true)}
              className="flex items-center gap-1 text-xs text-gen-muted hover:text-gen-fg transition-colors"
              title="Configure Gemini API key"
            >
              <Wrench className="w-3.5 h-3.5" />
              Configure
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1 text-xs text-gen-muted hover:text-gen-fg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear chat
              </button>
            )}
          </div>
        </div>

        {/* Offline warning */}
        {!online && (
          <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">
              AI Chat requires an internet connection. Connect to use Gemini.
            </p>
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex flex-col gap-3 p-4 max-h-[420px] overflow-y-auto bg-gen-bg/40"
        >
          {computerIds.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-gen-card-hover flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-gen-muted" />
              </div>
              <p className="text-sm text-gen-fg mb-1">No computer selected yet</p>
              <p className="text-xs text-gen-muted mb-2 max-w-sm mx-auto">
                Add computers to your comparison first — Gemini will automatically know
                their exact configurations and ratings.
              </p>
            </div>
          )}

          {computerIds.length > 0 && messages.length === 0 && !error && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-gen-accent/10 flex items-center justify-center mx-auto mb-3 animate-pop">
                <Sparkles className="w-6 h-6 text-gen-accent" />
              </div>
              <p className="text-sm text-gen-fg mb-1">Ask anything about these computers</p>
              <p className="text-xs text-gen-muted mb-5">
                Gaming, programming, price, battery, long-term use — Gemini already knows
                their specs and ratings.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={q}
                    onClick={() => {
                      setLastQuestion(q);
                      sendMessage(q);
                    }}
                    disabled={isLoading}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-gen-border bg-gen-card text-gen-muted hover:text-gen-fg hover:border-gen-accent/40 hover:scale-[1.03] transition-all disabled:opacity-50 animate-pop"
                    style={{ animationDelay: `${80 + i * 40}ms` }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className={cn(
                "rounded-xl border p-4 animate-fade-up",
                error.isConfigIssue
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-red-500/30 bg-red-500/10"
              )}
            >
              {error.isConfigIssue ? (
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-400">{error.title}</p>
                    <p className="text-xs text-gen-fg/80 mt-1">{error.message}</p>
                    <button
                      onClick={() => setSetupOpen(true)}
                      className="mt-3 flex items-center gap-1.5 rounded-lg bg-gen-accent text-white px-3 py-2 text-xs font-medium hover:bg-gen-accent-light transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Add Gemini API key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-400">{error.title}</p>
                    <p className="text-xs text-gen-fg/80 mt-1">{error.message}</p>
                    <button
                      onClick={retry}
                      disabled={isLoading}
                      className="mt-3 flex items-center gap-1.5 text-xs text-gen-fg hover:text-gen-accent transition-colors"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                      {isLoading ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="animate-slide-in">
              <ChatBubble role={msg.role} content={msg.content} />
            </div>
          ))}

          {isLoading && <TypingIndicator />}
        </div>

        <div className="p-4 border-t border-gen-border bg-gen-card">
          <ChatInput
            onSend={(q) => {
              setLastQuestion(q);
              sendMessage(q);
            }}
            disabled={isLoading || computerIds.length === 0 || !online}
          />
        </div>
      </div>

      {setupOpen && (
        <GeminiSetupDialog
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          onConfigured={() => {
            clearMessages();
            retry();
          }}
        />
      )}
    </section>
  );
}