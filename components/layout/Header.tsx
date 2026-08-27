"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, Cpu, Heart, Clock, Settings } from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";

export function Header() {
  const { theme, cycleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 gen-glass border-b border-gen-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gen-accent to-blue-500 flex items-center justify-center shadow-sm">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight gen-gradient-text">
              gen
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-2 text-sm font-medium text-gen-muted hover:text-gen-fg rounded-lg hover:bg-gen-card-hover transition-colors"
            >
              Search
            </Link>
            <Link
              href="/compare"
              className="px-3 py-2 text-sm font-medium text-gen-muted hover:text-gen-fg rounded-lg hover:bg-gen-card-hover transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/favorites"
              className="px-3 py-2 text-sm font-medium text-gen-muted hover:text-gen-fg rounded-lg hover:bg-gen-card-hover transition-colors inline-flex items-center gap-1"
            >
              <Heart className="w-3.5 h-3.5" />
              Favorites
            </Link>
            <Link
              href="/recent"
              className="px-3 py-2 text-sm font-medium text-gen-muted hover:text-gen-fg rounded-lg hover:bg-gen-card-hover transition-colors inline-flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              Recent
            </Link>
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={cycleTheme}
              className="h-9 w-9 rounded-xl border border-gen-border bg-gen-card flex items-center justify-center hover:bg-gen-card-hover transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-gen-muted" />
              ) : (
                <Moon className="h-4 w-4 text-gen-muted" />
              )}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9 rounded-xl border border-gen-border bg-gen-card flex items-center justify-center hover:bg-gen-card-hover transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4 text-gen-muted" />
            </button>
          </div>
        </div>
      </header>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
