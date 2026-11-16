import type { ProductDetail } from "./types";

/**
 * What the card's quick view loads on top of the card it opened from: the
 * options to pick between, and the stock and SKU as they are now.
 */
export type QuickView = Pick<ProductDetail, "sku" | "stockCount" | "variants" | "item">;

export const toQuickView = ({ sku, stockCount, variants, item }: ProductDetail): QuickView => ({
  sku,
  stockCount,
  variants,
  item,
});
