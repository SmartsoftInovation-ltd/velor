import { buildShopHref } from "./query-params";
import { buildTaxonomy, type ApiProduct } from "./storefront";

const STATIC_PATHS = ["/", "/shop", "/shop/new-arrivals", "/shop/offers", "/track-order"];

// Next writes these into the XML unescaped, and one bare "&" invalidates the whole file
const xmlSafe = (url: string) => url.replace(/&/g, "&amp;");

/**
 * Every page of a store worth finding. `lastModified` is left out because the
 * API sends only createdAt, and a date that never moves teaches crawlers to
 * ignore it.
 */
export function buildSitemap(origin: string, products: ApiProduct[]) {
  const { categories, brands } = buildTaxonomy(products);

  const listings = [
    ...categories.flatMap((category) => [
      buildShopHref({ category: category.id }, {}),
      ...category.subcategories.map((sub) => buildShopHref({ category: category.id, subcategory: sub.id }, {})),
    ]),
    ...brands.map((brand) => buildShopHref({ brands: [brand] }, {})),
  ];

  return [
    ...[...STATIC_PATHS, ...listings].map((path) => ({ url: xmlSafe(`${origin}${path}`) })),
    ...products.map((product) => ({
      url: xmlSafe(`${origin}/product/${product.slug}`),
      images: product.gallery.filter((src) => /^https?:\/\//.test(src)).slice(0, 5).map(xmlSafe),
    })),
  ];
}
