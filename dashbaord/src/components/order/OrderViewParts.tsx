import type { ReactNode } from "react";
import ImageWithFallback from "../common/ImageWithFallback";
import { imageOf, itemName, itemSku, taka, type OrderItem } from "../tables/OrderTable/orderMeta";

// A titled card for one block of the order detail screen
export const Section = ({ title, icon, action, children }: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.03]">
    <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-white/[0.05]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
        {icon ? <span className="flex size-7 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">{icon}</span> : null}
        {title}
      </h2>
      {action}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

// Label / value rows; an empty value shows a dash so gaps stay visible
export const Field = ({ label, value, mono = false }: { label: string; value?: ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className={`min-w-0 break-words text-right text-gray-800 dark:text-white/90 ${mono ? "font-mono text-xs" : ""}`}>
      {value === undefined || value === null || value === "" ? <span className="text-gray-300 dark:text-gray-600">—</span> : value}
    </dd>
  </div>
);

export const ItemsTable = ({ items = [] }: { items?: OrderItem[] }) => (
  <div className="-mx-5 -mt-5 overflow-x-auto">
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-theme-xs uppercase tracking-wider text-gray-500 dark:border-white/[0.05] dark:text-gray-400">
          <th className="px-5 py-3 font-medium">Product</th>
          <th className="px-3 py-3 font-medium">Variant</th>
          <th className="px-3 py-3 text-right font-medium">Qty × Price</th>
          <th className="px-5 py-3 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
        {items.map((item, index) => (
          <tr key={item._id ?? index}>
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  <ImageWithFallback
                    src={imageOf(item)}
                    alt={itemName(item)}
                    className="size-full object-cover"
                    fallbackClassName="flex size-full items-center justify-center text-gray-400"
                    iconClassName="size-5"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800 dark:text-white/90">{itemName(item)}</p>
                  {itemSku(item) ? <p className="font-mono text-[11px] text-gray-400">SKU {itemSku(item)}</p> : null}
                </div>
              </div>
            </td>
            <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
              {[item.color, item.size].filter(Boolean).join(" / ") || "—"}
            </td>
            <td className="px-3 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-400">
              {item.quantity} × {taka(item.retailPrice)}
            </td>
            <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-white/90">
              {taka(item.totalPrice)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Subtotal down to what the customer pays
export const Totals = ({ subtotal, discount, couponCode, delivery, deliveryName, final }: {
  subtotal: number;
  discount: number;
  couponCode?: string;
  delivery: number;
  deliveryName?: string;
  final: number;
}) => (
  <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 border-t border-gray-100 pt-4 text-sm dark:border-white/[0.05]">
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">Subtotal</dt>
      <dd className="tabular-nums text-gray-800 dark:text-white/90">{taka(subtotal)}</dd>
    </div>
    {discount ? (
      <div className="flex justify-between">
        <dt className="text-gray-500 dark:text-gray-400">
          Discount{couponCode ? <span className="ml-1.5 rounded bg-accent-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{couponCode}</span> : null}
        </dt>
        <dd className="tabular-nums text-error-600 dark:text-error-400">−{taka(discount)}</dd>
      </div>
    ) : null}
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-gray-400">Delivery{deliveryName ? ` · ${deliveryName}` : ""}</dt>
      <dd className="tabular-nums text-gray-800 dark:text-white/90">{delivery ? `+${taka(delivery)}` : "Free"}</dd>
    </div>
    <div className="flex items-baseline justify-between border-t border-gray-100 pt-2.5 dark:border-white/[0.05]">
      <dt className="font-semibold text-gray-800 dark:text-white/90">Total</dt>
      <dd className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{taka(final)}</dd>
    </div>
  </dl>
);
