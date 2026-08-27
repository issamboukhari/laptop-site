"use client";

import { useEffect, useState } from "react";
import { ComputerModel, ComputerVariant } from "@/lib/data/types";
import { findModelByVariantId, findVariantById } from "@/lib/data/computers";

/**
 * Client-side hydration for computers that are NOT part of the bundled
 * catalog (e.g. AI-discovered models stored only in Supabase Cloud).
 *
 * Bundled lookups stay synchronous and instant; anything unknown is fetched
 * once through our backend (/api/computers/[id] — never Supabase directly)
 * and cached module-level so CompareBar, compare slots and detail links all
 * share one copy.
 */

export interface RemoteEntry {
  variant?: ComputerVariant;
  model?: ComputerModel;
  failed?: boolean;
}

const cache = new Map<string, RemoteEntry>();
const pending = new Set<string>();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) fn();
}

function requestOne(id: string): void {
  if (pending.has(id)) return;
  pending.add(id);

  fetch(`/api/computers/${encodeURIComponent(id)}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const entry: RemoteEntry = {};
      if (data?.variant) entry.variant = data.variant;
      else if (data?.model) entry.variant = data.model.variants?.[0];
      if (data?.model) entry.model = data.model;
      cache.set(id, entry);
    })
    .catch(() => {
      cache.set(id, { failed: true });
    })
    .finally(() => {
      pending.delete(id);
      notify();
    });
}

/** Resolve bundled-first, then remotely hydrated entries for the given ids. */
export function useRemoteComputers(ids: (string | undefined)[]): Map<string, RemoteEntry> {
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((x) => x + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const key = ids.filter(Boolean).join("|");

  useEffect(() => {
    for (const id of key.split("|")) {
      if (!id) continue;
      if (findVariantById(id)) continue;
      if (cache.has(id)) continue;
      requestOne(id);
    }
  }, [key]);

  return cache;
}

/** Synchronous resolver safe to call during render (after hydration ran). */
export function resolveVariantSync(id: string | undefined): ComputerVariant | undefined {
  if (!id) return undefined;
  return findVariantById(id) ?? cache.get(id)?.variant;
}

export function resolveParentModelSync(
  variantId: string | undefined,
  cached?: RemoteEntry
): ComputerModel | undefined {
  if (!variantId) return undefined;
  return findModelByVariantId(variantId) ?? cached?.model;
}
