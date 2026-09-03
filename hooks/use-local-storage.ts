"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

/**
 * localStorage-backed state that is hydration-safe.
 *
 * The stored value is NEVER read during the SSR/hydration render — the hook
 * starts with `initialValue` (matching the server HTML) and syncs the real
 * stored value in an effect right after mount. Reading localStorage inside
 * the state initializer would make the first client render differ from the
 * server output whenever the user had saved data (favorites, recents, …)
 * and trigger React hydration attribute mismatches.
 */
function readStored<T>(key: string, fallback: T): T {
  try {
    const item = window.localStorage.getItem(key);
    if (item !== null) return JSON.parse(item) as T;
  } catch {
    // Corrupted entry or blocked storage — keep fallback.
  }
  return fallback;
}

const emptySubscribe = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Post-hydration gate: false during SSR and the first client render (so
  // the committed HTML matches `initialValue`), true afterwards.
  const mounted = useSyncExternalStore(emptySubscribe, getMounted, getServerMounted);
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  // Pull persisted data once, after hydration (render-phase adjustment with
  // a guard — runs a single time per key, never during SSR/hydration).
  if (mounted && syncedKey !== key) {
    setSyncedKey(key);
    setStoredValue(readStored(key, initialValue));
  }

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch {
          // Storage full / unavailable — in-memory state still works.
        }
        return valueToStore;
      });
    },
    [key]
  );

  return [storedValue, setValue] as const;
}
