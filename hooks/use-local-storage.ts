"use client";

import { useState, useCallback, useEffect } from "react";

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
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Pull persisted data once, after hydration.
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item) as T);
    } catch {
      // Corrupted entry or blocked storage — keep initialValue.
    }
  }, [key]);

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
