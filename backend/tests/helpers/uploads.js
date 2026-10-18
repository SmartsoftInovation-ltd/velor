const fs = require("fs");
const path = require("path");
const settings = require("../../src/settings/settings.service");

// A valid 1×1 PNG, small enough to attach to any multipart request
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const TEMP_DIR = path.resolve(__dirname, "../../public/temp");

/**
 * Multer writes uploads to public/temp. Call in beforeEach / afterEach to
 * remove only the files a test created — anything already there (a developer's
 * pending upload) is left alone.
 */
const tempUploadTracker = () => {
  let before = new Set();
  return {
    snapshot: () => {
      before = new Set(fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR) : []);
    },
    created: () => (fs.existsSync(TEMP_DIR) ? fs.readdirSync(TEMP_DIR).filter((f) => !before.has(f)) : []),
    cleanup: () => {
      if (!fs.existsSync(TEMP_DIR)) return;
      for (const file of fs.readdirSync(TEMP_DIR)) {
        if (!before.has(file)) fs.rmSync(path.join(TEMP_DIR, file), { force: true });
      }
    },
  };
};

// Uploads are refused (422) unless the store's Cloudinary account is set up
const enableCloudinary = (tenant) =>
  settings.updateSection(tenant._id || tenant, "cloudinary", {
    enabled: true,
    cloudName: "test-cloud",
    apiKey: "123456789",
    apiSecret: "dummy-cloudinary-secret",
  });

module.exports = { PNG, TEMP_DIR, tempUploadTracker, enableCloudinary };
