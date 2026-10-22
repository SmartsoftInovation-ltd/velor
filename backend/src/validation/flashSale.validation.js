const joi = require("joi");

const objectId = joi.string().hex().length(24);

const flashSaleSchema = joi.object({
  title: joi.string().trim().min(1).max(80).required().messages({ "string.empty": "Give the sale a title." }),
  startsAt: joi.date().required(),
  endsAt: joi.date().greater(joi.ref("startsAt")).required().messages({ "date.greater": "The sale must end after it starts." }),
  isActive: joi.boolean().default(true),
  items: joi
    .array()
    .items(
      joi.object({
        product: objectId.required(),
        variant: objectId.allow(null, "").default(null),
        salePrice: joi.number().greater(0).required().messages({ "number.greater": "A sale price must be above 0." }),
      }),
    )
    .min(1)
    .max(200)
    .required()
    .messages({ "array.min": "Add at least one product to the sale." }),
});

module.exports = { flashSaleSchema };
