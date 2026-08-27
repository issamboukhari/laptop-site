"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ComputerModel, ComputerVariant } from "@/lib/data/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatRam, formatStorage } from "@/lib/utils/format";
import { X, Cpu, HardDrive, Monitor, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AddComputerPickerProps {
  open: boolean;
  title?: string;
  excludeIds?: string[];
  onSelect: (variantId: string) => void;
  onClose: () => void;
}

interface PickerError {
  message: string;
}

/**
 * Modal dialog for picking a computer (model → exact configuration) without
 * leaving the comparison workspace. Talks to /api/search and surfaces clean,
 * retryable error states — never raw failures.
 */
export function AddComputerPicker({
  open,
  title = "Add a computer",
  excludeIds = [],
  onSelect,
  onClose,
}: AddComputerPickerProps) {
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<ComputerModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PickerError | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [staleQuery, setStaleQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + focus each time the dialog opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setModels([]);
      setError(null);
      setExpandedId(null);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fetchResults = useCallback(
    async (q: string, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "8" });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/search?${params.toString()}`, { signal });

        if (!res.ok) {
          let message = "Unable to search right now. Please try again.";
          try {
            const err = await res.json();
            if (typeof err?.error?.message === "string") message = err.error.message;
          } catch {
            // keep default
          }
          throw new Error(message);
        }

        const data = await res.json();
        setModels(data.models ?? []);
        setStaleQuery(q);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setModels([]);
        setError({ message: e instanceof Error ? e.message : "Unable to search. Please try again." });
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    []
  );

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(() => fetchResults(query, controller.signal), 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open, fetchResults]);

  if (!open) return null;

  const handleSelectVariant = (variant: ComputerVariant) => {
    if (excludeIds.includes(variant.id)) return;
    onSelect(variant.id);
    onClose();
  };

  const retry = () => {
    const controller = new AbortController();
    fetchResults(query, controller.signal);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[8vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-gen-border bg-gen-card shadow-2xl overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gen-border">
          <h3 className="text-sm font-semibold text-gen-fg">{title}</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <SearchInput
            ref={inputRef}
            placeholder="Search by name, brand, CPU or GPU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className="max-h-[52vh] overflow-y-auto px-4 pb-4">
          {error && (
            <div className="flex flex-col items-center text-center py-10">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-sm font-medium text-gen-fg">{error.message}</p>
              <button
                onClick={retry}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-gen-accent/10 text-gen-accent text-xs font-medium hover:bg-gen-accent/20 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {!error && loading && models.length === 0 && (
            <div className="py-10 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gen-card-hover animate-pulse" />
              ))}
            </div>
          )}

          {!error && !loading && models.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-gen-fg">No computers found</p>
              <p className="text-xs text-gen-muted mt-1">
                {staleQuery.trim()
                  ? `Nothing matches "${staleQuery.trim()}". Try a different search.`
                  : "Start typing to search all computers."}
              </p>
            </div>
          )}

          {!error && (
            <ul className="space-y-2">
              {models.map((model) => {
                const selectableVariants = model.variants.filter(
                  (v) => !excludeIds.includes(v.id)
                );
                if (selectableVariants.length === 0) return null;
                const expanded = expandedId === model.id;
                return (
                  <li
                    key={model.id}
                    className="rounded-xl border border-gen-border bg-gen-card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(expanded ? null : model.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gen-card-hover transition-colors cursor-pointer text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] text-gen-muted uppercase tracking-wider">
                          {model.brand} · {model.variants.length} config{model.variants.length !== 1 ? "s" : ""}
                        </p>
                        <p className="text-sm font-medium text-gen-fg truncate">{model.name}</p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-gen-muted shrink-0 transition-transform duration-200",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>

                    {expanded && (
                      <ul className="border-t border-gen-border divide-y divide-gen-border">
                        {selectableVariants.map((variant) => (
                          <li key={variant.id}>
                            <button
                              onClick={() => handleSelectVariant(variant)}
                              className="w-full px-3 py-2.5 hover:bg-gen-accent/5 transition-colors cursor-pointer text-left group"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold text-gen-fg truncate">
                                  {variant.name}
                                </span>
                                <Badge variant="outline" className="shrink-0">
                                  {formatPrice(variant.price)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gen-muted">
                                <span className="inline-flex items-center gap-1">
                                  <Cpu className="w-3 h-3" /> {variant.specs.cpu}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <HardDrive className="w-3 h-3" />
                                  {formatRam(variant.specs.ram)} · {formatStorage(variant.specs.storage)}
                                </span>
                                <span className="inline-flex items-center gap-1 min-w-0">
                                  <Monitor className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{variant.specs.display}</span>
                                </span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
