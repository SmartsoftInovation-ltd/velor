import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axiosSecure from "./useAxiosSecure";
import useDebounce from "./useDebounce";

/**
 * Options for a dropdown searched on the server (BUG-P2-010).
 *
 * The list endpoints answer one page (at most 100 rows), so a dropdown can no
 * longer load a whole collection and filter it in the browser. It shows the
 * first matches, asks the server again as the user types (debounced), and
 * keeps the item that was picked so its label stays shown after the options
 * change.
 *
 *   const products = useRemoteLookup("report-products", "/product/getproduct", (d) => d.data.products);
 *   <SearchableSelect options={...products.items} onSearchChange={products.onSearchChange}
 *     onChange={(v) => { products.remember(v); ... }} />
 */
export interface LookupItem {
  _id: string;
}

export function useRemoteLookup<T extends LookupItem>(
  key: string,
  endpoint: string,
  extract: (body: { data?: Record<string, unknown> } | undefined) => T[] | undefined,
  { params = {}, limit = 50, enabled = true }: { params?: Record<string, unknown>; limit?: number; enabled?: boolean } = {},
) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 300);
  const [picked, setPicked] = useState<T | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: [key, endpoint, debounced, params],
    queryFn: async () => {
      const { data: body } = await axiosSecure.get(endpoint, {
        params: { ...params, limit, search: debounced || undefined },
      });
      return extract(body) ?? [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // The picked item stays among the options even when a search moves past it
  const items = useMemo(() => {
    const list = data ?? [];
    return picked && !list.some((item) => item._id === picked._id) ? [picked, ...list] : list;
  }, [data, picked]);

  // Call with the chosen id (or "" to clear)
  const remember = useCallback(
    (id: string) => setPicked(id ? (items.find((item) => item._id === id) ?? null) : null),
    [items],
  );

  // Show a known item as picked, e.g. the saved value of a form being edited
  const select = useCallback((item: T | null) => setPicked(item), []);

  return { items, onSearchChange: setSearch, remember, select, isFetching };
}

export default useRemoteLookup;
