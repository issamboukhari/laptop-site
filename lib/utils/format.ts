export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatRam(gb: number): string {
  return `${gb}GB`;
}

export function formatStorage(gb: number): string {
  if (gb >= 1000) {
    const tb = gb / 1000;
    return `${Number.isInteger(tb) ? tb : tb.toFixed(1)}TB`;
  }
  return `${gb}GB`;
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)}kg`;
}

export function formatBattery(hours: number): string {
  return `${hours}h`;
}

export function getScoreColor(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 70) return "text-blue-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function getScoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500/10";
  if (score >= 70) return "bg-blue-500/10";
  if (score >= 50) return "bg-amber-500/10";
  return "bg-red-500/10";
}
