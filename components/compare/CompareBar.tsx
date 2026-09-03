"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useCompareSelection } from "@/hooks/use-compare-selection";
import {
  resolveVariantSync,
  useRemoteComputers,
} from "@/hooks/use-remote-computer";
import { formatPrice } from "@/lib/utils/format";
import { X, ArrowRight, Loader2, AlertTriangle, Scale } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SlotState {
  id: string;
  variant?: NonNullable<ReturnType<typeof resolveVariantSync>>;
  loading: boolean;
  failed: boolean;
}

export function CompareBar() {
  // Client-only gate: the selection store reads localStorage, which does
  // not exist during SSR. Stable false on server + first client render.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { selectedIds, remove, clear } = useCompareSelection();
  const remote = useRemoteComputers(selectedIds);

  if (!mounted || selectedIds.length === 0) return null;

  const slots: SlotState[] = selectedIds.map((id) => {
    const variant = resolveVariantSync(id) ?? remote.get(id)?.variant;
    const entry = remote.get(id);
    return {
      id,
      variant,
      loading: !variant && !entry?.failed,
      failed: !variant && Boolean(entry?.failed),
    };
  });

  const resolved = slots.filter((s): s is SlotState & { variant: NonNullable<SlotState["variant"]> } =>
    Boolean(s.variant)
  );
  const readyToCompare = resolved.length === 2;
  const count = selectedIds.length;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-2xl pointer-events-none pb-safe"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto rounded-xl bg-gen-card/95 backdrop-blur-md border border-gen-border shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 px-2 py-2">
          {/* Selection counter + Scale icon */}
          <div className="shrink-0 flex items-center gap-1.5 px-2">
            <Scale className="w-3.5 h-3.5 text-gen-accent" />
            <span className="text-[11px] font-bold text-gen-accent">
              {count}/2
            </span>
          </div>

          {/* Slot dots */}
          <div className="shrink-0 flex items-center gap-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-200",
                  i < count ? "bg-gen-accent scale-100" : "bg-gen-border scale-75"
                )}
              />
            ))}
          </div>

          {/* Mini chips */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {slots.map((slot) =>
              slot.variant ? (
                <div
                  key={slot.id}
                  className="flex items-center gap-1 min-w-0 flex-1 rounded-lg bg-gen-card-hover border border-gen-border pl-2 pr-0.5 py-1"
                  title={`${slot.variant.brand} ${slot.variant.name}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-gen-fg truncate">
                      {slot.variant.name}
                    </span>
                    <span className="block text-[10px] text-gen-muted truncate">
                      {formatPrice(slot.variant.price)}
                    </span>
                  </span>
                  <button
                    onClick={() => remove(slot.id)}
                    className="shrink-0 h-5 w-5 rounded-md flex items-center justify-center text-gen-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    aria-label={`Remove ${slot.variant.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : slot.loading ? (
                <div
                  key={slot.id}
                  className="flex items-center gap-1.5 flex-1 rounded-lg border border-dashed border-gen-border px-2 py-1 text-gen-muted"
                >
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span className="text-[11px] truncate">Loading…</span>
                  <button
                    onClick={() => remove(slot.id)}
                    className="shrink-0 ml-auto h-5 w-5 rounded-md flex items-center justify-center hover:text-gen-fg cursor-pointer"
                    aria-label="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  key={slot.id}
                  className="flex items-center gap-1.5 flex-1 rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1 text-red-400"
                >
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="text-[11px] truncate">Unavailable</span>
                  <button
                    onClick={() => remove(slot.id)}
                    className="shrink-0 ml-auto h-5 w-5 rounded-md flex items-center justify-center hover:text-gen-fg cursor-pointer"
                    aria-label="Remove unavailable computer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            )}

            {selectedIds.length === 1 && (
              <span className="hidden sm:block text-[11px] text-gen-muted px-1 whitespace-nowrap">
                Pick one more…
              </span>
            )}
          </div>

          {/* Clear button */}
          <button
            onClick={clear}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover transition-colors cursor-pointer"
            aria-label="Clear comparison"
            title="Clear comparison"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Compare button */}
          {readyToCompare && (
            <Link
              href={`/compare?a=${encodeURIComponent(resolved[0].variant.id)}&b=${encodeURIComponent(
                resolved[1].variant.id
              )}`}
              className="shrink-0 h-8 px-4 rounded-lg bg-gen-accent text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-gen-accent-light transition-colors shadow-sm shadow-gen-accent/25"
            >
              Compare
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function CompareBarSpacer({ className }: { className?: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { selectedIds } = useCompareSelection();

  if (!mounted || selectedIds.length === 0) return null;
  return <div aria-hidden className={cn("h-20", className)} />;
}
