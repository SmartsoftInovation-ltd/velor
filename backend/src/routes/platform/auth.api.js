const express = require("express");
const controller = require("../../controller/platform/platformAuth.controller");
const { platformGuard } = require("../../middleware/platformGuard.middleware");
const { platformLoginLimiter, platformOtpLimiter } = require("../../middleware/rateLimit.middleware");
const { validateBody } = require("../../validation/platform/validateBody");
const {
  platformLoginSchema,
  platformOtpSchema,
  platformResendOtpSchema,
  platformUpdateMeSchema,
} = require("../../validation/platform/auth.validation");

const _ = express.Router();

// Sign-in is two steps: the password starts a challenge, the SMS code opens the
// session. There is no way into the console that skips the code.
_.post("/login", platformLoginLimiter, validateBody(platformLoginSchema), controller.login);
_.post("/verify-otp", platformOtpLimiter, validateBody(platformOtpSchema), controller.verifyOtp);
_.post("/resend-otp", platformOtpLimiter, validateBody(platformResendOtpSchema), controller.resendOtp);
_.post("/refresh", controller.refresh);
_.post("/logout", controller.logout);
_.get("/me", platformGuard, controller.me);
// Self-service: every operator owns their own profile, support role included
_.patch("/me", platformGuard, validateBody(platformUpdateMeSchema), controller.updateMe);

module.exports = _;
