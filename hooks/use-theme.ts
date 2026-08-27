"use client";

import { useCallback, useSyncExternalStore } from "react";

const THEME_KEY = "gen-theme";

function getThemeSnapshot() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeThemeChange(cb: () => void) {
  window.addEventListener("themechange", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("themechange", cb);
    window.removeEventListener("storage", cb);
  };
}

function resolveIsDark(mode: string) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return mode === "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeThemeChange, getThemeSnapshot, () => "dark");
  const mode = useSyncExternalStore(
    subscribeThemeChange,
    () => {
      if (typeof document === "undefined") return "dark";
      return localStorage.getItem(THEME_KEY) || "dark";
    },
    () => "dark",
  );

  const setTheme = useCallback((mode: string) => {
    const isDark = resolveIsDark(mode);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    localStorage.setItem(THEME_KEY, mode);
    window.dispatchEvent(new Event("themechange"));
  }, []);

  const cycleTheme = useCallback(() => {
    const cur = localStorage.getItem(THEME_KEY) || "dark";
    const next = cur === "dark" ? "light" : cur === "light" ? "system" : "dark";
    setTheme(next);
  }, [setTheme]);

  return { theme, mode, setTheme, cycleTheme };
}
