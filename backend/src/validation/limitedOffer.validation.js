const joi = require("joi");

const objectId = joi.string().hex().length(24);

// One or many picks at once; each is a whole product, or one of its variants
const addLimitedOfferSchema = joi.object({
  items: joi
    .array()
    .items(
      joi.object({
        product: objectId.required(),
        variant: objectId.allow(null, "").default(null),
      }),
    )
    .min(1)
    .max(100)
    .required()
    .messages({ "array.min": "Choose at least one product.", "array.max": "Add at most 100 at a time." }),
  // The first pick gets this priority, the next one more, keeping the order they were picked in
  priority: joi.number().integer().min(0).max(1000).default(0),
});

const updateLimitedOfferSchema = joi
  .object({
    priority: joi.number().integer().min(0).max(1000),
    isActive: joi.boolean(),
  })
  .min(1);

module.exports = { addLimitedOfferSchema, updateLimitedOfferSchema };
