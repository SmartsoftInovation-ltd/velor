const joi = require("joi");

const limits = joi.object({
  maxStaff: joi.number().integer().min(0).allow(null),
});

const billing = joi.object({
  price: joi.number().min(0),
  cycle: joi.string().valid("monthly", "yearly", "one-time"),
  startedAt: joi.date().iso().allow(null),
  renewsAt: joi.date().iso().allow(null),
});

// Owner account created with the store. The operator sets the first password;
// the owner may keep it or change it later.
const password = joi.string().min(8).max(128);

const owner = joi.object({
  name: joi.string().trim().min(2).max(100).required(),
  email: joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  phone: joi.string().trim().pattern(/^01[0-9]{9}$/).required(),
  password: password.required(),
});

// Slug format and reserved words are enforced by the Tenant model
const createTenantSchema = joi.object({
  name: joi.string().trim().min(2).max(100).required(),
  slug: joi.string().trim().lowercase().required(),
  plan: joi.string().trim().max(50),
  limits,
  billing,
  owner,
});

// slug, status and webhookKey are deliberately not updatable here
const updateTenantSchema = joi
  .object({
    name: joi.string().trim().min(2).max(100),
    plan: joi.string().trim().max(50),
    limits,
    billing,
  })
  .min(1);

const statusChangeSchema = joi.object({
  reason: joi.string().trim().max(500).allow(""),
});

const ownerPasswordSchema = joi.object({
  password: password.required(),
  notify: joi.boolean().default(true),
});

const listTenantsQuerySchema = joi.object({
  status: joi.string().valid("provisioning", "active", "suspended", "cancelled"),
  search: joi.string().trim().max(100).allow(""),
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createTenantSchema, updateTenantSchema, statusChangeSchema, ownerPasswordSchema, listTenantsQuerySchema };
