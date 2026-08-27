"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/Card";
import { ComputerGrid } from "@/components/computer/ComputerGrid";
import { useFavorites } from "@/lib/storage/local";
import { useResolvedModels } from "@/hooks/use-resolved-models";
import { Heart, ArrowLeft } from "lucide-react";
import Link from "next/link";

function FavoritesContent() {
  const { favorites } = useFavorites();
  const favoriteModels = useResolvedModels(favorites);

  return (
    <div className="flex-1 flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-gen-fg transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold text-gen-fg">Favorites</h1>
          </div>
          <p className="text-sm text-gen-muted mt-1">
            {favoriteModels.length} model{favoriteModels.length !== 1 ? "s" : ""} saved
          </p>
        </div>

        {favoriteModels.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="w-12 h-12 text-gen-muted/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gen-fg">No favorites yet</h2>
            <p className="text-sm text-gen-muted mt-2 max-w-sm mx-auto">
              Click the heart icon on any computer card to save it here for quick access.
            </p>
            <Link
              href="/"
              className="mt-6 h-10 px-5 rounded-xl bg-gen-accent text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-gen-accent-light transition-colors"
            >
              Browse Computers
            </Link>
          </Card>
        ) : (
          <ComputerGrid models={favoriteModels} />
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gen-muted">Loading favorites...</div>
        </div>
      }
    >
      <FavoritesContent />
    </Suspense>
  );
}
