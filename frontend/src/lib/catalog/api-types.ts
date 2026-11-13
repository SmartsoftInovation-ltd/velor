/** The storefront API's product shapes (GET /shop/products, /shop/products/:slug). */

export type ApiRef = { name: string; slug: string } | null;

export type ApiVariant = {
  _id: string;
  slug: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  /** Retail price while a flash sale puts this option on sale, else null */
  compareAtPrice: number | null;
  stock: number;
  image: string;
  /** Product detail only: the option's own photos and its size chart */
  gallery?: string[];
  sizeChartId?: string | null;
};

export type ApiSizeChart = {
  _id: string;
  name: string;
  description: string;
  columns: { label: string; unit: string }[];
  rows: { label: string; values: string[] }[];
};

export type ApiProduct = {
  _id: string;
  slug: string;
  name: string;
  description: string;
  brand: ApiRef;
  category: ApiRef;
  subcategory: ApiRef;
  image: string;
  gallery: string[];
  price: number;
  maxPrice: number;
  /** Retail price struck through on the card while a flash sale runs, else null */
  compareAtPrice: number | null;
  stock: number;
  sizes: string[];
  colors: string[];
  variants: ApiVariant[];
  sku: string;
  rating: number;
  sold: number;
  specifications: string;
  warrantyInformation: string;
  shippingInformation: string;
  createdAt: string;
  /** Product detail only: the size charts that apply, see ApiVariant.sizeChartId */
  sizeCharts?: ApiSizeChart[];
  sizeChartId?: string | null;
  /** Set on a Limited Offer entry that features one variant */
  variantId?: string | null;
};
