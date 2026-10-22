// Website Management → Flash Sale (backend: /flash-sale)

export type FlashSaleStatus = "running" | "scheduled" | "ended" | "off";

export interface FlashSaleSummary {
  _id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  status: FlashSaleStatus;
  itemCount: number;
  updatedAt: string;
}

/** One line of the sale as the form edits it */
export interface SaleItem {
  product: string;
  variant: string | null;
  salePrice: number;
  productName: string;
  variantLabel: string;
  image: string;
  retailPrice: number;
  stock: number;
}

export const STATUS_STYLE: Record<FlashSaleStatus, { label: string; pill: string; dot: string }> = {
  running: { label: "Running", pill: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400", dot: "bg-accent-500 animate-pulse" },
  scheduled: { label: "Scheduled", pill: "bg-blue-light-50 text-blue-light-700 ring-blue-light-500/20 dark:bg-blue-light-500/15 dark:text-blue-light-400", dot: "bg-blue-light-500" },
  ended: { label: "Ended", pill: "bg-gray-100 text-gray-600 ring-gray-500/15 dark:bg-white/5 dark:text-gray-400", dot: "bg-gray-400" },
  off: { label: "Off", pill: "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400", dot: "bg-error-500" },
};

export const percentOff = (retail: number, sale: number) =>
  retail > 0 && sale < retail ? Math.round(((retail - sale) / retail) * 100) : 0;
