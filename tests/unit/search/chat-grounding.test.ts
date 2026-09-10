import { describe, it, expect, beforeAll } from "vitest";
import { getAllModels } from "@/lib/server/database";
import {
  resolveChatComputers,
  formatComputer,
  ratingsLine,
  CHAT_SYSTEM_PROMPT,
  buildUserPrompt,
  type ChatComputerResolver,
} from "@/lib/server/chat-grounding";

/**
 * Phase 3.2.6 — Chat grounding boundary tests
 *
 * The chat AI may only learn about computers that resolve to REAL catalog
 * variants. These tests verify:
 *  - resolution returns only verified variants; unknowns → missingIds
 *  - formatted context is verbatim catalog data (no fabrication)
 *  - configurations are NEVER merged (each block matches its own variant)
 *  - not-found & unknown-spec representations exist in the prompt
 */

let allModels: Awaited<ReturnType<typeof getAllModels>>;

beforeAll(async () => {
  allModels = await getAllModels();
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function stubDb(overrides?: Partial<ChatComputerResolver>): ChatComputerResolver {
  const variant = allModels[0].variants[0];
  const model = allModels[1] ?? allModels[0];
  return {
    findVariantById: async (id) => (id === variant.id ? variant : undefined),
    getModelById: async (id) => (id === model.id ? model : undefined),
    ...overrides,
  };
}

describe("resolveChatComputers", () => {
  it("resolves only real variants; unknown IDs are reported as missing", async () => {
    const db = stubDb();
    const realVariant = allModels[0].variants[0];
    const { resolved, missingIds } = await resolveChatComputers(
      [realVariant.id, "invented-id-000", "also-fake"],
      db
    );
    expect(resolved.map((v) => v.id)).toContain(realVariant.id);
    expect(missingIds).toEqual(["invented-id-000", "also-fake"]);
  });

  it("expands a model ID to its own variants (never outside the model)", async () => {
    const db = stubDb();
    const model = allModels[1] ?? allModels[0];
    const { resolved, missingIds } = await resolveChatComputers([model.id], db);
    expect(missingIds).toEqual([]);
    const variantIds = resolved.map((v) => v.id);
    const owned = new Set(model.variants.map((v) => v.id));
    expect(variantIds.length).toBeGreaterThan(0);
    expect(variantIds.every((id) => owned.has(id))).toBe(true);
  });

  it("empty input resolves to nothing", async () => {
    const db = stubDb();
    const { resolved, missingIds } = await resolveChatComputers([], db);
    expect(resolved).toHaveLength(0);
    expect(missingIds).toHaveLength(0);
  });

  it("a model returned by the db without variants resolves as missing", async () => {
    const db = stubDb({ getModelById: async () => ({ variants: [] }) });
    const { resolved, missingIds } = await resolveChatComputers(["model-with-no-variants"], db);
    expect(resolved).toHaveLength(0);
    expect(missingIds).toEqual(["model-with-no-variants"]);
  });
});

// ---------------------------------------------------------------------------
// Context fidelity (verbatim catalog data, no merges)
// ---------------------------------------------------------------------------

describe("formatComputer — verbatim catalog data", () => {
  it("renders a real variant's RAM exactly as stored", () => {
    const v = allModels[0].variants[0];
    const text = formatComputer(v);
    expect(text).toContain(`RAM: ${v.specs.ram}GB`);
    expect(text).toContain(`Storage: ${v.specs.storage}GB ${v.specs.storageType}`);
    expect(text).toContain(`CPU: ${v.specs.cpu}`);
    expect(text).toContain(`GPU: ${v.specs.gpu}`);
    expect(text).toContain(`$${v.price}`);
    expect(text).toContain(`${v.brand} ${v.name}`);
  });

  it("contains NO specs the variant does not have (never fabricates)", () => {
    const v = allModels[0].variants[0];
    const text = formatComputer(v);
    const s = v.specs;
    if (!s.batteryLife) expect(text).not.toContain("Battery:");
    if (!s.weight) expect(text).not.toMatch(/\dkg\b/);
    if (!s.displaySize) expect(text).not.toContain("Display:");
    if (!s.resolution) expect(text).not.toContain("Resolution:");
    if (!s.panelType) expect(text).not.toContain("Panel:");
  });

  it("never merges specs across configurations of the same model", () => {
    // Find two variants of ONE model that genuinely differ in RAM.
    const withDifferingRam = allModels.find(
      (m) => m.variants.length >= 2 && new Set(m.variants.map((v) => v.specs.ram)).size >= 2
    );
    if (!withDifferingRam) return; // catalog has no such model — nothing to assert

    const [a, b] = withDifferingRam.variants;
    const blockA = formatComputer(a);
    const blockB = formatComputer(b);

    // Each block must describe ONLY its own configuration.
    expect(blockA).toContain(`RAM: ${a.specs.ram}GB`);
    expect(blockA).not.toContain(`RAM: ${b.specs.ram}GB`);
    expect(blockB).toContain(`RAM: ${b.specs.ram}GB`);
    expect(blockB).not.toContain(`RAM: ${a.specs.ram}GB`);
  });

  it("ratingsLine uses the six decision-critical rating ids", () => {
    const v = allModels[0].variants[0];
    const line = ratingsLine(v);
    expect(line.split(" · ").length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Prompt boundary
// ---------------------------------------------------------------------------

describe("chat prompt boundary", () => {
  it("system prompt forbids inventing numbers and requires UNKNOWN", () => {
    const lower = CHAT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("never invent");
    expect(lower).toContain("not available");
    expect(lower).toContain("غير متوفر");
  });

  it("system prompt forbids merging configurations", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never merge/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/one configuration/i);
  });

  it("system prompt confines analysis to the provided computers (grounding)", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/only the computers listed/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/absent from the context/i);
  });

  it("buildUserPrompt includes the verified context verbatim", () => {
    const v = allModels[0].variants[0];
    const computers = formatComputer(v);
    const prompt = buildUserPrompt({ computers, question: "compare?", missingIds: [] });
    expect(prompt).toContain("## Computers");
    expect(prompt).toContain(computers);
    expect(prompt).toContain("## Question");
    expect(prompt).toContain("compare?");
    expect(prompt).not.toContain("Not available in catalog"); // no missing block
  });

  it("buildUserPrompt flags missing computers as NOT available (never invented)", () => {
    const computers = "CPU: Intel";
    const prompt = buildUserPrompt({
      computers,
      question: "what about the X1?",
      missingIds: ["x1-999"],
    });
    expect(prompt).toContain("## Not available in catalog");
    expect(prompt).toContain("x1-999");
    expect(prompt).toMatch(/never invent/i);
  });

  it("empty missing list produces no not-available section", () => {
    const prompt = buildUserPrompt({ computers: "x", question: "q", missingIds: [] });
    expect(prompt).not.toContain("Not available in catalog");
  });
});