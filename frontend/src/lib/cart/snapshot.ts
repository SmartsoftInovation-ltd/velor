import type { ProductVariant } from "@/lib/catalog/types";
import type { ItemSnapshot } from "./types";

/** A product's snapshot narrowed to one of its variants, as picked on the product page */
export const forVariant = (item: ItemSnapshot, v: ProductVariant): ItemSnapshot => ({
  ...item,
  variantId: v.id,
  href: `/product/${item.slug}?variant=${v.id}`,
  image: v.image || item.image,
  optionLabel: v.label === item.name ? "" : v.label,
  unitPrice: v.price,
  compareAtPrice: v.compareAtPrice ?? null,
  maxQuantity: Math.max(0, v.stock),
  needsOption: false,
});
