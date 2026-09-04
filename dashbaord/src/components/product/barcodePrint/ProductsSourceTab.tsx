import InfiniteSearchList from "./InfiniteSearchList";
import type { ProductLite, QueueItem } from "./types";

interface ProductsSourceTabProps {
  queue: QueueItem[];
  onToggle: (item: QueueItem) => void;
}

const ProductsSourceTab: React.FC<ProductsSourceTabProps> = ({
  queue,
  onToggle,
}) => {
  const toQueueItem = (p: ProductLite): QueueItem => ({
    key: `product:${p._id}`,
    sourceType: "product",
    sourceId: p._id,
    name: p.name,
    code: p.barCode || p.sku || p._id,
    sku: p.sku,
    price: p.retailPrice ?? 0,
    size: p.size,
    color: p.color,
    quantity: 1,
  });

  return (
    <InfiniteSearchList<ProductLite>
      queryKey="barcode-print-products"
      endpoint="/product/all-single-variant-products"
      searchPlaceholder="Filter products by name, SKU or barcode..."
      emptyLabel="No single-variant products found"
      rowHeight={64}
      maxHeight={340}
      minHeight={340}
      getKey={(p) => p._id}
      isSelected={(p) => queue.some((q) => q.key === `product:${p._id}`)}
      onSelect={(p) => onToggle(toQueueItem(p))}
      extractPage={(raw) => {
        const d = raw?.data || {};
        return {
          items: (d.products as ProductLite[]) || [],
          page: (d.page as number) || 1,
          hasNextPage: !!d.hasNextPage,
        };
      }}
      renderRow={(p, selected) => (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 h-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
              {p.thumbnail?.url ? (
                <img
                  src={p.thumbnail.url}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-gray-400">N/A</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                {p.name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {p.barCode || p.sku || "—"}
                {p.size ? ` [${p.size}]` : ""}
                {p.color ? ` [${p.color}]` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
              ৳{(p.retailPrice ?? 0).toLocaleString()}
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
      )}
    />
  );
};

export default ProductsSourceTab;
