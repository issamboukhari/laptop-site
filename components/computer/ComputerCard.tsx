"use client";

import Link from "next/link";
import { ComputerModel } from "@/lib/data/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_LABELS } from "@/lib/data/categories";
import { formatPrice } from "@/lib/utils/format";
import { Star, Heart, Layers, GitCompare, Check } from "lucide-react";
import { useFavorites, useRecentComputers } from "@/lib/storage/local";
import { useCompareSelection } from "@/hooks/use-compare-selection";
import { resolveModelImageUrl } from "@/lib/data/product-images";
import { ProductImage } from "./ProductImage";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils/cn";

interface ComputerCardProps {
  model: ComputerModel;
  /** Query fragments (GPU/RAM/CPU tokens) highlighted on the card. */
  highlight?: string[];
}

export function ComputerCard({ model, highlight }: ComputerCardProps) {
  const primary = model.variants[0];
  const variantCount = model.variants.length;
  const priceRange =
    variantCount > 1
      ? {
          min: Math.min(...model.variants.map((v) => v.price)),
          max: Math.max(...model.variants.map((v) => v.price)),
        }
      : null;

  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(model.id);
  const { addRecent } = useRecentComputers();
  const { toggle, isSelected, isFull } = useCompareSelection();
  const primaryInCompare = isSelected(primary.id);
  const compareDisabled = !primaryInCompare && isFull;

  return (
    <Link href={`/computer/${model.id}`} className="block group/card">
      <Card
        hover
        className={cn(
          "relative overflow-hidden transition-all duration-200",
          primaryInCompare && "ring-2 ring-gen-accent ring-offset-2 ring-offset-background"
        )}
      >
        <div className="relative">
          <ProductImage
            src={resolveModelImageUrl(model)}
            brand={model.brand}
            name={model.name}
            className="group-hover/card:scale-105 transition-transform duration-300"
          />
          <Badge variant="accent" className="absolute top-3 left-3 z-10">
            {CATEGORY_LABELS[model.category]}
          </Badge>

          {/* Selection indicator */}
          {primaryInCompare && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <Badge variant="success" className="shadow-lg animate-fade-up">
                <Check className="w-3 h-3 mr-0.5" />
                In Comparison
              </Badge>
            </div>
          )}

          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggle(primary.id);
                addRecent(model.id);
              }}
              disabled={compareDisabled}
              className={cn(
                "h-8 w-8 rounded-lg backdrop-blur-sm flex items-center justify-center transition-all duration-200",
                primaryInCompare
                  ? "bg-gen-accent text-white shadow-md shadow-gen-accent/25"
                  : "bg-gen-card/80 hover:bg-gen-card",
                compareDisabled && "opacity-40 cursor-not-allowed"
              )}
              aria-label={
                primaryInCompare
                  ? "Remove from comparison"
                  : compareDisabled
                    ? "Comparison full (max 2)"
                    : "Add to comparison"
              }
              title={
                primaryInCompare
                  ? "Remove from comparison"
                  : compareDisabled
                    ? "Comparison full (max 2)"
                    : "Add to comparison"
              }
            >
              {primaryInCompare ? (
                <Check className="w-4 h-4" />
              ) : (
                <GitCompare className="w-4 h-4 text-gen-muted hover:text-gen-accent" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(model.id);
              }}
              className="h-8 w-8 rounded-lg bg-gen-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-gen-card transition-colors"
              aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${fav ? "fill-rose-500 text-rose-500" : "text-gen-muted hover:text-rose-400"}`}
              />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs text-gen-muted uppercase tracking-wider">
              {model.brand}
            </p>
            <h3 className="text-base font-semibold text-gen-fg mt-0.5 leading-tight">
              <Highlight text={model.name} terms={highlight} />
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs text-gen-muted">
            <span>
              <Highlight text={primary.specs.cpu.split(" ").slice(-1)[0]} terms={highlight} />
            </span>
            <span className="w-1 h-1 rounded-full bg-gen-muted/40" />
            <span>
              <Highlight text={`${primary.specs.ram}GB RAM`} terms={highlight} />
            </span>
            <span className="w-1 h-1 rounded-full bg-gen-muted/40" />
            <span>
              <Highlight text={primary.specs.gpu.split(" ").slice(-2).join(" ")} terms={highlight} />
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-medium text-gen-fg">
                {primary.rating}
              </span>
              <span className="text-xs text-gen-muted">
                ({primary.reviewCount.toLocaleString("en-US")})
              </span>
            </div>

            {variantCount > 1 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gen-accent bg-gen-accent/10 px-2 py-0.5 rounded-md">
                <Layers className="w-3 h-3" />
                {variantCount} configs
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gen-border">
            <span className="text-lg font-bold text-gen-fg">
              {priceRange
                ? `${formatPrice(priceRange.min)} – ${formatPrice(priceRange.max)}`
                : formatPrice(primary.price)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
