const express = require("express");
const shopController = require("../../controller/shop.controller");
const { shopperGuard } = require("../../middleware/authMiddleware");
const shopOrderController = require("../../controller/shopOrder.controller");
const shopCatalogController = require("../../controller/shopCatalog.controller");
const { guestOrAuth } = require("../../middleware/guestOrAuth");
const { loginLimiter, registerLimiter } = require("../../middleware/rateLimit.middleware");

/**
 * Storefront customer accounts.
 *
 * Every route here resolves its store from the hostname, upstream in
 * `resolveRequestTenant` — nothing in the body or the path names a tenant.
 * These are deliberately separate from `/auth/*`, which serves dashboard staff
 * and takes an explicit workspace.
 */
const _ = express.Router();

_.get("/store", shopController.store);
_.get("/banners", shopController.banners);
_.get("/promo-banner", shopController.promoBanner);
_.get("/products", shopCatalogController.products);
_.get("/limited-offers", shopCatalogController.limitedOffers);
_.get("/flash-sale", shopCatalogController.flashSale);
_.get("/products/:slug", shopCatalogController.product);
_.post("/auth/register", registerLimiter, shopController.register);
_.post("/auth/login", loginLimiter, shopController.login);

_.get("/me", shopperGuard, shopController.me);
_.get("/orders", shopperGuard, shopController.myOrders);
_.get("/orders/:id", shopperGuard, shopController.myOrder);

// Checkout is open to signed-in shoppers and to guests carrying a cart id.
// Amounts are computed server-side; the body only names the cart and address.
_.post("/order", guestOrAuth, shopOrderController.createOrder);
_.get("/track/:invoiceId", shopOrderController.trackOrder);

module.exports = _;
