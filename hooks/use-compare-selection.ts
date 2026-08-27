"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const COMPARE_STORAGE_KEY = "gen-compare-selected";
export const MAX_COMPARE = 2;

// ---------------------------------------------------------------------------
// Module-level shared store — ONE source of truth for the whole app.
// Every component using useCompareSelection() subscribes to it, so any add /
// remove anywhere (homepage card, detail page, compare picker) instantly
// re-renders the floating bar, counters and the compare page together.
// Persisted to localStorage; kept in sync across browser tabs.
// ---------------------------------------------------------------------------

const EMPTY: string[] = [];

let ids: string[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  if (ids === null) ids = readStorage();
  return ids;
}

/** Stable reference for SSR / hydration — must never change identity. */
function getServerSnapshot(): string[] {
  return EMPTY;
}

function commit(next: string[]): void {
  ids = next;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full / unavailable — in-memory state still works.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Cross-tab sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === COMPARE_STORAGE_KEY) {
      ids = readStorage();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------------------
// Hook — same public API as before, now globally reactive.
// ---------------------------------------------------------------------------

export function useCompareSelection() {
  const selectedIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id: string) => {
    const prev = getSnapshot();
    if (prev.includes(id)) return;
    if (prev.length >= MAX_COMPARE) return;
    commit([...prev, id]);
  }, []);

  const remove = useCallback((id: string) => {
    const prev = getSnapshot();
    if (!prev.includes(id)) return;
    commit(prev.filter((x) => x !== id));
  }, []);

  const toggle = useCallback((id: string) => {
    const prev = getSnapshot();
    if (prev.includes(id)) {
      commit(prev.filter((x) => x !== id));
      return;
    }
    if (prev.length >= MAX_COMPARE) return;
    commit([...prev, id]);
  }, []);

  const clear = useCallback(() => {
    if (getSnapshot().length === 0) return;
    commit(EMPTY);
  }, []);

  /** Replace the id at a given slot index (no-op when out of bounds or already present elsewhere). */
  const replaceAt = useCallback((index: number, id: string) => {
    const prev = getSnapshot();
    if (index < 0 || index >= prev.length) return;
    if (prev[index] === id) return;
    if (prev.includes(id)) return;
    const next = [...prev];
    next[index] = id;
    commit(next);
  }, []);

  /** Overwrite the whole selection (used to seed from share links). */
  const setAll = useCallback((next: string[]) => {
    const deduped = Array.from(new Set(next.filter((x) => typeof x === "string" && x)));
    commit(deduped.slice(0, MAX_COMPARE));
  }, []);

  const isFull = selectedIds.length >= MAX_COMPARE;

  return useMemo(
    () => ({
      selectedIds,
      add,
      remove,
      toggle,
      clear,
      replaceAt,
      setAll,
      isSelected: (id: string) => selectedIds.includes(id),
      isFull,
    }),
    [selectedIds, add, remove, toggle, clear, replaceAt, setAll, isFull]
  );
}
