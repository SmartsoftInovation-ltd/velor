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

// An operator editing their own account. Role and isActive are absent on
// purpose — those stay with a superadmin on /platform/users.
const platformUpdateMeSchema = joi
  .object({
    name: joi.string().trim().min(2).max(100),
    email: joi.string().trim().lowercase().email({ tlds: { allow: false } }),
    password: joi.string().min(12),
    // Required by the controller for an email or password change
    currentPassword: joi.string(),
  })
  .min(1);

module.exports = {
  platformLoginSchema,
  platformOtpSchema,
  platformResendOtpSchema,
  platformUpdateMeSchema,
};
