import type { ItemSnapshot } from "@/lib/cart/types";
import type { Product } from "@/lib/product";

/**
 * A catalogue product carries the facets the shop page filters on. The home
 * page's Product stays as it is — these fields only matter once something has
 * to be filtered or sorted.
 */
export type CatalogProduct = Product & {
  categoryId: string;
  subcategoryId: string;
  colors: string[];
  sizes: string[];
  createdAt: string;
  /** Units sold so far; ranks best sellers. */
  sold?: number;
  categoryName?: string;
  /** Everything a shopper might type to find this product; see product-search.ts */
  searchText?: string;
  /** What the cart and wishlist store for this card; see lib/cart/types.ts */
  item: ItemSnapshot;
  /** What Buy Now adds when `item` still needs an option picked. */
  buyNowItem?: ItemSnapshot;
};

/** One buyable option of a product, e.g. "Navy / M", with its own price and stock. */
export type ProductVariant = {
  id: string;
  label: string;
  price: number;
  /** Retail price while this option is in a flash sale */
  compareAtPrice?: number;
  stock: number;
  image: string;
  /** The option's own photos; the page shows them when it is picked */
  gallery?: string[];
  /** The size chart that applies to this option, from ProductDetail.sizeCharts */
  sizeChartId?: string | null;
};

/** A seller's size chart: one row per size, one value per measurement column. */
export type SizeChart = {
  id: string;
  name: string;
  description: string;
  columns: { label: string; unit: string }[];
  rows: { label: string; values: string[] }[];
};

/**
 * Everything the product page needs on top of a catalogue row. Kept separate
 * because a grid of 24 cards has no use for a spec table or a review list.
 */
export type ProductDetail = CatalogProduct & {
  sku: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  gallery: { src: string; alt: string }[];
  stockCount: number;
  /** A subset of `sizes` that is currently unavailable, not a separate list. */
  soldOutSizes: string[];
  /** Highest variant price; above `price` when variants are priced differently. */
  maxPrice: number;
  variants: ProductVariant[];
  /** Every size chart a variant or the product refers to */
  sizeCharts: SizeChart[];
  /** The chart for the product as a whole (its category, brand…), if any */
  sizeChartId: string | null;
  /** For the breadcrumb; `categoryId` is the slug. */
  categoryName: string;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Subcategory = { id: string; name: string };

export type Category = {
  id: string;
  name: string;
  subcategories: Subcategory[];
};

export type ColorOption = {
  id: string;
  name: string;
  /** A fixed hex, not a token: these are product colours, not UI colours. */
  swatch: string;
};

/** The shop's filter options, built from what the store sells. */
export type Taxonomy = {
  categories: Category[];
  brands: string[];
  colors: ColorOption[];
  sizes: string[];
};

export type SortOption =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "newest";

/** How the result set is laid out. Not a filter — it changes no query. */
export type ViewMode = "grid" | "list";

/** `offer` is derived from compareAtPrice, not a field on the product. */
export type Availability = "in-stock" | "out-of-stock" | "offer";

export type ShopQuery = {
  /** Text typed into the header search. */
  q?: string;
  category?: string;
  subcategory?: string;
  brands?: string[];
  colors?: string[];
  sizes?: string[];
  availability?: Availability[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: SortOption;
  page?: number;
  view?: ViewMode;
};

/** One row of the header search's results. */
export type SearchSuggestion = Pick<
  CatalogProduct,
  "id" | "name" | "brand" | "href" | "image" | "alt" | "price" | "compareAtPrice" | "stock" | "stockCount"
> & {
  categoryName: string;
  /** The product has several options, so `price` is the lowest of them. */
  fromPrice: boolean;
};

export type SearchResult = {
  suggestions: SearchSuggestion[];
  /** Every match, of which `suggestions` is the top few. */
  total: number;
};

export type ShopResult = {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageCount: number;
};
