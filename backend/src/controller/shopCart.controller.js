const mongoose = require("mongoose");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { currentPricing } = require("../service/flashSale.service");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");

/**
 * The storefront keeps its cart in the browser and sends it up whole, once,
 * right before checkout. `POST /shop/order` then prices this server copy.
 *
 * One call replaces the cart, rather than clear + add per line, so a checkout
 * never runs against a half-written cart. Only ids and quantities are read from
 * the body; every price is looked up here.
 */

const MAX_LINES = 50;
const MAX_QUANTITY = 999;
const GUEST_CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);

/** The body's lines, validated and with repeats of one product+variant added together */
const readLines = (body) => {
  const items = body?.items;
  if (!Array.isArray(items)) throw new customError("items must be a list", statusCodes.BAD_REQUEST);
  if (items.length > MAX_LINES) {
    throw new customError(`A cart holds at most ${MAX_LINES} lines`, statusCodes.BAD_REQUEST);
  }

  const lines = new Map();
  for (const item of items) {
    const variantId = item?.variantId ?? null;
    const quantity = Number(item?.quantity);
    if (!isId(item?.productId) || (variantId !== null && !isId(variantId))) {
      throw new customError("Each line needs a valid productId", statusCodes.BAD_REQUEST);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new customError("Each line needs a quantity between 1 and 999", statusCodes.BAD_REQUEST);
    }
    const key = `${item.productId}:${variantId ?? "-"}`;
    const line = lines.get(key) ?? { productId: item.productId, variantId, quantity: 0 };
    line.quantity = Math.min(line.quantity + quantity, MAX_QUANTITY);
    lines.set(key, line);
  }
  return [...lines.values()];
};

/**
 * What one line costs now and how many can be bought, or why it cannot.
 * A variant must belong to the product the line names.
 */
const resolveLine = async ({ productId, variantId }, priceFor) => {
  if (variantId) {
    const variant = await Variant.findById(variantId).select("product retailPrice stockVariant isActive").lean();
    if (!variant || variant.isActive === false || String(variant.product) !== productId) return { reason: "unavailable" };
    const stock = variant.stockVariant ?? 0;
    const price = priceFor({ productId: variant.product, variantId: variant._id, retailPrice: variant.retailPrice }) ?? variant.retailPrice ?? 0;
    return stock < 1 ? { reason: "out_of_stock" } : { price, stock };
  }

  const product = await Product.findById(productId).select("retailPrice stock isActive").lean();
  if (!product || product.isActive === false) return { reason: "unavailable" };
  const stock = product.stock ?? 0;
  const price = priceFor({ productId: product._id, retailPrice: product.retailPrice }) ?? product.retailPrice ?? 0;
  return stock < 1 ? { reason: "out_of_stock" } : { price, stock };
};

exports.replaceCart = asynchandeler(async (req, res) => {
  if (!getTenantId()) {
    throw new customError("No store named for this request", statusCodes.BAD_REQUEST, "TENANT_CONTEXT_REQUIRED");
  }
  const userId = req.user?._id ?? null;
  const guestId = userId ? null : req.guestId ?? null;

  const lines = readLines(req.body);
  const { priceFor } = await currentPricing();

  const items = [];
  const rejected = [];
  for (const line of lines) {
    const found = await resolveLine(line, priceFor);
    if (found.reason) {
      rejected.push({ productId: line.productId, variantId: line.variantId, reason: found.reason });
      continue;
    }
    // More than is on the shelf is trimmed to what is, and said so
    const quantity = Math.min(line.quantity, found.stock);
    if (quantity < line.quantity) {
      rejected.push({ productId: line.productId, variantId: line.variantId, reason: "quantity_reduced", quantity });
    }
    items.push({
      product: line.productId,
      variant: line.variantId,
      quantity,
      snapshotPrice: found.price,
      itemTotal: found.price * quantity,
    });
  }

  const query = userId ? { user: userId } : { guestId };
  const cart = (await Cart.findOne(query)) ?? new Cart({ user: userId, guestId });
  cart.items = items;
  cart.couponCode = null;
  cart.discountAmount = 0;
  cart.expiresAt = userId ? null : new Date(Date.now() + GUEST_CART_TTL_MS);
  await cart.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Cart saved", {
    cart: {
      items: cart.items.map((item) => ({
        productId: String(item.product),
        variantId: item.variant ? String(item.variant) : null,
        quantity: item.quantity,
        unitPrice: item.snapshotPrice,
        itemTotal: item.itemTotal,
      })),
      subTotal: cart.subTotal,
    },
    rejected,
  });
});
