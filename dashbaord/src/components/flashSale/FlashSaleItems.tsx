import { useState } from "react";
import { FaImage, FaTrashAlt } from "react-icons/fa";
import { percentOff, type SaleItem } from "./types";

const inputClass =
  "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm tabular-nums text-gray-800 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

/**
 * The sale's items with their sale prices. "Apply" sets every price to the
 * same % off its retail price; each price can still be typed by hand after.
 */
const FlashSaleItems = ({ items, onChange }: { items: SaleItem[]; onChange: (items: SaleItem[]) => void }) => {
  const [percent, setPercent] = useState("20");

  const applyPercent = () => {
    const p = Math.min(Math.max(Number(percent) || 0, 1), 99);
    onChange(items.map((i) => ({ ...i, salePrice: Math.round(i.retailPrice * (1 - p / 100)) })));
  };
  const setPrice = (index: number, value: string) =>
    onChange(items.map((i, n) => (n === index ? { ...i, salePrice: Number(value) || 0 } : i)));

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Sale items</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {items.length ? `${items.length} items at their sale price` : "Pick products on the left to add them."}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              aria-label="Percent off for all items"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={`${inputClass} w-16 text-center`}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">% off</span>
            <button
              type="button"
              onClick={applyPercent}
              className="h-9 rounded-lg border border-accent-100 bg-accent-50 px-3 text-sm font-semibold text-accent-600 transition hover:bg-accent-100 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
            >
              Apply to all
            </button>
          </div>
        )}
      </div>

      {items.length ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((item, index) => {
            const invalid = item.salePrice <= 0 || item.salePrice >= item.retailPrice;
            const off = percentOff(item.retailPrice, item.salePrice);
            return (
              <li key={`${item.product}:${item.variant ?? ""}`} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0 sm:flex-nowrap">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-white/5">
                  {item.image ? <img src={item.image} alt="" className="size-full object-cover" /> : <FaImage className="size-4 text-gray-300 dark:text-gray-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">{item.productName}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {item.variantLabel || "Whole product"} · {item.stock} in stock
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <p className="tabular-nums line-through">৳{item.retailPrice.toLocaleString()}</p>
                  <p className={`font-semibold ${invalid ? "text-error-600" : "text-accent-600 dark:text-accent-400"}`}>
                    {invalid ? "Not below price" : off ? `${off}% off` : "—"}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-sm text-gray-500">
                  ৳
                  <input
                    type="number"
                    min={0}
                    aria-label={`Sale price of ${item.productName}`}
                    value={item.salePrice}
                    onChange={(e) => setPrice(index, e.target.value)}
                    className={`${inputClass} w-24 ${invalid ? "border-error-300 focus:border-error-400 focus:ring-error-500/20" : ""}`}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${item.productName}`}
                  onClick={() => onChange(items.filter((_, n) => n !== index))}
                  className="inline-flex size-9 items-center justify-center rounded bg-error-50 text-error-600 transition-all hover:bg-error-100 active:scale-90 dark:bg-error-500/15 dark:text-error-400"
                >
                  <FaTrashAlt className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No items yet.
        </p>
      )}
    </section>
  );
};

export default FlashSaleItems;
