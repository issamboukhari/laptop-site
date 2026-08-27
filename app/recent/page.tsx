"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/Card";
import { ComputerGrid } from "@/components/computer/ComputerGrid";
import { useRecentComputers } from "@/lib/storage/local";
import { useResolvedModels } from "@/hooks/use-resolved-models";
import { Clock, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

function RecentContent() {
  const { recent, clearRecent } = useRecentComputers();
  const recentModels = useResolvedModels(recent);

  return (
    <div className="flex-1 flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-gen-fg transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Search
            </Link>
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-gen-accent" />
              <h1 className="text-2xl font-bold text-gen-fg">Recently Viewed</h1>
            </div>
            <p className="text-sm text-gen-muted mt-1">
              {recentModels.length} computer{recentModels.length !== 1 ? "s" : ""} viewed
            </p>
          </div>
          {recent.length > 0 && (
            <button
              onClick={clearRecent}
              className="flex items-center gap-1.5 text-sm text-gen-muted hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {recentModels.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="w-12 h-12 text-gen-muted/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gen-fg">No recent computers</h2>
            <p className="text-sm text-gen-muted mt-2 max-w-sm mx-auto">
              Open a computer&apos;s details or add it to a comparison to see it here.
            </p>
            <Link
              href="/"
              className="mt-6 h-10 px-5 rounded-xl bg-gen-accent text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-gen-accent-light transition-colors"
            >
              Browse Computers
            </Link>
          </Card>
        ) : (
          <ComputerGrid models={recentModels} />
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function RecentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gen-muted">Loading recent...</div>
        </div>
      }
    >
      <RecentContent />
    </Suspense>
  );
}
