const { isDevelopment } = require("./../config/nodeEnv");
// this error show when you are working on production mode error size are more consize
const productionError = (error, res) => {
  console.log("from production error funtion ", error);
  if (error.isOperationalError) {
    return res.status(error.statusCode).json({
      statusCode: error.statusCode,
      message: error.message,
      ...(typeof error.code === "string" ? { code: error.code } : {}),
    });
  } else {
    // The same error envelope as every other error ({ statusCode, message }),
    // with nothing internal in it
    return res.status(error.statusCode).json({
      statusCode: error.statusCode,
      message: "Something went wrong , please try agin later !!",
    });
  }
};
// this error only show when you are working on developement mode
const developementError = (error, res) => {
  return res.status(error.statusCode).json({
    statusCode: error.statusCode,
    message: error.message,
    ...(typeof error.code === "string" ? { code: error.code } : {}),
    status: error.status,
    isOperationalError: error.isOperationalError,
    data: error.data,
    errorStack: error.stack,
  });
};

// Mongo/Mongoose errors reach here with driver-level text ("E11000 duplicate key
// error collection: test.accounts index: slug_1 dup key: { slug: "bank" }"),
// which is what the client ends up showing the user. Rewrite the common ones
// into a sentence a shop operator can act on. Models that already raise their
// own customError for these cases are untouched — this only catches what slips
// through (findOneAndUpdate, bulk writes, updates that skip save hooks).
// jwt.verify throws TokenExpiredError / JsonWebTokenError, which are not
// customError instances, so without this they fall through as non-operational
// and get a 500. A 500 is wrong on two counts: an expired access token is a
// normal, expected client condition, and the dashboard's axios interceptor
// only attempts a token refresh on a 401 — a 500 makes it give up and surface
// a hard error instead of silently refreshing the session.
const normalizeAuthError = (error) => {
  if (error.name === "TokenExpiredError") {
    error.statusCode = 401;
    error.isOperationalError = true;
    error.message = "Access token expired";
    return error;
  }

  if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
    error.statusCode = 401;
    error.isOperationalError = true;
    error.message = "Invalid token";
    return error;
  }

  return error;
};

const normalizeDatabaseError = (error) => {
  const raw = String(error.message || "");
  const isDuplicate =
    error.code === 11000 ||
    error.code === 11001 ||
    (error.codeName === "DuplicateKey") ||
    raw.includes("E11000");

  if (isDuplicate) {
    let field =
      (error.keyPattern && Object.keys(error.keyPattern)[0]) ||
      (error.keyValue && Object.keys(error.keyValue)[0]);
    let value = error.keyValue && field ? error.keyValue[field] : undefined;

    // A duplicate raised inside an update pipeline arrives as a wrapped
    // "Plan executor error" whose keyPattern/keyValue are missing, so read the
    // field and value back out of the message text.
    if (!field) {
      const dupKey = raw.match(/dup key:\s*\{\s*([^:]+):\s*"?([^",}]*)"?/);
      if (dupKey) {
        field = dupKey[1].trim();
        value = dupKey[2].trim();
      }
    }

    // Index names are suffixed with the sort direction (slug_1) — drop it.
    if (field) field = field.replace(/_-?1$/, "");

    error.statusCode = 400;
    error.isOperationalError = true;
    error.message = value
      ? `${field} "${value}" already exists`
      : `${field || "This value"} already exists`;
    return error;
  }

  if (error.name === "CastError") {
    error.statusCode = 400;
    error.isOperationalError = true;
    error.message = `Invalid ${error.path}: ${error.value}`;
    return error;
  }

  // Joi: validators that call validateAsync() without a catch let its
  // ValidationError through. It carries `details`, not Mongoose's `errors`.
  if (error.name === "ValidationError" && Array.isArray(error.details)) {
    error.statusCode = 400;
    error.isOperationalError = true;
    error.message = error.details.map((d) => d.message).join(", ");
    return error;
  }

  if (error.name === "ValidationError" && error.errors) {
    error.statusCode = 400;
    error.isOperationalError = true;
    error.message = Object.values(error.errors)
      .map((e) => e.message)
      .join(", ");
    return error;
  }

  return error;
};

// A tenant-scoped query ran without a tenant (strict mode): the request did not
// name its store
const normalizeTenancyError = (error) => {
  if (error.name === "TenancyError") {
    error.statusCode = 400;
    error.isOperationalError = true;
    error.code = "TENANT_CONTEXT_REQUIRED";
    error.message = "This request must identify a store";
  }
  return error;
};

exports.globalErrorHandeler = (error, req, res, next) => {
  error = normalizeTenancyError(error);
  error = normalizeAuthError(error);
  error = normalizeDatabaseError(error);
  error.statusCode = error.statusCode || 500;
  // Anything that is not clearly development gets the concise shape: an
  // unrecognised NODE_ENV must never leak stack traces to a client.
  if (isDevelopment()) developementError(error, res);
  else productionError(error, res);
};
