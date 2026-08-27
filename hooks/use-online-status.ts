"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Tracks the browser's online/offline status and provides a manual
 * `refresh` callback that re-checks the real connectivity (navigator.onLine
 * plus a lightweight fetch probe) in case the OS reports online before the
 * radio is actually ready.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /** Probe the network to confirm we can actually reach the server. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/computers?limit=1", {
        method: "GET",
        cache: "no-store",
      });
      const ok = res.ok;
      setOnline(ok);
      return ok;
    } catch {
      setOnline(false);
      return false;
    }
  }, []);

  return { online, refresh };
}
