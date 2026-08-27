"use client";

import { useMemo } from "react";
import { ComputerModel, ComputerCategory } from "@/lib/data/types";
import { CATEGORY_LABELS } from "@/lib/data/categories";
import { ComputerCard } from "./ComputerCard";

const CATEGORY_ICONS: Record<string, string> = {
  "gaming-laptop": "🎮",
  "business-laptop": "💼",
  ultrabook: "🪶",
  macbook: "",
  workstation: "🛠️",
  desktop: "🗄️",
  "mini-pc": "📦",
};

const CATEGORY_ORDER: ComputerCategory[] = [
  "gaming-laptop",
  "business-laptop",
  "ultrabook",
  "macbook",
  "workstation",
  "desktop",
  "mini-pc",
];

interface ComputerGridProps {
  models: ComputerModel[];
  /** Query fragments highlighted on each card (why-this-result). */
  highlight?: string[];
  /** Group results under category headers (Gaming, Business, …). */
  grouped?: boolean;
}

export function ComputerGrid({ models, highlight, grouped = false }: ComputerGridProps) {
  const sections = useMemo(() => {
    if (!grouped || models.length < 4) return null;

    const byCat = new Map<ComputerCategory, ComputerModel[]>();
    for (const m of models) {
      const list = byCat.get(m.category);
      if (list) list.push(m);
      else byCat.set(m.category, [m]);
    }
    if (byCat.size < 2) return null; // one category → flat grid reads better

    return [...byCat.entries()]
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]) ||
          b[1].length - a[1].length
      )
      .map(([category, items]) => ({ category, items }));
  }, [models, grouped]);

  if (models.length === 0 && !sections) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4 opacity-30">💻</div>
        <h3 className="text-lg font-semibold text-gen-fg">No computers found</h3>
        <p className="text-sm text-gen-muted mt-1">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  if (!sections) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {models.map((model) => (
          <ComputerCard key={model.id} model={model} highlight={highlight} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map(({ category, items }) => (
        <section key={category}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-base leading-none">{CATEGORY_ICONS[category] ?? "💻"}</span>
            <h3 className="text-sm font-bold text-gen-fg tracking-wide">
              {CATEGORY_LABELS[category]}
            </h3>
            <span className="h-5 px-1.5 rounded-md bg-gen-accent/10 text-gen-accent text-[10px] font-bold flex items-center justify-center">
              {items.length}
            </span>
            <div className="flex-1 h-px bg-gen-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((model) => (
              <ComputerCard key={model.id} model={model} highlight={highlight} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
