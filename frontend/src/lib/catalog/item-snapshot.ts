import type { ItemSnapshot } from "@/lib/cart/types";
import type { ApiProduct, ApiVariant } from "./storefront";

// Shown until the seller uploads a product photo
export const NO_IMAGE = "/image-fallback.svg";

export const variantLabel = (v: ApiVariant) => [v.color, v.size].filter(Boolean).join(" / ") || v.name;

/**
 * What a card adds to the cart. A featured variant, or a product's only
 * variant, is that variant. A product with several variants cannot be added
 * from a card: `needsOption` sends the shopper to pick one on the product page.
 */
export function toItemSnapshot(p: ApiProduct): ItemSnapshot {
  const base = { productId: p._id, slug: p.slug, href: `/product/${p.slug}`, name: p.name, image: p.image || NO_IMAGE };
  const variant = p.variants.find((v) => v._id === p.variantId) ?? (p.variants.length === 1 ? p.variants[0] : undefined);
  if (variant) return variantSnapshot(base, variant);
  return {
    ...base,
    variantId: null,
    optionLabel: "",
    unitPrice: p.price,
    compareAtPrice: p.compareAtPrice,
    maxQuantity: Math.max(0, p.stock),
    needsOption: p.variants.length > 1,
  };
}

/**
 * What a card's Buy Now puts in the cart for a product with several variants:
 * the cheapest one in stock, which is normally the price the card shows.
 * Undefined when no choice is needed, or when every variant is sold out.
 */
export function buyNowSnapshot(p: ApiProduct): ItemSnapshot | undefined {
  const item = toItemSnapshot(p);
  if (!item.needsOption) return undefined;
  const inStock = p.variants.filter((v) => v.stock > 0);
  if (!inStock.length) return undefined;
  return variantSnapshot(item, inStock.reduce((low, v) => (v.price < low.price ? v : low)));
}

/**
 * One cart line as the shop sells it now: the product, or its variant when
 * one is named. Null when the product or the variant is no longer sold.
 */
export function currentItem(products: ApiProduct[], productId: string, variantId: string | null): ItemSnapshot | null {
  const product = products.find((p) => p._id === productId);
  if (!product) return null;
  // A product that has since gained variants cannot be bought without picking one
  if (!variantId) return product.variants.length ? null : toItemSnapshot({ ...product, variantId: null });
  const variant = product.variants.find((v) => v._id === variantId);
  return variant ? variantSnapshot(toItemSnapshot(product), variant) : null;
}

function variantSnapshot(base: Pick<ItemSnapshot, "productId" | "slug" | "name" | "image">, v: ApiVariant): ItemSnapshot {
  return {
    ...base,
    variantId: v._id,
    href: `/product/${base.slug}?variant=${v._id}`,
    image: v.image || base.image,
    // A variant with no colour or size is named after the product: no label to add
    optionLabel: variantLabel(v) === base.name ? "" : variantLabel(v),
    unitPrice: v.price,
    compareAtPrice: v.compareAtPrice,
    maxQuantity: Math.max(0, v.stock),
    needsOption: false,
  };
}
