import { CATALOG_A } from "./products-a";
import { CATALOG_B } from "./products-b";
import { reviewsForRating } from "./reviews";
import type { CatalogProduct, ProductDetail, Review } from "./types";

const ALL: CatalogProduct[] = [...CATALOG_A, ...CATALOG_B];

/* Copy that is genuinely per-product. Everything else on ProductDetail is
   derived from the catalogue row, so adding a product does not mean writing
   twenty more lines of boilerplate. */
const COPY: Record<string, { description: string; highlights: string[] }> = {
  "leather-biker-jacket": {
    description:
      "A full-grain leather biker cut close through the body, with an asymmetric zip and a quilted shoulder panel. The lining is viscose, so it slides over a sweater instead of dragging on it.",
    highlights: [
      "Full-grain cowhide, vegetable tanned",
      "Asymmetric YKK zip with storm flap",
      "Quilted shoulder and elbow panels",
    ],
  },
  "tailored-suit": {
    description:
      "A two-piece in a mid-weight wool blend, half-canvassed so it holds its line without the stiffness of a fused front. Trousers come unhemmed for tailoring.",
    highlights: [
      "Half-canvassed construction",
      "Mid-weight wool blend, four-season",
      "Trousers supplied unhemmed",
    ],
  },
};

const FALLBACK_COPY = {
  description:
    "Cut from a mid-weight fabric that holds its shape through a wash cycle, finished with flat-felled seams and a relaxed body that layers without bunching.",
  highlights: [
    "Pre-shrunk fabric, holds its size",
    "Flat-felled seams throughout",
    "Machine washable at 30°C",
  ],
};

/**
 * The fixtures carry one real photo per product. Unsplash re-crops when both
 * `w` and `h` are set, so the rail shows three framings of that shot — on the
 * square crop the top and bottom both land on the garment, which is why this
 * works here and did not at 4:5. Real product data supplies separate images
 * and this function goes away.
 */
function buildGallery(product: CatalogProduct) {
  const base = product.image.replace("w=600", "w=900&h=900");
  return [
    { src: base, alt: product.alt },
    { src: `${base}&crop=top`, alt: `${product.alt} — upper detail` },
    { src: `${base}&crop=bottom`, alt: `${product.alt} — lower detail` },
  ];
}

/**
 * Fixture stand-in for per-size inventory. Real data has a row per variant;
 * here the last size of a low-stock product and the largest two of a sold-out
 * one stand in, so the sold-out state is visible without inventing a table.
 */
function soldOutSizes(product: CatalogProduct): string[] {
  if (product.stock === "out") return product.sizes;
  if (product.stock === "low") return product.sizes.slice(-1);
  return product.sizes.length > 3 ? [product.sizes[1]] : [];
}

function buildDetail(product: CatalogProduct): ProductDetail {
  const copy = COPY[product.id] ?? FALLBACK_COPY;
  const stockCount =
    product.stock === "out" ? 0 : product.stock === "low" ? 3 : 55;

  return {
    ...product,
    ...copy,
    sku: product.id.slice(0, 3).toUpperCase() + "-" + String(product.price),
    stockCount,
    soldOutSizes: soldOutSizes(product),
    specs: [
      { label: "Brand", value: product.brand },
      { label: "Colours", value: product.colors.join(", ") },
      { label: "Sizes", value: product.sizes.join(", ") },
      { label: "Material", value: "Cotton blend" },
      { label: "Fit", value: "Regular" },
      { label: "Care", value: "Machine wash cold, line dry" },
      { label: "Country of origin", value: "Bangladesh" },
    ],
    gallery: buildGallery(product),
  };
}

/** Shaped like `GET /api/products/:id` — see `.claude/specs/product-page.md`. */
export async function getProduct(id: string): Promise<ProductDetail | undefined> {
  const product = ALL.find((item) => item.id === id);
  return product ? buildDetail(product) : undefined;
}

/** Shaped like `GET /api/products/:id/reviews`. */
export async function getReviews(id: string): Promise<Review[]> {
  const product = ALL.find((item) => item.id === id);
  if (!product) return [];
  return reviewsForRating(product.rating);
}

/** Shaped like `GET /api/products/:id/related`. */
export async function getRelatedProducts(id: string): Promise<CatalogProduct[]> {
  const product = ALL.find((item) => item.id === id);
  if (!product) return [];

  return ALL.filter(
    (item) => item.id !== id && item.categoryId === product.categoryId,
  ).slice(0, 4);
}

export function listProductIds(): string[] {
  return ALL.map((product) => product.id);
}
