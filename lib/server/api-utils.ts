import { NextResponse } from "next/server";

/**
 * Shared API infrastructure: typed errors, server-side technical logging,
 * request validation, and timeout handling.
 *
 * Contract: every error response uses the structured shape
 *   { error: { code: string, message: string } }
 * where `message` is always safe/user-facing. Technical details (stacks,
 * raw errors, params) are logged server-side only via `logError`.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "INVALID_PARAM"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NO_COMPUTERS_SELECTED"
  | "TIMEOUT"
  | "NO_API_KEY"
  | "GEMINI_ERROR"
  | "INTERNAL_ERROR";

const CODE_HTTP_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  INVALID_PARAM: 400,
  VALIDATION_ERROR: 400,
  NO_COMPUTERS_SELECTED: 400,
  NOT_FOUND: 404,
  TIMEOUT: 504,
  NO_API_KEY: 503,
  GEMINI_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Safe, user-facing message (this is what the client receives). */
  readonly userMessage: string;
  readonly httpStatus: number;
  /** Optional structured details for server logs only. */
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    userMessage: string,
    options?: { status?: number; technical?: string; details?: Record<string, unknown> }
  ) {
    super(options?.technical ?? userMessage);
    this.name = "ApiError";
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = options?.status ?? CODE_HTTP_STATUS[code];
    this.details = options?.details;
  }
}

/** Log full technical detail on the server for debugging. Never sent to clients. */
export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  const isApiError = error instanceof ApiError;
  const parts = [
    `[api:${context}]`,
    isApiError ? `${error.code} (${error.httpStatus})` : "",
    error instanceof Error ? error.message : String(error),
    extra ? JSON.stringify(extra) : "",
  ].filter(Boolean);
  const stack = error instanceof Error ? error.stack : undefined;

  if (isApiError && error.httpStatus < 500) {
    // Client errors: expected, log compactly.
    console.warn(parts.join(" "));
  } else {
    console.error(parts.join(" "));
    if (stack) console.error(stack);
  }
}

/** Convert any thrown value into a safe structured HTTP error response. */
export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ApiError) {
    logError(context, error, error.details);
    return NextResponse.json(
      { error: { code: error.code, message: error.userMessage } },
      { status: error.httpStatus }
    );
  }

  logError(context, error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong on our side. Please try again.",
      },
    },
    { status: 500 }
  );
}

// ---------------------------------------------------------------------------
// Request parsing / validation
// ---------------------------------------------------------------------------

/** Parse a JSON body; throws ApiError(400) on malformed or non-object JSON. */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "The request body must be valid JSON.", {
      technical: "request.json() threw",
    });
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError("BAD_REQUEST", "The request body must be a JSON object.");
  }
  return raw as T;
}

/** Read a numeric query param. Throws ApiError(400) when present but invalid. */
export function parseNumberParam(
  sp: URLSearchParams,
  key: string,
  opts?: { min?: number; max?: number; integer?: boolean }
): number | undefined {
  const raw = sp.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new ApiError("INVALID_PARAM", `"${key}" must be a number.`, {
      details: { param: key, value: raw },
    });
  }
  if (opts?.integer && !Number.isInteger(n)) {
    throw new ApiError("INVALID_PARAM", `"${key}" must be an integer.`, {
      details: { param: key, value: raw },
    });
  }
  if (opts?.min !== undefined && n < opts.min) {
    throw new ApiError("INVALID_PARAM", `"${key}" must be at least ${opts.min}.`, {
      details: { param: key, value: raw },
    });
  }
  if (opts?.max !== undefined && n > opts.max) {
    throw new ApiError("INVALID_PARAM", `"${key}" must be at most ${opts.max}.`, {
      details: { param: key, value: raw },
    });
  }
  return n;
}

/** Validate a required, non-empty string field with a sane length cap. */
export function requireString(
  value: unknown,
  name: string,
  maxLength = 2000
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", `"${name}" is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `"${name}" is too long (max ${maxLength} characters).`,
      { details: { length: trimmed.length } }
    );
  }
  return trimmed;
}

/** Validate an optional array of strings (e.g. computer ids, chat history ids). */
export function asStringArray(
  value: unknown,
  name: string,
  opts?: { maxItems?: number; itemMaxLength?: number }
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError("VALIDATION_ERROR", `"${name}" must be an array.`);
  }
  const maxItems = opts?.maxItems ?? 10;
  if (value.length > maxItems) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `"${name}" accepts at most ${maxItems} items.`,
      { details: { received: value.length } }
    );
  }
  return value.map((item, i) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `"${name}[${i}]" must be a non-empty string.`
      );
    }
    const t = item.trim();
    if (opts?.itemMaxLength && t.length > opts.itemMaxLength) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `"${name}[${i}]" is too long.`,
        { details: { index: i, length: t.length } }
      );
    }
    return t;
  });
}

/** Reject request bodies larger than `maxBytes`. Call before reading the body. */
export function assertContentLength(request: Request, maxBytes: number): void {
  const header = request.headers.get("content-length");
  const size = header ? Number(header) : NaN;
  if (Number.isFinite(size) && size > maxBytes) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Request payload is too large.",
      { details: { contentLength: size, maxBytes } }
    );
  }
}

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/**
 * Race a promise against a deadline. On expiry throws ApiError(504, TIMEOUT).
 * The underlying promise stays pending (its eventual result/error is ignored).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiError("TIMEOUT", `"${label}" took too long. Please try again.`, {
          technical: `timeout after ${ms}ms`,
          details: { label },
        })
      );
    }, ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeout,
  ]);
}
