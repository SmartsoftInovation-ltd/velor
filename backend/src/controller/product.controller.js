const crypto = require("crypto");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { forAudience, isStaff } = require("../utils/publicProduct");
const { nameSearchFilter, nameContainsFilter, idsMatchingAny } = require("../utils/searchWords.util");
const { listPage, afterCursor, pageResult, NEWEST_FIRST, MAX_LIMIT } = require("../utils/listPage.util");

// Rows each branch of the product search returns (products, then variants)
const SEARCH_LIMIT = 50;
const {
  validateProduct,
  validateProductUpdate,
  validateProductGalleryUpload,
  MAX_GALLERY_IMAGES,
} = require("../validation/product.validation");
const { statusCodes } = require("../constant/constant");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");
const { imageQueue } = require("@/queues/image.queue");
const { logAudit } = require("@/service/audit.service");

// ─── constants ────────────────────────────────────────────────────────────────

const NS = "product";
const CACHE_TTL = 60 * 60;
const CACHE_TTL_LIST = 60 * 30;

const SEO_KEYS = [
  "metaTitle",
  "metaDescription",
  "metaKeywords",
  "canonicalUrl",
  "focusKeyword",
  "ogTitle",
  "ogDescription",
  "twitterCard",
  "structuredData",
  "noIndex",
  "noFollow",
];

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge flat SEO fields into a nested seo object.
 */
const mergeSeoData = (data = {}) => {
  const seo = { ...(data.seo || {}) };
  delete data.seo;
  SEO_KEYS.forEach((key) => {
    if (data[key] !== undefined) {
      seo[key] = data[key];
      delete data[key];
    }
  });
  return seo;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a stable cache suffix from a query object — sorted keys for hit consistency.
 */
const stableSuffix = (obj) => {
  const sorted = Object.keys(obj || {})
    .sort()
    .reduce((acc, k) => {
      if (obj[k] !== undefined && obj[k] !== "") acc[k] = obj[k];
      return acc;
    }, {});
  return JSON.stringify(sorted);
};

/**
 * Generate a collision-safe barcode — Date.now() alone collides under load.
 */
const generateBarcode = () => {
  const ts = Date.now().toString();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${ts.slice(-9)}${rand}`.slice(0, 13);
};

/**
 * Collect every Cloudinary publicId from a product (thumbnail + gallery + ogImage).
 */
const collectProductPublicIds = (product) => {
  const ids = [];
  if (product.thumbnail?.publicId) ids.push(product.thumbnail.publicId);
  if (Array.isArray(product.image)) {
    product.image.forEach((img) => img?.publicId && ids.push(img.publicId));
  }
  if (product.seo?.ogImage?.publicId) ids.push(product.seo.ogImage.publicId);
  return ids;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

/**
 * One page of products (BUG-P2-010), newest first. ?search= finds a word of
 * the name (prefix) or a barcode / sku (prefix) through indexes; ?after= is
 * the cursor of the previous page; ?page= numbers pages for the pickers.
 */
const pagedProducts = async (req, base, { select, populate = true } = {}) => {
  const paging = listPage(req.query);
  const query = { ...base };
  const search = String(req.query.search || req.query.q || "").trim();
  if (search) {
    const conditions = [
      { barCode: { $regex: `^${escapeRegex(search)}` } },
      { sku: { $regex: `^${escapeRegex(search)}` } },
    ];
    const byName = nameContainsFilter(search, "name");
    if (byName) conditions.unshift(byName);
    query._id = { $in: await idsMatchingAny(Product, conditions, MAX_LIMIT) };
  }

  let find = Product.find({ ...query, ...afterCursor(paging.cursor) })
    .sort(NEWEST_FIRST)
    .skip(paging.skip)
    .limit(paging.limit + 1);
  if (select) find = find.select(select);
  if (populate) {
    find = find
      .populate("category brand discount")
      .populate({ path: "subcategory", populate: "discount" })
      .populate({ path: "variant" });
  }
  const { items, ...pageInfo } = pageResult(await find.lean(), paging);
  return { products: items, ...pageInfo };
};

// ─── controller class ─────────────────────────────────────────────────────────

class ProductController {
  // ─── CREATE ────────────────────────────────────────────────────────────────
  createProduct = asynchandeler(async (req, res) => {
    const value = await validateProduct(req);
    const { thumbnail, images, ogImage, ...productData } = value;

    // Set default 0 for null number fields
    if (productData.stock === null || productData.stock === undefined)
      productData.stock = 0;
    // Snapshot the creation-time stock — never touched again after this
    productData.initialStock = productData.stock;
    if (productData.weight === null || productData.weight === undefined)
      productData.weight = 0;
    if (
      productData.groupUnitQuantity === null ||
      productData.groupUnitQuantity === undefined
    )
      productData.groupUnitQuantity = 0;
    if (
      productData.purchasePrice === null ||
      productData.purchasePrice === undefined
    )
      productData.purchasePrice = 0;
    if (
      productData.retailPrice === null ||
      productData.retailPrice === undefined
    )
      productData.retailPrice = 0;
    if (
      productData.wholesalePrice === null ||
      productData.wholesalePrice === undefined
    )
      productData.wholesalePrice = 0;
    if (
      productData.retailProfitMarginByPercentage === null ||
      productData.retailProfitMarginByPercentage === undefined
    )
      productData.retailProfitMarginByPercentage = 0;
    if (
      productData.wholesaleProfitMarginPercentage === null ||
      productData.wholesaleProfitMarginPercentage === undefined
    )
      productData.wholesaleProfitMarginPercentage = 0;

    // Set null for tag and seo if not provided
    if (!productData.tag) productData.tag = null;
    if (!productData.seo) productData.seo = null;

    // Uniqueness checks (parallel)
    const [nameTaken, skuTaken, barCodeTaken] = await Promise.all([
      Product.exists({ name: productData.name }),
      productData.sku ? Product.exists({ sku: productData.sku }) : null,
      productData.barCode
        ? Product.exists({ barCode: productData.barCode })
        : null,
    ]);

    if (nameTaken) {
      throw new customError(
        `Product name "${productData.name}" already exists`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (skuTaken) {
      throw new customError(
        `SKU "${productData.sku}" already exists`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (barCodeTaken) {
      throw new customError(
        `Barcode "${productData.barCode}" already exists`,
        statusCodes.BAD_REQUEST,
      );
    }

    // Build SEO subdoc — merge text fields with ogImage placeholder if uploaded
    const seoData = mergeSeoData(productData);

    if (ogImage) {
      seoData.ogImage = { status: "pending", localPath: ogImage.path };
    }

    const createPayload = {
      ...productData,
      thumbnail: thumbnail
        ? { status: "pending", localPath: thumbnail.path }
        : undefined,
      image: images.map((img) => ({
        status: "pending",
        localPath: img.path,
      })),
      seo: seoData,
    };

    if (productData.variantType === "singleVariant") {
      createPayload.barCode = productData.barCode || generateBarcode();
    }

    const product = await Product.create(createPayload);

    // Enqueue all uploads in one Redis round-trip
    const jobs = [];

    if (thumbnail) {
      jobs.push({
        name: "create-product-thumbnail",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: thumbnail.path,
          fieldName: "thumbnail",
        },
      });
    }

    jobs.push(
      ...images.map((img, i) => ({
        name: "create-product-image",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: img.path,
          fieldName: "image",
          index: i,
        },
      })),
    );

    if (ogImage) {
      jobs.push({
        name: "create-product-ogimage",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: ogImage.path,
          fieldName: "seo.ogImage",
        },
      });
    }

    await imageQueue.addBulk(jobs);

    await bumpNsVersion(NS);

    logAudit({
      req,
      action: "CREATE",
      entityType: "product",
      entityId: product._id,
      entityLabel: product.name,
      after: product,
    });

    return apiResponse.sendSuccess(
      res,
      statusCodes.CREATED,
      "Product created. Images are uploading in background.",
      { _id: product._id, slug: product.slug, name: product.name },
    );
  });

  // ─── READ — all (with filters + caching) ───────────────────────────────────
  getAllProducts = asynchandeler(async (req, res) => {
    // One page at a time (BUG-P2-010): the whole catalogue with its populates
    // ran the API out of memory on a large shop. ?search= finds products by a
    // part of the name (any case) or a barcode / sku (prefix).
    const staff = isStaff(req);
    const cacheKey = await buildCacheKey(
      NS,
      `all:${staff ? "staff" : "public"}:${stableSuffix(req.query)}`,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { ...cached, products: forAudience(req, cached.products), fromCache: true },
      );
    }

    const { category, subcategory, brand, minPrice, maxPrice, variantType } = req.query;

    const query = {};
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;
    // A picker that only takes one kind (e.g. a product discount: single-variant)
    if (variantType === "singleVariant" || variantType === "multipleVariant") query.variantType = variantType;
    // The main listing serves the dashboard and the storefront: staff see every
    // product (they re-activate from it); shoppers and visitors see only active
    // ones. Filtered in the query so a page is never short.
    if (!staff) query.isActive = { $ne: false };

    // Push price filter to the DB instead of in-memory filter
    if (minPrice || maxPrice) {
      const priceCond = {};
      if (minPrice) priceCond.$gte = parseFloat(minPrice);
      if (maxPrice) priceCond.$lte = parseFloat(maxPrice);
      query.retailPrice = priceCond;
    }

    const payload = await pagedProducts(req, query);
    await setCache(cacheKey, payload, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { ...payload, products: forAudience(req, payload.products), fromCache: false },
    );
  });

  // ─── READ — by slug ────────────────────────────────────────────────────────
  getProductBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const cacheKey = await buildCacheKey(NS, `slug:${slug}`);

    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Product fetched successfully",
        { product: forAudience(req, cached), fromCache: true },
      );
    }

    const product = await Product.findOne({ slug })
      .populate("brand discount")
      .populate({ path: "category", populate: "discount" })
      .populate({ path: "subcategory", populate: "discount" })
      .populate({ path: "variant" })
      .populate({ path: "byReturn", populate: "product variant" })
      .populate({ path: "salesReturn", populate: "product variant" })
      .lean();

    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    await setCache(cacheKey, product, CACHE_TTL);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product fetched successfully",
      { product: forAudience(req, product), fromCache: false },
    );
  });

  // ─── UPDATE — text fields + SEO + optional image replacement ───────────────
  updateProductInfoBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const value = await validateProductUpdate(req);
    const { thumbnail, ogImage, ...updateData } = value;

    // Uniqueness checks against OTHER docs (parallel)
    const [nameTaken, skuTaken, barCodeTaken] = await Promise.all([
      updateData.name
        ? Product.exists({ name: updateData.name, slug: { $ne: slug } })
        : null,
      updateData.sku
        ? Product.exists({ sku: updateData.sku, slug: { $ne: slug } })
        : null,
      updateData.barCode
        ? Product.exists({ barCode: updateData.barCode, slug: { $ne: slug } })
        : null,
    ]);

    if (nameTaken) {
      throw new customError(
        `Product name "${updateData.name}" is already taken`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (skuTaken) {
      throw new customError(
        `SKU "${updateData.sku}" is already taken`,
        statusCodes.BAD_REQUEST,
      );
    }
    if (barCodeTaken) {
      throw new customError(
        `Barcode "${updateData.barCode}" is already taken`,
        statusCodes.BAD_REQUEST,
      );
    }

    // Load doc first if image change is needed (we need oldPublicId)
    let product;
    let oldThumbnailPublicId = null;
    let oldOgPublicId = null;

    if (thumbnail || ogImage) {
      product = await Product.findOne({ slug });
      if (!product) {
        throw new customError("Product not found", statusCodes.NOT_FOUND);
      }
      oldThumbnailPublicId = product.thumbnail?.publicId || null;
      oldOgPublicId = product.seo?.ogImage?.publicId || null;
    }

    // Snapshot changed fields only — keeps the audit diff free of populated-ref noise
    const auditBeforeDoc = await Product.findOne({ slug }).lean();

    // Build $set payload — flatten seo so ogImage merges instead of replacing
    const seoData = mergeSeoData(updateData);
    const { stock: submittedStock, ...restUpdateData } = updateData;
    const $set = { ...restUpdateData };
    // "stock" on the update form only updates initialStock (a snapshot) —
    // the live stock/stockVariant counter is exclusively maintained by
    // sales/purchase/adjustment/return controllers and must never be
    // overwritten by an edit form.
    if (submittedStock !== undefined) {
      $set.initialStock = submittedStock;
    }

    if (Object.keys(seoData).length > 0) {
      Object.entries(seoData).forEach(([k, v]) => {
        $set[`seo.${k}`] = v;
      });
    }
    if (thumbnail) {
      $set.thumbnail = {
        status: "pending",
        localPath: thumbnail.path,
        url: product.thumbnail?.url || "",
        publicId: product.thumbnail?.publicId || "",
        tries: 0,
        lastError: "",
      };
    }
    if (ogImage) {
      $set["seo.ogImage"] = {
        status: "pending",
        localPath: ogImage.path,
        url: product.seo?.ogImage?.url || "", // keep old URL visible during upload
        publicId: product.seo?.ogImage?.publicId || "",
        tries: 0,
        lastError: "",
      };
    }

    product = await Product.findOneAndUpdate(
      { slug },
      { $set },
      { new: true, runValidators: true },
    ).populate("category subcategory brand variant discount");

    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const jobs = [];

    if (thumbnail) {
      jobs.push({
        name: "update-product-thumbnail",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: thumbnail.path,
          fieldName: "thumbnail",
          oldPublicId: oldThumbnailPublicId,
        },
      });
    }

    if (ogImage) {
      jobs.push({
        name: "update-product-ogimage",
        data: {
          modelName: NS,
          documentId: product._id,
          localPath: ogImage.path,
          fieldName: "seo.ogImage",
          oldPublicId: oldOgPublicId,
        },
      });
    }

    if (jobs.length > 0) {
      await imageQueue.addBulk(jobs);
    }

    await bumpNsVersion(NS);

    if (auditBeforeDoc) {
      const auditBefore = {};
      for (const key of Object.keys($set)) {
        auditBefore[key] = key
          .split(".")
          .reduce((obj, k) => obj?.[k], auditBeforeDoc);
      }
      logAudit({
        req,
        action: "UPDATE",
        entityType: "product",
        entityId: product._id,
        entityLabel: product.name,
        before: auditBefore,
        after: $set,
      });
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product updated successfully",
      product,
    );
  });

  // ─── UPDATE STATUS — active/deactive product from one endpoint ─────────────
  updateProductStatus = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const isActive = parseBoolean(req.body?.isActive);

    if (isActive === null) {
      throw new customError(
        "isActive must be true or false",
        statusCodes.BAD_REQUEST,
      );
    }

    const previous = await Product.findOne({ slug })
      .select("isActive")
      .lean();

    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: { isActive } },
      { new: true, runValidators: true },
    );

    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    await bumpNsVersion(NS);

    logAudit({
      req,
      action: "STATUS_CHANGE",
      entityType: "product",
      entityId: product._id,
      entityLabel: product.name,
      before: { isActive: previous?.isActive },
      after: { isActive: product.isActive },
    });

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      `Product ${isActive ? "activated" : "deactivated"} successfully`,
      product,
    );
  });

  // ─── ADD a single gallery image ────────────────────────────────────────────
  addProductImage = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    const images = validateProductGalleryUpload(req);

    const product = await Product.findOne({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const currentCount = product.image.length;
    if (currentCount + images.length > MAX_GALLERY_IMAGES) {
      throw new customError(
        `Adding ${images.length} images would exceed gallery limit (${MAX_GALLERY_IMAGES}). Current: ${currentCount}`,
        statusCodes.BAD_REQUEST,
      );
    }

    // Add images to DB (pending status)
    const newImages = images.map((file) => ({
      status: "pending",
      localPath: file.path,
      tries: 0,
    }));
    product.image.push(...newImages);
    await product.save();

    // Enqueue background uploads
    const jobs = images.map((file, i) => ({
      name: "add-product-image",
      data: {
        modelName: NS,
        documentId: product._id,
        localPath: file.path,
        fieldName: "image",
        index: currentCount + i,
      },
    }));

    await imageQueue.addBulk(jobs);
    await bumpNsVersion(NS);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      `${images.length} image(s) upload started in background`,
      { slug, count: images.length },
    );
  });

  // ─── DELETE a single gallery image (or thumbnail) ──────────────────────────
  deleteProductImage = asynchandeler(async (req, res) => {
    const { slug } = req.params;
    let { publicId } = req.body;

    if (!publicId) {
      throw new customError("publicId is required", statusCodes.BAD_REQUEST);
    }

    if (!Array.isArray(publicId)) {
      publicId = [publicId];
    }

    const product = await Product.findOne({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    const toDelete = [];

    // 1. Check thumbnail
    if (publicId.includes(product.thumbnail?.publicId)) {
      toDelete.push(product.thumbnail.publicId);
      product.thumbnail = { status: "pending" }; // Reset to pending/empty
    }

    // 2. Check gallery (image array)
    const initialLen = product.image.length;
    product.image = product.image.filter((img) => {
      if (publicId.includes(img.publicId)) {
        toDelete.push(img.publicId);
        return false;
      }
      return true;
    });

    if (toDelete.length === 0) {
      throw new customError(
        "No matching images found with provided publicIds",
        statusCodes.NOT_FOUND,
      );
    }

    await product.save();
    await bumpNsVersion(NS);

    // Enqueue background deletions
    const jobs = toDelete.map((pid) => ({
      name: "delete-cloudinary-image",
      data: { publicId: pid },
    }));

    await imageQueue.addBulk(jobs);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      `${toDelete.length} image(s) removal started in background`,
      { slug, deletedCount: toDelete.length },
    );
  });

  // ─── PAGINATION ────────────────────────────────────────────────────────────
  getProductsWithPagination = asynchandeler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const skip = (page - 1) * limit;

    const cacheKey = await buildCacheKey(NS, `page:${page}:limit:${limit}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const [products, total] = await Promise.all([
      Product.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate("category subcategory brand variant discount")
        .lean(),
      Product.countDocuments(),
    ]);

    if (!products.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products not found",
        { products: [], fromCache: false },
      );
    }

    const payload = {
      products,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    await setCache(cacheKey, payload, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { ...payload, fromCache: false },
    );
  });

  // ─── DELETE ────────────────────────────────────────────────────────────────
  deleteProductBySlug = asynchandeler(async (req, res) => {
    const { slug } = req.params;

    const product = await Product.findOneAndDelete({ slug });
    if (!product) {
      throw new customError("Product not found", statusCodes.NOT_FOUND);
    }

    // Its variants go with it: left behind they pointed at a missing product
    // and still came up in the sale-form search, stock lists and reports
    const variantFilter = {
      $or: [{ product: product._id }, { _id: { $in: product.variant || [] } }],
    };
    const variants = await Variant.find(variantFilter).lean();
    if (variants.length) await Variant.deleteMany(variantFilter);

    // Variants keep their images in the same shape as a product
    const publicIds = [product, ...variants].flatMap(collectProductPublicIds);
    if (publicIds.length > 0) {
      await imageQueue.addBulk(
        publicIds.map((publicId) => ({
          name: "delete-cloudinary-image",
          data: { publicId },
        })),
      );
    }

    await bumpNsVersion(NS);
    if (variants.length) await bumpNsVersion("variant");

    logAudit({
      req,
      action: "DELETE",
      entityType: "product",
      entityId: product._id,
      entityLabel: product.name,
      before: product,
    });

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Product deleted successfully",
      { slug },
    );
  });

  // ─── SINGLE-VARIANT PRODUCTS (paginated, for barcode print) ────────────────
  getAllSingleVariantProducts = asynchandeler(async (req, res) => {
    // Searched through indexes (the old "contains" regex was neither escaped
    // nor indexable) and paged without counting every match (BUG-P2-010)
    const cacheKey = await buildCacheKey(NS, `single-variant:${stableSuffix(req.query)}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Single variant products fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const payload = await pagedProducts(
      req,
      { variantType: "singleVariant" },
      {
        select: "name slug sku barCode thumbnail retailPrice wholesalePrice size color stock isActive createdAt",
        populate: false,
      },
    );
    await setCache(cacheKey, payload, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      payload.products.length
        ? "Single variant products fetched successfully"
        : "Single variant products not found",
      { ...payload, fromCache: false },
    );
  });

  // ─── MULTIPLE-VARIANT PRODUCTS ─────────────────────────────────────────────
  getAllMultipleVariantProducts = asynchandeler(async (req, res) => {
    // Paged and searchable like the main list (BUG-P2-010)
    const cacheKey = await buildCacheKey(NS, `multiple-variants:${stableSuffix(req.query)}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Multiple variant products fetched successfully",
        { ...cached, fromCache: true },
      );
    }

    const payload = await pagedProducts(req, { variantType: "multipleVariant" });
    await setCache(cacheKey, payload, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      payload.products.length
        ? "Multiple variant products fetched successfully"
        : "Multiple variant products not found",
      { ...payload, fromCache: false },
    );
  });

  // ─── NEW ARRIVALS ──────────────────────────────────────────────────────────
  getNewArrivalProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "new-arrivals");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "New arrival products fetched successfully",
        { products: forAudience(req, cached), fromCache: true },
      );
    }

    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("brand variant discount")
      .populate({ path: "category", populate: "discount" })
      .populate({ path: "subcategory", populate: "discount" })
      .lean();

    if (!products.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "New arrival products not found",
        {
          products: [],
          fromCache: false,
        },
      );
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "New arrival products fetched successfully",
      { products: forAudience(req, products), fromCache: false },
    );
  });

  // ─── PRICE-RANGE FILTER ────────────────────────────────────────────────────
  getProductsByPriceRange = asynchandeler(async (req, res) => {
    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);

    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      throw new customError("Invalid price range", statusCodes.BAD_REQUEST);
    }
    if (minPrice > maxPrice) {
      throw new customError(
        "minPrice cannot be greater than maxPrice",
        statusCodes.BAD_REQUEST,
      );
    }

    const cacheKey = await buildCacheKey(NS, `price:${minPrice}-${maxPrice}`);
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { products: forAudience(req, cached), fromCache: true },
      );
    }

    const products = await Product.aggregate([
      {
        $lookup: {
          from: "variants",
          localField: "variant",
          foreignField: "_id",
          as: "variantdocs",
        },
      },
      {
        $lookup: {
          from: "discounts",
          localField: "discount",
          foreignField: "_id",
          as: "discountdocs",
        },
      },
      {
        $match: {
          $or: [
            { retailPrice: { $gte: minPrice, $lte: maxPrice } },
            {
              variantdocs: {
                $elemMatch: {
                  retailPrice: { $gte: minPrice, $lte: maxPrice },
                },
              },
            },
          ],
        },
      },
    ]);

    if (!products.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "No products found matching price range",
        { products: [], fromCache: false },
      );
    }

    await setCache(cacheKey, products, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products: forAudience(req, products) },
    );
  });

  // ─── RELATED PRODUCTS ──────────────────────────────────────────────────────
  getRelatedProducts = asynchandeler(async (req, res) => {
    const { category } = req.body;
    if (!category) {
      throw new customError("category is required", statusCodes.BAD_REQUEST);
    }

    const products = await Product.find({ category, isActive: true })
      .populate("category subcategory brand variant discount")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    if (!products.length) {
      throw new customError("No related products found", statusCodes.NOT_FOUND);
    }

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products: forAudience(req, products) },
    );
  });

  // ─── DISCOUNTED PRODUCTS (graceful empty handling) ─────────────────────────
  getDiscountProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "discount");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Discounted products fetched successfully",
        { products: forAudience(req, cached), fromCache: true },
      );
    }

    // Run both queries in parallel — independent
    const [products, variantDiscountedProducts] = await Promise.all([
      Product.find({ discount: { $ne: null } })
        .populate("brand variant discount")
        .populate({ path: "category", populate: "discount" })
        .populate({ path: "subcategory", populate: "discount" })
        .sort({ createdAt: -1 })
        .lean(),
      Variant.find({ discount: { $ne: null } })
        .sort({ createdAt: -1 })
        .populate({
          path: "product",
          populate: [
            { path: "category", populate: "discount" },
            { path: "subcategory", populate: "discount" },
            { path: "brand", populate: "discount" },
          ],
          select: "-variant",
        })
        .lean(),
    ]);

    const merged = [...products, ...variantDiscountedProducts];

    if (!merged.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "No discounted products found",
        {
          products: [],
          fromCache: false,
        },
      );
    }

    await setCache(cacheKey, merged, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Discounted products fetched successfully",
      { products: forAudience(req, merged), fromCache: false },
    );
  });

  // ─── BEST-SELLING (graceful empty handling) ────────────────────────────────
  getBestSellingProducts = asynchandeler(async (req, res) => {
    const cacheKey = await buildCacheKey(NS, "best-selling");
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Best selling products fetched successfully",
        { products: forAudience(req, cached), fromCache: true },
      );
    }

    const [products, variantBestSelling] = await Promise.all([
      Product.find({ totalSales: { $gt: 0 } })
        .sort({ totalSales: -1 })
        .limit(10)
        .populate("brand variant discount")
        .populate({ path: "category", populate: "discount" })
        .populate({ path: "subcategory", populate: "discount" })
        .lean(),
      Variant.find({ totalSales: { $gt: 0 } })
        .sort({ totalSales: -1 })
        .limit(50)
        .populate({ path: "product", select: "-variant" })
        .lean(),
    ]);

    const merged = [...products, ...variantBestSelling];

    if (!merged.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "No best selling products found",
        {
          products: [],
          fromCache: false,
        },
      );
    }

    await setCache(cacheKey, merged, CACHE_TTL_LIST);

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Best selling products fetched successfully",
      { products: forAudience(req, merged), fromCache: false },
    );
  });

  // ─── NAME / BARCODE SEARCH (regex-escaped) ─────────────────────────────────
  getNameWiseSearch = asynchandeler(async (req, res) => {
    const name = String(req.query.name || "").trim();
    const barCode = String(req.query.barCode || "").trim();
    const sku = String(req.query.sku || "").trim();
    const slug = String(req.query.slug || "").trim();

    if (!name && !barCode && !sku && !slug) {
      throw new customError(
        "name, barCode, sku or slug query is required",
        statusCodes.BAD_REQUEST,
      );
    }

    const cacheKey = await buildCacheKey(
      NS,
      `search:${name}:${barCode}:${sku}:${slug}`,
    );
    const cached = await getCache(cacheKey);
    if (cached) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "Products fetched successfully",
        { products: forAudience(req, cached), fromCache: true },
      );
    }

    // Every condition is matched before anything is joined (BUG-P2-011): the
    // search used to join variants, discounts and subcategories onto the whole
    // catalogue and filter afterwards. Codes and slugs match by their
    // beginning, through indexes. The name matches any part of it in any case
    // (dashboard stock pages); a variant also through its product's name.
    const prefix = (value) => ({ $regex: `^${escapeRegex(value)}` });
    const conditions = [];
    if (barCode) conditions.push({ barCode: prefix(barCode) });
    if (sku) conditions.push({ sku: prefix(sku) });
    if (slug) conditions.push({ slug: prefix(slug.toLowerCase()) });
    const productConditions = [...conditions];
    const variantConditions = [...conditions];
    if (name) {
      const byProductName = nameContainsFilter(name, "name");
      if (byProductName) {
        productConditions.unshift(byProductName);
        variantConditions.unshift(nameContainsFilter(name, "variantName"));
        const parentIds = await idsMatchingAny(Product, [byProductName], SEARCH_LIMIT);
        if (parentIds.length) variantConditions.push({ product: { $in: parentIds } });
      }
    }

    if (!productConditions.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "No products found matching search criteria",
        { products: [], fromCache: false },
      );
    }
    // Each condition its own indexed query; only the ids found are joined
    const [productIds, variantIds] = await Promise.all([
      idsMatchingAny(Product, productConditions, SEARCH_LIMIT),
      idsMatchingAny(Variant, variantConditions, SEARCH_LIMIT),
    ]);
    const hide = { $project: { searchWords: 0 } };

    const [productMatches, variantMatches] = await Promise.all([
      Product.aggregate([
        { $match: { _id: { $in: productIds } } },
        {
          $lookup: {
            from: "variants",
            localField: "variant",
            foreignField: "_id",
            pipeline: [hide],
            as: "variant",
          },
        },
        {
          $lookup: {
            from: "discounts",
            localField: "discount",
            foreignField: "_id",
            as: "discount",
          },
        },
        // Callers render the subcategory name (stock list, POS lookup), so send
        // the document rather than the bare ObjectId.
        {
          $lookup: {
            from: "subcategories",
            localField: "subcategory",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $unwind: {
            path: "$subcategory",
            preserveNullAndEmptyArrays: true,
          },
        },
        hide,
        { $addFields: { resultType: "product" } },
      ]),
      Variant.aggregate([
        { $match: { _id: { $in: variantIds } } },
        {
          $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            pipeline: [hide],
            as: "product",
          },
        },
        {
          $unwind: {
            path: "$product",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "discounts",
            localField: "discount",
            foreignField: "_id",
            as: "discount",
          },
        },
        // A variant has no subcategory of its own — it inherits the parent
        // product's, which callers display alongside the variant row.
        {
          $lookup: {
            from: "subcategories",
            localField: "product.subcategory",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $unwind: {
            path: "$subcategory",
            preserveNullAndEmptyArrays: true,
          },
        },
        hide,
        { $addFields: { resultType: "variant" } },
      ]),
    ]);

    const products = [...productMatches, ...variantMatches];

    if (!products.length) {
      return apiResponse.sendSuccess(
        res,
        statusCodes.OK,
        "No products found matching search criteria",
        { products: [], fromCache: false },
      );
    }

    await setCache(cacheKey, products, 60 * 5); // 5 min — search results change

    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Products fetched successfully",
      { products: forAudience(req, products), fromCache: false },
    );
  });
}

module.exports = new ProductController();
