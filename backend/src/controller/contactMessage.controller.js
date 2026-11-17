const ContactMessage = require("../models/contactMessage.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");

// Same caps as the storefront form, enforced here because the form is not a control
const LIMITS = { name: 100, email: 254, subject: 150, message: 500 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const PAGE_SIZE = 20;

const text = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * POST /shop/contact — public. The store comes from the domain, never the body.
 * Only the four form fields are read; anything else in the body is ignored.
 */
exports.create = asynchandeler(async (req, res) => {
  const input = {
    name: text(req.body?.name),
    email: text(req.body?.email).toLowerCase(),
    subject: text(req.body?.subject),
    message: text(req.body?.message),
  };

  if (!input.name || !input.email || !input.message) {
    throw new customError("Name, email and message are required", statusCodes.BAD_REQUEST);
  }
  if (!EMAIL.test(input.email)) throw new customError("Please enter a valid email address", statusCodes.BAD_REQUEST);
  for (const [field, max] of Object.entries(LIMITS)) {
    if (input[field].length > max) {
      throw new customError(`${field[0].toUpperCase()}${field.slice(1)} must be ${max} characters or fewer`, statusCodes.BAD_REQUEST);
    }
  }

  await ContactMessage.create(input);
  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Thanks! We will get back to you soon.", null);
});

/** Dashboard list, newest first, paged. `?status=unread|read` narrows it. */
exports.list = asynchandeler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filter = {};
  if (req.query.status === "unread") filter.isRead = false;
  if (req.query.status === "read") filter.isRead = true;

  const [items, total, unread] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ isRead: false }),
  ]);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Contact messages", {
    items,
    total,
    unread,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});

const findOr404 = async (id) => {
  if (!OBJECT_ID.test(id)) throw new customError("Invalid message id", statusCodes.BAD_REQUEST);
  const message = await ContactMessage.findById(id);
  if (!message) throw new customError("Message not found", statusCodes.NOT_FOUND);
  return message;
};

/** PATCH { isRead } — mark read or back to unread */
exports.setRead = asynchandeler(async (req, res) => {
  if (typeof req.body?.isRead !== "boolean") throw new customError("isRead must be true or false", statusCodes.BAD_REQUEST);
  const message = await findOr404(req.params.id);
  message.isRead = req.body.isRead;
  await message.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, message.isRead ? "Marked as read" : "Marked as unread", message);
});

exports.remove = asynchandeler(async (req, res) => {
  const message = await findOr404(req.params.id);
  await message.deleteOne();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Message deleted", null);
});
