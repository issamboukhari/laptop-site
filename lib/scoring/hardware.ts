import { ComputerVariant } from "../data/types";

/**
 * Hardware class detection — grounds every rating in what the components
 * actually are, so numbers stay physically credible:
 *
 *  - Intel U/P efficiency chips can never out-score H/HX performance chips.
 *  - Integrated GPUs (Iris Xe, Radeon 7xxM, Arc Graphics) are capped well
 *    below dedicated RTX/RX cards for GPU-heavy workloads.
 *  - Panel class (OLED > mini-LED > IPS > TN) and storage class
 *    (NVMe > SATA SSD > HDD) feed directly into display/storage factors.
 */

export type CpuClass = "low-power" | "efficiency" | "mainstream" | "performance" | "enthusiast";
export type GpuType = "integrated" | "dedicated";
export type PanelClass = "tn" | "basic" | "ips" | "oled" | "miniled";

export interface HardwareProfile {
  cpuClass: CpuClass;
  cpuClassLabel: string;
  /** Maximum credible CPU score for this class (scores above get clamped). */
  cpuCap: number;

  gpuType: GpuType;
  gpuClassLabel: string;
  /** Maximum credible GPU score for this type/tier. */
  gpuCap: number;

  panelClass: PanelClass;
  storageClass: "hdd" | "sata-ssd" | "nvme";
  /** Short human summary for prompts/UI: "H-class CPU · dedicated GPU · OLED". */
  summary: string;
}

const CPU_RULES: { pattern: RegExp; cls: CpuClass; label: string; cap: number }[] = [
  // Enthusiast / desktop-replacement
  { pattern: /\b(hx|hk)\b|-hx\b|-hk\b|\d{4,5}hx|\d{4,5}hk/i, cls: "enthusiast", label: "enthusiast HX/HK-class", cap: 97 },
  // Apple silicon
  { pattern: /\bm[1-4]\s*(pro|max|ultra)\b/i, cls: "performance", label: "Apple Silicon Pro/Max", cap: 96 },
  { pattern: /\bapple\s*m[1-4]\b|\bm[1-4]\s*chip\b/i, cls: "mainstream", label: "Apple Silicon", cap: 90 },
  // Intel H-series (mobile performance)
  { pattern: /(\d{4,5}h(?![a-z])|\bultra\s*[579].{0,10}\d{2,3}h\b|\bh-series\b)/i, cls: "performance", label: "H-class (high performance)", cap: 93 },
  // Intel P-series
  { pattern: /(\d{4}p\b|p-series)/i, cls: "mainstream", label: "P-class (thin performance)", cap: 82 },
  // Intel U-series / AMD U (efficiency)
  { pattern: /(\d{3,5}u\b|u-series)/i, cls: "efficiency", label: "U-class (efficiency)", cap: 72 },
  // AMD HS / H
  { pattern: /(\d{4}hs\b|\dryzen.{0,12}\dh\b)/i, cls: "performance", label: "AMD HS/H-class", cap: 93 },
  // Low power
  { pattern: /\b(celeron|pentium|n\d{3,4}\b|athlon)\b/i, cls: "low-power", label: "low-power", cap: 35 },
];

const DEDICATED_GPU_TIERS: { pattern: RegExp; label: string; cap: number }[] = [
  { pattern: /\brtx\s*4090|\brx\s*7950/i, label: "flagship dedicated GPU", cap: 97 },
  { pattern: /\brtx\s*4080|\brtx\s*3080\s*ti|\brx\s*7800\s*xt|\brx\s*7700/i, label: "high-end dedicated GPU", cap: 90 },
  { pattern: /\brtx\s*(4070|3070)|\brx\s*7600\s*s?\b/i, label: "upper-mid dedicated GPU", cap: 82 },
  { pattern: /\brtx\s*(4060|3060)|\brx\s*7600m|\brx\s*6700/i, label: "mid dedicated GPU", cap: 75 },
  { pattern: /\brtx\s*(4050|3050)|\bgtx\s*16[56]\d|\brx\s*6500/i, label: "entry dedicated GPU", cap: 66 },
  { pattern: /\brtx\s*\d{4}|\brx\s*\d{4}|\barc\s*a\d{3}/i, label: "dedicated GPU", cap: 80 },
];

const INTEGRATED_GPU_PATTERNS: RegExp[] = [
  /\biris\s*xe/i,
  /\biris\s*plus/i,
  /\buhd\s*graphics/i,
  /\bhd\s*graphics/i,
  /\bradeon\s*\d{3}\s*m\b/i,
  /\bradeon\s*(680m|780m|890m|8060s)\b/i,
  /\barc\s*graphics/i,
  /\bintegrated\b/i,
  /\bigpu\b/i,
  /\badreno/i,
  /\bm[1-4]\s*(gpu|graphics)\b/i,
];

function detectCpu(cpuText: string): { cls: CpuClass; label: string; cap: number } {
  for (const rule of CPU_RULES) {
    if (rule.pattern.test(cpuText)) {
      return { cls: rule.cls, label: rule.label, cap: rule.cap };
    }
  }
  // Unknown naming — assume mainstream mid-range, moderately conservative.
  return { cls: "mainstream", label: "mainstream CPU", cap: 85 };
}

function detectGpu(gpuText: string): { type: GpuType; label: string; cap: number } {
  const lower = (gpuText ?? "").toLowerCase().trim();

  if (!lower) {
    return { type: "integrated", label: "unknown/integrated GPU", cap: 45 };
  }

  const matchesDedicated = DEDICATED_GPU_TIERS.some((t) => t.pattern.test(lower));
  const isIntegrated =
    !matchesDedicated && INTEGRATED_GPU_PATTERNS.some((p) => p.test(lower));

  if (isIntegrated) {
    return { type: "integrated", label: "integrated GPU", cap: 58 };
  }

  for (const tier of DEDICATED_GPU_TIERS) {
    if (tier.pattern.test(lower)) {
      return { type: "dedicated", label: tier.label, cap: tier.cap };
    }
  }

  // Unrecognized non-empty text without integrated markers: treat cautiously.
  return { type: "dedicated", label: "dedicated GPU (unverified tier)", cap: 78 };
}

function detectPanel(variant: ComputerVariant): PanelClass {
  const text = `${variant.specs.panelType ?? ""} ${variant.specs.display ?? ""}`.toLowerCase();
  if (text.includes("oled")) return "oled";
  if (text.includes("mini led") || text.includes("miniled") || text.includes("miniled")) return "miniled";
  if (text.includes("tn")) return "tn";
  if (text.includes("ips") || text.includes("retina") || text.includes("xdr") || text.includes("lcd")) return "ips";
  return "basic";
}

function detectStorage(variant: ComputerVariant): "hdd" | "sata-ssd" | "nvme" {
  if (variant.specs.storageType === "NVMe") return "nvme";
  if (variant.specs.storageType === "HDD") return "hdd";
  return "sata-ssd";
}

/** Short human summary for prompts/UI: "U-class CPU · integrated GPU · NVMe SSD". */
export function describeHardware(variant: ComputerVariant): string {
  return detectHardwareProfile(variant).summary;
}

/** Detect the hardware class profile for a configuration. */
export function detectHardwareProfile(variant: ComputerVariant): HardwareProfile {
  const cpu = detectCpu(variant.specs.cpu ?? "");
  const gpu = detectGpu(variant.specs.gpu ?? "");
  const panel = detectPanel(variant);
  const storage = detectStorage(variant);

  const parts = [
    `${cpu.label}`,
    gpu.type === "dedicated" ? gpu.label : "integrated GPU",
    panel === "oled" ? "OLED" : panel === "miniled" ? "mini-LED" : panel === "ips" ? "IPS" : null,
    storage === "nvme" ? "NVMe SSD" : storage === "hdd" ? "HDD" : "SATA SSD",
  ].filter(Boolean);

  return {
    cpuClass: cpu.cls,
    cpuClassLabel: cpu.label,
    cpuCap: cpu.cap,
    gpuType: gpu.type,
    gpuClassLabel: gpu.label,
    gpuCap: gpu.cap,
    panelClass: panel,
    storageClass: storage,
    summary: parts.join(" · "),
  };
}

/**
 * Sanity-clamped component scores: a provided benchmark-style score is kept
 * ONLY when it is plausible for its hardware class; otherwise it is capped
 * (never inflated). This prevents random/inflated numbers from leaking into
 * any rating.
 */
export function credibleScores(profile: HardwareProfile, cpuScore: number, gpuScore: number): {
  cpu: number;
  gpu: number;
  cpuClamped: boolean;
  gpuClamped: boolean;
} {
  const cpu = Math.max(0, Math.min(cpuScore ?? 0, profile.cpuCap));
  const gpu = Math.max(0, Math.min(gpuScore ?? 0, profile.gpuCap));
  return {
    cpu: Math.round(cpu),
    gpu: Math.round(gpu),
    cpuClamped: (cpuScore ?? 0) > profile.cpuCap,
    gpuClamped: (gpuScore ?? 0) > profile.gpuCap,
  };
}
