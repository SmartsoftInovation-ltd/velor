import type { CatalogProduct, SearchResult, SearchSuggestion } from "./types";

/**
 * Text search over the store's catalogue. Pure, so the header's suggestions and
 * the /shop?q= results share one definition of a match and their counts agree.
 */

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 80;
export const SUGGESTION_LIMIT = 6;

const normalise = (text: string) => text.toLowerCase().trim();
const tokensOf = (term: string) => normalise(term).split(/\s+/).filter(Boolean);

/** Every word typed must appear somewhere, in any order: "shirt nike" finds "Nike Polo Shirt". */
export function matchesSearch(product: CatalogProduct, term: string) {
  const text = normalise(product.searchText ?? `${product.name} ${product.brand}`);
  return tokensOf(term).every((token) => text.includes(token));
}

// Lower is better: whole name, name start, a word in the name, the name at all, anything else
function nameScore(name: string, term: string) {
  const wanted = normalise(term);
  const candidate = normalise(name);
  if (candidate === wanted) return 0;
  if (candidate.startsWith(wanted)) return 1;
  if (` ${candidate}`.includes(` ${tokensOf(term)[0]}`)) return 2;
  return candidate.includes(wanted) ? 3 : 4;
}

/** The matching products, best first. Something the shopper can buy beats something sold out. */
export function rankBySearch(products: CatalogProduct[], term: string) {
  return products
    .filter((product) => matchesSearch(product, term))
    .map((product) => ({ product, score: nameScore(product.name, term) }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(a.product.stock === "out") - Number(b.product.stock === "out") ||
        (b.product.sold ?? 0) - (a.product.sold ?? 0),
    )
    .map(({ product }) => product);
}

function toSuggestion(product: CatalogProduct): SearchSuggestion {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    categoryName: product.categoryName ?? "",
    href: product.href,
    image: product.image,
    alt: product.alt,
    price: product.price,
    compareAtPrice:
      product.compareAtPrice !== undefined && product.compareAtPrice > product.price
        ? product.compareAtPrice
        : undefined,
    fromPrice: product.item.needsOption,
    stock: product.stock,
    stockCount: product.stockCount,
  };
}

/** What the search box shows. The cap is the reason the panel never needs a scrollbar. */
export function searchCatalog(products: CatalogProduct[], term: string): SearchResult {
  const query = term.trim().slice(0, MAX_SEARCH_LENGTH);
  if (query.length < MIN_SEARCH_LENGTH) return { suggestions: [], total: 0 };

  const ranked = rankBySearch(products, query);
  return { suggestions: ranked.slice(0, SUGGESTION_LIMIT).map(toSuggestion), total: ranked.length };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits `text` around the words of `term`, so a row can mark what matched. */
export function highlightParts(text: string, term: string) {
  const tokens = tokensOf(term).sort((a, b) => b.length - a.length);
  if (!tokens.length) return [{ text, match: false }];

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text);
}
