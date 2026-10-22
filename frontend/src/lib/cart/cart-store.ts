import { CART_MAX_LINES, itemKey, type CartLine, type ItemSnapshot } from "./types";

/**
 * The cart's rules as pure functions over the list of lines. The React hook
 * calls these and writes the result; nothing here touches storage.
 */

export type AddResult = "added" | "increased" | "capped" | "full" | "unavailable";

const clamp = (quantity: number, max: number) => Math.max(1, Math.min(Math.floor(quantity), max));

export function addLine(lines: CartLine[], item: ItemSnapshot, quantity: number, now = new Date()) {
  if (item.needsOption || item.maxQuantity < 1) return { lines, result: "unavailable" as AddResult };

  const key = itemKey(item.productId, item.variantId);
  const existing = lines.find((line) => line.key === key);

  if (existing) {
    const wanted = existing.quantity + quantity;
    const next = clamp(wanted, item.maxQuantity);
    const result: AddResult = next < wanted ? "capped" : "increased";
    // The newer snapshot wins: it was read from the page just now
    const updated = { ...existing, ...item, key, quantity: next, unavailable: false };
    return { lines: lines.map((line) => (line.key === key ? updated : line)), result };
  }

  if (lines.length >= CART_MAX_LINES) return { lines, result: "full" as AddResult };

  const next = clamp(quantity, item.maxQuantity);
  const line: CartLine = { ...item, key, quantity: next, addedAt: now.toISOString() };
  return { lines: [...lines, line], result: (next < quantity ? "capped" : "added") as AddResult };
}

export const setQuantity = (lines: CartLine[], key: string, quantity: number) =>
  lines.map((line) => (line.key === key ? { ...line, quantity: clamp(quantity, Math.max(1, line.maxQuantity)) } : line));

export const removeLine = (lines: CartLine[], key: string) => lines.filter((line) => line.key !== key);

/** Count, subtotal and savings of the lines that can still be bought */
export function cartTotals(lines: CartLine[]) {
  let count = 0;
  let subtotal = 0;
  let saved = 0;
  for (const line of lines) {
    if (line.unavailable) continue;
    count += line.quantity;
    subtotal += line.unitPrice * line.quantity;
    if (line.compareAtPrice && line.compareAtPrice > line.unitPrice) {
      saved += (line.compareAtPrice - line.unitPrice) * line.quantity;
    }
  }
  return { count, subtotal, saved };
}

/** What the API says about a line now; null when the product or variant is gone */
export type FreshItem = Pick<ItemSnapshot, "name" | "image" | "unitPrice" | "compareAtPrice" | "maxQuantity" | "optionLabel">;

/**
 * Brings each line up to date with the shop: price, name, stock. A line the
 * shop no longer sells, or has none of, is kept and flagged so the shopper
 * sees what happened; a quantity above the stock is lowered to it.
 */
export function refreshLines(lines: CartLine[], fresh: Record<string, FreshItem | null>) {
  return lines.map((line) => {
    if (!(line.key in fresh)) return line;
    const now = fresh[line.key];
    if (!now || now.maxQuantity < 1) return { ...line, unavailable: true };
    return { ...line, ...now, quantity: clamp(line.quantity, now.maxQuantity), unavailable: false };
  });
}

/** Ids and quantities only: what checkout sends to the API */
export const checkoutItems = (lines: CartLine[]) =>
  lines
    .filter((line) => !line.unavailable)
    .map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity }));
