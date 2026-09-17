const joi = require("joi");

const limits = joi.object({
  maxStaff: joi.number().integer().min(0).allow(null),
});

// Slug format and reserved words are enforced by the Tenant model
const createTenantSchema = joi.object({
  name: joi.string().trim().min(2).max(100).required(),
  slug: joi.string().trim().lowercase().required(),
  plan: joi.string().trim().max(50),
  limits,
});

// slug, status and webhookKey are deliberately not updatable here
const updateTenantSchema = joi
  .object({
    name: joi.string().trim().min(2).max(100),
    plan: joi.string().trim().max(50),
    limits,
  })
  .min(1);

const statusChangeSchema = joi.object({
  reason: joi.string().trim().max(500).allow(""),
});

const listTenantsQuerySchema = joi.object({
  status: joi.string().valid("provisioning", "active", "suspended", "cancelled"),
  search: joi.string().trim().max(100).allow(""),
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(20),
});

module.exports = { createTenantSchema, updateTenantSchema, statusChangeSchema, listTenantsQuerySchema };
