const dbConfig = {
  databaseName: "jahir",
};

// status code constant
const statusCodes = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Password policy — deliberately permissive on character content (any
// characters are allowed), with only a minimum length enforced. Every place
// that accepts a password reads this so the rule cannot drift between
// registration, admin-created users, password change, and password reset.
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MIN_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;

module.exports = {
  dbConfig,
  statusCodes,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
};
