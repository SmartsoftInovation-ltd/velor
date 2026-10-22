import { CATALOG_A } from "./products-a";
import { CATALOG_B } from "./products-b";
import type { CatalogProduct } from "./types";

export type CartLine = {
  id: string;
  product: Omit<CatalogProduct, "item">;
  size: string;
  color: string;
  quantity: number;
};

const ALL = [...CATALOG_A, ...CATALOG_B];

const DRAFT = [
  { id: "line-1", productId: "leather-biker-jacket", size: "M", color: "black", quantity: 1 },
  { id: "line-2", productId: "essential-tee", size: "L", color: "white", quantity: 2 },
  { id: "line-3", productId: "denim-jeans", size: "M", color: "blue", quantity: 1 },
];

/**
 * A hard-coded basket for the order-tracking design (order-fixture.ts) only.
 * The real cart lives in the browser: see lib/cart/. Lines whose id no longer
 * resolves are dropped rather than asserted away.
 */
export const CART_LINES: CartLine[] = DRAFT.flatMap((line) => {
  const product = ALL.find((item) => item.id === line.productId);
  return product ? [{ ...line, product }] : [];
});

export const SHIPPING_FLAT = 120;
export const FREE_SHIPPING_THRESHOLD = 2000;
