import ImageWithFallback from "../../common/ImageWithFallback";
import { imageOf, itemName, itemSku, taka, type OrderItem } from "./orderMeta";

const Thumb = ({ item, className = "" }: { item: OrderItem; className?: string }) => (
  <span className={`relative inline-block size-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-2 ring-white dark:bg-gray-800 dark:ring-gray-900 ${className}`}>
    <ImageWithFallback
      src={imageOf(item)}
      alt={itemName(item)}
      className="size-full object-cover"
      fallbackClassName="flex size-full items-center justify-center text-gray-400"
      iconClassName="size-4"
    />
  </span>
);

/** Overlapping thumbnails, the first item's name and the unit count */
export const OrderItemStack = ({
  items = [],
  expanded,
  onToggle,
}: {
  items?: OrderItem[];
  expanded: boolean;
  onToggle: () => void;
}) => {
  if (!items.length) return <span className="text-xs italic text-gray-400">No items</span>;
  const units = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="group/items flex w-full min-w-0 items-center gap-3 rounded-lg p-1 text-left transition hover:bg-gray-100 dark:hover:bg-white/5"
    >
      <span className="flex shrink-0 -space-x-3">
        {items.slice(0, 3).map((item, index) => (
          <Thumb key={item._id ?? index} item={item} />
        ))}
        {items.length > 3 ? (
          <span className="relative inline-flex size-10 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white ring-2 ring-white dark:bg-white/15 dark:ring-gray-900">
            +{items.length - 3}
          </span>
        ) : null}
      </span>
      <span className="w-full min-w-0">
        <span className="block truncate text-sm font-medium text-gray-800 dark:text-white/90">
          {itemName(items[0])}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {items.length} {items.length === 1 ? "line" : "lines"} · {units} {units === 1 ? "unit" : "units"}
          <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </button>
  );
};

/** Every line of the order, for the expanded row */
export const OrderItemDetails = ({ items = [] }: { items?: OrderItem[] }) => (
  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((item, index) => (
      <li
        key={item._id ?? index}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]"
      >
        <Thumb item={item} className="!ring-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{itemName(item)}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[item.color, item.size].filter(Boolean).join(" / ") || "No variant"}
            {itemSku(item) ? <span className="ml-1.5 font-mono text-[11px] text-gray-400">· {itemSku(item)}</span> : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {item.quantity} × {taka(item.retailPrice)}
          </p>
          <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white/90">{taka(item.totalPrice)}</p>
        </div>
      </li>
    ))}
  </ul>
);
