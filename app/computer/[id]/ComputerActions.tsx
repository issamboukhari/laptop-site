"use client";

import { useSyncExternalStore, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Heart, GitCompare } from "lucide-react";
import { useCompareSelection } from "@/hooks/use-compare-selection";
import { useRecentComputers } from "@/lib/storage/local";
import { findModelById, findModelByVariantId } from "@/lib/data/computers";

let cachedFavorites: string[] = [];
let lastRaw = "";

function getFavoritesSnapshot(): string[] {
  if (typeof window === "undefined") return cachedFavorites;
  const raw = localStorage.getItem("gen_user_favorites") ?? "[]";
  if (raw === lastRaw) return cachedFavorites;
  lastRaw = raw;
  cachedFavorites = JSON.parse(raw) as string[];
  return cachedFavorites;
}

function getFavoritesServerSnapshot(): string[] {
  return cachedFavorites;
}

function subscribeFavorites(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

interface ComputerActionsProps {
  computerId: string;
}

export function ComputerActions({ computerId }: ComputerActionsProps) {
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getFavoritesServerSnapshot
  );
  const isFavorite = favorites.includes(computerId);
  const { addRecent } = useRecentComputers();

  // Auto-track in recent when viewing a computer page.
  // Resolve variant IDs to model IDs so the recent page can display them.
  useEffect(() => {
    const model = findModelById(computerId) ?? findModelByVariantId(computerId);
    addRecent(model?.id ?? computerId);
  }, [computerId, addRecent]);

  const { toggle, isSelected, isFull } = useCompareSelection();
  const inCompare = isSelected(computerId);
  const compareDisabled = !inCompare && isFull;

  const toggleFavorite = () => {
    const current = JSON.parse(localStorage.getItem("gen_user_favorites") ?? "[]") as string[];
    let next: string[];
    if (current.includes(computerId)) {
      next = current.filter((id) => id !== computerId);
    } else {
      next = [...current, computerId];
    }
    localStorage.setItem("gen_user_favorites", JSON.stringify(next));
    lastRaw = "";
  };

  return (
    <div className="flex gap-2 mt-4 flex-wrap">
      <Button
        variant={inCompare ? "primary" : "outline"}
        size="sm"
        onClick={() => toggle(computerId)}
        disabled={compareDisabled}
      >
        <GitCompare className="w-4 h-4" />
        {inCompare ? "In Comparison" : "Add to Comparison"}
      </Button>
      <Button
        variant={isFavorite ? "primary" : "outline"}
        size="sm"
        onClick={toggleFavorite}
      >
        {isFavorite ? <Heart className="w-4 h-4 fill-current" /> : <Heart className="w-4 h-4" />}
        {isFavorite ? "Favorited" : "Favorite"}
      </Button>
    </div>
  );
}
