import { logError } from "./api-utils";

/**
 * Minimal server-side Supabase REST (PostgREST) client.
 *
 * Security: this module must ONLY be imported from server code
 * (lib/server/*, app/api/*). The publishable key never reaches the browser —
 * the frontend talks to Supabase exclusively through our backend routes.
 */

const SUPABASE_TIMEOUT_MS = 8000;

function getUrl(): string | undefined {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) return undefined;
  return url.replace(/\/+$/, "");
}

function getKey(): string | undefined {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim()
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getUrl() && getKey());
}

export class SupabaseUnavailableError extends Error {
  constructor(public reason: string) {
    super(`Supabase unavailable: ${reason}`);
    this.name = "SupabaseUnavailableError";
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = getKey();
  if (!key) throw new SupabaseUnavailableError("missing key");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(
  method: string,
  path: string,
  options?: {
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const base = getUrl();
  if (!base) throw new SupabaseUnavailableError("SUPABASE_URL not configured");

  const qs = options?.query
    ? "?" +
      Object.entries(options.query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";

  let res: Response;
  try {
    res = await fetch(`${base}/rest/v1/${path}${qs}`, {
      method,
      headers: authHeaders(options?.headers),
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as NodeJS.ErrnoException).code) : "";
    const reason =
      code === "ENOTFOUND"
        ? "project host does not resolve (DNS)"
        : error instanceof Error && error.name === "TimeoutError"
        ? `timeout after ${SUPABASE_TIMEOUT_MS}ms`
        : error instanceof Error
        ? error.message
        : "network error";
    throw new SupabaseUnavailableError(reason);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logError("supabase:request", null, {
      method,
      path,
      status: res.status,
      body: text.slice(0, 300),
    });
    throw new Error(`Supabase request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res;
}

/** GET rows from a table. */
export async function sbSelect<T>(
  table: string,
  params: { columns?: string; filters?: Record<string, string>; limit?: number; order?: string }
): Promise<T[]> {
  const query: Record<string, string> = {};
  query["select"] = params.columns ?? "*";
  if (params.filters) Object.assign(query, params.filters);
  if (params.limit) query["limit"] = String(params.limit);
  if (params.order) query["order"] = params.order;

  const res = await request("GET", table, { query });
  return (await res.json()) as T[];
}

/**
 * Upsert rows. `onConflict` must be a unique column (or comma-separated list).
 * Uses PostgREST Prefer: resolution=merge-duplicates.
 */
export async function sbUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  if (rows.length === 0) return;
  await request("POST", table, {
    query: { on_conflict: onConflict },
    body: rows,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  });
}
