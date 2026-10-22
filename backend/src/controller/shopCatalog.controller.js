const Product = require("../models/product.model");
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

// GET /shop/products: every active product, newest first
exports.products = asynchandeler(async (req, res) => {
  requireStore();
  const cacheKey = await buildCacheKey(NS, "storefront:list");
  let products = await getCache(cacheKey);

  if (!products) {
    products = (await findProducts({}).limit(MAX_PRODUCTS)).map(toStorefront);
    await setCache(cacheKey, products, CACHE_TTL);
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Products", { products });
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

  return apiResponse.sendSuccess(res, statusCodes.OK, "Product", { product });
});

module.exports.toStorefront = toStorefront;
