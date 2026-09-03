import { describe, it, expect } from "vitest";
import {
  normKey,
  normGeneration,
  modelNameKey,
  modelSignature,
  normalizeCpu,
  normalizeGpu,
  normalizeRam,
  normalizeStorage,
  variantFingerprint,
  isSameHardwareConfig,
  mergeVariantData,
  findExistingModel,
  findExistingVariant,
  upsertVariant,
} from "@/lib/server/model-normalize";
import { ComputerModel, ComputerVariant } from "@/lib/data/types";

/**
 * Phase 2.3 — Normalization & Deduplication Tests
 *
 * Validates that:
 *  - Equivalent representations normalize to the same canonical form
 *  - Different hardware remains distinct
 *  - Variant fingerprints correctly identify hardware configs
 *  - Deduplication merges correctly without data loss
 *  - Existing tests continue to pass (regression)
 */

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const DEFAULT_SPECS = {
  cpu: "Intel Core i7-13700H",
  cpuScore: 80,
  gpu: "NVIDIA RTX 4060",
  gpuScore: 75,
  ram: 16,
  storage: 512,
  storageType: "SSD" as const,
  display: "15.6 inch IPS",
  displaySize: 15.6,
  displayRefreshRate: 144,
  touchscreen: false,
  batteryLife: 8,
  weight: 2.0,
  ports: [] as string[],
  os: "Windows 11",
};

function makeVariant(overrides: Partial<Omit<ComputerVariant, "specs">> & { id: string; specs?: Partial<typeof DEFAULT_SPECS> }): ComputerVariant {
  const { specs: specOverrides, ...rest } = overrides;
  return {
    name: `Variant ${rest.id}`,
    brand: "TestBrand",
    category: "gaming-laptop",
    price: 1000,
    imageUrl: "",
    rating: 4.5,
    reviewCount: 100,
    year: 2024,
    description: "",
    ...rest,
    specs: { ...DEFAULT_SPECS, ...specOverrides },
  } as ComputerVariant;
}

function makeModel(
  id: string,
  overrides: Partial<ComputerModel> = {}
): ComputerModel {
  return {
    id,
    name: `Model ${id}`,
    brand: "TestBrand",
    category: "gaming-laptop",
    year: 2024,
    description: "",
    imageUrl: "",
    variants: [makeVariant({ id: `${id}-v1` })],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeCpu
// ---------------------------------------------------------------------------

describe("normalizeCpu", () => {
  it("strips Intel Core prefix", () => {
    expect(normalizeCpu("Intel Core i7-13700H")).toBe("i7-13700h");
  });

  it("strips Intel Core Ultra prefix", () => {
    expect(normalizeCpu("Intel Core Ultra 9 185H")).toBe("ultra 9 185h");
  });

  it("strips Intel prefix only", () => {
    expect(normalizeCpu("Intel i5-1240P")).toBe("i5-1240p");
  });

  it("strips AMD prefix", () => {
    expect(normalizeCpu("AMD Ryzen 7 7840HS")).toBe("ryzen 7 7840hs");
  });

  it("normalizes Apple Silicon", () => {
    expect(normalizeCpu("Apple M3 Pro")).toBe("m3 pro");
  });

  it("normalizes Apple M1", () => {
    expect(normalizeCpu("M1")).toBe("m1");
  });

  it("normalizes Apple M2 Max", () => {
    expect(normalizeCpu("Apple M2 Max")).toBe("m2 max");
  });

  it("handles empty input", () => {
    expect(normalizeCpu("")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(normalizeCpu("  Intel   Core   i7-13700H  ")).toBe("i7-13700h");
  });

  it("lowercases output", () => {
    expect(normalizeCpu("Intel Core i7-13700H")).toBe("i7-13700h");
  });

  it("equivalent representations normalize the same", () => {
    expect(normalizeCpu("Intel Core i7-13700H")).toBe(normalizeCpu("i7-13700H"));
    expect(normalizeCpu("Intel Core i7-13700H")).toBe(normalizeCpu("  i7-13700H  "));
  });
});

// ---------------------------------------------------------------------------
// normalizeGpu
// ---------------------------------------------------------------------------

describe("normalizeGpu", () => {
  it("strips NVIDIA GeForce prefix", () => {
    expect(normalizeGpu("NVIDIA GeForce RTX 4060")).toBe("rtx 4060");
  });

  it("strips Laptop GPU suffix", () => {
    expect(normalizeGpu("NVIDIA GeForce RTX 4060 Laptop GPU")).toBe("rtx 4060");
  });

  it("strips Graphics suffix", () => {
    expect(normalizeGpu("Intel Iris Xe Graphics")).toBe("iris xe");
  });

  it("strips GPU suffix", () => {
    expect(normalizeGpu("Intel UHD Graphics 770")).toBe("uhd 770");
  });

  it("normalizes glued format RTX4060", () => {
    expect(normalizeGpu("RTX4060")).toBe("rtx 4060");
  });

  it("strips AMD Radeon prefix", () => {
    expect(normalizeGpu("AMD Radeon RX 7600M")).toBe("rx 7600m");
  });

  it("strips NVIDIA prefix only", () => {
    expect(normalizeGpu("NVIDIA RTX 4060")).toBe("rtx 4060");
  });

  it("handles empty input", () => {
    expect(normalizeGpu("")).toBe("");
  });

  it("equivalent representations normalize the same", () => {
    const full = "NVIDIA GeForce RTX 4060 Laptop GPU";
    const short = "RTX 4060";
    expect(normalizeGpu(full)).toBe(normalizeGpu(short));
  });

  it("different GPUs remain different", () => {
    expect(normalizeGpu("RTX 4060")).not.toBe(normalizeGpu("RTX 4070"));
  });

  it("keeps meaningful Max-Q/Max-P suffixes if present", () => {
    // These are in the name after the model number, so they should be preserved
    // if they appear in the raw string. Currently the regex doesn't strip them.
    expect(normalizeGpu("RTX 4060 Max-Q")).toContain("max-q");
  });
});

// ---------------------------------------------------------------------------
// normalizeRam
// ---------------------------------------------------------------------------

describe("normalizeRam", () => {
  it("normalizes 8GB string", () => {
    expect(normalizeRam("8GB")).toBe(8);
  });

  it("normalizes 8 GB with space", () => {
    expect(normalizeRam("8 GB")).toBe(8);
  });

  it("normalizes 8192 MB to GB", () => {
    expect(normalizeRam("8192 MB")).toBe(8);
  });

  it("normalizes numeric input", () => {
    expect(normalizeRam(16)).toBe(16);
  });

  it("normalizes 16g shorthand", () => {
    expect(normalizeRam("16g")).toBe(16);
  });

  it("returns 0 for unparseable input", () => {
    expect(normalizeRam("unknown")).toBe(0);
  });

  it("rounds fractional values", () => {
    expect(normalizeRam("8.5GB")).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// normalizeStorage
// ---------------------------------------------------------------------------

describe("normalizeStorage", () => {
  it("normalizes 512GB", () => {
    expect(normalizeStorage("512GB")).toBe(512);
  });

  it("normalizes 1 TB to 1024 GB", () => {
    expect(normalizeStorage("1 TB")).toBe(1024);
  });

  it("normalizes 2 TB to 2048 GB", () => {
    expect(normalizeStorage("2 TB")).toBe(2048);
  });

  it("normalizes 0.5 TB to 512 GB", () => {
    expect(normalizeStorage("0.5 TB")).toBe(512);
  });

  it("normalizes numeric input", () => {
    expect(normalizeStorage(256)).toBe(256);
  });

  it("returns 0 for unparseable input", () => {
    expect(normalizeStorage("unknown")).toBe(0);
  });

  it("normalizes 256gb shorthand", () => {
    expect(normalizeStorage("256gb")).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// normKey
// ---------------------------------------------------------------------------

describe("normKey", () => {
  it("lowercases and strips non-alphanumeric", () => {
    expect(normKey("HP EliteBook 845 G10")).toBe("hpelitebook845g10");
  });

  it("handles null/undefined", () => {
    expect(normKey(null)).toBe("");
    expect(normKey(undefined)).toBe("");
  });

  it("strips all punctuation", () => {
    expect(normKey("i7-13700H")).toBe("i713700h");
  });
});

// ---------------------------------------------------------------------------
// normGeneration
// ---------------------------------------------------------------------------

describe("normGeneration", () => {
  it("normalizes G10", () => {
    expect(normGeneration("G10")).toBe("g10");
  });

  it("normalizes gen 10", () => {
    expect(normGeneration("gen 10")).toBe("g10");
  });

  it("normalizes Gen10", () => {
    expect(normGeneration("Gen10")).toBe("g10");
  });

  it("normalizes generation 11", () => {
    expect(normGeneration("generation 11")).toBe("g11");
  });

  it("returns empty for empty input", () => {
    expect(normGeneration("")).toBe("");
    expect(normGeneration(null)).toBe("");
  });

  it("handles non-numeric generations", () => {
    expect(normGeneration("M3")).toBe("m3");
  });
});

// ---------------------------------------------------------------------------
// variantFingerprint
// ---------------------------------------------------------------------------

describe("variantFingerprint", () => {
  it("same hardware → same fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { cpu: "Intel Core i7-13700H", gpu: "RTX 4060", ram: 16, storage: 512, displaySize: 15.6, displayRefreshRate: 144, touchscreen: false } });
    const b = makeVariant({ id: "b", specs: { cpu: "i7-13700H", gpu: "NVIDIA GeForce RTX 4060", ram: 16, storage: 512, displaySize: 15.6, displayRefreshRate: 144, touchscreen: false } });
    expect(variantFingerprint(a)).toBe(variantFingerprint(b));
  });

  it("different GPU → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { gpu: "RTX 4060" } });
    const b = makeVariant({ id: "b", specs: { gpu: "RTX 4070" } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });

  it("different RAM → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { ram: 16 } });
    const b = makeVariant({ id: "b", specs: { ram: 32 } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });

  it("different storage → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { storage: 512 } });
    const b = makeVariant({ id: "b", specs: { storage: 1024 } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });

  it("different display size → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { displaySize: 15.6 } });
    const b = makeVariant({ id: "b", specs: { displaySize: 14.0 } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });

  it("different touchscreen → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { touchscreen: false } });
    const b = makeVariant({ id: "b", specs: { touchscreen: true } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });

  it("different price → SAME fingerprint (hardware identity)", () => {
    const a = makeVariant({ id: "a", price: 140000, specs: { ram: 16, storage: 512 } });
    const b = makeVariant({ id: "b", price: 150000, specs: { ram: 16, storage: 512 } });
    expect(variantFingerprint(a)).toBe(variantFingerprint(b));
  });

  it("different refresh rate → different fingerprint", () => {
    const a = makeVariant({ id: "a", specs: { displayRefreshRate: 60 } });
    const b = makeVariant({ id: "b", specs: { displayRefreshRate: 144 } });
    expect(variantFingerprint(a)).not.toBe(variantFingerprint(b));
  });
});

// ---------------------------------------------------------------------------
// isSameHardwareConfig
// ---------------------------------------------------------------------------

describe("isSameHardwareConfig", () => {
  it("returns true for equivalent hardware", () => {
    const a = makeVariant({ id: "a", specs: { cpu: "Intel Core i7-13700H", gpu: "NVIDIA RTX 4060", ram: 16, storage: 512 } });
    const b = makeVariant({ id: "b", specs: { cpu: "i7-13700H", gpu: "RTX 4060", ram: 16, storage: 512 } });
    expect(isSameHardwareConfig(a, b)).toBe(true);
  });

  it("returns false for different hardware", () => {
    const a = makeVariant({ id: "a", specs: { gpu: "RTX 4060" } });
    const b = makeVariant({ id: "b", specs: { gpu: "RTX 4070" } });
    expect(isSameHardwareConfig(a, b)).toBe(false);
  });

  it("ignores price differences", () => {
    const a = makeVariant({ id: "a", price: 100000, specs: { ram: 16, storage: 512 } });
    const b = makeVariant({ id: "b", price: 200000, specs: { ram: 16, storage: 512 } });
    expect(isSameHardwareConfig(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeVariantData
// ---------------------------------------------------------------------------

describe("mergeVariantData", () => {
  it("keeps existing non-zero price when incoming is 0", () => {
    const existing = makeVariant({ id: "e", price: 1500 });
    const incoming = makeVariant({ id: "i", price: 0 });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.price).toBe(1500);
  });

  it("updates price when incoming is higher", () => {
    const existing = makeVariant({ id: "e", price: 1000 });
    const incoming = makeVariant({ id: "i", price: 1500 });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.price).toBe(1500);
  });

  it("keeps higher existing price over lower incoming", () => {
    const existing = makeVariant({ id: "e", price: 2000 });
    const incoming = makeVariant({ id: "i", price: 1500 });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.price).toBe(2000);
  });

  it("keeps existing id", () => {
    const existing = makeVariant({ id: "existing-id" });
    const incoming = makeVariant({ id: "incoming-id" });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.id).toBe("existing-id");
  });

  it("prefers higher review count", () => {
    const existing = makeVariant({ id: "e", rating: 4.0, reviewCount: 50 });
    const incoming = makeVariant({ id: "i", rating: 4.8, reviewCount: 200 });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.rating).toBe(4.8);
    expect(merged.reviewCount).toBe(200);
  });

  it("fills empty existing description from incoming", () => {
    const existing = makeVariant({ id: "e", description: "" });
    const incoming = makeVariant({ id: "i", description: "A great laptop" });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.description).toBe("A great laptop");
  });

  it("keeps existing description when non-empty", () => {
    const existing = makeVariant({ id: "e", description: "Existing desc" });
    const incoming = makeVariant({ id: "i", description: "New desc" });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.description).toBe("Existing desc");
  });

  it("fills empty existing SKU from incoming", () => {
    const existing = makeVariant({ id: "e", sku: undefined });
    const incoming = makeVariant({ id: "i", sku: "SKU-123" });
    const merged = mergeVariantData(existing, incoming);
    expect(merged.sku).toBe("SKU-123");
  });
});

// ---------------------------------------------------------------------------
// findExistingModel
// ---------------------------------------------------------------------------

describe("findExistingModel", () => {
  const catalog: ComputerModel[] = [
    makeModel("model-1", { brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" }),
    makeModel("model-2", { brand: "Lenovo", family: "LOQ", name: "LOQ 16", generation: "G10" }),
    makeModel("model-3", { brand: "HP", family: "Victus", name: "Victus 15", generation: "Gen 11" }),
  ];

  it("finds exact match", () => {
    const result = findExistingModel(
      { brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" },
      catalog
    );
    expect(result?.id).toBe("model-1");
  });

  it("finds match with different generation format", () => {
    const result = findExistingModel(
      { brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "gen 10" },
      catalog
    );
    expect(result?.id).toBe("model-1");
  });

  it("does NOT match different model size", () => {
    const result = findExistingModel(
      { brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G11" },
      catalog
    );
    expect(result).toBeUndefined();
  });

  it("does NOT match different brand", () => {
    const result = findExistingModel(
      { brand: "HP", family: "LOQ", name: "LOQ 15", generation: "G10" },
      catalog
    );
    expect(result).toBeUndefined();
  });

  it("does NOT match different family", () => {
    const result = findExistingModel(
      { brand: "Lenovo", family: "IdeaPad", name: "LOQ 15", generation: "G10" },
      catalog
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty catalog", () => {
    const result = findExistingModel(
      { brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" },
      []
    );
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findExistingVariant
// ---------------------------------------------------------------------------

describe("findExistingVariant", () => {
  const variants: ComputerVariant[] = [
    makeVariant({ id: "v1", specs: { cpu: "i7-13700H", gpu: "RTX 4060", ram: 16, storage: 512 } }),
    makeVariant({ id: "v2", specs: { cpu: "i7-13700H", gpu: "RTX 4070", ram: 32, storage: 1024 } }),
  ];

  it("finds matching variant by hardware fingerprint", () => {
    const incoming = makeVariant({
      id: "v-new",
      specs: { cpu: "Intel Core i7-13700H", gpu: "NVIDIA GeForce RTX 4060", ram: 16, storage: 512 },
    });
    const result = findExistingVariant(incoming, variants);
    expect(result?.id).toBe("v1");
  });

  it("returns undefined for non-matching variant", () => {
    const incoming = makeVariant({
      id: "v-new",
      specs: { cpu: "i7-13700H", gpu: "RTX 4080", ram: 64, storage: 2048 },
    });
    const result = findExistingVariant(incoming, variants);
    expect(result).toBeUndefined();
  });

  it("finds variant regardless of price", () => {
    const incoming = makeVariant({
      id: "v-new",
      price: 999999,
      specs: { cpu: "i7-13700H", gpu: "RTX 4060", ram: 16, storage: 512 },
    });
    const result = findExistingVariant(incoming, variants);
    expect(result?.id).toBe("v1");
  });
});

// ---------------------------------------------------------------------------
// upsertVariant
// ---------------------------------------------------------------------------

describe("upsertVariant", () => {
  it("adds new variant when no match", () => {
    const model = makeModel("m1", {
      variants: [
        makeVariant({ id: "v1", specs: { gpu: "RTX 4060", ram: 16 } }),
      ],
    });
    const incoming = makeVariant({ id: "v2", specs: { gpu: "RTX 4070", ram: 32 } });
    const result = upsertVariant(model, incoming);
    expect(result.length).toBe(2);
    expect(result[1].id).toBe("v2");
  });

  it("merges variant with same ID", () => {
    const model = makeModel("m1", {
      variants: [
        makeVariant({ id: "v1", price: 1000, description: "Old" }),
      ],
    });
    const incoming = makeVariant({ id: "v1", price: 1500, description: "New" });
    const result = upsertVariant(model, incoming);
    expect(result.length).toBe(1);
    expect(result[0].price).toBe(1500);
    expect(result[0].description).toBe("Old"); // existing wins
  });

  it("merges variant with same hardware fingerprint", () => {
    const model = makeModel("m1", {
      variants: [
        makeVariant({ id: "v1", price: 1000, specs: { cpu: "i7-13700H", gpu: "RTX 4060", ram: 16, storage: 512 } }),
      ],
    });
    const incoming = makeVariant({
      id: "v-different",
      price: 1500,
      specs: { cpu: "Intel Core i7-13700H", gpu: "NVIDIA RTX 4060", ram: 16, storage: 512 },
    });
    const result = upsertVariant(model, incoming);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("v1"); // existing ID preserved
    expect(result[0].price).toBe(1500); // price updated
  });
});

// ---------------------------------------------------------------------------
// modelSignature / modelNameKey — regression
// ---------------------------------------------------------------------------

describe("modelSignature", () => {
  it("same model → same signature", () => {
    const a = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" });
    const b = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "gen 10" });
    expect(a).toBe(b);
  });

  it("different generation → different signature", () => {
    const a = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" });
    const b = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G11" });
    expect(a).not.toBe(b);
  });

  it("different name → different signature", () => {
    const a = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 15", generation: "G10" });
    const b = modelSignature({ brand: "Lenovo", family: "LOQ", name: "LOQ 16", generation: "G10" });
    expect(a).not.toBe(b);
  });
});

describe("modelNameKey", () => {
  it("same model → same key", () => {
    const a = modelNameKey("Lenovo", "LOQ", "LOQ 15");
    const b = modelNameKey("Lenovo", "LOQ", "LOQ 15");
    expect(a).toBe(b);
  });

  it("different brand → different key", () => {
    const a = modelNameKey("Lenovo", "LOQ", "LOQ 15");
    const b = modelNameKey("HP", "LOQ", "LOQ 15");
    expect(a).not.toBe(b);
  });

  it("different name → different key", () => {
    const a = modelNameKey("Lenovo", "LOQ", "LOQ 15");
    const b = modelNameKey("Lenovo", "LOQ", "LOQ 16");
    expect(a).not.toBe(b);
  });
});
