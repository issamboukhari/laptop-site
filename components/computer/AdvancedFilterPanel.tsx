"use client";

import { useMemo } from "react";
import { ComputerModel } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";
import { SlidersHorizontal, X, RotateCcw, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Filter model
// ---------------------------------------------------------------------------

export type SortMode = "newest" | "price-asc" | "price-desc";

export interface AdvancedFilters {
  ram: number[];
  gpu: string[];
  cpu: string[];
  priceMin: number | null;
  priceMax: number | null;
  sort: SortMode;
}

export const EMPTY_FILTERS: AdvancedFilters = {
  ram: [],
  gpu: [],
  cpu: [],
  priceMin: null,
  priceMax: null,
  sort: "newest",
};

const RAM_OPTIONS = [8, 16, 32, 64];

const GPU_FAMILIES: { id: string; label: string; match: (gpu: string) => boolean }[] = [
  { id: "rtx40", label: "NVIDIA RTX 40 Series", match: (g) => /\brtx\s?4\d{3}\b|rtx 40/i.test(g) },
  { id: "rtx30", label: "NVIDIA RTX 30 Series", match: (g) => /\brtx\s?3\d{3}\b|rtx 30/i.test(g) },
  { id: "radeon", label: "AMD Radeon", match: (g) => /radeon|\brx\s?\d{3,4}\b/i.test(g) },
  { id: "iris", label: "Intel Iris Xe", match: (g) => /iris/i.test(g) },
  { id: "apple", label: "Apple Silicon GPU", match: (g) => /apple m\d/i.test(g) },
];

const CPU_FAMILIES: { id: string; label: string; match: (cpu: string) => boolean }[] = [
  { id: "i5", label: "Intel Core i5", match: (c) => /\bi5\b|core i5/i.test(c) },
  { id: "i7", label: "Intel Core i7", match: (c) => /\bi7\b|core i7/i.test(c) },
  { id: "i9", label: "Intel Core i9", match: (c) => /\bi9\b|core i9/i.test(c) },
  { id: "ryzen5", label: "AMD Ryzen 5", match: (c) => /ryzen\s?5/i.test(c) },
  { id: "ryzen7", label: "AMD Ryzen 7", match: (c) => /ryzen\s?7/i.test(c) },
  { id: "ryzen9", label: "AMD Ryzen 9", match: (c) => /ryzen\s?9/i.test(c) },
  { id: "mseries", label: "Apple M-Series", match: (c) => /apple m[1-4]/i.test(c) },
];

export const PRICE_BOUNDS = { min: 0, max: 6000 };

export function countActiveFilters(f: AdvancedFilters): number {
  return (
    f.ram.length +
    f.gpu.length +
    f.cpu.length +
    (f.priceMin !== null ? 1 : 0) +
    (f.priceMax !== null ? 1 : 0)
  );
}

// Backwards-compatible alias used by HomeClient.
export const countActiveAdvancedFilters = countActiveFilters;

function activeCount(f: AdvancedFilters): number {
  return countActiveFilters(f);
}

// ---------------------------------------------------------------------------
// Matching + sorting engine (instant, client-side over the loaded catalog)
// ---------------------------------------------------------------------------

export function applyAdvancedFilters(
  models: ComputerModel[],
  f: AdvancedFilters
): ComputerModel[] {
  if (activeCount(f) === 0 && f.sort === "newest") return models;

  const filtered = models.filter((m) => {
    let ramOk = f.ram.length === 0;
    let gpuOk = f.gpu.length === 0;
    let cpuOk = f.cpu.length === 0;

    for (const v of m.variants) {
      const s = v.specs;
      if (!ramOk && f.ram.includes(s.ram)) ramOk = true;

      if (!gpuOk) {
        for (const fam of GPU_FAMILIES) {
          if (f.gpu.includes(fam.id) && fam.match(s.gpu)) {
            gpuOk = true;
            break;
          }
        }
      }
      if (!cpuOk) {
        for (const fam of CPU_FAMILIES) {
          if (f.cpu.includes(fam.id) && fam.match(s.cpu)) {
            cpuOk = true;
            break;
          }
        }
      }
      if (ramOk && gpuOk && cpuOk) break;
    }
    if (!ramOk || !gpuOk || !cpuOk) return false;

    // Price range — overlap against the model's min→max variant prices.
    const prices = m.variants.map((v) => v.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    if (f.priceMin !== null && hi < f.priceMin) return false;
    if (f.priceMax !== null && lo > f.priceMax) return false;

    return true;
  });

  const sorted = [...filtered];
  switch (f.sort) {
    case "price-asc":
      sorted.sort((a, b) => minPrice(a) - minPrice(b));
      break;
    case "price-desc":
      sorted.sort((a, b) => minPrice(b) - minPrice(a));
      break;
    default:
      sorted.sort(
        (a, b) =>
          b.year - a.year ||
          b.variants.length - a.variants.length ||
          a.name.localeCompare(b.name)
      );
  }
  return sorted;
}

function minPrice(m: ComputerModel): number {
  return Math.min(...m.variants.map((v) => v.price));
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-10 px-3.5 rounded-xl text-xs font-medium border transition-all duration-200 inline-flex items-center gap-1.5 cursor-pointer",
        selected
          ? "bg-gen-accent text-white border-gen-accent shadow-sm shadow-gen-accent/25"
          : "bg-gen-card text-gen-muted border-gen-border hover:text-gen-fg hover:border-gen-accent/40"
      )}
      aria-pressed={selected}
    >
      {selected && <Check className="w-3 h-3" />}
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-gen-border last:border-0">
      <p className="text-[11px] font-bold text-gen-muted uppercase tracking-wider mb-2.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

interface PanelBodyProps {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  onClear: () => void;
}

function PanelBody({ filters, onChange, onClear }: PanelBodyProps) {
  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  return (
    <div className="px-5 pb-2 max-h-[70vh] overflow-y-auto">
      {/* RAM */}
      <Section title="الرام · RAM">
        {RAM_OPTIONS.map((gb) => (
          <Chip
            key={gb}
            selected={filters.ram.includes(gb)}
            onClick={() => onChange({ ...filters, ram: toggle(filters.ram, gb) })}
          >
            {gb}GB
          </Chip>
        ))}
      </Section>

      {/* GPU */}
      <Section title="كارت الشاشة · GPU">
        {GPU_FAMILIES.map((fam) => (
          <Chip
            key={fam.id}
            selected={filters.gpu.includes(fam.id)}
            onClick={() => onChange({ ...filters, gpu: toggle(filters.gpu, fam.id) })}
          >
            {fam.label}
          </Chip>
        ))}
      </Section>

      {/* CPU */}
      <Section title="المعالج · CPU">
        {CPU_FAMILIES.map((fam) => (
          <Chip
            key={fam.id}
            selected={filters.cpu.includes(fam.id)}
            onClick={() => onChange({ ...filters, cpu: toggle(filters.cpu, fam.id) })}
          >
            {fam.label}
          </Chip>
        ))}
      </Section>

      {/* Price range */}
      <Section title="نطاق السعر (دولار)">
        <div className="w-full space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={PRICE_BOUNDS.min}
              max={PRICE_BOUNDS.max}
              step={100}
              value={filters.priceMin ?? PRICE_BOUNDS.min}
              onChange={(e) =>
                onChange({
                  ...filters,
                  priceMin:
                    Number(e.target.value) <= PRICE_BOUNDS.min
                      ? null
                      : Number(e.target.value),
                })
              }
              className="flex-1 accent-[var(--gen-accent)] cursor-pointer"
              aria-label="Minimum price"
            />
            <span className="text-xs font-semibold text-gen-fg w-20 text-center tabular-nums">
              ${filters.priceMin ?? PRICE_BOUNDS.min}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={PRICE_BOUNDS.min}
              max={PRICE_BOUNDS.max}
              step={100}
              value={filters.priceMax ?? PRICE_BOUNDS.max}
              onChange={(e) =>
                onChange({
                  ...filters,
                  priceMax:
                    Number(e.target.value) >= PRICE_BOUNDS.max
                      ? null
                      : Number(e.target.value),
                })
              }
              className="flex-1 accent-[var(--gen-accent)] cursor-pointer"
              aria-label="Maximum price"
            />
            <span className="text-xs font-semibold text-gen-fg w-20 text-center tabular-nums">
              ${filters.priceMax ?? PRICE_BOUNDS.max}
            </span>
          </div>
        </div>
      </Section>

      {/* Sort */}
      <Section title="الترتيب · Sort">
        <div className="grid grid-cols-3 gap-2 w-full">
          {(
            [
              { id: "newest", label: "الأحدث" },
              { id: "price-desc", label: "الأعلى سعرًا" },
              { id: "price-asc", label: "الأقل سعرًا" },
            ] as { id: SortMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => onChange({ ...filters, sort: opt.id })}
              className={cn(
                "h-10 rounded-xl text-xs font-medium border transition-all duration-200 cursor-pointer",
                filters.sort === opt.id
                  ? "bg-gen-accent text-white border-gen-accent"
                  : "bg-gen-card text-gen-muted border-gen-border hover:text-gen-fg"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {activeCount(filters) > 0 && (
        <button
          onClick={onClear}
          className="mt-3 mb-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          مسح كل الفلاتر ({activeCount(filters)})
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component — desktop sidebar panel + mobile bottom sheet
// ---------------------------------------------------------------------------

interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
}

export function AdvancedFilterPanel({
  open,
  onOpenChange,
  filters,
  onChange,
}: AdvancedFilterPanelProps) {
  const count = activeCount(filters);

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => onOpenChange(!open)}
        className={cn(
          "h-11 px-4 rounded-xl text-sm font-semibold border transition-all duration-200 inline-flex items-center gap-2 cursor-pointer shrink-0",
          count > 0 || open
            ? "bg-gen-accent text-white border-gen-accent"
            : "bg-gen-card text-gen-fg border-gen-border hover:border-gen-accent/40"
        )}
        aria-expanded={open}
      >
        <SlidersHorizontal className="w-4 h-4" />
        فلترة
        {count > 0 && (
          <span className="min-w-5 h-5 px-1 rounded-md bg-white/20 text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {/* Desktop — inline dropdown panel */}
      <div
        className={cn(
          "hidden md:block absolute top-full right-0 mt-2 w-80 z-30 transition-all duration-200 origin-top-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <div className="rounded-2xl border border-gen-border bg-gen-card shadow-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gen-border flex items-center justify-between">
            <p className="text-sm font-bold text-gen-fg">فلترة متقدمة</p>
            <button
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <PanelBody filters={filters} onChange={onChange} onClear={() => onChange(EMPTY_FILTERS)} />
        </div>
      </div>

      {/* Mobile — bottom sheet */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-[90] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-gen-border bg-gen-bg shadow-2xl transition-transform duration-300 ease-out pb-safe",
            open ? "translate-y-0" : "translate-y-full"
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Advanced filters"
        >
          <div className="pt-2 pb-1 flex justify-center">
            <div className="w-10 h-1.5 rounded-full bg-gen-border" />
          </div>
          <div className="px-5 py-2 border-b border-gen-border flex items-center justify-between sticky top-0 bg-gen-bg">
            <p className="text-base font-bold text-gen-fg">فلترة متقدمة</p>
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <PanelBody filters={filters} onChange={onChange} onClear={() => onChange(EMPTY_FILTERS)} />
          <div className="p-4 border-t border-gen-border">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full h-12 rounded-xl bg-gen-accent text-white text-sm font-bold cursor-pointer"
            >
              عرض النتائج
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Hook helper — memoized filter+sort application. */
export function useFilteredModels(models: ComputerModel[], f: AdvancedFilters): ComputerModel[] {
  return useMemo(() => applyAdvancedFilters(models, f), [models, f]);
}
