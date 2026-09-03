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

// ---------------------------------------------------------------------------
// Field normalization — deterministic canonical forms
// ---------------------------------------------------------------------------

/**
 * Normalize CPU name to a canonical form.
 *
 * Strips vendor prefixes ("Intel Core", "AMD"), removes extra whitespace,
 * and preserves the meaningful model identifier.
 *
 * "Intel Core i7-13700H" → "i7-13700h"
 * "AMD Ryzen 7 7840HS" → "ryzen 7 7840hs"
 * "Apple M3 Pro" → "m3 pro"
 * "Intel Core Ultra 9 185H" → "ultra 9 185h"
 */
export function normalizeCpu(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Apple Silicon: handle BEFORE stripping prefixes to avoid double "m"
  const appleMatch = s.match(/^apple\s+m([1-4])\s*(pro|max|ultra)?$/i);
  if (appleMatch) {
    const chip = `m${appleMatch[1]}`;
    const suffix = appleMatch[2]?.toLowerCase();
    return suffix ? `${chip} ${suffix}` : chip;
  }

  // Strip common vendor prefixes (order matters: "Intel Core Ultra" before "Intel Core")
  s = s.replace(/^intel\s+core\s+ultra\s*/i, "ultra ");
  s = s.replace(/^intel\s+core\s*/i, "");
  s = s.replace(/^intel\s*/i, "");
  s = s.replace(/^amd\s*/i, "");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // Lowercase for comparison
  s = s.toLowerCase();

  return s;
}

/**
 * Normalize GPU name to a canonical form.
 *
 * Strips vendor prefixes, removes "Laptop GPU" suffix, and preserves
 * the meaningful model identifier.
 *
 * "NVIDIA GeForce RTX 4060 Laptop GPU" → "rtx 4060"
 * "NVIDIA GeForce RTX 4060" → "rtx 4060"
 * "RTX4060" → "rtx 4060"
 * "Intel Iris Xe Graphics" → "iris xe"
 * "AMD Radeon RX 7600M" → "rx 7600m"
 * "Intel UHD Graphics" → "uhd"
 */
export function normalizeGpu(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Strip vendor prefixes
  s = s.replace(/^nvidia\s+geforce\s*/i, "");
  s = s.replace(/^nvidia\s*/i, "");
  s = s.replace(/^amd\s+radeon\s*/i, "");
  s = s.replace(/^intel\s*/i, "");

  // Strip "Graphics" wherever it appears (not just at end)
  s = s.replace(/\s+graphics\s*/gi, " ");

  // Strip "Laptop GPU", "GPU" suffixes
  s = s.replace(/\s+laptop\s+gpu$/i, "");
  s = s.replace(/\s+gpu$/i, "");

  // Normalize "RTX4060" → "rtx 4060" (add space between prefix and number)
  s = s.replace(/^(rtx|gtx|mx|rx)(\d)/i, "$1 $2");

  // Collapse whitespace, lowercase
  s = s.replace(/\s+/g, " ").trim().toLowerCase();

  // Remove trailing "integrated" / "integrated graphics" if present
  s = s.replace(/\s+integrated$/i, "");

  return s;
}

/**
 * Normalize RAM to a numeric value in GB.
 * Handles "8GB", "8 GB", "8192 MB", "16g", etc.
 * Returns 0 if unparseable.
 */
export function normalizeRam(raw: string | number): number {
  if (typeof raw === "number") return Math.max(0, Math.round(raw));
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();

  // Try "Xgb", "X g", "Xg" pattern
  const gbMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:gb|g)$/);
  if (gbMatch) return Math.max(0, Math.round(parseFloat(gbMatch[1])));

  // Try "Xmb", "X m" pattern (convert to GB)
  const mbMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:mb|m)$/);
  if (mbMatch) return Math.max(0, Math.round(parseFloat(mbMatch[1]) / 1024));

  // Try plain number (assume GB)
  const plain = parseFloat(s);
  if (Number.isFinite(plain) && plain > 0) return Math.max(0, Math.round(plain));

  return 0;
}

/**
 * Normalize storage to a numeric value in GB.
 * Handles "512GB", "1 TB", "1024 GB", "256gb", etc.
 * Returns 0 if unparseable.
 */
export function normalizeStorage(raw: string | number): number {
  if (typeof raw === "number") return Math.max(0, Math.round(raw));
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();

  // Try "Xtb" pattern (convert to GB)
  const tbMatch = s.match(/(\d+(?:\.\d+)?)\s*tb$/);
  if (tbMatch) return Math.max(0, Math.round(parseFloat(tbMatch[1]) * 1024));

  // Try "Xgb", "X g" pattern
  const gbMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:gb|g)$/);
  if (gbMatch) return Math.max(0, Math.round(parseFloat(gbMatch[1])));

  // Try "Xmb", "X m" pattern (convert to GB)
  const mbMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:mb|m)$/);
  if (mbMatch) return Math.max(0, Math.round(parseFloat(mbMatch[1]) / 1024));

  // Try plain number (assume GB)
  const plain = parseFloat(s);
  if (Number.isFinite(plain) && plain > 0) return Math.max(0, Math.round(plain));

  return 0;
}

/**
 * Variant hardware fingerprint — identifies a unique hardware configuration.
 *
 * Two variants with the same fingerprint represent the same physical hardware.
 * Price is deliberately EXCLUDED — the same config at different prices
 * should not create duplicate entries.
 *
 * Fields used: normalized CPU, GPU, RAM, storage, storageType, displaySize,
 * displayRefreshRate, touchscreen, OS.
 */
export function variantFingerprint(v: Pick<ComputerVariant, "specs">): string {
  const s = v.specs;
  return [
    normalizeCpu(s.cpu),
    normalizeGpu(s.gpu),
    String(normalizeRam(String(s.ram ?? ""))),
    String(normalizeStorage(String(s.storage ?? ""))),
    normKey(s.storageType ?? ""),
    String(s.displaySize ?? ""),
    String(s.displayRefreshRate ?? ""),
    s.touchscreen === true ? "touch" : "notouch",
    normKey(s.os ?? ""),
  ].join("|");
}

/**
 * Detect whether two variants represent the same hardware configuration.
 * Uses the hardware fingerprint (no price comparison).
 */
export function isSameHardwareConfig(
  a: Pick<ComputerVariant, "specs">,
  b: Pick<ComputerVariant, "specs">
): boolean {
  return variantFingerprint(a) === variantFingerprint(b);
}

/**
 * Merge two variants that represent the same hardware config.
 * Prefers non-zero/non-empty incoming values; keeps existing reliable data
 * when the incoming has zero/empty/placeholder values.
 *
 * Price is merged: if incoming has a non-zero price, it updates.
 * If both have prices, the higher price wins (market data tends to decrease;
 * a higher price is more likely to be the accurate MSRP).
 */
export function mergeVariantData(
  existing: ComputerVariant,
  incoming: ComputerVariant
): ComputerVariant {
  // Always prefer existing id (stable identity)
  const merged = { ...existing };

  // Update price: non-zero incoming wins, or higher price wins
  if (incoming.price > 0 && incoming.price !== existing.price) {
    merged.price = Math.max(existing.price, incoming.price);
  }

  // Update rating/reviewCount: prefer higher review count (more reliable)
  if (incoming.reviewCount > existing.reviewCount) {
    merged.rating = incoming.rating;
    merged.reviewCount = incoming.reviewCount;
  }

  // Merge specs: prefer existing non-zero/non-empty values
  // Only overwrite with incoming when existing is zero/empty/placeholder
  merged.specs = mergeSpecs(existing.specs, incoming.specs);

  // Update description if existing is empty
  if (!existing.description && incoming.description) {
    merged.description = incoming.description;
  }

  // Update SKU if existing is empty
  if (!existing.sku && incoming.sku) {
    merged.sku = incoming.sku;
  }

  return merged;
}

/**
 * Merge two spec objects: prefer existing non-zero/non-empty values.
 * Never overwrites a good existing value with a placeholder.
 */
function mergeSpecs(
  existing: ComputerSpecs,
  incoming: ComputerSpecs
): ComputerSpecs {
  const merged = { ...existing };

  // For each string field: prefer existing if non-empty/placeholder, else use incoming
  const strFields: (keyof ComputerSpecs)[] = [
    "cpu", "cpuCores", "gpu", "ramType", "ramSpeed", "ramUpgradeable",
    "storageType", "display", "resolution", "panelType", "brightness",
    "colorCoverage", "hdr", "aspectRatio", "batteryCapacity", "dimensions",
    "charger", "wifi", "bluetooth", "usbA", "usbC", "thunderbolt", "hdmi",
    "displayPort", "tpm", "webcam", "microphones", "speakers", "audioFeatures",
    "keyboardLayout", "buildMaterial", "militaryCertification", "coolingSystem",
    "fans", "upgradeability", "warranty", "os",
  ];

  for (const field of strFields) {
    const e = existing[field];
    const i = incoming[field];
    if (
      (e === "" || e === undefined || e === "Unknown") &&
      typeof i === "string" && i !== "" && i !== "Unknown"
    ) {
      (merged as Record<string, unknown>)[field] = i;
    }
  }

  // For numeric fields: prefer existing if > 0, else use incoming
  const numFields: (keyof ComputerSpecs)[] = [
    "cpuScore", "gpuScore", "ram", "storage", "displaySize",
    "displayRefreshRate", "batteryLife", "weight",
  ];

  for (const field of numFields) {
    const e = existing[field] as number;
    const i = incoming[field] as number;
    if ((e === 0 || e === undefined) && i > 0) {
      (merged as Record<string, unknown>)[field] = i;
    }
  }

  // For boolean fields: prefer existing if defined, else use incoming
  const boolFields: (keyof ComputerSpecs)[] = [
    "touchscreen", "ethernet", "sdCard", "audioJack", "fingerprint",
    "faceRecognition", "irCamera", "privacyShutter", "smartCardReader",
    "backlitKeyboard", "rgbKeyboard", "numpad", "stylusSupport",
  ];

  for (const field of boolFields) {
    const e = existing[field];
    const i = incoming[field];
    if (e === undefined && i !== undefined) {
      (merged as Record<string, unknown>)[field] = i;
    }
  }

  // For ports: merge if existing is empty
  if ((!existing.ports || existing.ports.length === 0) && incoming.ports?.length) {
    merged.ports = incoming.ports;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

/**
 * Find an existing model in the catalog that matches the incoming model
 * by normalized identity (brand + family + name + generation).
 *
 * Returns the matching model or undefined.
 */
export function findExistingModel(
  incoming: Pick<ComputerModel, "brand" | "family" | "name" | "generation">,
  catalog: ComputerModel[]
): ComputerModel | undefined {
  const incomingKey = modelNameKey(incoming.brand, incoming.family, incoming.name);
  const incomingGen = normGeneration(incoming.generation);

  return catalog.find((m) => {
    if (modelNameKey(m.brand, m.family, m.name) !== incomingKey) return false;
    return normGeneration(m.generation) === incomingGen;
  });
}

/**
 * Find an existing variant in a model that matches the incoming variant
 * by hardware fingerprint (same hardware config, regardless of price).
 *
 * Returns the matching variant or undefined.
 */
export function findExistingVariant(
  incoming: ComputerVariant,
  modelVariants: ComputerVariant[]
): ComputerVariant | undefined {
  const fp = variantFingerprint(incoming);
  return modelVariants.find((v) => variantFingerprint(v) === fp);
}

/**
 * Add or merge a variant into a model's variant list.
 * - If a variant with the same ID exists → merge (price update, spec fill)
 * - If a variant with the same hardware fingerprint exists → merge
 * - Otherwise → add as new variant
 *
 * Returns the (possibly mutated) variants array.
 */
export function upsertVariant(
  model: ComputerModel,
  incoming: ComputerVariant
): ComputerVariant[] {
  const variants = [...model.variants];

  // Level 1: exact ID match
  const byId = variants.findIndex((v) => v.id === incoming.id);
  if (byId >= 0) {
    variants[byId] = mergeVariantData(variants[byId], incoming);
    return variants;
  }

  // Level 2: same hardware fingerprint
  const fp = variantFingerprint(incoming);
  const byFp = variants.findIndex((v) => variantFingerprint(v) === fp);
  if (byFp >= 0) {
    variants[byFp] = mergeVariantData(variants[byFp], incoming);
    return variants;
  }

  // No match — add as new variant
  variants.push(incoming);
  return variants;
}

/**
 * Determine the best source for a field value based on provenance.
 * "base" (manufacturer-confirmed) > "manual" > "ai" (AI-discovered).
 *
 * Returns true if `existingSource` is more reliable than `incomingSource`.
 */
export function existingSourceWins(
  existingSource: string | undefined,
  incomingSource: string | undefined
): boolean {
  const rank: Record<string, number> = { base: 3, manual: 2, ai: 1 };
  const e = rank[existingSource ?? "ai"] ?? 0;
  const i = rank[incomingSource ?? "ai"] ?? 0;
  return e >= i;
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
    String(v.specs.displaySize ?? ""),
    String(v.specs.displayRefreshRate ?? ""),
    v.specs.touchscreen === true ? "touch" : "notouch",
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
