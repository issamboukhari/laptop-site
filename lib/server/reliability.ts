/**
 * Phase 3.2.6 — Search reliability helpers
 *
 * Deadline-bound concurrency and typed failure factories for the search
 * pipeline. Type-level contract (SearchReliability, failure kinds) lives in
 * lib/data/types.ts and is re-exported here so server code imports from one
 * place.
 *
 * `withDeadline` implements the "no unbounded waiting" rule: a bounded window
 * around an async attempt. When the window expires the caller immediately
 * obtains a typed TIMEOUT failure and degrades (structured-only, or safe
 * empty) — the underlying promise keeps running harmlessly out-of-band and is
 * still reported through the circuit breaker when it settles.
 */

import type {
  SemanticResult,
} from "./semantic-retrieval";
import type { SemanticFailureKind } from "../data/types";

export type { SemanticFailureKind, SearchFailureKind, SearchReliability } from "../data/types";

export interface DeadlineOutcome<T> {
  /** Present when the attempt finished inside the deadline. */
  value?: T;
  /** True when the deadline expired before the promise settled. */
  timedOut: boolean;
}

/**
 * Race a promise against a deadline without throwing. A TIMEOUT is signalled
 * via the `timedOut` flag so the caller can construct the appropriate typed
 * failure instead of catching an exception.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation"
): Promise<DeadlineOutcome<T>> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return { value: await promise, timedOut: false };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutSignal = `[reliability] ${label} exceeded deadline of ${ms}ms`;
  try {
    const value = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutSignal)), ms);
      }),
    ]);
    return { value, timedOut: false };
  } catch (error) {
    if (timer !== undefined && error instanceof Error && error.message === timeoutSignal) {
      return { timedOut: true };
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Typed failure factory. Because every failure carries a machine-readable
 * `failureKind`, callers never parse error strings to decide how to degrade.
 */
export function failureSemanticResult(
  failureKind: SemanticFailureKind,
  error: string,
  extra?: Partial<SemanticResult>
): SemanticResult {
  return {
    matches: [],
    success: false,
    fallback: true,
    embeddedCount: 0,
    latencyMs: extra?.latencyMs ?? 0,
    error,
    failureKind,
    ...extra,
  };
}

/** Valid successful empty semantic result (no failure — just nothing found). */
export function emptySemanticResult(
  extra?: Partial<SemanticResult>
): SemanticResult {
  return {
    matches: [],
    success: true,
    fallback: false,
    embeddedCount: extra?.embeddedCount ?? 0,
    latencyMs: extra?.latencyMs ?? 0,
    semanticEmpty: true,
    ...extra,
  };
}