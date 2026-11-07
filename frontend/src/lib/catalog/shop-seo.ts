import { buildShopHref } from "./query-params";
import type { ShopQuery, Taxonomy } from "./types";

/**
 * How one /shop URL presents itself to search engines. A category, a subcategory
 * or one brand is a page people search for, so it gets its own title and may be
 * indexed. Every other filter, sort or search is a variation of those: it stays
 * out of the index, but its links are followed, and it names the plain page as
 * canonical. Otherwise a few filters multiply into thousands of near-copies.
 */
export function shopPageSeo(query: ShopQuery, { categories }: Taxonomy, total: number, pageCount: number, storeName: string) {
  const category = categories.find((item) => item.id === query.category);
  const subcategory = category?.subcategories.find((item) => item.id === query.subcategory);
  const brand = query.brands?.length === 1 ? query.brands[0] : undefined;
  const page = query.page && query.page > 1 ? query.page : undefined;

  const section = subcategory?.name ?? category?.name;
  const label = [brand, section].filter(Boolean).join(" ");
  const pageSuffix = page ? ` - Page ${page}` : "";
  const products = `${total} ${total === 1 ? "product" : "products"}`;

  const refined =
    Boolean(query.q) ||
    (query.brands?.length ?? 0) > 1 ||
    Boolean(query.colors?.length || query.sizes?.length || query.availability?.length) ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.minRating !== undefined ||
    (query.sort !== undefined && query.sort !== "relevance") ||
    query.view === "list";
  const pastTheEnd = (page ?? 1) > pageCount;

  return {
    title: query.q ? `Results for “${query.q}”` : `${label || "Shop"}${pageSuffix}`,
    description: label
      ? `Shop ${label} at ${storeName}. Browse ${products}.`
      : `Browse ${products} at ${storeName}.`,
    indexable: !refined && total > 0 && !pastTheEnd,
    canonical: buildShopHref(
      {
        category: category?.id,
        subcategory: subcategory?.id,
        brands: brand ? [brand] : undefined,
        page: refined || pastTheEnd ? undefined : page,
      },
      {},
    ),
  };
}
