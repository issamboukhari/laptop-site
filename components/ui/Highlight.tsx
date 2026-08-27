"use client";

import React from "react";

const MARK_CLASS = "bg-gen-accent/25 text-gen-fg rounded-[3px] px-0.5";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlights every occurrence of the given terms inside `text`.
 * Used on search-result cards so users see WHY a computer appeared
 * (the GPU/RAM/CPU fragment they searched for glows).
 */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  const clean = (terms ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (clean.length === 0) return <>{text}</>;

  let pattern: RegExp;
  try {
    pattern = new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "i");
  } catch {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${clean.map(escapeRegExp).join("|")})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part && pattern.test(part) ? (
          <mark key={i} className={MARK_CLASS}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
