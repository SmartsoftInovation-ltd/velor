import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axios from "axios";
import { FaSearch } from "react-icons/fa";
import axiosSecure from "../../../hooks/useAxiosSecure";
import type { PurchaseLite, QueueItem } from "./types";

interface PurchasesSourceTabProps {
  queue: QueueItem[];
  onToggle: (item: QueueItem) => void;
  onToggleMany: (items: QueueItem[], select: boolean) => void;
}

const PAGE_SIZE = 40;

const purchaseFourDigitId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return String(hash % 10000).padStart(4, "0");
};

const purchaseDisplayDate = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const purchaseHeading = (p: PurchaseLite) => {
  const id = purchaseFourDigitId(p._id);
  const date = purchaseDisplayDate(p.date || p.createdAt);
  const itemCount = p.allproduct?.length || 0;
  const dateLabel = date ? ` - ${date}` : "";
  return `PUR-${id}${dateLabel} (${itemCount} item${itemCount === 1 ? "" : "s"})`;
};

// Combined name for list rows, e.g. "Casual Full Shirt - casual2"
const purchaseItemListName = (item: PurchaseLite["allproduct"][number]) => {
  if (item.variant && typeof item.variant === "object") {
    const productName = item.variant.product?.name;
    const variantName = item.variant.variantName;
    if (productName && variantName && productName !== variantName) {
      return `${productName} - ${variantName}`;
    }
    return variantName || productName || "Variant";
  }
  if (item.product && typeof item.product === "object") {
    return item.product.name || "Product";
  }
  return "Item";
};

// Product-only name for the printed sticker (never includes variant name)
const purchaseItemStickerName = (item: PurchaseLite["allproduct"][number]) => {
  if (item.variant && typeof item.variant === "object") {
    return item.variant.product?.name || item.variant.variantName || "Variant";
  }
  if (item.product && typeof item.product === "object") {
    return item.product.name || "Product";
  }
  return "Item";
};

const purchaseItemCode = (item: PurchaseLite["allproduct"][number]) => {
  if (item.variant && typeof item.variant === "object") {
    return item.variant.barCode || item.variant.sku || item.variant._id;
  }
  if (item.product && typeof item.product === "object") {
    return item.product.barCode || item.product.sku || item.product._id;
  }
  return "";
};

const purchaseItemId = (item: PurchaseLite["allproduct"][number], index: number) => {
  if (item.variant) {
    return typeof item.variant === "object" ? item.variant._id : item.variant;
  }
  if (item.product) {
    return typeof item.product === "object" ? item.product._id : item.product;
  }
  return `idx-${index}`;
};

const PurchasesSourceTab: React.FC<PurchasesSourceTabProps> = ({
  queue,
  onToggle,
  onToggleMany,
}) => {
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [debouncedPurchaseSearch, setDebouncedPurchaseSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedPurchaseSearch(purchaseSearch),
      400
    );
    return () => clearTimeout(handler);
  }, [purchaseSearch]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedPurchaseSearch]);

  const { data: allPurchases = [], isLoading, isError } = useQuery<PurchaseLite[]>({
    queryKey: ["barcode-print-all-purchases"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/purchase/all-allpurchases");
        const raw = data?.data;
        if (Array.isArray(raw)) return raw as PurchaseLite[];
        if (Array.isArray(raw?.purchases)) return raw.purchases as PurchaseLite[];
        return [];
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const filteredPurchases = useMemo(() => {
    if (!debouncedPurchaseSearch.trim()) return allPurchases;
    const q = debouncedPurchaseSearch.toLowerCase();
    return allPurchases.filter((p) => p.invoiceNumber?.toLowerCase().includes(q));
  }, [allPurchases, debouncedPurchaseSearch]);

  const visiblePurchases = filteredPurchases.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPurchases.length;

  const rowVirtualizer = useVirtualizer({
    count: visiblePurchases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
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

  const selectedPurchase = allPurchases.find((p) => p._id === selectedPurchaseId);

  const toQueueItem = (
    item: PurchaseLite["allproduct"][number],
    index: number
  ): QueueItem => {
    const isVariant = !!item.variant;
    const sourceId = purchaseItemId(item, index);
    const nested =
      (isVariant && typeof item.variant === "object" ? item.variant : null) ||
      (!isVariant && typeof item.product === "object" ? item.product : null);
    return {
      key: `${isVariant ? "variant" : "product"}:${sourceId}`,
      sourceType: isVariant ? "variant" : "product",
      sourceId: String(sourceId),
      name: purchaseItemStickerName(item),
      code: String(purchaseItemCode(item) || sourceId),
      sku: nested?.sku,
      price: item.retailPrice ?? 0,
      size: item.size || nested?.size,
      color: item.color || nested?.color,
      quantity: item.quantity || 1,
    };
  };

  const purchaseItems = useMemo(() => {
    if (!selectedPurchase) return [];
    const q = itemSearch.trim().toLowerCase();
    return selectedPurchase.allproduct
      .map((item, index) => ({
        item,
        index,
        listName: purchaseItemListName(item),
        queueItem: toQueueItem(item, index),
      }))
      .filter(
        ({ listName, queueItem }) =>
          !q ||
          listName.toLowerCase().includes(q) ||
          queueItem.code.toLowerCase().includes(q)
      );
  }, [selectedPurchase, itemSearch]);

  const allSelected =
    purchaseItems.length > 0 &&
    purchaseItems.every(({ queueItem }) =>
      queue.some((q) => q.key === queueItem.key)
    );

  return (
    <div className="space-y-4">
      {/* Purchase picker */}
      <div className="space-y-2">
        <div className="relative group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3 group-focus-within:text-accent-500 transition-colors" />
          <input
            type="text"
            value={purchaseSearch}
            onChange={(e) => setPurchaseSearch(e.target.value)}
            placeholder="Search purchases by invoice number..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all placeholder:text-gray-400 dark:text-white"
          />
        </div>

        <div
          ref={parentRef}
          className="overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800"
          style={{ maxHeight: 220 }}
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="size-6 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-6 text-center text-xs text-red-500 font-medium">
              Failed to load purchases
            </div>
          ) : visiblePurchases.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400 font-medium">
              No purchases found
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const p = visiblePurchases[virtualRow.index];
                const selected = p._id === selectedPurchaseId;
                return (
                  <div
                    key={p._id}
                    className={`absolute top-0 left-0 w-full px-3 flex items-center justify-between cursor-pointer transition-colors ${
                      selected
                        ? "bg-accent-50 dark:bg-accent-500/15 dark:text-accent-400"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    }`}
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => {
                      setSelectedPurchaseId(p._id);
                      setItemSearch("");
                    }}
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {purchaseHeading(p)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* Items of selected purchase */}
      {selectedPurchase && (
        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Items in {purchaseHeading(selectedPurchase)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onToggleMany(
                    purchaseItems.map((p) => p.queueItem),
                    true
                  )
                }
                className="shine px-2.5 py-1 text-xs font-medium rounded-md bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() =>
                  onToggleMany(
                    purchaseItems.map((p) => p.queueItem),
                    false
                  )
                }
                className="shine px-2.5 py-1 text-xs font-medium rounded-md bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="relative group">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3 group-focus-within:text-accent-500 transition-colors" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search items in this purchase..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all placeholder:text-gray-400 dark:text-white"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {purchaseItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 font-medium">
                No items match your search
              </div>
            ) : (
              purchaseItems.map(({ listName, queueItem }) => {
                const selected = queue.some((q) => q.key === queueItem.key);
                return (
                  <div
                    key={queueItem.key}
                    onClick={() => onToggle(queueItem)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      selected
                        ? "bg-accent-50 dark:bg-accent-500/15 dark:text-accent-400"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {listName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {queueItem.code} · x{queueItem.quantity}
                        {queueItem.size ? ` [${queueItem.size}]` : ""}
                        {queueItem.color ? ` [${queueItem.color}]` : ""}
                      </p>
                    </div>
                    <span
                      className={`size-4 rounded-md border flex items-center justify-center shrink-0 ${
                        selected
                          ? "bg-accent-500 border-accent-500 text-white"
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
                );
              })
            )}
          </div>
          {allSelected && (
            <p className="text-[11px] text-green-600 font-medium">
              All items from this purchase are selected.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchasesSourceTab;
