"use client";

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ComputerGrid } from "@/components/computer/ComputerGrid";
import { FilterBar } from "@/components/computer/FilterBar";
import {
  AdvancedFilterPanel,
  EMPTY_FILTERS,
  useFilteredModels,
  countActiveAdvancedFilters,
  type AdvancedFilters,
} from "@/components/computer/AdvancedFilterPanel";
import { SmartSearch } from "@/components/search/SmartSearch";
import { CompareBar, CompareBarSpacer } from "@/components/compare/CompareBar";
import { ComputerModel, ComputerCategory } from "@/lib/data/types";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  saveCatalogToCache,
  loadCatalogFromCache,
} from "@/lib/storage/offline-cache";
import { AlertTriangle, RefreshCw, Loader2, Sparkles, WifiOff } from "lucide-react";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 200;

interface AiSearchResponse {
  source: "database" | "ai";
  models: ComputerModel[];
  saved: boolean;
  interpretedAs?: string;
}

export function HomePageClient({
  initialModels,
  categoryCounts: serverCategoryCounts,
  initialTotal,
}: {
  initialModels: ComputerModel[];
  categoryCounts: Record<string, number>;
  initialTotal: number;
}) {
  // Server provides the first page of models + precomputed category counts.
  // Additional pages are fetched via /api/computers on category switch or "Load More".
  const [browseResults, setBrowseResults] = useState<ComputerModel[]>(initialModels);
  const [browseTotal, setBrowseTotal] = useState(initialTotal);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [initialLoading] = useState(false);
  const [loadError] = useState<string | null>(null);

  // ── Offline-first: persist catalog + detect connectivity ────────────
  const { online } = useOnlineStatus();
  const [isOffline, setIsOffline] = useState(false);
  const refreshingRef = useRef(false);
  const [reconnecting, setReconnecting] = useState(false);
  // Post-hydration gate for the adjustments below (SSR HTML stays as-is).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [cacheChecked, setCacheChecked] = useState(false);
  const [prevOnline, setPrevOnline] = useState<boolean | null>(null);

  // Save incoming models to cache on every successful render.
  useEffect(() => {
    if (initialModels.length > 0) {
      saveCatalogToCache(initialModels);
    }
  }, [initialModels]);

  // On mount, if server gave us nothing (offline / error), try the cache.
  // Guarded render-phase adjustment — runs once, after hydration only.
  if (mounted && !cacheChecked && initialModels.length === 0) {
    setCacheChecked(true);
    const cached = loadCatalogFromCache();
    if (cached && cached.length > 0) {
      setBrowseResults(cached);
      setBrowseTotal(cached.length);
      setIsOffline(true);
    }
  }

  // Track online/offline transitions (guarded render-phase adjustment).
  if (mounted && prevOnline !== online) {
    setPrevOnline(online);
    setIsOffline(!online);
  }

  // When coming back online, auto-refresh the catalog from the server.
  // Uses a ref guard (not state) to avoid re-triggering on guard changes.
  useEffect(() => {
    if (!online || refreshingRef.current) return;
    let cancelled = false;
    (async () => {
      refreshingRef.current = true;
      setReconnecting(true);
      try {
        const res = await fetch("/api/computers?limit=100", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const models: ComputerModel[] = data?.models ?? [];
        if (!cancelled && models.length > 0) {
          setBrowseResults(models);
          setBrowseTotal(models.length);
          saveCatalogToCache(models);
          setIsOffline(false);
        }
      } catch {
        // still offline — keep using cache
      } finally {
        refreshingRef.current = false;
        if (!cancelled) setReconnecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [online]);

  const [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Server-backed search state.
  const [searchResults, setSearchResults] = useState<ComputerModel[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [category, setCategory] = useState<ComputerCategory | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Hardware-criteria highlight terms for the current results ("why this result").
  const [matchedTerms, setMatchedTerms] = useState<string[]>([]);

  // Dynamic Specs Expansion — AI-discovered extras for the current criteria.
  const [expandedModels, setExpandedModels] = useState<ComputerModel[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [expandNotice, setExpandNotice] = useState<string | null>(null);

  // Advanced filtering (RAM / GPU / CPU / price / sort) — instant client-side.
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [advOpen, setAdvOpen] = useState(false);

  // AI Search state.
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<"database" | "ai-saved" | null>(null);
  const [aiQueried, setAiQueried] = useState("");
  const [aiInterpretedAs, setAiInterpretedAs] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState<string>("");
  const skipSearchFetchRef = useRef(false);
  /** Queries already auto-sent to Gemini for missing generations (loop guard). */
  const autoAiAttemptedRef = useRef<Set<string>>(new Set());

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  // Debounce raw typing into a query. Normalization ("hp ", " hp  ") happens
  // server-side, so trailing/extra spaces are safe.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const isSearchMode = debouncedQuery.trim().length > 0;

  // Leaving search mode clears stale results (guarded render-phase
  // adjustment — only fires when there is something to clear).
  if (
    !isSearchMode &&
    (searchResults !== null ||
      searchError !== null ||
      searchLoading ||
      matchedTerms.length > 0)
  ) {
    setSearchResults(null);
    setSearchError(null);
    setSearchLoading(false);
    setMatchedTerms([]);
  }

  // Abort any in-flight search once search mode is left (no state here).
  useEffect(() => {
    if (!isSearchMode) searchAbortRef.current?.abort();
  }, [isSearchMode]);

  // Category counts are precomputed on the server — no client-side full-catalog scan.
  const counts = serverCategoryCounts;

  // Browsing mode: fetch from API when category changes.
  // "Load More" is handled separately by setVisibleCount which triggers
  // a re-render with more items from the already-fetched results.
  const browseAbortRef = useRef<AbortController | null>(browseResults.length > 0 ? new AbortController() : null);
  const browseFetchedRef = useRef(browseResults.length > 0);

  useEffect(() => {
    // Don't fetch if we're in search mode.
    if (isSearchMode) return;
    // Skip the first run — the server already provided the initial page.
    if (!browseFetchedRef.current) {
      browseFetchedRef.current = true;
      return;
    }

    browseAbortRef.current?.abort();
    const controller = new AbortController();
    browseAbortRef.current = controller;

    setBrowseLoading(true);
    setBrowseError(null);

    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: "0" });
    if (category !== "all") params.set("category", category);

    fetch(`/api/computers?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          let message = "Failed to load computers. Please try again.";
          try {
            const err = await r.json();
            if (typeof err?.error?.message === "string") message = err.error.message;
          } catch {}
          throw new Error(message);
        }
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setBrowseResults(data.models || []);
        setBrowseTotal(data.total ?? 0);
        setBrowseLoading(false);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setBrowseError(
          e instanceof Error ? e.message : "Failed to load computers."
        );
        setBrowseLoading(false);
      });

    return () => { controller.abort(); };
  // category change triggers refetch; isSearchMode gates the effect.
  }, [category, isSearchMode]);

  // "Load More" — fetch additional items for the current category.
  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
  }, []);

  useEffect(() => {
    // Only fetch more if visibleCount was increased beyond what we have.
    if (isSearchMode || visibleCount <= PAGE_SIZE) return;

    browseAbortRef.current?.abort();
    const controller = new AbortController();
    browseAbortRef.current = controller;

    const params = new URLSearchParams({ limit: String(visibleCount), offset: "0" });
    if (category !== "all") params.set("category", category);

    fetch(`/api/computers?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load more.");
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setBrowseResults(data.models || []);
        setBrowseTotal(data.total ?? 0);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setBrowseError(e instanceof Error ? e.message : "Failed to load more.");
      });

    return () => { controller.abort(); };
  }, [visibleCount, category, isSearchMode]);

  const displayModels = isSearchMode ? searchResults ?? [] : browseResults;
  const totalResults = isSearchMode ? searchTotal : browseTotal;
  const visible =
    isSearchMode ? displayModels.slice(0, visibleCount) : displayModels.slice(0, visibleCount);

  // AI-expanded models appear first (fresh discoveries), skipping duplicates.
  const expandedFresh = useMemo(
    () => expandedModels.filter((m) => !visible.some((v) => v.id === m.id)),
    [expandedModels, visible]
  );
  const combinedVisible = useMemo(
    () => [...expandedFresh, ...visible],
    [expandedFresh, visible]
  );

  // Advanced filters + sorting applied instantly on the client.
  const finalVisible = useFilteredModels(combinedVisible, advFilters);
  const advCount = countActiveAdvancedFilters(advFilters);
  const filteredEmpty = combinedVisible.length > 0 && finalVisible.length === 0;
  const hasMore = visibleCount < totalResults;

  const handleCategoryChange = useCallback((cat: ComputerCategory | "all") => {
    setCategory(cat);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
    setExpandedModels([]);
    setExpandError(null);
    setExpandNotice(null);
  }, []);

  const handleRetrySearch = useCallback(() => {
    setSearchError(null);
    setRetryNonce((n) => n + 1);
  }, []);

  /**
   * Dynamic Specs Expansion — asks Gemini for NEW, different, real computers
   * matching the current search criteria (e.g. "RTX 4060 16GB"), saves them
   * to Supabase and prepends them to the list without any page refresh.
   */
  const handleExpandMore = useCallback(async () => {
    if (expanding || !debouncedQuery.trim()) return;
    // Only the ids the user can actually SEE matter for exclusion — trim to
    // the newest 40 so the payload stays tiny no matter how big the catalog.
    const excludeIds = [
      ...(searchResults ?? []).slice(0, visibleCount).map((m) => m.id),
      ...expandedModels.map((m) => m.id),
    ].slice(-40);

    setExpanding(true);
    setExpandError(null);
    setExpandNotice(null);

    try {
      const res = await fetch("/api/expand-computers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: debouncedQuery.trim(), excludeIds, count: 3 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error?.message || "تعذر جلب أجهزة إضافية حاليًا. حاول مجددًا."
        );
      }
      const fresh: ComputerModel[] = Array.isArray(data?.models) ? data.models : [];
      if (fresh.length === 0) {
        setExpandNotice("لم يتم العثور على أجهزة جديدة إضافية بهذه المواصفات الآن.");
      } else {
        setExpandedModels((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...fresh.filter((f) => !seen.has(f.id))];
        });
        setExpandNotice(
          data?.savedCount > 0
            ? `تم اكتشاف ${fresh.length} ${fresh.length === 1 ? "جهاز جديد" : "أجهزة جديدة"} وحفظها في قاعدة البيانات العالمية.`
            : data?.internalCount > 0
              ? `وجدنا ${fresh.length} ${fresh.length === 1 ? "جهازًا" : "أجهزة"} مخزنة لدينا تطابق المواصفات.`
              : `تم إيجاد ${fresh.length} ${fresh.length === 1 ? "جهاز" : "أجهزة"} مطابقة.`
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setExpandError(e instanceof Error ? e.message : "حدث خطأ غير متوقع.");
    } finally {
      setExpanding(false);
    }
  }, [expanding, debouncedQuery, searchResults, visibleCount, expandedModels]);

  /**
   * AI Computer Search — SSE streaming core. Parameterized so both the manual
   * button and the automatic missing-generation trigger can use it.
   * An effect event: always sees the latest state, never needs to appear in
   * effect dependency arrays, and never retriggers effects.
   */
  const aiSearchingRef = useRef(false);
  const runAiSearch = useCallback(
    async (query: string) => {
      if (!query || aiSearchingRef.current) return;

      aiSearchingRef.current = true;
      setAiSearching(true);
      setAiError(null);
      setAiQueried(query);
      setAiInterpretedAs(null);
      setAiProgress("Starting AI research…");

      try {
        const res = await fetch("/api/ai-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          let message = "AI Search is unavailable right now. Please try again.";
          try {
            const err = await res.json();
            if (typeof err?.error?.message === "string") message = err.error.message;
          } catch {}
          throw new Error(message);
        }

        // Consume SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(5).trim());

              if (payload.type === "progress") {
                const steps: Record<string, string> = {
                  database: "Found in database — returning instantly…",
                  identifying: "جاري جلب مواصفات الجهاز عبر الذكاء الاصطناعي…",
                  parsing: "Parsing specifications…",
                  saving: "Saving to global database…",
                  done: "Finalizing…",
                };
                setAiProgress(steps[payload.step] || "جاري جلب مواصفات الجهاز عبر الذكاء الاصطناعي…");
              }

              if (payload.type === "result") {
                const data = payload as AiSearchResponse;
                if (!data.models || data.models.length === 0) {
                  setAiError(
                    `Gemini could not find any real computer close to "${query}". Try a brand + series name (e.g. "Lenovo Yoga Slim 7").`
                  );
                  return;
                }
                skipSearchFetchRef.current = true;
                setSearch(data.interpretedAs || query);
                setVisibleCount(PAGE_SIZE);
                setDebouncedQuery(data.interpretedAs || query);
                setSearchResults(data.models);
                setSearchTotal(data.models.length);
                setSearchError(null);
                setAiNotice(data.source === "ai" ? "ai-saved" : "database");
                if (data.interpretedAs) setAiInterpretedAs(data.interpretedAs);
                return;
              }

              if (payload.type === "error") {
                throw new Error(payload.message);
              }
            } catch {}
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setAiError(
          e instanceof Error ? e.message : "AI Search failed. Please try again."
        );
      } finally {
        aiSearchingRef.current = false;
        setAiSearching(false);
        setAiProgress("");
      }
    },
    []
  );

  // Server search: relevance-ranked against the ENTIRE database.
  // Declared after runAiSearch (effect event) so the auto-discovery call
  // below never reads a binding before its declaration.
  useEffect(() => {
    if (!isSearchMode) return;

    // AI Search just applied its own results — don't overwrite them.
    if (skipSearchFetchRef.current) {
      skipSearchFetchRef.current = false;
      return;
    }
    setAiNotice(null);

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const reqId = ++searchRequestIdRef.current;

    setSearchLoading(true);
    const params = new URLSearchParams({
      q: debouncedQuery,
      limit: String(visibleCount),
    });
    if (category !== "all") params.set("category", category);

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          let message = "Search is unavailable right now. Please try again.";
          try {
            const err = await r.json();
            if (typeof err?.error?.message === "string") message = err.error.message;
          } catch {
            // keep default
          }
          throw new Error(message);
        }
        return r.json();
      })
      .then((data) => {
        if (reqId !== searchRequestIdRef.current || controller.signal.aborted) return;
        setSearchResults(data.models || []);
        setSearchTotal(data.total ?? 0);
        setSearchError(null);
        setSearchLoading(false);
        setMatchedTerms(
          Array.isArray(data.matchedTerms)
            ? data.matchedTerms.filter((t: unknown): t is string => typeof t === "string")
            : []
        );

        // Exact-generation guard: the user asked for e.g. "G11" but the
        // catalog only carries other generations → auto-discover via Gemini
        // (once per query) instead of showing wrong generations.
        const missing: string[] | undefined = data.generationMissing;
        const q = debouncedQuery.trim();
        if (missing?.length && q && !autoAiAttemptedRef.current.has(q.toLowerCase())) {
          autoAiAttemptedRef.current.add(q.toLowerCase());
          void runAiSearch(q);
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (reqId !== searchRequestIdRef.current) return;
        // Keep previous results visible; surface a retryable banner.
        setSearchError(
          e instanceof Error ? e.message : "Search failed. Please try again."
        );
        setSearchLoading(false);
      });
  }, [debouncedQuery, category, visibleCount, isSearchMode, retryNonce, runAiSearch]);

  const handleAiSearch = useCallback(() => {
    void runAiSearch(search.trim());
  }, [search, runAiSearch]);

  const loading = initialLoading || browseLoading || (isSearchMode && searchLoading && !searchResults);
  const pageError = !isSearchMode ? (loadError || browseError) : null;
  const showEmptyState =
    !loading &&
    !pageError &&
    combinedVisible.length === 0 &&
    !aiSearching &&
    !(isSearchMode && (searchLoading || searchError));

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-b border-gen-border py-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gen-accent/5 via-transparent to-blue-500/5" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Find your perfect{" "}
              <span className="gen-gradient-text">computer</span>
            </h1>
            <p className="text-gen-muted mt-2 text-sm max-w-lg leading-relaxed">
              Search, compare, and get personalized multi-criteria ratings plus
              AI advice. Gaming, coding, design, or university — find the best
              match for your priorities.
            </p>
            <div className="mt-5 max-w-2xl relative z-10 flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <SmartSearch value={search} onChange={handleSearchChange} />
              </div>
              <button
                onClick={handleAiSearch}
                disabled={aiSearching || !search.trim() || isOffline}
                title={isOffline ? "AI Search requires an internet connection" : "Search for ANY computer in the world — Gemini researches it and saves it to the global database"}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-gen-accent to-fuchsia-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-lg shadow-gen-accent/20 hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {aiSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiSearching ? "Researching…" : "AI Search"}
              </button>
            </div>
            <p className="mt-2 max-w-2xl text-[11px] text-gen-muted">
              Internal search looks inside the gen database ·{" "}
              <span className="text-gen-accent font-medium">AI Search</span> finds any
              computer worldwide, then saves it here permanently.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <FilterBar
            selected={category}
            onChange={handleCategoryChange}
            counts={counts}
          />
        </section>

        {/* Offline banner */}
        {isOffline && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-gen-fg">
                <strong>Offline mode</strong> — showing cached data.
                {reconnecting ? " Reconnecting…" : " AI features are unavailable without internet."}
              </p>
            </div>
          </section>
        )}

        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <p className="text-sm text-gen-muted flex items-center gap-2 min-w-0">
              {isSearchMode && debouncedQuery.trim() ? (
                <>
                  <span>
                    <strong className="text-gen-fg">{totalResults}</strong> results for{" "}
                    <strong className="text-gen-fg">“{debouncedQuery.trim()}”</strong>
                  </span>
                  {searchLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-gen-accent shrink-0" />
                  )}
                </>
              ) : (
                <span>
                  <strong className="text-gen-fg">{browseTotal}</strong> models found
                </span>
              )}
            </p>
            <CompareBar />
          </div>

          {/* Advanced filter toolbar */}
          <div className="flex items-center justify-end mb-4 relative">
            <AdvancedFilterPanel
              open={advOpen}
              onOpenChange={setAdvOpen}
              filters={advFilters}
              onChange={setAdvFilters}
            />
          </div>

          {/* Active filter summary chips */}
          {advCount > 0 && !filteredEmpty && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-gen-muted">
                {finalVisible.length} نتيجة مطابقة للفلاتر
              </span>
              <button
                onClick={() => setAdvFilters(EMPTY_FILTERS)}
                className="h-8 px-3 rounded-lg bg-gen-accent/10 text-gen-accent text-xs font-medium hover:bg-gen-accent/20 transition-colors cursor-pointer"
              >
                مسح الفلاتر
              </button>
            </div>
          )}

          {/* AI Search notices */}
          {aiSearching && (
            <div className="mb-4 rounded-xl border border-gen-accent/30 bg-gen-accent/5 px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-gen-accent shrink-0" />
              <p className="text-sm text-gen-fg">
                {aiProgress || (
                  <>
                    Researching <strong>&quot;{aiQueried}&quot;</strong> — gathering specs and configurations…
                  </>
                )}
              </p>
            </div>
          )}
          {!aiSearching && aiError && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-sm text-gen-fg truncate">{aiError}</p>
              </div>
              <button
                onClick={handleAiSearch}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gen-accent/10 text-gen-accent text-xs font-medium hover:bg-gen-accent/20 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}
          {aiNotice && isSearchMode && !searchLoading && (
            <div className="mb-4 rounded-xl border border-gen-accent/30 bg-gen-accent/5 px-4 py-3">
              {aiNotice === "ai-saved" ? (
                <p className="text-sm text-gen-fg">
                  <Sparkles className="w-4 h-4 inline text-gen-accent mr-1.5" />
                  {aiInterpretedAs && aiInterpretedAs.toLowerCase() !== debouncedQuery.trim().toLowerCase() ? (
                    <>
                      Matched your query to <strong>“{aiInterpretedAs}”</strong> — discovered via
                      Gemini and saved to the global database for everyone.
                    </>
                  ) : (
                    <>
                      Discovered by Gemini and saved to the global database — every gen user
                      can now find it with normal search.
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gen-fg">
                  Already in the gen database — served instantly, no Gemini call needed.
                </p>
              )}
            </div>
          )}

          {/* Search error banner — previous results stay visible. */}
          {searchError && isSearchMode && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-gen-fg truncate">{searchError}</p>
              </div>
              <button
                onClick={handleRetrySearch}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gen-accent/10 text-gen-accent text-xs font-medium hover:bg-gen-accent/20 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {pageError && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4 opacity-30">⚠️</div>
              <h3 className="text-lg font-semibold text-gen-fg">
                Unable to load computers
              </h3>
              <p className="text-sm text-gen-muted mt-1">{pageError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-gen-accent text-white"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !pageError && finalVisible.length > 0 && (
            <ComputerGrid
              models={finalVisible}
              highlight={isSearchMode ? matchedTerms : undefined}
              grouped={isSearchMode}
            />
          )}

          {/* Filters active but nothing survived them */}
          {!loading && !pageError && filteredEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4 opacity-30">🎛️</div>
              <h3 className="text-lg font-semibold text-gen-fg">
                لا توجد نتائج مطابقة للفلاتر
              </h3>
              <p className="text-sm text-gen-muted mt-1 max-w-sm">
                {combinedVisible.length} جهازًا موجودًا لكن لا أحد يحقق كل الفلاتر المحددة.
              </p>
              <button
                onClick={() => setAdvFilters(EMPTY_FILTERS)}
                className="mt-4 h-11 px-6 rounded-xl bg-gen-accent text-white text-sm font-semibold hover:bg-gen-accent-light transition-colors cursor-pointer"
              >
                مسح الفلاتر
              </button>
            </div>
          )}

          {showEmptyState && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4 opacity-30">🔍</div>
              <h3 className="text-lg font-semibold text-gen-fg">
                No matching computers
              </h3>
              <p className="text-sm text-gen-muted mt-1 max-w-sm">
                Try fewer words or check spelling — suggestions appear as you type,
                and close matches are always ranked first.
              </p>
            </div>
          )}

          {/* Dynamic Specs Expansion — find more computers with these specs */}
          {isSearchMode && !searchLoading && !aiSearching && (
            <div className="flex flex-col items-center gap-2 pt-2 pb-4">
              <button
                onClick={handleExpandMore}
                disabled={expanding || isOffline}
                title={isOffline ? "Requires internet connection" : "Ask Gemini to discover more real computers with these exact specifications"}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 bg-gen-accent/10 text-gen-accent border border-gen-accent/30 hover:bg-gen-accent/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {expanding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {expanding
                  ? "جاري جلب المزيد عبر الذكاء الاصطناعي…"
                  : "أضف المزيد من الحواسيب بنفس هذه المواصفات"}
              </button>
              {expandError && <p className="text-xs text-red-400">{expandError}</p>}
              {!expanding && !expandError && expandNotice && (
                <p className="text-xs text-gen-muted">{expandNotice}</p>
              )}
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-gen-card animate-pulse" />
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center pt-2 pb-10">
              <button
                onClick={handleLoadMore}
                className="px-7 py-2.5 rounded-xl text-sm font-semibold bg-gen-card text-gen-accent border border-gen-accent/30 hover:bg-gen-accent/10 transition-colors cursor-pointer"
              >
                Load More ({Math.min(PAGE_SIZE, totalResults - visibleCount)} more)
              </button>
            </div>
          )}
        </section>
      </main>
      <CompareBarSpacer />
      <Footer />
    </>
  );
}
