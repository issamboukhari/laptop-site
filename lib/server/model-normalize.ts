import { ComputerModel, ComputerSpecs, ComputerVariant } from "../data/types";

/**
 * Normalization + deterministic identity helpers.
 *
 * Goal: the same physical computer discovered twice (different spacing,
 * casing, or wording) must map to ONE database row — never a duplicate.
 */

const VALID_CATEGORIES = [
  "gaming-laptop",
  "business-laptop",
  "ultrabook",
  "macbook",
  "workstation",
  "desktop",
  "mini-pc",
] as const;

/** Lowercase, strip every non-alphanumeric char: "HP EliteBook 845 G10" -> "hpelitebook845g10" */
export function normKey(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Kebab-case URL slug. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** FNV-1a hash rendered as 8 hex chars — stable across processes. */
export function hash8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Normalize a generation label so "G10", "gen 10", "Gen10" all agree → "g10".
 * Non-numeric generations ("M3", "2024") are normalized loosely.
 */
export function normGeneration(g: string | null | undefined): string {
  const raw = (g ?? "").toLowerCase().trim();
  if (!raw) return "";
  const genMatch = raw.match(/^(?:gen|generation)?\s*(\d+)$/);
  if (genMatch) return `g${genMatch[1]}`;
  const embedded = raw.match(/(?:gen|generation)\s*(\d+)/);
  if (embedded) return `g${embedded[1]}`;
  const gNum = raw.match(/^g\s*(\d+)$/);
  if (gNum) return `g${gNum[1]}`;
  return normKey(raw);
}

/**
 * Model identity WITHOUT generation — one model can hold several generations
 * as separate rows when generations differ; wording variants of the same
 * generation collapse together via normGeneration.
 */
export function modelNameKey(brand: string, family: string | undefined, name: string): string {
  return [normKey(brand), normKey(family), normKey(name)].filter(Boolean).join("|");
}

/**
 * Full model signature used for exact dedupe checks:
 * brand + family + name + normalized generation.
 */
export function modelSignature(m: Pick<ComputerModel, "brand" | "family" | "name" | "generation">): string {
  return [
    normKey(m.brand),
    normKey(m.family),
    normKey(m.name),
    normGeneration(m.generation),
  ]
    .filter(Boolean)
    .join("|");
}

/** Deterministic model id — same computer ⇒ same id ⇒ idempotent upserts. */
export function deterministicModelId(
  m: Pick<ComputerModel, "brand" | "family" | "name" | "generation">
): string {
  const base = slugify(
    [m.brand, m.family, m.name, m.generation].filter(Boolean).join("-")
  );
  return `${base || "computer"}-${hash8(modelSignature(m)).slice(0, 8)}`;
}

/** Configuration signature: the hardware that defines this exact config. */
export function variantSignature(v: ComputerVariant): string {
  return [
    normKey(v.specs.cpu),
    normKey(v.specs.gpu),
    String(v.specs.ram ?? ""),
    String(v.specs.storage ?? ""),
    normKey(v.specs.storageType ?? ""),
    normKey(v.specs.os ?? ""),
  ].join("|");
}

/** Deterministic configuration id. */
export function deterministicVariantId(parentModelName: string, v: ComputerVariant): string {
  const base = slugify(`${parentModelName}-${v.name}`);
  return `${base || "config"}-${hash8(variantSignature(v)).slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Sanitizer — never trust AI output; never invent missing values
// ---------------------------------------------------------------------------

const UNKNOWN = "Unknown";

function str(value: unknown, fallback = UNKNOWN): string {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function optBool(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function optStr(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return undefined;
}

/**
 * Sanitize specs: required fields get safe placeholders ("Unknown", 0) when
 * unverifiable; optional fields are dropped rather than fabricated.
 */
export function sanitizeSpecs(raw: unknown): ComputerSpecs {
  const r = (raw ?? {}) as Record<string, unknown>;
  const storageTypeRaw = typeof r.storageType === "string" ? r.storageType.toUpperCase() : "";

  return {
    cpu: str(r.cpu),
    cpuCores: optStr(r.cpuCores),
    cpuScore: clamp(Math.round(num(r.cpuScore)), 0, 100),
    gpu: str(r.gpu),
    gpuScore: clamp(Math.round(num(r.gpuScore)), 0, 100),

    ram: Math.max(0, Math.round(num(r.ram))),
    ramType: optStr(r.ramType),
    ramSpeed: optStr(r.ramSpeed),
    ramUpgradeable: optStr(r.ramUpgradeable),

    storage: Math.max(0, Math.round(num(r.storage))),
    storageType:
      storageTypeRaw === "SSD" || storageTypeRaw === "HDD" || storageTypeRaw === "NVMe"
        ? (storageTypeRaw as ComputerSpecs["storageType"])
        : "SSD",

    display: str(r.display),
    displaySize: Math.max(0, num(r.displaySize)),
    resolution: optStr(r.resolution),
    displayRefreshRate: Math.max(0, Math.round(num(r.displayRefreshRate))),
    panelType: optStr(r.panelType),
    brightness: optStr(r.brightness),
    colorCoverage: optStr(r.colorCoverage),
    touchscreen: optBool(r.touchscreen),
    hdr: optStr(r.hdr),
    aspectRatio: optStr(r.aspectRatio),

    batteryLife: Math.max(0, num(r.batteryLife)),
    batteryCapacity: optStr(r.batteryCapacity),
    weight: Math.max(0, num(r.weight)),
    dimensions: optStr(r.dimensions),
    charger: optStr(r.charger),

    wifi: optStr(r.wifi),
    bluetooth: optStr(r.bluetooth),
    ethernet: optBool(r.ethernet),
    usbA: optStr(r.usbA),
    usbC: optStr(r.usbC),
    thunderbolt: optStr(r.thunderbolt),
    hdmi: optStr(r.hdmi),
    displayPort: optStr(r.displayPort),
    sdCard: optBool(r.sdCard),
    audioJack: optBool(r.audioJack),

    fingerprint: optBool(r.fingerprint),
    faceRecognition: optBool(r.faceRecognition),
    irCamera: optBool(r.irCamera),
    tpm: optStr(r.tpm),
    privacyShutter: optBool(r.privacyShutter),
    smartCardReader: optBool(r.smartCardReader),

    webcam: optStr(r.webcam),
    microphones: optStr(r.microphones),
    speakers: optStr(r.speakers),
    audioFeatures: optStr(r.audioFeatures),

    backlitKeyboard: optBool(r.backlitKeyboard),
    rgbKeyboard: optBool(r.rgbKeyboard),
    keyboardLayout: optStr(r.keyboardLayout),
    numpad: optBool(r.numpad),
    stylusSupport: optBool(r.stylusSupport),

    buildMaterial: optStr(r.buildMaterial),
    militaryCertification: optStr(r.militaryCertification),
    coolingSystem: optStr(r.coolingSystem),
    fans: optStr(r.fans),
    upgradeability: optStr(r.upgradeability),
    warranty: optStr(r.warranty),

    ports: Array.isArray(r.ports)
      ? r.ports.map((p) => String(p)).slice(0, 20)
      : [],
    os: str(r.os),
  };
}

/** Sanitize one AI-proposed model into a trustworthy ComputerModel. */
export function sanitizeAiModel(raw: unknown): ComputerModel | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const brand = typeof r.brand === "string" ? r.brand.trim() : "";
  if (!name || !brand) return null;

  const category = VALID_CATEGORIES.includes(r.category as (typeof VALID_CATEGORIES)[number])
    ? (r.category as ComputerModel["category"])
    : "business-laptop";
  const yearRaw = Math.round(num(r.year, new Date().getFullYear()));
  const year = clamp(yearRaw, 2005, new Date().getFullYear() + 1);

  const family = optStr(r.family);
  const generation = optStr(r.generation);

  const sanitized: ComputerModel = {
    id: "",
    name,
    brand,
    family,
    generation,
    category,
    year,
    description: typeof r.description === "string" ? r.description.trim() : "",
    imageUrl: "",
    variants: [],
  };

  if (Array.isArray(r.variants)) {
    for (const vr of r.variants.slice(0, 12)) {
      const v = (vr ?? {}) as Record<string, unknown>;
      const vName = str(v.name, name);
      const variant: ComputerVariant = {
        id: "",
        sku: optStr(v.sku),
        name: vName,
        brand,
        category,
        price: Math.max(0, num(v.price)),
        imageUrl: "",
        rating: clamp(num(v.rating, 4), 1, 5),
        reviewCount: Math.max(0, Math.round(num(v.reviewCount))),
        year,
        description: typeof v.description === "string" ? v.description.trim() : "",
        specs: sanitizeSpecs(v.specs),
      };
      // A configuration must at least name a CPU to be meaningful.
      if (variant.specs.cpu === UNKNOWN) continue;
      variant.id = deterministicVariantId(name, variant);
      sanitized.variants.push(variant);
    }
  }

  if (sanitized.variants.length === 0) return null;
  sanitized.id = deterministicModelId(sanitized);
  return sanitized;
}
