"use client";

import { ComputerCategory } from "@/lib/data/types";
import { CATEGORY_LABELS } from "@/lib/data/categories";
import { cn } from "@/lib/utils/cn";

interface FilterBarProps {
  selected: ComputerCategory | "all";
  onChange: (category: ComputerCategory | "all") => void;
  counts: Record<string, number>;
}

const ALL_CATEGORIES: (ComputerCategory | "all")[] = [
  "all",
  "gaming-laptop",
  "business-laptop",
  "ultrabook",
  "macbook",
  "workstation",
  "desktop",
  "mini-pc",
];

export function FilterBar({ selected, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 border",
            selected === cat
              ? "bg-gen-accent text-white border-gen-accent shadow-sm"
              : "bg-gen-card text-gen-muted border-gen-border hover:text-gen-fg hover:border-gen-accent/30"
          )}
        >
          {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
          <span className="ml-1.5 text-[10px] opacity-70">
            {cat === "all"
              ? counts.all
              : counts[cat] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}
