"use client";

import Link from "next/link";
import { ComputerVariant } from "@/lib/data/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatRam, formatStorage } from "@/lib/utils/format";
import { Star, Eye, GitCompare, Cpu, Monitor, HardDrive, Zap } from "lucide-react";
import { useCompareSelection } from "@/hooks/use-compare-selection";
import { resolveVariantImageUrl } from "@/lib/data/product-images";
import { ProductImage } from "./ProductImage";

interface VariantCardProps {
  variant: ComputerVariant;
  showStar?: boolean;
}

function SpecRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gen-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-gen-muted uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-gen-fg leading-snug">{value}</p>
      </div>
    </div>
  );
}

export function VariantCard({ variant, showStar = true }: VariantCardProps) {
  const { toggle, isSelected, isFull } = useCompareSelection();
  const selected = isSelected(variant.id);
  const disabled = !selected && isFull;

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gen-border">
        <div className="flex items-start gap-3">
          <ProductImage
            src={resolveVariantImageUrl(variant)}
            brand={variant.brand}
            name={variant.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gen-muted uppercase tracking-wider">{variant.brand}</p>
            <h3 className="text-sm font-semibold text-gen-fg leading-tight">{variant.name}</h3>
          </div>
          {showStar && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-medium text-gen-fg">{variant.rating}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 space-y-3">
        <SpecRow icon={Cpu} label="Processor" value={variant.specs.cpu} />
        <SpecRow icon={Zap} label="Graphics" value={variant.specs.gpu} />
        <SpecRow icon={HardDrive} label="Memory" value={`${formatRam(variant.specs.ram)} ${variant.specs.ramType ?? ""}`.trim()} />
        <SpecRow icon={HardDrive} label="Storage" value={`${formatStorage(variant.specs.storage)} ${variant.specs.storageType}`} />
        <SpecRow icon={Monitor} label="Display" value={variant.specs.display} />
      </div>

      <div className="p-4 border-t border-gen-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gen-fg">{formatPrice(variant.price)}</span>
          <Badge variant="outline">{variant.year}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/computer/${variant.id}`}
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-gen-border text-gen-fg text-xs font-medium hover:bg-gen-card-hover transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View Details
          </Link>
          <button
            onClick={() => toggle(variant.id)}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              selected
                ? "bg-gen-accent text-white"
                : "bg-gen-accent/10 text-gen-accent hover:bg-gen-accent/20"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            {selected ? "In Comparison" : "Add to Comparison"}
          </button>
        </div>
      </div>
    </Card>
  );
}