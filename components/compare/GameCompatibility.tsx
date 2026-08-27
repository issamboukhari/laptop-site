"use client";

import { useMemo, useState } from "react";
import { ComputerVariant, CompatibilityVerdict } from "@/lib/data/types";
import { GAMES, estimateGameCompatibility } from "@/lib/data/games";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Search, Gamepad2, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const VERDICT_STYLES: Record<CompatibilityVerdict, { badge: string; text: string; emoji: string }> = {
  Excellent: { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", text: "text-emerald-500", emoji: "🚀" },
  Good: { badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400", text: "text-blue-500", emoji: "👍" },
  Playable: { badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", text: "text-amber-500", emoji: "🎮" },
  "Not Recommended": { badge: "bg-red-500/15 text-red-600 dark:text-red-400", text: "text-red-500", emoji: "⚠️" },
};

interface GameCompatibilityProps {
  computerA: ComputerVariant;
  computerB: ComputerVariant;
}

export function GameCompatibility({ computerA, computerB }: GameCompatibilityProps) {
  const [query, setQuery] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string>(GAMES[0].id);

  const filteredGames = useMemo(() => {
    const q = query.toLowerCase();
    return GAMES.filter(
      (g) => !q || g.name.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q)
    );
  }, [query]);

  const selectedGame = GAMES.find((g) => g.id === selectedGameId) ?? GAMES[0];

  const resultA = useMemo(() => estimateGameCompatibility(computerA, selectedGame), [computerA, selectedGame]);
  const resultB = useMemo(() => estimateGameCompatibility(computerB, selectedGame), [computerB, selectedGame]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Game Picker */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gen-border">
          <h4 className="text-sm font-semibold text-gen-fg flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-gen-accent" />
            Select a Game
          </h4>
        </div>
        <div className="p-4 border-b border-gen-border">
          <div className="relative">
            <Search className="w-4 h-4 text-gen-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gen-border bg-gen-card text-sm text-gen-fg placeholder:text-gen-muted focus:outline-none focus:ring-2 focus:ring-gen-accent/40"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {filteredGames.length === 0 && (
            <p className="text-xs text-gen-muted text-center py-8">No games found</p>
          )}
          {filteredGames.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGameId(game.id)}
              className={cn(
                "w-full text-left px-4 py-2.5 border-b border-gen-border last:border-b-0 transition-colors hover:bg-gen-card-hover",
                game.id === selectedGame.id && "bg-gen-accent/5"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gen-fg">{game.name}</p>
                {game.id === selectedGame.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gen-accent" />
                )}
              </div>
              <p className="text-[10px] text-gen-muted mt-0.5">
                {game.genre} · {game.minGpu} GPU · {game.minCpu} CPU · {game.minRam}GB min
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Results */}
      <div className="flex flex-col gap-4">
        {[computerA, computerB].map((computer, idx) => {
          const result = idx === 0 ? resultA : resultB;
          const style = VERDICT_STYLES[result.verdict];
          return (
            <Card key={computer.id} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-gen-muted uppercase tracking-wider">{computer.brand}</p>
                  <h4 className="text-sm font-semibold text-gen-fg truncate">{computer.name}</h4>
                </div>
                <Badge variant="outline" className={style.badge}>
                  {style.emoji} {result.verdict}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-gen-muted mb-2">
                <Info className="w-3 h-3" />
                <span className="font-medium text-gen-fg">{result.estimatedFps}</span>
              </div>
              <div className="space-y-1">
                {result.reasoning.map((line, i) => (
                  <p key={i} className="text-[11px] text-gen-muted/90 leading-snug flex gap-1.5">
                    <span className="text-gen-accent">•</span>
                    <span>{line}</span>
                  </p>
                ))}
              </div>
            </Card>
          );
        })}
        <p className="text-[10px] text-gen-muted/70">
          Frame rate figures are estimates based on GPU/CPU score tiers, not measured benchmarks.
        </p>
      </div>
    </div>
  );
}