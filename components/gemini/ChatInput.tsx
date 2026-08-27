"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about these computers..."
        disabled={disabled}
        rows={1}
        maxLength={2000}
        className="flex-1 resize-none rounded-xl border border-gen-border bg-gen-card px-4 py-3 text-sm text-gen-fg placeholder:text-gen-muted focus:outline-none focus:ring-2 focus:ring-gen-accent/40 focus:border-gen-accent/40 transition-all min-h-[44px] max-h-24 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className="h-11 w-11 rounded-xl bg-gen-accent text-white flex items-center justify-center hover:bg-gen-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        aria-label="Send message"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
