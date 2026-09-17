module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Tests must never read the real backend/.env (production credentials)
    "^dotenv$": "<rootDir>/tests/mocks/dotenv.js",
  },
  testTimeout: 30000,
  // All files share one in-memory replica set; unbounded parallelism starves it
  maxWorkers: 4,
};
