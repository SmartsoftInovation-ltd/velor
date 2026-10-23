// Shared data for the order screens: statuses, tones and small formatters.

export type OrderStatusType =
  | "Pending"
  | "Hold"
  | "Confirmed"
  | "Packaging"
  | "CourierPending"
  | "Courier"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

// In the order an order moves through them; drives the filter strip and the select
export const ORDER_STATUSES: OrderStatusType[] = [
  "Pending",
  "Hold",
  "Confirmed",
  "Packaging",
  "CourierPending",
  "Courier",
  "Shipped",
  "Delivered",
  "Cancelled",
];

export const STATUS_LABELS: Record<OrderStatusType, string> = {
  Pending: "Pending",
  Hold: "On Hold",
  Confirmed: "Confirmed",
  Packaging: "Packaging",
  CourierPending: "Courier Pending",
  Courier: "With Courier",
  Shipped: "Shipped",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};

// Soft tone per status: pill background/text/ring, plus the dot colour
export const STATUS_TONES: Record<OrderStatusType, { pill: string; dot: string }> = {
  Pending: { pill: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400", dot: "bg-warning-500" },
  Hold: { pill: "bg-gray-100 text-gray-700 ring-gray-500/20 dark:bg-white/5 dark:text-gray-300", dot: "bg-gray-500" },
  Confirmed: { pill: "bg-blue-light-50 text-blue-light-700 ring-blue-light-500/20 dark:bg-blue-light-500/15 dark:text-blue-light-400", dot: "bg-blue-light-500" },
  Packaging: { pill: "bg-theme-purple-500/10 text-theme-purple-500 ring-theme-purple-500/20 dark:bg-theme-purple-500/15", dot: "bg-theme-purple-500" },
  CourierPending: { pill: "bg-orange-50 text-orange-700 ring-orange-500/20 dark:bg-orange-500/15 dark:text-orange-400", dot: "bg-orange-500" },
  Courier: { pill: "bg-brand-50 text-brand-700 ring-brand-500/20 dark:bg-brand-500/15 dark:text-brand-400", dot: "bg-brand-500" },
  Shipped: { pill: "bg-theme-pink-500/10 text-theme-pink-500 ring-theme-pink-500/20 dark:bg-theme-pink-500/15", dot: "bg-theme-pink-500" },
  Delivered: { pill: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400", dot: "bg-accent-500" },
  Cancelled: { pill: "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400", dot: "bg-error-500" },
};

export const PILL = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

export const toneOf = (status?: string) =>
  STATUS_TONES[status as OrderStatusType] ?? STATUS_TONES.Hold;

export const taka = (value?: number | string | null) =>
  `৳${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

type ImageRef = string | { url?: string };
type CatalogRef = { _id?: string; name?: string; variantName?: string; sku?: string; image?: ImageRef | ImageRef[] };

// One line of an order, as the API stores it
export type OrderItem = {
  _id?: string;
  product?: CatalogRef | null;
  variant?: CatalogRef | null;
  quantity?: number;
  retailPrice?: number;
  totalPrice?: number;
  color?: string;
  size?: string;
};

// Product and variant images are stored as [{ url }]; older rows hold plain strings
export const imageOf = (item: OrderItem): string | null => {
  const first = (list?: ImageRef | ImageRef[]) => (Array.isArray(list) ? list[0] : list);
  const pick = first(item?.variant?.image) ?? first(item?.product?.image);
  if (!pick) return null;
  return typeof pick === "string" ? pick : (pick.url ?? null);
};

export const itemName = (item: OrderItem) =>
  item?.variant?.variantName || item?.product?.name || "Unnamed item";

export const itemSku = (item: OrderItem) => item?.variant?.sku || item?.product?.sku || "";


export const statusPillClass = (status?: string) => `${PILL} ${toneOf(status).pill}`;
