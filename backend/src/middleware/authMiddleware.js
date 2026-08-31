const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
require("../models/permisson.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

exports.authGuard = asynchandeler(async (req, res, next) => {
  let token =
    req.headers?.authorization?.replace("Bearer ", "") || req.body?.token;

  if (!token || token === "null" || token === "undefined") {
    throw new customError("Token not found or Invalid / Token Required", 401);
  }

  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  if (!decoded) {
    throw new customError("Invalid token", 401);
  }
  const user = await User.findOne({
    $or: [{ email: decoded.email }, { phone: decoded.phone }],
  })
    .populate({
      path: "roles",
      populate: { path: "permissions.permission" },
    })
    .populate("permissions.permission")
    .populate("createdBy")
    .select(
      "-__v -wishList -cart -newsLetterSubscribe -refreshToken -password -twoFactorEnabled"
    );

  if (!user) {
    throw new customError("User not found", 401);
  }

  // Revoke live sessions the moment an account is deactivated or blocked.
  // 401 (not 403) so the client's interceptor treats it as an auth failure:
  // its refresh attempt is rejected too, which signs the user out.
  if (user.isBlocked || !user.isActive) {
    throw new customError("Your account is no longer active", 401);
  }

  req.user = user;
  next();
});
