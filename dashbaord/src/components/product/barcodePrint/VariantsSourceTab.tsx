import InfiniteSearchList from "./InfiniteSearchList";
import { labelsForStock } from "./types";
import type { QueueItem, VariantLite } from "./types";

interface VariantsSourceTabProps {
  queue: QueueItem[];
  onToggle: (item: QueueItem) => void;
}

// Pages of variants searched on the server (by a word of the name, or a
// barcode / sku). Loading every variant to filter here ran the API out of
// memory on a large shop (BUG-P2-010).
const VariantsSourceTab: React.FC<VariantsSourceTabProps> = ({
  queue,
  onToggle,
}) => {
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
    quantity: labelsForStock(v.stockVariant),
  });

  return (
    <InfiniteSearchList<VariantLite>
      queryKey="barcode-print-variants"
      endpoint="/variant"
      searchPlaceholder="Filter variants by name, SKU or barcode..."
      emptyLabel="No variants found"
      rowHeight={64}
      maxHeight={340}
      minHeight={340}
      getKey={(v) => v._id}
      isSelected={(v) => queue.some((q) => q.key === `variant:${v._id}`)}
      onSelect={(v) => onToggle(toQueueItem(v))}
      extractPage={(raw) => {
        const d = raw?.data || {};
        return {
          items: (d.variants as VariantLite[]) || [],
          page: (d.page as number) || 1,
          hasNextPage: !!d.hasNextPage,
        };
      }}
      renderRow={(v, selected) => (
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
            <span className="text-sm font-semibold text-accent-600 dark:text-accent-400">
              ৳{(v.retailPrice ?? 0).toLocaleString()}
            </span>
            <span
              className={`size-4 rounded-md border flex items-center justify-center ${
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
        </div>
      )}
    />
  );
};

export default VariantsSourceTab;
