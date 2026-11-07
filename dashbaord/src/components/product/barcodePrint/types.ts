export type SourceTab = "products" | "purchases" | "variants";

export type PrinterType = "roll" | "a4";

export interface LabelSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const LABEL_SIZES: LabelSize[] = [
  { id: "38x25", label: "38 x 25 mm", widthMm: 38, heightMm: 25 },
  { id: "45x35", label: "45 x 35 mm", widthMm: 45, heightMm: 35 },
  { id: "50x25", label: "50 x 25 mm", widthMm: 50, heightMm: 25 },
  { id: "50x30", label: "50 x 30 mm", widthMm: 50, heightMm: 30 },
  { id: "50x38", label: "50 x 38 mm", widthMm: 50, heightMm: 38 },
  { id: "60x40", label: "60 x 40 mm", widthMm: 60, heightMm: 40 },
];

export interface BarcodeContentOptions {
  shopName: boolean;
  productName: boolean;
  price: boolean;
  size: boolean;
  vatIncluded: boolean; // shows "[INCL. VAT]" after price
  vatPlus: boolean; // shows "+VAT++" after price
}

export interface QueueItem {
  key: string; // unique per (product|variant)
  sourceType: "product" | "variant";
  sourceId: string;
  name: string;
  code: string; // barcode value to encode
  sku?: string;
  price: number;
  size?: string;
  color?: string;
  quantity: number;
}

// One label per unit in stock. Out-of-stock items still get one label, because
// the queue's minimum is 1 and a selected item must show up in the preview.
export const labelsForStock = (stock?: number) =>
  Math.max(1, Math.floor(stock ?? 0));

export interface ProductLite {
  _id: string;
  slug: string;
  name: string;
  sku?: string;
  barCode?: string;
  thumbnail?: { url?: string };
  retailPrice?: number;
  wholesalePrice?: number;
  size?: string;
  color?: string;
  stock?: number;
  isActive?: boolean;
}

export interface VariantLite {
  _id: string;
  slug: string;
  variantName?: string;
  sku?: string;
  barCode?: string;
  thumbnail?: { url?: string };
  retailPrice?: number;
  wholesalePrice?: number;
  size?: string;
  color?: string;
  stockVariant?: number;
  product?: { name?: string } | null;
}

export interface PurchaseAllProductItem {
  product?: ProductLite | string | null;
  variant?: VariantLite | string | null;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface PurchaseLite {
  _id: string;
  invoiceNumber: string;
  date?: string;
  createdAt?: string;
  allproduct: PurchaseAllProductItem[];
}
