"use client";

import { useState } from "react";
import type { ProductDetail } from "@/lib/catalog/types";
import { ProductGallery } from "./product-gallery";
import { ProductSummary } from "./product-summary";

/**
 * The gallery and the buy column share the picked option: choosing a variant
 * shows that variant's own photos. An option with no photos of its own keeps
 * the product's gallery.
 */
export function ProductShowcase({
  product,
  discountPct,
  initialVariantId,
}: {
  product: ProductDetail;
  discountPct: number | null;
  /** From ?variant= on the URL; otherwise the first option that can be bought */
  initialVariantId?: string;
}) {
  const { variants } = product;
  const [variantId, setVariantId] = useState(
    () =>
      variants.find((v) => v.id === initialVariantId)?.id ??
      (variants.find((v) => v.stock > 0) ?? variants[0])?.id ??
      "",
  );

  const variant = variants.find((v) => v.id === variantId);
  const images = variant?.gallery?.length
    ? variant.gallery.map((src, i) => ({
        src,
        alt: i === 0 ? `${product.name}, ${variant.label}` : `${product.name}, ${variant.label}, photo ${i + 1}`,
      }))
    : product.gallery;

  return (
    <>
      {/* Keyed by option so the gallery starts again at its first photo */}
      <ProductGallery key={variant?.gallery?.length ? variantId : "product"} images={images} discountPct={discountPct} />
      <ProductSummary product={product} variantId={variantId} onVariantChange={setVariantId} />
    </>
  );
}
