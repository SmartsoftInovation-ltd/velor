const express = require("express");
const shopController = require("../../controller/shop.controller");
const { shopperGuard } = require("../../middleware/authMiddleware");
const returnPolicyController = require("../../controller/returnPolicy.controller");
const shopOrderController = require("../../controller/shopOrder.controller");
const shopCatalogController = require("../../controller/shopCatalog.controller");
const shopCartController = require("../../controller/shopCart.controller");
const shopTrackController = require("../../controller/shopTrack.controller");
const { guestOrAuth } = require("../../middleware/guestOrAuth");
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { trackOrderLimiter, loginLimiter, registerLimiter, couponLimiter, passwordResetLimiter, shopResetSubmitLimiter } = require("../../middleware/rateLimit.middleware");

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
_.get("/return-policy", returnPolicyController.shopReturnPolicy);
_.get("/products", shopCatalogController.products);
_.get("/limited-offers", shopCatalogController.limitedOffers);
_.get("/flash-sale", shopCatalogController.flashSale);
_.get("/products/:slug", shopCatalogController.product);
// Order tracking for anyone holding the invoice number and checkout phone
_.post("/track", trackOrderLimiter, shopTrackController.track);
_.post("/auth/register", registerLimiter, shopController.register);
_.post("/auth/login", loginLimiter, shopController.login);
_.post("/auth/refresh", shopController.refresh);
_.post("/auth/forgot-password", passwordResetLimiter, shopController.forgotPassword);
_.post("/auth/verify-reset-code", shopResetSubmitLimiter, shopController.verifyResetCode);
_.post("/auth/reset-password", shopResetSubmitLimiter, shopController.resetPassword);

_.get("/me", shopperGuard, shopController.me);
_.patch("/me", shopperGuard, shopController.updateMe);
_.post("/me/photo", shopperGuard, singleFileUpload("image"), shopController.updatePhoto);
_.delete("/me/photo", shopperGuard, shopController.removePhoto);
// Rate-limited like sign-in: the current password can otherwise be guessed here
_.post("/me/password", loginLimiter, shopperGuard, shopController.changePassword);
_.get("/orders", shopperGuard, shopController.myOrders);
_.get("/orders/:id", shopperGuard, shopController.myOrder);

// Checkout is open to signed-in shoppers and to guests carrying a cart id.
// Amounts are computed server-side; the body only names the cart and address.
_.put("/cart", guestOrAuth, shopCartController.replaceCart);
_.get("/delivery-options", shopOrderController.deliveryOptions);
_.post("/coupon/preview", guestOrAuth, couponLimiter, shopOrderController.previewCoupon);
_.post("/order", guestOrAuth, shopOrderController.createOrder);
_.get("/track/:invoiceId", shopOrderController.trackOrder);

module.exports = _;
