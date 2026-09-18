const joi = require("joi");

// Hostname format and the platform's reserved labels are enforced by the
// TenantDomain model, so this only checks the shape of the request itself.
const addDomainSchema = joi.object({
  host: joi.string().trim().lowercase().max(253).required(),
  // A store's first domain is usually the canonical one
  isPrimary: joi.boolean().default(false),
});

const updateDomainSchema = joi
  .object({
    // Demoting the only primary would leave payment redirects with no target,
    // so a domain is made primary here and demoted by promoting another.
    isPrimary: joi.boolean().valid(true).required(),
  })
  .min(1);

module.exports = { addDomainSchema, updateDomainSchema };
