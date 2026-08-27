"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";
import { AutocompleteResult } from "@/lib/data/types";
import { Search, Box, Layers, Building2, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SmartSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra ms added on top of the base debounce. */
  debounceMs?: number;
}

type FlatSuggestion =
  | { kind: "model"; id: string; label: string; sub?: string }
  | { kind: "text"; label: string; sub?: string };

const EMPTY: AutocompleteResult = { brands: [], families: [], models: [] };

/**
 * Google-style search box:
 * - debounced live suggestions from /api/autocomplete (no Gemini involved)
 * - keyboard navigation (↑ ↓ Enter Escape)
 * - selecting a model suggestion navigates to its page; brand/family
 *   suggestions refine the query text
 */
export function SmartSearch({
  value,
  onChange,
  placeholder = "Search computers… (HP, ThinkPad T14, RTX 4070)",
  debounceMs = 130,
}: SmartSearchProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<AutocompleteResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const fetchSuggestions = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setSuggestions(EMPTY);
        setOpen(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const reqId = ++requestIdRef.current;

      try {
        const res = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          // Suggestions are non-critical: fail quietly, never block typing.
          if (reqId === requestIdRef.current) {
            setSuggestions(EMPTY);
            setOpen(false);
          }
          return;
        }
        const data: AutocompleteResult = await res.json();
        if (reqId !== requestIdRef.current || controller.signal.aborted) return;
        setSuggestions(data);
        const hasAny =
          data.models.length > 0 || data.families.length > 0 || data.brands.length > 0;
        setOpen(hasAny);
        setHighlighted(-1);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (reqId === requestIdRef.current) {
          setSuggestions(EMPTY);
          setOpen(false);
        }
      }
    },
    []
  );

  // Debounce while typing.
  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(value), debounceMs);
    return () => clearTimeout(t);
  }, [value, debounceMs, fetchSuggestions]);

  const flat: FlatSuggestion[] = [
    ...suggestions.models.map<FlatSuggestion>((m) => ({
      kind: "model",
      id: m.id,
      label: m.text,
      sub: m.family ? `${m.brand} · ${m.family}` : m.brand,
    })),
    ...suggestions.families.map<FlatSuggestion>((f) => ({
      kind: "text",
      label: f.text,
      sub: `${f.count} model${f.count !== 1 ? "s" : ""}`,
    })),
    ...suggestions.brands.map<FlatSuggestion>((b) => ({
      kind: "text",
      label: b.text,
      sub: `${b.count} model${b.count !== 1 ? "s" : ""}`,
    })),
  ];

  const applySuggestion = useCallback(
    (s: FlatSuggestion) => {
      setOpen(false);
      if (s.kind === "model") {
        router.push(`/computer/${encodeURIComponent(s.id)}`);
      } else {
        onChange(s.label);
      }
    },
    [onChange, router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flat.length === 0) {
      if (e.key === "Escape") {
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? flat.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      if (highlighted >= 0 && highlighted < flat.length) {
        e.preventDefault();
        applySuggestion(flat[highlighted]);
      } else {
        // Plain Enter: run the full smart search for the typed query.
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && flat.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <SearchInput
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (flat.length > 0 && value.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="smart-search-suggestions"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover transition-colors cursor-pointer"
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showDropdown && (
        <ul
          id="smart-search-suggestions"
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl border border-gen-border bg-gen-card shadow-2xl shadow-black/20 overflow-hidden max-h-[380px] overflow-y-auto"
        >
          {suggestions.models.length > 0 && (
            <li className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gen-muted">
              <Search className="w-3 h-3" /> Models
            </li>
          )}
          {suggestions.models.map((m) => {
            const idx = flat.findIndex((f) => f.kind === "model" && f.id === m.id);
            return (
              <li key={`m-${m.id}`} role="option" aria-selected={idx === highlighted}>
                <button
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => applySuggestion(flat[idx])}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer",
                    idx === highlighted ? "bg-gen-accent/10" : "hover:bg-gen-card-hover"
                  )}
                >
                  <Box className="w-4 h-4 text-gen-accent shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gen-fg truncate">
                      {m.text}
                    </span>
                    {m.family && (
                      <span className="block text-[11px] text-gen-muted truncate">
                        {m.brand} · {m.family}
                      </span>
                    )}
                  </span>
                  <CornerDownLeft className="w-3.5 h-3.5 text-gen-muted opacity-0 shrink-0 data-[show=true]:opacity-100" />
                </button>
              </li>
            );
          })}

          {suggestions.families.length > 0 && (
            <li className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gen-muted">
              <Layers className="w-3 h-3" /> Series
            </li>
          )}
          {suggestions.families.map((f) => {
            const idx = flat.findIndex((x) => x.kind === "text" && x.label === f.text);
            return (
              <li key={`f-${f.brand}-${f.text}`} role="option" aria-selected={idx === highlighted}>
                <button
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => applySuggestion(flat[idx])}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer",
                    idx === highlighted ? "bg-gen-accent/10" : "hover:bg-gen-card-hover"
                  )}
                >
                  <Layers className="w-4 h-4 text-gen-muted shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-gen-fg truncate">{f.text}</span>
                  </span>
                  <span className="text-[11px] text-gen-muted shrink-0">{f.count}</span>
                </button>
              </li>
            );
          })}

          {suggestions.brands.length > 0 && (
            <li className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gen-muted">
              <Building2 className="w-3 h-3" /> Brands
            </li>
          )}
          {suggestions.brands.map((b) => {
            const idx = flat.findIndex((x) => x.kind === "text" && x.label === b.text);
            return (
              <li key={`b-${b.text}`} role="option" aria-selected={idx === highlighted}>
                <button
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => applySuggestion(flat[idx])}
                  className={cn(
                    "w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors cursor-pointer",
                    idx === highlighted ? "bg-gen-accent/10" : "hover:bg-gen-card-hover"
                  )}
                >
                  <Building2 className="w-4 h-4 text-gen-muted shrink-0" />
                  <span className="flex-1 text-sm text-gen-fg truncate">{b.text}</span>
                  <span className="text-[11px] text-gen-muted shrink-0">{b.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
