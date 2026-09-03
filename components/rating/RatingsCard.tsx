"use client";

import { ComputerVariant } from "@/lib/data/types";
import { calculateRatings, RATING_DEFINITIONS } from "@/lib/scoring/ratings";
import { getScoreColor } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color =
    score >= 85
      ? "bg-emerald-500"
      : score >= 70
        ? "bg-blue-500"
        : score >= 50
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-gen-card-hover overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[10px] font-bold tabular-nums", getScoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

export function RatingsCard({ variant }: { variant: ComputerVariant }) {
  const ratings = calculateRatings(variant);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {RATING_DEFINITIONS.map((def) => {
        const r = ratings[def.id];
        return (
          <div
            key={def.id}
            className="rounded-xl border border-gen-border bg-gen-card p-3"
            title={def.description}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{def.icon}</span>
              <span className="text-[11px] font-medium text-gen-muted truncate">
                {def.label}
              </span>
            </div>
            <ScoreBar score={r.score} />
            {r.estimated && (
              <p className="text-[10px] text-gen-muted/70 mt-1">estimated</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
