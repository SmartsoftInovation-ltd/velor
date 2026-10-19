const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const PlatformUser = require("../models/platform/platformUser.model");
const { runAsPlatform } = require("../tenancy/context");

const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the first platform superadmin, or sets the password on an existing
 * account when `--reset` is passed.
 *
 *   node src/seeder/seedPlatformAdmin.js
 *   node src/seeder/seedPlatformAdmin.js --reset
 *
 * Credentials come from the environment — PLATFORM_ADMIN_EMAIL,
 * PLATFORM_ADMIN_PASSWORD and the optional PLATFORM_ADMIN_NAME and
 * PLATFORM_ADMIN_PHONE (where the sign-in code is texted) — so the seeder
 * runs unattended and the same values serve every environment's own .env.
 *
 * SECURITY: this account governs every seller on the platform. Its password
 * therefore sits in a file on every machine holding the repo, in every backup
 * of that file, and is readable by anything that can read this directory. Keep
 * .env out of version control (it is), restrict who can read the deployment,
 * and change the value then re-run with --reset to rotate — that also revokes
 * every open console session.
 */
async function seedPlatformAdmin({ email, password, name = "Platform Admin", phone, reset = false } = {}) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("PLATFORM_ADMIN_EMAIL is required");
  if (!password) throw new Error("PLATFORM_ADMIN_PASSWORD is required");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return runAsPlatform(async () => {
    const existing = await PlatformUser.findOne({ email: normalizedEmail }).select("+password");
    if (existing) {
      if (!reset) {
        console.log("Platform admin already exists, skipping. Pass --reset to set a new password.");
        return { created: false, updated: false, user: existing };
      }
      existing.password = password;
      existing.isActive = true;
      if (!existing.phone && phone?.trim()) existing.phone = phone.trim();
      // Sign out every open console session: the old password is gone
      existing.tokenVersion += 1;
      await existing.save();
      console.log("Platform admin password updated; existing sessions revoked.");
      return { created: false, updated: true, user: existing };
    }

    const user = await PlatformUser.create({
      name,
      email: normalizedEmail,
      // The sign-in code is texted here
      phone: phone?.trim() || null,
      password,
      role: "superadmin",
      isActive: true,
    });
    console.log("Platform admin created.");
    return { created: true, updated: false, user };
  });
}

// Credentials are environment-only; --reset is the sole flag
const fromEnv = (argv) => ({
  reset: argv.includes("--reset"),
  email: process.env.PLATFORM_ADMIN_EMAIL,
  password: process.env.PLATFORM_ADMIN_PASSWORD,
  name: process.env.PLATFORM_ADMIN_NAME,
  phone: process.env.PLATFORM_ADMIN_PHONE,
});

if (require.main === module) {
  const { email, password, name, phone, reset } = fromEnv(process.argv.slice(2));
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(() => seedPlatformAdmin({ email, password, name, phone, reset }))
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error("Error seeding platform admin:", err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedPlatformAdmin };
