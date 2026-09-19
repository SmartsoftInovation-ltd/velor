const OrderSource = require("../models/orderSource.model");
const { WEBSITE_SOURCE } = require("../models/orderSource.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");

const MAX_NAME = 40;

/**
 * The list a shop starts with. Created on first read rather than by a migration
 * so a newly provisioned store has something to choose from immediately, and an
 * existing store gets the list the first time someone opens the order screen.
 */
const STARTER_SOURCES = [WEBSITE_SOURCE, "Messenger", "WhatsApp", "Imo", "Instagram", "Over the phone"];

const seedIfEmpty = async () => {
  if (await OrderSource.exists({})) return;
  // Sequential save() so the duplicate-name hook runs; the list is six rows.
  for (const name of STARTER_SOURCES) {
    await new OrderSource({ name }).save().catch(() => {});
  }
};

//@desc list the sources this shop takes orders through
exports.getOrderSources = asynchandeler(async (req, res) => {
  await seedIfEmpty();
  const sources = await OrderSource.find({ isActive: true }).sort({ name: 1 });
  return apiResponse.sendSuccess(res, statusCodes.OK, "Order sources", sources);
});

//@desc add a source from the order screen
exports.createOrderSource = asynchandeler(async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) throw new customError("A name is required", statusCodes.BAD_REQUEST);
  if (name.length > MAX_NAME) {
    throw new customError(`A name cannot be longer than ${MAX_NAME} characters`, statusCodes.BAD_REQUEST);
  }

  const source = new OrderSource({ name });
  await source.save();

  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Order source created", source);
});

//@desc rename a source, or turn it off
exports.updateOrderSource = asynchandeler(async (req, res) => {
  const source = await OrderSource.findById(req.params.id);
  if (!source) throw new customError("Order source not found", statusCodes.NOT_FOUND);

  // Web orders are stamped "Website" by the storefront itself, so the row that
  // names it cannot be renamed or switched off out from under them.
  const locked = source.name === WEBSITE_SOURCE;
  if (locked && (req.body?.name !== undefined || req.body?.isActive === false)) {
    throw new customError(`"${WEBSITE_SOURCE}" cannot be changed`, statusCodes.FORBIDDEN);
  }

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new customError("A name is required", statusCodes.BAD_REQUEST);
    if (name.length > MAX_NAME) {
      throw new customError(`A name cannot be longer than ${MAX_NAME} characters`, statusCodes.BAD_REQUEST);
    }
    source.name = name;
  }
  if (req.body?.isActive !== undefined) source.isActive = Boolean(req.body.isActive);

  await source.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Order source updated", source);
});

//@desc remove a source; past orders keep the name they were saved with
exports.deleteOrderSource = asynchandeler(async (req, res) => {
  const source = await OrderSource.findById(req.params.id);
  if (!source) throw new customError("Order source not found", statusCodes.NOT_FOUND);
  if (source.name === WEBSITE_SOURCE) {
    throw new customError(`"${WEBSITE_SOURCE}" cannot be deleted`, statusCodes.FORBIDDEN);
  }

  await OrderSource.deleteOne({ _id: source._id });
  return apiResponse.sendSuccess(res, statusCodes.OK, "Order source deleted", { _id: source._id });
});
