import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaPlus, FaSearch, FaTimes } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useRemoteLookup } from "../../hooks/useRemoteLookup";
import { getApiErrorMessage } from "../../utils/apiError";
import ProductPickList from "./ProductPickList";
import { type LookupProduct, pickKey, variantLabel } from "./types";

type Pick = { product: string; variant: string | null; label: string };

/**
 * Search, tick as many products or variants as needed, then add them all in
 * one go. Ticks survive a new search, so a list can be built across searches.
 */
const AddLimitedOfferForm = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const products = useRemoteLookup<LookupProduct>("limited-offer-products", "/product/getproduct", (d) =>
    d?.data?.products as LookupProduct[] | undefined,
  );
  // Insertion order is the order they are added, and so their order on the website
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map());
  const [priority, setPriority] = useState("0");

  const toggle = (product: LookupProduct, variantId: string | null) =>
    setPicks((current) => {
      const next = new Map(current);
      const key = pickKey(product._id, variantId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        const variant = product.variant?.find((v) => v._id === variantId);
        next.set(key, { product: product._id, variant: variantId, label: variant ? `${product.name} · ${variantLabel(variant)}` : product.name });
      }
      return next;
    });

  // Ticks every whole product in the current results
  const pickAllShown = () =>
    setPicks((current) => {
      const next = new Map(current);
      for (const p of products.items) next.set(pickKey(p._id), next.get(pickKey(p._id)) ?? { product: p._id, variant: null, label: p.name });
      return next;
    });

  const add = useMutation({
    mutationFn: () =>
      axiosSecure.post("/limited-offer", {
        items: [...picks.values()].map(({ product, variant }) => ({ product, variant })),
        priority: Number(priority) || 0,
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(["limited-offer"], data?.data?.items ?? []);
      toast.success(data?.message ?? "Added to Limited Offer");
      setPicks(new Map());
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not add them")),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]"
    >
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Add to Limited Offer</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Tick as many products or variants as you like, then add them together.
        </p>
      </div>

      <div className="space-y-2">
        <div className="group relative">
          <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              products.onSearchChange(e.target.value);
            }}
            placeholder="Search by name, SKU or barcode"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{products.isFetching ? "Searching…" : `${products.items.length} products`}</span>
          {products.items.length > 0 && (
            <button type="button" onClick={pickAllShown} className="font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400">
              Select all shown
            </button>
          )}
        </div>
        <ProductPickList products={products.items} isSelected={(key) => picks.has(key)} onToggle={toggle} />
      </div>

      {picks.size > 0 && (
        <div className="rounded-xl border border-accent-100 bg-accent-50/60 p-3 dark:border-accent-500/20 dark:bg-accent-500/10">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-accent-700 dark:text-accent-400">
            <span>{picks.size} selected</span>
            <button type="button" onClick={() => setPicks(new Map())} className="hover:underline">Clear</button>
          </div>
          <ul className="no-scrollbar flex max-h-28 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
            {[...picks.entries()].map(([key, pick]) => (
              <li key={key} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-accent-100 dark:bg-gray-900 dark:text-gray-300 dark:ring-accent-500/20">
                <span className="truncate">{pick.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${pick.label}`}
                  onClick={() => setPicks((c) => { const n = new Map(c); n.delete(key); return n; })}
                  className="text-gray-400 hover:text-error-500"
                >
                  <FaTimes className="size-2.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="lo-priority" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Starting priority
        </label>
        <input
          id="lo-priority"
          type="number"
          min={0}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Lower shows first. Each pick gets the next number, in the order you ticked them.
        </p>
      </div>

      <button
        type="submit"
        disabled={!picks.size || add.isPending}
        className="shine inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {add.isPending ? (
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <FaPlus className="size-3.5" />
        )}
        {picks.size > 1 ? `Add ${picks.size} to Limited Offer` : "Add to Limited Offer"}
      </button>
    </form>
  );
};

export default AddLimitedOfferForm;
