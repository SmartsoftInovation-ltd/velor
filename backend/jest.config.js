module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/bugAudit.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Tests must never read the real backend/.env (production credentials)
    "^dotenv$": "<rootDir>/tests/mocks/dotenv.js",
  },
  testTimeout: 30000,
  // All files share one in-memory replica set; unbounded parallelism starves it
  maxWorkers: 4,

  // `npm run test:coverage` — see TESTING.md for the per-module figures
  collectCoverageFrom: ["src/**/*.js", "!src/seeder/**", "!src/scripts/**", "!src/migrations/cli.js", "!src/socket/client.js"],
  coverageReporters: ["text-summary", "json-summary", "lcov", "html"],
  coverageThreshold: {
    // Measured at the end of Phase 1: lines 83 %, statements 82 %,
    // functions 83 %, branches 65 %. The 75 % branch target of the brief is
    // not reached (see TESTING.md "Coverage"); the gate stops regressions.
    global: { lines: 80, statements: 80, functions: 80, branches: 62 },
    // High-risk shared code: 90 %+ lines
    "./src/utils/saleProfit.util.js": { lines: 100, branches: 100 },
    "./src/utils/saleCost.util.js": { lines: 100, branches: 90 },
    "./src/utils/cache.util.js": { lines: 100, branches: 100 },
    "./src/middleware/checkPermission.middleware.js": { lines: 100, branches: 80 },
    "./src/middleware/authMiddleware.js": { lines: 95, branches: 80 },
    "./src/tenancy/tenantPlugin.js": { lines: 95, branches: 85 },
    "./src/tenancy/context.js": { lines: 100, branches: 100 },
    "./src/lib/GlobalErrorHandeler.js": { lines: 100, branches: 80 },
    "./src/controller/sales.controller.js": { lines: 90 },
    "./src/controller/user.controller.js": { lines: 90 },
    "./src/controller/purchase.controller.js": { lines: 90 },
  },
};
