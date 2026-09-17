const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const PlatformUser = require("../models/platform/platformUser.model");
const { runAsPlatform } = require("../tenancy/context");

const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the first platform superadmin, or sets the password on an existing
 * account when `reset` is passed. Credentials are given on the command line,
 * never kept in .env — a platform password in a file is a standing risk, and
 * this seeder runs by hand a handful of times.
 *
 *   node src/seeder/seedPlatformAdmin.js --email you@example.com --password '…'
 *   node src/seeder/seedPlatformAdmin.js --email you@example.com --password '…' --reset
 */
async function seedPlatformAdmin({ email, password, name = "Platform Admin", reset = false } = {}) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("--email is required");
  if (!password) throw new Error("--password is required");
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
      // Sign out every open console session: the old password is gone
      existing.tokenVersion += 1;
      await existing.save();
      console.log("Platform admin password updated; existing sessions revoked.");
      return { created: false, updated: true, user: existing };
    }

    const user = await PlatformUser.create({
      name,
      email: normalizedEmail,
      password,
      role: "superadmin",
      isActive: true,
    });
    console.log("Platform admin created.");
    return { created: true, updated: false, user };
  });
}

// --email a@b.c --password secret --name "Someone" --reset
const parseArgs = (argv) => {
  const args = { reset: argv.includes("--reset") };
  for (const flag of ["email", "password", "name"]) {
    const index = argv.indexOf(`--${flag}`);
    if (index !== -1 && argv[index + 1]) args[flag] = argv[index + 1];
  }
  return args;
};

if (require.main === module) {
  const { email, password, name, reset } = parseArgs(process.argv.slice(2));
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(() => seedPlatformAdmin({ email, password, name, reset }))
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error("Error seeding platform admin:", err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedPlatformAdmin };
