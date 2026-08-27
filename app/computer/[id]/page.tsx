import { notFound } from "next/navigation";
import {
  getModelById,
  findVariantById,
  findModelByVariantId,
} from "@/lib/server/database";
import { resolveModelImageUrl, resolveVariantImageUrl } from "@/lib/data/product-images";
import { CATEGORY_LABELS } from "@/lib/data/categories";
import { formatPrice } from "@/lib/utils/format";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Star, ArrowLeft, Layers, Gauge, Settings2 } from "lucide-react";
import Link from "next/link";
import { ComputerActions } from "./ComputerActions";
import { RatingsCard } from "@/components/rating/RatingsCard";
import { VariantCard } from "@/components/computer/VariantCard";
import { SpecSections } from "@/components/computer/SpecSections";
import { CompareBar, CompareBarSpacer } from "@/components/compare/CompareBar";
import { ProductImage } from "@/components/computer/ProductImage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ComputerDetailPage({ params }: PageProps) {
  const raw = (await params).id ?? "";

  // Tolerate double-encoded or oddly-cased ids from links/share copies.
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // keep raw when not decodable
  }
  id = id.trim();

  // Lookups go through the central server catalog: bundled base +
  // Supabase Cloud + local fallback. AI-discovered computers resolve here.
  const model = await getModelById(id);
  const variant = model ? undefined : await findVariantById(id);

  if (!model && !variant) notFound();

  const enrichedVariants = model
    ? (await Promise.all(model.variants.map((v) => findVariantById(v.id)))).filter(
        (v): v is NonNullable<typeof v> => Boolean(v)
      )
    : [];

  // Variant detail view
  if (variant) {
    const parentModel = model ?? (await findModelByVariantId(variant.id));
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">
          <Link
            href={parentModel ? `/computer/${parentModel.id}` : "/"}
            className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-gen-fg transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {parentModel ? `Back to ${parentModel.name}` : "Back to Search"}
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <ProductImage
              src={resolveVariantImageUrl(variant, parentModel)}
              brand={variant.brand}
              name={variant.name}
              size="lg"
            />

            <div className="flex flex-col">
              <Badge variant="accent" className="w-fit mb-3">
                {CATEGORY_LABELS[variant.category]}
              </Badge>
              <p className="text-xs text-gen-muted uppercase tracking-wider">{variant.brand}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gen-fg mt-1">{variant.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-medium text-gen-fg">{variant.rating}</span>
                </div>
                <span className="text-xs text-gen-muted">({variant.reviewCount.toLocaleString()} reviews)</span>
              </div>
              <p className="text-sm text-gen-muted mt-3 leading-relaxed">{variant.description}</p>
              <div className="mt-auto pt-4">
                <p className="text-3xl font-black text-gen-fg">{formatPrice(variant.price)}</p>
              </div>
              <ComputerActions computerId={variant.id} />
            </div>
          </div>

          <SpecSections specs={variant.specs} />

          <Card className="mt-4 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-gen-accent" />
              <h2 className="text-base font-semibold text-gen-fg">Multi-Criteria Ratings</h2>
            </div>
            <p className="text-xs text-gen-muted mb-4">
              Scores are calculated from this computer&apos;s actual specifications.
            </p>
            <RatingsCard variant={variant} />
          </Card>
        </main>
        <CompareBarSpacer />
        <Footer />
        <CompareBar />
      </div>
    );
  }

  // Model view — choose your configuration
  return (
    <div className="flex-1 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gen-muted hover:text-gen-fg transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </Link>

        {/* Model Hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ProductImage
            src={resolveModelImageUrl(model!)}
            brand={model!.brand}
            name={model!.name}
            size="lg"
          />

          <div className="flex flex-col">
            <Badge variant="accent" className="w-fit mb-3">
              {CATEGORY_LABELS[model!.category]}
            </Badge>
            <p className="text-xs text-gen-muted uppercase tracking-wider">{model!.brand}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gen-fg mt-1">{model!.name}</h1>
            <p className="text-sm text-gen-muted mt-3 leading-relaxed">{model!.description}</p>
            <div className="flex items-center gap-2 mt-4">
              <Settings2 className="w-4 h-4 text-gen-accent" />
              <span className="text-sm font-medium text-gen-fg">
                {model!.variants.length} configuration{model!.variants.length !== 1 ? "s" : ""} available
              </span>
            </div>
            <p className="text-xs text-gen-muted mt-1">
              Choose the exact configuration, then add it to a comparison or view full details.
            </p>
          </div>
        </div>

        {/* Variant Cards */}
        <div className="mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gen-accent" />
          <h2 className="text-base font-semibold text-gen-fg">Choose your configuration</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrichedVariants.map((v) => (
            <VariantCard key={v.id} variant={v} />
          ))}
        </div>
      </main>
      <CompareBarSpacer />
      <Footer />
      <CompareBar />
    </div>
  );
}
