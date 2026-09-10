import { describe, it, expect } from "vitest";
import {
  CircuitBreaker,
  semanticCircuitBreaker,
  SEMANTIC_BREAKER_CONFIG,
  resetSemanticCircuitBreaker,
} from "@/lib/server/circuit-breaker";

/**
 * Phase 3.2.6 — Circuit breaker tests
 *
 * Verifies the CLOSED → OPEN → HALF_OPEN → CLOSED state machine, the
 * skip-while-OPEN critical behavior (no provider call is even attempted), the
 * cooldown expiry, and the probe semantics of HALF_OPEN. Uses an injectable
 * clock so cooldowns don't require real sleeps.
 */

function breaker(overrides: Partial<typeof SEMANTIC_BREAKER_CONFIG> = {}) {
  let t = 0;
  const b = new CircuitBreaker({ ...SEMANTIC_BREAKER_CONFIG, ...overrides }, () => t);
  return { b, advance: (ms: number) => (t += ms) };
}

describe("Circuit Breaker — CLOSED", () => {
  it("starts CLOSED and allows calls", () => {
    const { b } = breaker();
    expect(b.currentState().state).toBe("CLOSED");
    expect(b.allow().allowed).toBe(true);
  });

  it("stays CLOSED below the failure threshold", () => {
    const { b } = breaker({ failureThreshold: 5 });
    for (let i = 0; i < 4; i++) b.recordFailure();
    expect(b.currentState().state).toBe("CLOSED");
    expect(b.allow().allowed).toBe(true);
  });

  it("successes clear consecutive failures", () => {
    const { b } = breaker({ failureThreshold: 5 });
    for (let i = 0; i < 4; i++) b.recordFailure();
    b.recordSuccess();
    expect(b.currentState().consecutiveFailures).toBe(0);
  });

  it("trips to OPEN at the failure threshold", () => {
    const { b } = breaker({ failureThreshold: 3 });
    b.recordFailure();
    b.recordFailure();
    expect(b.currentState().state).toBe("CLOSED");
    b.recordFailure();
    expect(b.currentState().state).toBe("OPEN");
  });

  it("consecutive-failure requirement: a success resets the streak", () => {
    const { b } = breaker({ failureThreshold: 2 });
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    expect(b.currentState().state).toBe("CLOSED");
  });
});

describe("Circuit Breaker — OPEN", () => {
  it("refuses calls while OPEN (semantic call is skipped entirely)", () => {
    const { b } = breaker({ failureThreshold: 1, cooldownMs: 1000 });
    b.recordFailure();
    expect(b.currentState().state).toBe("OPEN");
    const d = b.allow();
    expect(d.allowed).toBe(false);
    expect(d.state).toBe("OPEN");
  });

  it("skipped calls do NOT count as successes or failures", () => {
    const { b, advance } = breaker({ failureThreshold: 1, cooldownMs: 1000 });
    b.recordFailure();
    b.allow(); // refused
    b.allow(); // refused
    const snap = b.snapshot();
    expect(snap.totalCalls).toBe(2); // two allow() consultations
    expect(snap.totalSuccesses).toBe(0);
    expect(snap.totalFailures).toBe(1);
    expect(snap.consecutiveFailures).toBe(1);
    advance(1001);
  });

  it("transitions to HALF_OPEN after the cooldown elapses", () => {
    const { b, advance } = breaker({ failureThreshold: 1, cooldownMs: 1000 });
    b.recordFailure();
    expect(b.allow().allowed).toBe(false);
    advance(1000);
    const d = b.allow();
    expect(d.allowed).toBe(true);
    expect(d.state).toBe("HALF_OPEN");
  });
});

describe("Circuit Breaker — HALF_OPEN", () => {
  it("allows probes up to halfOpenMaxProbes, then refuses again", () => {
    const { b, advance } = breaker({ failureThreshold: 1, cooldownMs: 100, halfOpenMaxProbes: 1 });
    b.recordFailure();
    advance(101);
    expect(b.allow().allowed).toBe(true); // probe 1 (only probe allowed)
    expect(b.allow().state).toBe("HALF_OPEN");
    expect(b.allow().allowed).toBe(false); // extra probe refused
  });

  it("probe success closes the breaker", () => {
    const { b, advance } = breaker({ failureThreshold: 1, cooldownMs: 100, halfOpenMaxProbes: 1 });
    b.recordFailure();
    advance(101);
    expect(b.allow().state).toBe("HALF_OPEN");
    b.recordSuccess();
    expect(b.currentState().state).toBe("CLOSED");
    expect(b.allow().allowed).toBe(true);
  });

  it("probe failure re-opens the breaker", () => {
    const { b, advance } = breaker({ failureThreshold: 5, cooldownMs: 100, halfOpenMaxProbes: 1 });
    // Trip via threshold first.
    for (let i = 0; i < 5; i++) b.recordFailure();
    expect(b.currentState().state).toBe("OPEN");
    advance(101);
    expect(b.allow().state).toBe("HALF_OPEN");
    b.recordFailure();
    expect(b.currentState().state).toBe("OPEN");
    expect(b.allow().allowed).toBe(false); // immediately refused again
  });
});

describe("Circuit Breaker — config/disable", () => {
  it("disable:true always allows and never trips", () => {
    const { b } = breaker({ disable: true, failureThreshold: 1 });
    for (let i = 0; i < 10; i++) b.recordFailure();
    expect(b.allow().allowed).toBe(true);
    expect(b.currentState().state).toBe("CLOSED");
  });
});

describe("Circuit Breaker — production instance", () => {
  it("defaults to CLOSED and allows calls", () => {
    resetSemanticCircuitBreaker();
    expect(semanticCircuitBreaker.currentState().state).toBe("CLOSED");
    expect(semanticCircuitBreaker.allow().allowed).toBe(true);
  });
});