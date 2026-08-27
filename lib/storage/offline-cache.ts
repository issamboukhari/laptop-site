import { ComputerModel } from "@/lib/data/types";

const CATALOG_KEY = "gen_offline_catalog";
const CATALOG_TS_KEY = "gen_offline_catalog_ts";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Offline catalog cache — persists the full computer list in localStorage
 * so the app works without network.  Written after every successful server
 * fetch; read when the app loads offline.
 */

export function saveCatalogToCache(models: ComputerModel[]): void {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(models));
    localStorage.setItem(CATALOG_TS_KEY, String(Date.now()));
  } catch {
    // Storage full — non-critical, app still works online.
  }
}

export function loadCatalogFromCache(): ComputerModel[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ComputerModel[];
  } catch {
    return null;
  }
}

export function isCacheFresh(): boolean {
  try {
    const ts = Number(localStorage.getItem(CATALOG_TS_KEY) ?? 0);
    return Date.now() - ts < CACHE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function clearCatalogCache(): void {
  try {
    localStorage.removeItem(CATALOG_KEY);
    localStorage.removeItem(CATALOG_TS_KEY);
  } catch {
    // ignore
  }
}
