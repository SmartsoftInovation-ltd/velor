/**
 * What the browser keeps for one product (or one variant of it), so a cart
 * line or wishlist item can be drawn without asking the API. The prices are a
 * display copy only: checkout sends ids and quantities, and the server prices them.
 */
export type ItemSnapshot = {
  productId: string;
  variantId: string | null;
  slug: string;
  href: string;
  name: string;
  image: string;
  /** "Black / M"; empty for a product without variants */
  optionLabel: string;
  unitPrice: number;
  compareAtPrice: number | null;
  /** Units that could be bought when this was saved; refreshed on the cart page */
  maxQuantity: number;
  /** A product with variants saved without picking one: it goes to the product page, not the cart */
  needsOption: boolean;
};

export type CartLine = ItemSnapshot & {
  key: string;
  quantity: number;
  addedAt: string;
  /** Set by the cart page's refresh when the product is gone or sold out */
  unavailable?: boolean;
};

export type WishlistItem = ItemSnapshot & { key: string; savedAt: string };

export const CART_MAX_LINES = 50;
export const WISHLIST_MAX_ITEMS = 100;

/** One line per product + variant */
export const itemKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? "-"}`;

const isText = (value: unknown) => typeof value === "string";
const isCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Guards what comes back out of storage, which any script on the page could have written */
export function isSnapshot(value: unknown): value is ItemSnapshot & { key: string } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    isText(item.key) &&
    isText(item.productId) &&
    (item.variantId === null || isText(item.variantId)) &&
    isText(item.slug) &&
    isText(item.href) &&
    isText(item.name) &&
    isText(item.image) &&
    isText(item.optionLabel) &&
    isCount(item.unitPrice) &&
    (item.compareAtPrice === null || isCount(item.compareAtPrice)) &&
    isCount(item.maxQuantity) &&
    typeof item.needsOption === "boolean"
  );
}

export const isCartLine = (value: unknown): value is CartLine =>
  isSnapshot(value) && isCount((value as CartLine).quantity) && (value as CartLine).quantity >= 1;

export const isWishlistItem = (value: unknown): value is WishlistItem =>
  isSnapshot(value) && isText((value as WishlistItem).savedAt);
