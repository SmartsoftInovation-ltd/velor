import axiosSecure from "../../../hooks/useAxiosSecure";

const PAGE_SIZE = 200; // the most /stock/getallmultiplevariant answers at once

/**
 * Every variant in the store, one page at a time. The size stock pages group
 * variants into one row per product, so a partial list would hide items and
 * under-count the products it cut in half.
 */
export const fetchAllVariants = async <T,>(): Promise<T[]> => {
  const all: T[] = [];
  for (let page = 1; ; page += 1) {
    const res = await axiosSecure.get(`/stock/getallmultiplevariant?page=${page}&limit=${PAGE_SIZE}`);
    const raw = res.data?.data ?? {};
    const variants: T[] = Array.isArray(raw) ? raw : (raw.variants ?? []);
    all.push(...variants);
    // Not totalPages: that also counts single-variant products
    if (variants.length < PAGE_SIZE) return all;
  }
};
