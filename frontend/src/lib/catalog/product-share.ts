import type { ProductDetail } from "./types";

/**
 * What a product says about itself outside the page: the description in a
 * shared link and the structured data search engines read. Pure.
 */

const DESCRIPTION_LENGTH = 160;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/** The dashboard's description is rich-text HTML; a link preview shows plain words. */
export function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, length: number) {
  if (text.length <= length) return text;
  const cut = text.slice(0, length - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > length / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const priceLabel = (product: Pick<ProductDetail, "price" | "maxPrice">) =>
  `${product.maxPrice > product.price ? "From " : ""}৳${product.price.toLocaleString("en-US")}`;

/** "৳1,200 · Soft cotton polo…": the price is what a shopper looks for first. */
export function shareDescription(product: ProductDetail, storeName: string) {
  const about = plainText(product.description) || `Buy ${product.name} from ${storeName}.`;
  const price = priceLabel(product);
  return `${price} · ${truncate(about, DESCRIPTION_LENGTH - price.length - 3)}`;
}

/** schema.org Product, for search results. Absolute image URLs only. */
export function productJsonLd(product: ProductDetail, origin: string) {
  const url = `${origin}/product/${product.id}`;
  const availability = `https://schema.org/${product.stock === "out" ? "OutOfStock" : "InStock"}`;
  const about = plainText(product.description);
  const ranged = product.maxPrice > product.price;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    image: product.gallery.map((image) => image.src).filter((src) => /^https?:\/\//.test(src)),
    ...(about ? { description: about } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: ranged
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "BDT",
          lowPrice: product.price,
          highPrice: product.maxPrice,
          availability,
          url,
        }
      : { "@type": "Offer", priceCurrency: "BDT", price: product.price, availability, url },
  };
}
