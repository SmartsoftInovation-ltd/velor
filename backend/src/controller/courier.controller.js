const Merchant = require("../models/marchant.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { customError } = require("../lib/CustomError");
const PathaoCourier = require("../service/couriers/PathaoCourier");
const cityZoneService = require("../service/couriers/courierCityZone");
const { getCourierConfig } = require("../integrations/config");

// Tenant settings when the store configured the courier; otherwise the store's own
// legacy Merchant document (Merchant applies tenantPlugin, so the lookup is scoped)
const resolveMerchant = async (provider, merchantId) => {
  const configured = await getCourierConfig(provider);
  if (configured) return configured;
  return Merchant.findById(merchantId);
};

// Create single order
exports.createPathaoOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;

  const merchant = await resolveMerchant("pathao", merchantId);
  if (!merchant)
    throw new customError("Merchant not found", statusCodes.NOT_FOUND);

  const courier = new PathaoCourier(merchant);
  const order = await courier.createOrder(orderId);
  if (!order)
    throw new customError(
      "Failed to create Pathao order",
      statusCodes.SERVER_ERROR,
    );
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Pathao order created",
    order,
  );
});

exports.bulkPathaoOrder = asynchandeler(async (req, res) => {
  const { orderIds, merchantId } = req.body;
  const merchant = await resolveMerchant("pathao", merchantId);
  if (!merchant)
    throw new customError("Merchant not found", statusCodes.NOT_FOUND);
  const courier = new PathaoCourier(merchant);
  const orders = await courier.bulkOrderByIds(orderIds);

  if (!orders)
    throw new customError(
      "Failed to create Pathao bulk orders",
      statusCodes.SERVER_ERROR,
    );
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Pathao bulk orders created",
    orders,
  );
});

// get short info of a Pathao order by internal order ID
exports.getPathaoOrderShortInfo = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new customError("Order ID is required", 400);
  const merchant = await resolveMerchant("pathao", req.body.merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new PathaoCourier(merchant);
  const orderInfo = await courier.getOrderInfo(id);
  if (!orderInfo) throw new customError("Order not found", 404);
  apiResponse.sendSuccess(res, 200, "Order info fetched", orderInfo);
});

// The store's own Pathao account for the city/zone/area lookups
const pathaoLookups = async () => {
  const merchant = await getCourierConfig("pathao");
  if (!merchant) {
    throw new customError("Pathao courier is not configured", 422, "COURIER_NOT_CONFIGURED");
  }
  return new cityZoneService(merchant);
};

//@desc Get available cities
//@route GET /api/v1/courier/pathao/cities

exports.getPathaoCities = asynchandeler(async (req, res) => {
  const cityZone = await pathaoLookups();
  const cities = await cityZone.getCities();
  apiResponse.sendSuccess(res, 200, "Cities fetched successfully", cities);
});

//@desc Get zones by city ID
//@route GET /api/v1/courier/pathao/cities/:cityId/zones
exports.getPathaoZonesByCity = asynchandeler(async (req, res) => {
  const { cityId } = req.params;
  if (!cityId) throw new customError("City ID is required", 400);

  const cityZone = await pathaoLookups();
  const zones = await cityZone.getZones(cityId);
  apiResponse.sendSuccess(res, 200, "Zones fetched successfully", zones);
});

//@desc Get areas by zone ID
//@route GET /api/v1/courier/pathao/zones/:zoneId/areas
exports.getPathaoAreasByZone = asynchandeler(async (req, res) => {
  const { zoneId } = req.params;
  if (!zoneId) throw new customError("Zone ID is required", 400);
  const cityZone = await pathaoLookups();
  const areas = await cityZone.getAreas(zoneId);
  apiResponse.sendSuccess(res, 200, "Areas fetched successfully", areas);
});

// Steadfast Courier Integration
const SteadFastCourier = require("../service/couriers/steadFast/SteadFastCourier");
const { statusCodes } = require("../constant/constant");
// Create single order
exports.createSteadFastOrder = asynchandeler(async (req, res) => {
  const { merchantId, orderId } = req.body;
  const merchant = await resolveMerchant("steadfast", merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new SteadFastCourier(merchant);
  const order = await courier.createOrder(orderId);
  if (!order) throw new customError("Failed to create Steadfast order", 500);
  apiResponse.sendSuccess(res, 201, "Steadfast order created", order);
});

// create bulk order
exports.bulkSteadFastOrder = asynchandeler(async (req, res) => {
  const { orderIds, merchantId } = req.body;
  const merchant = await resolveMerchant("steadfast", merchantId);
  if (!merchant) throw new customError("Merchant not found", 404);
  const courier = new SteadFastCourier(merchant);
  const orders = await courier.bulkCreateOrders(orderIds);

  if (!orders)
    throw new customError("Failed to create Steadfast bulk orders", 500);
  apiResponse.sendSuccess(res, 201, "Steadfast bulk orders created", orders);
});

// ---------- per-tenant webhooks (/api/v1/hooks/:provider/:webhookKey) ----------
// The tenant context is opened from the webhook key; the provider secret proves the caller.

const { getSettings } = require("../settings/settings.service");
const { getTenantId } = require("../tenancy/context");

exports.handlePathaoHook = asynchandeler(async (req, res) => {
  const { pathao } = await getSettings(getTenantId());
  const courier = new PathaoCourier({ ...pathao, tenantId: getTenantId() });
  await courier.handlePathaoWebhook(req, res, pathao.enabled ? pathao.webhookSecret : null);
});

exports.handleSteadfastHook = asynchandeler(async (req, res) => {
  const { steadfast } = await getSettings(getTenantId());
  const expected = steadfast.enabled ? steadfast.webhookToken : null;
  if (!SteadFastCourier.isValidWebhookToken(req.headers.authorization, expected)) {
    return res.status(401).json({ status: "error", message: "Invalid API token" });
  }

  try {
    const courier = new SteadFastCourier({ baseURL: steadfast.baseUrl });
    await courier.applyWebhook(req.body);
    return res.status(200).json({ status: "success", message: "Webhook received successfully." });
  } catch (error) {
    console.error("❌ Steadfast webhook error:", error.message);
    return res.status(200).json({ status: "error", message: error.message });
  }
});
