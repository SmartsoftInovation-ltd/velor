import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axios from "axios";
import { FaSearch } from "react-icons/fa";
import axiosSecure from "../../../hooks/useAxiosSecure";
import type { QueueItem, VariantLite } from "./types";

interface VariantsSourceTabProps {
  queue: QueueItem[];
  onToggle: (item: QueueItem) => void;
}

const PAGE_SIZE = 40;

const VariantsSourceTab: React.FC<VariantsSourceTabProps> = ({
  queue,
  onToggle,
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch]);

  const { data: allVariants = [], isLoading, isError } = useQuery<VariantLite[]>({
    queryKey: ["barcode-print-all-variants"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/variant");
        return (data?.data?.variants || []) as VariantLite[];
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return allVariants;
    const q = debouncedSearch.toLowerCase();
    return allVariants.filter((v) => {
      const name = (v.variantName || v.product?.name || "").toLowerCase();
      const code = (v.barCode || v.sku || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [allVariants, debouncedSearch]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const variantDisplayName = (v: VariantLite) => {
    const productName = v.product?.name;
    const variantName = v.variantName;
    if (productName && variantName && productName !== variantName) {
      return `${productName} - ${variantName}`;
    }
    return variantName || productName || "Variant";
  };

  const toQueueItem = (v: VariantLite): QueueItem => ({
    key: `variant:${v._id}`,
    sourceType: "variant",
    sourceId: v._id,
    name: v.product?.name || v.variantName || "Variant",
    code: v.barCode || v.sku || v._id,
    sku: v.sku,
    price: v.retailPrice ?? 0,
    size: v.size,
    color: v.color,
    quantity: 1,
  });

  return (
    <div className="space-y-2">
      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter variants by name, SKU or barcode..."
          className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-gray-400 dark:text-white"
        />
      </div>

      <div
        ref={parentRef}
        className="overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800"
        style={{ maxHeight: 340, minHeight: 340 }}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="size-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-xs text-red-500 font-medium">
            Failed to load variants
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 font-medium">
            No variants found
          </div>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const v = visible[virtualRow.index];
              const selected = queue.some((q) => q.key === `variant:${v._id}`);
              return (
                <div
                  key={v._id}
                  className={`absolute top-0 left-0 w-full cursor-pointer transition-colors ${
                    selected
                      ? "bg-brand-50 dark:bg-brand-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onToggle(toQueueItem(v))}
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 h-full">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                        {v.thumbnail?.url ? (
                          <img
                            src={v.thumbnail.url}
                            alt={v.variantName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">N/A</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                          {variantDisplayName(v)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {v.barCode || v.sku || "—"}
                          {v.size ? ` [${v.size}]` : ""}
                          {v.color ? ` [${v.color}]` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                        ৳{(v.retailPrice ?? 0).toLocaleString()}
                      </span>
                      <span
                        className={`size-4 rounded-md border flex items-center justify-center ${
                          selected
                            ? "bg-brand-500 border-brand-500 text-white"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selected && (
                          <svg
                            viewBox="0 0 14 14"
                            className="size-2.5"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
};

export default VariantsSourceTab;
