"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/hooks/use-theme";
import {
  Moon,
  Sun,
  Cpu,
  Heart,
  Clock,
  Settings,
  Search,
  Scale,
} from "lucide-react";
import { SettingsPanel } from "./SettingsPanel";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/", label: "Search", icon: Search },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/recent", label: "Recent", icon: Clock },
] as const;

export function Header() {
  const { theme, cycleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop header ─────────────────────────────────────────── */}
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

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1",
                  pathname === href
                    ? "text-gen-accent bg-gen-accent/10"
                    : "text-gen-muted hover:text-gen-fg hover:bg-gen-card-hover"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
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

      {/* ── Mobile bottom nav — visible only below sm (640px) ──────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gen-border gen-glass pb-safe">
        <div className="grid grid-cols-4 h-14">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-gen-accent"
                    : "text-gen-muted active:text-gen-fg"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    active && "drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]"
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
