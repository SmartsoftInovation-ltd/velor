// Matrix cases that fail because of a confirmed bug (see BUGS_FOUND.md).
// Each runs as test.failing: when the bug is fixed the case starts passing,
// the run fails, and the entry must be removed here.
const KNOWN = {
  // BUG-001: Joi errors from validateAsync() are not mapped by the global error handler
  "POST /api/v1/categories|empty body": "BUG-001",
  "POST /api/v1/brand|empty body": "BUG-001",
  "POST /api/v1/product/createproduct|empty body": "BUG-001",
  "PUT /api/v1/product/updateproductinfo/:slug|empty body": "BUG-001",
  "PUT /api/v1/product/updateproductinfo/:slug|malformed id": "BUG-001",
  "PUT /api/v1/product/updateproductinfo/:slug|unknown ObjectId": "BUG-001",
  // BUG-002: customError(statusCode, message) arguments swapped
  "POST /api/v1/employee/create-employee-department|empty body": "BUG-002",
  "POST /api/v1/employee/create-employee-section|empty body": "BUG-002",
};

module.exports = { KNOWN };

// Routes whose answer does not match the documented envelopes (see
// tests/contract/envelope.test.js), with the bug that explains each. Since
// BUG-075 a 500 answers { statusCode, message } like every error; these two
// answer an empty body because customError's arguments are swapped.
module.exports.ENVELOPE_DEVIATIONS = {
  "POST /api/v1/employee/create-employee-department": "BUG-002",
  "POST /api/v1/employee/create-employee-section": "BUG-002",
};
