const base = require("./jest.config");

// The test files that exercise the mutated modules (see stryker.config.js)
module.exports = {
  ...base,
  collectCoverageFrom: undefined,
  coverageThreshold: undefined,
  maxWorkers: 2,
  testMatch: [
    "<rootDir>/tests/integration/profitRules.test.js",
    "<rootDir>/tests/integration/customerInvoiceProfit.test.js",
    "<rootDir>/tests/integration/saleDiscountAndCost.test.js",
    "<rootDir>/tests/unit/cacheAndCost.test.js",
    "<rootDir>/tests/unit/utils.test.js",
    "<rootDir>/tests/middleware/permissions.test.js",
  ],
};
