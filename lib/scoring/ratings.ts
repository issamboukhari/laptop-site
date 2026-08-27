import { ComputerVariant, RatingCategory, RatingDefinition, CategoryRating, ComputerRatings } from "../data/types";
import { detectHardwareProfile, credibleScores, HardwareProfile } from "./hardware";

export { describeHardware } from "./hardware";

export const RATING_DEFINITIONS: RatingDefinition[] = [
  { id: "gaming", label: "Gaming", icon: "🎮", description: "Based mainly on GPU + CPU + RAM + cooling + display refresh rate." },
  { id: "programming", label: "Programming", icon: "💻", description: "Based mainly on CPU + RAM + storage + battery + display + keyboard/productivity factors." },
  { id: "university", label: "University / Study", icon: "🎓", description: "Based mainly on portability + battery + price + RAM + display." },
  { id: "editing", label: "Video Editing", icon: "🎬", description: "Based mainly on CPU + GPU + RAM + storage + display." },
  { id: "design", label: "Graphic Design", icon: "🎨", description: "Based mainly on display quality + GPU + RAM + CPU." },
  { id: "ai", label: "AI / Machine Learning", icon: "🤖", description: "Based mainly on GPU + RAM + CPU + storage." },
  { id: "battery", label: "Battery Life", icon: "🔋", description: "Based mainly on battery capacity + efficiency + weight." },
  { id: "performance", label: "Performance", icon: "🚀", description: "Based mainly on CPU + GPU + RAM + storage speed." },
  { id: "portability", label: "Portability", icon: "🧳", description: "Based mainly on weight + size + battery + charger considerations." },
  { id: "upgradeability", label: "Upgradeability", icon: "🛠️", description: "Based mainly on chassis type + expandability + build." },
  { id: "thermal", label: "Thermal / Sustained", icon: "🌡️", description: "Estimated from chassis + cooling design + workload headroom." },
  { id: "productivity", label: "Productivity", icon: "⌨️", description: "Based mainly on CPU + RAM + battery + keyboard + display." },
  { id: "display", label: "Display", icon: "📺", description: "Based mainly on panel type + resolution + refresh rate + size." },
  { id: "multimedia", label: "Multimedia", icon: "🔊", description: "Based mainly on display + audio + GPU + battery + weight." },
  { id: "value", label: "Value for Money", icon: "💰", description: "Based mainly on performance per dollar spent." },
  { id: "longevity", label: "Long-Term Use", icon: "⏳", description: "Based mainly on CPU/GPU headroom + RAM + upgradeability + build quality." },
];

const CATEGORY_THERMAL: Record<string, number> = {
  "gaming-laptop": 85,
  workstation: 92,
  desktop: 90,
  "mini-pc": 65,
  "business-laptop": 60,
  ultrabook: 45,
  macbook: 50,
};

const CATEGORY_UPGRADE: Record<string, number> = {
  desktop: 95,
  workstation: 90,
  "mini-pc": 72,
  "gaming-laptop": 62,
  "business-laptop": 55,
  ultrabook: 45,
  macbook: 35,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
}

/** Piecewise-linear curve through [input, score] anchors — calibrated so common real values land where they should. */
function curve(value: number, anchors: [number, number][]): number {
  if (!Number.isFinite(value)) return anchors[0][1];
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (value <= x2) {
      return y1 + ((value - x1) / (x2 - x1)) * (y2 - y1);
    }
  }
  return last[1];
}

// Calibrated curves — e.g. 16GB RAM is solid (≈78), not "10/100"; a 144Hz
// panel is excellent for gaming (≈82), not mid-range.
const RAM_CURVE: [number, number][] = [[4, 35], [8, 55], [12, 68], [16, 78], [24, 88], [32, 96], [64, 100]];
const STORAGE_CURVE: [number, number][] = [[128, 30], [256, 52], [512, 70], [1024, 84], [2048, 94], [4096, 100]];
const REFRESH_CURVE: [number, number][] = [[45, 25], [60, 45], [90, 62], [120, 74], [144, 82], [165, 88], [240, 97], [360, 100]];
const BATTERY_CURVE: [number, number][] = [[3, 20], [6, 48], [9, 66], [12, 80], [16, 92], [22, 100]];

function normalizeInverted(value: number, min: number, max: number): number {
  return clamp(100 - normalize(value, min, max));
}

function displayQualityScore(variant: ComputerVariant): number {
  const s = variant.specs;
  const d = (s.display ?? "").toLowerCase();
  let score = 40;

  // Panel type
  const panel = (s.panelType ?? "").toLowerCase();
  if (panel.includes("oled") || d.includes("oled")) score += 30;
  if (panel.includes("mini led") || panel.includes("miniled") || d.includes("mini led")) score += 25;
  if (panel.includes("xdr") || panel.includes("retina") || d.includes("xdr") || d.includes("retina")) score += 20;
  if (panel.includes("ips") || d.includes("ips")) score += 10;
  if (panel.includes("pixelsense")) score += 12;

  // Resolution
  const res = (s.resolution ?? "").toLowerCase();
  if (d.includes("4k") || d.includes("4.5k") || res.includes("4.5k") || res.includes("4k") || d.includes("3.2k") || d.includes("3k")) score += 25;
  if (res.includes("2.8k") || res.includes("2.5k") || res.includes("wqxga") || res.includes("qhd") || d.includes("2.8k") || d.includes("qhd")) score += 15;

  // Brightness
  const b = (s.brightness ?? "").toLowerCase();
  const bm = b.match(/(\d+)\s*nits/);
  if (bm) {
    const n = parseInt(bm[1], 10);
    if (n >= 500) score += 20;
    else if (n >= 400) score += 15;
    else if (n >= 300) score += 8;
  }

  // Color coverage
  const cc = (s.colorCoverage ?? "").toLowerCase();
  if (cc.includes("100% dci-p3") || cc.includes("100% srgb")) score += 8;
  if (cc.includes("dolby vision") || cc.includes("hdr")) score += 5;

  if (s.touchscreen) score += 8;
  if (d.includes("n/a")) return 0;
  return clamp(score);
}

function coolingScore(variant: ComputerVariant): { value: number; label: string } {
  const s = variant.specs;
  if (!s.coolingSystem && !s.fans) {
    return { value: CATEGORY_THERMAL[variant.category] ?? 50, label: `Cooling estimated from chassis (${variant.category})` };
  }
  let score = CATEGORY_THERMAL[variant.category] ?? 50;
  const cool = (s.coolingSystem ?? "").toLowerCase();
  const fans = (s.fans ?? "").toLowerCase();
  if (cool.includes("vapor chamber") || cool.includes("liquid")) score += 15;
  if (cool.includes("dual fan") || cool.includes("2 fan") || cool.includes("triple")) score += 8;
  const fanCount = (fans.match(/\d/) ?? [])[0];
  if (fanCount) score += parseInt(fanCount, 10) >= 3 ? 8 : parseInt(fanCount, 10) === 2 ? 5 : 0;
  if (cool.includes("heat pipe")) score += 4;
  const label = `Cooling: ${s.coolingSystem ?? "n/a"} (${s.fans ?? "n/a"})`;
  return { value: clamp(score), label };
}

function upgradeabilityScore(variant: ComputerVariant): { value: number; label: string } {
  const s = variant.specs;
  let score = CATEGORY_UPGRADE[variant.category] ?? 50;
  const parts: string[] = [];
  if (s.ramUpgradeable && !s.ramUpgradeable.toLowerCase().includes("not")) {
    score += 8;
    parts.push(s.ramUpgradeable);
  }
  if (s.storageSlots) score += 5;
  if (s.upgradeability) {
    const u = s.upgradeability.toLowerCase();
    if (u.includes("user-upgradeable") || u.includes("upgradeable")) score += 8;
    if (u.includes("soldered") || u.includes("not upgrade")) score -= 15;
    parts.push(s.upgradeability);
  }
  const label = parts.length ? `Upgrade info: ${parts.join("; ")}` : `Chassis upgrade potential (${variant.category})`;
  return { value: clamp(score), label };
}

function weightedFactors(
  variant: ComputerVariant,
  weights: Partial<Record<RatingFactorKey, number>>,
  extras: { label: string; value: number; weight: number }[] = []
): CategoryRating {
  const factors = getFactors(variant);
  let total = 0;
  let weightSum = 0;
  const factorList: string[] = [];
  for (const [key, weight] of Object.entries(weights) as [RatingFactorKey, number][]) {
    if (!weight || !factors[key]) continue;
    total += factors[key].value * weight;
    weightSum += weight;
    factorList.push(factors[key].label);
  }
  for (const extra of extras) {
    total += extra.value * extra.weight;
    weightSum += extra.weight;
    factorList.push(extra.label);
  }
  const score = weightSum > 0 ? Math.round(total / weightSum) : 0;
  return { score, factors: factorList };
}

type RatingFactorKey =
  | "cpu"
  | "gpu"
  | "ram"
  | "storage"
  | "storageType"
  | "displayRefresh"
  | "displayQuality"
  | "displaySize"
  | "battery"
  | "weight"
  | "price"
  | "rating"
  | "year";

function getFactors(variant: ComputerVariant): Record<RatingFactorKey, { value: number; label: string }> {
  const s = variant.specs;
  const hw: HardwareProfile = detectHardwareProfile(variant);
  const credible = credibleScores(hw, s.cpuScore, s.gpuScore);

  // Hardware-class-aware labels make every rating auditable.
  const cpuLabel = `CPU ${s.cpu.split("(")[0].trim()} — ${hw.cpuClassLabel}${credible.cpuClamped ? " (score capped to class)" : ""} (${credible.cpu}/100)`;

  // Integrated GPUs are additionally scaled down for GPU-weighted workloads:
  // physically they cannot match dedicated cards regardless of claimed score.
  const gpuEffective =
    hw.gpuType === "integrated" ? Math.round(credible.gpu * 0.8) : credible.gpu;
  const gpuLabel = `GPU ${s.gpu.split("(")[0].trim()} — ${hw.gpuClassLabel}${
    credible.gpuClamped || hw.gpuType === "integrated" ? " (class-adjusted)" : ""
  } (${gpuEffective}/100)`;

  // RAM speed bonus when verifiable (e.g. DDR5-5600 / 6400MHz).
  let ramSpeedBonus = 0;
  const rs = (s.ramSpeed ?? "").toLowerCase();
  const mhz = rs.match(/(\d{3,4})\s*mhz/) ?? rs.match(/ddr[45]x?-?(\d{4})/);
  if (mhz) {
    const speed = parseInt(mhz[1], 10);
    ramSpeedBonus = speed >= 6400 ? 12 : speed >= 5600 ? 9 : speed >= 4800 ? 6 : 3;
  }
  const ramValue = clamp(curve(s.ram, RAM_CURVE) + (ramSpeedBonus * curve(s.ram, [[8, 30], [32, 100]])) / 100);

  return {
    cpu: { value: credible.cpu, label: cpuLabel },
    gpu: { value: gpuEffective, label: gpuLabel },
    ram: { value: ramValue, label: `${s.ram}GB${rs ? ` (${s.ramSpeed})` : ""}` },
    storage: { value: curve(s.storage, STORAGE_CURVE), label: `${s.storage}GB ${s.storageType}` },
    storageType: {
      value:
        hw.storageClass === "nvme" ? 100 : hw.storageClass === "sata-ssd" ? 78 : 45,
      label:
        hw.storageClass === "nvme"
          ? "NVMe SSD storage"
          : hw.storageClass === "hdd"
          ? "HDD storage"
          : "SATA SSD storage",
    },
    displayRefresh: { value: curve(s.displayRefreshRate, REFRESH_CURVE), label: `${s.displayRefreshRate}Hz refresh rate` },
    displayQuality: { value: displayQualityScore(variant), label: `${s.display} panel` },
    displaySize: { value: normalize(s.displaySize, 11, 24), label: `${s.displaySize}" screen` },
    battery: { value: s.batteryLife ? curve(s.batteryLife, BATTERY_CURVE) : 0, label: s.batteryLife ? `${s.batteryLife}h battery` : "No battery (desktop)" },
    weight: { value: s.weight ? normalizeInverted(s.weight, 0.8, 4.5) : 0, label: s.weight ? `${s.weight}kg weight` : "N/A" },
    price: { value: normalizeInverted(variant.price, 299, 4999), label: `${variant.price} price point` },
    rating: { value: (variant.rating / 5) * 100, label: `${variant.rating}/5 user rating` },
    year: { value: normalize(variant.year, 2022, 2026), label: `${variant.year} model year` },
  };
}

export function calculateRatings(variant: ComputerVariant): ComputerRatings {
  const f = getFactors(variant);
  const hw = detectHardwareProfile(variant);

  const gamingBase = weightedFactors(variant, {
    gpu: 0.3,
    cpu: 0.2,
    ram: 0.1,
    displayRefresh: 0.1,
  }, [
    { label: coolingScore(variant).label, value: coolingScore(variant).value, weight: 0.15 },
    { label: "Storage", value: f.storage.value, weight: 0.05 },
    { label: "Price", value: f.price.value, weight: 0.1 },
  ]);

  // Reality check: on integrated graphics the GPU is the hard gaming
  // bottleneck — no amount of CPU/RAM lifts the experience to dGPU levels.
  const gaming: CategoryRating = hw.gpuType === "integrated"
    ? {
        score: Math.round(gamingBase.score * 0.8),
        factors: [...gamingBase.factors, "Integrated GPU — gaming bottleneck applied"],
        estimated: gamingBase.estimated,
      }
    : gamingBase;

  const programming = weightedFactors(variant, {
    cpu: 0.25,
    ram: 0.2,
    storage: 0.1,
    battery: 0.1,
    displayQuality: 0.05,
    weight: 0.05,
    price: 0.15,
  }, [
    { label: "Storage speed (NVMe/SSD)", value: f.storageType.value, weight: 0.1 },
  ]);

  const university = weightedFactors(variant, {
    cpu: 0.1,
    ram: 0.15,
    storage: 0.1,
    battery: 0.15,
    displayQuality: 0.05,
  }, [
    { label: "Weight / portability", value: f.weight.value, weight: 0.25 },
    { label: "Price", value: f.price.value, weight: 0.2 },
  ]);

  const editing = weightedFactors(variant, {
    cpu: 0.2,
    gpu: 0.2,
    ram: 0.2,
    storage: 0.1,
    displayQuality: 0.1,
  }, [
    { label: "Storage speed (NVMe/SSD)", value: f.storageType.value, weight: 0.1 },
    { label: "Price", value: f.price.value, weight: 0.1 },
  ]);

  const design = weightedFactors(variant, {
    cpu: 0.15,
    gpu: 0.2,
    ram: 0.15,
  }, [
    { label: "Display quality", value: f.displayQuality.value, weight: 0.35 },
    { label: "Price", value: f.price.value, weight: 0.1 },
    { label: "Storage speed", value: f.storageType.value, weight: 0.05 },
  ]);

  const ai = weightedFactors(variant, {
    cpu: 0.15,
    gpu: 0.3,
    ram: 0.2,
    storage: 0.1,
  }, [
    { label: "Storage speed (NVMe/SSD)", value: f.storageType.value, weight: 0.15 },
    { label: "Price", value: f.price.value, weight: 0.1 },
  ]);

  const battery = weightedFactors(variant, {
    battery: 0.6,
  }, [
    { label: "Weight (light = efficient)", value: f.weight.value, weight: 0.15 },
    { label: "Price", value: f.price.value, weight: 0.1 },
    { label: "Display quality (efficient panels)", value: f.displayQuality.value, weight: 0.15 },
  ]);

  const performance = weightedFactors(variant, {
    cpu: 0.3,
    gpu: 0.3,
    ram: 0.15,
    storage: 0.1,
  }, [
    { label: "Storage speed (NVMe/SSD)", value: f.storageType.value, weight: 0.15 },
  ]);

  const portability = weightedFactors(variant, {}, [
    { label: "Weight", value: f.weight.value, weight: 0.45 },
    { label: "Battery life", value: f.battery.value, weight: 0.2 },
    { label: "Smaller screen size", value: normalizeInverted(variant.specs.displaySize, 11, 24), weight: 0.15 },
    { label: "Price", value: f.price.value, weight: 0.2 },
  ]);

  const upgradeability = weightedFactors(variant, {}, [
    { label: upgradeabilityScore(variant).label, value: upgradeabilityScore(variant).value, weight: 0.5 },
    { label: "RAM headroom", value: normalize(variant.specs.ram, 4, 64), weight: 0.15 },
    { label: "Storage headroom", value: normalize(variant.specs.storage, 128, 2000), weight: 0.15 },
    { label: "User rating (build quality)", value: f.rating.value, weight: 0.2 },
  ]);

  const thermal: CategoryRating = {
    score: coolingScore(variant).value,
    factors: [
      coolingScore(variant).label,
      variant.specs.batteryLife ? `${variant.specs.batteryLife}h battery (efficiency proxy)` : "Desktop power delivery",
    ],
    estimated: true,
  };

  const productivity = weightedFactors(variant, {
    cpu: 0.2,
    ram: 0.2,
    storage: 0.1,
    battery: 0.1,
  }, [
    { label: "Weight", value: f.weight.value, weight: 0.1 },
    { label: "Display quality", value: f.displayQuality.value, weight: 0.1 },
    { label: "Price", value: f.price.value, weight: 0.1 },
    { label: "User rating (keyboard/build)", value: f.rating.value, weight: 0.1 },
  ]);

  const display = weightedFactors(variant, {}, [
    { label: `Panel quality (${variant.specs.display})`, value: f.displayQuality.value, weight: 0.5 },
    { label: "Refresh rate", value: f.displayRefresh.value, weight: 0.25 },
    { label: "Screen size", value: f.displaySize.value, weight: 0.25 },
  ]);

  const multimedia = weightedFactors(variant, {
    displayQuality: 0.2,
    gpu: 0.15,
    battery: 0.15,
  }, [
    { label: "Weight (home media portability)", value: f.weight.value, weight: 0.15 },
    { label: "Price", value: f.price.value, weight: 0.15 },
    { label: "User rating (audio/build)", value: f.rating.value, weight: 0.2 },
  ]);

  const perfValue = performance.score;
  const value = weightedFactors(variant, {}, [
    { label: "Performance", value: perfValue, weight: 0.5 },
    { label: "Price (lower = better value)", value: f.price.value, weight: 0.4 },
    { label: "User rating", value: f.rating.value, weight: 0.1 },
  ]);

  const longevity = weightedFactors(variant, {
    cpu: 0.2,
    gpu: 0.1,
    ram: 0.15,
    storage: 0.1,
  }, [
    { label: upgradeabilityScore(variant).label, value: upgradeabilityScore(variant).value, weight: 0.2 },
    { label: "User rating (build quality)", value: f.rating.value, weight: 0.15 },
    { label: "Model year", value: f.year.value, weight: 0.1 },
  ]);

  return {
    gaming,
    programming,
    university,
    editing,
    design,
    ai,
    battery,
    performance,
    portability,
    upgradeability,
    thermal,
    productivity,
    display,
    multimedia,
    value,
    longevity,
  };
}

export function getRatingDefinition(id: RatingCategory): RatingDefinition {
  return RATING_DEFINITIONS.find((r) => r.id === id)!;
}