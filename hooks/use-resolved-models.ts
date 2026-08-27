"use client";

import { useEffect, useState } from "react";
import { ComputerModel } from "@/lib/data/types";
import { findModelById } from "@/lib/data/computers";

/**
 * Resolve an array of model IDs to ComputerModel objects.
 * Bundled lookups are instant; anything unknown is fetched through the API
 * and cached module-level so repeated renders are free.
 */

const cache = new Map<string, ComputerModel | null>();
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
      const model: ComputerModel | null = data?.model ?? null;
      cache.set(id, model);
    })
    .catch(() => {
      cache.set(id, null);
    })
    .finally(() => {
      pending.delete(id);
      notify();
    });
}

export function useResolvedModels(ids: string[]): ComputerModel[] {
  const [, bump] = useState(0);

  useEffect(() => {
    const fn = () => bump((x) => x + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const key = ids.join("|");

  useEffect(() => {
    for (const id of ids) {
      if (!id) continue;
      if (findModelById(id)) continue;
      if (cache.has(id)) continue;
      requestOne(id);
    }
  }, [key]);

  const seen = new Set<string>();
  return ids
    .map((id) => findModelById(id) ?? cache.get(id) ?? undefined)
    .filter((m): m is ComputerModel => {
      if (!m || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
}
