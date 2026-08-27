"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CompareBarSpacer } from "@/components/compare/CompareBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ComputerVariant } from "@/lib/data/types";
import { resolveVariantImageUrl } from "@/lib/data/product-images";
import { CATEGORY_LABELS, USE_CASES } from "@/lib/data/categories";
import { UseCase, RatingCategory } from "@/lib/data/types";
import { calculateComparison } from "@/lib/scoring/algorithm";
import { calculateRatings, RATING_DEFINITIONS } from "@/lib/scoring/ratings";
import {
  formatPrice,
  formatRam,
  formatStorage,
  formatBattery,
  formatWeight,
  getScoreColor,
} from "@/lib/utils/format";
import {
  Trophy,
  ArrowLeft,
  Trash2,
  Scale,
  Star,
  Gamepad2,
  Settings2,
  X,
  Plus,
  Repeat,
  AlertTriangle,
  ListChecks,
  Sparkles,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { GeminiChatPanel } from "@/components/gemini/GeminiChatPanel";
import { useRecentComputers } from "@/lib/storage/local";
import { useCompareSelection } from "@/hooks/use-compare-selection";
import { RatingsComparison } from "@/components/compare/RatingsComparison";
import { GameCompatibility } from "@/components/compare/GameCompatibility";
import { SpecComparison } from "@/components/compare/SpecComparison";
import { ProductImage } from "@/components/computer/ProductImage";
import { AddComputerPicker } from "@/components/compare/AddComputerPicker";
import { RatingsCard } from "@/components/rating/RatingsCard";
import {
  resolveParentModelSync,
  resolveVariantSync,
  useRemoteComputers,
} from "@/hooks/use-remote-computer";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Slot card: one side of the comparison (computer → exact configuration)
// ---------------------------------------------------------------------------

interface SlotCardProps {
  index: number;
  variant?: ComputerVariant;
  remoteModel?: import("@/lib/data/types").ComputerModel;
  otherSlotId?: string;
  onRemove: () => void;
  onChangeConfig: (variantId: string) => void;
  onReplace: () => void;
}

function SlotCard({
  index,
  variant,
  remoteModel,
  otherSlotId,
  onRemove,
  onChangeConfig,
  onReplace,
}: SlotCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const model = useMemo(
    () =>
      (variant
        ? resolveParentModelSync(variant.id, { model: remoteModel })
        : undefined),
    [variant, remoteModel]
  );
  const configOptions = useMemo(
    () => model?.variants.filter((v) => v.id !== otherSlotId) ?? [],
    [model, otherSlotId]
  );

  // Broken slot: the stored id no longer resolves to a computer.
  if (!variant) {
    return (
      <Card className="p-5 border-red-500/30 bg-red-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="mb-1.5">
              Computer {index === 0 ? "A" : "B"}
            </Badge>
            <p className="text-sm font-semibold text-gen-fg">
              Unable to load this computer
            </p>
            <p className="text-xs text-gen-muted mt-1">
              It may no longer be available. The rest of your comparison keeps working.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={onReplace}
                className="h-8 px-3 rounded-lg bg-gen-accent text-white text-xs font-medium hover:bg-gen-accent-light transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Repeat className="w-3.5 h-3.5" />
                Choose another
              </button>
              <button
                onClick={onRemove}
                className="h-8 px-3 rounded-lg border border-gen-border text-gen-muted text-xs font-medium hover:text-gen-fg hover:border-gen-border/80 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Remove slot
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      {/* Header row */}
      <div className="p-4 border-b border-gen-border">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline">Computer {index === 0 ? "A" : "B"}</Badge>
              <Badge variant="accent">{CATEGORY_LABELS[variant.category]}</Badge>
            </div>
            <p className="text-[10px] text-gen-muted uppercase tracking-wider">
              {variant.brand}
              {model && model.name !== variant.name ? ` · ${model.name}` : ""}
            </p>
            <h3 className="text-sm font-semibold text-gen-fg leading-tight">
              {variant.name}
            </h3>
          </div>
          {/* One clear remove action */}
          <button
            onClick={onRemove}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-gen-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            aria-label={`Remove ${variant.name} from comparison`}
            title={`Remove ${variant.name}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick specs of the exact configuration */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gen-muted">
          <span className="inline-flex items-center gap-1 min-w-0">
            <Cpu className="w-3 h-3 shrink-0" />
            <span className="truncate">{variant.specs.cpu}</span>
          </span>
          <span>{formatRam(variant.specs.ram)} RAM</span>
          <span>{formatStorage(variant.specs.storage)}</span>
          <span className="truncate">{variant.specs.gpu}</span>
          <span className="truncate">{variant.specs.display}</span>
          <span>
            {variant.specs.batteryLife
              ? formatBattery(variant.specs.batteryLife)
              : "Desktop"}
          </span>
          {variant.specs.weight ? <span>{formatWeight(variant.specs.weight)}</span> : null}
        </div>

        {/* Price + actions */}
        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="text-lg font-bold text-gen-fg whitespace-nowrap">
            {formatPrice(variant.price)}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/computer/${variant.id}`}
              className="h-8 px-3 rounded-lg border border-gen-border text-gen-fg text-xs font-medium hover:bg-gen-card-hover transition-colors inline-flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Details
            </Link>
            <button
              onClick={onReplace}
              className="h-8 px-3 rounded-lg border border-gen-border text-gen-fg text-xs font-medium hover:bg-gen-card-hover transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Choose a different computer for this slot"
            >
              <Repeat className="w-3.5 h-3.5" />
              Replace
            </button>
          </div>
        </div>
      </div>

      {/* Change exact configuration */}
      {configOptions.length > 1 && (
        <div className="border-b border-gen-border">
          <button
            onClick={() => setConfigOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gen-muted hover:text-gen-fg transition-colors cursor-pointer"
            aria-expanded={configOpen}
          >
            <span className="inline-flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-gen-accent" />
              Change configuration ({configOptions.length} options)
            </span>
            <span className={cn("transition-transform duration-200", configOpen && "rotate-180")}>
              ▾
            </span>
          </button>
          {configOpen && (
            <ul className="px-2 pb-2 space-y-1 max-h-56 overflow-y-auto">
              {configOptions.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => {
                      onChangeConfig(v.id);
                      setConfigOpen(false);
                    }}
                    disabled={v.id === variant.id}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-lg transition-colors",
                      v.id === variant.id
                        ? "bg-gen-accent/10 cursor-default"
                        : "hover:bg-gen-card-hover cursor-pointer"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-gen-fg truncate">
                        {v.name}
                        {v.id === variant.id && (
                          <span className="ml-1.5 text-[10px] text-gen-accent">selected</span>
                        )}
                      </span>
                      <span className="text-[11px] text-gen-muted whitespace-nowrap">
                        {formatPrice(v.price)}
                      </span>
                    </div>
                    <p className="text-[10px] text-gen-muted truncate mt-0.5">
                      {v.specs.cpu} · {formatRam(v.specs.ram)} · {formatStorage(v.specs.storage)} ·{" "}
                      {v.specs.gpu}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Per-computer multi-criteria ratings */}
      <div className="p-4">
        <p className="text-[10px] font-semibold text-gen-muted uppercase tracking-wider mb-2">
          Ratings for this configuration
        </p>
        <RatingsCard variant={variant} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function CompareContent() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { selectedIds, remove, replaceAt, setAll, clear } = useCompareSelection();
  const { addRecent } = useRecentComputers();
  const [useCase, setUseCase] = useState<UseCase>("gaming");
  const [priorities, setPriorities] = useState<RatingCategory[]>([
    "gaming",
    "university",
    "value",
  ]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const seededRef = useRef(false);

  // Seed selection once from share-link URL params (?ids=a,b or legacy ?a=&b=),
  // then normalize the URL — without reloading or re-rendering via the router.
  useEffect(() => {
    if (!mounted || seededRef.current) return;
    seededRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    let fromUrl: string[] = [];
    const idsParam = sp.get("ids");
    if (idsParam) {
      fromUrl = idsParam.split(",").map((x) => x.trim()).filter(Boolean);
    } else {
      const a = sp.get("a");
      const b = sp.get("b");
      fromUrl = [a, b].filter((x): x is string => Boolean(x));
    }
    if (fromUrl.length > 0) {
      setAll(Array.from(new Set(fromUrl)));
    }
  }, [mounted, setAll]);

  // Keep the URL in sync (?ids=id1,id2) using replaceState only — no navigation.
  useEffect(() => {
    if (!mounted) return;
    const url =
      selectedIds.length > 0
        ? `/compare?ids=${encodeURIComponent(selectedIds.slice(0, 2).join(","))}`
        : "/compare";
    window.history.replaceState(null, "", url);
  }, [mounted, selectedIds]);

  // Record in recent when both slots are filled with valid computers.
  useEffect(() => {
    if (!mounted) return;
    if (selectedIds.length === 2) {
      const a = resolveVariantSync(selectedIds[0]);
      const b = resolveVariantSync(selectedIds[1]);
      if (a) addRecent(a.id);
      if (b) addRecent(b.id);
    }
  }, [mounted, selectedIds, addRecent]);

  const openPickerForAdd = useCallback(() => {
    setPickerSlot(null);
    setPickerOpen(true);
  }, []);
  const openPickerForSlot = useCallback((slotIndex: number) => {
    setPickerSlot(slotIndex);
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const handlePickerSelect = useCallback(
    (variantId: string) => {
      if (pickerSlot !== null) {
        replaceAt(pickerSlot, variantId);
      } else {
        // Fill the next empty slot.
        setAll([...selectedIds.filter(Boolean).slice(0, 2), variantId].slice(0, 2));
      }
    },
    [pickerSlot, replaceAt, selectedIds, setAll]
  );

  const clearComparison = useCallback(() => {
    clear();
    window.history.replaceState(null, "", "/compare");
  }, [clear]);

  const remote = useRemoteComputers([selectedIds[0], selectedIds[1]]);

  const compA = useMemo(() => {
    if (!mounted || !selectedIds[0]) return undefined;
    return resolveVariantSync(selectedIds[0]) ?? remote.get(selectedIds[0])?.variant;
  }, [mounted, selectedIds, remote]);
  const compB = useMemo(() => {
    if (!mounted || !selectedIds[1]) return undefined;
    return resolveVariantSync(selectedIds[1]) ?? remote.get(selectedIds[1])?.variant;
  }, [mounted, selectedIds, remote]);

  const hasA = Boolean(selectedIds[0]);
  const hasB = Boolean(selectedIds[1]);
  const bothLoaded = Boolean(compA && compB);

  const togglePriority = (id: RatingCategory) => {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleUseCase = (uc: UseCase) => {
    setUseCase(uc);
    const map: Partial<Record<UseCase, RatingCategory>> = {
      gaming: "gaming",
      programming: "programming",
      university: "university",
      editing: "editing",
      design: "design",
      battery: "battery",
      portability: "portability",
      work: "productivity",
    };
    const cat = map[uc];
    if (cat && !priorities.includes(cat)) {
      setPriorities((prev) => [...prev.slice(0, 2), cat]);
    }
  };

  // ----- Computed values (only when both computers loaded) -----
  const result = bothLoaded ? calculateComparison(compA!, compB!, useCase) : null;
  const priorityScores =
    bothLoaded
      ? (() => {
          const ratingsA = calculateRatings(compA!);
          const ratingsB = calculateRatings(compB!);
          return {
            A: priorities.reduce((sum, id) => sum + ratingsA[id].score, 0) / priorities.length,
            B: priorities.reduce((sum, id) => sum + ratingsB[id].score, 0) / priorities.length,
          };
        })()
      : null;
  const priorityWinner =
    priorityScores && priorityScores.A === priorityScores.B
      ? "tie"
      : priorityScores && priorityScores.A > priorityScores.B
      ? "A"
      : "B";

  const winnerFor = (_categoryId: string, scoreA: number, scoreB: number): "A" | "B" | "tie" => {
    if (scoreA === scoreB) return "tie";
    return scoreA > scoreB ? "A" : "B";
  };

  // ----- Loading gate (prevents hydration mismatch on localStorage reads) -----
  if (!mounted) {
    return (
      <div className="flex-1">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-lg bg-gen-card" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-40 rounded-2xl bg-gen-card" />
              <div className="h-40 rounded-2xl bg-gen-card" />
            </div>
          </div>
        </main>
        <CompareBarSpacer />
        <Footer />
      </div>
    );
  }

  const chatIds = [compA?.id, compB?.id].filter((x): x is string => Boolean(x));

  // ----- Empty state -----
  if (!hasA && !hasB) {
    return (
      <div className="flex-1">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gen-accent/10 flex items-center justify-center mb-4">
            <Scale className="w-8 h-8 text-gen-accent" />
          </div>
          <h2 className="text-xl font-semibold text-gen-fg">Nothing to compare yet</h2>
          <p className="text-sm text-gen-muted mt-2 max-w-sm">
            Pick two computers and their exact configurations to see specs, ratings and AI
            advice side by side.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={openPickerForAdd}
              className="h-10 px-5 rounded-xl bg-gen-accent text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-gen-accent-light transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add first computer
            </button>
            <Link
              href="/"
              className="h-10 px-5 rounded-xl border border-gen-border text-gen-fg text-sm font-medium inline-flex items-center gap-2 hover:bg-gen-card-hover transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse all computers
            </Link>
          </div>
        </main>
        <CompareBarSpacer />
        <Footer />
        <AddComputerPicker
          open={pickerOpen}
          onSelect={handlePickerSelect}
          onClose={closePicker}
        />
      </div>
    );
  }

  // ----- Workspace (1 or 2 computers) -----
  return (
    <div className="flex-1">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-gen-fg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <button
              onClick={clearComparison}
              className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Clear comparison
            </button>
          </div>
          {bothLoaded && (
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => toggleUseCase(uc.id)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 border cursor-pointer",
                    useCase === uc.id
                      ? "bg-gen-accent text-white border-gen-accent"
                      : "bg-gen-card text-gen-muted border-gen-border hover:text-gen-fg hover:border-gen-accent/30"
                  )}
                >
                  {uc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 1 — Computers & exact configurations */}
        <section className="mb-8">
          <SectionHeading
            icon={<ListChecks className="w-4 h-4 text-gen-accent" />}
            step={1}
            title="Computers & configurations"
            subtitle={
              bothLoaded
                ? "The exact configurations you selected. Swap, replace or remove at any time."
                : "Add a second computer to unlock the full comparison."
            }
          />
          <div className={cn("grid gap-4", hasA && hasB ? "md:grid-cols-2" : "max-w-xl")}>
            {hasA && (
              <SlotCard
                index={0}
                variant={compA}
                remoteModel={remote.get(selectedIds[0])?.model}
                otherSlotId={compB?.id}
                onRemove={() => remove(selectedIds[0])}
                onChangeConfig={(id) => replaceAt(0, id)}
                onReplace={() => openPickerForSlot(0)}
              />
            )}
            {hasB ? (
              <SlotCard
                index={1}
                variant={compB}
                remoteModel={remote.get(selectedIds[1])?.model}
                otherSlotId={compA?.id}
                onRemove={() => remove(selectedIds[1])}
                onChangeConfig={(id) => replaceAt(1, id)}
                onReplace={() => openPickerForSlot(1)}
              />
            ) : (
              <button
                onClick={openPickerForAdd}
                className="min-h-[220px] rounded-2xl border-2 border-dashed border-gen-border hover:border-gen-accent/40 bg-gen-card/50 transition-all duration-200 flex flex-col items-center justify-center gap-2 text-gen-muted hover:text-gen-fg cursor-pointer group"
              >
                <span className="w-12 h-12 rounded-2xl bg-gen-accent/10 group-hover:bg-gen-accent/20 flex items-center justify-center transition-colors">
                  <Plus className="w-6 h-6 text-gen-accent" />
                </span>
                <span className="text-sm font-medium">Add second computer</span>
                <span className="text-xs">Search by name, brand, CPU or GPU</span>
              </button>
            )}
          </div>
        </section>

        {bothLoaded && result && priorityScores && (
          <>
            {/* Overall score strip */}
            <section className="mb-8">
              <Card className="p-5">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                  <div className="text-center min-w-0">
                    <div className="flex justify-center mb-2">
                      <ProductImage
                        src={resolveVariantImageUrl(compA!)}
                        brand={compA!.brand}
                        name={compA!.name}
                        size="sm"
                      />
                    </div>
                    <p className="text-sm font-semibold text-gen-fg mb-1">
                      {compA!.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    {/* Animated progress bar */}
                    <div className="w-full h-3 rounded-full bg-gen-card-hover overflow-hidden mb-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 ease-out",
                          result.overallWinner === "A" ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${result.scoreA}%` }}
                      />
                    </div>
                    <p className={cn("text-3xl font-black", getScoreColor(result.scoreA))}>
                      {result.scoreA}
                    </p>
                    <p className="text-[10px] text-gen-muted mt-0.5">Overall Score</p>
                    {result.overallWinner === "A" && (
                      <Badge variant="success" className="mt-2">
                        <Trophy className="w-3 h-3 mr-1" />
                        Winner
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center px-2 sm:px-6 py-3 rounded-2xl bg-gen-accent/5 border border-gen-border/50">
                    <Scale className="w-6 h-6 text-gen-accent mb-1" />
                    <span className="text-sm font-bold text-gen-fg">VS</span>
                    <span className="text-[10px] text-gen-muted text-center mt-0.5 max-w-24">
                      {CATEGORY_LABELS[compA!.category]}
                    </span>
                  </div>

                  <div className="text-center min-w-0">
                    <div className="flex justify-center mb-2">
                      <ProductImage
                        src={resolveVariantImageUrl(compB!)}
                        brand={compB!.brand}
                        name={compB!.name}
                        size="sm"
                      />
                    </div>
                    <p className="text-sm font-semibold text-gen-fg mb-1">
                      {compB!.name.split(" ").slice(0, 3).join(" ")}
                    </p>
                    {/* Animated progress bar */}
                    <div className="w-full h-3 rounded-full bg-gen-card-hover overflow-hidden mb-1">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-1000 ease-out",
                          result.overallWinner === "B" ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{ width: `${result.scoreB}%` }}
                      />
                    </div>
                    <p className={cn("text-3xl font-black", getScoreColor(result.scoreB))}>
                      {result.scoreB}
                    </p>
                    <p className="text-[10px] text-gen-muted mt-0.5">Overall Score</p>
                    {result.overallWinner === "B" && (
                      <Badge variant="success" className="mt-2">
                        <Trophy className="w-3 h-3 mr-1" />
                        Winner
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            </section>

            {/* Pros & Cons Highlights */}
            <section className="mb-8">
              <SectionHeading
                icon={<Trophy className="w-4 h-4 text-gen-accent" />}
                title="Highlights & Trade-offs"
                subtitle="Key strengths and considerations for each computer."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([compA, compB] as const).map((comp, idx) => {
                  const ratings = calculateRatings(comp!);
                  const letter = idx === 0 ? "A" : "B";

                  // Auto-detect pros (score >= 80) and cons (score < 55)
                  const pros = RATING_DEFINITIONS
                    .filter((d) => ratings[d.id].score >= 80)
                    .sort((a, b) => ratings[b.id].score - ratings[a.id].score)
                    .slice(0, 4);
                  const cons = RATING_DEFINITIONS
                    .filter((d) => ratings[d.id].score < 55)
                    .sort((a, b) => ratings[a.id].score - ratings[b.id].score)
                    .slice(0, 3);

                  return (
                    <Card key={letter} className="overflow-hidden">
                      <div className="p-4 border-b border-gen-border">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Computer {letter}</Badge>
                          <span className="text-sm font-semibold text-gen-fg truncate">
                            {comp!.name}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-gen-fg mt-1">
                          {formatPrice(comp!.price)}
                        </p>
                      </div>
                      <div className="p-4 space-y-3">
                        {pros.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">
                              Strengths
                            </p>
                            <ul className="space-y-1">
                              {pros.map((d) => (
                                <li key={d.id} className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="text-gen-fg">
                                    {d.icon} {d.label}
                                  </span>
                                  <span className="text-emerald-500 font-bold ml-auto">
                                    {ratings[d.id].score}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {cons.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">
                              Considerations
                            </p>
                            <ul className="space-y-1">
                              {cons.map((d) => (
                                <li key={d.id} className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                  <span className="text-gen-fg">
                                    {d.icon} {d.label}
                                  </span>
                                  <span className="text-amber-500 font-bold ml-auto">
                                    {ratings[d.id].score}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {pros.length === 0 && cons.length === 0 && (
                          <p className="text-xs text-gen-muted text-center py-2">
                            Well-balanced across all categories.
                          </p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Section 2 — Specification comparison */}
            <section className="mb-8">
              <SectionHeading
                step={2}
                title="Specification comparison"
                subtitle="Exact configuration specs side by side. ▲ highlights the better value in each row."
              />
              <SpecComparison computerA={compA!} computerB={compB!} />
            </section>

            {/* Section 3 — Multi-criteria ratings & recommendation */}
            <section className="mb-8">
              <SectionHeading
                icon={<Star className="w-4 h-4 text-gen-accent" />}
                step={3}
                title="Multi-criteria ratings"
                subtitle="Scores are calculated from actual specifications. Pick your priorities for a personalized recommendation."
              />
              <Card className="overflow-hidden">
                <div className="p-4 border-b border-gen-border">
                  <p className="text-[11px] font-semibold text-gen-muted uppercase tracking-wider mb-2">
                    Your priorities (select up to 3)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RATING_DEFINITIONS.map((def) => {
                      const active = priorities.includes(def.id);
                      const disabled = !active && priorities.length >= 3;
                      return (
                        <button
                          key={def.id}
                          onClick={() => togglePriority(def.id)}
                          disabled={disabled}
                          className={cn(
                            "h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 border",
                            active
                              ? "bg-gen-accent text-white border-gen-accent"
                              : disabled
                              ? "bg-gen-card text-gen-muted/40 border-gen-border cursor-not-allowed"
                              : "bg-gen-card text-gen-muted border-gen-border hover:text-gen-fg hover:border-gen-accent/30 cursor-pointer"
                          )}
                        >
                          {def.icon} {def.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {priorityWinner !== "tie" && (
                  <div className="p-4 border-b border-gen-border bg-gen-accent/5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-gen-fg">
                          <Trophy className="w-4 h-4 inline text-gen-accent mr-1.5" />
                          {(priorityWinner === "A" ? compA : compB)!.name} is recommended for
                          your priorities
                        </p>
                        <p className="text-xs text-gen-muted mt-0.5">
                          Based on:{" "}
                          {priorities
                            .map(
                              (id) =>
                                `${RATING_DEFINITIONS.find((r) => r.id === id)?.icon} ${
                                  RATING_DEFINITIONS.find((r) => r.id === id)?.label
                                }`
                            )
                            .join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className={cn("text-2xl font-black", getScoreColor(priorityScores.A))}>
                            {Math.round(priorityScores.A)}
                          </p>
                          <p className="text-[10px] text-gen-muted">
                            {compA!.name.split(" ").slice(0, 2).join(" ")}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className={cn("text-2xl font-black", getScoreColor(priorityScores.B))}>
                            {Math.round(priorityScores.B)}
                          </p>
                          <p className="text-[10px] text-gen-muted">
                            {compB!.name.split(" ").slice(0, 2).join(" ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <RatingsComparison
                  computerA={compA!}
                  computerB={compB!}
                  winnerFor={winnerFor}
                />
              </Card>
            </section>

            {/* Section 4 — Score breakdown */}
            <section className="mb-8">
              <SectionHeading
                step={4}
                title="Score breakdown"
                subtitle={`Head-to-head winners for "${USE_CASES.find((u) => u.id === useCase)?.label ?? useCase}".`}
              />
              <Card className="overflow-hidden">
                <div className="divide-y divide-gen-border">
                  {result.winners.map((w) => (
                    <div key={w.key} className="grid grid-cols-3 items-center">
                      <div
                        className={cn(
                          "p-4 text-right text-sm font-semibold",
                          w.winner === "A" ? "text-emerald-500" : "text-gen-muted"
                        )}
                      >
                        {w.winner === "A" ? "🏆" : w.winner === "tie" ? "🤝" : ""} {w.a}
                      </div>
                      <div className="p-3 text-center">
                        <span className="text-xs text-gen-muted">{w.label}</span>
                      </div>
                      <div
                        className={cn(
                          "p-4 text-left text-sm font-semibold",
                          w.winner === "B" ? "text-emerald-500" : "text-gen-muted"
                        )}
                      >
                        {w.b} {w.winner === "B" ? "🏆" : w.winner === "tie" ? "🤝" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Section 5 — Gaming analysis */}
            <section className="mb-8">
              <SectionHeading
                icon={<Gamepad2 className="w-4 h-4 text-gen-accent" />}
                step={5}
                title="Gaming analysis"
                subtitle="Pick a game and see how each computer measures up. Estimates are based on GPU/CPU scores, not benchmarks."
              />
              <Card className="overflow-hidden">
                <div className="p-4">
                  <GameCompatibility computerA={compA!} computerB={compB!} />
                </div>
              </Card>
            </section>
          </>
        )}

        {/* Section 6 — Gemini AI (works with one or two computers) */}
        <section className="mb-4">
          <SectionHeading
            icon={<Sparkles className="w-4 h-4 text-gen-accent" />}
            step={bothLoaded ? 6 : 2}
            title="Ask Gemini"
            subtitle={
              bothLoaded
                ? "AI advice grounded in both exact configurations."
                : "AI advice grounded in the configuration you selected."
            }
          />
          <GeminiChatPanel computerIds={chatIds} />
        </section>
      </main>
      <CompareBarSpacer />
        <Footer />
      <AddComputerPicker
        open={pickerOpen}
        excludeIds={chatIds}
        title={pickerSlot !== null ? `Replace computer ${pickerSlot === 0 ? "A" : "B"}` : "Add a computer"}
        onSelect={handlePickerSelect}
        onClose={closePicker}
      />
    </div>
  );
}

function SectionHeading({
  icon,
  step,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  step?: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {step !== undefined && (
          <span className="h-5 min-w-5 px-1 rounded-md bg-gen-accent/15 text-gen-accent text-[10px] font-bold flex items-center justify-center">
            {step}
          </span>
        )}
        {icon}
        <h3 className="text-base font-semibold text-gen-fg">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-gen-muted mt-1 ml-0.5">{subtitle}</p>}
    </div>
  );
}

export default function ComparePage() {
  return <CompareContent />;
}
