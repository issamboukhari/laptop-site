/**
 * Phase 3.2.6 — Server-side circuit breaker
 *
 * Guards the external semantic-embedding pipeline so a flaky provider can
 * never stall or poison search. Faults trip a window (OPEN) during which
 * semantic calls are SKIPPED entirely — the search pipeline falls back to
 * verified structured retrieval instead. After a cooldown the breaker lets a
 * limited number of probe calls through (HALF_OPEN): one success closes it,
 * one failure reopens it.
 *
 * Ownership: ONE breaker instance per embedding pipeline, scoped by embedding
 * model+version. This is deliberate in-process shared state — it protects the
 * provider from thundering retries — and is always overridable with
 * `disable: true` for tests or maintenance windows.
 *
 * Safety invariant: the breaker only ever decides whether the SEMANTIC *call*
 * is attempted. It never bypasses the hard-constraint gate or changes which
 * results are admissible. Turning it off can only degrade recall, never
 * correctness.
 */

export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Consecutive failures that trip the breaker to OPEN. */
  failureThreshold: number;
  /** Time spent in OPEN before the first HALF_OPEN probe is allowed (ms). */
  cooldownMs: number;
  /** Number of probes allowed while HALF_OPEN before refusing again. */
  halfOpenMaxProbes: number;
  /** When true the breaker always allows calls (tests / maintenance). */
  disable?: boolean;
}

export interface BreakerDecision {
  allowed: boolean;
  state: BreakerState;
}

export interface BreakerSnapshot {
  state: BreakerState;
  consecutiveFailures: number;
  totalCalls: number;
  totalSuccesses: number;
  totalFailures: number;
}

/**
 * Deterministic, testable circuit breaker. Clock is injectable so state
 * transitions (cooldown expiry, OPEN windows) can be tested without sleeping.
 */
export class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbes = 0;
  private totalCalls = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly now: () => number = Date.now
  ) {}

  /**
   * Decide whether a call may be attempted. Does NOT record outcomes — the
   * caller must call recordSuccess/recordFailure for the observed result.
   */
  allow(): BreakerDecision {
    this.totalCalls++;

    if (this.config.disable) {
      return { allowed: true, state: "CLOSED" };
    }

    if (this.state === "OPEN") {
      if (this.now() - this.openedAt >= this.config.cooldownMs) {
        this.state = "HALF_OPEN";
        this.halfOpenProbes = 0;
      } else {
        return { allowed: false, state: "OPEN" };
      }
    }

    if (this.state === "HALF_OPEN" && this.halfOpenProbes >= this.config.halfOpenMaxProbes) {
      return { allowed: false, state: "HALF_OPEN" };
    }
    if (this.state === "HALF_OPEN") {
      this.halfOpenProbes++;
    }

    return { allowed: true, state: this.state };
  }

  /** Record a successful call. In HALF_OPEN a probe success returns to CLOSED. */
  recordSuccess(): void {
    if (this.config.disable) return;
    this.totalSuccesses++;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
    }
    this.consecutiveFailures = 0;
  }

  /** Record a failed call. Trips to OPEN at the threshold or from a probe. */
  recordFailure(): void {
    if (this.config.disable) return;
    this.totalFailures++;
    this.consecutiveFailures++;

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAt = this.now();
      return;
    }

    if (this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = this.now();
    }
  }

  currentState(): { state: BreakerState; consecutiveFailures: number } {
    return { state: this.state, consecutiveFailures: this.consecutiveFailures };
  }

  snapshot(): BreakerSnapshot {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalCalls: this.totalCalls,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Reset to a pristine CLOSED state, zeroing all counters. Tests and
   * maintenance tooling call this to start a clean epoch.
   */
  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.halfOpenProbes = 0;
    this.totalCalls = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
  }
}

// ---------------------------------------------------------------------------
// Production instance — scoped to the semantic embedding pipeline
// ---------------------------------------------------------------------------

/** Embedded-reference config for the semantic pipeline. */
export const SEMANTIC_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxProbes: 1,
} as const;

/** The single production breaker guarding semantic retrieval. */
export const semanticCircuitBreaker = new CircuitBreaker(SEMANTIC_BREAKER_CONFIG);

/** Read-only view for observability (never exposes raw provider errors). */
export function getSemanticBreakerState(): { state: BreakerState; consecutiveFailures: number } {
  return semanticCircuitBreaker.currentState();
}

/**
 * Reset the production breaker — used by tests and by maintenance tooling
 * (e.g. after a confirmed provider recovery). Starts a fresh CLOSED epoch.
 */
export function resetSemanticCircuitBreaker(): void {
  semanticCircuitBreaker.reset();
}