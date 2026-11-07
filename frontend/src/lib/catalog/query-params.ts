import { MAX_SEARCH_LENGTH } from "./product-search";
import type { Availability, ShopQuery, SortOption } from "./types";

const SORTS: SortOption[] = [
  "relevance",
  "price-asc",
  "price-desc",
  "rating",
  "newest",
];

export type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw ? raw.split(",").filter(Boolean) : undefined;
}

const AVAILABILITY: Availability[] = ["in-stock", "out-of-stock", "offer"];

function availabilityList(value: string | string[] | undefined) {
  const parsed = list(value)?.filter((item): item is Availability =>
    AVAILABILITY.includes(item as Availability),
  );
  return parsed?.length ? parsed : undefined;
}

function num(value: string | string[] | undefined) {
  const parsed = Number(one(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Every value arrives from the URL, so nothing here is trusted. */
export function parseShopQuery(params: RawParams): ShopQuery {
  const sort = one(params.sort);
  const view = one(params.view);

  return {
    q: one(params.q)?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    category: one(params.category),
    subcategory: one(params.subcategory),
    brands: list(params.brands),
    colors: list(params.colors),
    sizes: list(params.sizes),
    availability: availabilityList(params.availability),
    minPrice: num(params.minPrice),
    maxPrice: num(params.maxPrice),
    minRating: num(params.rating),
    sort: SORTS.includes(sort as SortOption) ? (sort as SortOption) : "relevance",
    page: num(params.page),
    view: view === "list" ? "list" : "grid",
  };
}

/** Builds the href for a filter control: current state plus one change. */
export function buildShopHref(query: ShopQuery, patch: Partial<ShopQuery>): string {
  const next = { ...query, ...patch };
  const search = new URLSearchParams();

  if (next.q) search.set("q", next.q);
  if (next.category) search.set("category", next.category);
  if (next.subcategory) search.set("subcategory", next.subcategory);
  if (next.brands?.length) search.set("brands", next.brands.join(","));
  if (next.colors?.length) search.set("colors", next.colors.join(","));
  if (next.sizes?.length) search.set("sizes", next.sizes.join(","));
  if (next.availability?.length)
    search.set("availability", next.availability.join(","));
  if (next.minPrice !== undefined) search.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== undefined) search.set("maxPrice", String(next.maxPrice));
  if (next.minRating !== undefined) search.set("rating", String(next.minRating));
  if (next.sort && next.sort !== "relevance") search.set("sort", next.sort);
  if (next.view === "list") search.set("view", "list");
  // Any filter change resets paging: page 4 of the old result set is
  // meaningless against the new one.
  if (next.page && next.page > 1 && !hasFilterChange(patch)) {
    search.set("page", String(next.page));
  }

  const qs = search.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

function hasFilterChange(patch: Partial<ShopQuery>) {
  // `view` only relayouts the page it is on, so it must not reset paging.
  return Object.keys(patch).some((key) => key !== "page" && key !== "view");
}

/** Toggles one value inside a multi-select facet. */
export function toggleValue<T extends string>(
  current: T[] | undefined,
  value: T,
): T[] | undefined {
  const set = new Set(current ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return set.size ? [...set] : undefined;
}
