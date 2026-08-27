/**
 * Centralized product-image resolution.
 *
 * Priority chain (highest → lowest):
 *   1. VERIFIED_IMAGES — manually curated URLs (local files or stable CDNs)
 *   2. model.imageUrl / variant.imageUrl — field already on every record
 *   3. null — caller renders the brand-initial fallback
 *
 * HOW TO ADD AN IMAGE
 * --------------------
 * 1. Place the file in  public/computers/<slug>.jpg  (or .webp / .png).
 * 2. Add a mapping entry below:
 *      "model-id": "/computers/<slug>.jpg"
 *    Variant-specific overrides:
 *      "variant-id": "/computers/<slug>-variant.jpg"
 * 3. That's it — every card, detail page and comparison will pick it up.
 *
 * External stable URLs (e.g. manufacturer press-kit CDNs) are also fine.
 * Avoid hotlinking retailer pages that may block or restructure.
 */
import type { ComputerModel, ComputerVariant } from "./types";

const VERIFIED_IMAGES: Record<string, string> = {};

function hasOwn(obj: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function resolveVariantImageUrl(
  variant: ComputerVariant,
  model?: ComputerModel | null,
): string | null {
  if (hasOwn(VERIFIED_IMAGES, variant.id)) return VERIFIED_IMAGES[variant.id];
  if (variant.imageUrl) return variant.imageUrl;
  if (model) {
    if (hasOwn(VERIFIED_IMAGES, model.id)) return VERIFIED_IMAGES[model.id];
    if (model.imageUrl) return model.imageUrl;
  }
  return null;
}

export function resolveModelImageUrl(model: ComputerModel): string | null {
  if (hasOwn(VERIFIED_IMAGES, model.id)) return VERIFIED_IMAGES[model.id];
  if (model.imageUrl) return model.imageUrl;
  return null;
}
