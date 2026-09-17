const joi = require("joi");

const email = joi.string().trim().lowercase().email({ tlds: { allow: false } }).required();
const challengeId = joi.string().trim().uuid().required();

const platformLoginSchema = joi.object({
  email,
  password: joi.string().required(),
});

// Second factor: the 6-digit code texted to the operator phone
const platformOtpSchema = joi.object({
  challengeId,
  code: joi.string().trim().pattern(/^\d{6}$/).required(),
});

// A resend proves the password again, so a stolen challenge id alone cannot
// keep texting the operator
const platformResendOtpSchema = joi.object({
  email,
  password: joi.string().required(),
  challengeId: challengeId.optional(),
});

module.exports = { platformLoginSchema, platformOtpSchema, platformResendOtpSchema };
