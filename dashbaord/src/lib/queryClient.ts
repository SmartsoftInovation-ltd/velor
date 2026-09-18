import { QueryClient, hashKey, type QueryKey } from "@tanstack/react-query";
import { getWorkspace } from "./session";

/**
 * The shared QueryClient, with every cache entry namespaced by workspace.
 *
 * Call sites write plain keys (`["orders", page]`). React Query identifies an
 * entry by the *hash* of its key, so hashing the workspace in alongside it makes
 * one store's "orders" a different entry from another store's — without touching
 * the hundreds of existing keys, and without a call site being able to forget.
 *
 * Sign-out still clears the cache; this is what keeps a single missed clear from
 * showing the previous store's rows.
 */
export const tenantQueryKeyHash = (queryKey: QueryKey): string =>
  hashKey([getWorkspace() ?? "_", ...queryKey]);

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { queryKeyHashFn: tenantQueryKeyHash },
    },
  });
