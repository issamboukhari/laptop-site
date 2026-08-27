"use client";

import { ComputerVariant } from "@/lib/data/types";
import { calculateRatings, RATING_DEFINITIONS } from "@/lib/scoring/ratings";
import { getScoreColor } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

interface RatingsComparisonProps {
  computerA: ComputerVariant;
  computerB: ComputerVariant;
  winnerFor: (categoryId: string, scoreA: number, scoreB: number) => "A" | "B" | "tie";
}

function ScoreBar({ score, reverse = false }: { score: number; reverse?: boolean }) {
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
    <div className={cn("flex items-center gap-2", reverse && "flex-row-reverse")}>
      <div className="flex-1 h-2 rounded-full bg-gen-card-hover overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-bold tabular-nums w-8", reverse ? "text-left" : "text-right", getScoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

export function RatingsComparison({ computerA, computerB, winnerFor }: RatingsComparisonProps) {
  const ratingsA = calculateRatings(computerA);
  const ratingsB = calculateRatings(computerB);

  return (
    <div className="overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 border-b border-gen-border bg-gen-card-hover/50">
        <span className="text-xs font-semibold text-gen-fg truncate">
          {computerA.name}
        </span>
        <span className="text-[10px] text-gen-muted px-3 font-medium">Category</span>
        <span className="text-xs font-semibold text-gen-fg truncate text-right">
          {computerB.name}
        </span>
      </div>

      <div className="divide-y divide-gen-border">
        {RATING_DEFINITIONS.map((def) => {
          const a = ratingsA[def.id];
          const b = ratingsB[def.id];
          const winner = winnerFor(def.id, a.score, b.score);
          return (
            <div key={def.id} className="px-4 py-3 hover:bg-gen-card-hover/30 transition-colors">
              {/* Label + winner badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{def.icon}</span>
                  <span className="text-sm font-medium text-gen-fg">{def.label}</span>
                </div>
                {winner !== "tie" && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {winner === "A"
                      ? computerA.name.split(" ").slice(0, 2).join(" ")
                      : computerB.name.split(" ").slice(0, 2).join(" ")}{" "}
                    wins
                  </span>
                )}
                {winner === "tie" && (
                  <span className="text-[10px] font-bold text-gen-muted bg-gen-card-hover px-2 py-0.5 rounded-md">
                    Tie
                  </span>
                )}
              </div>

              {/* Opposing progress bars */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <ScoreBar score={a.score} reverse />
                <span className="text-[10px] text-gen-muted">/100</span>
                <ScoreBar score={b.score} />
              </div>

              {/* Factors */}
              {a.factors.length > 0 && (
                <p className="text-[11px] text-gen-muted/80 mt-1.5 leading-snug">
                  {def.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
