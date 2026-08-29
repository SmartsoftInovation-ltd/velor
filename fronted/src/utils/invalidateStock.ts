import type { QueryClient } from "@tanstack/react-query";

// Every query key that reads product/variant stock. Anything that moves stock
// (a sale, a sale order, a return, an adjustment) must invalidate all of them —
// otherwise a stock page opened afterwards serves counts from before the sale.
const STOCK_QUERY_KEYS = [
  "category-stock",
  "size-color-stock-v4",
  "size-color-search",
  "size-wise-stock-v2",
  "size-wise-search",
  "low-stock",
] as const;

export const invalidateStockQueries = (queryClient: QueryClient): void => {
  STOCK_QUERY_KEYS.forEach((key) =>
    queryClient.invalidateQueries({ queryKey: [key] })
  );
};
