"use client";

import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const ACCENTS = [
  { id: "violet", hex: "#7c3aed", label: "Violet" },
  { id: "blue", hex: "#2563eb", label: "Blue" },
  { id: "emerald", hex: "#10b981", label: "Emerald" },
  { id: "rose", hex: "#f43f5e", label: "Rose" },
  { id: "amber", hex: "#f59e0b", label: "Amber" },
  { id: "cyan", hex: "#06b6d4", label: "Cyan" },
  { id: "orange", hex: "#f97316", label: "Orange" },
  { id: "slate", hex: "#64748b", label: "Slate" },
];

const ACCENT_LIGHT_MAP: Record<string, string> = {
  violet: "#6d28d9",
  blue: "#1d4ed8",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
  cyan: "#0891b2",
  orange: "#ea580c",
  slate: "#475569",
};

const FONT_SIZES = [
  { id: "compact", label: "Compact", size: "13px" },
  { id: "normal", label: "Normal", size: "14px" },
  { id: "relaxed", label: "Relaxed", size: "16px" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const { mode, setTheme } = useTheme();
  const [accent, setAccentState] = useState("violet");
  const [fontSize, setFontSizeState] = useState("normal");

  useEffect(() => {
    const saved = localStorage.getItem("gen-accent") || "violet";
    setAccentState(saved);
    applyAccent(saved);
    const savedFont = localStorage.getItem("gen-font") || "normal";
    setFontSizeState(savedFont);
    applyFontSize(savedFont);
  }, []);

  function applyAccent(id: string) {
    const root = document.documentElement;
    if (id === "violet") {
      root.style.removeProperty("--gen-accent");
      root.style.removeProperty("--gen-accent-light");
      root.style.removeProperty("--gen-accent-glow");
    } else {
      const hex = ACCENTS.find((a) => a.id === id)?.hex || "#7c3aed";
      const light = ACCENT_LIGHT_MAP[id] || hex;
      root.style.setProperty("--gen-accent", hex);
      root.style.setProperty("--gen-accent-light", light);
      root.style.setProperty("--gen-accent-glow", hex + "40");
    }
  }

  function applyFontSize(id: string) {
    const map: Record<string, string> = { compact: "13px", normal: "14px", relaxed: "16px" };
    document.documentElement.style.fontSize = map[id] || "14px";
  }

  function handleAccent(id: string) {
    setAccentState(id);
    localStorage.setItem("gen-accent", id);
    applyAccent(id);
  }

  function handleFontSize(id: string) {
    setFontSizeState(id);
    localStorage.setItem("gen-font", id);
    applyFontSize(id);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 z-50 w-[360px] max-w-[90vw] h-full bg-gen-card border-l border-gen-border flex flex-col overflow-y-auto transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-gen-border bg-gen-card">
          <h2 className="text-lg font-bold tracking-tight">Settings</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg border border-gen-border flex items-center justify-center hover:bg-gen-card-hover transition-colors">
            <X className="h-4 w-4 text-gen-muted" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6 flex-1">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gen-muted mb-3">Theme</h3>
            <div className="flex gap-2">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-2.5 px-2 rounded-xl border-[1.5px] text-center text-xs font-medium transition-all ${
                    mode === t
                      ? "border-gen-accent text-gen-accent bg-gen-accent/10"
                      : "border-gen-border text-gen-muted hover:border-gen-accent/40 hover:text-gen-fg bg-gen-bg"
                  }`}
                >
                  <span className="text-lg block mb-1">{t === "system" ? "💻" : t === "light" ? "☀️" : "🌙"}</span>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gen-muted mb-3">Accent Color</h3>
            <div className="grid grid-cols-4 gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAccent(a.id)}
                  className={`aspect-square rounded-[10px] border-2 transition-all relative ${
                    accent === a.id ? "border-gen-fg scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: a.hex }}
                  title={a.label}
                >
                  {accent === a.id && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gen-muted mb-3">Font Size</h3>
            <div className="flex gap-2">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFontSize(f.id)}
                  className={`flex-1 py-2.5 px-2 rounded-xl border-[1.5px] text-center font-medium transition-all ${
                    fontSize === f.id
                      ? "border-gen-accent text-gen-accent bg-gen-accent/10"
                      : "border-gen-border text-gen-muted hover:border-gen-accent/40 hover:text-gen-fg bg-gen-bg"
                  }`}
                >
                  <span className="text-sm block">{f.label}</span>
                  <span className="text-xs text-gen-muted mt-1 block">Aa</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
