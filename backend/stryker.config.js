// Mutation testing of the high-risk shared code (npm run test:mutation).
// Uses the Jest runner with a reduced Jest config (stryker.jest.config.js)
// that runs only the test files exercising these modules.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
module.exports = {
  packageManager: "npm",
  testRunner: "jest",
  jest: { projectType: "custom", configFile: "stryker.jest.config.js", enableFindRelatedTests: false },
  coverageAnalysis: "perTest",
  mutate: [
    "src/utils/saleProfit.util.js",
    "src/utils/saleCost.util.js",
    "src/utils/cache.util.js",
    "src/middleware/checkPermission.middleware.js",
    "src/utils/parseFormData.util.js",
    "src/utils/publicProduct.js",
  ],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 80, low: 60, break: 60 },
  concurrency: 3,
  timeoutMS: 15000,
  timeoutFactor: 1.5,
  incremental: true,
  incrementalFile: "reports/mutation/stryker-incremental.json",
  tempDirName: ".stryker-tmp",
};
