const Product = require("../models/product.model");
const LimitedOffer = require("../models/limitedOffer.model");
const { currentPricing } = require("../service/flashSale.service");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");
const { buildCacheKey, getCache, setCache } = require("../utils/cache.util");

/**
 * The storefront's view of the catalogue.
 *
 * The dashboard's product endpoints return the whole document: stock
 * movements, return records, wholesale prices, inactive variants. A shopper
 * needs none of that, and some of it is the shop's own business. These
 * endpoints answer with only what a shop page shows, already shaped:
 *
 *   price  the retail price checkout charges (shopOrder.controller reads the
 *          same retailPrice), the lowest one for a product with variants
 *   stock  units that can be sold right now: product.stock for a single
 *          variant product, stockVariant summed over active variants otherwise
 *
 * Cached in the "product" namespace, which every product, variant and stock
 * change already bumps, so an edit in the dashboard shows on the next visit.
 */

const NS = "product";
const CACHE_TTL = 5 * 60;
// A storefront lists the whole active catalogue and filters it in memory.
// Past this size it needs server-side paging; the cap keeps a huge shop safe.
const MAX_PRODUCTS = 1000;

const requireStore = () => {
  if (!getTenantId()) {
    throw new customError("No store named for this request", statusCodes.BAD_REQUEST, "TENANT_CONTEXT_REQUIRED");
  }
};

const url = (image) => image?.url || "";
const urls = (images) => (images || []).map(url).filter(Boolean);
// "N/A" is the dashboard's placeholder for "no size" / "no colour"
const real = (value) => (value && value !== "N/A" ? value : "");
const ref = (doc) => (doc ? { name: doc.name, slug: doc.slug } : null);
const unique = (values) => [...new Set(values.filter(Boolean))];

const toVariant = (v) => ({
  _id: v._id,
  slug: v.slug,
  name: v.variantName,
  sku: v.sku || "",
  size: real(v.size),
  color: real(v.color),
  price: v.retailPrice ?? 0,
  stock: v.stockVariant ?? 0,
  image: url(v.thumbnail) || urls(v.image)[0] || "",
});

const toStorefront = (p) => {
  const variants = p.variantType === "multipleVariant"
    ? (p.variant || []).filter((v) => v && v.isActive !== false).map(toVariant)
    : [];
  const priced = variants.length ? variants.map((v) => v.price) : [p.retailPrice ?? 0];
  const gallery = unique([url(p.thumbnail), ...urls(p.image), ...variants.map((v) => v.image)]);

  return {
    _id: p._id,
    slug: p.slug,
    name: p.name,
    description: p.description || "",
    brand: ref(p.brand),
    category: ref(p.category),
    subcategory: ref(p.subcategory),
    image: gallery[0] || "",
    gallery,
    price: Math.min(...priced),
    maxPrice: Math.max(...priced),
    stock: variants.length ? variants.reduce((sum, v) => sum + v.stock, 0) : p.stock ?? 0,
    sizes: variants.length ? unique(variants.map((v) => v.size)) : unique([real(p.size)]),
    colors: variants.length ? unique(variants.map((v) => v.color)) : unique([real(p.color)]),
    variants,
    sku: p.sku || "",
    rating: p.rating ?? 0,
    sold: (p.posSold ?? 0) + (p.webSold ?? 0),
    specifications: p.specifications || "",
    warrantyInformation: p.warrantyInformation || "",
    shippingInformation: p.shippingInformation || "",
    createdAt: p.createdAt,
  };
};

const PRODUCT_FIELDS =
  "slug name description brand category subcategory variant variantType thumbnail image size color " +
  "stock retailPrice sku rating posSold webSold specifications warrantyInformation shippingInformation createdAt";
const VARIANT_FIELDS = "slug variantName sku size color stockVariant retailPrice thumbnail image isActive";

const findProducts = (filter) =>
  Product.find({ ...filter, isActive: { $ne: false } })
    .select(PRODUCT_FIELDS)
    .populate("brand category subcategory", "name slug")
    .populate({ path: "variant", select: VARIANT_FIELDS })
    .sort({ createdAt: -1 })
    .lean();

/**
 * Puts a running flash sale's prices on storefront products. Done per
 * response, after the cache, so a sale starts and ends on the minute. An item
 * on sale keeps its retail price as `compareAtPrice`.
 */
const withSale = (products, priceFor) =>
  products.map((p) => {
    if (!p.variants.length) {
      const sale = priceFor({ productId: p._id, retailPrice: p.price });
      return sale === null ? { ...p, compareAtPrice: null } : { ...p, price: sale, maxPrice: sale, compareAtPrice: p.price };
    }
    const variants = p.variants.map((v) => {
      const sale = priceFor({ productId: p._id, variantId: v._id, retailPrice: v.price });
      return sale === null ? { ...v, compareAtPrice: null } : { ...v, price: sale, compareAtPrice: v.price };
    });
    // The card shows the cheapest option, struck through when that option is on sale
    const cheapest = variants.reduce((low, v) => (v.price < low.price ? v : low), variants[0]);
    return {
      ...p,
      variants,
      price: cheapest.price,
      maxPrice: Math.max(...variants.map((v) => v.price)),
      compareAtPrice: cheapest.compareAtPrice,
    };
  });

/**
 * A curated list (limited offers, flash sale) as cards: a whole-product entry
 * is the product, a variant entry is its product narrowed to that option's
 * price, stock and photo, with `variantId` so the card opens on it. Entries
 * whose product or variant is gone or inactive are skipped.
 */
const featured = (entries, products) => {
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return entries.flatMap((entry) => {
    const product = byId.get(String(entry.product));
    if (!product) return [];
    if (!entry.variant) return [{ ...product, variantId: null }];

    const v = product.variants.find((x) => String(x._id) === String(entry.variant));
    if (!v) return [];
    return [{ ...product, variantId: v._id, price: v.price, maxPrice: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock, image: v.image || product.image }];
  });
};

// GET /shop/products: every active product, newest first
exports.products = asynchandeler(async (req, res) => {
  requireStore();
  const cacheKey = await buildCacheKey(NS, "storefront:list");
  let products = await getCache(cacheKey);

  if (!products) {
    products = (await findProducts({}).limit(MAX_PRODUCTS)).map(toStorefront);
    await setCache(cacheKey, products, CACHE_TTL);
  }

  const { priceFor } = await currentPricing();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Products", { products: withSale(products, priceFor) });
});

// GET /shop/products/:slug: one active product with its variants
exports.product = asynchandeler(async (req, res) => {
  requireStore();
  const slug = String(req.params.slug || "").toLowerCase();
  const cacheKey = await buildCacheKey(NS, `storefront:slug:${slug}`);
  let product = await getCache(cacheKey);

  if (!product) {
    const [found] = await findProducts({ slug }).limit(1);
    if (!found) throw new customError("Product not found", statusCodes.NOT_FOUND);
    product = toStorefront(found);
    await setCache(cacheKey, product, CACHE_TTL);
  }

  const { priceFor } = await currentPricing();
  const [priced] = withSale([product], priceFor);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Product", { product: priced });
});

// GET /shop/limited-offers: the seller's picks under Website Management →
// Limited Offer, in their order
exports.limitedOffers = asynchandeler(async (req, res) => {
  requireStore();
  const cacheKey = await buildCacheKey("limited-offer", "storefront");
  let cached = await getCache(cacheKey);

  if (!cached) {
    const entries = await LimitedOffer.find({ isActive: true }).sort({ priority: 1, createdAt: -1 }).select("product variant").lean();
    const products = (await findProducts({ _id: { $in: entries.map((e) => e.product) } })).map(toStorefront);
    cached = { entries, products };
    // Short: stock and prices inside change without touching this namespace
    await setCache(cacheKey, cached, 60);
  }

  const { priceFor } = await currentPricing();
  const products = featured(cached.entries, withSale(cached.products, priceFor));
  return apiResponse.sendSuccess(res, statusCodes.OK, "Limited offers", { products });
});

// GET /shop/flash-sale: the sale running now, with its items at sale price,
// or { sale: null } when none is
exports.flashSale = asynchandeler(async (req, res) => {
  requireStore();
  const { sale, priceFor } = await currentPricing();
  if (!sale) return apiResponse.sendSuccess(res, statusCodes.OK, "No flash sale", { sale: null, products: [] });

  const found = (await findProducts({ _id: { $in: sale.items.map((i) => i.product) } })).map(toStorefront);
  const products = featured(sale.items, withSale(found, priceFor));
  return apiResponse.sendSuccess(res, statusCodes.OK, "Flash sale", {
    sale: { _id: sale._id, title: sale.title, startsAt: sale.startsAt, endsAt: sale.endsAt },
    products,
  });
});

module.exports.toStorefront = toStorefront;
