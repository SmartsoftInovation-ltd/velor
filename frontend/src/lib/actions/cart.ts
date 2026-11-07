"use server";

import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { FreshItem } from "@/lib/cart/cart-store";
import { CART_MAX_LINES, itemKey } from "@/lib/cart/types";
import { currentItem } from "@/lib/catalog/item-snapshot";
import type { ApiProduct } from "@/lib/catalog/storefront";
import { callAsShopper, shopperIdentity } from "@/lib/actions/shopper-identity";
import { ApiError, apiFetch, storeHostFrom } from "@/lib/store-api";

type LineRef = { productId: string; variantId: string | null };
export type CheckoutLine = LineRef & { quantity: number };

const ID = /^[a-f0-9]{24}$/i;
const isRef = (line: LineRef) =>
  typeof line?.productId === "string" && ID.test(line.productId) && (line.variantId === null || (typeof line.variantId === "string" && ID.test(line.variantId)));

/**
 * The shop's current name, price and stock for each cart line, keyed like the
 * cart. A line the shop no longer sells comes back null. When the API cannot
 * be reached the answer is empty, so the cart keeps what it had rather than
 * flagging every line as gone.
 */
export async function refreshCartAction(lines: LineRef[]): Promise<Record<string, FreshItem | null>> {
  if (!Array.isArray(lines) || lines.length > CART_MAX_LINES || !lines.every(isRef)) return {};
  const host = storeHostFrom(await headers());
  if (!host) return {};

  let products: ApiProduct[];
  try {
    products = (await apiFetch<{ products: ApiProduct[] }>(host, "/shop/products")).products;
  } catch {
    return {};
  }

  const fresh: Record<string, FreshItem | null> = {};
  for (const { productId, variantId } of lines) {
    const now = currentItem(products, productId, variantId);
    fresh[itemKey(productId, variantId)] = now && {
      name: now.name,
      image: now.image,
      optionLabel: now.optionLabel,
      unitPrice: now.unitPrice,
      compareAtPrice: now.compareAtPrice,
      maxQuantity: now.maxQuantity,
    };
  }
  return fresh;
}

export type SaveCartResult = {
  error?: string;
  rejected?: { productId: string; variantId: string | null; reason: string; quantity?: number }[];
};

/**
 * Replaces this shopper's server cart with the browser's lines, right before
 * checkout (PUT /shop/cart). Signed in, it is saved to the account; otherwise
 * to the browser's guest id. Only ids and quantities are sent: the API prices them.
 */
export async function saveCartAction(lines: CheckoutLine[], guestId: string): Promise<SaveCartResult> {
  const valid =
    Array.isArray(lines) &&
    lines.length <= CART_MAX_LINES &&
    lines.every((line) => isRef(line) && Number.isInteger(line.quantity) && line.quantity >= 1);
  if (!valid) return { error: "Your cart could not be read. Please refresh the page." };

  const host = storeHostFrom(await headers());
  if (!host) return { error: "This shop could not be found." };

  const who = await shopperIdentity(guestId);
  if (!who) return { error: "Your cart could not be saved. Please refresh the page." };

  try {
    const body = JSON.stringify({ items: lines.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) });
    const data = await callAsShopper(host, who, (as) =>
      apiFetch<{ rejected: SaveCartResult["rejected"] }>(host, "/shop/cart", {
        method: "PUT",
        headers: { "content-type": "application/json", ...as },
        body,
      }),
    );
    return { rejected: data.rejected ?? [] };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status < 500) return { error: error.message };
    return { error: "Your cart could not be saved just now. Please try again." };
  }
}
