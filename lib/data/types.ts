export type ComputerCategory =
  | "gaming-laptop"
  | "business-laptop"
  | "ultrabook"
  | "macbook"
  | "workstation"
  | "desktop"
  | "mini-pc";

export type UseCase =
  | "gaming"
  | "programming"
  | "university"
  | "editing"
  | "design"
  | "battery"
  | "portability"
  | "work";

export interface ComputerSpecs {
  // Processor
  cpu: string;
  cpuCores?: string;
  cpuScore: number;
  gpu: string;
  gpuScore: number;
  // Memory
  ram: number;
  ramType?: string;
  ramSpeed?: string;
  ramUpgradeable?: string;
  // Storage
  storage: number;
  storageType: "SSD" | "HDD" | "NVMe";
  storageSlots?: string;
  // Display
  display: string;
  displaySize: number;
  resolution?: string;
  displayRefreshRate: number;
  panelType?: string;
  brightness?: string;
  colorCoverage?: string;
  touchscreen?: boolean;
  hdr?: string;
  aspectRatio?: string;
  // Battery & Physical
  batteryLife: number;
  batteryCapacity?: string;
  weight: number;
  dimensions?: string;
  charger?: string;
  // Connectivity
  wifi?: string;
  bluetooth?: string;
  ethernet?: boolean;
  usbA?: string;
  usbC?: string;
  thunderbolt?: string;
  hdmi?: string;
  displayPort?: string;
  sdCard?: boolean;
  audioJack?: boolean;
  // Security & Biometrics
  fingerprint?: boolean;
  faceRecognition?: boolean;
  irCamera?: boolean;
  tpm?: string;
  privacyShutter?: boolean;
  smartCardReader?: boolean;
  // Camera & Audio
  webcam?: string;
  microphones?: string;
  speakers?: string;
  audioFeatures?: string;
  // Keyboard & Input
  backlitKeyboard?: boolean;
  rgbKeyboard?: boolean;
  keyboardLayout?: string;
  numpad?: boolean;
  stylusSupport?: boolean;
  // Build & Features
  buildMaterial?: string;
  militaryCertification?: string;
  coolingSystem?: string;
  fans?: string;
  upgradeability?: string;
  warranty?: string;
  // Legacy aggregate ports
  ports: string[];
  os: string;
}

export interface ComputerVariant {
  id: string;
  sku?: string;
  name: string;
  brand: string;
  category: ComputerCategory;
  price: number;
  imageUrl: string;
  specs: ComputerSpecs;
  rating: number;
  reviewCount: number;
  year: number;
  description: string;
}

export type Computer = ComputerVariant;

export interface ComputerModel {
  id: string;
  name: string;
  brand: string;
  family?: string;
  generation?: string;
  category: ComputerCategory;
  year: number;
  description: string;
  imageUrl: string;
  variants: ComputerVariant[];
}

export interface UseCaseWeights {
  cpu: number;
  gpu: number;
  ram: number;
  storage: number;
  display: number;
  batteryLife: number;
  weight: number;
  price: number;
}

export interface ComparisonResult {
  computerA: ComputerVariant;
  computerB: ComputerVariant;
  scoreA: number;
  scoreB: number;
  winners: Partial<Record<keyof ComputerSpecs, "A" | "B" | "tie">>;
  overallWinner: "A" | "B" | "tie";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type RatingCategory =
  | "gaming"
  | "programming"
  | "university"
  | "editing"
  | "design"
  | "ai"
  | "battery"
  | "performance"
  | "portability"
  | "upgradeability"
  | "thermal"
  | "productivity"
  | "display"
  | "multimedia"
  | "value"
  | "longevity";

export interface RatingDefinition {
  id: RatingCategory;
  label: string;
  icon: string;
  description: string;
}

export interface CategoryRating {
  score: number;
  factors: string[];
  estimated?: boolean;
}

export type ComputerRatings = Record<RatingCategory, CategoryRating>;

export interface Game {
  id: string;
  name: string;
  genre: string;
  tier: "esports" | "mainstream" | "demanding" | "very-demanding";
  minCpu: number;
  minGpu: number;
  minRam: number;
  recCpu: number;
  recGpu: number;
  recRam: number;
  storage: number;
}

export type CompatibilityVerdict = "Excellent" | "Good" | "Playable" | "Not Recommended";

export interface GameCompatibility {
  verdict: CompatibilityVerdict;
  estimatedFps: string;
  reasoning: string[];
  meetsRecommended: boolean;
  meetsMinimum: boolean;
}

export interface SearchFilters {
  brand?: string;
  family?: string;
  category?: ComputerCategory;
  minRam?: number;
  maxRam?: number;
  minStorage?: number;
  maxStorage?: number;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  screenSize?: number;
  touchscreen?: boolean;
  dedicatedGpu?: boolean;
}

export interface FilterFacets {
  brands: { value: string; count: number }[];
  families: { value: string; brand: string; count: number }[];
  categories: { value: string; count: number }[];
  cpus: { value: string; count: number }[];
  gpus: { value: string; count: number }[];
  ramRange: { min: number; max: number };
  storageRange: { min: number; max: number };
  priceRange: { min: number; max: number };
  yearRange: { min: number; max: number };
  screenSizes: { value: number; count: number }[];
  osOptions: { value: string; count: number }[];
}

/**
 * Phase 3.2.6 — Typed failure classification for the search pipeline.
 *
 * Every degraded path the public search API can take is enumerated here so
 * callers can reason about reliability declaratively instead of poking at
 * nested error strings. A failure KINDS union is a discriminated union by
 * string literal — guaranteed distinct from any catalog data.
 *
 * Semantic sources:
 *   SEMANTIC_TIMEOUT       — the whole semantic call exceeded its pipeline budget
 *   SEMANTIC_API_ERROR     — embedding provider / vector DB returned an error
 *   SEMANTIC_UNAVAILABLE   — provider not configured/not usable (not a fault)
 *   SEMANTIC_EMPTY         — provider worked but returned no matches (valid outcome)
 *   SEMANTIC_INVALID_RESPONSE — provider answered but the shape was malformed
 *   SEMANTIC_INVALID_EMBEDDING — embedding had an unexpected dimension/shape
 */
export type SemanticFailureKind =
  | "SEMANTIC_TIMEOUT"
  | "SEMANTIC_API_ERROR"
  | "SEMANTIC_UNAVAILABLE"
  | "SEMANTIC_EMPTY"
  | "SEMANTIC_INVALID_RESPONSE"
  | "SEMANTIC_INVALID_EMBEDDING";

/** Non-semantic failures + the semantic failure kinds form the full union. */
export type SearchFailureKind =
  | SemanticFailureKind
  | "STRUCTURED_EMPTY"
  | "STRUCTURED_ERROR"
  | "QUERY_UNDERSTANDING_FAILURE"
  | "INVALID_CANDIDATE"
  | "INTERNAL_SEARCH_ERROR";

/**
 * Phase 3.2.6 — Search reliability observability (optional on SearchResult).
 *
 * Added optionally so the public search contract stays backward compatible;
 * consumers that don't care about reliability can ignore it. No full user
 * queries, no provider secrets, and no raw error payloads ever appear here.
 */
export interface SearchReliability {
  /** True when semantic retrieval is configured AND not circuit-open. */
  semanticAvailable: boolean;
  /** True when the semantic attempt produced verified matches. */
  semanticSuccess: boolean;
  /** True when semantic worked but correctly returned zero matches. */
  semanticEmpty: boolean;
  /** True when the semantic call was cut off by the pipeline deadline. */
  semanticTimeout: boolean;
  /** Classified semantic failure, when the semantic attempt failed. */
  semanticFailureReason?: SemanticFailureKind;
  /** Circuit-breaker state at the time the search ran. */
  breakerState: "CLOSED" | "OPEN" | "HALF_OPEN" | "DISABLED";
  /** Structured retrieval always succeeds in-process; reflects candidate count. */
  structuredSuccess: boolean;
  /** True when structured retrieval produced no candidates. */
  structuredEmpty: boolean;
  /** True when the result was served from a degraded (non-fused) path. */
  fallbackUsed: boolean;
  /** Human-level reason for the fallback, when one was used. */
  fallbackReason?: SearchFailureKind | "CIRCUIT_OPEN" | "TIMEOUT";
  /** True when the semantic response came from the bounded result cache. */
  cacheHit: boolean;
  /** True when the semantic response was NOT (fully) cache-served. */
  cacheMiss: boolean;
  /** Candidate funnel: entries fed in vs fused vs gated vs returned. */
  candidateCounts: {
    structured: number;
    semantic: number;
    fused: number;
    final: number;
    gateExcluded: number;
  };
  /** Number of model results actually returned by this search. */
  resultCount: number;
  /** End-to-end search latency in ms. */
  latencyMs: number;
  /** Embedding space identity — prevents cross-version mixing. */
  embedding: {
    model: string;
    version: string;
    dimension: number;
  };
}

export interface SearchResult {
  models: ComputerModel[];
  total: number;
  offset: number;
  limit: number;
  query: string;
  facets: FilterFacets;
  /**
   * Non-empty when the query explicitly asked for a generation (e.g. "G11")
   * that NO catalog model carries — the caller should trigger AI discovery
   * instead of showing older generations of the same family.
   */
  generationMissing?: string[];
  /**
    * Hardware criteria detected in the query ("rtx 4060", "16gb", "i7-13500h")
    * plus every token with a direct catalog hit. The client highlights these
    * substrings on result cards so users see WHY each computer appeared.
    */
  matchedTerms?: string[];
  /**
   * Phase 3.2.6 — reliability observability. Present on AI/mixed search
   * paths only; structured-only responses do not carry it (optional → fully
   * backward compatible).
   */
  reliability?: SearchReliability;
}

export interface AutocompleteResult {
  brands: { text: string; count: number }[];
  families: { text: string; brand: string; count: number }[];
  models: { text: string; id: string; brand: string; family?: string }[];
}

export interface AiSearchResult {
  source: "database" | "ai";
  models: ComputerModel[];
  saved: boolean;
}
