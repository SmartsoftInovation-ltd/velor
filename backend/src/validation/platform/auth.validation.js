const joi = require("joi");

const platformLoginSchema = joi.object({
  email: joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: joi.string().required(),
});

module.exports = { platformLoginSchema };
