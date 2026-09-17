const { customError } = require("../../lib/CustomError");
const { statusCodes } = require("../../constant/constant");

// Validates a request property (body by default) against a Joi schema, rejecting unknown fields
const validateBody = (schema, property = "body") => async (req, res, next) => {
  try {
    req[property] = await schema.validateAsync(req[property] || {}, { abortEarly: false, allowUnknown: false });
    next();
  } catch (error) {
    const message = error.details ? error.details.map((d) => d.message).join(", ") : error.message;
    next(new customError(message, statusCodes.BAD_REQUEST));
  }
};

const validateQuery = (schema) => validateBody(schema, "query");

module.exports = { validateBody, validateQuery };
