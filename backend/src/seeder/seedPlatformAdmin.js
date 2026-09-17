const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const PlatformUser = require("../models/platform/platformUser.model");
const { runAsPlatform } = require("../tenancy/context");

const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the first platform superadmin (you). Credentials come from
 * PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD. Idempotent.
 */
async function seedPlatformAdmin({ email, password, name = "Platform Admin" } = {}) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("PLATFORM_ADMIN_EMAIL is required");
  if (!password) throw new Error("PLATFORM_ADMIN_PASSWORD is required");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`PLATFORM_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return runAsPlatform(async () => {
    const existing = await PlatformUser.findOne({ email: normalizedEmail });
    if (existing) {
      console.log("Platform admin already exists, skipping.");
      return { created: false, user: existing };
    }

    const user = await PlatformUser.create({
      name,
      email: normalizedEmail,
      password,
      role: "superadmin",
      isActive: true,
    });
    console.log("Platform admin created.");
    return { created: true, user };
  });
}

if (require.main === module) {
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(() =>
      seedPlatformAdmin({
        email: process.env.PLATFORM_ADMIN_EMAIL,
        password: process.env.PLATFORM_ADMIN_PASSWORD,
        name: process.env.PLATFORM_ADMIN_NAME,
      }),
    )
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error("Error seeding platform admin:", err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedPlatformAdmin };
